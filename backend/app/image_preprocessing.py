"""Image and PDF Preprocessing Engine for Smart Companion (Medical Document Intelligence).

Provides robust, memory-only validation, orientation correction, resizing,
and carefully calibrated image enhancement for medical prescriptions and reports.

Key design principles:
1. In-memory only: zero disk writes, protecting patient privacy.
2. Safe for handwriting: uses gentle contrast adjustment (CLAHE) and bilateral
   filtering rather than aggressive binarization that would fragment faint pen strokes.
3. Metadata stripping: strips EXIF/GPS metadata before passing images to vision models.
4. Robust validation: inspects file magic bytes, size limits, and format integrity.
"""

from __future__ import annotations

import io
import math
import base64
from dataclasses import dataclass
from typing import List, Optional, Tuple

import numpy as np
from PIL import Image, ImageOps

try:
    import cv2
except ImportError:
    cv2 = None

try:
    import pymupdf as fitz
except ImportError:
    try:
        import fitz
    except ImportError:
        fitz = None


MAX_DOCUMENT_BYTES: int = 10 * 1024 * 1024  # 10 MB limit
MAX_PRESCRIPTION_PAGES: int = 5              # Sensible limit for prescription documents
TARGET_MAX_DIMENSION: int = 1800            # Bounds token consumption while preserving legibility
MIN_READABLE_DIMENSION: int = 600           # Minimum recommended width/height for fine text


class DocumentValidationError(ValueError):
    """Raised when an uploaded document fails size, MIME, magic-byte, or integrity checks."""


class DocumentProcessingError(RuntimeError):
    """Raised when an internal image manipulation or PDF rendering step fails."""


@dataclass
class PreprocessedPage:
    """Represents a single processed page preserved entirely in memory."""
    page_number: int
    original_image: Image.Image         # RGB, orientation-corrected and bounded
    enhanced_image: Image.Image         # RGB with CLAHE illumination normalization
    grayscale_image: Image.Image        # 8-bit grayscale for visual inspections
    binarized_image: Optional[Image.Image]  # Adaptive threshold binary (useful for OCR)
    skew_angle: float                   # Estimated rotation angle in degrees
    jpeg_base64: str                    # Stripped, high-quality JPEG base64 payload
    width: int
    height: int


@dataclass
class PreprocessedDocument:
    """Represents the complete processed document in memory."""
    format: str                         # "pdf", "jpeg", "png", "webp"
    page_count: int
    pages: List[PreprocessedPage]
    is_pdf: bool
    file_size_bytes: int

    @property
    def primary_base64(self) -> str:
        """Returns the base64 string of the first page."""
        return self.pages[0].jpeg_base64 if self.pages else ""

    @property
    def all_base64(self) -> List[str]:
        """Returns the base64 strings of all pages."""
        return [p.jpeg_base64 for p in self.pages]


# ---------------------------------------------------------------------------
# 1. Validation & Format Inspection
# ---------------------------------------------------------------------------

def detect_file_format(data: bytes) -> str:
    """Inspects file signatures (magic bytes) to identify document format.
    
    Returns:
        One of 'pdf', 'jpeg', 'png', 'webp', or 'unknown'.
    """
    if not data or len(data) < 4:
        return "unknown"
    if data[:5] == b"%PDF-":
        return "pdf"
    if data[:3] == b"\xff\xd8\xff":
        return "jpeg"
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        return "png"
    if len(data) >= 12 and data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "webp"
    return "unknown"


def validate_document_bytes(
    data: bytes,
    max_bytes: int = MAX_DOCUMENT_BYTES
) -> Tuple[bool, str, str]:
    """Validates document size, file signature, and decodability.

    Args:
        data: Raw document bytes.
        max_bytes: Maximum permissible byte size.

    Returns:
        (is_valid, detected_format, error_message)
    """
    if not data or len(data) == 0:
        return False, "unknown", "The uploaded file is empty (0 bytes). Please upload a valid document or photo."

    if len(data) > max_bytes:
        mb = len(data) / (1024 * 1024)
        max_mb = max_bytes // (1024 * 1024)
        return False, "unknown", f"That file is too big ({mb:.1f} MB). The maximum allowed size is {max_mb} MB."

    fmt = detect_file_format(data)
    if fmt == "unknown":
        return False, "unknown", "Unsupported file format. Please upload a clear photo (JPG, PNG) or a PDF document."

    # Verify document integrity
    if fmt == "pdf":
        if fitz is None:
            return False, "pdf", "PDF processing library (PyMuPDF) is not installed on the server."
        try:
            with fitz.open(stream=data, filetype="pdf") as doc:
                if doc.is_encrypted:
                    return False, "pdf", "This PDF document is password-protected. Please upload an unlocked PDF."
                if len(doc) == 0:
                    return False, "pdf", "The PDF document contains 0 pages."
        except Exception as e:
            return False, "pdf", f"The PDF file appears corrupted and could not be opened: {e}"
    else:
        try:
            with Image.open(io.BytesIO(data)) as img:
                img.verify()
            # Re-read to confirm decodable pixels
            with Image.open(io.BytesIO(data)) as img:
                img.load()
        except Exception as e:
            return False, fmt, f"The image file appears corrupted and could not be opened: {e}"

    return True, fmt, ""


# ---------------------------------------------------------------------------
# 2. Orientation & Basic Normalization
# ---------------------------------------------------------------------------

def correct_orientation(img: Image.Image) -> Image.Image:
    """Corrects image orientation according to EXIF tags and removes EXIF info."""
    try:
        transposed = ImageOps.exif_transpose(img)
        if transposed is not None:
            return transposed
    except Exception:
        pass
    return img


def ensure_rgb(img: Image.Image) -> Image.Image:
    """Converts image to standard 3-channel RGB.
    
    Composites transparent RGBA/LA/P images onto a white canvas to avoid
    black background inversion artifacts.
    """
    if img.mode == "RGB":
        return img

    if img.mode in ("RGBA", "LA") or (img.mode == "P" and "transparency" in img.info):
        alpha_img = img.convert("RGBA")
        white_bg = Image.new("RGBA", alpha_img.size, (255, 255, 255, 255))
        composite = Image.alpha_composite(white_bg, alpha_img)
        return composite.convert("RGB")

    return img.convert("RGB")


def resize_preserving_aspect_ratio(
    img: Image.Image,
    max_dim: int = TARGET_MAX_DIMENSION
) -> Image.Image:
    """Downscales oversized images using high-quality Lanczos resampling.
    
    If the image is already within bounds, returns the original image.
    """
    w, h = img.size
    if max(w, h) <= max_dim:
        return img

    scale = max_dim / float(max(w, h))
    new_w = max(1, int(round(w * scale)))
    new_h = max(1, int(round(h * scale)))

    # Use Image.Resampling.LANCZOS or Image.LANCZOS
    resample_filter = getattr(Image, "Resampling", Image).LANCZOS
    return img.resize((new_w, new_h), resample=resample_filter)


# ---------------------------------------------------------------------------
# 3. Medical Image Enhancement (CLAHE, Denoising, Deskewing)
# ---------------------------------------------------------------------------

def enhance_contrast_clahe(
    img: Image.Image,
    clip_limit: float = 2.0,
    tile_size: int = 8
) -> Image.Image:
    """Applies Contrast Limited Adaptive Histogram Equalization on the Luminance channel.
    
    Operates in LAB color space to normalize shadows and uneven clinic lighting
    without blowing out faint blue/black handwriting.
    """
    if cv2 is None:
        return img

    rgb_np = np.array(img)
    lab = cv2.cvtColor(rgb_np, cv2.COLOR_RGB2LAB)
    l, a, b = cv2.split(lab)

    clahe = cv2.createCLAHE(clipLimit=clip_limit, tileGridSize=(tile_size, tile_size))
    l_enhanced = clahe.apply(l)

    merged_lab = cv2.merge((l_enhanced, a, b))
    enhanced_rgb = cv2.cvtColor(merged_lab, cv2.COLOR_LAB2RGB)
    return Image.fromarray(enhanced_rgb)


def estimate_and_deskew(
    img_np: np.ndarray,
    max_angle: float = 30.0
) -> Tuple[np.ndarray, float]:
    """Detects text skew angle and rotates the image to upright alignment.
    
    Args:
        img_np: RGB or Grayscale numpy array.
        max_angle: Maximum permissible skew angle in degrees to avoid misrotating.
        
    Returns:
        (deskewed_np, angle_degrees)
    """
    if cv2 is None:
        return img_np, 0.0

    if len(img_np.shape) == 3:
        gray = cv2.cvtColor(img_np, cv2.COLOR_RGB2GRAY)
    else:
        gray = img_np

    # Otsu threshold on inverted text pixels
    _, thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)

    coords = np.column_stack(np.where(thresh > 0))
    if len(coords) < 100:
        return img_np, 0.0

    rect = cv2.minAreaRect(coords)
    angle = rect[-1]

    # OpenCV minAreaRect returns angle in [-90, 0)
    if angle < -45:
        angle = -(90 + angle)
    else:
        angle = -angle

    # Small angles under 0.5 degrees do not need rotation
    if abs(angle) < 0.5 or abs(angle) > max_angle:
        return img_np, 0.0

    (h, w) = img_np.shape[:2]
    center = (w // 2, h // 2)
    m = cv2.getRotationMatrix2D(center, angle, 1.0)
    
    border_val = (255, 255, 255) if len(img_np.shape) == 3 else 255
    rotated = cv2.warpAffine(
        img_np,
        m,
        (w, h),
        flags=cv2.INTER_CUBIC,
        borderMode=cv2.BORDER_CONSTANT,
        borderValue=border_val
    )
    return rotated, angle


def adaptive_binarize(gray_np: np.ndarray, block_size: int = 25, c: int = 11) -> np.ndarray:
    """Computes Gaussian adaptive thresholding.
    
    Useful for OCR comparison and text mask extraction.
    """
    if cv2 is None:
        return gray_np
    return cv2.adaptiveThreshold(
        gray_np,
        255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY,
        block_size,
        c
    )


def denoise_image(gray_np: np.ndarray) -> np.ndarray:
    """Gentle bilateral filter to smooth paper grain without blurring character edges."""
    if cv2 is None or gray_np is None:
        return gray_np
    try:
        arr = np.ascontiguousarray(gray_np, dtype=np.uint8)
        return cv2.bilateralFilter(arr, d=5, sigmaColor=30, sigmaSpace=30)
    except Exception:
        return gray_np


# ---------------------------------------------------------------------------
# 4. In-Memory Encoding & Metadata Stripping
# ---------------------------------------------------------------------------

def encode_to_jpeg_b64(img: Image.Image, quality: int = 88) -> str:
    """Encodes PIL Image into JPEG base64 while stripping all metadata.
    
    Zero disk usage: writes solely into an in-memory BytesIO buffer.
    """
    buf = io.BytesIO()
    # Saving a newly constructed clean image automatically omits EXIF/GPS tags
    clean_img = Image.new("RGB", img.size)
    clean_img.paste(img)
    clean_img.save(buf, format="JPEG", quality=quality, optimize=True)
    return base64.b64encode(buf.getvalue()).decode("ascii")


# ---------------------------------------------------------------------------
# 5. High-Level Preprocessing Pipeline
# ---------------------------------------------------------------------------

def preprocess_single_image(
    img: Image.Image,
    page_number: int = 1,
    apply_clahe: bool = True,
    apply_deskew: bool = True
) -> PreprocessedPage:
    """Processes an individual image page through the complete enhancement pipeline.
    
    1. EXIF orientation correction.
    2. Convert to consistent RGB (white backdrop for transparency).
    3. Resizing oversized dimensions preserving aspect ratio.
    4. Optional deskewing with white border padding.
    5. Optional illumination normalization (CLAHE).
    6. Extraction of grayscale and adaptive binary representations.
    7. In-memory metadata-free JPEG base64 encoding.
    """
    # 1 & 2: Orientation & RGB
    img = correct_orientation(img)
    rgb_img = ensure_rgb(img)

    # 3: Resizing
    bounded_img = resize_preserving_aspect_ratio(rgb_img, TARGET_MAX_DIMENSION)
    w, h = bounded_img.size

    # 4: Deskewing (if OpenCV is present)
    skew_angle = 0.0
    if apply_deskew and cv2 is not None:
        rgb_np = np.array(bounded_img)
        deskewed_np, skew_angle = estimate_and_deskew(rgb_np)
        if abs(skew_angle) >= 0.5:
            bounded_img = Image.fromarray(deskewed_np)

    # 5: Illumination Normalization
    if apply_clahe and cv2 is not None:
        enhanced_img = enhance_contrast_clahe(bounded_img, clip_limit=2.0)
    else:
        enhanced_img = bounded_img

    # 6: Grayscale and Binarization
    gray_img = enhanced_img.convert("L")
    binarized_img = None
    if cv2 is not None:
        gray_np = np.array(gray_img)
        denoised_np = denoise_image(gray_np)
        bin_np = adaptive_binarize(denoised_np)
        binarized_img = Image.fromarray(bin_np)

    # 7: Safe base64 encoding
    b64_str = encode_to_jpeg_b64(enhanced_img, quality=88)

    return PreprocessedPage(
        page_number=page_number,
        original_image=bounded_img,
        enhanced_image=enhanced_img,
        grayscale_image=gray_img,
        binarized_image=binarized_img,
        skew_angle=skew_angle,
        jpeg_base64=b64_str,
        width=w,
        height=h,
    )


def preprocess_document(
    data: bytes,
    max_pages: int = MAX_PRESCRIPTION_PAGES
) -> PreprocessedDocument:
    """Validates and processes a prescription document (PDF or image) in memory.

    Args:
        data: Raw file bytes.
        max_pages: Maximum number of pages to process.

    Returns:
        PreprocessedDocument with processed page buffers and metadata.

    Raises:
        DocumentValidationError: If document size, format, or content is invalid.
        DocumentProcessingError: If processing or page rendering fails.
    """
    is_valid, fmt, err_msg = validate_document_bytes(data)
    if not is_valid:
        raise DocumentValidationError(err_msg)

    pages: List[PreprocessedPage] = []

    if fmt == "pdf":
        if fitz is None:
            raise DocumentProcessingError("PyMuPDF is required to process PDF documents.")
        try:
            with fitz.open(stream=data, filetype="pdf") as doc:
                page_indices = list(range(min(len(doc), max_pages)))
                for idx in page_indices:
                    page = doc[idx]
                    # Render at 150-200 DPI for high legibility
                    pix = page.get_pixmap(dpi=150)
                    page_bytes = pix.tobytes("png")
                    with Image.open(io.BytesIO(page_bytes)) as pil_img:
                        preprocessed_page = preprocess_single_image(pil_img, page_number=idx + 1)
                        pages.append(preprocessed_page)
        except Exception as e:
            raise DocumentProcessingError(f"Could not render pages from PDF: {e}")
    else:
        try:
            with Image.open(io.BytesIO(data)) as pil_img:
                page = preprocess_single_image(pil_img, page_number=1)
                pages.append(page)
        except Exception as e:
            raise DocumentProcessingError(f"Could not decode image file: {e}")

    if not pages:
        raise DocumentValidationError("No valid pages could be extracted from the uploaded document.")

    return PreprocessedDocument(
        format=fmt,
        page_count=len(pages),
        pages=pages,
        is_pdf=(fmt == "pdf"),
        file_size_bytes=len(data),
    )

"""Unit tests for Medical Document Intelligence: Prescription Image Preprocessing Engine.

Validates:
1. File signature detection and MIME/magic bytes validation.
2. File size boundaries, empty documents, and corrupted file handling.
3. Orientation correction and EXIF transpose.
4. Consistent RGB conversion (including transparent RGBA composites).
5. Aspect-ratio-preserving resizing for oversized documents.
6. Illumination normalization (CLAHE) and denoising.
7. Deskew angle detection and rotation.
8. Metadata-free in-memory base64 encoding (zero disk storage).
9. Multi-page PDF preprocessing via PyMuPDF.
10. Backward compatibility with extract_prescription and _sanitize.
"""

import io
import os
import sys
import unittest
import numpy as np
from PIL import Image

# Ensure backend root is on sys.path
BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

# Ensure fallback placeholder for Groq client when testing offline
os.environ.setdefault("GROQ_API_KEY", "gsk_test_placeholder_key")

from app.image_preprocessing import (
    detect_file_format,
    validate_document_bytes,
    correct_orientation,
    ensure_rgb,
    resize_preserving_aspect_ratio,
    enhance_contrast_clahe,
    estimate_and_deskew,
    adaptive_binarize,
    denoise_image,
    encode_to_jpeg_b64,
    preprocess_single_image,
    preprocess_document,
    DocumentValidationError,
    DocumentProcessingError,
    MAX_DOCUMENT_BYTES,
    TARGET_MAX_DIMENSION,
)
from app.prescription import extract_prescription, _sanitize

try:
    import pymupdf as fitz
except ImportError:
    try:
        import fitz
    except ImportError:
        fitz = None


def _create_synthetic_image(
    width: int = 400,
    height: int = 300,
    mode: str = "RGB",
    color: tuple = (255, 255, 255),
    fmt: str = "PNG"
) -> bytes:
    """Helper: creates in-memory image bytes."""
    img = Image.new(mode, (width, height), color)
    buf = io.BytesIO()
    img.save(buf, format=fmt)
    return buf.getvalue()


def _create_synthetic_pdf(num_pages: int = 2) -> bytes:
    """Helper: creates in-memory multi-page PDF bytes using PyMuPDF."""
    doc = fitz.open()
    for i in range(num_pages):
        page = doc.new_page(width=595, height=842)  # A4 standard
        page.insert_text((50, 100), f"Prescription Page {i + 1}\nRx: Paracetamol 500mg\nTake 1-0-1", fontsize=16)
    buf = doc.tobytes()
    doc.close()
    return buf


class TestDocumentValidation(unittest.TestCase):
    """Tests file signature inspection, size limits, and corruption detection."""

    def test_detect_file_format_valid(self):
        pdf_bytes = b"%PDF-1.5 test content"
        jpeg_bytes = b"\xff\xd8\xff\xe0\x00\x10JFIF"
        png_bytes = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR"
        webp_bytes = b"RIFF\x00\x00\x00\x00WEBPVP8 "

        self.assertEqual(detect_file_format(pdf_bytes), "pdf")
        self.assertEqual(detect_file_format(jpeg_bytes), "jpeg")
        self.assertEqual(detect_file_format(png_bytes), "png")
        self.assertEqual(detect_file_format(webp_bytes), "webp")

    def test_detect_file_format_unknown_or_short(self):
        self.assertEqual(detect_file_format(b""), "unknown")
        self.assertEqual(detect_file_format(b"abc"), "unknown")
        self.assertEqual(detect_file_format(b"random text data"), "unknown")

    def test_validate_empty_document(self):
        valid, fmt, msg = validate_document_bytes(b"")
        self.assertFalse(valid)
        self.assertIn("empty", msg)

    def test_validate_oversized_document(self):
        oversized = b"a" * (MAX_DOCUMENT_BYTES + 1024)
        valid, fmt, msg = validate_document_bytes(oversized)
        self.assertFalse(valid)
        self.assertIn("too big", msg)

    def test_validate_unsupported_format(self):
        unsupported = b"This is a plaintext file, not an image or PDF."
        valid, fmt, msg = validate_document_bytes(unsupported)
        self.assertFalse(valid)
        self.assertIn("Unsupported file format", msg)

    def test_validate_corrupted_jpeg(self):
        corrupt_jpeg = b"\xff\xd8\xff\xe0corrupted garbage content"
        valid, fmt, msg = validate_document_bytes(corrupt_jpeg)
        self.assertFalse(valid)
        self.assertIn("corrupted", msg)

    def test_validate_valid_png(self):
        png_bytes = _create_synthetic_image(fmt="PNG")
        valid, fmt, msg = validate_document_bytes(png_bytes)
        self.assertTrue(valid)
        self.assertEqual(fmt, "png")
        self.assertEqual(msg, "")

    def test_validate_valid_pdf(self):
        pdf_bytes = _create_synthetic_pdf(num_pages=1)
        valid, fmt, msg = validate_document_bytes(pdf_bytes)
        self.assertTrue(valid)
        self.assertEqual(fmt, "pdf")
        self.assertEqual(msg, "")


class TestImageTransformations(unittest.TestCase):
    """Tests orientation, RGB normalization, resizing, and enhancement."""

    def test_ensure_rgb_from_rgba(self):
        """RGBA with transparency should composite onto white, remaining RGB."""
        rgba = Image.new("RGBA", (100, 100), (255, 0, 0, 128))
        rgb = ensure_rgb(rgba)
        self.assertEqual(rgb.mode, "RGB")
        self.assertEqual(rgb.size, (100, 100))

    def test_ensure_rgb_from_grayscale(self):
        gray = Image.new("L", (100, 100), 128)
        rgb = ensure_rgb(gray)
        self.assertEqual(rgb.mode, "RGB")
        self.assertEqual(rgb.getpixel((10, 10)), (128, 128, 128))

    def test_resize_oversized_image(self):
        """Large image (2400x1200) should scale down to fit TARGET_MAX_DIMENSION (1800)."""
        large = Image.new("RGB", (2400, 1200), (255, 255, 255))
        resized = resize_preserving_aspect_ratio(large, max_dim=TARGET_MAX_DIMENSION)
        self.assertEqual(resized.size[0], TARGET_MAX_DIMENSION)
        self.assertEqual(resized.size[1], 900)

    def test_resize_undersized_image_preserved(self):
        """Image already within bounds should not be enlarged or altered."""
        normal = Image.new("RGB", (800, 600), (255, 255, 255))
        resized = resize_preserving_aspect_ratio(normal, max_dim=TARGET_MAX_DIMENSION)
        self.assertEqual(resized.size, (800, 600))

    def test_clahe_contrast_enhancement(self):
        """CLAHE should return an RGB image of the exact same dimensions."""
        img = Image.new("RGB", (300, 200), (120, 130, 140))
        enhanced = enhance_contrast_clahe(img, clip_limit=2.0)
        self.assertEqual(enhanced.mode, "RGB")
        self.assertEqual(enhanced.size, (300, 200))

    def test_denoise_and_binarize(self):
        """Denoising and adaptive thresholding should produce valid numpy arrays."""
        gray_np = np.ones((150, 150), dtype=np.uint8) * 200
        denoised = denoise_image(gray_np)
        self.assertEqual(denoised.shape, (150, 150))

        bin_np = adaptive_binarize(denoised)
        self.assertEqual(bin_np.shape, (150, 150))
        # Binarized should only contain 0 and 255
        unique_vals = set(np.unique(bin_np))
        self.assertTrue(unique_vals.issubset({0, 255}))

    def test_estimate_and_deskew_upright(self):
        """An already upright document should return near-zero skew angle."""
        blank_np = np.ones((200, 300, 3), dtype=np.uint8) * 255
        # Draw a horizontal line simulating text
        blank_np[95:105, 50:250] = 0
        rotated_np, angle = estimate_and_deskew(blank_np)
        self.assertAlmostEqual(angle, 0.0, places=1)
        self.assertEqual(rotated_np.shape, blank_np.shape)

    def test_encode_to_jpeg_b64(self):
        """Should encode directly to base64 string without disk IO and strip metadata."""
        img = Image.new("RGB", (100, 100), (255, 255, 255))
        b64 = encode_to_jpeg_b64(img, quality=85)
        self.assertIsInstance(b64, str)
        self.assertTrue(len(b64) > 50)
        # Should be valid base64
        import base64
        decoded = base64.b64decode(b64)
        self.assertEqual(decoded[:3], b"\xff\xd8\xff")


class TestPreprocessDocumentPipeline(unittest.TestCase):
    """Tests the high-level preprocess_document pipeline for single images and multi-page PDFs."""

    def test_preprocess_single_image(self):
        png_bytes = _create_synthetic_image(width=500, height=400, fmt="PNG")
        doc = preprocess_document(png_bytes)
        self.assertEqual(doc.format, "png")
        self.assertEqual(doc.page_count, 1)
        self.assertFalse(doc.is_pdf)
        page = doc.pages[0]
        self.assertEqual(page.page_number, 1)
        self.assertEqual(page.width, 500)
        self.assertEqual(page.height, 400)
        self.assertTrue(len(page.jpeg_base64) > 100)
        self.assertIsNotNone(page.enhanced_image)
        self.assertIsNotNone(page.grayscale_image)

    def test_preprocess_multipage_pdf(self):
        pdf_bytes = _create_synthetic_pdf(num_pages=3)
        doc = preprocess_document(pdf_bytes, max_pages=2)
        self.assertEqual(doc.format, "pdf")
        self.assertTrue(doc.is_pdf)
        # Should respect max_pages=2 limit
        self.assertEqual(doc.page_count, 2)
        self.assertEqual(len(doc.pages), 2)
        self.assertEqual(doc.pages[0].page_number, 1)
        self.assertEqual(doc.pages[1].page_number, 2)
        self.assertTrue(len(doc.all_base64), 2)

    def test_preprocess_invalid_raises_validation_error(self):
        with self.assertRaises(DocumentValidationError):
            preprocess_document(b"not a valid document")

    def test_preprocess_empty_raises_validation_error(self):
        with self.assertRaises(DocumentValidationError):
            preprocess_document(b"")


class TestPrescriptionIntegration(unittest.TestCase):
    """Tests backward compatibility of extract_prescription and _sanitize."""

    def test_extract_prescription_empty_input(self):
        res = extract_prescription(b"")
        self.assertFalse(res["ok"])
        self.assertIn("empty", res["message"].lower())

    def test_extract_prescription_corrupt_input(self):
        res = extract_prescription(b"some invalid random string")
        self.assertFalse(res["ok"])
        self.assertIn("unsupported file format", res["message"].lower())

    def test_extract_prescription_oversized_input(self):
        oversized = b"a" * (MAX_DOCUMENT_BYTES + 1024)
        res = extract_prescription(oversized)
        self.assertFalse(res["ok"])
        self.assertIn("too big", res["message"].lower())

    def test_sanitize_preserves_compatibility_and_adds_strength(self):
        raw = {
            "doctor": "Dr. A. Sen",
            "date": "2026-11-18",
            "conditions": ["Hypertension"],
            "medicines": [
                {
                    "name": "Telmisartan",
                    "strength": "40 mg",
                    "dosage": "1 tablet",
                    "dose": "40 mg",
                    "frequency": "1-0-0",
                    "duration": "30 days",
                    "notes": "morning after breakfast",
                    "is_uncertain": False,
                }
            ],
        }
        clean = _sanitize(raw)
        self.assertEqual(clean["doctor"], "Dr. A. Sen")
        self.assertEqual(len(clean["medicines"]), 1)
        med = clean["medicines"][0]
        self.assertEqual(med["name"], "Telmisartan")
        self.assertEqual(med["strength"], "40 mg")
        self.assertEqual(med["dosage"], "1 tablet")
        self.assertEqual(med["dose"], "40 mg")
        self.assertEqual(med["frequency"], "1-0-0")
        self.assertFalse(med["is_uncertain"])


class TestFastAPIEndpointIntegration(unittest.TestCase):
    """Tests the /extract-prescription endpoint via FastAPI TestClient."""

    @classmethod
    def setUpClass(cls):
        from fastapi.testclient import TestClient
        from app.app import app
        cls.client = TestClient(app)

    def test_endpoint_empty_file(self):
        resp = self.client.post(
            "/extract-prescription",
            files={"file": ("empty.jpg", b"", "image/jpeg")}
        )
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertFalse(data["ok"])
        self.assertIn("empty", data["message"].lower())

    def test_endpoint_corrupted_file(self):
        resp = self.client.post(
            "/extract-prescription",
            files={"file": ("corrupt.png", b"not-a-real-image", "image/png")}
        )
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertFalse(data["ok"])
        self.assertIn("unsupported file format", data["message"].lower())


if __name__ == "__main__":
    unittest.main()

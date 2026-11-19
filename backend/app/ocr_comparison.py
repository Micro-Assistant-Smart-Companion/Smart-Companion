"""Tesseract vs. Vision-Language Model (Qwen) OCR Comparison Engine.

Evaluates whether Tesseract OCR can be integrated as an additional extraction route
without creating deployment or installation hurdles on heterogeneous systems.

Provides:
1. Dynamic environment probing for Tesseract binaries (Windows, Linux, macOS).
2. Graceful fallback when Tesseract is absent (never crashes the server).
3. Standard Character Error Rate (CER) and Word Error Rate (WER) distance calculations.
4. Comparative benchmark harness across medical document samples.
"""

from __future__ import annotations

import os
import shutil
import time
from typing import Dict, List, Optional, Tuple
from PIL import Image


# Potential Windows installation paths for Tesseract-OCR
COMMON_TESSERACT_WINDOWS_PATHS = [
    r"C:\Program Files\Tesseract-OCR\tesseract.exe",
    r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
    os.path.expanduser(r"~\AppData\Local\Programs\Tesseract-OCR\tesseract.exe"),
]


def check_tesseract_support() -> Tuple[bool, str]:
    """Dynamically checks whether Tesseract OCR is installed and operational.

    Returns:
        (is_available, executable_path_or_reason)
    """
    try:
        import pytesseract
    except ImportError:
        return False, "pytesseract Python package is not installed."

    # 1. Check system PATH
    path_in_env = shutil.which("tesseract")
    if path_in_env:
        try:
            pytesseract.pytesseract.tesseract_cmd = path_in_env
            version = pytesseract.get_tesseract_version()
            return True, f"Found Tesseract {version} in PATH: {path_in_env}"
        except Exception as e:
            return False, f"Tesseract in PATH failed execution: {e}"

    # 2. Check standard Windows installation directories
    if os.name == "nt":
        for win_path in COMMON_TESSERACT_WINDOWS_PATHS:
            if os.path.isfile(win_path):
                try:
                    pytesseract.pytesseract.tesseract_cmd = win_path
                    version = pytesseract.get_tesseract_version()
                    return True, f"Found Tesseract {version} at: {win_path}"
                except Exception as e:
                    return False, f"Tesseract at {win_path} failed execution: {e}"

    return False, (
        "Tesseract OCR binary not found in system PATH or common paths. "
        "The application will use the Qwen Multimodal Vision-Language Model as the primary extraction engine."
    )


def extract_text_tesseract(image: Image.Image) -> Tuple[bool, str, float]:
    """Runs Tesseract OCR if available, returning (success, text, elapsed_seconds)."""
    available, msg = check_tesseract_support()
    if not available:
        return False, f"Tesseract unavailable: {msg}", 0.0

    import pytesseract

    start = time.time()
    try:
        text = pytesseract.image_to_string(image, config="--psm 6")
        elapsed = time.time() - start
        return True, text.strip(), elapsed
    except Exception as e:
        elapsed = time.time() - start
        return False, f"Tesseract execution error: {e}", elapsed


# ---------------------------------------------------------------------------
# Evaluation Metrics: CER & WER
# ---------------------------------------------------------------------------

def calculate_cer(reference: str, hypothesis: str) -> float:
    """Calculates Character Error Rate (Levenshtein distance / reference length)."""
    ref = reference.strip()
    hyp = hypothesis.strip()
    if not ref:
        return 0.0 if not hyp else 1.0

    r_len, h_len = len(ref), len(hyp)
    dp = [[0] * (h_len + 1) for _ in range(r_len + 1)]

    for i in range(r_len + 1):
        dp[i][0] = i
    for j in range(h_len + 1):
        dp[0][j] = j

    for i in range(1, r_len + 1):
        for j in range(1, h_len + 1):
            cost = 0 if ref[i - 1] == hyp[j - 1] else 1
            dp[i][j] = min(
                dp[i - 1][j] + 1,       # deletion
                dp[i][j - 1] + 1,       # insertion
                dp[i - 1][j - 1] + cost  # substitution
            )

    return min(1.0, dp[r_len][h_len] / max(1, r_len))


def calculate_wer(reference: str, hypothesis: str) -> float:
    """Calculates Word Error Rate (Word-level Levenshtein distance / reference word count)."""
    ref_words = reference.strip().split()
    hyp_words = hypothesis.strip().split()
    if not ref_words:
        return 0.0 if not hyp_words else 1.0

    r_len, h_len = len(ref_words), len(hyp_words)
    dp = [[0] * (h_len + 1) for _ in range(r_len + 1)]

    for i in range(r_len + 1):
        dp[i][0] = i
    for j in range(h_len + 1):
        dp[0][j] = j

    for i in range(1, r_len + 1):
        for j in range(1, h_len + 1):
            cost = 0 if ref_words[i - 1].lower() == hyp_words[j - 1].lower() else 1
            dp[i][j] = min(
                dp[i - 1][j] + 1,       # deletion
                dp[i][j - 1] + 1,       # insertion
                dp[i - 1][j - 1] + cost  # substitution
            )

    return min(1.0, dp[r_len][h_len] / max(1, r_len))

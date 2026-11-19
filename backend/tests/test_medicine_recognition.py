"""Unit and Integration Tests for Medicine Packaging Photo Recognition.

Tests:
1. Image validation (rejection of empty/corrupted/non-image payloads).
2. Clean packaging extraction (brand, generic, strength, formulation, batch, expiry).
3. Ambiguity & uncertainty handling (cropped packaging, truncated strength, glare).
4. Safety & guardrail enforcement (no dosage inference, unconfirmed status, disclaimer).
5. In-memory caching (zero duplicate model calls for identical image bytes).
6. FastAPI endpoint integration (/recognize-medicine-photo).
"""

from __future__ import annotations

import io
import os
import sys
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

os.environ.setdefault("GROQ_API_KEY", "gsk_test_placeholder_key")

_backend_dir = Path(__file__).resolve().parent.parent
if str(_backend_dir) not in sys.path:
    sys.path.insert(0, str(_backend_dir))

from PIL import Image, ImageDraw
from fastapi.testclient import TestClient

from app.app import app
from app.medicine_recognition import (
    recognize_medicine_packaging,
    _sanitize_packaging_data,
    PACKAGING_SAFETY_DISCLAIMER,
)


def _create_synthetic_medicine_box_image(
    brand: str = "Augmentin 625 Duo",
    generic: str = "Amoxycillin and Potassium Clavulanate Tablets IP",
    strength: str = "625 mg",
    formulation: str = "Film-coated Tablets",
    manufacturer: str = "GlaxoSmithKline Pharmaceuticals Ltd",
    batch: str = "B.No. AG62501",
    expiry: str = "EXP 08/2027",
) -> bytes:
    """Generates synthetic medicine carton packaging in memory."""
    img = Image.new("RGB", (700, 450), color=(250, 250, 252))
    draw = ImageDraw.Draw(img)

    # Outer border and color bar
    draw.rectangle([(20, 20), (680, 430)], outline=(180, 180, 200), width=2)
    draw.rectangle([(20, 20), (680, 50)], fill=(0, 102, 178))

    # Brand and generic text
    draw.text((40, 75), brand, fill=(0, 51, 102))
    draw.text((40, 120), generic, fill=(60, 60, 60))
    draw.text((40, 160), f"Strength: {strength}", fill=(0, 0, 0))
    draw.text((40, 195), f"Form: {formulation}", fill=(50, 50, 50))
    draw.text((40, 240), f"Mfg: {manufacturer}", fill=(80, 80, 80))
    draw.text((40, 280), f"{batch}   {expiry}", fill=(40, 40, 40))
    draw.text((40, 340), "SCHEDULE H PRESCRIPTION DRUG - CAUTION", fill=(180, 0, 0))

    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=90)
    return buf.getvalue()


class TestPackagingImageValidation(unittest.TestCase):
    """Verifies image format, bounds, and corruption checks."""

    def test_empty_bytes_rejected(self):
        res = recognize_medicine_packaging(b"")
        self.assertFalse(res["ok"])
        self.assertIn("Please provide a photograph", res["message"])

    def test_non_image_payload_rejected(self):
        import pymupdf as fitz
        doc = fitz.open()
        doc.new_page()
        valid_pdf = doc.tobytes()
        doc.close()
        res = recognize_medicine_packaging(valid_pdf)
        self.assertFalse(res["ok"])
        self.assertIn("requires an image file", res["message"])

    def test_corrupted_image_rejected(self):
        corrupt = b"\xFF\xD8\xFF\xE0" + b"random_corrupted_data_not_an_image"
        res = recognize_medicine_packaging(corrupt)
        self.assertFalse(res["ok"])


class TestPackagingModelExtraction(unittest.TestCase):
    """Verifies extraction logic, sanitization, and fallback."""

    @patch("app.medicine_recognition.client.chat.completions.create")
    def test_clean_packaging_extraction(self, mock_create):
        mock_response = MagicMock()
        mock_response.choices = [
            MagicMock(message=MagicMock(content="""
            {
                "brand_name": "Augmentin 625 Duo",
                "generic_name": "Amoxycillin and Potassium Clavulanate Tablets IP",
                "strength": "625 mg",
                "formulation": "Film-coated Tablets",
                "manufacturer": "GlaxoSmithKline Pharmaceuticals Ltd",
                "batch_number": "B.No. AG62501",
                "expiry_date": "EXP 08/2027",
                "is_uncertain": false,
                "uncertainty_reason": "",
                "raw_visible_text": "Augmentin 625 Duo Amoxycillin and Potassium Clavulanate Tablets IP 625 mg"
            }
            """))
        ]
        mock_create.return_value = mock_response

        img_bytes = _create_synthetic_medicine_box_image()
        res = recognize_medicine_packaging(img_bytes)

        self.assertTrue(res["ok"])
        self.assertEqual(res["brand_name"], "Augmentin 625 Duo")
        self.assertIn("Amoxycillin", res["generic_name"])
        self.assertEqual(res["strength"], "625 mg")
        self.assertEqual(res["formulation"], "Film-coated Tablets")
        self.assertFalse(res["is_uncertain"])
        self.assertEqual(res["verification_status"], "unconfirmed_visual_read_only")
        self.assertIn(PACKAGING_SAFETY_DISCLAIMER, res["disclaimer"])

    def test_uncertainty_flagged_for_missing_or_truncated_strength(self):
        raw_output = {
            "brand_name": "Telma",
            "generic_name": "Telmisartan Tablets IP",
            "strength": "40 -",  # Truncated on torn blister strip
            "formulation": "Tablets",
            "is_uncertain": False,
        }
        sanitized = _sanitize_packaging_data(raw_output)
        self.assertTrue(sanitized["is_uncertain"])
        self.assertIn("truncated", sanitized["uncertainty_reason"].lower())

    def test_uncertainty_flagged_when_brand_and_generic_are_missing(self):
        raw_output = {
            "brand_name": "",
            "generic_name": "",
            "strength": "500 mg",
            "is_uncertain": False,
        }
        sanitized = _sanitize_packaging_data(raw_output)
        self.assertTrue(sanitized["is_uncertain"])
        self.assertIn("No clear medicine brand name", sanitized["uncertainty_reason"])

    @patch("app.medicine_recognition.client.chat.completions.create")
    def test_in_memory_caching_avoids_duplicate_calls(self, mock_create):
        mock_response = MagicMock()
        mock_response.choices = [
            MagicMock(message=MagicMock(content="""
            {
                "brand_name": "Calpol 500",
                "generic_name": "Paracetamol Tablets IP",
                "strength": "500 mg",
                "is_uncertain": false
            }
            """))
        ]
        mock_create.return_value = mock_response

        img_bytes = _create_synthetic_medicine_box_image(brand="Calpol 500", generic="Paracetamol Tablets IP")

        # First call
        res1 = recognize_medicine_packaging(img_bytes)
        self.assertTrue(res1["ok"])
        self.assertEqual(mock_create.call_count, 1)

        # Second call with identical image bytes
        res2 = recognize_medicine_packaging(img_bytes)
        self.assertTrue(res2["ok"])
        # Should NOT have called mock_create a second time
        self.assertEqual(mock_create.call_count, 1)


class TestSafetyAndGuardrails(unittest.TestCase):
    """Verifies that no clinical advice, dosages, or authenticity claims are made."""

    def test_safety_disclaimer_mandatory_on_all_responses(self):
        sanitized = _sanitize_packaging_data({"brand_name": "Aspirin"})
        self.assertEqual(sanitized["disclaimer"], PACKAGING_SAFETY_DISCLAIMER)
        self.assertIn("Never take or adjust medication without consulting a licensed doctor", sanitized["disclaimer"])
        self.assertIn("cannot detect counterfeit products", sanitized["disclaimer"])

    def test_verification_status_is_always_unconfirmed_read_only(self):
        sanitized = _sanitize_packaging_data({"brand_name": "Metformin 500"})
        self.assertEqual(sanitized["verification_status"], "unconfirmed_visual_read_only")


class TestFastAPIEndpointIntegration(unittest.TestCase):
    """Tests the HTTP endpoint contract for /recognize-medicine-photo."""

    def setUp(self):
        self.client = TestClient(app)

    @patch("app.medicine_recognition.client.chat.completions.create")
    def test_endpoint_success(self, mock_create):
        mock_response = MagicMock()
        mock_response.choices = [
            MagicMock(message=MagicMock(content="""
            {
                "brand_name": "Dolo 650",
                "generic_name": "Paracetamol Tablets IP",
                "strength": "650 mg",
                "is_uncertain": false
            }
            """))
        ]
        mock_create.return_value = mock_response

        img_bytes = _create_synthetic_medicine_box_image(brand="Dolo 650", generic="Paracetamol Tablets IP")
        response = self.client.post(
            "/recognize-medicine-photo",
            files={"file": ("dolo.jpg", img_bytes, "image/jpeg")},
        )
        self.assertEqual(response.status_code, 200)
        json_data = response.json()
        self.assertTrue(json_data["ok"])
        self.assertEqual(json_data["brand_name"], "Dolo 650")
        self.assertEqual(json_data["verification_status"], "unconfirmed_visual_read_only")

    def test_endpoint_empty_file(self):
        response = self.client.post(
            "/recognize-medicine-photo",
            files={"file": ("empty.jpg", b"", "image/jpeg")},
        )
        self.assertEqual(response.status_code, 200)
        json_data = response.json()
        self.assertFalse(json_data["ok"])


if __name__ == "__main__":
    unittest.main()

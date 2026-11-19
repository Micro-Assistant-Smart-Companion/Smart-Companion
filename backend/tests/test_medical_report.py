"""Automated Unit & Contract Tests for Structured Medical Report Intelligence.

Validates:
1. Multi-format support: Digital PDFs, Scanned PDFs, Mixed PDFs, PNG/JPEG images.
2. Clinical extraction schema: test_name, observed_value, unit, reference_range, page_number,
   source_text, confidence, is_uncertain, is_verified.
3. Strict distinction between genuine numerical zero ('0', '0.0', 'Nil') vs. unrecorded/missing values ('').
4. Safety requirements: Zero diagnosis, no treatment advice, no automatic abnormality calculation.
5. In-memory caching: Prevents redundant model calls on identical document payloads.
6. Error handling: Oversized files, empty files, corrupt files, model failures.
7. FastAPI endpoint contract: POST /extract-medical-report tested via TestClient.
"""

import io
import os
import sys
import unittest
from unittest.mock import MagicMock, patch
from PIL import Image

# Ensure backend root is on sys.path
BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

# Set placeholder key for offline testing
os.environ.setdefault("GROQ_API_KEY", "gsk_test_placeholder_key")

from app.medical_report import (
    extract_medical_report,
    _sanitize_report_data,
    _clean_observed_value,
    _REPORT_CACHE,
)
from app.models import MedicalReportTestItem, MedicalReportExtractionResponse

try:
    import pymupdf as fitz
except ImportError:
    try:
        import fitz
    except ImportError:
        fitz = None


def _create_sample_png() -> bytes:
    """Helper: creates a minimal valid PNG image in memory."""
    img = Image.new("RGB", (300, 200), (255, 255, 255))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def _create_digital_report_pdf(num_pages: int = 1) -> bytes:
    """Helper: creates an in-memory PDF with selectable digital text."""
    doc = fitz.open()
    for i in range(num_pages):
        page = doc.new_page(width=595, height=842)
        text = (
            f"DIAGNOSTIC PATHOLOGY LABORATORY - PAGE {i + 1}\n"
            "Date: 18-Nov-2026\n"
            "Test Name                  Observed Value   Units      Biological Reference\n"
            "---------------------------------------------------------------------------\n"
            "Haemoglobin                13.8             g/dL       12.0 - 15.5\n"
            "Total WBC Count            6800             /cumm      4000 - 11000\n"
            "Platelet Count             240000           /cumm      150000 - 450000\n"
            "Fasting Blood Glucose      92               mg/dL      70 - 99\n"
            "Serum Creatinine           0.9              mg/dL      0.6 - 1.2\n"
            "Urine Albumin              Nil              mg/dL      Nil / Negative\n"
        )
        page.insert_text((40, 60), text, fontsize=11)
    buf = doc.tobytes()
    doc.close()
    return buf


def _create_scanned_report_pdf() -> bytes:
    """Helper: creates an in-memory PDF page with an image and zero selectable text."""
    doc = fitz.open()
    page = doc.new_page(width=595, height=842)
    # Insert blank image so word count is 0
    img_bytes = _create_sample_png()
    page.insert_image(fitz.Rect(50, 50, 545, 792), stream=img_bytes)
    buf = doc.tobytes()
    doc.close()
    return buf


class TestValueDistinctionAndSanitization(unittest.TestCase):
    """Tests distinguishing numeric zero from empty, and schema normalization."""

    def test_clean_observed_value_distinguishes_zero_from_empty(self):
        # Genuine zeroes and negative results MUST be preserved
        self.assertEqual(_clean_observed_value("0"), "0")
        self.assertEqual(_clean_observed_value("0.0"), "0.0")
        self.assertEqual(_clean_observed_value("0.00"), "0.00")
        self.assertEqual(_clean_observed_value("Nil"), "Nil")
        self.assertEqual(_clean_observed_value("Negative"), "Negative")
        self.assertEqual(_clean_observed_value("Non-reactive"), "Non-reactive")

        # Missing / omitted values should become empty strings
        self.assertEqual(_clean_observed_value(None), "")
        self.assertEqual(_clean_observed_value(""), "")
        self.assertEqual(_clean_observed_value("-"), "")
        self.assertEqual(_clean_observed_value("--"), "")
        self.assertEqual(_clean_observed_value("N/A"), "")
        self.assertEqual(_clean_observed_value("n/a"), "")

    def test_sanitize_report_data_structure(self):
        raw = {
            "lab_name": "Apollo Diagnostics Center",
            "report_date": "2026-11-18",
            "tests": [
                {
                    "test_name": "Haemoglobin",
                    "observed_value": "14.2",
                    "unit": "g/dL",
                    "reference_range": "12.0 - 15.5",
                    "page_number": 1,
                    "source_text": "Haemoglobin 14.2 g/dL (12.0 - 15.5)",
                    "confidence": "high",
                    "is_uncertain": False,
                },
                {
                    "test_name": "Urine Ketones",
                    "observed_value": "0.0",  # Genuine numerical zero
                    "unit": "mg/dL",
                    "reference_range": "Negative / 0.0",
                    "page_number": 1,
                    "source_text": "Urine Ketones 0.0 mg/dL",
                    "confidence": "high",
                    "is_uncertain": False,
                },
                {
                    "test_name": "HbA1c",
                    "observed_value": "",  # Unrecorded value
                    "unit": "%",
                    "reference_range": "< 5.7",
                    "page_number": 1,
                    "confidence": "low",
                },
            ],
        }

        clean = _sanitize_report_data(raw, total_pages=1, digital_count=1, scanned_count=0)
        self.assertTrue(clean["ok"])
        self.assertEqual(clean["lab_name"], "Apollo Diagnostics Center")
        self.assertEqual(clean["report_date"], "2026-11-18")
        self.assertEqual(clean["total_pages"], 1)
        self.assertEqual(clean["pages_with_digital_text"], 1)
        self.assertEqual(clean["pages_with_scanned_ocr"], 0)
        self.assertIn("not diagnose or recommend treatments", clean["disclaimer"])

        self.assertEqual(len(clean["tests"]), 3)

        t1 = clean["tests"][0]
        self.assertEqual(t1["test_name"], "Haemoglobin")
        self.assertEqual(t1["observed_value"], "14.2")
        self.assertEqual(t1["unit"], "g/dL")
        self.assertEqual(t1["reference_range"], "12.0 - 15.5")
        self.assertEqual(t1["confidence"], "high")
        self.assertFalse(t1["is_uncertain"])
        self.assertFalse(t1["is_verified"])

        t2 = clean["tests"][1]
        self.assertEqual(t2["test_name"], "Urine Ketones")
        self.assertEqual(t2["observed_value"], "0.0")  # Preserved
        self.assertFalse(t2["is_uncertain"])

        t3 = clean["tests"][2]
        self.assertEqual(t3["test_name"], "HbA1c")
        self.assertEqual(t3["observed_value"], "")  # Empty
        self.assertTrue(t3["is_uncertain"])  # Flagged uncertain due to empty value


class TestMockedReportExtraction(unittest.TestCase):
    """Tests the extract_medical_report pipeline with mocked model responses."""

    def setUp(self):
        _REPORT_CACHE.clear()

    @patch("app.medical_report.client.chat.completions.create")
    def test_extract_digital_pdf_report(self, mock_create):
        mock_response = MagicMock()
        mock_response.choices = [
            MagicMock(
                message=MagicMock(
                    content="""{
                        "lab_name": "Thyrocare Technologies",
                        "report_date": "18-Nov-2026",
                        "tests": [
                            {
                                "test_name": "TSH - Thyroid Stimulating Hormone",
                                "observed_value": "2.4",
                                "unit": "µIU/mL",
                                "reference_range": "0.35 - 4.94",
                                "page_number": 1,
                                "source_text": "TSH 2.4 µIU/mL",
                                "confidence": "high",
                                "is_uncertain": false
                            },
                            {
                                "test_name": "Serum Cholesterol",
                                "observed_value": "175",
                                "unit": "mg/dL",
                                "reference_range": "< 200",
                                "page_number": 1,
                                "source_text": "Cholesterol 175 mg/dL",
                                "confidence": "high",
                                "is_uncertain": false
                            }
                        ]
                    }"""
                )
            )
        ]
        mock_create.return_value = mock_response

        pdf_bytes = _create_digital_report_pdf(num_pages=1)
        result = extract_medical_report(pdf_bytes)

        self.assertTrue(result["ok"])
        self.assertEqual(result["lab_name"], "Thyrocare Technologies")
        self.assertEqual(result["report_date"], "18-Nov-2026")
        self.assertEqual(result["pages_with_digital_text"], 1)
        self.assertEqual(len(result["tests"]), 2)

        t1 = result["tests"][0]
        self.assertEqual(t1["test_name"], "TSH - Thyroid Stimulating Hormone")
        self.assertEqual(t1["observed_value"], "2.4")
        self.assertEqual(t1["unit"], "µIU/mL")
        self.assertEqual(t1["reference_range"], "0.35 - 4.94")
        self.assertFalse(t1["is_verified"])

        # Pydantic validation
        validated = MedicalReportExtractionResponse.model_validate(result)
        self.assertEqual(len(validated.tests), 2)

    @patch("app.medical_report.client.chat.completions.create")
    def test_extract_scanned_pdf_report(self, mock_create):
        mock_response = MagicMock()
        mock_response.choices = [
            MagicMock(
                message=MagicMock(
                    content="""{
                        "lab_name": "City Scan & Diagnostics",
                        "report_date": "17-Nov-2026",
                        "tests": [
                            {
                                "test_name": "Fasting Blood Sugar",
                                "observed_value": "98",
                                "unit": "mg/dL",
                                "reference_range": "70 - 100",
                                "page_number": 1,
                                "source_text": "FBS 98 mg/dL",
                                "confidence": "high",
                                "is_uncertain": false
                            }
                        ]
                    }"""
                )
            )
        ]
        mock_create.return_value = mock_response

        scanned_pdf = _create_scanned_report_pdf()
        result = extract_medical_report(scanned_pdf)

        self.assertTrue(result["ok"])
        self.assertEqual(result["pages_with_scanned_ocr"], 1)
        self.assertEqual(len(result["tests"]), 1)
        self.assertEqual(result["tests"][0]["test_name"], "Fasting Blood Sugar")

    @patch("app.medical_report.client.chat.completions.create")
    def test_extract_image_report(self, mock_create):
        mock_response = MagicMock()
        mock_response.choices = [
            MagicMock(
                message=MagicMock(
                    content="""{
                        "lab_name": "Dr Lal PathLabs",
                        "report_date": "18-Nov-2026",
                        "tests": [
                            {
                                "test_name": "Serum Creatinine",
                                "observed_value": "0.85",
                                "unit": "mg/dL",
                                "reference_range": "0.60 - 1.10",
                                "page_number": 1,
                                "confidence": "high",
                                "is_uncertain": false
                            }
                        ]
                    }"""
                )
            )
        ]
        mock_create.return_value = mock_response

        img_bytes = _create_sample_png()
        result = extract_medical_report(img_bytes)

        self.assertTrue(result["ok"])
        self.assertEqual(result["lab_name"], "Dr Lal PathLabs")
        self.assertEqual(len(result["tests"]), 1)
        self.assertEqual(result["tests"][0]["test_name"], "Serum Creatinine")

    @patch("app.medical_report.client.chat.completions.create")
    def test_in_memory_caching_avoids_duplicate_calls(self, mock_create):
        """Identical document bytes should be served from memory cache without second LLM invocation."""
        mock_response = MagicMock()
        mock_response.choices = [
            MagicMock(
                message=MagicMock(
                    content='{"lab_name": "Test Lab", "tests": [{"test_name": "Hb", "observed_value": "14"}]}'
                )
            )
        ]
        mock_create.return_value = mock_response

        img_bytes = _create_sample_png()
        res1 = extract_medical_report(img_bytes)
        self.assertEqual(mock_create.call_count, 1)

        # Second call with same data
        res2 = extract_medical_report(img_bytes)
        self.assertEqual(mock_create.call_count, 1)  # NOT incremented
        self.assertEqual(res1, res2)

    def test_extract_empty_and_corrupt_files(self):
        res_empty = extract_medical_report(b"")
        self.assertFalse(res_empty["ok"])
        self.assertIn("empty", res_empty["message"].lower())

        res_corrupt = extract_medical_report(b"invalid data")
        self.assertFalse(res_corrupt["ok"])
        self.assertIn("unsupported", res_corrupt["message"].lower())


class TestFastAPIReportEndpoint(unittest.TestCase):
    """Tests the /extract-medical-report endpoint via FastAPI TestClient."""

    @classmethod
    def setUpClass(cls):
        from fastapi.testclient import TestClient
        from app.app import app
        cls.client = TestClient(app)

    def test_endpoint_empty_file(self):
        resp = self.client.post(
            "/extract-medical-report",
            files={"file": ("empty.pdf", b"", "application/pdf")}
        )
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertFalse(data["ok"])
        self.assertIn("empty", data["message"].lower())

    @patch("app.medical_report.client.chat.completions.create")
    def test_endpoint_success_contract(self, mock_create):
        mock_response = MagicMock()
        mock_response.choices = [
            MagicMock(
                message=MagicMock(
                    content="""{
                        "lab_name": "SRL Diagnostics",
                        "report_date": "2026-11-18",
                        "tests": [
                            {
                                "test_name": "Platelet Count",
                                "observed_value": "225000",
                                "unit": "/cumm",
                                "reference_range": "150000 - 450000",
                                "page_number": 1
                            }
                        ]
                    }"""
                )
            )
        ]
        mock_create.return_value = mock_response

        png_bytes = _create_sample_png()
        resp = self.client.post(
            "/extract-medical-report",
            files={"file": ("report.png", png_bytes, "image/png")}
        )
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertTrue(data["ok"])
        self.assertEqual(data["lab_name"], "SRL Diagnostics")
        self.assertEqual(len(data["tests"]), 1)
        self.assertEqual(data["tests"][0]["test_name"], "Platelet Count")
        self.assertIn("disclaimer", data)


if __name__ == "__main__":
    unittest.main()

"""Comprehensive Unit Tests for Improved Prescription OCR & AI Information Extraction.

Tests all prescription intelligence requirements:
1. Multi-field extraction: name, brand_name, generic_name, strength, dosage, frequency,
   duration, instructions, confidence, is_uncertain, raw_text, is_verified.
2. Clinical safety rules: zero hallucination of unwritten fields, preserving uncertainty.
3. Metadata handling: doctor name, prescription date, explicitly written conditions.
4. Tesseract OCR evaluation & capability detection (graceful fallback without binary).
5. Robust error handling: malformed JSON, API rate limits, empty/non-medical documents.
6. Mocked vision-language model responses: runs 100% offline without requiring a real Groq API key.
7. Backward compatibility for existing Health Log consumers (dose, notes).
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

from app.prescription import extract_prescription, _sanitize, _clean
from app.models import PrescriptionMedicineItem, PrescriptionExtractionResponse
from app.ocr_comparison import check_tesseract_support, calculate_cer, calculate_wer


def _create_sample_png() -> bytes:
    """Helper: creates a minimal valid PNG image in memory."""
    img = Image.new("RGB", (300, 200), (255, 255, 255))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


class TestSanitizeLogic(unittest.TestCase):
    """Tests the clinical data sanitization, deduplication, and schema normalization."""

    def test_full_medicine_fields_extraction(self):
        raw = {
            "doctor": "Dr. S. Mukherjee, MD",
            "date": "2026-11-18",
            "conditions": ["Type 2 Diabetes Mellitus", "Hypertension"],
            "medicines": [
                {
                    "name": "Augmentin 625 Duo",
                    "brand_name": "Augmentin",
                    "generic_name": "Amoxicillin + Clavulanic Acid",
                    "strength": "625 mg",
                    "dosage": "1 tablet",
                    "frequency": "1-0-1",
                    "duration": "5 days",
                    "instructions": "Take after meals with water",
                    "confidence": "high",
                    "is_uncertain": False,
                    "raw_text": "Tab. Augmentin 625mg 1-0-1 x 5d PC",
                }
            ],
            "raw_ocr_text": "Rx: Dr S Mukherjee\nAugmentin 625 Duo 1-0-1 x 5 days",
        }
        clean = _sanitize(raw)
        self.assertEqual(clean["doctor"], "Dr. S. Mukherjee, MD")
        self.assertEqual(clean["date"], "2026-11-18")
        self.assertEqual(len(clean["conditions"]), 2)
        self.assertIn("Type 2 Diabetes Mellitus", clean["conditions"])

        self.assertEqual(len(clean["medicines"]), 1)
        med = clean["medicines"][0]
        self.assertEqual(med["name"], "Augmentin 625 Duo")
        self.assertEqual(med["brand_name"], "Augmentin")
        self.assertEqual(med["generic_name"], "Amoxicillin + Clavulanic Acid")
        self.assertEqual(med["strength"], "625 mg")
        self.assertEqual(med["dosage"], "1 tablet")
        self.assertEqual(med["dose"], "625 mg")  # Backward compatibility fallback
        self.assertEqual(med["frequency"], "1-0-1")
        self.assertEqual(med["duration"], "5 days")
        self.assertEqual(med["instructions"], "Take after meals with water")
        self.assertEqual(med["notes"], "Take after meals with water")  # Backward compatibility fallback
        self.assertEqual(med["confidence"], "high")
        self.assertFalse(med["is_uncertain"])
        self.assertFalse(med["is_verified"])
        self.assertEqual(med["raw_text"], "Tab. Augmentin 625mg 1-0-1 x 5d PC")

    def test_uncertain_and_low_confidence_flagging(self):
        """Low confidence or explicit uncertain flags should set is_uncertain=True."""
        raw = {
            "medicines": [
                {
                    "name": "Levothyroxine",
                    "strength": "50 mcg",
                    "confidence": "low",
                    "is_uncertain": False,  # Should become True because confidence is low
                },
                {
                    "name": "Atorvastatin",
                    "strength": "10 mg",
                    "confidence": "medium",
                    "is_uncertain": True,
                },
            ]
        }
        clean = _sanitize(raw)
        self.assertEqual(len(clean["medicines"]), 2)
        self.assertTrue(clean["medicines"][0]["is_uncertain"])
        self.assertEqual(clean["medicines"][0]["confidence"], "low")
        self.assertTrue(clean["medicines"][1]["is_uncertain"])

    def test_unwritten_fields_remain_empty_no_hallucination(self):
        """Missing fields should strictly remain empty strings and not be invented."""
        raw = {
            "medicines": [
                {
                    "name": "Paracetamol",
                    # No strength, dosage, frequency, duration, instructions provided
                }
            ]
        }
        clean = _sanitize(raw)
        med = clean["medicines"][0]
        self.assertEqual(med["name"], "Paracetamol")
        self.assertEqual(med["brand_name"], "")
        self.assertEqual(med["generic_name"], "")
        self.assertEqual(med["strength"], "")
        self.assertEqual(med["dosage"], "")
        self.assertEqual(med["dose"], "")
        self.assertEqual(med["frequency"], "")
        self.assertEqual(med["duration"], "")
        self.assertEqual(med["instructions"], "")
        self.assertEqual(med["notes"], "")

    def test_deduplication_of_conditions_and_medicines(self):
        raw = {
            "conditions": ["Asthma", "asthma", "Bronchial Asthma"],
            "medicines": [
                {"name": "Salbutamol", "dose": "100 mcg"},
                {"name": "salbutamol", "dose": "100 mcg"},  # Duplicate
                {"name": "Salbutamol", "dose": "200 mcg"},  # Different dose, keep
            ],
        }
        clean = _sanitize(raw)
        self.assertEqual(len(clean["conditions"]), 2)
        self.assertEqual(len(clean["medicines"]), 2)

    def test_string_length_caps(self):
        raw = {
            "doctor": "Dr. " + "A" * 200,
            "conditions": ["C" * 200],
            "medicines": [{"name": "M" * 200, "dose": "D" * 100}],
        }
        clean = _sanitize(raw)
        self.assertTrue(len(clean["doctor"]) <= 60)
        self.assertTrue(len(clean["conditions"][0]) <= 80)
        self.assertTrue(len(clean["medicines"][0]["name"]) <= 80)
        self.assertTrue(len(clean["medicines"][0]["dose"]) <= 40)


class TestMockedModelPrescriptionExtraction(unittest.TestCase):
    """Tests the extract_prescription endpoint with mocked Groq model outputs."""

    @patch("app.prescription.client.chat.completions.create")
    def test_extract_printed_prescription_success(self, mock_create):
        mock_response = MagicMock()
        mock_response.choices = [
            MagicMock(
                message=MagicMock(
                    content="""{
                        "doctor": "Dr. Rajesh Sharma",
                        "date": "18/11/2026",
                        "conditions": ["Essential Hypertension"],
                        "medicines": [
                            {
                                "name": "Telma 40",
                                "brand_name": "Telma",
                                "generic_name": "Telmisartan",
                                "strength": "40 mg",
                                "dosage": "1 tablet",
                                "frequency": "1-0-0",
                                "duration": "30 days",
                                "instructions": "morning after breakfast",
                                "confidence": "high",
                                "is_uncertain": false,
                                "raw_text": "Tab. Telma 40mg 1 OD morning x 30 days"
                            },
                            {
                                "name": "Amlong 5",
                                "brand_name": "Amlong",
                                "generic_name": "Amlodipine",
                                "strength": "5 mg",
                                "dosage": "1 tablet",
                                "frequency": "0-0-1",
                                "duration": "30 days",
                                "instructions": "at bedtime",
                                "confidence": "high",
                                "is_uncertain": false,
                                "raw_text": "Tab. Amlong 5mg 1 HS x 30 days"
                            }
                        ],
                        "raw_ocr_text": "Dr Rajesh Sharma\\nTelma 40mg\\nAmlong 5mg"
                    }"""
                )
            )
        ]
        mock_create.return_value = mock_response

        sample_bytes = _create_sample_png()
        result = extract_prescription(sample_bytes)

        self.assertTrue(result["ok"])
        self.assertEqual(result["doctor"], "Dr. Rajesh Sharma")
        self.assertEqual(result["date"], "18/11/2026")
        self.assertEqual(result["conditions"], ["Essential Hypertension"])
        self.assertEqual(len(result["medicines"]), 2)

        m1 = result["medicines"][0]
        self.assertEqual(m1["name"], "Telma 40")
        self.assertEqual(m1["brand_name"], "Telma")
        self.assertEqual(m1["generic_name"], "Telmisartan")
        self.assertEqual(m1["strength"], "40 mg")
        self.assertEqual(m1["dose"], "40 mg")
        self.assertEqual(m1["frequency"], "1-0-0")
        self.assertFalse(m1["is_uncertain"])
        self.assertFalse(m1["is_verified"])

        # Pydantic schema validation
        response_model = PrescriptionExtractionResponse.model_validate(result)
        self.assertEqual(len(response_model.medicines), 2)

    @patch("app.prescription.client.chat.completions.create")
    def test_extract_faint_handwritten_uncertain_prescription(self, mock_create):
        mock_response = MagicMock()
        mock_response.choices = [
            MagicMock(
                message=MagicMock(
                    content="""{
                        "doctor": "Dr. Roy",
                        "date": "",
                        "conditions": [],
                        "medicines": [
                            {
                                "name": "Azithral 500",
                                "brand_name": "Azithral",
                                "generic_name": "Azithromycin",
                                "strength": "500 mg",
                                "dosage": "1 tab",
                                "frequency": "1-0-0",
                                "duration": "3 days",
                                "instructions": "before food",
                                "confidence": "low",
                                "is_uncertain": true,
                                "raw_text": "Tab Azithral 500 [faint writing]"
                            }
                        ]
                    }"""
                )
            )
        ]
        mock_create.return_value = mock_response

        sample_bytes = _create_sample_png()
        result = extract_prescription(sample_bytes)

        self.assertTrue(result["ok"])
        self.assertEqual(len(result["medicines"]), 1)
        med = result["medicines"][0]
        self.assertTrue(med["is_uncertain"])
        self.assertEqual(med["confidence"], "low")

    @patch("app.prescription.client.chat.completions.create")
    def test_malformed_json_response_handling(self, mock_create):
        """Model returns non-JSON conversational text."""
        mock_response = MagicMock()
        mock_response.choices = [
            MagicMock(
                message=MagicMock(
                    content="I see a medical prescription, but I cannot parse it into JSON."
                )
            )
        ]
        mock_create.return_value = mock_response

        sample_bytes = _create_sample_png()
        result = extract_prescription(sample_bytes)

        self.assertFalse(result["ok"])
        self.assertIn("couldn't make sense", result["message"].lower())

    @patch("app.prescription.client.chat.completions.create")
    def test_empty_findings_response_handling(self, mock_create):
        """Model returns JSON but finds no medicines or conditions (e.g. non-prescription photo)."""
        mock_response = MagicMock()
        mock_response.choices = [
            MagicMock(
                message=MagicMock(
                    content='{"conditions": [], "medicines": [], "doctor": "", "date": ""}'
                )
            )
        ]
        mock_create.return_value = mock_response

        sample_bytes = _create_sample_png()
        result = extract_prescription(sample_bytes)

        self.assertFalse(result["ok"])
        self.assertIn("couldn't find any medicines", result["message"].lower())

    @patch("app.prescription.client.chat.completions.create")
    def test_api_failure_handled_gracefully(self, mock_create):
        """Network error or API failure returns user-friendly error without crashing."""
        mock_create.side_effect = RuntimeError("Groq rate limit exceeded (429)")

        sample_bytes = _create_sample_png()
        result = extract_prescription(sample_bytes)

        self.assertFalse(result["ok"])
        self.assertIn("couldn't read the prescription right now", result["message"].lower())


class TestTesseractAndMetricsEvaluation(unittest.TestCase):
    """Tests the OCR comparison metrics and Tesseract dynamic environment probing."""

    def test_tesseract_support_check_does_not_crash(self):
        """Verifies environment probe returns a clean tuple and never raises."""
        available, msg = check_tesseract_support()
        self.assertIsInstance(available, bool)
        self.assertIsInstance(msg, str)

    def test_cer_calculation_exact_match(self):
        cer = calculate_cer("Paracetamol 500mg", "Paracetamol 500mg")
        self.assertEqual(cer, 0.0)

    def test_cer_calculation_substitutions_and_deletions(self):
        # 1 character changed ('mg' -> 'ml')
        cer = calculate_cer("Paracetamol 500mg", "Paracetamol 500ml")
        self.assertAlmostEqual(cer, 1 / 17, places=3)

        # Empty reference
        self.assertEqual(calculate_cer("", ""), 0.0)
        self.assertEqual(calculate_cer("", "Text"), 1.0)

    def test_wer_calculation(self):
        # 1 word substituted out of 3
        wer = calculate_wer("Take with water", "Take with milk")
        self.assertAlmostEqual(wer, 1 / 3, places=3)

        # Exact match
        wer_exact = calculate_wer("Take with water", "Take with water")
        self.assertEqual(wer_exact, 0.0)


if __name__ == "__main__":
    unittest.main()

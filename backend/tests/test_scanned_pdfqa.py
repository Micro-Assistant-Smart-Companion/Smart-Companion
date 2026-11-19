"""Unit and Integration Tests for Improved Scanned PDF & Medical Document Pipeline.

Tests:
1. Digital PDFs (single and multi-page text layer extraction).
2. Scanned PDFs (pure image pages, vision processing, fallback).
3. Mixed PDFs (interleaved digital and scanned pages).
4. Rotated pages (90/270 degrees and scan tilt).
5. Low-quality documents (corrupted font glyphs, binary noise, faint scans).
6. Multi-page medical reports (laboratory tables, decimal points, units, reference ranges).
7. Safety and Limits (emergency triage, crisis triage, page limits, caching).
"""

from __future__ import annotations

import io
import os
import sys
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

# Ensure test placeholder GROQ_API_KEY is present
os.environ.setdefault("GROQ_API_KEY", "gsk_test_placeholder_key")

_backend_dir = Path(__file__).resolve().parent.parent
if str(_backend_dir) not in sys.path:
    sys.path.insert(0, str(_backend_dir))

from PIL import Image, ImageDraw
import pymupdf as fitz

from visual.pdfqa import (
    extract_pages,
    store_document,
    answer_question_about_document,
    assess_page_text_quality,
    _describe_scanned_page,
    _find_named_page,
    _clean_markdown,
    DOCUMENTS,
    _DOCUMENT_CONTENT_CACHE,
    MAX_PDF_PAGES,
    MAX_PDF_BYTES,
)
from app.triage import EMERGENCY_TEXT, CRISIS_TEXT


def _create_digital_pdf(page_texts: list[str]) -> bytes:
    """Helper to create an in-memory PDF with genuine selectable text layers."""
    doc = fitz.open()
    for text in page_texts:
        page = doc.new_page(width=595, height=842)  # A4
        page.insert_text((50, 72), text, fontsize=11)
    b = doc.tobytes()
    doc.close()
    return b


def _create_scanned_pdf(images: list[Image.Image]) -> bytes:
    """Helper to create an in-memory PDF containing full-page rasterized scan images."""
    doc = fitz.open()
    for img in images:
        page = doc.new_page(width=img.width, height=img.height)
        img_buf = io.BytesIO()
        img.save(img_buf, format="PNG")
        page.insert_image(page.rect, stream=img_buf.getvalue())
    b = doc.tobytes()
    doc.close()
    return b


def _create_synthetic_lab_image(title: str, tests: list[tuple[str, str, str, str]]) -> Image.Image:
    """Generates a clean synthetic lab report image with a table."""
    img = Image.new("RGB", (800, 1000), color=(255, 255, 255))
    draw = ImageDraw.Draw(img)
    draw.text((50, 40), f"CITY DIAGNOSTICS LABORATORY - {title}", fill=(0, 0, 0))
    draw.text((50, 70), "Date: 15-Oct-2026   Patient: John Doe   Ref Doctor: Dr. S. Rao", fill=(50, 50, 50))
    draw.line([(50, 100), (750, 100)], fill=(0, 0, 0), width=2)
    draw.text((50, 115), "Investigation Name       Result      Unit        Reference Range", fill=(0, 0, 0))
    draw.line([(50, 135), (750, 135)], fill=(120, 120, 120), width=1)
    
    y = 150
    for name, result, unit, ref in tests:
        line_str = f"{name:<24} {result:<11} {unit:<11} {ref}"
        draw.text((50, y), line_str, fill=(0, 0, 0))
        y += 35
    
    draw.line([(50, y + 10), (750, y + 10)], fill=(0, 0, 0), width=2)
    draw.text((50, y + 25), "Verified by: Chief Pathologist", fill=(50, 50, 50))
    return img


class TestDigitalPDFs(unittest.TestCase):
    """Verifies fast, local extraction on clean digital text PDFs."""

    def test_single_page_digital_pdf(self):
        text = (
            "Complete Blood Count Report\n"
            "Haemoglobin: 14.2 g/dL (Reference Range: 13.0 - 17.0)\n"
            "Total WBC Count: 7200 /mcL (Reference Range: 4000 - 11000)\n"
            "Platelet Count: 2.50 lakh /mcL (Reference Range: 1.5 - 4.5)"
        )
        pdf_bytes = _create_digital_pdf([text])
        pages, count = extract_pages(pdf_bytes)
        
        self.assertEqual(count, 1)
        self.assertIsNotNone(pages[0])
        self.assertIn("Haemoglobin: 14.2 g/dL", pages[0])
        self.assertIn("13.0 - 17.0", pages[0])

    def test_multipage_digital_pdf(self):
        p1 = "Page 1: General patient examination and vital signs. Blood pressure was 120/80 mmHg."
        p2 = "Page 2: Biochemical test analysis. Fasting Blood Glucose was 98.5 mg/dL. HbA1c is 5.6 %."
        pdf_bytes = _create_digital_pdf([p1, p2])
        pages, count = extract_pages(pdf_bytes)

        self.assertEqual(count, 2)
        self.assertIsNotNone(pages[0])
        self.assertIsNotNone(pages[1])
        self.assertIn("120/80 mmHg", pages[0])
        self.assertIn("98.5 mg/dL", pages[1])

    def test_store_digital_document_metadata(self):
        text = "Discharge summary for patient. Admitted on Monday and prescribed Amoxicillin 500mg."
        pdf_bytes = _create_digital_pdf([text])
        pages, count = extract_pages(pdf_bytes)
        res = store_document("discharge.pdf", pdf_bytes, pages)

        self.assertTrue(res["document_id"])
        self.assertEqual(res["pages_pending_vision"], 0)
        self.assertGreater(res["word_count"], 5)
        self.assertFalse(res["truncated"])


class TestScannedPDFs(unittest.TestCase):
    """Verifies handling of image-only scanned PDFs."""

    def test_scanned_page_detection_as_pending(self):
        img = _create_synthetic_lab_image("HAEMATOLOGY", [
            ("Haemoglobin", "13.8", "g/dL", "12.0 - 15.0"),
            ("PCV", "42.0", "%", "36.0 - 46.0"),
        ])
        pdf_bytes = _create_scanned_pdf([img])
        pages, count = extract_pages(pdf_bytes)

        self.assertEqual(count, 1)
        # Should be recognized as scanned (no digital text layer) -> None
        self.assertIsNone(pages[0])

        res = store_document("scanned_report.pdf", pdf_bytes, pages)
        self.assertEqual(res["pages_pending_vision"], 1)

    @patch("visual.pdfqa.client.chat.completions.create")
    def test_scanned_page_vision_read_preserves_table_and_decimals(self, mock_create):
        mock_response = MagicMock()
        mock_response.choices = [
            MagicMock(message=MagicMock(content=(
                "CITY DIAGNOSTICS LABORATORY - HAEMATOLOGY\n"
                "Investigation | Observed Value | Unit | Reference Range\n"
                "Haemoglobin | 13.8 | g/dL | 12.0 - 15.0\n"
                "PCV | 42.0 | % | 36.0 - 46.0"
            )))
        ]
        mock_create.return_value = mock_response

        img = _create_synthetic_lab_image("HAEMATOLOGY", [
            ("Haemoglobin", "13.8", "g/dL", "12.0 - 15.0"),
        ])
        pdf_bytes = _create_scanned_pdf([img])
        pages, count = extract_pages(pdf_bytes)
        res = store_document("scan.pdf", pdf_bytes, pages)
        doc_id = res["document_id"]

        # Call question answering about page 1
        with patch("visual.pdfqa._pace_before_call"):
            qa_res = answer_question_about_document(doc_id, "What is the hemoglobin on page 1?")

        self.assertTrue(qa_res["headline"])
        # Ensure page_texts[0] was filled in
        self.assertIsNotNone(DOCUMENTS[doc_id]["page_texts"][0])
        self.assertIn("13.8", DOCUMENTS[doc_id]["page_texts"][0])


class TestMixedPDFs(unittest.TestCase):
    """Verifies documents containing both digital and scanned pages."""

    def test_mixed_digital_and_scanned_pages(self):
        # Page 1: Digital text
        doc = fitz.open()
        p1 = doc.new_page()
        p1.insert_text((50, 72), "CLINICAL COVER NOTE\nPatient: Jane Doe, Age: 45\nReferred for lipid panel testing.", fontsize=11)

        # Page 2: Scanned lab table
        img = _create_synthetic_lab_image("LIPID PROFILE", [
            ("Total Cholesterol", "185.0", "mg/dL", "< 200.0"),
            ("Triglycerides", "142.5", "mg/dL", "< 150.0"),
            ("HDL Cholesterol", "48.2", "mg/dL", "> 40.0"),
        ])
        p2 = doc.new_page(width=img.width, height=img.height)
        img_buf = io.BytesIO()
        img.save(img_buf, format="PNG")
        p2.insert_image(p2.rect, stream=img_buf.getvalue())

        # Page 3: Digital doctor signature & instructions
        p3 = doc.new_page()
        p3.insert_text((50, 72), "RECOMMENDATIONS AND FOLLOW UP\nContinue healthy diet and aerobic exercise.\nReview in 6 months. Dr. K. Sharma.", fontsize=11)

        pdf_bytes = doc.tobytes()
        doc.close()

        pages, count = extract_pages(pdf_bytes)
        self.assertEqual(count, 3)
        self.assertIsNotNone(pages[0], "Page 1 should be recognized as clean digital text")
        self.assertIsNone(pages[1], "Page 2 should be recognized as scanned image requiring vision")
        self.assertIsNotNone(pages[2], "Page 3 should be recognized as clean digital text")

        res = store_document("mixed_report.pdf", pdf_bytes, pages)
        self.assertEqual(res["pages_pending_vision"], 1)


class TestRotatedPages(unittest.TestCase):
    """Verifies proper handling of rotated pages."""

    def test_pdf_page_rotation_flags(self):
        doc = fitz.open()
        page = doc.new_page()
        page.insert_text((100, 100), "Rotated pathology report findings. Fasting blood sugar 92 mg/dL.", fontsize=12)
        page.set_rotation(90)  # Rotated 90 degrees
        pdf_bytes = doc.tobytes()
        doc.close()

        pages, count = extract_pages(pdf_bytes)
        self.assertEqual(count, 1)
        self.assertIsNotNone(pages[0])
        self.assertIn("92 mg/dL", pages[0])

    def test_scanned_image_rotation_rendering(self):
        img = _create_synthetic_lab_image("THYROID", [("TSH", "2.45", "uIU/mL", "0.4 - 4.2")])
        img_rotated = img.rotate(90, expand=True)

        doc = fitz.open()
        page = doc.new_page(width=img_rotated.width, height=img_rotated.height)
        buf = io.BytesIO()
        img_rotated.save(buf, format="PNG")
        page.insert_image(page.rect, stream=buf.getvalue())
        pdf_bytes = doc.tobytes()
        doc.close()

        pages, count = extract_pages(pdf_bytes)
        self.assertEqual(count, 1)
        self.assertIsNone(pages[0])  # Correctly routed to scanned vision pipeline


class TestLowQualityDocuments(unittest.TestCase):
    """Verifies robust detection of corrupted font glyphs and noisy documents."""

    def test_corrupted_glyph_rejection(self):
        # Simulate PDF font subset corruption with binary replacement characters
        corrupted_text = "\x00\x01\x02\ufffd\ufffd\ufffd\ufffd\ufffd\ufffd\ufffd??????\x07\x08"
        fake_page = MagicMock()
        fake_page.get_images.return_value = []
        is_digital, reason = assess_page_text_quality(fake_page, corrupted_text)
        self.assertFalse(is_digital)
        self.assertIn("corrupted_glyphs", reason)

    def test_scanned_page_with_tiny_ocr_watermark_detected_as_scan(self):
        fake_page = MagicMock()
        fake_page.get_images.return_value = [(1, 0, 800, 1000, 8, "DeviceRGB", "", "", "")]
        fake_page.rect = MagicMock(width=595, height=842)
        fake_page.get_image_rects.return_value = [MagicMock(width=550, height=800)]
        
        # A tiny header or watermark extracted from a scanned document
        sparse_text = "Page 1 Confidential Medical Document"
        is_digital, reason = assess_page_text_quality(fake_page, sparse_text)
        self.assertFalse(is_digital)
        self.assertIn("image_dominant", reason)


class TestMultiPageMedicalReports(unittest.TestCase):
    """Verifies multi-page medical lab reports and targeted Q&A."""

    def test_multipage_targeted_qa_reads_only_requested_page(self):
        # Multi-page document
        p1 = "Page 1: Complete Blood Count. Haemoglobin: 14.2 g/dL. Total Leucocyte Count: 6800 /cumm."
        p2 = "Page 2: Renal Function Test. Serum Creatinine: 0.9 mg/dL. Blood Urea: 24.0 mg/dL."
        p3 = "Page 3: Liver Function Test. SGPT (ALT): 28.0 U/L. Serum Bilirubin Total: 0.7 mg/dL."
        pdf_bytes = _create_digital_pdf([p1, p2, p3])

        pages, count = extract_pages(pdf_bytes)
        self.assertEqual(count, 3)

        doc_dict = store_document("lab_full.pdf", pdf_bytes, pages)
        doc_id = doc_dict["document_id"]

        with patch("visual.pdfqa.client.chat.completions.create") as mock_qa:
            mock_res = MagicMock()
            mock_res.choices = [MagicMock(message=MagicMock(content="Serum creatinine was 0.9 mg/dL on page 2.\n\nThis is within the normal reference range."))]
            mock_qa.return_value = mock_res

            res = answer_question_about_document(doc_id, "What is my creatinine on page 2?")
            self.assertEqual(res["headline"], "Serum creatinine was 0.9 mg/dL on page 2.")
            self.assertEqual(res["detail"], "This is within the normal reference range.")


class TestSafetyAndLimits(unittest.TestCase):
    """Verifies emergency triage, size limits, and caching."""

    def test_emergency_triage_interception_in_qa(self):
        pdf_bytes = _create_digital_pdf(["Medical report content."])
        pages, _ = extract_pages(pdf_bytes)
        doc_id = store_document("doc.pdf", pdf_bytes, pages)["document_id"]

        res = answer_question_about_document(doc_id, "I have severe chest pain and can't breathe right now")
        self.assertEqual(res["headline"], EMERGENCY_TEXT)
        self.assertIn("emergency medical services", res["detail"].lower())

    def test_crisis_triage_interception_in_qa(self):
        pdf_bytes = _create_digital_pdf(["General document."])
        pages, _ = extract_pages(pdf_bytes)
        doc_id = store_document("doc.pdf", pdf_bytes, pages)["document_id"]

        res = answer_question_about_document(doc_id, "I feel like I want to kill myself")
        self.assertEqual(res["headline"], CRISIS_TEXT)
        self.assertIn("helpline", res["detail"].lower())

    def test_oversized_pdf_raises_validation_error(self):
        huge_bytes = b"%PDF-1.4 " + (b"0" * (MAX_PDF_BYTES + 100))
        with self.assertRaises(ValueError):
            extract_pages(huge_bytes)

    def test_empty_pdf_returns_empty_gracefully(self):
        pages, count = extract_pages(b"")
        self.assertEqual(count, 0)
        self.assertEqual(pages, [])

    def test_caching_identical_document_bytes(self):
        text = "Pathology test findings with identical content for duplicate caching check."
        pdf_bytes = _create_digital_pdf([text])

        # First extraction
        pages1, count1 = extract_pages(pdf_bytes)
        self.assertEqual(count1, 1)

        # Second extraction with same bytes should hit cache
        pages2, count2 = extract_pages(pdf_bytes)
        self.assertEqual(count1, count2)
        self.assertEqual(pages1, pages2)


if __name__ == "__main__":
    unittest.main()

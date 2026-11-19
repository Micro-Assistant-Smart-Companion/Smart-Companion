"""Synthetic and De-identified Benchmark Dataset for Medical Document Intelligence.

Includes ground truth annotations, document bytes synthesis helpers,
and realistic edge cases for prescriptions and medical reports.
"""

import io
from typing import Any, Callable, Dict, List, Optional
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter
import pymupdf


# ==============================================================================
# Helper generators for synthetic document images & PDFs
# ==============================================================================

def create_synthetic_text_image(
    lines: List[str],
    width: int = 1200,
    height: int = 1500,
    blur: float = 0.0,
    rotation: int = 0,
    brightness: float = 1.0,
    dark_mode: bool = False
) -> bytes:
    """Generate a synthetic document image in memory."""
    bg_color = (30, 30, 30) if dark_mode else (255, 255, 255)
    text_color = (220, 220, 220) if dark_mode else (20, 20, 20)

    img = Image.new("RGB", (width, height), bg_color)
    draw = ImageDraw.Draw(img)

    y = 60
    for line in lines:
        draw.text((60, y), line, fill=text_color)
        y += 42

    if blur > 0:
        img = img.filter(ImageFilter.GaussianBlur(radius=blur))

    if brightness != 1.0:
        enhancer = ImageEnhance.Brightness(img)
        img = enhancer.enhance(brightness)

    if rotation != 0:
        img = img.rotate(rotation, expand=True)

    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=90)
    return buf.getvalue()


def create_synthetic_digital_pdf(pages_text: List[List[str]]) -> bytes:
    """Generate a clean digital searchable PDF with selectable text."""
    doc = pymupdf.open()
    for lines in pages_text:
        page = doc.new_page(width=595, height=842)  # A4 standard
        y = 50
        for line in lines:
            page.insert_text(pymupdf.Point(50, y), line, fontsize=11, color=(0.1, 0.1, 0.1))
            y += 20
    buf = io.BytesIO()
    doc.save(buf)
    doc.close()
    return buf.getvalue()


def create_synthetic_scanned_pdf(pages_images: List[bytes]) -> bytes:
    """Generate a scanned PDF where each page contains a rasterized bitmap image."""
    doc = pymupdf.open()
    for img_bytes in pages_images:
        page = doc.new_page(width=595, height=842)
        page.insert_image(page.rect, stream=img_bytes)
    buf = io.BytesIO()
    doc.save(buf)
    doc.close()
    return buf.getvalue()


# ==============================================================================
# A. Prescription Benchmark Dataset
# ==============================================================================

RX_01_CLEAR_LINES = [
    "DR. ARJUN SHARMA, MD (Internal Medicine)",
    "Apex Healthcare Clinic, New Delhi",
    "Date: 12-Nov-2026   Patient: Rajeev Verma (Age: 45)",
    "Diagnosis: Acute Pharyngitis with Gastric Irritation",
    "--------------------------------------------------",
    "Rx",
    "1. Tab. Paracetamol 500mg - 1 tablet three times daily (TDS) after meals for 5 days",
    "2. Cap. Amoxicillin 500mg - 1 capsule twice daily (BD) for 7 days",
    "3. Tab. Pantoprazole 40mg - 1 tablet once daily (OD) before breakfast for 7 days",
    "--------------------------------------------------",
    "Instructions: Drink plenty of warm water and rest well.",
]

RX_02_HANDWRITTEN_LINES = [
    "Dr. S. Roy - MBBS",
    "Pt: Meera Sen, 32F   Date: 10/11/26",
    "Rx (Handwritten notation):",
    "Tab Augmentin 625mg 1 tab BD x 5 d",
    "Syp Ascoril 5ml TDS x 5 d",
    "Tab Cetirizine 10mg 1 tab HS x 3 d",
]

RX_03_BLURRY_LINES = [
    "CITY HOSPITAL OUTPATIENT CLINIC",
    "Date: 08-Nov-2026",
    "Rx:",
    "Metformin 500mg - 1 tab OD after dinner",
    "Glimepiride 2mg - 1 tab OD before breakfast",
    "Maintain low carb diet.",
]

RX_04_ROTATED_LINES = [
    "DR. PRIYA NAIR - Consultant Physician",
    "Patient: Sunita Rao   Date: 14/11/2026",
    "Rx",
    "Azithromycin 500mg - 1 tablet once daily for 3 days",
    "Paracetamol 650mg - 1 tablet SOS for fever",
]

RX_05_LOW_LIGHT_LINES = [
    "ST. JUDE HEALTH CENTER",
    "Date: 15-Nov-2026",
    "Rx:",
    "Telmisartan 40mg - 1 tab OD morning",
    "Amlodipine 5mg - 1 tab OD morning",
]

RX_06_MULTIPAGE_PAGE1 = [
    "METRO SPECIALTY HOSPITAL - CARDIOLOGY DEPARTMENT",
    "Page 1 of 2",
    "Patient: Vikram Singhania (Age: 58)",
    "Date: 05-Nov-2026",
    "Rx:",
    "1. Atorvastatin 20mg - 1 tablet at bedtime (HS) for 30 days",
    "2. Metoprolol 50mg - 1 tablet once daily in morning for 30 days",
]

RX_06_MULTIPAGE_PAGE2 = [
    "METRO SPECIALTY HOSPITAL - CARDIOLOGY DEPARTMENT",
    "Page 2 of 2",
    "Rx Continued:",
    "3. Aspirin 75mg - 1 tablet once daily after lunch for 30 days",
    "4. Ezetimibe 10mg - 1 tablet at bedtime for 30 days",
    "Next review after 1 month with Lipid Profile.",
]

RX_07_MISSING_STRENGTH_LINES = [
    "WELLNESS CLINIC",
    "Date: 16-Nov-2026",
    "Rx:",
    "Cetirizine - 1 tablet at bedtime for 5 days",
    "Salbutamol Inhaler - 2 puffs as needed",
]

RX_08_MISSING_DOSAGE_LINES = [
    "HEALTHFIRST CLINIC",
    "Date: 16-Nov-2026",
    "Rx:",
    "Montelukast 10mg",
    "Levocetirizine 5mg",
]

RX_09_AMBIGUOUS_NAME_LINES = [
    "COMMUNITY HEALTH DISPENSARY",
    "Date: 17-Nov-2026",
    "Rx:",
    "C???cin 650mg - 1 tab SOS",
    "Pantoprazole 40mg - 1 tab OD",
]

RX_10_MULTI_MED_LINES = [
    "COMPREHENSIVE GERIATRIC CARE CENTER",
    "Date: 12-Nov-2026",
    "Patient: Harish Chandra (Age: 71)",
    "Diagnosis: Type 2 Diabetes, Hypertension, Dyslipidemia",
    "Rx:",
    "1. Metformin 1000mg - 1 tab twice daily with meals",
    "2. Glimepiride 1mg - 1 tab once daily before breakfast",
    "3. Telmisartan 40mg - 1 tab once daily morning",
    "4. Rosuvastatin 10mg - 1 tab once daily at bedtime",
    "5. Pantoprazole 40mg - 1 tab once daily empty stomach",
]


BENCHMARK_PRESCRIPTIONS: List[Dict[str, Any]] = [
    {
        "id": "rx_01_clear_printed",
        "category": "clear_printed",
        "description": "Clear printed prescription with 3 standard medicines and explicit dosages",
        "file_name": "rx_clear_printed.jpg",
        "ground_truth_text": "\n".join(RX_01_CLEAR_LINES),
        "ground_truth_medicines": [
            {
                "name": "Paracetamol",
                "brand_name": "",
                "generic_name": "Paracetamol",
                "strength": "500mg",
                "dosage": "1 tablet",
                "frequency": "three times daily (TDS)",
                "duration": "5 days",
                "instructions": "after meals",
                "is_uncertain": False,
            },
            {
                "name": "Amoxicillin",
                "brand_name": "",
                "generic_name": "Amoxicillin",
                "strength": "500mg",
                "dosage": "1 capsule",
                "frequency": "twice daily (BD)",
                "duration": "7 days",
                "instructions": "",
                "is_uncertain": False,
            },
            {
                "name": "Pantoprazole",
                "brand_name": "",
                "generic_name": "Pantoprazole",
                "strength": "40mg",
                "dosage": "1 tablet",
                "frequency": "once daily (OD)",
                "duration": "7 days",
                "instructions": "before breakfast",
                "is_uncertain": False,
            },
        ],
        "get_bytes": lambda: create_synthetic_text_image(RX_01_CLEAR_LINES),
        "expected_uncertain": False,
    },
    {
        "id": "rx_02_handwritten",
        "category": "handwritten",
        "description": "Prescription simulating handwritten shorthand and cursive notes",
        "file_name": "rx_handwritten.jpg",
        "ground_truth_text": "\n".join(RX_02_HANDWRITTEN_LINES),
        "ground_truth_medicines": [
            {
                "name": "Augmentin",
                "brand_name": "Augmentin",
                "generic_name": "",
                "strength": "625mg",
                "dosage": "1 tab",
                "frequency": "BD",
                "duration": "5 days",
                "instructions": "",
                "is_uncertain": False,
            },
            {
                "name": "Ascoril",
                "brand_name": "Ascoril",
                "generic_name": "",
                "strength": "",
                "dosage": "5ml",
                "frequency": "TDS",
                "duration": "5 days",
                "instructions": "",
                "is_uncertain": False,
            },
            {
                "name": "Cetirizine",
                "brand_name": "",
                "generic_name": "Cetirizine",
                "strength": "10mg",
                "dosage": "1 tab",
                "frequency": "HS",
                "duration": "3 days",
                "instructions": "",
                "is_uncertain": False,
            },
        ],
        "get_bytes": lambda: create_synthetic_text_image(RX_02_HANDWRITTEN_LINES),
        "expected_uncertain": False,
    },
    {
        "id": "rx_03_blurry",
        "category": "blurry",
        "description": "Out-of-focus prescription with Gaussian blur requiring uncertainty flagging",
        "file_name": "rx_blurry.jpg",
        "ground_truth_text": "\n".join(RX_03_BLURRY_LINES),
        "ground_truth_medicines": [
            {
                "name": "Metformin",
                "brand_name": "",
                "generic_name": "Metformin",
                "strength": "500mg",
                "dosage": "1 tab",
                "frequency": "OD",
                "duration": "",
                "instructions": "after dinner",
                "is_uncertain": True,
            },
            {
                "name": "Glimepiride",
                "brand_name": "",
                "generic_name": "Glimepiride",
                "strength": "2mg",
                "dosage": "1 tab",
                "frequency": "OD",
                "duration": "",
                "instructions": "before breakfast",
                "is_uncertain": True,
            },
        ],
        "get_bytes": lambda: create_synthetic_text_image(RX_03_BLURRY_LINES, blur=3.5),
        "expected_uncertain": True,
    },
    {
        "id": "rx_04_rotated",
        "category": "rotated",
        "description": "Prescription photographed sideways (90 degree rotation)",
        "file_name": "rx_rotated.jpg",
        "ground_truth_text": "\n".join(RX_04_ROTATED_LINES),
        "ground_truth_medicines": [
            {
                "name": "Azithromycin",
                "brand_name": "",
                "generic_name": "Azithromycin",
                "strength": "500mg",
                "dosage": "1 tablet",
                "frequency": "once daily",
                "duration": "3 days",
                "instructions": "",
                "is_uncertain": False,
            },
            {
                "name": "Paracetamol",
                "brand_name": "",
                "generic_name": "Paracetamol",
                "strength": "650mg",
                "dosage": "1 tablet",
                "frequency": "SOS",
                "duration": "",
                "instructions": "for fever",
                "is_uncertain": False,
            },
        ],
        "get_bytes": lambda: create_synthetic_text_image(RX_04_ROTATED_LINES, rotation=90),
        "expected_uncertain": False,
    },
    {
        "id": "rx_05_low_light",
        "category": "low_light",
        "description": "Prescription captured in dark lighting conditions (brightness 0.35)",
        "file_name": "rx_low_light.jpg",
        "ground_truth_text": "\n".join(RX_05_LOW_LIGHT_LINES),
        "ground_truth_medicines": [
            {
                "name": "Telmisartan",
                "brand_name": "",
                "generic_name": "Telmisartan",
                "strength": "40mg",
                "dosage": "1 tab",
                "frequency": "OD",
                "duration": "",
                "instructions": "morning",
                "is_uncertain": False,
            },
            {
                "name": "Amlodipine",
                "brand_name": "",
                "generic_name": "Amlodipine",
                "strength": "5mg",
                "dosage": "1 tab",
                "frequency": "OD",
                "duration": "",
                "instructions": "morning",
                "is_uncertain": False,
            },
        ],
        "get_bytes": lambda: create_synthetic_text_image(RX_05_LOW_LIGHT_LINES, brightness=0.35),
        "expected_uncertain": False,
    },
    {
        "id": "rx_06_multipage_pdf",
        "category": "multipage_pdf",
        "description": "Multi-page digital PDF prescription spanning 2 pages",
        "file_name": "rx_multipage.pdf",
        "ground_truth_text": "\n".join(RX_06_MULTIPAGE_PAGE1 + RX_06_MULTIPAGE_PAGE2),
        "ground_truth_medicines": [
            {
                "name": "Atorvastatin",
                "brand_name": "",
                "generic_name": "Atorvastatin",
                "strength": "20mg",
                "dosage": "1 tablet",
                "frequency": "HS",
                "duration": "30 days",
                "instructions": "at bedtime",
                "is_uncertain": False,
            },
            {
                "name": "Metoprolol",
                "brand_name": "",
                "generic_name": "Metoprolol",
                "strength": "50mg",
                "dosage": "1 tablet",
                "frequency": "once daily",
                "duration": "30 days",
                "instructions": "in morning",
                "is_uncertain": False,
            },
            {
                "name": "Aspirin",
                "brand_name": "",
                "generic_name": "Aspirin",
                "strength": "75mg",
                "dosage": "1 tablet",
                "frequency": "once daily",
                "duration": "30 days",
                "instructions": "after lunch",
                "is_uncertain": False,
            },
            {
                "name": "Ezetimibe",
                "brand_name": "",
                "generic_name": "Ezetimibe",
                "strength": "10mg",
                "dosage": "1 tablet",
                "frequency": "HS",
                "duration": "30 days",
                "instructions": "at bedtime",
                "is_uncertain": False,
            },
        ],
        "get_bytes": lambda: create_synthetic_digital_pdf([RX_06_MULTIPAGE_PAGE1, RX_06_MULTIPAGE_PAGE2]),
        "expected_uncertain": False,
    },
    {
        "id": "rx_07_missing_strength",
        "category": "missing_strength",
        "description": "Prescription where medicine strength is omitted and must NOT be hallucinated",
        "file_name": "rx_missing_strength.jpg",
        "ground_truth_text": "\n".join(RX_07_MISSING_STRENGTH_LINES),
        "ground_truth_medicines": [
            {
                "name": "Cetirizine",
                "brand_name": "",
                "generic_name": "Cetirizine",
                "strength": "",  # Must remain empty, no hallucinated 10mg
                "dosage": "1 tablet",
                "frequency": "HS",
                "duration": "5 days",
                "instructions": "at bedtime",
                "is_uncertain": False,
            },
            {
                "name": "Salbutamol Inhaler",
                "brand_name": "",
                "generic_name": "Salbutamol",
                "strength": "",
                "dosage": "2 puffs",
                "frequency": "as needed",
                "duration": "",
                "instructions": "",
                "is_uncertain": False,
            },
        ],
        "get_bytes": lambda: create_synthetic_text_image(RX_07_MISSING_STRENGTH_LINES),
        "expected_uncertain": False,
    },
    {
        "id": "rx_08_missing_dosage",
        "category": "missing_dosage",
        "description": "Prescription where dosage and frequency are omitted and must remain empty",
        "file_name": "rx_missing_dosage.jpg",
        "ground_truth_text": "\n".join(RX_08_MISSING_DOSAGE_LINES),
        "ground_truth_medicines": [
            {
                "name": "Montelukast",
                "brand_name": "",
                "generic_name": "Montelukast",
                "strength": "10mg",
                "dosage": "",  # Must remain empty
                "frequency": "",
                "duration": "",
                "instructions": "",
                "is_uncertain": False,
            },
            {
                "name": "Levocetirizine",
                "brand_name": "",
                "generic_name": "Levocetirizine",
                "strength": "5mg",
                "dosage": "",  # Must remain empty
                "frequency": "",
                "duration": "",
                "instructions": "",
                "is_uncertain": False,
            },
        ],
        "get_bytes": lambda: create_synthetic_text_image(RX_08_MISSING_DOSAGE_LINES),
        "expected_uncertain": False,
    },
    {
        "id": "rx_09_ambiguous_name",
        "category": "ambiguous_name",
        "description": "Partially occluded or illegible medicine name flagged as uncertain",
        "file_name": "rx_ambiguous.jpg",
        "ground_truth_text": "\n".join(RX_09_AMBIGUOUS_NAME_LINES),
        "ground_truth_medicines": [
            {
                "name": "Crocin",
                "brand_name": "Crocin",
                "generic_name": "",
                "strength": "650mg",
                "dosage": "1 tab",
                "frequency": "SOS",
                "duration": "",
                "instructions": "",
                "is_uncertain": True,  # Ambiguous/occluded
            },
            {
                "name": "Pantoprazole",
                "brand_name": "",
                "generic_name": "Pantoprazole",
                "strength": "40mg",
                "dosage": "1 tab",
                "frequency": "OD",
                "duration": "",
                "instructions": "",
                "is_uncertain": False,
            },
        ],
        "get_bytes": lambda: create_synthetic_text_image(RX_09_AMBIGUOUS_NAME_LINES),
        "expected_uncertain": True,
    },
    {
        "id": "rx_10_multi_medicine",
        "category": "multi_medicine",
        "description": "Complex prescription containing 5 different chronic medications",
        "file_name": "rx_multi_medicine.jpg",
        "ground_truth_text": "\n".join(RX_10_MULTI_MED_LINES),
        "ground_truth_medicines": [
            {
                "name": "Metformin",
                "brand_name": "",
                "generic_name": "Metformin",
                "strength": "1000mg",
                "dosage": "1 tab",
                "frequency": "twice daily",
                "duration": "",
                "instructions": "with meals",
                "is_uncertain": False,
            },
            {
                "name": "Glimepiride",
                "brand_name": "",
                "generic_name": "Glimepiride",
                "strength": "1mg",
                "dosage": "1 tab",
                "frequency": "once daily",
                "duration": "",
                "instructions": "before breakfast",
                "is_uncertain": False,
            },
            {
                "name": "Telmisartan",
                "brand_name": "",
                "generic_name": "Telmisartan",
                "strength": "40mg",
                "dosage": "1 tab",
                "frequency": "once daily",
                "duration": "",
                "instructions": "morning",
                "is_uncertain": False,
            },
            {
                "name": "Rosuvastatin",
                "brand_name": "",
                "generic_name": "Rosuvastatin",
                "strength": "10mg",
                "dosage": "1 tab",
                "frequency": "once daily",
                "duration": "",
                "instructions": "at bedtime",
                "is_uncertain": False,
            },
            {
                "name": "Pantoprazole",
                "brand_name": "",
                "generic_name": "Pantoprazole",
                "strength": "40mg",
                "dosage": "1 tab",
                "frequency": "once daily",
                "duration": "",
                "instructions": "empty stomach",
                "is_uncertain": False,
            },
        ],
        "get_bytes": lambda: create_synthetic_text_image(RX_10_MULTI_MED_LINES),
        "expected_uncertain": False,
    },
]


# ==============================================================================
# B. Medical Report Benchmark Dataset
# ==============================================================================

REP_01_CBC_LINES = [
    "APEX DIAGNOSTIC LABORATORIES",
    "Patient: Raman Kumar (Age: 38M)   Date: 14-Nov-2026",
    "Investigation: COMPLETE BLOOD COUNT (CBC)",
    "----------------------------------------------------------------",
    "Test Name                  Observed Value    Units       Reference Range",
    "----------------------------------------------------------------",
    "Haemoglobin                14.2              g/dL        13.0 - 17.0",
    "Total WBC Count            6800              /cumm       4000 - 11000",
    "Platelet Count             2.35              lakh/cumm   1.5 - 4.5",
    "RBC Count                  4.8               mil/cumm    4.5 - 5.5",
    "Packed Cell Volume (PCV)   42.5              %           40.0 - 50.0",
    "----------------------------------------------------------------",
]

REP_02_LIPID_LINES = [
    "HEALTHCARE PATHOLOGY SERVICES",
    "Report: LIPID PROFILE",
    "Date: 12-Nov-2026",
    "Total Cholesterol: 195.4 mg/dL (Reference: < 200)",
    "Triglycerides: 168.0 mg/dL (Reference: < 150)",
    "HDL Cholesterol: 44.2 mg/dL (Reference: > 40)",
    "LDL Cholesterol: 117.6 mg/dL (Reference: < 100)",
]

REP_03_LFT_TABLE_LINES = [
    "CENTRAL CLINICAL BIOCHEMISTRY",
    "Test Name           Result    Unit      Biological Reference Interval",
    "Bilirubin Total     0.85      mg/dL     0.2 - 1.2",
    "Bilirubin Direct    0.20      mg/dL     0.0 - 0.3",
    "SGOT (AST)          28.0      U/L       10 - 40",
    "SGPT (ALT)          34.5      U/L       7 - 56",
    "Alkaline Phosphatase 88.0     U/L       44 - 147",
]

REP_04_PAGE1_RENAL = [
    "METROPATH LABS - REPORT SHEET 1",
    "RENAL FUNCTION PANEL",
    "Date: 10-Nov-2026",
    "Blood Urea: 26.4 mg/dL (Reference: 15 - 45)",
    "Serum Creatinine: 0.92 mg/dL (Reference: 0.7 - 1.3)",
    "Blood Urea Nitrogen: 12.3 mg/dL (Reference: 6 - 20)",
]

REP_04_PAGE2_ELECTROLYTES = [
    "METROPATH LABS - REPORT SHEET 2",
    "SERUM ELECTROLYTES",
    "Date: 10-Nov-2026",
    "Sodium: 139.0 mEq/L (Reference: 136 - 145)",
    "Potassium: 4.35 mEq/L (Reference: 3.5 - 5.1)",
    "Chloride: 102.0 mEq/L (Reference: 98 - 107)",
]

REP_05_THYROID_LINES = [
    "SPECIALTY ENDOCRINE LABORATORY",
    "Investigation: THYROID FUNCTION PROFILE",
    "Date: 15-Nov-2026",
    "Total Triiodothyronine (T3): 1.15 ng/mL (Reference: 0.8 - 2.0)",
    "Total Thyroxine (T4): 8.42 ug/dL (Reference: 5.1 - 14.1)",
    "Thyroid Stimulating Hormone (TSH): 4.82 uIU/mL (Reference: 0.40 - 4.20)",
]

REP_06_EXPLICIT_RANGES_LINES = [
    "DIABETES CARE CLINIC",
    "Date: 11-Nov-2026",
    "Fasting Blood Glucose: 96 mg/dL [Normal: 70 - 100 mg/dL]",
    "Post Prandial Glucose: 132 mg/dL [Normal: < 140 mg/dL]",
    "HbA1c (Glycated Hb): 5.5 % [Normal: 4.0 - 5.6 %, Diabetic: >= 6.5 %]",
]

REP_07_MISSING_ILLEGIBLE_LINES = [
    "REGIONAL DIAGNOSTIC LAB",
    "Investigation: IRON STUDIES",
    "Serum Iron: Sample Hemolyzed / Unreadable",
    "Total Iron Binding Capacity: 320 ug/dL (Reference: 250 - 450)",
    "Ferritin: 45.0 ng/mL (Reference: 30 - 400)",
]

REP_08_PAGE1_DIGITAL = [
    "URINALYSIS DIGITAL SUMMARY",
    "Specific Gravity: 1.018 (Reference: 1.005 - 1.030)",
    "pH: 6.0 (Reference: 4.5 - 8.0)",
    "Protein: Nil",
]

REP_08_PAGE2_SCANNED = [
    "URINE MICROSCOPY (SCANNED SHEET)",
    "Pus Cells: 2-3 /HPF (Reference: 0 - 5)",
    "RBCs: Nil /HPF",
    "Epithelial Cells: 1-2 /HPF",
]


BENCHMARK_MEDICAL_REPORTS: List[Dict[str, Any]] = [
    {
        "id": "rep_01_digital_cbc",
        "category": "digital_pdf",
        "description": "Clean digital PDF laboratory report for Complete Blood Count",
        "file_name": "cbc_report.pdf",
        "ground_truth_text": "\n".join(REP_01_CBC_LINES),
        "ground_truth_tests": [
            {
                "test_name": "Haemoglobin",
                "reading": "14.2",
                "unit": "g/dL",
                "reference_range": "13.0 - 17.0",
                "is_uncertain": False,
            },
            {
                "test_name": "Total WBC Count",
                "reading": "6800",
                "unit": "/cumm",
                "reference_range": "4000 - 11000",
                "is_uncertain": False,
            },
            {
                "test_name": "Platelet Count",
                "reading": "2.35",
                "unit": "lakh/cumm",
                "reference_range": "1.5 - 4.5",
                "is_uncertain": False,
            },
            {
                "test_name": "RBC Count",
                "reading": "4.8",
                "unit": "mil/cumm",
                "reference_range": "4.5 - 5.5",
                "is_uncertain": False,
            },
            {
                "test_name": "Packed Cell Volume (PCV)",
                "reading": "42.5",
                "unit": "%",
                "reference_range": "40.0 - 50.0",
                "is_uncertain": False,
            },
        ],
        "get_bytes": lambda: create_synthetic_digital_pdf([REP_01_CBC_LINES]),
    },
    {
        "id": "rep_02_scanned_lipid",
        "category": "scanned_pdf",
        "description": "Scanned rasterized laboratory report of Lipid Profile",
        "file_name": "lipid_scanned.pdf",
        "ground_truth_text": "\n".join(REP_02_LIPID_LINES),
        "ground_truth_tests": [
            {
                "test_name": "Total Cholesterol",
                "reading": "195.4",
                "unit": "mg/dL",
                "reference_range": "< 200",
                "is_uncertain": False,
            },
            {
                "test_name": "Triglycerides",
                "reading": "168.0",
                "unit": "mg/dL",
                "reference_range": "< 150",
                "is_uncertain": False,
            },
            {
                "test_name": "HDL Cholesterol",
                "reading": "44.2",
                "unit": "mg/dL",
                "reference_range": "> 40",
                "is_uncertain": False,
            },
            {
                "test_name": "LDL Cholesterol",
                "reading": "117.6",
                "unit": "mg/dL",
                "reference_range": "< 100",
                "is_uncertain": False,
            },
        ],
        "get_bytes": lambda: create_synthetic_scanned_pdf([create_synthetic_text_image(REP_02_LIPID_LINES)]),
    },
    {
        "id": "rep_03_tables_lft",
        "category": "table",
        "description": "Report with tabular grid layout for Liver Function Tests",
        "file_name": "lft_table.jpg",
        "ground_truth_text": "\n".join(REP_03_LFT_TABLE_LINES),
        "ground_truth_tests": [
            {
                "test_name": "Bilirubin Total",
                "reading": "0.85",
                "unit": "mg/dL",
                "reference_range": "0.2 - 1.2",
                "is_uncertain": False,
            },
            {
                "test_name": "Bilirubin Direct",
                "reading": "0.20",
                "unit": "mg/dL",
                "reference_range": "0.0 - 0.3",
                "is_uncertain": False,
            },
            {
                "test_name": "SGOT (AST)",
                "reading": "28.0",
                "unit": "U/L",
                "reference_range": "10 - 40",
                "is_uncertain": False,
            },
            {
                "test_name": "SGPT (ALT)",
                "reading": "34.5",
                "unit": "U/L",
                "reference_range": "7 - 56",
                "is_uncertain": False,
            },
            {
                "test_name": "Alkaline Phosphatase",
                "reading": "88.0",
                "unit": "U/L",
                "reference_range": "44 - 147",
                "is_uncertain": False,
            },
        ],
        "get_bytes": lambda: create_synthetic_text_image(REP_03_LFT_TABLE_LINES),
    },
    {
        "id": "rep_04_multipage_renal_electrolytes",
        "category": "multipage",
        "description": "Multi-page laboratory report: Renal Panel (Page 1) and Electrolytes (Page 2)",
        "file_name": "renal_electrolytes.pdf",
        "ground_truth_text": "\n".join(REP_04_PAGE1_RENAL + REP_04_PAGE2_ELECTROLYTES),
        "ground_truth_tests": [
            {
                "test_name": "Blood Urea",
                "reading": "26.4",
                "unit": "mg/dL",
                "reference_range": "15 - 45",
                "is_uncertain": False,
            },
            {
                "test_name": "Serum Creatinine",
                "reading": "0.92",
                "unit": "mg/dL",
                "reference_range": "0.7 - 1.3",
                "is_uncertain": False,
            },
            {
                "test_name": "Sodium",
                "reading": "139.0",
                "unit": "mEq/L",
                "reference_range": "136 - 145",
                "is_uncertain": False,
            },
            {
                "test_name": "Potassium",
                "reading": "4.35",
                "unit": "mEq/L",
                "reference_range": "3.5 - 5.1",
                "is_uncertain": False,
            },
        ],
        "get_bytes": lambda: create_synthetic_digital_pdf([REP_04_PAGE1_RENAL, REP_04_PAGE2_ELECTROLYTES]),
    },
    {
        "id": "rep_05_decimal_thyroid",
        "category": "decimals",
        "description": "Thyroid Profile with sensitive decimals and diverse units",
        "file_name": "thyroid_report.jpg",
        "ground_truth_text": "\n".join(REP_05_THYROID_LINES),
        "ground_truth_tests": [
            {
                "test_name": "Total Triiodothyronine (T3)",
                "reading": "1.15",
                "unit": "ng/mL",
                "reference_range": "0.8 - 2.0",
                "is_uncertain": False,
            },
            {
                "test_name": "Total Thyroxine (T4)",
                "reading": "8.42",
                "unit": "ug/dL",
                "reference_range": "5.1 - 14.1",
                "is_uncertain": False,
            },
            {
                "test_name": "Thyroid Stimulating Hormone (TSH)",
                "reading": "4.82",
                "unit": "uIU/mL",
                "reference_range": "0.40 - 4.20",
                "is_uncertain": False,
            },
        ],
        "get_bytes": lambda: create_synthetic_text_image(REP_05_THYROID_LINES),
    },
    {
        "id": "rep_06_explicit_ranges",
        "category": "explicit_ranges",
        "description": "Metabolic panel with explicit range delimiters",
        "file_name": "diabetes_panel.jpg",
        "ground_truth_text": "\n".join(REP_06_EXPLICIT_RANGES_LINES),
        "ground_truth_tests": [
            {
                "test_name": "Fasting Blood Glucose",
                "reading": "96",
                "unit": "mg/dL",
                "reference_range": "70 - 100 mg/dL",
                "is_uncertain": False,
            },
            {
                "test_name": "Post Prandial Glucose",
                "reading": "132",
                "unit": "mg/dL",
                "reference_range": "< 140 mg/dL",
                "is_uncertain": False,
            },
            {
                "test_name": "HbA1c (Glycated Hb)",
                "reading": "5.5",
                "unit": "%",
                "reference_range": "4.0 - 5.6 %",
                "is_uncertain": False,
            },
        ],
        "get_bytes": lambda: create_synthetic_text_image(REP_06_EXPLICIT_RANGES_LINES),
    },
    {
        "id": "rep_07_missing_illegible_values",
        "category": "missing_values",
        "description": "Report with hemolyzed/unreadable value that must NOT be hallucinated",
        "file_name": "iron_studies_hemolyzed.jpg",
        "ground_truth_text": "\n".join(REP_07_MISSING_ILLEGIBLE_LINES),
        "ground_truth_tests": [
            {
                "test_name": "Serum Iron",
                "reading": "",  # Unreadable / Hemolyzed: reading should be empty or flagged uncertain
                "unit": "",
                "reference_range": "",
                "is_uncertain": True,
            },
            {
                "test_name": "Total Iron Binding Capacity",
                "reading": "320",
                "unit": "ug/dL",
                "reference_range": "250 - 450",
                "is_uncertain": False,
            },
            {
                "test_name": "Ferritin",
                "reading": "45.0",
                "unit": "ng/mL",
                "reference_range": "30 - 400",
                "is_uncertain": False,
            },
        ],
        "get_bytes": lambda: create_synthetic_text_image(REP_07_MISSING_ILLEGIBLE_LINES),
    },
    {
        "id": "rep_08_mixed_digital_scanned",
        "category": "mixed",
        "description": "Multi-page PDF where Page 1 is selectable digital text and Page 2 is a scanned image",
        "file_name": "urinalysis_mixed.pdf",
        "ground_truth_text": "\n".join(REP_08_PAGE1_DIGITAL + REP_08_PAGE2_SCANNED),
        "ground_truth_tests": [
            {
                "test_name": "Specific Gravity",
                "reading": "1.018",
                "unit": "",
                "reference_range": "1.005 - 1.030",
                "is_uncertain": False,
            },
            {
                "test_name": "pH",
                "reading": "6.0",
                "unit": "",
                "reference_range": "4.5 - 8.0",
                "is_uncertain": False,
            },
            {
                "test_name": "Pus Cells",
                "reading": "2-3",
                "unit": "/HPF",
                "reference_range": "0 - 5",
                "is_uncertain": False,
            },
        ],
        "get_bytes": lambda: _create_mixed_sample_pdf(),
    },
]


def _create_mixed_sample_pdf() -> bytes:
    """Helper to create a mixed PDF: page 1 digital text, page 2 rasterized scan."""
    doc = pymupdf.open()
    # Page 1: Digital text
    p1 = doc.new_page(width=595, height=842)
    y = 50
    for line in REP_08_PAGE1_DIGITAL:
        p1.insert_text(pymupdf.Point(50, y), line, fontsize=11, color=(0, 0, 0))
        y += 24

    # Page 2: Scanned image
    p2 = doc.new_page(width=595, height=842)
    img_bytes = create_synthetic_text_image(REP_08_PAGE2_SCANNED)
    p2.insert_image(p2.rect, stream=img_bytes)

    buf = io.BytesIO()
    doc.save(buf)
    doc.close()
    return buf.getvalue()

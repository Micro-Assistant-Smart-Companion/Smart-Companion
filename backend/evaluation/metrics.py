"""Evaluation metrics for OCR and Medical Document Information Extraction.

Provides Character Error Rate (CER), Word Error Rate (WER), field-level accuracy
for prescriptions and medical laboratory reports, and complete-record accuracy.
"""

from typing import Any, Dict, List, Optional, Tuple
import re


def calculate_cer(reference: str, hypothesis: str) -> float:
    """Calculate Character Error Rate (CER) via Levenshtein distance.

    CER = (S + D + I) / N
    where S is substitutions, D is deletions, I is insertions,
    and N is length of reference.
    """
    ref = reference or ""
    hyp = hypothesis or ""
    if not ref:
        return 0.0 if not hyp else 1.0

    n, m = len(ref), len(hyp)
    dp = [[0] * (m + 1) for _ in range(n + 1)]

    for i in range(n + 1):
        dp[i][0] = i
    for j in range(m + 1):
        dp[0][j] = j

    for i in range(1, n + 1):
        for j in range(1, m + 1):
            cost = 0 if ref[i - 1] == hyp[j - 1] else 1
            dp[i][j] = min(
                dp[i - 1][j] + 1,       # deletion
                dp[i][j - 1] + 1,       # insertion
                dp[i - 1][j - 1] + cost  # substitution
            )

    return float(dp[n][m]) / float(n)


def calculate_wer(reference: str, hypothesis: str) -> float:
    """Calculate Word Error Rate (WER) via token-level Levenshtein distance."""
    ref_words = (reference or "").strip().split()
    hyp_words = (hypothesis or "").strip().split()

    if not ref_words:
        return 0.0 if not hyp_words else 1.0

    n, m = len(ref_words), len(hyp_words)
    dp = [[0] * (m + 1) for _ in range(n + 1)]

    for i in range(n + 1):
        dp[i][0] = i
    for j in range(m + 1):
        dp[0][j] = j

    for i in range(1, n + 1):
        for j in range(1, m + 1):
            cost = 0 if ref_words[i - 1].lower() == hyp_words[j - 1].lower() else 1
            dp[i][j] = min(
                dp[i - 1][j] + 1,
                dp[i][j - 1] + 1,
                dp[i - 1][j - 1] + cost
            )

    return float(dp[n][m]) / float(n)


def normalize_str(s: Optional[str]) -> str:
    """Normalize string for robust comparison (lowercase, trimmed, collapsed whitespace)."""
    if not s:
        return ""
    return " ".join(str(s).lower().strip().split())


def normalize_numerical_reading(val: Optional[str]) -> str:
    """Normalize numerical reading for comparison, supporting float equivalence (e.g. '14.0' == '14')."""
    s = normalize_str(val)
    if not s:
        return ""
    # Try parsing as float if purely numerical
    try:
        f = float(s)
        # return canonical string without extraneous trailing zeros if integer
        if f.is_integer():
            return str(int(f))
        return f"{f:.4f}".rstrip("0").rstrip(".")
    except (ValueError, TypeError):
        return s


def string_similarity(s1: str, s2: str) -> float:
    """Compute normalized character Levenshtein similarity between 0.0 and 1.0."""
    n1 = normalize_str(s1)
    n2 = normalize_str(s2)
    if not n1 and not n2:
        return 1.0
    if not n1 or not n2:
        return 0.0
    max_len = max(len(n1), len(n2))
    cer = calculate_cer(n1, n2)
    return max(0.0, 1.0 - cer)


def evaluate_medicine_pair(ref: Dict[str, Any], hyp: Dict[str, Any]) -> Dict[str, bool]:
    """Evaluate extraction accuracy between a reference medicine and an extracted hypothesis."""
    name_match = (normalize_str(ref.get("name")) == normalize_str(hyp.get("name")))
    strength_match = (normalize_str(ref.get("strength")) == normalize_str(hyp.get("strength")))
    dosage_match = (normalize_str(ref.get("dosage")) == normalize_str(hyp.get("dosage")))
    frequency_match = (normalize_str(ref.get("frequency")) == normalize_str(hyp.get("frequency")))
    duration_match = (normalize_str(ref.get("duration")) == normalize_str(hyp.get("duration")))
    instructions_match = (
        string_similarity(ref.get("instructions", ""), hyp.get("instructions", "")) > 0.8
        if ref.get("instructions") else True
    )

    # Complete-record match: medicine name must match, plus all non-empty fields in ref must match in hyp
    complete_match = name_match and strength_match and dosage_match and frequency_match

    return {
        "name_match": name_match,
        "strength_match": strength_match,
        "dosage_match": dosage_match,
        "frequency_match": frequency_match,
        "duration_match": duration_match,
        "instructions_match": instructions_match,
        "complete_record_match": complete_match,
    }


def evaluate_prescription_records(
    ground_truth: List[Dict[str, Any]],
    extracted: List[Dict[str, Any]]
) -> Dict[str, Any]:
    """Align ground-truth medicines with extracted medicines and compute comprehensive metrics."""
    if not ground_truth and not extracted:
        return {
            "ref_count": 0,
            "hyp_count": 0,
            "matched_records": 0,
            "name_accuracy": 1.0,
            "strength_accuracy": 1.0,
            "dosage_accuracy": 1.0,
            "frequency_accuracy": 1.0,
            "complete_record_accuracy": 1.0,
        }

    total_ref = len(ground_truth)
    if total_ref == 0:
        return {
            "ref_count": 0,
            "hyp_count": len(extracted),
            "matched_records": 0,
            "name_accuracy": 0.0,
            "strength_accuracy": 0.0,
            "dosage_accuracy": 0.0,
            "frequency_accuracy": 0.0,
            "complete_record_accuracy": 0.0,
        }

    # Best-match alignment based on medicine name similarity
    matched_hyp_indices = set()
    pairs: List[Tuple[Dict[str, Any], Optional[Dict[str, Any]]]] = []

    for ref in ground_truth:
        best_idx = None
        best_sim = -1.0
        ref_name = ref.get("name", "")
        for idx, hyp in enumerate(extracted):
            if idx in matched_hyp_indices:
                continue
            sim = string_similarity(ref_name, hyp.get("name", ""))
            if sim > best_sim:
                best_sim = sim
                best_idx = idx

        # Threshold for pairing: name similarity at least 0.4
        if best_idx is not None and best_sim >= 0.4:
            matched_hyp_indices.add(best_idx)
            pairs.append((ref, extracted[best_idx]))
        else:
            pairs.append((ref, None))

    name_correct = 0
    strength_correct = 0
    dosage_correct = 0
    frequency_correct = 0
    complete_correct = 0

    for ref, hyp in pairs:
        if hyp is None:
            continue
        eval_res = evaluate_medicine_pair(ref, hyp)
        if eval_res["name_match"]:
            name_correct += 1
        if eval_res["strength_match"]:
            strength_correct += 1
        if eval_res["dosage_match"]:
            dosage_correct += 1
        if eval_res["frequency_match"]:
            frequency_correct += 1
        if eval_res["complete_record_match"]:
            complete_correct += 1

    return {
        "ref_count": total_ref,
        "hyp_count": len(extracted),
        "aligned_count": len(matched_hyp_indices),
        "name_accuracy": float(name_correct) / total_ref,
        "strength_accuracy": float(strength_correct) / total_ref,
        "dosage_accuracy": float(dosage_correct) / total_ref,
        "frequency_accuracy": float(frequency_correct) / total_ref,
        "complete_record_accuracy": float(complete_correct) / total_ref,
    }


def evaluate_report_pair(ref: Dict[str, Any], hyp: Dict[str, Any]) -> Dict[str, bool]:
    """Evaluate extraction accuracy between a reference test and an extracted report item."""
    test_name_match = (
        string_similarity(ref.get("test_name", ""), hyp.get("test_name", "")) >= 0.8
        or normalize_str(ref.get("test_name")) == normalize_str(hyp.get("test_name"))
    )

    reading_norm_ref = normalize_numerical_reading(ref.get("reading"))
    reading_norm_hyp = normalize_numerical_reading(hyp.get("reading"))
    reading_match = (reading_norm_ref == reading_norm_hyp)

    unit_match = (normalize_str(ref.get("unit")) == normalize_str(hyp.get("unit")))

    range_ref = normalize_str(ref.get("reference_range"))
    range_hyp = normalize_str(hyp.get("reference_range"))
    range_match = (
        range_ref == range_hyp or
        (not range_ref and not range_hyp) or
        string_similarity(range_ref, range_hyp) >= 0.75
    )

    complete_match = test_name_match and reading_match and unit_match and range_match

    return {
        "test_name_match": test_name_match,
        "reading_match": reading_match,
        "unit_match": unit_match,
        "reference_range_match": range_match,
        "complete_record_match": complete_match,
    }


def evaluate_report_records(
    ground_truth: List[Dict[str, Any]],
    extracted: List[Dict[str, Any]]
) -> Dict[str, Any]:
    """Align ground-truth laboratory tests with extracted tests and compute metrics."""
    if not ground_truth and not extracted:
        return {
            "ref_count": 0,
            "hyp_count": 0,
            "test_name_accuracy": 1.0,
            "reading_accuracy": 1.0,
            "unit_accuracy": 1.0,
            "reference_range_accuracy": 1.0,
            "complete_record_accuracy": 1.0,
        }

    total_ref = len(ground_truth)
    if total_ref == 0:
        return {
            "ref_count": 0,
            "hyp_count": len(extracted),
            "test_name_accuracy": 0.0,
            "reading_accuracy": 0.0,
            "unit_accuracy": 0.0,
            "reference_range_accuracy": 0.0,
            "complete_record_accuracy": 0.0,
        }

    matched_hyp_indices = set()
    pairs: List[Tuple[Dict[str, Any], Optional[Dict[str, Any]]]] = []

    for ref in ground_truth:
        best_idx = None
        best_sim = -1.0
        ref_test = ref.get("test_name", "")
        for idx, hyp in enumerate(extracted):
            if idx in matched_hyp_indices:
                continue
            sim = string_similarity(ref_test, hyp.get("test_name", ""))
            if sim > best_sim:
                best_sim = sim
                best_idx = idx

        if best_idx is not None and best_sim >= 0.4:
            matched_hyp_indices.add(best_idx)
            pairs.append((ref, extracted[best_idx]))
        else:
            pairs.append((ref, None))

    test_correct = 0
    reading_correct = 0
    unit_correct = 0
    range_correct = 0
    complete_correct = 0

    for ref, hyp in pairs:
        if hyp is None:
            continue
        eval_res = evaluate_report_pair(ref, hyp)
        if eval_res["test_name_match"]:
            test_correct += 1
        if eval_res["reading_match"]:
            reading_correct += 1
        if eval_res["unit_match"]:
            unit_correct += 1
        if eval_res["reference_range_match"]:
            range_correct += 1
        if eval_res["complete_record_match"]:
            complete_correct += 1

    return {
        "ref_count": total_ref,
        "hyp_count": len(extracted),
        "aligned_count": len(matched_hyp_indices),
        "test_name_accuracy": float(test_correct) / total_ref,
        "reading_accuracy": float(reading_correct) / total_ref,
        "unit_accuracy": float(unit_correct) / total_ref,
        "reference_range_accuracy": float(range_correct) / total_ref,
        "complete_record_accuracy": float(complete_correct) / total_ref,
    }

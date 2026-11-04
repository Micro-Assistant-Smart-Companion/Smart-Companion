"""Centralized prompt selection and composition builder for Smart Companion.

Composes the shared base instructions (identity, communication, reliability, privacy)
with specialized domain prompts (task decomposition, general conversation, medical safety,
vision, guided search, document Q&A, and prescription extraction).
"""

from typing import Any, Dict, Optional

from .base import BASE_SYSTEM_PROMPT
from .task import TASK_SYSTEM_PROMPT
from .general import GENERAL_SYSTEM_PROMPT
from .medical import MEDICAL_SYSTEM_PROMPT
from .vision import VISION_SYSTEM_PROMPT
from .guided_search import GUIDED_SEARCH_SYSTEM_PROMPT
from .document import (
    DOCUMENT_QA_SYSTEM_PROMPT,
    PRESCRIPTION_SYSTEM_PROMPT,
    SCANNED_PAGE_OCR_RULES,
)
from .routing import ROUTING_RULES

PROMPT_VERSION = "1.0.0"

SUPPORTED_MODES = {
    "task": TASK_SYSTEM_PROMPT,
    "general": GENERAL_SYSTEM_PROMPT,
    "medical": MEDICAL_SYSTEM_PROMPT,
    "vision": VISION_SYSTEM_PROMPT,
    "guided_search": GUIDED_SEARCH_SYSTEM_PROMPT,
    "document": DOCUMENT_QA_SYSTEM_PROMPT,
    "scanned_page": SCANNED_PAGE_OCR_RULES,
    "prescription": PRESCRIPTION_SYSTEM_PROMPT,
    "routing": ROUTING_RULES,
}

LANG_NAMES = {
    "hi": "Hindi (in Devanagari script)",
    "bn": "Bengali (in Bengali script)",
}


def _format_language_constraint(language: Optional[str]) -> str:
    """Format language output instruction for Hindi or Bengali if specified."""
    name = LANG_NAMES.get((language or "").strip().lower())
    if not name:
        return ""
    return (
        f'LANGUAGE REQUIREMENT:\n'
        f'Write all text responses in simple, everyday {name}, the way a supportive friend speaks.\n'
        f'Keep all JSON keys and boolean true/false values in English. '
        f'Do not include untranslated English sentences, except for common loan words (e.g. "BP", "Wi-Fi").\n\n'
    )


def build_system_prompt(mode: str, context: Optional[Dict[str, Any]] = None) -> str:
    """Build a consolidated system prompt for the specified application mode.

    Args:
        mode: The operational domain (task, general, medical, vision, guided_search, document, prescription, routing).
        context: Optional dictionary containing verified, authorized context parameters:
                 - reading_level: e.g. "simple" or "intermediate"
                 - tone: e.g. "encouraging" or "calm"
                 - language: "en", "hi", or "bn"
                 - session_note: topic-specific constraint from intent router
                 - health_context: sanitized health log context (treated as untrusted background)

    Returns:
        A complete, structured system prompt string.
    """
    normalized_mode = (mode or "").strip().lower()
    specialized_prompt = SUPPORTED_MODES.get(normalized_mode)

    # Safe fallback if an unknown mode is provided
    if specialized_prompt is None:
        specialized_prompt = GENERAL_SYSTEM_PROMPT

    sections = [BASE_SYSTEM_PROMPT, specialized_prompt]

    if context:
        # 1. Language instruction
        lang_block = _format_language_constraint(context.get("language"))
        if lang_block:
            sections.append(lang_block)

        # 2. Tone and reading level preferences
        style_parts = []
        if context.get("reading_level"):
            style_parts.append(f"Reading level: {context['reading_level']}")
        if context.get("tone"):
            style_parts.append(f"Tone: {context['tone']}")
        if style_parts:
            sections.append("USER PREFERENCES:\n" + ", ".join(style_parts) + ".")

        # 3. Authorized session constraint note from topic router
        session_note = context.get("session_note")
        if session_note and isinstance(session_note, str) and session_note.strip():
            sections.append(f"SESSION CONSTRAINT:\n{session_note.strip()}")

        # 4. Optional health context (safely bounded & labeled as untrusted background only)
        health_ctx = context.get("health_context")
        if health_ctx and isinstance(health_ctx, str) and health_ctx.strip():
            # Cap to 600 characters to respect context limits and protect against prompt injection
            safe_health = health_ctx.strip()[:600]
            sections.append(
                "USER HEALTH RECORD (FOR BACKGROUND ONLY - DO NOT DIAGNOSE OR PRESCRIBE):\n"
                f'"{safe_health}"'
            )

    return "\n\n".join(sections)


def get_prompt_metadata(mode: str) -> Dict[str, Any]:
    """Return diagnostic metadata about the prompt configuration without leaking user secrets."""
    normalized_mode = (mode or "").strip().lower()
    is_supported = normalized_mode in SUPPORTED_MODES
    effective_mode = normalized_mode if is_supported else "general (fallback)"
    return {
        "version": PROMPT_VERSION,
        "requested_mode": mode,
        "effective_mode": effective_mode,
        "is_supported": is_supported,
        "includes_base": True,
    }

"""Helpers for building bilingual (ES/EN) Playwright selectors."""

from __future__ import annotations


def bilingual_selector(
    labels_es: list[str],
    labels_en: list[str],
    tags: list[str] | None = None,
) -> str:
    """Build a Playwright CSS selector matching any of the given labels.

    Each label is wrapped in ``tag:has-text('label')`` for every tag in
    *tags*.  When *tags* is ``None`` both ``a`` and ``button`` are used.

    >>> bilingual_selector(["Descargar"], ["Download"], tags=["a", "button"])
    "a:has-text('Descargar'), button:has-text('Descargar'), a:has-text('Download'), button:has-text('Download')"
    """
    if tags is None:
        tags = ["a", "button"]
    parts: list[str] = []
    for label in [*labels_es, *labels_en]:
        for tag in tags:
            parts.append(f"{tag}:has-text('{label}')")
    return ", ".join(parts)

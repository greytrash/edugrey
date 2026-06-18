"""Utilidades para parsear fechas en español e inglés."""

from __future__ import annotations

import argparse
import re
import unicodedata
from datetime import datetime


MESES = {
    "ene": 1,
    "feb": 2,
    "mar": 3,
    "abr": 4,
    "may": 5,
    "jun": 6,
    "jul": 7,
    "ago": 8,
    "sept": 9,
    "sep": 9,
    "oct": 10,
    "nov": 11,
    "dic": 12,
    "jan": 1,
    "apr": 4,
    "aug": 8,
    "dec": 12,
}


def strip_accents(text: str) -> str:
    """Remove diacritical marks (accents) from a string."""
    nfkd = unicodedata.normalize("NFKD", text)
    return "".join(ch for ch in nfkd if not unicodedata.combining(ch))


def parse_fecha(txt: str) -> datetime | None:
    """Parsea fechas en español o inglés en formatos abreviados.

    Acepta formatos como "2 jul 2025", "25 sept 2025", "3 Jan 2025".
    """
    match = re.search(
        r"(\d{1,2})\s+([A-Za-záéíóúñ]+)\s+(\d{4})", txt, re.IGNORECASE
    )
    if not match:
        return None

    day = int(match.group(1))
    month_name = strip_accents(match.group(2).lower())
    year = int(match.group(3))

    month = MESES.get(month_name[:4]) or MESES.get(month_name[:3])
    if not month:
        return None

    return datetime(year, month, day)


def parse_date_argument(value: str) -> datetime:
    """Valida y convierte un argumento CLI con formato YYYY-MM-DD."""
    try:
        return datetime.strptime(value, "%Y-%m-%d")
    except ValueError as error:
        raise argparse.ArgumentTypeError(
            "Usa el formato YYYY-MM-DD, por ejemplo 2025-07-02"
        ) from error

"""Automatización para descargar facturas de Midjourney desde Stripe.

El script abre el portal de facturación, identifica las filas que contienen
facturas dentro de un rango de fechas y descarga los PDF a la carpeta
destino indicada.
"""

from __future__ import annotations

import argparse
import os
import re
import sys
import time
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Iterable

from playwright.sync_api import Page, sync_playwright


# ---------- Utilidades de fechas -------------------------------------------------

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


def parse_fecha(txt: str) -> datetime | None:
    """Parsea fechas en español o inglés en formatos abreviados."""
    match = re.search(r"(\d{1,2})\s+([A-Za-záéíóúñ]+)\s+(\d{4})", txt, re.IGNORECASE)
    if not match:
        return None

    day = int(match.group(1))
    month_name = match.group(2).lower()
    year = int(match.group(3))

    normalized_month = (
        month_name.replace("é", "e")
        .replace("á", "a")
        .replace("í", "i")
        .replace("ó", "o")
        .replace("ú", "u")
    )

    month = MESES.get(normalized_month[:4]) or MESES.get(normalized_month[:3])
    if not month:
        return None

    return datetime(year, month, day)


def parse_date_argument(value: str) -> datetime:
    try:
        return datetime.strptime(value, "%Y-%m-%d")
    except ValueError as error:  # pragma: no cover - validación de entrada CLI
        raise argparse.ArgumentTypeError(
            "Usa el formato YYYY-MM-DD, por ejemplo 2025-07-02"
        ) from error


# ---------- Lógica principal -----------------------------------------------------


@dataclass
class ObjetivoDescarga:
    fecha: datetime
    enlace: object  # Locator de Playwright


KEYWORDS_DEFAULT = (
    "Fast Hour",
    "Credits",
    "Midjourney",
    "Pagada",
    "Paid",
)


def filas_objetivo(
    page: Page,
    fecha_min: datetime,
    fecha_max: datetime,
    keywords: Iterable[str],
) -> list[ObjetivoDescarga]:
    rows = page.locator("table tr, [role='row']")
    total_rows = rows.count()
    print(f"Detectadas {total_rows} filas; filtrando por fecha...")

    objetivos: list[ObjetivoDescarga] = []
    for i in range(total_rows):
        row = rows.nth(i)
        text = row.inner_text()
        fecha = parse_fecha(text or "")
        if not fecha or not (fecha_min <= fecha <= fecha_max):
            continue

        if not any(keyword in text for keyword in keywords):
            continue

        link = row.locator(
            "a:has-text('Ver datos'), a:has-text('Ver detalles'), a:has-text('View'), a:has-text('Invoice')"
        )
        if link.count() == 0:
            link = row.locator("a")
        if link.count() > 0:
            objetivos.append(ObjetivoDescarga(fecha=fecha, enlace=link.first))
            print(f"✓ Seleccionada fila {i} → {fecha.strftime('%Y-%m-%d')}")

    return objetivos


def descargar_facturas(
    page: Page,
    objetivos: Iterable[ObjetivoDescarga],
    carpeta_destino: Path,
    esperar_descarga: float,
    sobrescribir: bool,
):
    carpeta_destino.mkdir(parents=True, exist_ok=True)

    for objetivo in objetivos:
        with page.expect_popup() as pop_info:
            objetivo.enlace.click()
        factura_page = pop_info.value
        factura_page.wait_for_load_state("domcontentloaded")
        time.sleep(esperar_descarga)

        boton = factura_page.locator(
            "a:has-text('Descargar factura'), button:has-text('Descargar factura'), "
            "a:has-text('Download invoice'), button:has-text('Download invoice')"
        )
        if boton.count() == 0:
            print(
                f"⚠️ No veo el botón de descarga en {objetivo.fecha:%Y-%m-%d}. Descárgala manualmente."
            )
            factura_page.close()
            continue

        destino = carpeta_destino / f"Midjourney_{objetivo.fecha:%Y-%m-%d}.pdf"
        if destino.exists() and not sobrescribir:
            print(f"➡️ Ya existe {destino}. Saltando descarga.")
            factura_page.close()
            continue

        with factura_page.expect_download() as download_info:
            boton.first.click()
        descarga = download_info.value
        descarga.save_as(destino)
        print(f"⬇️ Guardado: {destino}")

        factura_page.close()


def parse_arguments(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--desde",
        type=parse_date_argument,
        default=datetime(2025, 7, 2),
        help="Fecha inicial (inclusive) en formato YYYY-MM-DD. Por defecto 2025-07-02",
    )
    parser.add_argument(
        "--hasta",
        type=parse_date_argument,
        default=datetime(2025, 9, 25),
        help="Fecha final (inclusive) en formato YYYY-MM-DD. Por defecto 2025-09-25",
    )
    parser.add_argument(
        "--destino",
        type=Path,
        default=Path.home() / "Downloads" / "Midjourney" / "2025Q3",
        help="Carpeta donde guardar las facturas (se crea si no existe).",
    )
    parser.add_argument(
        "--persistencia",
        type=Path,
        default=Path("mj_profile"),
        help="Directorio de perfil persistente para Chromium.",
    )
    parser.add_argument(
        "--headless",
        action="store_true",
        help="Ejecuta Chromium en modo headless (requiere sesión guardada previamente).",
    )
    parser.add_argument(
        "--espera",
        type=float,
        default=1.0,
        help="Tiempo extra (segundos) tras abrir cada factura antes de buscar el botón.",
    )
    parser.add_argument(
        "--sobrescribir",
        action="store_true",
        help="Sobrescribe PDFs existentes en lugar de omitirlos.",
    )
    parser.add_argument(
        "--url",
        default="https://billing.midjourney.com/",
        help="URL de la página de facturación.",
    )
    parser.add_argument(
        "--keywords",
        nargs="*",
        default=list(KEYWORDS_DEFAULT),
        help="Palabras clave para identificar las filas de facturas.",
    )
    return parser.parse_args(argv)


def main(argv: list[str]) -> int:
    args = parse_arguments(argv)
    if args.desde > args.hasta:
        print("La fecha inicial debe ser anterior o igual a la final.")
        return 1

    print(
        "Abriré Chromium con perfil persistente para que puedas iniciar sesión si es necesario."
    )

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch_persistent_context(
            user_data_dir=str(args.persistencia), headless=args.headless
        )
        page = browser.new_page()
        page.goto(args.url, wait_until="domcontentloaded")

        print(
            "\n💡 Inicia sesión si te lo pide y navega a la lista de pagos/facturas de Stripe."
        )
        input(
            "➡️  Cuando VEAS la lista de cargos/facturas, pulsa ENTER aquí y el script continuará...\n"
        )

        objetivos = filas_objetivo(
            page=page,
            fecha_min=args.desde,
            fecha_max=args.hasta,
            keywords=args.keywords,
        )
        if not objetivos:
            print(
                "⚠️ No he encontrado filas dentro del rango. ¿Seguro que estás en la lista de facturas/cargos?"
            )
            browser.close()
            return 1

        descargar_facturas(
            page=page,
            objetivos=objetivos,
            carpeta_destino=args.destino,
            esperar_descarga=args.espera,
            sobrescribir=args.sobrescribir,
        )

        browser.close()

    print("\n✅ Listo. Revisa la carpeta:", args.destino)
    return 0


if __name__ == "__main__":  # pragma: no cover - punto de entrada CLI
    sys.exit(main(sys.argv[1:]))

"""Automatización para descargar facturas de Midjourney desde Stripe.

El script abre el portal de facturación, identifica las filas que contienen
facturas dentro de un rango de fechas y descarga los PDF a la carpeta
destino indicada.
"""

from __future__ import annotations

import argparse
import sys
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Iterable

from playwright.sync_api import Page, sync_playwright

from utils.browser import download_file, open_popup
from utils.dates import parse_date_argument, parse_fecha
from utils.i18n import bilingual_selector


# ---------- Selectores bilingües -------------------------------------------------

SELECTOR_VER_FACTURA = bilingual_selector(
    labels_es=["Ver datos", "Ver detalles"],
    labels_en=["View", "Invoice"],
    tags=["a"],
)

SELECTOR_DESCARGAR = bilingual_selector(
    labels_es=["Descargar factura"],
    labels_en=["Download invoice"],
)


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

        link = row.locator(SELECTOR_VER_FACTURA)
        if link.count() == 0:
            link = row.locator("a")
        if link.count() > 0:
            objetivos.append(ObjetivoDescarga(fecha=fecha, enlace=link.first))
            print(f"  Seleccionada fila {i} -> {fecha.strftime('%Y-%m-%d')}")

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
        with open_popup(page, objetivo.enlace, wait_seconds=esperar_descarga) as factura_page:
            boton = factura_page.locator(SELECTOR_DESCARGAR)
            if boton.count() == 0:
                print(
                    f"  No veo el boton de descarga en {objetivo.fecha:%Y-%m-%d}. "
                    "Descargala manualmente."
                )
                continue

            destino = carpeta_destino / f"Midjourney_{objetivo.fecha:%Y-%m-%d}.pdf"
            if destino.exists() and not sobrescribir:
                print(f"  Ya existe {destino}. Saltando descarga.")
                continue

            download_file(factura_page, boton.first, destino)
            print(f"  Guardado: {destino}")


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
        help="Ejecuta Chromium en modo headless (requiere sesion guardada previamente).",
    )
    parser.add_argument(
        "--espera",
        type=float,
        default=1.0,
        help="Tiempo extra (segundos) tras abrir cada factura antes de buscar el boton.",
    )
    parser.add_argument(
        "--sobrescribir",
        action="store_true",
        help="Sobrescribe PDFs existentes en lugar de omitirlos.",
    )
    parser.add_argument(
        "--url",
        default="https://billing.midjourney.com/",
        help="URL de la pagina de facturacion.",
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
        "Abrire Chromium con perfil persistente para que puedas iniciar sesion si es necesario."
    )

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch_persistent_context(
            user_data_dir=str(args.persistencia), headless=args.headless
        )
        page = browser.new_page()
        page.goto(args.url, wait_until="domcontentloaded")

        print(
            "\nInicia sesion si te lo pide y navega a la lista de pagos/facturas de Stripe."
        )
        input(
            "  Cuando VEAS la lista de cargos/facturas, pulsa ENTER aqui y el script continuara...\n"
        )

        objetivos = filas_objetivo(
            page=page,
            fecha_min=args.desde,
            fecha_max=args.hasta,
            keywords=args.keywords,
        )
        if not objetivos:
            print(
                "No he encontrado filas dentro del rango. Seguro que estas en la lista de facturas/cargos?"
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

    print("\nListo. Revisa la carpeta:", args.destino)
    return 0


if __name__ == "__main__":  # pragma: no cover
    sys.exit(main(sys.argv[1:]))

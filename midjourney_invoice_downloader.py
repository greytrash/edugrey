import os
import re
import time
from datetime import datetime

from playwright.sync_api import sync_playwright

# Configura tu rango
FECHA_MIN = datetime(2025, 7, 2)   # inclusive
FECHA_MAX = datetime(2025, 9, 25)  # inclusive
CARPETA = os.path.expanduser("~/Downloads/Midjourney/2025Q3")
os.makedirs(CARPETA, exist_ok=True)


def parse_fecha(txt: str) -> datetime | None:
    """Parsea fechas en español o inglés en formatos abreviados."""
    # Acepta "2 jul 2025", "25 sept 2025" o formatos en inglés
    meses = {
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

    month = meses.get(normalized_month[:4]) or meses.get(normalized_month[:3])
    if not month:
        return None

    return datetime(year, month, day)


with sync_playwright() as playwright:
    # Perfil persistente para que puedas iniciar sesión y se recuerde
    browser = playwright.chromium.launch_persistent_context(
        user_data_dir="mj_profile", headless=False
    )
    page = browser.new_page()
    # Abre el portal de facturación (ajusta si usas otro enlace)
    page.goto("https://billing.midjourney.com/", wait_until="domcontentloaded")

    print(
        "\n💡 Inicia sesión si te lo pide y navega a la lista de pagos/facturas de Stripe."
    )
    input(
        "➡️  Cuando VEAS la lista de cargos/facturas, pulsa ENTER aquí y el script continuará...\n"
    )

    # Busca filas de histórico (Stripe suele renderizar una lista con fechas/importe/estado)
    rows = page.locator("table tr, [role='row']")
    total_rows = rows.count()
    print(f"Detectadas {total_rows} filas; filtrando por fecha...")

    objetivos: list[tuple[datetime, object]] = []
    for i in range(total_rows):
        row = rows.nth(i)
        text = row.inner_text()
        fecha = parse_fecha(text or "")
        if not fecha:
            continue
        if FECHA_MIN <= fecha <= FECHA_MAX and (
            "Fast Hour" in text
            or "Credits" in text
            or "Midjourney" in text
            or "Pagada" in text
            or "Paid" in text
        ):
            # intenta abrir detalles de la factura en esa fila
            link = row.locator(
                "a:has-text('Ver datos'), a:has-text('Ver detalles'), a:has-text('View'), a:has-text('Invoice')"
            )
            if link.count() == 0:
                # fallback: cualquier enlace en la fila
                link = row.locator("a")
            if link.count() > 0:
                objetivos.append((fecha, link.first))
                print(f"✓ Seleccionada fila {i} → {fecha.strftime('%Y-%m-%d')}")

    if not objetivos:
        print(
            "⚠️ No he encontrado filas dentro del rango. ¿Seguro que estás en la lista de facturas/cargos?"
        )
        browser.close()
        raise SystemExit

    for fecha, enlace in objetivos:
        with page.expect_popup() as pop_info:
            enlace.click()
        factura_page = pop_info.value
        factura_page.wait_for_load_state("domcontentloaded")
        time.sleep(1.0)

        # Clic en "Descargar factura" (ES/EN)
        button = factura_page.locator(
            "a:has-text('Descargar factura'), button:has-text('Descargar factura'), a:has-text('Download invoice'), button:has-text('Download invoice')"
        )
        if button.count() == 0:
            print(f"⚠️ No veo el botón en {fecha}. Ábrela y descárgala manualmente.")
            continue

        # Escucha la descarga
        with factura_page.expect_download() as download_info:
            button.first.click()
        download = download_info.value

        filename = f"Midjourney_{fecha.strftime('%Y-%m-%d')}.pdf"
        destination = os.path.join(CARPETA, filename)
        download.save_as(destination)
        print(f"⬇️ Guardado: {destination}")

        factura_page.close()

    print("\n✅ Listo. Revisa la carpeta:", CARPETA)
    browser.close()

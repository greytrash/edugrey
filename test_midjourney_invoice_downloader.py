"""Unit tests for midjourney_invoice_downloader.py.

Covers:
- parse_fecha: date parsing from Spanish/English text
- parse_date_argument: CLI date argument validation
- parse_arguments: argparse defaults and overrides
- filas_objetivo: row filtering logic (Playwright mocked)
- descargar_facturas: download logic (Playwright mocked)
- main: integration (Playwright mocked)
"""

from __future__ import annotations

import argparse
from datetime import datetime
from pathlib import Path
from unittest.mock import MagicMock, call, patch

import pytest

from midjourney_invoice_downloader import (
    KEYWORDS_DEFAULT,
    ObjetivoDescarga,
    descargar_facturas,
    filas_objetivo,
    main,
    parse_arguments,
    parse_date_argument,
    parse_fecha,
)


# ── parse_fecha ──────────────────────────────────────────────────────────────


class TestParseFecha:
    """Tests for the date-parsing helper."""

    @pytest.mark.parametrize(
        "text, expected",
        [
            ("12 ene 2025", datetime(2025, 1, 12)),
            ("1 feb 2024", datetime(2024, 2, 1)),
            ("28 mar 2023", datetime(2023, 3, 28)),
            ("5 abr 2025", datetime(2025, 4, 5)),
            ("15 may 2025", datetime(2025, 5, 15)),
            ("30 jun 2025", datetime(2025, 6, 30)),
            ("4 jul 2025", datetime(2025, 7, 4)),
            ("10 ago 2025", datetime(2025, 8, 10)),
            ("22 sept 2025", datetime(2025, 9, 22)),
            ("22 sep 2025", datetime(2025, 9, 22)),
            ("3 oct 2025", datetime(2025, 10, 3)),
            ("11 nov 2025", datetime(2025, 11, 11)),
            ("25 dic 2025", datetime(2025, 12, 25)),
        ],
        ids=[
            "ene", "feb", "mar", "abr", "may", "jun",
            "jul", "ago", "sept", "sep", "oct", "nov", "dic",
        ],
    )
    def test_spanish_months(self, text: str, expected: datetime) -> None:
        assert parse_fecha(text) == expected

    @pytest.mark.parametrize(
        "text, expected",
        [
            ("12 Jan 2025", datetime(2025, 1, 12)),
            ("1 Feb 2024", datetime(2024, 2, 1)),
            ("5 Apr 2025", datetime(2025, 4, 5)),
            ("10 Aug 2025", datetime(2025, 8, 10)),
            ("25 Dec 2025", datetime(2025, 12, 25)),
        ],
        ids=["jan", "feb", "apr", "aug", "dec"],
    )
    def test_english_months(self, text: str, expected: datetime) -> None:
        assert parse_fecha(text) == expected

    def test_date_embedded_in_longer_text(self) -> None:
        text = "Invoice #123 — 15 jun 2025 — Midjourney Fast Hour"
        assert parse_fecha(text) == datetime(2025, 6, 15)

    def test_returns_none_for_no_match(self) -> None:
        assert parse_fecha("no date here") is None

    def test_returns_none_for_unknown_month(self) -> None:
        assert parse_fecha("12 xyz 2025") is None

    def test_case_insensitive(self) -> None:
        assert parse_fecha("12 ENE 2025") == datetime(2025, 1, 12)
        assert parse_fecha("12 Ene 2025") == datetime(2025, 1, 12)

    def test_accented_month(self) -> None:
        # "é" in month names should be normalized
        assert parse_fecha("5 sépt 2025") == datetime(2025, 9, 5)

    def test_empty_string(self) -> None:
        assert parse_fecha("") is None


# ── parse_date_argument ──────────────────────────────────────────────────────


class TestParseDateArgument:
    def test_valid_date(self) -> None:
        assert parse_date_argument("2025-07-02") == datetime(2025, 7, 2)

    def test_invalid_format_raises(self) -> None:
        with pytest.raises(argparse.ArgumentTypeError, match="YYYY-MM-DD"):
            parse_date_argument("02-07-2025")

    def test_garbage_raises(self) -> None:
        with pytest.raises(argparse.ArgumentTypeError):
            parse_date_argument("not-a-date")


# ── parse_arguments ──────────────────────────────────────────────────────────


class TestParseArguments:
    def test_defaults(self) -> None:
        args = parse_arguments([])
        assert args.desde == datetime(2025, 7, 2)
        assert args.hasta == datetime(2025, 9, 25)
        assert args.destino == Path.home() / "Downloads" / "Midjourney" / "2025Q3"
        assert args.persistencia == Path("mj_profile")
        assert args.headless is False
        assert args.espera == 1.0
        assert args.sobrescribir is False
        assert args.url == "https://billing.midjourney.com/"
        assert args.keywords == list(KEYWORDS_DEFAULT)

    def test_custom_dates(self) -> None:
        args = parse_arguments(["--desde", "2024-01-01", "--hasta", "2024-12-31"])
        assert args.desde == datetime(2024, 1, 1)
        assert args.hasta == datetime(2024, 12, 31)

    def test_custom_destino(self) -> None:
        args = parse_arguments(["--destino", "/tmp/invoices"])
        assert args.destino == Path("/tmp/invoices")

    def test_headless_flag(self) -> None:
        args = parse_arguments(["--headless"])
        assert args.headless is True

    def test_sobrescribir_flag(self) -> None:
        args = parse_arguments(["--sobrescribir"])
        assert args.sobrescribir is True

    def test_custom_espera(self) -> None:
        args = parse_arguments(["--espera", "3.5"])
        assert args.espera == 3.5

    def test_custom_keywords(self) -> None:
        args = parse_arguments(["--keywords", "Foo", "Bar"])
        assert args.keywords == ["Foo", "Bar"]

    def test_custom_url(self) -> None:
        args = parse_arguments(["--url", "https://example.com"])
        assert args.url == "https://example.com"


# ── filas_objetivo ───────────────────────────────────────────────────────────


def _make_row(text: str, *, has_link: bool = True) -> MagicMock:
    """Create a mock Playwright row locator."""
    row = MagicMock()
    row.inner_text.return_value = text
    link = MagicMock()
    if has_link:
        link.count.return_value = 1
        link.first = MagicMock()
    else:
        link.count.return_value = 0
    row.locator.return_value = link
    return row


def _make_page(rows: list[MagicMock]) -> MagicMock:
    page = MagicMock()
    rows_locator = MagicMock()
    rows_locator.count.return_value = len(rows)
    rows_locator.nth.side_effect = lambda i: rows[i]
    page.locator.return_value = rows_locator
    return page


class TestFilasObjetivo:
    def test_selects_matching_rows(self) -> None:
        row1 = _make_row("10 jul 2025 — Fast Hour — $10.00")
        row2 = _make_row("15 ago 2025 — Credits — $20.00")
        row3 = _make_row("20 oct 2025 — Fast Hour — $10.00")  # outside range
        page = _make_page([row1, row2, row3])

        results = filas_objetivo(
            page,
            fecha_min=datetime(2025, 7, 1),
            fecha_max=datetime(2025, 9, 30),
            keywords=KEYWORDS_DEFAULT,
        )
        assert len(results) == 2
        assert results[0].fecha == datetime(2025, 7, 10)
        assert results[1].fecha == datetime(2025, 8, 15)

    def test_skips_rows_without_date(self) -> None:
        row = _make_row("No date here — Fast Hour")
        page = _make_page([row])

        results = filas_objetivo(
            page,
            fecha_min=datetime(2025, 1, 1),
            fecha_max=datetime(2025, 12, 31),
            keywords=KEYWORDS_DEFAULT,
        )
        assert results == []

    def test_skips_rows_without_keyword(self) -> None:
        row = _make_row("10 jul 2025 — Unrelated Service — $5.00")
        page = _make_page([row])

        results = filas_objetivo(
            page,
            fecha_min=datetime(2025, 1, 1),
            fecha_max=datetime(2025, 12, 31),
            keywords=KEYWORDS_DEFAULT,
        )
        assert results == []

    def test_skips_row_without_link(self) -> None:
        row = _make_row("10 jul 2025 — Fast Hour — $10.00", has_link=False)
        # When the specific link locator finds 0, it falls back to "a";
        # simulate the fallback also finding 0.
        fallback_link = MagicMock()
        fallback_link.count.return_value = 0

        def locator_side_effect(selector: str) -> MagicMock:
            if "Ver datos" in selector:
                first_link = MagicMock()
                first_link.count.return_value = 0
                return first_link
            return fallback_link

        row.locator.side_effect = locator_side_effect
        page = _make_page([row])

        results = filas_objetivo(
            page,
            fecha_min=datetime(2025, 1, 1),
            fecha_max=datetime(2025, 12, 31),
            keywords=KEYWORDS_DEFAULT,
        )
        assert results == []

    def test_empty_table(self) -> None:
        page = _make_page([])

        results = filas_objetivo(
            page,
            fecha_min=datetime(2025, 1, 1),
            fecha_max=datetime(2025, 12, 31),
            keywords=KEYWORDS_DEFAULT,
        )
        assert results == []

    def test_fecha_min_boundary(self) -> None:
        row = _make_row("1 jul 2025 — Midjourney — $10.00")
        page = _make_page([row])

        results = filas_objetivo(
            page,
            fecha_min=datetime(2025, 7, 1),
            fecha_max=datetime(2025, 12, 31),
            keywords=KEYWORDS_DEFAULT,
        )
        assert len(results) == 1
        assert results[0].fecha == datetime(2025, 7, 1)

    def test_fecha_max_boundary(self) -> None:
        row = _make_row("25 sep 2025 — Midjourney — $10.00")
        page = _make_page([row])

        results = filas_objetivo(
            page,
            fecha_min=datetime(2025, 1, 1),
            fecha_max=datetime(2025, 9, 25),
            keywords=KEYWORDS_DEFAULT,
        )
        assert len(results) == 1
        assert results[0].fecha == datetime(2025, 9, 25)

    def test_custom_keywords(self) -> None:
        row = _make_row("10 jul 2025 — MyCustomService — $99.00")
        page = _make_page([row])

        results = filas_objetivo(
            page,
            fecha_min=datetime(2025, 1, 1),
            fecha_max=datetime(2025, 12, 31),
            keywords=["MyCustomService"],
        )
        assert len(results) == 1


# ── descargar_facturas ───────────────────────────────────────────────────────


class TestDescargarFacturas:
    def _make_factura_page(
        self, *, has_button: bool = True
    ) -> tuple[MagicMock, MagicMock]:
        factura_page = MagicMock()
        boton = MagicMock()
        boton.count.return_value = 1 if has_button else 0
        boton.first = MagicMock()
        factura_page.locator.return_value = boton

        download_mock = MagicMock()
        download_ctx = MagicMock()
        download_ctx.__enter__ = MagicMock(return_value=download_mock)
        download_ctx.__exit__ = MagicMock(return_value=False)
        download_mock.value = MagicMock()
        factura_page.expect_download.return_value = download_ctx

        return factura_page, download_mock.value

    def test_downloads_invoice(self, tmp_path: Path) -> None:
        factura_page, descarga = self._make_factura_page()
        page = MagicMock()
        popup_ctx = MagicMock()
        popup_ctx.__enter__ = MagicMock(return_value=popup_ctx)
        popup_ctx.__exit__ = MagicMock(return_value=False)
        popup_ctx.value = factura_page
        page.expect_popup.return_value = popup_ctx

        obj = ObjetivoDescarga(
            fecha=datetime(2025, 7, 10),
            enlace=MagicMock(),
        )

        descargar_facturas(
            page=page,
            objetivos=[obj],
            carpeta_destino=tmp_path / "invoices",
            esperar_descarga=0,
            sobrescribir=False,
        )

        expected_path = tmp_path / "invoices" / "Midjourney_2025-07-10.pdf"
        descarga.save_as.assert_called_once_with(expected_path)
        factura_page.close.assert_called_once()

    def test_skips_when_no_download_button(self, tmp_path: Path) -> None:
        factura_page, _ = self._make_factura_page(has_button=False)
        page = MagicMock()
        popup_ctx = MagicMock()
        popup_ctx.__enter__ = MagicMock(return_value=popup_ctx)
        popup_ctx.__exit__ = MagicMock(return_value=False)
        popup_ctx.value = factura_page
        page.expect_popup.return_value = popup_ctx

        obj = ObjetivoDescarga(
            fecha=datetime(2025, 7, 10),
            enlace=MagicMock(),
        )

        descargar_facturas(
            page=page,
            objetivos=[obj],
            carpeta_destino=tmp_path / "invoices",
            esperar_descarga=0,
            sobrescribir=False,
        )

        factura_page.close.assert_called_once()
        factura_page.expect_download.assert_not_called()

    def test_skips_existing_file_without_overwrite(self, tmp_path: Path) -> None:
        dest = tmp_path / "invoices"
        dest.mkdir()
        existing = dest / "Midjourney_2025-07-10.pdf"
        existing.write_text("existing")

        factura_page, _ = self._make_factura_page()
        page = MagicMock()
        popup_ctx = MagicMock()
        popup_ctx.__enter__ = MagicMock(return_value=popup_ctx)
        popup_ctx.__exit__ = MagicMock(return_value=False)
        popup_ctx.value = factura_page
        page.expect_popup.return_value = popup_ctx

        obj = ObjetivoDescarga(
            fecha=datetime(2025, 7, 10),
            enlace=MagicMock(),
        )

        descargar_facturas(
            page=page,
            objetivos=[obj],
            carpeta_destino=dest,
            esperar_descarga=0,
            sobrescribir=False,
        )

        factura_page.close.assert_called_once()
        factura_page.expect_download.assert_not_called()

    def test_overwrites_existing_file_when_flag_set(self, tmp_path: Path) -> None:
        dest = tmp_path / "invoices"
        dest.mkdir()
        existing = dest / "Midjourney_2025-07-10.pdf"
        existing.write_text("existing")

        factura_page, descarga = self._make_factura_page()
        page = MagicMock()
        popup_ctx = MagicMock()
        popup_ctx.__enter__ = MagicMock(return_value=popup_ctx)
        popup_ctx.__exit__ = MagicMock(return_value=False)
        popup_ctx.value = factura_page
        page.expect_popup.return_value = popup_ctx

        obj = ObjetivoDescarga(
            fecha=datetime(2025, 7, 10),
            enlace=MagicMock(),
        )

        descargar_facturas(
            page=page,
            objetivos=[obj],
            carpeta_destino=dest,
            esperar_descarga=0,
            sobrescribir=True,
        )

        descarga.save_as.assert_called_once_with(existing)

    def test_creates_destination_directory(self, tmp_path: Path) -> None:
        dest = tmp_path / "deeply" / "nested" / "dir"
        factura_page, descarga = self._make_factura_page()
        page = MagicMock()
        popup_ctx = MagicMock()
        popup_ctx.__enter__ = MagicMock(return_value=popup_ctx)
        popup_ctx.__exit__ = MagicMock(return_value=False)
        popup_ctx.value = factura_page
        page.expect_popup.return_value = popup_ctx

        obj = ObjetivoDescarga(
            fecha=datetime(2025, 7, 10),
            enlace=MagicMock(),
        )

        descargar_facturas(
            page=page,
            objetivos=[obj],
            carpeta_destino=dest,
            esperar_descarga=0,
            sobrescribir=False,
        )

        assert dest.exists()

    def test_handles_multiple_objectives(self, tmp_path: Path) -> None:
        dest = tmp_path / "invoices"

        factura_page1, descarga1 = self._make_factura_page()
        factura_page2, descarga2 = self._make_factura_page()

        page = MagicMock()
        popup_ctx1 = MagicMock()
        popup_ctx1.__enter__ = MagicMock(return_value=popup_ctx1)
        popup_ctx1.__exit__ = MagicMock(return_value=False)
        popup_ctx1.value = factura_page1

        popup_ctx2 = MagicMock()
        popup_ctx2.__enter__ = MagicMock(return_value=popup_ctx2)
        popup_ctx2.__exit__ = MagicMock(return_value=False)
        popup_ctx2.value = factura_page2

        page.expect_popup.side_effect = [popup_ctx1, popup_ctx2]

        objs = [
            ObjetivoDescarga(fecha=datetime(2025, 7, 10), enlace=MagicMock()),
            ObjetivoDescarga(fecha=datetime(2025, 8, 15), enlace=MagicMock()),
        ]

        descargar_facturas(
            page=page,
            objetivos=objs,
            carpeta_destino=dest,
            esperar_descarga=0,
            sobrescribir=False,
        )

        descarga1.save_as.assert_called_once()
        descarga2.save_as.assert_called_once()


# ── main ─────────────────────────────────────────────────────────────────────


class TestMain:
    @patch("midjourney_invoice_downloader.sync_playwright")
    @patch("builtins.input", return_value="")
    def test_returns_1_when_desde_after_hasta(
        self, _mock_input: MagicMock, _mock_pw: MagicMock
    ) -> None:
        result = main(["--desde", "2025-12-01", "--hasta", "2025-01-01"])
        assert result == 1

    @patch("midjourney_invoice_downloader.sync_playwright")
    @patch("builtins.input", return_value="")
    def test_returns_1_when_no_objectives(
        self, _mock_input: MagicMock, mock_pw: MagicMock
    ) -> None:
        pw_ctx = MagicMock()
        mock_pw.return_value.__enter__ = MagicMock(return_value=pw_ctx)
        mock_pw.return_value.__exit__ = MagicMock(return_value=False)

        browser = MagicMock()
        pw_ctx.chromium.launch_persistent_context.return_value = browser

        page = MagicMock()
        browser.new_page.return_value = page

        rows_locator = MagicMock()
        rows_locator.count.return_value = 0
        page.locator.return_value = rows_locator

        result = main([])
        assert result == 1
        browser.close.assert_called_once()

    @patch("midjourney_invoice_downloader.descargar_facturas")
    @patch("midjourney_invoice_downloader.filas_objetivo")
    @patch("midjourney_invoice_downloader.sync_playwright")
    @patch("builtins.input", return_value="")
    def test_returns_0_on_success(
        self,
        _mock_input: MagicMock,
        mock_pw: MagicMock,
        mock_filas: MagicMock,
        mock_descargar: MagicMock,
    ) -> None:
        pw_ctx = MagicMock()
        mock_pw.return_value.__enter__ = MagicMock(return_value=pw_ctx)
        mock_pw.return_value.__exit__ = MagicMock(return_value=False)

        browser = MagicMock()
        pw_ctx.chromium.launch_persistent_context.return_value = browser

        page = MagicMock()
        browser.new_page.return_value = page

        mock_filas.return_value = [
            ObjetivoDescarga(fecha=datetime(2025, 7, 10), enlace=MagicMock())
        ]

        result = main([])
        assert result == 0
        mock_descargar.assert_called_once()
        browser.close.assert_called_once()

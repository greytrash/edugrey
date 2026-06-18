"""Playwright helpers for popup navigation and file downloads."""

from __future__ import annotations

import time
from contextlib import contextmanager
from pathlib import Path
from typing import Generator

from playwright.sync_api import Page


@contextmanager
def open_popup(
    page: Page,
    locator: object,
    wait_seconds: float = 0,
) -> Generator[Page, None, None]:
    """Click *locator*, wait for the popup, yield the new page, then close it.

    Usage::

        with open_popup(page, link, wait_seconds=1.0) as popup:
            # interact with the popup page
            ...
    """
    with page.expect_popup() as pop_info:
        locator.click()  # type: ignore[union-attr]
    popup = pop_info.value
    popup.wait_for_load_state("domcontentloaded")
    if wait_seconds > 0:
        time.sleep(wait_seconds)
    try:
        yield popup
    finally:
        popup.close()


def download_file(page: Page, locator: object, dest: Path) -> Path:
    """Click *locator* and save the resulting download to *dest*.

    Returns the resolved destination path.
    """
    with page.expect_download() as download_info:
        locator.click()  # type: ignore[union-attr]
    download = download_info.value
    download.save_as(dest)
    return dest

from __future__ import annotations

import io
import shutil
import sys
from pathlib import Path

import fitz
import pytesseract
from PIL import Image

from maa_ingest.config import Settings

# Common install locations when `tesseract` is not on PATH (e.g. GUI terminals vs brew).
_TESSERACT_CANDIDATES = (
    "/opt/homebrew/bin/tesseract",
    "/usr/local/bin/tesseract",
    "/opt/anaconda3/bin/tesseract",
    "/usr/local/anaconda3/bin/tesseract",
)


def _resolve_tesseract_binary(settings: Settings) -> str:
    if settings.tesseract_cmd:
        p = Path(settings.tesseract_cmd).expanduser()
        if p.is_file():
            return str(p)
        print(
            f"maa-ingest: TESSERACT_CMD not found ({p}), "
            "falling back to PATH / common locations. Unset TESSERACT_CMD if wrong.",
            file=sys.stderr,
        )

    found = shutil.which("tesseract")
    if found:
        return found
    for candidate in _TESSERACT_CANDIDATES:
        cp = Path(candidate)
        if cp.is_file():
            return str(cp)
    raise RuntimeError(
        "Tesseract OCR not found. Install it: `brew install tesseract` (macOS), "
        "`apt install tesseract-ocr` (Debian/Ubuntu), or `conda install -c conda-forge tesseract`. "
        "Then ensure `tesseract` is on PATH, or set TESSERACT_CMD to the real binary path "
        "(run `which tesseract` after installing)."
    )


def _ensure_tesseract(settings: Settings) -> None:
    """Set `pytesseract.pytesseract.tesseract_cmd` per https://pypi.org/project/pytesseract/"""
    pytesseract.pytesseract.tesseract_cmd = _resolve_tesseract_binary(settings)


def verify_tesseract_for_check(settings: Settings) -> str:
    """Resolve binary and return engine version (used by `maa-ingest check`)."""
    _ensure_tesseract(settings)
    try:
        return str(pytesseract.get_tesseract_version())
    except Exception as e:
        raise RuntimeError(
            "pytesseract + Pillow are installed, but the Tesseract OCR engine is missing "
            "or not runnable. Install the system `tesseract` binary and ensure it is on PATH, "
            "or set TESSERACT_CMD. See https://pypi.org/project/pytesseract/"
        ) from e


def _maybe_downscale(img: Image.Image, max_dim: int) -> Image.Image:
    w, h = img.size
    if max(w, h) <= max_dim:
        return img
    scale = max_dim / max(w, h)
    nw, nh = int(w * scale), int(h * scale)
    return img.resize((nw, nh), Image.Resampling.LANCZOS)


def _ocr_page_image(page: fitz.Page, settings: Settings) -> str:
    dpi = max(72, min(settings.ocr_dpi, 600))
    mat = fitz.Matrix(dpi / 72, dpi / 72)
    pix = page.get_pixmap(matrix=mat, alpha=False)
    png = pix.tobytes("png")
    img = Image.open(io.BytesIO(png))
    if img.mode not in ("RGB", "L"):
        img = img.convert("RGB")
    img = _maybe_downscale(img, settings.ocr_max_image_dim)
    # pytesseract wraps the Tesseract CLI; Pillow supplies the image (see PyPI docs).
    cfg = f"--oem {settings.ocr_oem} --psm {settings.ocr_psm}"
    kw: dict = {"lang": settings.ocr_lang, "config": cfg}
    if settings.ocr_timeout_sec and settings.ocr_timeout_sec > 0:
        kw["timeout"] = settings.ocr_timeout_sec
    try:
        return pytesseract.image_to_string(img, **kw)
    except (pytesseract.TesseractNotFoundError, FileNotFoundError, OSError) as e:
        raise RuntimeError(
            "Could not run the Tesseract binary. Install Tesseract, ensure it is on PATH, "
            "or set TESSERACT_CMD (e.g. /opt/homebrew/bin/tesseract on Apple Silicon Homebrew)."
        ) from e


def _page_text_for_ingest(page: fitz.Page, settings: Settings) -> str:
    raw = (page.get_text("text") or "").strip()
    mode = settings.pdf_ocr_mode
    if mode == "never":
        return page.get_text("text") or ""
    if mode == "always":
        return _ocr_page_image(page, settings)
    # auto: OCR when the text layer is empty or very short (scanned / image PDFs)
    if len(raw) >= settings.pdf_ocr_min_chars:
        return page.get_text("text") or ""
    ocr = _ocr_page_image(page, settings).strip()
    return ocr if ocr else (page.get_text("text") or "")


def extract_pages_text(pdf_path: Path, settings: Settings) -> tuple[str | None, list[str]]:
    if settings.pdf_ocr_mode != "never":
        _ensure_tesseract(settings)
    doc = fitz.open(pdf_path)
    try:
        meta = doc.metadata or {}
        title = meta.get("title")
        if title:
            title = title.strip() or None
        texts: list[str] = []
        for page in doc:
            texts.append(_page_text_for_ingest(page, settings))
        return title, texts
    finally:
        doc.close()

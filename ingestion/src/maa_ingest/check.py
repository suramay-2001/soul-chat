from __future__ import annotations

from maa_ingest.config import Settings
from maa_ingest.db import connection


def run_check(settings: Settings) -> None:
    with connection(settings) as conn:
        row = conn.execute(
            "SELECT extname FROM pg_extension WHERE extname = 'vector'"
        ).fetchone()
        if not row:
            raise RuntimeError("pgvector extension not installed (expected: CREATE EXTENSION vector)")
        rows = conn.execute(
            """
            SELECT table_name FROM information_schema.tables
            WHERE table_schema = 'public'
              AND table_name IN ('books', 'pages', 'chunks')
            """
        ).fetchall()
        got = {r["table_name"] for r in rows}
        need = {"books", "pages", "chunks"}
        if got != need:
            raise RuntimeError(f"unexpected tables: got {got!r}, need {need!r}")
        emb = conn.execute(
            """
            SELECT udt_name FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'chunks'
              AND column_name = 'embedding'
            """
        ).fetchone()
        if not emb:
            raise RuntimeError("chunks.embedding column missing")
        print("schema ok: vector extension, tables books/pages/chunks, chunks.embedding present")
        if settings.pdf_ocr_mode != "never":
            try:
                from maa_ingest.pdf_extract import verify_tesseract_for_check

                ver = verify_tesseract_for_check(settings)
                print(
                    f"  ocr: pytesseract + Pillow OK; Tesseract engine {ver} "
                    f"(https://pypi.org/project/pytesseract/)"
                )
            except Exception as e:
                print(f"  ocr: not ready — {e}")
        for t in ("books", "pages", "chunks"):
            n = conn.execute(f"SELECT count(*) AS c FROM {t}").fetchone()
            assert n is not None
            print(f"  {t}: {int(n['c'])} rows")

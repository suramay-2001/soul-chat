from __future__ import annotations

from maa_ingest.config import Settings
from maa_ingest.db import connection


def run_reset_data(settings: Settings) -> int:
    """Delete all rows in books (CASCADE removes pages and chunks)."""
    with connection(settings) as conn:
        cur = conn.execute("DELETE FROM books")
        conn.commit()
        return cur.rowcount or 0

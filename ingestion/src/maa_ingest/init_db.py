from __future__ import annotations

from pathlib import Path

import psycopg

from maa_ingest.config import Settings


def _sql_statements(sql: str) -> list[str]:
    """Split DDL file into single statements (poolers reject multi-statement execute)."""
    lines: list[str] = []
    for line in sql.splitlines():
        s = line.strip()
        if not s or s.startswith("--"):
            continue
        lines.append(line)
    text = "\n".join(lines)
    out: list[str] = []
    for chunk in text.split(";"):
        stmt = chunk.strip()
        if stmt:
            out.append(stmt + ";")
    return out


def run_init_db(settings: Settings) -> None:
    """Apply schema.sql (idempotent: IF NOT EXISTS)."""
    root = Path(__file__).resolve().parents[2]
    sql_path = root / "schema.sql"
    sql = sql_path.read_text()
    statements = _sql_statements(sql)
    conn = psycopg.connect(
        settings.database_url,
        autocommit=True,
        prepare_threshold=0,
    )
    try:
        for stmt in statements:
            conn.execute(stmt)
        print(f"Applied {sql_path.name} ({len(statements)} statements)")
    finally:
        conn.close()

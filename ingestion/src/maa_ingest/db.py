from __future__ import annotations

import uuid
from contextlib import contextmanager
from typing import Iterator

import psycopg
from pgvector.psycopg import register_vector
from psycopg import Connection
from psycopg.rows import dict_row

from maa_ingest.config import Settings


def connect(settings: Settings) -> Connection:
    # prepare_threshold=0: required for Supabase transaction pooler (port 6543); harmless for direct.
    conn = psycopg.connect(
        settings.database_url,
        row_factory=dict_row,
        prepare_threshold=0,
    )
    conn.execute("CREATE EXTENSION IF NOT EXISTS vector")
    register_vector(conn)
    return conn


@contextmanager
def connection(settings: Settings) -> Iterator[Connection]:
    conn = connect(settings)
    try:
        yield conn
    finally:
        conn.close()


def get_book_etag(conn: Connection, s3_key: str) -> str | None:
    row = conn.execute(
        "SELECT s3_etag FROM books WHERE s3_key = %s",
        (s3_key,),
    ).fetchone()
    return row["s3_etag"] if row else None


def delete_book_by_s3_key(conn: Connection, s3_key: str) -> None:
    conn.execute("DELETE FROM books WHERE s3_key = %s", (s3_key,))


def insert_book(
    conn: Connection,
    *,
    s3_key: str,
    s3_etag: str,
    title: str | None,
    page_count: int,
) -> uuid.UUID:
    bid = uuid.uuid4()
    conn.execute(
        """
        INSERT INTO books (id, s3_key, s3_etag, title, page_count, updated_at)
        VALUES (%s, %s, %s, %s, %s, now())
        """,
        (bid, s3_key, s3_etag, title, page_count),
    )
    return bid


def insert_pages(
    conn: Connection,
    book_id: uuid.UUID,
    page_texts: list[str],
) -> list[uuid.UUID]:
    ids: list[uuid.UUID] = []
    for i, text in enumerate(page_texts, start=1):
        pid = uuid.uuid4()
        conn.execute(
            """
            INSERT INTO pages (id, book_id, page_number, text)
            VALUES (%s, %s, %s, %s)
            """,
            (pid, book_id, i, text),
        )
        ids.append(pid)
    return ids


def insert_chunks(
    conn: Connection,
    rows: list[tuple[uuid.UUID, uuid.UUID, int, str, int, list[float]]],
) -> None:
    """(book_id, page_id, chunk_index, text, token_count, embedding)"""
    with conn.cursor() as cur:
        cur.executemany(
            """
            INSERT INTO chunks (id, book_id, page_id, chunk_index, text, token_count, embedding)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            """,
            [
                (
                    uuid.uuid4(),
                    book_id,
                    page_id,
                    chunk_index,
                    text,
                    token_count,
                    embedding,
                )
                for book_id, page_id, chunk_index, text, token_count, embedding in rows
            ],
        )


def delete_books_not_in(conn: Connection, keep_keys: set[str]) -> int:
    if not keep_keys:
        cur = conn.execute("DELETE FROM books")
        return cur.rowcount or 0
    cur = conn.execute(
        "DELETE FROM books WHERE NOT (s3_key = ANY(%s::text[]))",
        (list(keep_keys),),
    )
    return cur.rowcount or 0

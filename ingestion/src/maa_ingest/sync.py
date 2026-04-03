from __future__ import annotations

import hashlib
import uuid
from pathlib import Path

from botocore.exceptions import NoCredentialsError
from openai import OpenAI
from psycopg import OperationalError

from maa_ingest.chunker import chunk_pages
from maa_ingest.config import Settings
from maa_ingest.db import (
    connection,
    delete_book_by_s3_key,
    delete_books_not_in,
    get_book_etag,
    insert_book,
    insert_chunks,
    insert_pages,
)
from maa_ingest.embedder import embed_texts_batched
from maa_ingest.pdf_extract import extract_pages_text
from maa_ingest.s3_list import download_pdf, iter_pdf_objects


def _local_pdf_path(settings: Settings, s3_key: str) -> Path:
    digest = hashlib.sha256(s3_key.encode()).hexdigest()[:20]
    safe_name = Path(s3_key).name
    return settings.ingest_tmp_dir / f"{digest}__{safe_name}"


def _write_book_with_retry(
    settings: Settings,
    *,
    s3_key: str,
    s3_etag: str,
    title: str | None,
    page_texts: list[str],
    chunks_text: list[tuple[int, str, int]],
    embeddings: list[list[float]],
) -> None:
    last_err: Exception | None = None
    for attempt in (1, 2):
        try:
            with connection(settings) as conn:
                existing = get_book_etag(conn, s3_key)
                if existing == s3_etag:
                    print(f"skip unchanged: {s3_key}")
                    return
                if existing is not None:
                    delete_book_by_s3_key(conn, s3_key)

                book_id = insert_book(
                    conn,
                    s3_key=s3_key,
                    s3_etag=s3_etag,
                    title=title,
                    page_count=len(page_texts),
                )
                page_ids = insert_pages(conn, book_id, page_texts)

                if chunks_text:
                    rows: list[
                        tuple[uuid.UUID, uuid.UUID, int, str, int, list[float]]
                    ] = []
                    for idx, ((pn, text, tok_count), emb) in enumerate(
                        zip(chunks_text, embeddings)
                    ):
                        if pn < 1 or pn > len(page_ids):
                            raise RuntimeError(f"invalid page_number {pn}")
                        rows.append((book_id, page_ids[pn - 1], idx, text, tok_count, emb))
                    insert_chunks(conn, rows)
                conn.commit()
                print(f"  done: pages={len(page_texts)} chunks={len(chunks_text)}")
                return
        except OperationalError as e:
            last_err = e
            if attempt == 1:
                print(f"  db connection dropped; retrying: {s3_key}")
                continue
            break
    raise RuntimeError(f"failed to write {s3_key} after retry") from last_err


def run_sync(settings: Settings) -> None:
    settings.ingest_tmp_dir.mkdir(parents=True, exist_ok=True)
    try:
        objects = iter_pdf_objects(settings)
    except NoCredentialsError as e:
        raise RuntimeError(
            "AWS credentials not found. If the bucket is public, set S3_ANONYMOUS=1 in "
            ".env.local (unsigned List/Get). Otherwise set AWS_ACCESS_KEY_ID / "
            "AWS_SECRET_ACCESS_KEY, or run `aws configure` for s3://"
            f"{settings.s3_bucket}/{settings.s3_books_prefix}."
        ) from e
    remote_keys = {o.key for o in objects}
    openai_client = OpenAI(api_key=settings.openai_api_key)

    for obj in objects:
        with connection(settings) as conn:
            existing = get_book_etag(conn, obj.key)
        if existing == obj.etag:
            print(f"skip unchanged: {obj.key}")
            continue

        print(f"ingest: {obj.key}")
        local = _local_pdf_path(settings, obj.key)
        download_pdf(settings, obj.key, local)
        title, page_texts = extract_pages_text(local, settings)
        if not page_texts:
            page_texts = [""]
        chunks = chunk_pages(
            page_texts,
            target_tokens=settings.chunk_target_tokens,
            overlap_tokens=settings.chunk_overlap_tokens,
        )
        if not chunks:
            print(f"  no text chunks, storing metadata only: {obj.key}")
            _write_book_with_retry(
                settings,
                s3_key=obj.key,
                s3_etag=obj.etag,
                title=title,
                page_texts=page_texts,
                chunks_text=[],
                embeddings=[],
            )
            continue

        texts = [c.text for c in chunks]
        embeddings = embed_texts_batched(openai_client, settings, texts)
        if len(embeddings) != len(chunks):
            raise RuntimeError("embedding count mismatch")
        chunks_text = [(c.page_number, c.text, c.token_count) for c in chunks]
        _write_book_with_retry(
            settings,
            s3_key=obj.key,
            s3_etag=obj.etag,
            title=title,
            page_texts=page_texts,
            chunks_text=chunks_text,
            embeddings=embeddings,
        )

    with connection(settings) as conn:
        removed = delete_books_not_in(conn, remote_keys)
        conn.commit()
        if removed:
            print(f"removed {removed} book(s) no longer in S3")

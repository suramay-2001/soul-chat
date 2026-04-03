from __future__ import annotations

from dataclasses import dataclass

import tiktoken


@dataclass(frozen=True)
class TextChunk:
    page_number: int  # 1-based
    text: str
    token_count: int


def chunk_pages(
    page_texts: list[str],
    *,
    target_tokens: int,
    overlap_tokens: int,
    encoding_name: str = "cl100k_base",
) -> list[TextChunk]:
    enc = tiktoken.get_encoding(encoding_name)
    chunks: list[TextChunk] = []
    for page_idx, raw in enumerate(page_texts, start=1):
        text = (raw or "").strip()
        if not text:
            continue
        tokens = enc.encode(text)
        if len(tokens) <= target_tokens:
            chunks.append(
                TextChunk(
                    page_number=page_idx,
                    text=text,
                    token_count=len(tokens),
                )
            )
            continue
        start = 0
        while start < len(tokens):
            end = min(start + target_tokens, len(tokens))
            slice_toks = tokens[start:end]
            piece = enc.decode(slice_toks).strip()
            if piece:
                chunks.append(
                    TextChunk(
                        page_number=page_idx,
                        text=piece,
                        token_count=len(slice_toks),
                    )
                )
            if end >= len(tokens):
                break
            start = end - overlap_tokens
            if start < 0:
                start = 0
            if start >= end:
                start = end
    return chunks

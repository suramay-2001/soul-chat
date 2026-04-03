from __future__ import annotations

from openai import OpenAI

from maa_ingest.config import Settings


def embed_texts_batched(
    client: OpenAI,
    settings: Settings,
    texts: list[str],
    batch_size: int = 64,
) -> list[list[float]]:
    if not texts:
        return []
    out: list[list[float]] = []
    model = settings.openai_embed_model
    for i in range(0, len(texts), batch_size):
        batch = texts[i : i + batch_size]
        resp = client.embeddings.create(model=model, input=batch)
        data = sorted(resp.data, key=lambda d: d.index)
        for item in data:
            out.append(list(item.embedding))
    return out

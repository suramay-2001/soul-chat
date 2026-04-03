from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


def _get(name: str, default: str | None = None) -> str:
    val = os.environ.get(name, default)
    if val is None or val == "":
        raise RuntimeError(f"Missing required environment variable: {name}")
    return val


def _get_opt(name: str, default: str | None = None) -> str | None:
    v = os.environ.get(name, default)
    return v if v not in (None, "") else None


def _env_truthy(name: str) -> bool:
    return os.environ.get(name, "").strip().lower() in ("1", "true", "yes", "on")


@dataclass(frozen=True)
class Settings:
    database_url: str
    openai_api_key: str
    s3_bucket: str
    s3_books_prefix: str
    aws_region: str
    openai_embed_model: str
    chunk_target_tokens: int
    chunk_overlap_tokens: int
    ingest_tmp_dir: Path
    aws_access_key_id: str | None
    aws_secret_access_key: str | None
    aws_session_token: str | None
    s3_anonymous: bool
    s3_key_list_file: Path | None
    pdf_ocr_mode: str
    pdf_ocr_min_chars: int
    ocr_dpi: int
    ocr_lang: str
    ocr_psm: int
    ocr_oem: int
    ocr_timeout_sec: float
    ocr_max_image_dim: int
    tesseract_cmd: str | None

    @staticmethod
    def from_env() -> "Settings":
        klf = _get_opt("S3_KEY_LIST_FILE")
        ocr_mode = os.environ.get("PDF_OCR_MODE", "always").strip().lower()
        if ocr_mode not in ("auto", "always", "never"):
            ocr_mode = "always"
        return Settings(
            database_url=_get("DATABASE_URL"),
            openai_api_key=_get("OPENAI_API_KEY"),
            s3_bucket=os.environ.get("S3_BUCKET", "maa-aap-bucket"),
            s3_books_prefix=os.environ.get("S3_BOOKS_PREFIX", "books/"),
            aws_region=os.environ.get("AWS_REGION", "us-east-1"),
            openai_embed_model=os.environ.get(
                "OPENAI_EMBED_MODEL", "text-embedding-3-large"
            ),
            chunk_target_tokens=int(os.environ.get("CHUNK_TARGET_TOKENS", "650")),
            chunk_overlap_tokens=int(
                os.environ.get("CHUNK_OVERLAP_TOKENS", "120")
            ),
            ingest_tmp_dir=Path(
                os.environ.get("INGEST_TMP_DIR", ".tmp/maa-books")
            ).expanduser(),
            aws_access_key_id=_get_opt("AWS_ACCESS_KEY_ID"),
            aws_secret_access_key=_get_opt("AWS_SECRET_ACCESS_KEY"),
            aws_session_token=_get_opt("AWS_SESSION_TOKEN"),
            s3_anonymous=_env_truthy("S3_ANONYMOUS"),
            s3_key_list_file=Path(klf).expanduser() if klf else None,
            pdf_ocr_mode=ocr_mode,
            pdf_ocr_min_chars=int(os.environ.get("PDF_OCR_MIN_CHARS", "40")),
            ocr_dpi=int(os.environ.get("OCR_DPI", "200")),
            ocr_lang=os.environ.get("OCR_LANG", "eng"),
            ocr_psm=int(os.environ.get("OCR_PSM", "6")),
            ocr_oem=int(os.environ.get("OCR_OEM", "3")),
            ocr_timeout_sec=float(os.environ.get("OCR_TIMEOUT", "0")),
            ocr_max_image_dim=int(os.environ.get("OCR_MAX_IMAGE_DIM", "4000")),
            tesseract_cmd=_get_opt("TESSERACT_CMD"),
        )

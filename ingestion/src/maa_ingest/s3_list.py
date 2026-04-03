from __future__ import annotations

from dataclasses import dataclass

import boto3
from botocore import UNSIGNED
from botocore.config import Config
from botocore.exceptions import ClientError

from maa_ingest.config import Settings


@dataclass(frozen=True)
class S3ObjectInfo:
    key: str
    etag: str


def _normalize_etag(raw: str) -> str:
    return raw.strip('"').strip("'")


def _s3_client(settings: Settings):
    if settings.s3_anonymous:
        return boto3.client(
            "s3",
            region_name=settings.aws_region,
            config=Config(signature_version=UNSIGNED),
        )
    kwargs: dict = {"region_name": settings.aws_region}
    if settings.aws_access_key_id and settings.aws_secret_access_key:
        kwargs["aws_access_key_id"] = settings.aws_access_key_id
        kwargs["aws_secret_access_key"] = settings.aws_secret_access_key
        if settings.aws_session_token:
            kwargs["aws_session_token"] = settings.aws_session_token
    return boto3.client("s3", **kwargs)


def _read_key_list(path) -> list[str]:
    text = path.read_text(encoding="utf-8")
    keys: list[str] = []
    for line in text.splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        keys.append(line)
    return keys


def _iter_pdf_objects_from_key_file(settings: Settings) -> list[S3ObjectInfo]:
    path = settings.s3_key_list_file
    assert path is not None
    path = path.expanduser()
    if not path.is_file():
        raise RuntimeError(f"S3_KEY_LIST_FILE not found: {path}")
    client = _s3_client(settings)
    out: list[S3ObjectInfo] = []
    for key in _read_key_list(path):
        if not key.lower().endswith(".pdf"):
            continue
        try:
            resp = client.head_object(Bucket=settings.s3_bucket, Key=key)
        except ClientError as e:
            code = e.response.get("Error", {}).get("Code", "")
            if code in ("404", "NoSuchKey", "NotFound"):
                raise RuntimeError(f"S3 object not found: {key}") from e
            raise RuntimeError(
                f"HeadObject failed for {key}: {code}. Public buckets often allow GetObject "
                "but not ListBucket; if Head also fails anonymously, use IAM credentials "
                "(unset S3_ANONYMOUS and set AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY)."
            ) from e
        etag = _normalize_etag(resp["ETag"])
        out.append(S3ObjectInfo(key=key, etag=etag))
    return out


def iter_pdf_objects(settings: Settings) -> list[S3ObjectInfo]:
    if settings.s3_key_list_file is not None:
        return _iter_pdf_objects_from_key_file(settings)

    client = _s3_client(settings)
    prefix = settings.s3_books_prefix
    if prefix and not prefix.endswith("/"):
        prefix = prefix + "/"
    out: list[S3ObjectInfo] = []
    paginator = client.get_paginator("list_objects_v2")
    try:
        for page in paginator.paginate(Bucket=settings.s3_bucket, Prefix=prefix):
            for obj in page.get("Contents") or []:
                key = obj["Key"]
                if not key.lower().endswith(".pdf"):
                    continue
                etag = _normalize_etag(obj["ETag"])
                out.append(S3ObjectInfo(key=key, etag=etag))
    except ClientError as e:
        code = e.response.get("Error", {}).get("Code", "")
        if code in ("AccessDenied", "403"):
            raise RuntimeError(
                "S3 ListObjectsV2 was denied. Many public buckets allow reading objects but "
                "not anonymous listing. Fix one of: (1) IAM user with s3:ListBucket on the "
                "prefix (unset S3_ANONYMOUS, set AWS keys), (2) bucket policy allowing "
                "s3:ListBucket for Principal * on this prefix, or (3) set S3_KEY_LIST_FILE "
                "to a local text file with one object key per line (e.g. books/Foo.pdf) and "
                "use HeadObject + GetObject only."
            ) from e
        raise
    return out


def download_pdf(settings: Settings, key: str, dest_path) -> None:
    client = _s3_client(settings)
    dest_path.parent.mkdir(parents=True, exist_ok=True)
    client.download_file(settings.s3_bucket, key, str(dest_path))

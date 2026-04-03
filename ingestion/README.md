# Maa book PDF ingestion

Lists PDFs under `s3://maa-aap-bucket/books/` (configurable), skips objects whose **S3 ETag** matches the stored row, otherwise downloads the file, extracts text per page (**PyMuPDF** text layer and/or **Tesseract OCR** on rendered page images for scanned PDFs), token-chunks with **tiktoken**, embeds with **OpenAI** `text-embedding-3-large`, and writes **books**, **pages**, and **chunks** (with **pgvector** embeddings) into Postgres.

## Prerequisites

- Python 3.11+
- [uv](https://docs.astral.sh/uv/) (recommended) **or** `pip` + `venv` (see below)
- **[Tesseract OCR](https://github.com/tesseract-ocr/tesseract)** (required when `PDF_OCR_MODE` is not `never`). Install: `brew install tesseract` (macOS), `apt install tesseract-ocr` (Debian/Ubuntu); optional `brew install tesseract-lang`. If your terminal does not see `tesseract` (common when Homebrew is not on `PATH` in GUI apps), either fix `PATH` or set **`TESSERACT_CMD=/opt/homebrew/bin/tesseract`** (Apple Silicon) or **`/usr/local/bin/tesseract`**. The worker also probes those paths automatically.
- Postgres with the [pgvector](https://github.com/pgvector/pgvector) extension available
- AWS credentials that can list/read the bucket (environment, shared config, or optional `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`)
- OpenAI API key with embeddings access

## Database setup

Apply the schema once (from the `ingestion/` directory):

```bash
uv run maa-ingest init-db
# with venv only:  maa-ingest init-db
```

Or with `psql`:

```bash
psql "$DATABASE_URL" -f schema.sql
```

### Supabase

Do **not** invent `DATABASE_URL` from the project’s `https://…supabase.co` URL. Open **Project Settings → Database**, click **Connect**, and copy a Postgres URI:

- Prefer **Session pooler** (IPv4-friendly, port **5432** on `aws-0-…` or `aws-1-…pooler.supabase.com` — copy the exact host from **Connect**) or **Transaction pooler** (port **6543** on `db.…supabase.co`) if your network has no IPv6.
- Direct `db.…supabase.co:5432` is often **IPv6-only**; many laptops and CI environments cannot reach it without IPv6 or the [IPv4 add-on](https://supabase.com/docs/guides/platform/ipv4-address).

Special characters in the database password must be **URL-encoded** inside `DATABASE_URL` (e.g. `*` → `%2A`, `@` → `%40`).

**`failed to resolve host 'db.….supabase.co'`** — Your network/DNS is not resolving the **direct** host (often IPv6-only). Switch `DATABASE_URL` to the **Session pooler** string from **Connect** (host looks like `aws-0-<region>.pooler.supabase.com`, user `postgres.<project-ref>`). Paste the full URI from the dashboard to avoid guessing the region.

**`FATAL: Tenant or user not found`** — The pooler **region** in the hostname does not match your project. Open **Connect → Session pooler** and copy the URI exactly.

## Configure

Copy `.env.example` to `.env.local` and set at least `DATABASE_URL` and `OPENAI_API_KEY`. Run commands from `ingestion/` so `.env.local` is picked up, or export variables in your shell.

## Install

**Option A — uv (recommended)**

```bash
cd ingestion
uv sync
```

If your shell says `uv: command not found`, install it once:

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

Then open a new terminal (or add `~/.local/bin` to your `PATH`) and run `uv sync` again.

**Option B — pip + venv (no uv)**

Requires **Python 3.11+** (`python3 --version`). On macOS you may need `python3.11` or `python3.12` from [python.org](https://www.python.org/downloads/) or Homebrew if the system Python is older.

```bash
cd ingestion
python3 -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
python -m pip install -U pip
pip install -e .
```

After this, use `maa-ingest` or `python -m maa_ingest` with the venv activated.

## Run

Verify connectivity and schema (after `schema.sql`):

```bash
cd ingestion
uv run maa-ingest check            # with uv
# or, with venv:  maa-ingest check
```

Ingest reads PDFs from `S3_BUCKET` / `S3_BOOKS_PREFIX` (see `.env.example`).

```bash
uv run maa-ingest sync             # with uv
# or, with venv:  maa-ingest sync
```

**Public bucket (list + read allowed anonymously):** set `S3_ANONYMOUS=1` and `AWS_REGION` to the bucket’s region. No `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` needed.

**Private bucket:** configure AWS in one of these ways:

- **`ingestion/.env.local`**: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`. Add `AWS_SESSION_TOKEN` for temporary credentials.
- **Shared config**: `aws configure` → `~/.aws/credentials`.
- **Shell**: export the same variables.

If you see `NoCredentialsError` on a private bucket, boto3 did not find credentials. For a public bucket, add `S3_ANONYMOUS=1`.

**`AccessDenied` on `ListObjectsV2`:** the bucket often allows public **GetObject** but not anonymous **ListBucket**. Either add an IAM user with `s3:ListBucket` / `s3:GetObject` (unset `S3_ANONYMOUS`, set AWS keys), or set **`S3_KEY_LIST_FILE`** to a local text file with **one full object key per line** (for example `books/MyFile.pdf`). The worker will use `HeadObject` + `GetObject` only. See `books_keys.example.txt` and `books_keys.txt`.

Equivalent:

```bash
uv run python -m maa_ingest sync
# or:            python -m maa_ingest sync
```

## OCR (scanned / image-only PDFs)

By default **`PDF_OCR_MODE=always`**: each page is rendered and run through Tesseract (see env vars below). Use **`auto`** to OCR only when the text layer is shorter than **`PDF_OCR_MIN_CHARS`** (saves time on born-digital PDFs). Use **`never`** to use only the PDF text layer.

| Variable | Default | Meaning |
|----------|---------|---------|
| `PDF_OCR_MODE` | `always` | `always` \| `auto` \| `never` |
| `PDF_OCR_MIN_CHARS` | `40` | In `auto`, OCR if extracted text is shorter than this |
| `OCR_DPI` | `200` | Render resolution for OCR |
| `OCR_LANG` | `eng` | Tesseract language(s), e.g. `eng+hin` if data installed |
| `OCR_PSM` | `6` | Page segmentation mode ([docs](https://tesseract-ocr.github.io/tessdoc/ImproveQuality.html)) |
| `OCR_OEM` | `3` | OCR engine mode (pytesseract `config`: `--oem`; often `3` for LSTM) |
| `OCR_TIMEOUT` | `0` | Seconds per page for `pytesseract.image_to_string(..., timeout=…)`; `0` = no limit ([PyPI](https://pypi.org/project/pytesseract/)) |
| `OCR_MAX_IMAGE_DIM` | `4000` | Downscale wide pages before OCR (pixels) |
| `TESSERACT_CMD` | (empty) | Full path to `tesseract` if not on `PATH` (same as `pytesseract.pytesseract.tesseract_cmd`) |

After changing OCR settings, **re-run ingestion** for existing objects: either remove those rows from `books` in Postgres or change the file in S3 so the ETag updates (otherwise sync skips unchanged keys).

**Full re-ingest (clear DB + run OCR sync again):**

```bash
maa-ingest reset-data --yes   # deletes all books; pages/chunks CASCADE
maa-ingest sync
```

## Behavior

- **Idempotent skip**: For each PDF key, if `books.s3_etag` equals the current S3 ETag, that object is skipped.
- **Replace on change**: If the ETag changed (or the book is new), existing rows for that `s3_key` are removed and the book is re-ingested.
- **Prune**: After processing, books whose `s3_key` is not present in the current S3 listing are deleted (handles removed objects). If the prefix lists zero PDFs, all books are removed—ensure the bucket/prefix is correct.

Temporary downloads go under `INGEST_TMP_DIR` (default `.tmp/maa-books`).

## Embedding dimensions

`text-embedding-3-large` uses **3072** dimensions, matching `schema.sql`. If you change `OPENAI_EMBED_MODEL`, adjust the `vector(...)` column and re-embed.

from __future__ import annotations

import argparse
from pathlib import Path


def _load_dotenv() -> None:
    try:
        from dotenv import load_dotenv
    except ImportError:
        return
    for name in (".env.local", ".env"):
        p = Path.cwd() / name
        if p.is_file():
            load_dotenv(p)
            return
    here = Path(__file__).resolve().parent
    for parent in (here.parents[1], here.parents[2]):
        for name in (".env.local", ".env"):
            p = parent / name
            if p.is_file():
                load_dotenv(p)
                return


def main() -> None:
    _load_dotenv()
    parser = argparse.ArgumentParser(prog="maa-ingest")
    sub = parser.add_subparsers(dest="command", required=True)

    p_sync = sub.add_parser("sync", help="List S3 PDFs and sync to Postgres")
    p_sync.set_defaults(func=_cmd_sync)

    p_check = sub.add_parser(
        "check",
        help="Verify DB connectivity, pgvector, and books/pages/chunks schema",
    )
    p_check.set_defaults(func=_cmd_check)

    p_init = sub.add_parser(
        "init-db",
        help="Apply schema.sql (CREATE EXTENSION, tables, indexes)",
    )
    p_init.set_defaults(func=_cmd_init_db)

    p_reset = sub.add_parser(
        "reset-data",
        help="Delete all books (and CASCADE pages/chunks) so the next sync re-ingests everything",
    )
    p_reset.add_argument(
        "--yes",
        action="store_true",
        help="Required to confirm destructive delete",
    )
    p_reset.set_defaults(func=_cmd_reset_data)

    args = parser.parse_args()
    args.func(args)


def _cmd_sync(_args: argparse.Namespace) -> None:
    from maa_ingest.config import Settings
    from maa_ingest.sync import run_sync

    settings = Settings.from_env()
    run_sync(settings)


def _cmd_check(_args: argparse.Namespace) -> None:
    from maa_ingest.check import run_check
    from maa_ingest.config import Settings

    run_check(Settings.from_env())


def _cmd_init_db(_args: argparse.Namespace) -> None:
    from maa_ingest.config import Settings
    from maa_ingest.init_db import run_init_db

    run_init_db(Settings.from_env())


def _cmd_reset_data(args: argparse.Namespace) -> None:
    if not args.yes:
        raise SystemExit(
            "Refusing to delete data without --yes. Run: maa-ingest reset-data --yes"
        )
    from maa_ingest.config import Settings
    from maa_ingest.reset_data import run_reset_data

    n = run_reset_data(Settings.from_env())
    print(f"Deleted {n} book(s) (pages and chunks removed by CASCADE). Run: maa-ingest sync")


if __name__ == "__main__":
    main()

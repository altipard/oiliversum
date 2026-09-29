import argparse
import logging
import sys

from ingest import db
from ingest.config import load_env
from ingest.jobs.daily import run_daily

log = logging.getLogger("ingest")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="ingest")
    sub = parser.add_subparsers(dest="command", required=True)
    daily = sub.add_parser("daily", help="taegliche Importjobs")
    daily.add_argument("--only", help="kommagetrennt, z.B. crude,fx")
    args = parser.parse_args(argv)

    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    load_env()
    only = [n.strip() for n in args.only.split(",") if n.strip()] if args.only else None
    try:
        failed = run_daily(db.get_client(), only)
    except Exception as exc:  # noqa: BLE001 - Exit-Code statt Traceback
        log.error("%s: %s", type(exc).__name__, exc)
        return 2
    if failed:
        log.error("failed jobs: %s", ", ".join(failed))
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())

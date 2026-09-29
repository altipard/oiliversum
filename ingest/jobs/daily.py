"""Taegliche Jobs: Rohoel und EUR/USD."""

import logging
from collections.abc import Callable
from datetime import UTC, date, datetime, timedelta

import httpx

from ingest import db
from ingest.config import BACKFILL_START, OVERLAP_DAYS
from ingest.runs import Run, track_run
from ingest.sources.crude import make_crude_source
from ingest.sources.fx import FrankfurterEcb

log = logging.getLogger("ingest")

BENCHMARKS = ("brent", "wti")
FX_PAIRS = ("EURUSD",)


def incremental_start(last: date | None) -> date:
    """Letztes Datum minus Ueberlappung (Korrekturen); leere Tabelle: Backfill."""
    return BACKFILL_START if last is None else last - timedelta(days=OVERLAP_DAYS)


def crude_job(client, run: Run) -> None:
    with httpx.Client() as http:
        source = make_crude_source(http)
        for benchmark in BENCHMARKS:
            start = incremental_start(
                db.latest_date(client, "crude_prices", benchmark=benchmark)
            )
            rows = [o.as_row() for o in source.fetch(benchmark, start)]
            run.rows_written += db.upsert(
                client, "crude_prices", rows, "benchmark,date"
            )


def fx_job(client, run: Run) -> None:
    end = datetime.now(UTC).date()
    with httpx.Client() as http:
        source = FrankfurterEcb(http)
        for pair in FX_PAIRS:
            start = incremental_start(db.latest_date(client, "fx_rates", pair=pair))
            rows = [o.as_row() for o in source.fetch(pair, start, end)]
            run.rows_written += db.upsert(client, "fx_rates", rows, "pair,date")


JOBS: dict[str, Callable[..., None]] = {"crude": crude_job, "fx": fx_job}


def run_daily(client, only: list[str] | None = None) -> list[str]:
    """Fuehrt die Jobs aus; gibt die Namen fehlgeschlagener Jobs zurueck."""
    names = only or list(JOBS)
    unknown = [n for n in names if n not in JOBS]
    if unknown:
        raise ValueError(f"unknown job(s): {', '.join(unknown)}")
    failed = []
    for name in names:
        try:
            with track_run(client, name) as run:
                JOBS[name](client, run)
        except Exception as exc:  # noqa: BLE001 - ein Job darf die anderen nicht stoppen
            log.error("job %s failed: %s: %s", name, type(exc).__name__, exc)
            failed.append(name)
    return failed

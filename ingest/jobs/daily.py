"""Taegliche Jobs: Rohoel, EUR/USD, EU Oil Bulletin und Weitergabe-Statistik."""

import logging
from collections.abc import Callable
from datetime import UTC, date, datetime, timedelta

import httpx
import pandas as pd

from ingest import db
from ingest.config import BACKFILL_START, OVERLAP_DAYS
from ingest.runs import Run, track_run
from ingest.sources.bulletin import (
    BulletinFormatError,
    bulletin_start,
    fetch_history,
    latest_week,
    parse_bulletin,
)
from ingest.sources.crude import make_crude_source
from ingest.sources.fx import FrankfurterEcb
from ingest.stats import country_stats

log = logging.getLogger("ingest")

BENCHMARKS = ("brent", "wti")
FX_PAIRS = ("EURUSD",)
PAGE_SIZE = 1000
BREAKDOWN_COLUMNS = [
    "week_date",
    "country_code",
    "fuel_type",
    "eur_1000l_without_tax",
    "crude_eur_1000l",
]


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


def bulletin_job(client, run: Run) -> None:
    start = bulletin_start(latest_week(client))
    with httpx.Client(headers={"User-Agent": "oiliversum-ingest"}) as http:
        rows = parse_bulletin(fetch_history(http), start)
    if not rows and start == BACKFILL_START:
        raise BulletinFormatError("backfill produced no rows")
    run.rows_written += db.upsert(
        client, "fuel_prices", rows, "country_code,fuel_type,week_date"
    )


def fetch_breakdown(client) -> pd.DataFrame:
    """fuel_price_breakdown ab BACKFILL_START, seitenweise (PostgREST max. PAGE_SIZE)."""
    rows: list[dict] = []
    while True:
        page = (
            client.table("fuel_price_breakdown")
            .select(",".join(BREAKDOWN_COLUMNS))
            .gte("week_date", BACKFILL_START.isoformat())
            .order("country_code")
            .order("fuel_type")
            .order("week_date")
            .range(len(rows), len(rows) + PAGE_SIZE - 1)
            .execute()
            .data
        )
        rows += page
        if len(page) < PAGE_SIZE:
            return pd.DataFrame(rows, columns=BREAKDOWN_COLUMNS)


def stats_job(client, run: Run) -> None:
    computed_at = datetime.now(UTC).isoformat()
    rows = [
        {**row, "computed_at": computed_at}
        for row in country_stats(fetch_breakdown(client))
    ]
    run.rows_written += db.upsert(
        client, "country_stats", rows, "country_code,fuel_type"
    )


JOBS: dict[str, Callable[..., None]] = {
    "crude": crude_job,
    "fx": fx_job,
    "bulletin": bulletin_job,
    "stats": stats_job,
}


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

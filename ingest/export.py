"""Export der Frontend-Daten als statische JSON-Dateien (GitHub Pages)."""

import json
import logging
from collections import defaultdict
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

log = logging.getLogger("ingest")

PAGE_SIZE = 1000
BRENT_DAYS = 15
FX_DAYS = 30
BREAKDOWN_COLUMNS = (
    "week_date,country_code,fuel_type,eur_1000l_with_tax,eur_1000l_without_tax,"
    "tax_eur_1000l,crude_eur_1000l,margin_eur_1000l,crude_share"
)

Rows = list[dict[str, Any]]


def fetch_all(client, table: str, columns: str, order: list[str], **eq: str) -> Rows:
    """Alle Zeilen einer Tabelle, seitenweise (PostgREST max. PAGE_SIZE)."""
    rows: Rows = []
    while True:
        query = client.table(table).select(columns)
        for column, value in eq.items():
            query = query.eq(column, value)
        for column in order:
            query = query.order(column)
        page = query.range(len(rows), len(rows) + PAGE_SIZE - 1).execute().data
        rows += page
        if len(page) < PAGE_SIZE:
            return rows


def latest_weeks(crude_weekly: Rows, breakdown: Rows) -> dict[str, Any]:
    """Die zwei neuesten Wochen mit Brent-Wochenwert und ihre Laenderzeilen."""
    weeks = sorted((r["week_date"] for r in crude_weekly), reverse=True)[:2]
    latest, previous = (weeks + [None, None])[:2]
    return {
        "latestWeek": latest,
        "previousWeek": previous,
        "latest": [r for r in breakdown if latest and r["week_date"] == latest],
        "previous": [r for r in breakdown if previous and r["week_date"] == previous],
    }


def build_files(
    brent: Rows,
    fx: Rows,
    latest_bulletin: str | None,
    crude_weekly: Rows,
    breakdown: Rows,
    stats: Rows,
    news: Rows,
    generated_at: str,
) -> dict[str, Any]:
    """Dateipfad -> JSON-Inhalt; Zeitreihen aufsteigend, Brent/FX absteigend."""
    by_country: dict[str, Rows] = defaultdict(list)
    for row in sorted(breakdown, key=lambda r: (r["week_date"], r["fuel_type"])):
        by_country[row["country_code"]].append(row)
    summary = {
        "generatedAt": generated_at,
        "brent": sorted(brent, key=lambda r: r["date"], reverse=True)[:BRENT_DAYS],
        "fx": sorted(fx, key=lambda r: r["date"], reverse=True)[:FX_DAYS],
        "latestBulletin": latest_bulletin,
        "weeks": latest_weeks(crude_weekly, breakdown),
        "countryStats": stats,
    }
    files: dict[str, Any] = {
        "summary.json": summary,
        "crude-weekly.json": sorted(crude_weekly, key=lambda r: r["week_date"]),
        "news.json": news,
    }
    for code, rows in by_country.items():
        files[f"series/{code}.json"] = rows
    return files


def latest_bulletin(client) -> str | None:
    data = (
        client.table("fuel_prices")
        .select("week_date")
        .order("week_date", desc=True)
        .limit(1)
        .execute()
        .data
    )
    return data[0]["week_date"] if data else None


def collect(client) -> dict[str, Any]:
    return build_files(
        brent=fetch_all(
            client, "crude_prices", "date,price_usd_bbl", ["date"], benchmark="brent"
        ),
        fx=fetch_all(client, "fx_rates", "date,rate", ["date"], pair="EURUSD"),
        latest_bulletin=latest_bulletin(client),
        crude_weekly=fetch_all(
            client,
            "crude_weekly",
            "week_date,brent_usd_bbl,eurusd,brent_eur_1000l,trading_days",
            ["week_date"],
        ),
        breakdown=fetch_all(
            client,
            "fuel_price_breakdown",
            BREAKDOWN_COLUMNS,
            ["country_code", "fuel_type", "week_date"],
        ),
        stats=fetch_all(
            client,
            "country_stats",
            "country_code,fuel_type,lag_weeks,asymmetry,computed_at",
            ["country_code", "fuel_type"],
        ),
        news=fetch_all(
            client,
            "news_items",
            "title,url,published_at,relevance,direction,source",
            ["published_at"],
        ),
        generated_at=datetime.now(UTC).isoformat(),
    )


def write_files(files: dict[str, Any], out: Path) -> None:
    for name, content in files.items():
        path = out / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(content, ensure_ascii=False, separators=(",", ":")))
    log.info("exported %d files to %s", len(files), out)


def export(client, out: Path) -> None:
    write_files(collect(client), out)

"""Supabase-Zugriff (service_role)."""

from datetime import date
from typing import Any

from ingest.config import require
from supabase import Client, create_client

BATCH_SIZE = 1000


def get_client() -> Client:
    return create_client(require("SUPABASE_URL"), require("SUPABASE_SERVICE_ROLE_KEY"))


def upsert(
    client: Client,
    table: str,
    rows: list[dict[str, Any]],
    on_conflict: str,
    batch_size: int = BATCH_SIZE,
) -> int:
    for i in range(0, len(rows), batch_size):
        client.table(table).upsert(
            rows[i : i + batch_size], on_conflict=on_conflict
        ).execute()
    return len(rows)


def latest_date(client: Client, table: str, **filters: str) -> date | None:
    query = client.table(table).select("date")
    for column, value in filters.items():
        query = query.eq(column, value)
    data = query.order("date", desc=True).limit(1).execute().data
    return date.fromisoformat(data[0]["date"]) if data else None

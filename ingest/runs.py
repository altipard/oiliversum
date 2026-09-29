"""Protokoll pro Job in ingest_runs."""

from contextlib import contextmanager
from datetime import UTC, datetime

ERROR_MAX = 2000


class Run:
    def __init__(self) -> None:
        self.rows_written = 0


@contextmanager
def track_run(client, job: str):
    """running -> success/failed. Exceptions werden protokolliert und weitergereicht."""
    table = client.table("ingest_runs")
    run_id = table.insert({"job": job, "status": "running"}).execute().data[0]["id"]
    run = Run()

    def finish(status: str, error: str | None = None) -> None:
        client.table("ingest_runs").update(
            {
                "status": status,
                "finished_at": datetime.now(UTC).isoformat(),
                "rows_written": run.rows_written,
                "error": error,
            }
        ).eq("id", run_id).execute()

    try:
        yield run
    except Exception as exc:
        finish("failed", f"{type(exc).__name__}: {exc}"[:ERROR_MAX])
        raise
    else:
        finish("success")

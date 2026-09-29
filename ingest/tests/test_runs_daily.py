from datetime import date
from unittest.mock import MagicMock

import httpx
import pytest

from ingest import __main__ as cli
from ingest import db
from ingest.config import ConfigError
from ingest.jobs import daily
from ingest.runs import ERROR_MAX, track_run
from ingest.sources.crude import EiaCrude, FredCrude, make_crude_source


def make_client(run_id=7):
    client = MagicMock()
    client.table.return_value.insert.return_value.execute.return_value.data = [
        {"id": run_id}
    ]
    return client


def updates(client):
    return [c.args[0] for c in client.table.return_value.update.call_args_list]


def test_run_success_records_rows_written():
    client = make_client()
    with track_run(client, "crude") as run:
        run.rows_written = 12
    client.table.return_value.insert.assert_called_once_with(
        {"job": "crude", "status": "running"}
    )
    (upd,) = updates(client)
    assert upd["status"] == "success"
    assert upd["rows_written"] == 12
    assert upd["error"] is None
    assert upd["finished_at"]


def test_run_failure_records_truncated_error_and_reraises():
    client = make_client()
    with pytest.raises(RuntimeError), track_run(client, "fx"):
        raise RuntimeError("x" * 5000)
    (upd,) = updates(client)
    assert upd["status"] == "failed"
    assert len(upd["error"]) == ERROR_MAX
    assert upd["error"].startswith("RuntimeError: xxx")


def test_incremental_start():
    assert daily.incremental_start(None) == date(2015, 1, 1)
    assert daily.incremental_start(date(2026, 9, 20)) == date(2026, 9, 10)
    assert daily.incremental_start(date(2026, 3, 5)) == date(2026, 2, 23)


def test_latest_date_and_empty_table():
    client = MagicMock()
    chain = client.table.return_value.select.return_value.eq.return_value
    execute = chain.order.return_value.limit.return_value.execute
    execute.return_value.data = [{"date": "2026-09-20"}]
    assert db.latest_date(client, "crude_prices", benchmark="brent") == date(
        2026, 9, 20
    )
    execute.return_value.data = []
    assert db.latest_date(client, "crude_prices", benchmark="brent") is None


def test_upsert_batches_with_on_conflict():
    client = MagicMock()
    rows = [{"i": i} for i in range(2500)]
    assert db.upsert(client, "t", rows, "pair,date", batch_size=1000) == 2500
    calls = client.table.return_value.upsert.call_args_list
    assert [len(c.args[0]) for c in calls] == [1000, 1000, 500]
    assert all(c.kwargs == {"on_conflict": "pair,date"} for c in calls)


def test_source_selection(monkeypatch):
    monkeypatch.setenv("FRED_API_KEY", "k1")
    monkeypatch.setenv("EIA_API_KEY", "k2")
    with httpx.Client() as http:
        monkeypatch.delenv("CRUDE_SOURCE", raising=False)
        assert isinstance(make_crude_source(http), FredCrude)
        monkeypatch.setenv("CRUDE_SOURCE", "fred")
        assert isinstance(make_crude_source(http), FredCrude)
        monkeypatch.setenv("CRUDE_SOURCE", "EIA")
        assert isinstance(make_crude_source(http), EiaCrude)
        monkeypatch.setenv("CRUDE_SOURCE", "bogus")
        with pytest.raises(ConfigError):
            make_crude_source(http)


def test_missing_key_error_names_variable_only(monkeypatch):
    monkeypatch.delenv("FRED_API_KEY", raising=False)
    monkeypatch.delenv("CRUDE_SOURCE", raising=False)
    with (
        httpx.Client() as http,
        pytest.raises(ConfigError, match="FRED_API_KEY is not set"),
    ):
        make_crude_source(http)


def test_failing_job_does_not_stop_others_and_is_reported(monkeypatch):
    client = make_client()
    ran = []

    def boom(_client, _run):
        raise RuntimeError("down")

    def ok(_client, run):
        ran.append("fx")
        run.rows_written = 3

    monkeypatch.setitem(daily.JOBS, "crude", boom)
    monkeypatch.setitem(daily.JOBS, "fx", ok)
    monkeypatch.setitem(daily.JOBS, "bulletin", lambda _client, _run: None)
    monkeypatch.setitem(daily.JOBS, "stats", lambda _client, _run: None)
    assert daily.run_daily(client) == ["crude"]
    assert ran == ["fx"]
    statuses = [u["status"] for u in updates(client)]
    assert statuses == ["failed", "success", "success", "success"]


def test_unknown_job_rejected():
    with pytest.raises(ValueError):
        daily.run_daily(make_client(), ["nope"])


@pytest.mark.parametrize(("failed", "code"), [([], 0), (["crude"], 1)])
def test_exit_code(monkeypatch, failed, code):
    monkeypatch.setattr(cli, "load_env", lambda: None)
    monkeypatch.setattr(cli.db, "get_client", lambda: object())
    seen = {}

    def fake(_client, only):
        seen["only"] = only
        return failed

    monkeypatch.setattr(cli, "run_daily", fake)
    assert cli.main(["daily", "--only", "crude,fx"]) == code
    assert seen["only"] == ["crude", "fx"]

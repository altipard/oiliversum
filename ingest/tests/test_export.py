import json
from unittest.mock import MagicMock

from ingest import __main__ as cli
from ingest import export


def breakdown(week, country, fuel="euro95"):
    return {
        "week_date": week,
        "country_code": country,
        "fuel_type": fuel,
        "eur_1000l_with_tax": 1700.0,
    }


def build(**overrides):
    args = {
        "brent": [],
        "fx": [],
        "latest_bulletin": None,
        "crude_weekly": [],
        "breakdown": [],
        "stats": [],
        "news": [],
        "generated_at": "2026-10-04T06:00:00+00:00",
    }
    return export.build_files(**(args | overrides))


def test_summary_keeps_newest_brent_and_fx_descending():
    brent = [{"date": f"2026-09-{d:02d}", "price_usd_bbl": d} for d in range(1, 21)]
    fx = [{"date": f"2026-08-{d:02d}", "rate": 1.1} for d in range(1, 32)]
    fx.append({"date": "2026-09-01", "rate": 1.2})
    summary = build(brent=brent, fx=fx)["summary.json"]
    assert [r["price_usd_bbl"] for r in summary["brent"]] == list(range(20, 5, -1))
    assert len(summary["fx"]) == export.FX_DAYS
    assert summary["fx"][0]["date"] == "2026-09-01"


def test_latest_weeks_use_newest_crude_weeks():
    crude = [{"week_date": w} for w in ("2026-09-14", "2026-09-28", "2026-09-21")]
    rows = [breakdown(w, "DE") for w in ("2026-09-21", "2026-09-28", "2026-10-05")]
    weeks = build(crude_weekly=crude, breakdown=rows)["summary.json"]["weeks"]
    assert weeks["latestWeek"] == "2026-09-28"
    assert weeks["previousWeek"] == "2026-09-21"
    assert [r["week_date"] for r in weeks["latest"]] == ["2026-09-28"]
    assert [r["week_date"] for r in weeks["previous"]] == ["2026-09-21"]


def test_latest_weeks_empty():
    weeks = build()["summary.json"]["weeks"]
    assert weeks == {
        "latestWeek": None,
        "previousWeek": None,
        "latest": [],
        "previous": [],
    }


def test_series_per_country_sorted_by_week_and_fuel():
    rows = [
        breakdown("2026-09-28", "DE", "euro95"),
        breakdown("2026-09-21", "DE", "euro95"),
        breakdown("2026-09-21", "DE", "diesel"),
        breakdown("2026-09-21", "PL", "diesel"),
    ]
    files = build(breakdown=rows)
    assert [(r["week_date"], r["fuel_type"]) for r in files["series/DE.json"]] == [
        ("2026-09-21", "diesel"),
        ("2026-09-21", "euro95"),
        ("2026-09-28", "euro95"),
    ]
    assert len(files["series/PL.json"]) == 1


def test_fetch_all_pages_until_short_page(monkeypatch):
    monkeypatch.setattr(export, "PAGE_SIZE", 3)
    client = MagicMock()
    query = client.table.return_value.select.return_value
    query.eq.return_value = query
    query.order.return_value = query
    query.range.return_value.execute.side_effect = [
        MagicMock(data=[{"i": i} for i in range(3)]),
        MagicMock(data=[{"i": 3}]),
    ]
    rows = export.fetch_all(client, "t", "i", ["i"], pair="EURUSD")
    assert len(rows) == 4
    assert [c.args for c in query.range.call_args_list] == [(0, 2), (3, 5)]
    query.eq.assert_called_with("pair", "EURUSD")


def test_write_files_creates_subdirectories(tmp_path):
    export.write_files({"summary.json": {"a": "ä"}, "series/DE.json": [1]}, tmp_path)
    assert json.loads((tmp_path / "summary.json").read_text()) == {"a": "ä"}
    assert json.loads((tmp_path / "series/DE.json").read_text()) == [1]


def test_cli_export_failure_returns_2(monkeypatch, tmp_path):
    monkeypatch.setattr(cli, "load_env", lambda: None)
    monkeypatch.setattr(cli.db, "get_client", MagicMock())

    def boom(_client, _out):
        raise RuntimeError("down")

    monkeypatch.setattr(cli, "export", boom)
    assert cli.main(["export", "--out", str(tmp_path)]) == 2

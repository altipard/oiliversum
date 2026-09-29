from datetime import date

import httpx
import pytest
import respx

from ingest.http import SourceError
from ingest.sources import crude
from ingest.sources.crude import EIA_URL, EiaCrude, parse_eia


def test_parse_eia_fixture(load_fixture):
    obs = parse_eia(load_fixture("eia_brent.json"), "brent")
    assert len(obs) == 20
    assert obs[0].date == date(2026, 8, 3)
    assert obs[0].price_usd_bbl == 88.9
    assert isinstance(obs[0].price_usd_bbl, float)
    assert obs[0].benchmark == "brent"
    assert obs[0].source == "eia"
    by_date = {o.date: o.price_usd_bbl for o in obs}
    assert by_date[date(2026, 8, 10)] == 92.74
    assert by_date[date(2026, 8, 28)] == 89.75
    assert list(by_date) == sorted(by_date)


def test_parse_eia_skips_missing_values():
    payload = {
        "response": {
            "data": [
                {"period": "2026-08-03", "value": None},
                {"period": "2026-08-04", "value": ""},
                {"period": "2026-08-05", "value": "80.5"},
            ]
        }
    }
    assert [o.date for o in parse_eia(payload, "wti")] == [date(2026, 8, 5)]


@respx.mock
def test_fetch_query_and_series(load_fixture):
    route = respx.get(EIA_URL).mock(
        return_value=httpx.Response(200, json=load_fixture("eia_brent.json"))
    )
    with httpx.Client() as client:
        obs = EiaCrude("k", client).fetch("wti", date(2026, 8, 1))
    params = route.calls.last.request.url.params
    assert params["facets[series][]"] == "RWTC"
    assert params["frequency"] == "daily"
    assert params["start"] == "2026-08-01"
    assert params["data[0]"] == "value"
    assert len(obs) == 20


@respx.mock
def test_fetch_paginates(monkeypatch):
    monkeypatch.setattr(crude, "EIA_PAGE", 2)

    def page(rows):
        return httpx.Response(
            200,
            json={"response": {"data": [{"period": p, "value": "1.5"} for p in rows]}},
        )

    route = respx.get(EIA_URL).mock(
        side_effect=[
            page(["2026-08-03", "2026-08-04"]),
            page(["2026-08-05", "2026-08-06"]),
            page(["2026-08-07"]),
        ]
    )
    with httpx.Client() as client:
        obs = EiaCrude("k", client).fetch("brent", date(2026, 8, 1))
    assert len(obs) == 5
    assert [c.request.url.params["offset"] for c in route.calls] == ["0", "2", "4"]


@respx.mock
def test_eia_error_hides_key():
    respx.get(EIA_URL).mock(return_value=httpx.Response(403))
    with httpx.Client() as client, pytest.raises(SourceError) as info:
        EiaCrude("SECRETKEY123", client).fetch("brent", date(2026, 8, 1))
    assert "SECRETKEY123" not in str(info.value)


def test_unknown_benchmark():
    with httpx.Client() as client, pytest.raises(ValueError):
        EiaCrude("k", client).fetch("dubai", date(2026, 8, 1))

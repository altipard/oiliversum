from datetime import date

import httpx
import pytest
import respx

from ingest.http import SourceError
from ingest.sources.crude import FRED_URL, FredCrude, parse_eia, parse_fred


def test_parse_fred_brent_skips_dot(load_fixture):
    payload = load_fixture("fred_brent.json")
    assert len(payload["observations"]) == 21
    obs = parse_fred(payload, "brent")
    # 2026-08-31 kommt als value "." und wird uebersprungen
    assert len(obs) == 20
    assert date(2026, 8, 31) not in {o.date for o in obs}
    assert obs[0].date == date(2026, 8, 3)
    assert obs[0].price_usd_bbl == 88.9
    assert isinstance(obs[0].price_usd_bbl, float)
    assert obs[0].benchmark == "brent"
    assert obs[0].source == "fred"
    assert {o.date: o.price_usd_bbl for o in obs}[date(2026, 8, 10)] == 92.74


def test_parse_fred_wti(load_fixture):
    obs = parse_fred(load_fixture("fred_wti.json"), "wti")
    assert len(obs) == 21
    by_date = {o.date: o.price_usd_bbl for o in obs}
    assert by_date[date(2026, 8, 3)] == 81.96
    assert by_date[date(2026, 8, 10)] == 83.76
    assert by_date[date(2026, 8, 31)] == 87.03
    assert {o.benchmark for o in obs} == {"wti"}


def test_fred_and_eia_agree_on_brent(load_fixture):
    fred = {
        o.date: o.price_usd_bbl
        for o in parse_fred(load_fixture("fred_brent.json"), "brent")
    }
    eia = {
        o.date: o.price_usd_bbl
        for o in parse_eia(load_fixture("eia_brent.json"), "brent")
    }
    common = fred.keys() & eia.keys()
    assert common
    assert all(fred[d] == eia[d] for d in common)


@respx.mock
def test_fetch_query_and_series(load_fixture):
    route = respx.get(FRED_URL).mock(
        return_value=httpx.Response(200, json=load_fixture("fred_wti.json"))
    )
    with httpx.Client() as client:
        obs = FredCrude("k", client).fetch("wti", date(2026, 8, 1))
    params = route.calls.last.request.url.params
    assert params["series_id"] == "DCOILWTICO"
    assert params["observation_start"] == "2026-08-01"
    assert params["file_type"] == "json"
    assert len(obs) == 21


@respx.mock
def test_brent_series_id(load_fixture):
    route = respx.get(FRED_URL).mock(
        return_value=httpx.Response(200, json=load_fixture("fred_brent.json"))
    )
    with httpx.Client() as client:
        FredCrude("k", client).fetch("brent", date(2026, 8, 1))
    assert route.calls.last.request.url.params["series_id"] == "DCOILBRENTEU"


@respx.mock
def test_fred_error_hides_key():
    respx.get(FRED_URL).mock(return_value=httpx.Response(400))
    with httpx.Client() as client, pytest.raises(SourceError) as info:
        FredCrude("SECRETKEY123", client).fetch("brent", date(2026, 8, 1))
    assert "SECRETKEY123" not in str(info.value)


def test_unknown_benchmark():
    with httpx.Client() as client, pytest.raises(ValueError):
        FredCrude("k", client).fetch("dubai", date(2026, 8, 1))

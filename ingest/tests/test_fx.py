from datetime import date

import httpx
import respx

from ingest.sources.fx import FRANKFURTER_URL, FrankfurterEcb, parse_frankfurter


def test_parse_frankfurter_fixture(load_fixture):
    payload = load_fixture("frankfurter_eurusd.json")
    obs = parse_frankfurter(payload, "EURUSD")
    assert len(obs) == len(payload) == 22
    first = obs[0]
    assert first.date == date(2026, 7, 31)
    assert first.pair == "EURUSD"
    assert isinstance(first.rate, float) and first.rate == 1.1485
    assert {o.date for o in obs if o.date == date(2026, 8, 3)}
    assert next(o for o in obs if o.date == date(2026, 8, 3)).rate == 1.1535


@respx.mock
def test_fetch_sends_ecb_query(load_fixture):
    route = respx.get(FRANKFURTER_URL).mock(
        return_value=httpx.Response(200, json=load_fixture("frankfurter_eurusd.json"))
    )
    with httpx.Client() as client:
        obs = FrankfurterEcb(client).fetch(
            "EURUSD", date(2026, 8, 1), date(2026, 8, 31)
        )
    params = dict(route.calls.last.request.url.params)
    assert params == {
        "from": "2026-08-01",
        "to": "2026-08-31",
        "base": "EUR",
        "quotes": "USD",
        "providers": "ECB",
    }
    assert len(obs) == 22

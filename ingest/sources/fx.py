"""EUR/USD-Referenzkurse der EZB ueber Frankfurter."""

from datetime import date
from typing import Protocol

import httpx

from ingest.http import get_json
from ingest.models import FxObservation

FRANKFURTER_URL = "https://api.frankfurter.dev/v2/rates"


class FxSource(Protocol):
    def fetch(self, pair: str, start: date, end: date) -> list[FxObservation]: ...


def parse_frankfurter(payload: list[dict], pair: str) -> list[FxObservation]:
    return [
        FxObservation(date.fromisoformat(r["date"]), pair, float(r["rate"]))
        for r in payload
        if r.get("rate") is not None
    ]


class FrankfurterEcb:
    def __init__(self, client: httpx.Client) -> None:
        self._client = client

    def fetch(self, pair: str, start: date, end: date) -> list[FxObservation]:
        if len(pair) != 6 or not pair.isalpha():
            raise ValueError(f"invalid pair {pair!r}")
        params = {
            "from": start.isoformat(),
            "to": end.isoformat(),
            "base": pair[:3],
            "quotes": pair[3:],
            "providers": "ECB",
        }
        return parse_frankfurter(get_json(self._client, FRANKFURTER_URL, params), pair)

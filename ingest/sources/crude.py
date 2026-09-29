"""Rohoelpreise (Brent, WTI in USD/bbl) von FRED oder EIA."""

from datetime import date
from typing import Protocol

import httpx

from ingest.config import crude_source_name, require
from ingest.http import SourceError, get_json
from ingest.models import CrudeObservation

FRED_URL = "https://api.stlouisfed.org/fred/series/observations"
FRED_SERIES = {"brent": "DCOILBRENTEU", "wti": "DCOILWTICO"}

EIA_URL = "https://api.eia.gov/v2/petroleum/pri/spt/data/"
EIA_SERIES = {"brent": "RBRTE", "wti": "RWTC"}
EIA_PAGE = 5000


class CrudeSource(Protocol):
    def fetch(self, benchmark: str, start: date) -> list[CrudeObservation]: ...


def _check(benchmark: str, series: dict[str, str]) -> str:
    try:
        return series[benchmark]
    except KeyError:
        raise ValueError(f"unknown benchmark {benchmark!r}") from None


def _price(raw) -> float | None:
    """FRED liefert '.', EIA ggf. None fuer fehlende Tage."""
    if raw is None:
        return None
    text = str(raw).strip()
    if text in ("", "."):
        return None
    return float(text)


def parse_fred(payload: dict, benchmark: str) -> list[CrudeObservation]:
    out = []
    for obs in payload["observations"]:
        price = _price(obs["value"])
        if price is None:
            continue
        out.append(
            CrudeObservation(date.fromisoformat(obs["date"]), benchmark, price, "fred")
        )
    return out


def parse_eia(payload: dict, benchmark: str) -> list[CrudeObservation]:
    out = []
    for row in payload["response"]["data"]:
        price = _price(row["value"])
        if price is None:
            continue
        out.append(
            CrudeObservation(date.fromisoformat(row["period"]), benchmark, price, "eia")
        )
    return out


class FredCrude:
    def __init__(self, api_key: str, client: httpx.Client) -> None:
        self._key = api_key
        self._client = client

    def fetch(self, benchmark: str, start: date) -> list[CrudeObservation]:
        params = {
            "series_id": _check(benchmark, FRED_SERIES),
            "api_key": self._key,
            "file_type": "json",
            "observation_start": start.isoformat(),
        }
        return parse_fred(get_json(self._client, FRED_URL, params), benchmark)


class EiaCrude:
    def __init__(self, api_key: str, client: httpx.Client) -> None:
        self._key = api_key
        self._client = client

    def fetch(self, benchmark: str, start: date) -> list[CrudeObservation]:
        series = _check(benchmark, EIA_SERIES)
        out: list[CrudeObservation] = []
        offset = 0
        while True:
            params = {
                "api_key": self._key,
                "frequency": "daily",
                "data[0]": "value",
                "facets[series][]": series,
                "start": start.isoformat(),
                "sort[0][column]": "period",
                "sort[0][direction]": "asc",
                "length": EIA_PAGE,
                "offset": offset,
            }
            payload = get_json(self._client, EIA_URL, params)
            rows = payload["response"]["data"]
            out.extend(parse_eia(payload, benchmark))
            offset += len(rows)
            if not rows or len(rows) < EIA_PAGE:
                return out
            if offset > 1_000_000:
                raise SourceError("EIA pagination did not terminate")


def make_crude_source(client: httpx.Client) -> CrudeSource:
    name = crude_source_name()
    if name == "eia":
        return EiaCrude(require("EIA_API_KEY"), client)
    return FredCrude(require("FRED_API_KEY"), client)

"""HTTP-Helfer mit Timeout und Retry. Fehlertexte enthalten nie die Query (API-Keys)."""

import time
from collections.abc import Callable
from typing import Any

import httpx

TIMEOUT = 30.0
MAX_ATTEMPTS = 4
RETRY_STATUS = {429, 500, 502, 503, 504}


class SourceError(RuntimeError):
    pass


def _where(url: str) -> str:
    parsed = httpx.URL(url)
    return f"{parsed.host}{parsed.path}"


def get_json(
    client: httpx.Client,
    url: str,
    params: dict[str, Any] | None = None,
    *,
    sleep: Callable[[float], None] | None = None,
) -> Any:
    where = _where(url)
    last = "no attempt"
    for attempt in range(MAX_ATTEMPTS):
        if attempt:
            (sleep or time.sleep)(min(2.0**attempt, 30.0))
        try:
            resp = client.get(url, params=params, timeout=TIMEOUT)
        except httpx.TransportError as exc:
            last = f"{type(exc).__name__} for {where}"
            continue
        if resp.status_code in RETRY_STATUS:
            last = f"HTTP {resp.status_code} for {where}"
            continue
        if resp.status_code >= 400:
            raise SourceError(f"HTTP {resp.status_code} for {where}")
        try:
            return resp.json()
        except ValueError:
            raise SourceError(f"invalid JSON from {where}") from None
    raise SourceError(f"giving up after {MAX_ATTEMPTS} attempts: {last}")

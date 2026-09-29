"""Konfiguration aus Umgebung bzw. .env (Pfad ueber OILIVERSUM_ENV_FILE)."""

import os
from datetime import date

from dotenv import load_dotenv

BACKFILL_START = date(2015, 1, 1)
OVERLAP_DAYS = 10

BULLETIN_PAGE_URL = "https://energy.ec.europa.eu/data-and-analysis/weekly-oil-bulletin_en"
BULLETIN_FALLBACK_URL = (
    "https://energy.ec.europa.eu/document/download/"
    "906e60ca-8b6a-44e7-8589-652854d2fd3f_en"
    "?filename=Weekly_Oil_Bulletin_Prices_History_maticni_4web.xlsx"
)
BULLETIN_OVERLAP_WEEKS = 8


class ConfigError(RuntimeError):
    pass


def load_env() -> None:
    """Laedt die .env; bereits gesetzte Umgebungsvariablen haben Vorrang."""
    load_dotenv(os.environ.get("OILIVERSUM_ENV_FILE", ".env"))


def require(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise ConfigError(f"{name} is not set")
    return value


def crude_source_name() -> str:
    name = os.environ.get("CRUDE_SOURCE", "").strip().lower() or "fred"
    if name not in ("fred", "eia"):
        raise ConfigError(f"CRUDE_SOURCE must be 'fred' or 'eia', got {name!r}")
    return name

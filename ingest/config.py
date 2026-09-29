"""Konfiguration aus Umgebung bzw. .env (Pfad ueber OILIVERSUM_ENV_FILE)."""

import os
from datetime import date

from dotenv import load_dotenv

BACKFILL_START = date(2015, 1, 1)
OVERLAP_DAYS = 10


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

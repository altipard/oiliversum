"""Weitergabe von Rohoelpreis-Aenderungen an den Nettopreis: Verzoegerung und Asymmetrie.

Reine Rechenfunktionen ohne DB-Zugriff. Eingabe sind Zeilen der View
fuel_price_breakdown (week_date, country_code, fuel_type, eur_1000l_without_tax,
crude_eur_1000l).
"""

from typing import Any

import numpy as np
import pandas as pd

MAX_LAG = 8  # Lags 0..8 fuer Korrelation und OLS
HORIZON = 2  # asymmetry summiert die Koeffizienten der Lags 0..2
MIN_OBS = 104
WEEK = pd.Timedelta(days=7)

LAG_COLUMNS = [f"dcrude_{i}" for i in range(MAX_LAG + 1)]


def weekly_changes(series: pd.DataFrame) -> pd.DataFrame:
    """Wochendifferenzen einer Reihe (ein Land, ein Kraftstoff).

    Spalten: dnet (Delta Nettopreis) und dcrude_i (Delta Rohoel i Wochen frueher),
    Index: week_date. Differenzen nur zwischen Wochen im Abstand von genau 7 Tagen;
    Luecken und NULL werden nicht ueberbrueckt, Zeilen mit fehlendem Wert fallen raus.
    """
    s = (
        series.assign(week_date=pd.to_datetime(series["week_date"]))
        .set_index("week_date")
        .sort_index()
    )
    net = pd.to_numeric(s["eur_1000l_without_tax"], errors="coerce")
    crude = pd.to_numeric(s["crude_eur_1000l"], errors="coerce")
    consecutive = s.index.to_series().diff() == WEEK
    dnet = net.diff().where(consecutive)
    dcrude = crude.diff().where(consecutive)

    out = pd.DataFrame({"dnet": dnet}, index=s.index)
    for i, col in enumerate(LAG_COLUMNS):
        out[col] = dcrude.reindex(s.index - i * WEEK).to_numpy()
    return out.dropna()


def lag_weeks(changes: pd.DataFrame) -> int | None:
    """argmax ueber i = 0..MAX_LAG von corr(dcrude_{t-i}, dnet_t)."""
    corrs = np.array([changes["dnet"].corr(changes[c]) for c in LAG_COLUMNS])
    if np.isnan(corrs).all():
        return None
    return int(np.nanargmax(corrs))


def asymmetry(changes: pd.DataFrame) -> float:
    """OLS mit getrennten Koeffizienten fuer Anstiege und Rueckgaenge.

    dnet_t = a + sum_i b+_i * max(dcrude_{t-i}, 0) + sum_i b-_i * min(dcrude_{t-i}, 0)
    Ergebnis: sum_{i<=HORIZON} b+_i - sum_{i<=HORIZON} b-_i; positiv heisst,
    Anstiege werden schneller weitergegeben als Rueckgaenge.
    """
    lags = changes[LAG_COLUMNS].to_numpy()
    design = np.column_stack(
        [np.ones(len(lags)), np.maximum(lags, 0), np.minimum(lags, 0)]
    )
    beta, *_ = np.linalg.lstsq(design, changes["dnet"].to_numpy(), rcond=None)
    rises = beta[1 : 2 + MAX_LAG]
    falls = beta[2 + MAX_LAG :]
    value = rises[: HORIZON + 1].sum() - falls[: HORIZON + 1].sum()
    return round(float(value), 4) + 0.0  # + 0.0: kein -0.0


def series_stats(series: pd.DataFrame) -> tuple[int | None, float | None]:
    """(lag_weeks, asymmetry) einer Reihe; beide None unter MIN_OBS Beobachtungen."""
    changes = weekly_changes(series)
    if len(changes) < MIN_OBS:
        return None, None
    return lag_weeks(changes), asymmetry(changes)


def country_stats(frame: pd.DataFrame) -> list[dict[str, Any]]:
    """Eine Zeile je (country_code, fuel_type) fuer public.country_stats."""
    rows = []
    for (country, fuel), series in frame.groupby(["country_code", "fuel_type"]):
        lag, asym = series_stats(series)
        rows.append(
            {
                "country_code": country,
                "fuel_type": fuel,
                "lag_weeks": lag,
                "asymmetry": asym,
            }
        )
    return rows

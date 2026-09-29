from datetime import date, timedelta
from unittest.mock import MagicMock

import numpy as np
import pandas as pd
import pytest

from ingest import stats
from ingest.jobs import daily
from ingest.runs import Run

START = date(2015, 1, 5)


def make_series(dcrude, dnet, country="DE", fuel="euro95"):
    """Levels aus Wochendifferenzen; erste Woche ohne Differenz."""
    crude = 500 + np.concatenate([[0.0], np.cumsum(dcrude)])
    net = 1000 + np.concatenate([[0.0], np.cumsum(dnet)])
    return pd.DataFrame(
        {
            "week_date": [
                (START + timedelta(weeks=i)).isoformat() for i in range(len(crude))
            ],
            "country_code": country,
            "fuel_type": fuel,
            "eur_1000l_without_tax": net,
            "crude_eur_1000l": crude,
        }
    )


def lagged(x, i):
    return np.concatenate([np.zeros(i), x[: len(x) - i]])


def random_changes(n=400, seed=1):
    return np.random.default_rng(seed).normal(0, 20, n)


def test_lag_detected_from_delayed_pass_through():
    dc = random_changes()
    lag, _ = stats.series_stats(make_series(dc, lagged(dc, 3)))
    assert lag == 3


def test_symmetric_pass_through_has_zero_asymmetry():
    dc = random_changes()
    dnet = 0.6 * dc + 0.3 * lagged(dc, 1)
    lag, asym = stats.series_stats(make_series(dc, dnet))
    assert lag == 0
    assert abs(asym) < 1e-6


def test_rises_passed_through_faster_than_falls():
    dc = random_changes()
    falls = np.minimum(dc, 0)
    # Anstiege sofort voll, Rueckgaenge zu je 25 % ueber 4 Wochen
    dnet = np.maximum(dc, 0) + 0.25 * sum(lagged(falls, i) for i in range(4))
    _, asym = stats.series_stats(make_series(dc, dnet))
    # sum b+_0..2 - sum b-_0..2 = 1 - 0.75
    assert asym == pytest.approx(0.25, abs=1e-4)


def test_gap_is_not_bridged():
    dc = random_changes(60)
    series = make_series(dc, dc)
    gap = pd.Timestamp(series["week_date"][30])
    changes = stats.weekly_changes(series.drop(index=30))
    # Woche nach der Luecke hat keine Differenz, damit fehlen auch ihre 8 Folgewochen als Lag
    affected = [gap + pd.Timedelta(weeks=i) for i in range(1, stats.MAX_LAG + 2)]
    assert not changes.index.isin(affected).any()
    assert changes.index.min() == pd.Timestamp(series["week_date"][9])
    assert (changes.index > affected[-1]).any()


def test_null_interrupts_differences():
    dc = random_changes(60)
    series = make_series(dc, dc)
    series.loc[30, "eur_1000l_without_tax"] = None
    changes = stats.weekly_changes(series)
    week = pd.Timestamp(series["week_date"][30])
    assert week not in changes.index
    assert week + pd.Timedelta(weeks=1) not in changes.index


@pytest.mark.parametrize(("weeks", "has_values"), [(112, False), (113, True)])
def test_minimum_observations(weeks, has_values):
    # n Wochen -> n - 1 Differenzen -> n - 1 - MAX_LAG vollstaendige Zeilen
    dc = random_changes(weeks - 1)
    lag, asym = stats.series_stats(make_series(dc, dc))
    assert (lag is not None) is has_values
    assert (asym is not None) is has_values


def test_country_stats_one_row_per_series():
    dc = random_changes()
    frame = pd.concat(
        [
            make_series(dc, lagged(dc, 2), "DE", "diesel"),
            make_series(dc, dc, "FR", "euro95"),
            make_series(dc[:50], dc[:50], "IT", "euro95"),
        ]
    )
    rows = {(r["country_code"], r["fuel_type"]): r for r in stats.country_stats(frame)}
    assert set(rows) == {("DE", "diesel"), ("FR", "euro95"), ("IT", "euro95")}
    assert rows["DE", "diesel"]["lag_weeks"] == 2
    assert rows["FR", "euro95"]["lag_weeks"] == 0
    assert rows["IT", "euro95"]["lag_weeks"] is None
    assert rows["IT", "euro95"]["asymmetry"] is None


def test_stats_job_pages_view_and_upserts_one_row_per_series():
    dc = random_changes(519)
    frame = pd.concat(
        [
            make_series(dc, lagged(dc, 1), "DE", "diesel"),
            make_series(dc, lagged(dc, 1), "DE", "euro95"),
            make_series(dc[:49], dc[:49], "FR", "diesel"),
        ]
    )
    records = frame.to_dict("records")
    assert len(records) == 1090

    client = MagicMock()
    query = client.table.return_value.select.return_value.gte.return_value
    ranged = query.order.return_value.order.return_value.order.return_value.range
    ranged.return_value.execute.side_effect = [
        MagicMock(data=records[:1000]),
        MagicMock(data=records[1000:]),
    ]
    run = Run()
    daily.stats_job(client, run)

    assert [c.args for c in ranged.call_args_list] == [(0, 999), (1000, 1999)]
    (call,) = client.table.return_value.upsert.call_args_list
    assert call.kwargs == {"on_conflict": "country_code,fuel_type"}
    rows = {(r["country_code"], r["fuel_type"]): r for r in call.args[0]}
    assert set(rows) == {("DE", "diesel"), ("DE", "euro95"), ("FR", "diesel")}
    assert rows["DE", "diesel"]["lag_weeks"] == 1
    assert rows["FR", "diesel"]["lag_weeks"] is None
    assert all(r["computed_at"] for r in rows.values())
    assert run.rows_written == 3

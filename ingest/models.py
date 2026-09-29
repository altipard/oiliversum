from dataclasses import dataclass
from datetime import date


@dataclass(frozen=True)
class CrudeObservation:
    date: date
    benchmark: str  # 'brent' | 'wti'
    price_usd_bbl: float
    source: str  # 'fred' | 'eia'

    def as_row(self) -> dict:
        return {
            "date": self.date.isoformat(),
            "benchmark": self.benchmark,
            "price_usd_bbl": self.price_usd_bbl,
            "source": self.source,
        }


@dataclass(frozen=True)
class FxObservation:
    date: date
    pair: str  # z.B. 'EURUSD'; rate = USD je 1 EUR
    rate: float

    def as_row(self) -> dict:
        return {"date": self.date.isoformat(), "pair": self.pair, "rate": self.rate}

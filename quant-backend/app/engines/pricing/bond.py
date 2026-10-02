"""Plain fixed-coupon bond analytics: price, yield, duration and convexity.

Supports periodic compounding (CFA convention) and continuous compounding
(Hull convention). Bonds are valued on a coupon date; accrued interest is not
modelled.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum

import numpy as np
from scipy.optimize import brentq

from app.core.exceptions import ConvergenceError, InvalidInputError


class Compounding(StrEnum):
    PERIODIC = "periodic"
    CONTINUOUS = "continuous"


@dataclass(frozen=True)
class CashFlow:
    time: float
    amount: float
    present_value: float


@dataclass(frozen=True)
class BondAnalytics:
    price: float
    yield_to_maturity: float
    macaulay_duration: float
    modified_duration: float
    convexity: float
    cash_flows: list[CashFlow]


class FixedRateBond:
    """A bullet bond paying ``coupon_rate * face / frequency`` each period."""

    def __init__(
        self,
        coupon_rate: float,
        maturity: float,
        frequency: int = 2,
        face: float = 100.0,
    ) -> None:
        if face <= 0 or maturity <= 0 or frequency <= 0:
            raise InvalidInputError("face, maturity and frequency must be positive")
        if coupon_rate < 0:
            raise InvalidInputError("coupon rate cannot be negative")
        self.coupon_rate = coupon_rate
        self.maturity = maturity
        self.frequency = frequency
        self.face = face
        self.times, self.amounts = self._build_schedule()

    def _build_schedule(self) -> tuple[np.ndarray, np.ndarray]:
        if self.coupon_rate == 0:
            return np.array([self.maturity]), np.array([self.face])
        periods = self.maturity * self.frequency
        n = round(periods)
        if n < 1 or abs(periods - n) > 1e-9:
            raise InvalidInputError("maturity must be a whole number of coupon periods")
        times = np.arange(1, n + 1) / self.frequency
        amounts = np.full(n, self.face * self.coupon_rate / self.frequency)
        amounts[-1] += self.face
        return times, amounts

    # ------------------------------------------------------------------ #

    def discount_factors(self, ytm: float, compounding: Compounding) -> np.ndarray:
        if compounding is Compounding.CONTINUOUS:
            return np.exp(-ytm * self.times)
        base = 1 + ytm / self.frequency
        if base <= 0:
            raise InvalidInputError("yield is below -frequency; discount factors undefined")
        return base ** (-self.frequency * self.times)

    def price(self, ytm: float, compounding: Compounding = Compounding.PERIODIC) -> float:
        return float(np.sum(self.amounts * self.discount_factors(ytm, compounding)))

    def yield_to_maturity(
        self, price: float, compounding: Compounding = Compounding.PERIODIC
    ) -> float:
        if price <= 0:
            raise InvalidInputError("price must be positive")
        lower = -0.99 * self.frequency if compounding is Compounding.PERIODIC else -1.0
        try:
            return float(
                brentq(
                    lambda y: self.price(y, compounding) - price,
                    lower,
                    5.0,
                    xtol=1e-14,
                    maxiter=500,
                )
            )
        except ValueError as exc:
            raise ConvergenceError(f"yield not found for price {price}: {exc}") from exc

    def analytics(
        self,
        *,
        ytm: float | None = None,
        price: float | None = None,
        compounding: Compounding = Compounding.PERIODIC,
    ) -> BondAnalytics:
        """Full analytics from exactly one of ``ytm`` or ``price``."""
        if (ytm is None) == (price is None):
            raise InvalidInputError("provide exactly one of ytm or price")
        compounding = Compounding(compounding)
        if ytm is None:
            assert price is not None
            ytm = self.yield_to_maturity(price, compounding)

        pvs = self.amounts * self.discount_factors(ytm, compounding)
        model_price = float(pvs.sum())
        macaulay = float(np.sum(self.times * pvs) / model_price)

        if compounding is Compounding.CONTINUOUS:
            modified = macaulay
            convexity = float(np.sum(self.times**2 * pvs) / model_price)
        else:
            growth = 1 + ytm / self.frequency
            modified = macaulay / growth
            convexity = float(
                np.sum(pvs * self.times * (self.times + 1 / self.frequency))
                / (model_price * growth**2)
            )

        flows = [
            CashFlow(float(t), float(a), float(pv))
            for t, a, pv in zip(self.times, self.amounts, pvs, strict=True)
        ]
        return BondAnalytics(model_price, ytm, macaulay, modified, convexity, flows)

"""Zero-coupon yield curve construction by bootstrapping (Hull, section 4.5)."""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass

import numpy as np
from scipy.optimize import brentq

from app.core.exceptions import ConvergenceError, InvalidInputError
from app.engines.pricing.bond import FixedRateBond


@dataclass(frozen=True)
class CurveInstrument:
    maturity: float
    coupon_rate: float  # annual; 0 for zero-coupon instruments
    price: float  # per ``face``


@dataclass(frozen=True)
class ZeroPoint:
    maturity: float
    zero_rate: float  # continuously compounded


class ZeroCurve:
    """Continuously compounded zero curve with linear interpolation.

    Rates are flat-extrapolated before the first and after the last pillar.
    """

    def __init__(self, points: Sequence[ZeroPoint]) -> None:
        if not points:
            raise InvalidInputError("a zero curve needs at least one point")
        self.points = sorted(points, key=lambda p: p.maturity)
        self._t = np.array([p.maturity for p in self.points])
        self._r = np.array([p.zero_rate for p in self.points])

    def zero_rate(self, t: float | np.ndarray) -> float | np.ndarray:
        return np.interp(t, self._t, self._r)

    def discount_factor(self, t: float | np.ndarray) -> float | np.ndarray:
        return np.exp(-self.zero_rate(t) * np.asarray(t))


class ZeroCurveBootstrapper:
    """Solves zero rates instrument by instrument, shortest maturity first.

    Coupon dates between solved pillars use linear interpolation; dates beyond
    the last solved pillar interpolate toward the rate being solved for.
    """

    def __init__(self, frequency: int = 2, face: float = 100.0) -> None:
        self.frequency = frequency
        self.face = face

    def build(self, instruments: Sequence[CurveInstrument]) -> ZeroCurve:
        ordered = sorted(instruments, key=lambda i: i.maturity)
        maturities = [i.maturity for i in ordered]
        if len(set(maturities)) != len(maturities):
            raise InvalidInputError("instrument maturities must be unique")

        pillar_t: list[float] = []
        pillar_r: list[float] = []
        for inst in ordered:
            rate = self._solve_pillar(inst, pillar_t, pillar_r)
            pillar_t.append(inst.maturity)
            pillar_r.append(rate)
        return ZeroCurve([ZeroPoint(t, r) for t, r in zip(pillar_t, pillar_r, strict=True)])

    def _solve_pillar(
        self, inst: CurveInstrument, pillar_t: list[float], pillar_r: list[float]
    ) -> float:
        if inst.price <= 0:
            raise InvalidInputError("instrument prices must be positive")
        bond = FixedRateBond(inst.coupon_rate, inst.maturity, self.frequency, self.face)

        def pv_error(candidate: float) -> float:
            if pillar_t:
                rates = np.interp(bond.times, pillar_t + [inst.maturity], pillar_r + [candidate])
            else:
                rates = np.full_like(bond.times, candidate)
            return float(np.sum(bond.amounts * np.exp(-rates * bond.times))) - inst.price

        try:
            return float(brentq(pv_error, -0.5, 2.0, xtol=1e-14, maxiter=500))
        except ValueError as exc:
            raise ConvergenceError(
                f"could not bootstrap the {inst.maturity}y instrument: {exc}"
            ) from exc

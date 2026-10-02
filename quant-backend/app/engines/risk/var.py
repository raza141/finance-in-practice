"""Value at Risk and Expected Shortfall models.

Conventions follow Hull, *Risk Management and Financial Institutions*:

* ``positions`` are signed currency exposures (negative = short).
* P&L is linear in asset returns: ``pnl = returns @ positions``.
* VaR and ES are positive numbers meaning *losses*.
* Multi-day horizons use the square-root-of-time rule on daily statistics.
"""

from __future__ import annotations

import math
from abc import ABC, abstractmethod
from collections.abc import Sequence
from dataclasses import dataclass
from enum import StrEnum
from typing import ClassVar

import numpy as np
import pandas as pd
from scipy.stats import norm

from app.core.exceptions import InvalidInputError
from app.engines.validation import MatrixValidator


@dataclass(frozen=True)
class VaRResult:
    method: str
    confidence: float
    horizon_days: int
    var: float
    expected_shortfall: float
    portfolio_value: float

    @property
    def var_pct(self) -> float | None:
        return self.var / self.portfolio_value if self.portfolio_value else None


class ReturnSeries:
    """Return calculations from price tables."""

    @staticmethod
    def simple(prices: pd.DataFrame) -> pd.DataFrame:
        return prices.sort_index().pct_change().dropna(how="all")

    @staticmethod
    def log(prices: pd.DataFrame) -> pd.DataFrame:
        return np.log(prices.sort_index()).diff().dropna(how="all")


class VaRModel(ABC):
    """Template for VaR models: validates settings, delegates the loss estimate."""

    method: ClassVar[str]

    def __init__(self, confidence: float = 0.99, horizon_days: int = 1) -> None:
        if not 0.5 < confidence < 1:
            raise InvalidInputError("confidence must be in (0.5, 1)")
        if horizon_days < 1:
            raise InvalidInputError("horizon_days must be at least 1")
        self.confidence = confidence
        self.horizon_days = horizon_days

    @property
    @abstractmethod
    def n_assets(self) -> int: ...

    @abstractmethod
    def _var_es(self, positions: np.ndarray) -> tuple[float, float]:
        """Return (VaR, ES) for the configured horizon."""

    def calculate(self, positions: Sequence[float] | np.ndarray) -> VaRResult:
        v = MatrixValidator.vector(positions, self.n_assets, "positions")
        var, es = self._var_es(v)
        return VaRResult(self.method, self.confidence, self.horizon_days, var, es, float(v.sum()))

    def _empirical_tail(self, losses: np.ndarray) -> tuple[float, float]:
        """Hull's convention: with k = n(1 - c), VaR is the k-th worst loss and
        ES the mean of the k worst losses (500 scenarios at 99% -> 5th worst)."""
        k = math.floor(len(losses) * (1 - self.confidence) + 1e-9)
        if k < 1:
            raise InvalidInputError(
                f"need at least {math.ceil(1 / (1 - self.confidence) - 1e-9)} scenarios "
                f"for {self.confidence:.1%} confidence, got {len(losses)}"
            )
        worst = np.sort(losses)[::-1][:k]
        return float(worst[-1]), float(worst.mean())


class _CovarianceModel(VaRModel, ABC):
    """Base for models driven by a daily covariance matrix and mean vector."""

    def __init__(
        self,
        covariance: np.ndarray | Sequence[Sequence[float]],
        mean_returns: Sequence[float] | None = None,
        confidence: float = 0.99,
        horizon_days: int = 1,
    ) -> None:
        super().__init__(confidence, horizon_days)
        n = len(covariance)
        self.covariance = MatrixValidator.covariance(covariance, n)
        self.mean_returns = (
            np.zeros(n)
            if mean_returns is None
            else MatrixValidator.vector(mean_returns, n, "mean_returns")
        )

    @property
    def n_assets(self) -> int:
        return len(self.covariance)


class ParametricVaR(_CovarianceModel):
    """Variance-covariance (delta-normal) VaR with closed-form normal ES."""

    method = "parametric"

    def _var_es(self, positions: np.ndarray) -> tuple[float, float]:
        h = self.horizon_days
        sigma_h = math.sqrt(max(float(positions @ self.covariance @ positions), 0.0) * h)
        mu_h = float(positions @ self.mean_returns) * h
        z = float(norm.ppf(self.confidence))
        var = z * sigma_h - mu_h
        es = sigma_h * float(norm.pdf(z)) / (1 - self.confidence) - mu_h
        return var, es


class MonteCarloVaR(_CovarianceModel):
    """Simulated VaR with normal or fat-tailed Student-t shocks.

    Student-t draws are rescaled so the simulated covariance still equals the
    input covariance; only the tail shape changes.
    """

    method = "monte_carlo"

    class Distribution(StrEnum):
        NORMAL = "normal"
        STUDENT_T = "student_t"

    def __init__(
        self,
        covariance: np.ndarray | Sequence[Sequence[float]],
        mean_returns: Sequence[float] | None = None,
        confidence: float = 0.99,
        horizon_days: int = 1,
        n_sims: int = 10_000,
        distribution: MonteCarloVaR.Distribution | str = "normal",
        degrees_of_freedom: float = 5.0,
        seed: int | None = None,
    ) -> None:
        super().__init__(covariance, mean_returns, confidence, horizon_days)
        if n_sims < 1:
            raise InvalidInputError("n_sims must be positive")
        self.distribution = self.Distribution(distribution)
        if self.distribution is self.Distribution.STUDENT_T and degrees_of_freedom <= 2:
            raise InvalidInputError("degrees_of_freedom must exceed 2 for finite variance")
        self.n_sims = n_sims
        self.degrees_of_freedom = degrees_of_freedom
        self.seed = seed

    def simulate_returns(self) -> np.ndarray:
        """An (n_sims x n_assets) matrix of simulated horizon returns."""
        rng = np.random.default_rng(self.seed)
        z = rng.standard_normal((self.n_sims, self.n_assets))
        if self.distribution is self.Distribution.STUDENT_T:
            dof = self.degrees_of_freedom
            z *= np.sqrt((dof - 2) / rng.chisquare(dof, size=(self.n_sims, 1)))
        h = self.horizon_days
        return self.mean_returns * h + (z @ self._factor().T) * math.sqrt(h)

    def _factor(self) -> np.ndarray:
        """L with L @ L.T == covariance; falls back to eigen-decomposition if singular."""
        try:
            return np.linalg.cholesky(self.covariance)
        except np.linalg.LinAlgError:
            vals, vecs = np.linalg.eigh(self.covariance)
            return vecs * np.sqrt(np.clip(vals, 0.0, None))

    def _var_es(self, positions: np.ndarray) -> tuple[float, float]:
        return self._empirical_tail(-(self.simulate_returns() @ positions))


class HistoricalVaR(VaRModel):
    """Historical simulation over a T x N matrix of daily returns."""

    method = "historical"

    def __init__(
        self,
        returns: np.ndarray | pd.DataFrame | Sequence[Sequence[float]],
        confidence: float = 0.99,
        horizon_days: int = 1,
    ) -> None:
        super().__init__(confidence, horizon_days)
        r = np.asarray(returns, dtype=float)
        if r.ndim != 2:
            raise InvalidInputError("returns must be a T x N matrix")
        self.returns = MatrixValidator.returns(r, r.shape[1])

    @property
    def n_assets(self) -> int:
        return self.returns.shape[1]

    def _var_es(self, positions: np.ndarray) -> tuple[float, float]:
        var, es = self._empirical_tail(-(self.returns @ positions))
        scale = math.sqrt(self.horizon_days)
        return var * scale, es * scale

"""Mean-variance (Markowitz) portfolio optimisation.

Expected returns and covariances are annualised. Unconstrained problems
(shorting allowed) use closed-form solutions; long-only or weight-capped
problems are solved as convex QPs, with max-Sharpe via its convex
reformulation.
"""

from __future__ import annotations

import math
from collections.abc import Sequence
from dataclasses import dataclass

import numpy as np
import pandas as pd
from scipy.optimize import linprog

from app.core.exceptions import ConvergenceError, InfeasibleProblemError, InvalidInputError
from app.engines.portfolio.qp import QuadraticProgram
from app.engines.validation import MatrixValidator


@dataclass(frozen=True)
class PortfolioConstraints:
    long_only: bool = True
    max_weight: float | None = None

    def __post_init__(self) -> None:
        if self.max_weight is not None:
            if not self.long_only:
                raise InvalidInputError("max_weight requires long_only=True")
            if not 0 < self.max_weight <= 1:
                raise InvalidInputError("max_weight must be in (0, 1]")

    def bounds(self, n: int) -> list[tuple[float, float]]:
        upper = 1.0 if self.max_weight is None else self.max_weight
        if upper * n < 1 - 1e-12:
            raise InfeasibleProblemError(
                f"max_weight {upper} is infeasible for {n} fully invested assets"
            )
        return [(0.0, upper)] * n


@dataclass(frozen=True)
class PortfolioResult:
    weights: np.ndarray
    expected_return: float
    volatility: float
    sharpe: float | None


class MeanVarianceOptimizer:
    """Optimises weights over a fixed (mu, covariance) universe."""

    def __init__(
        self,
        expected_returns: Sequence[float] | np.ndarray,
        covariance: Sequence[Sequence[float]] | np.ndarray,
        risk_free_rate: float = 0.0,
        constraints: PortfolioConstraints | None = None,
    ) -> None:
        n = len(expected_returns)
        if n < 2:
            raise InvalidInputError("need at least two assets")
        self.mu = MatrixValidator.vector(expected_returns, n, "expected_returns")
        self.cov = MatrixValidator.covariance(covariance, n, strict=True)
        self.risk_free_rate = risk_free_rate
        self.constraints = constraints or PortfolioConstraints()
        self._return_range: tuple[float, float] | None = None

    @classmethod
    def from_returns(
        cls,
        returns: pd.DataFrame | np.ndarray | Sequence[Sequence[float]],
        periods_per_year: int = 252,
        risk_free_rate: float = 0.0,
        constraints: PortfolioConstraints | None = None,
    ) -> MeanVarianceOptimizer:
        """Build from periodic returns using annualised sample moments."""
        r = np.asarray(returns, dtype=float)
        if r.ndim != 2 or r.shape[0] <= r.shape[1]:
            raise InvalidInputError("returns must be T x N with more observations than assets")
        r = MatrixValidator.returns(r, r.shape[1])
        mu = r.mean(axis=0) * periods_per_year
        cov = np.cov(r, rowvar=False) * periods_per_year
        return cls(mu, cov, risk_free_rate, constraints)

    @property
    def n_assets(self) -> int:
        return len(self.mu)

    # ------------------------------------------------------------------ #
    # Public objectives
    # ------------------------------------------------------------------ #

    def evaluate(self, weights: Sequence[float] | np.ndarray) -> PortfolioResult:
        w = np.asarray(weights, dtype=float)
        ret = float(w @ self.mu)
        vol = math.sqrt(max(float(w @ self.cov @ w), 0.0))
        sharpe = (ret - self.risk_free_rate) / vol if vol > 0 else None
        return PortfolioResult(w, ret, vol, sharpe)

    def min_variance(self) -> PortfolioResult:
        if self.constraints.long_only:
            return self.evaluate(self._solve_weights())
        x = np.linalg.solve(self.cov, np.ones(self.n_assets))
        return self.evaluate(x / x.sum())

    def max_sharpe(self) -> PortfolioResult:
        if self.constraints.long_only:
            return self.evaluate(self._max_sharpe_constrained())
        x = np.linalg.solve(self.cov, self.mu - self.risk_free_rate)
        if x.sum() <= 0:
            raise InfeasibleProblemError(
                "risk-free rate is at or above the minimum-variance return; "
                "no tangency portfolio exists"
            )
        return self.evaluate(x / x.sum())

    def target_return(self, target: float) -> PortfolioResult:
        if not self.constraints.long_only:
            return self.evaluate(self._merton_frontier_weights(target))
        lo, hi = self.return_range()
        tol = 1e-10 * max(1.0, abs(hi - lo))
        if not lo - tol <= target <= hi + tol:
            raise InfeasibleProblemError(
                f"target return {target:.4%} outside feasible range [{lo:.4%}, {hi:.4%}]"
            )
        return self.evaluate(self._solve_weights(target=min(max(target, lo), hi)))

    def return_range(self) -> tuple[float, float]:
        """Lowest and highest achievable expected return under the constraints."""
        if self._return_range is None:
            self._return_range = self._compute_return_range()
        return self._return_range

    def _compute_return_range(self) -> tuple[float, float]:
        if not self.constraints.long_only:
            return -math.inf, math.inf
        bounds = self.constraints.bounds(self.n_assets)
        a_eq, b_eq = np.ones((1, self.n_assets)), [1.0]
        lo = linprog(self.mu, A_eq=a_eq, b_eq=b_eq, bounds=bounds)
        hi = linprog(-self.mu, A_eq=a_eq, b_eq=b_eq, bounds=bounds)
        if lo.status != 0 or hi.status != 0:
            raise ConvergenceError(f"return range LP failed: {lo.message} / {hi.message}")
        return float(lo.fun), float(-hi.fun)

    # ------------------------------------------------------------------ #
    # Internals
    # ------------------------------------------------------------------ #

    def _merton_frontier_weights(self, target: float) -> np.ndarray:
        """Merton (1972) closed-form frontier portfolio with return ``target``."""
        ones = np.ones(self.n_assets)
        inv_1 = np.linalg.solve(self.cov, ones)
        inv_mu = np.linalg.solve(self.cov, self.mu)
        a, b, c = ones @ inv_1, ones @ inv_mu, self.mu @ inv_mu
        d = a * c - b * b
        if d <= 1e-14:
            raise InfeasibleProblemError("expected returns are identical; frontier is one point")
        return ((c - b * target) * inv_1 + (a * target - b) * inv_mu) / d

    def _solve_weights(self, target: float | None = None) -> np.ndarray:
        """Long-only minimum variance: min w'Σw s.t. 1'w = 1, 0 <= w <= cap[, μ'w = target]."""
        n = self.n_assets
        cap = self.constraints.bounds(n)[0][1]
        a_eq, b_eq = [np.ones(n)], [1.0]
        if target is not None:
            a_eq.append(self.mu)
            b_eq.append(target)
        a_ub, b_ub = [-np.eye(n)], [np.zeros(n)]
        if cap < 1:
            a_ub.append(np.eye(n))
            b_ub.append(np.full(n, cap))
        x = QuadraticProgram(
            2 * self.cov,
            a_eq=np.vstack(a_eq),
            b_eq=np.array(b_eq),
            a_ub=np.vstack(a_ub),
            b_ub=np.concatenate(b_ub),
        ).solve()
        return self._normalise(x)

    def _max_sharpe_constrained(self) -> np.ndarray:
        """Minimise y'Σy s.t. (μ - rf)'y = 1, y >= 0, y_i <= cap * sum(y); w = y / sum(y)."""
        excess = self.mu - self.risk_free_rate
        if excess.max() <= 0:
            raise InfeasibleProblemError("no asset has an expected return above the risk-free rate")
        n = self.n_assets
        a_ub, b_ub = [-np.eye(n)], [np.zeros(n)]
        cap = self.constraints.max_weight
        if cap is not None:
            self.constraints.bounds(n)  # feasibility check
            a_ub.append(np.eye(n) - cap * np.ones((n, n)))
            b_ub.append(np.zeros(n))
        y = QuadraticProgram(
            2 * self.cov,
            a_eq=excess,
            b_eq=np.array([1.0]),
            a_ub=np.vstack(a_ub),
            b_ub=np.concatenate(b_ub),
        ).solve()
        return self._normalise(y)

    @staticmethod
    def _normalise(x: np.ndarray) -> np.ndarray:
        """Remove solver noise (tiny negatives) and re-impose the budget constraint."""
        w = np.clip(x, 0.0, None)
        return w / w.sum()

"""Efficient frontier construction on top of ``MeanVarianceOptimizer``."""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from app.core.exceptions import DomainError, InvalidInputError
from app.engines.portfolio.optimizer import MeanVarianceOptimizer, PortfolioResult


@dataclass(frozen=True)
class FrontierResult:
    points: list[PortfolioResult]
    min_variance: PortfolioResult
    tangency: PortfolioResult | None


class EfficientFrontier:
    """Traces the efficient (upper) branch of the mean-variance frontier.

    It runs from the minimum-variance portfolio up to the highest achievable
    return (long-only) or the highest single-asset return (unconstrained).
    """

    def __init__(self, optimizer: MeanVarianceOptimizer) -> None:
        self.optimizer = optimizer

    def compute(self, n_points: int = 50) -> FrontierResult:
        if n_points < 2:
            raise InvalidInputError("n_points must be at least 2")
        opt = self.optimizer
        mvp = opt.min_variance()
        top = opt.return_range()[1] if opt.constraints.long_only else float(opt.mu.max())
        targets = np.linspace(mvp.expected_return, max(top, mvp.expected_return), n_points)
        points = [mvp] + [opt.target_return(float(t)) for t in targets[1:]]

        try:
            tangency: PortfolioResult | None = opt.max_sharpe()
        except DomainError:
            tangency = None
        return FrontierResult(points, mvp, tangency)

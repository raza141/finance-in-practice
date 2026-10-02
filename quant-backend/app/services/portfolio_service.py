"""Application service mapping portfolio schemas to optimisation engines."""

from app.engines.portfolio import (
    EfficientFrontier,
    MeanVarianceOptimizer,
    PortfolioConstraints,
    PortfolioResult,
)
from app.schemas.portfolio import (
    FrontierRequest,
    FrontierResponse,
    OptimizeRequest,
    PortfolioInputs,
    PortfolioOut,
)


class PortfolioService:
    def optimize(self, req: OptimizeRequest) -> PortfolioOut:
        optimizer = self._optimizer(req)
        if req.objective == "min_variance":
            result = optimizer.min_variance()
        elif req.objective == "max_sharpe":
            result = optimizer.max_sharpe()
        else:
            assert req.target_return is not None
            result = optimizer.target_return(req.target_return)
        return self._out(result, req.assets)

    def frontier(self, req: FrontierRequest) -> FrontierResponse:
        result = EfficientFrontier(self._optimizer(req)).compute(req.n_points)
        return FrontierResponse(
            points=[self._out(p, req.assets) for p in result.points],
            min_variance=self._out(result.min_variance, req.assets),
            tangency=self._out(result.tangency, req.assets) if result.tangency else None,
        )

    @staticmethod
    def _optimizer(req: PortfolioInputs) -> MeanVarianceOptimizer:
        constraints = PortfolioConstraints(long_only=req.long_only, max_weight=req.max_weight)
        if req.returns is not None:
            return MeanVarianceOptimizer.from_returns(
                req.returns, req.periods_per_year, req.risk_free_rate, constraints
            )
        assert req.expected_returns is not None and req.covariance is not None
        return MeanVarianceOptimizer(
            req.expected_returns, req.covariance, req.risk_free_rate, constraints
        )

    @staticmethod
    def _out(result: PortfolioResult, assets: list[str]) -> PortfolioOut:
        return PortfolioOut(
            weights={a: float(w) for a, w in zip(assets, result.weights, strict=True)},
            expected_return=result.expected_return,
            volatility=result.volatility,
            sharpe=result.sharpe,
        )

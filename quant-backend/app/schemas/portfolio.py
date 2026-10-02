"""Request/response schemas for portfolio optimisation."""

from __future__ import annotations

from typing import Annotated, Literal

from pydantic import Field, model_validator

from app.core.limits import MAX_ASSETS, MAX_FRONTIER_POINTS, MAX_HISTORY_ROWS
from app.engines.validation import MatrixValidator
from app.schemas.base import Matrix, Name, Schema


class PortfolioInputs(Schema):
    """Supply either (expected_returns + covariance) or a returns history."""

    assets: list[Name] = Field(min_length=2, max_length=MAX_ASSETS)
    expected_returns: list[float] | None = Field(default=None, description="Annualised")
    covariance: Matrix | None = Field(default=None, description="Annualised")
    returns: Matrix | None = Field(
        default=None,
        max_length=MAX_HISTORY_ROWS,
        description="Periodic returns, T rows x N columns; annualised internally",
    )
    periods_per_year: Literal[12, 52, 252] = 252
    risk_free_rate: Annotated[float, Field(ge=-0.1, le=1)] = 0.0
    long_only: bool = True
    max_weight: Annotated[float, Field(gt=0, le=1)] | None = None

    @model_validator(mode="after")
    def _check_inputs(self) -> PortfolioInputs:
        n = len(self.assets)
        if len(set(self.assets)) != n:
            raise ValueError("asset names must be unique")

        direct = self.expected_returns is not None or self.covariance is not None
        if direct == (self.returns is not None):
            raise ValueError("provide either expected_returns + covariance, or returns")
        if direct:
            if self.expected_returns is None or self.covariance is None:
                raise ValueError("expected_returns and covariance must be supplied together")
            MatrixValidator.vector(self.expected_returns, n, "expected_returns")
            MatrixValidator.covariance(self.covariance, n, strict=True)
        else:
            assert self.returns is not None
            if len(self.returns) <= n:
                raise ValueError("need more return observations than assets")
            MatrixValidator.returns(self.returns, n)

        if self.max_weight is not None:
            if not self.long_only:
                raise ValueError("max_weight requires long_only=true")
            if self.max_weight * n < 1:
                raise ValueError(f"max_weight must be at least 1/{n} to stay fully invested")
        return self


class OptimizeRequest(PortfolioInputs):
    objective: Literal["min_variance", "max_sharpe", "target_return"] = "max_sharpe"
    target_return: float | None = None

    @model_validator(mode="after")
    def _check_target(self) -> OptimizeRequest:
        if self.objective == "target_return" and self.target_return is None:
            raise ValueError("target_return is required when objective is 'target_return'")
        return self


class FrontierRequest(PortfolioInputs):
    n_points: int = Field(default=50, ge=5, le=MAX_FRONTIER_POINTS)


class PortfolioOut(Schema):
    weights: dict[str, float]
    expected_return: float
    volatility: float
    sharpe: float | None


class FrontierResponse(Schema):
    points: list[PortfolioOut]
    min_variance: PortfolioOut
    tangency: PortfolioOut | None

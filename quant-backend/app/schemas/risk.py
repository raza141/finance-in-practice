"""Request/response schemas for VaR and stress testing."""

from __future__ import annotations

import math
from typing import Annotated

from pydantic import Field, model_validator

from app.core.limits import (
    MAX_ASSETS,
    MAX_HISTORY_ROWS,
    MAX_HORIZON_DAYS,
    MAX_MC_CELLS,
    MAX_MC_SIMS,
    MAX_STRESS_POSITIONS,
    MIN_MC_SIMS,
)
from app.engines.risk import AssetClass, MonteCarloVaR
from app.engines.validation import MatrixValidator
from app.schemas.base import Confidence, Matrix, Name, Schema

HorizonDays = Annotated[int, Field(ge=1, le=MAX_HORIZON_DAYS)]


class Position(Schema):
    name: Name
    value: float = Field(description="Signed currency exposure; negative for shorts")


# --------------------------------------------------------------------------- #
# Value at Risk
# --------------------------------------------------------------------------- #


class _CovarianceVaRRequest(Schema):
    positions: list[Position] = Field(min_length=1, max_length=MAX_ASSETS)
    covariance: Matrix = Field(description="Daily return covariance matrix (N x N)")
    mean_returns: list[float] | None = Field(
        default=None, description="Daily mean returns; omitted means zero drift"
    )
    confidence: Confidence = 0.99
    horizon_days: HorizonDays = 1

    @model_validator(mode="after")
    def _check_shapes(self) -> _CovarianceVaRRequest:
        n = len(self.positions)
        MatrixValidator.covariance(self.covariance, n)
        if self.mean_returns is not None:
            MatrixValidator.vector(self.mean_returns, n, "mean_returns")
        return self


class ParametricVaRRequest(_CovarianceVaRRequest):
    pass


class MonteCarloVaRRequest(_CovarianceVaRRequest):
    n_sims: int = Field(default=10_000, ge=MIN_MC_SIMS, le=MAX_MC_SIMS)
    distribution: MonteCarloVaR.Distribution = MonteCarloVaR.Distribution.NORMAL
    degrees_of_freedom: float = Field(default=5.0, ge=3, le=100)
    seed: int | None = Field(default=None, ge=0, le=2**32 - 1)

    @model_validator(mode="after")
    def _check_budget(self) -> MonteCarloVaRRequest:
        cells = self.n_sims * len(self.positions)
        if cells > MAX_MC_CELLS:
            raise ValueError(f"n_sims x assets = {cells:,} exceeds the limit of {MAX_MC_CELLS:,}")
        return self


class HistoricalVaRRequest(Schema):
    positions: list[Position] = Field(min_length=1, max_length=MAX_ASSETS)
    returns: Matrix = Field(
        min_length=1,
        max_length=MAX_HISTORY_ROWS,
        description="Daily returns, T rows x N columns in the same order as positions",
    )
    confidence: Confidence = 0.99
    horizon_days: HorizonDays = 1

    @model_validator(mode="after")
    def _check_shapes(self) -> HistoricalVaRRequest:
        MatrixValidator.returns(self.returns, len(self.positions))
        needed = math.ceil(1 / (1 - self.confidence) - 1e-9)
        if len(self.returns) < needed:
            raise ValueError(
                f"at least {needed} return observations are needed for "
                f"{self.confidence:.1%} confidence"
            )
        return self


class VaRResponse(Schema):
    method: str
    confidence: float
    horizon_days: int
    var: float = Field(description="Loss threshold, reported as a positive number")
    expected_shortfall: float = Field(description="Mean loss beyond VaR, positive number")
    portfolio_value: float
    var_pct: float | None = Field(description="VaR as a fraction of net portfolio value")


# --------------------------------------------------------------------------- #
# Stress testing
# --------------------------------------------------------------------------- #

Shock = Annotated[float, Field(ge=-1.0, le=10.0)]


class StressPositionIn(Schema):
    name: Name
    asset_class: AssetClass
    value: float


class StressTestRequest(Schema):
    positions: list[StressPositionIn] = Field(min_length=1, max_length=MAX_STRESS_POSITIONS)
    scenario: str | None = Field(default=None, description="Preset scenario key")
    custom_shocks: dict[AssetClass, Shock] | None = Field(
        default=None, description="Asset-class returns, e.g. {'equity': -0.3}"
    )

    @model_validator(mode="after")
    def _one_scenario(self) -> StressTestRequest:
        if (self.scenario is None) == (self.custom_shocks is None):
            raise ValueError("provide exactly one of scenario or custom_shocks")
        return self


class StressLineOut(Schema):
    name: str
    asset_class: AssetClass
    value_before: float
    shock: float
    pnl: float
    value_after: float


class StressTestResponse(Schema):
    scenario: str
    lines: list[StressLineOut]
    value_before: float
    value_after: float
    pnl: float
    pnl_pct: float


class ScenarioOut(Schema):
    key: str
    name: str
    description: str
    shocks: dict[AssetClass, float]

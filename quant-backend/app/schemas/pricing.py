"""Request/response schemas for option, bond and yield-curve pricing."""

from __future__ import annotations

from typing import Annotated, Literal

from pydantic import Field, model_validator

from app.core.limits import MAX_BOND_MATURITY_YEARS, MAX_BOOTSTRAP_INSTRUMENTS
from app.engines.pricing import Compounding, OptionType
from app.schemas.base import Schema

Positive = Annotated[float, Field(gt=0)]
Rate = Annotated[float, Field(ge=-0.10, le=1.0)]
Frequency = Literal[1, 2, 4, 12]


class _OptionInputs(Schema):
    spot: Positive
    strike: Positive
    time_to_expiry: Annotated[float, Field(gt=0, le=50, description="Years")]
    rate: Rate = Field(description="Continuously compounded risk-free rate")
    dividend_yield: Annotated[float, Field(ge=0, le=1)] = 0.0
    option_type: OptionType = OptionType.CALL


class BlackScholesRequest(_OptionInputs):
    volatility: Annotated[float, Field(gt=0, le=5, description="Annualised, 0.2 = 20%")]


class BlackScholesResponse(Schema):
    price: float
    d1: float
    d2: float
    delta: float
    gamma: float
    vega: float = Field(description="Per 1.00 change in volatility")
    theta: float = Field(description="Per year")
    rho: float = Field(description="Per 1.00 change in rate")


class ImpliedVolRequest(_OptionInputs):
    market_price: Positive


class ImpliedVolResponse(Schema):
    implied_volatility: float


class BondRequest(Schema):
    face: Positive = 100.0
    coupon_rate: Annotated[float, Field(ge=0, le=1, description="Annual, 0.05 = 5%")]
    maturity_years: Annotated[float, Field(gt=0, le=MAX_BOND_MATURITY_YEARS)]
    frequency: Frequency = 2
    compounding: Compounding = Compounding.PERIODIC
    ytm: Annotated[float, Field(ge=-0.5, le=5)] | None = None
    price: Positive | None = None

    @model_validator(mode="after")
    def _one_input(self) -> BondRequest:
        if (self.ytm is None) == (self.price is None):
            raise ValueError("provide exactly one of ytm or price")
        return self


class CashFlowOut(Schema):
    time: float
    amount: float
    present_value: float


class BondResponse(Schema):
    price: float
    ytm: float
    macaulay_duration: float
    modified_duration: float
    convexity: float
    cash_flows: list[CashFlowOut]


class CurveInstrumentIn(Schema):
    maturity: Annotated[float, Field(gt=0, le=MAX_BOND_MATURITY_YEARS)]
    coupon_rate: Annotated[float, Field(ge=0, le=1)] = 0.0
    price: Positive


class BootstrapRequest(Schema):
    instruments: list[CurveInstrumentIn] = Field(min_length=1, max_length=MAX_BOOTSTRAP_INSTRUMENTS)
    frequency: Frequency = 2
    face: Positive = 100.0

    @model_validator(mode="after")
    def _unique_maturities(self) -> BootstrapRequest:
        mats = [i.maturity for i in self.instruments]
        if len(set(mats)) != len(mats):
            raise ValueError("instrument maturities must be unique")
        return self


class ZeroPointOut(Schema):
    maturity: float
    zero_rate: float = Field(description="Continuously compounded")


class BootstrapResponse(Schema):
    points: list[ZeroPointOut]

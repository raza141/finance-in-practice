"""Black-Scholes-Merton pricing for European options.

Conventions follow Hull, *Options, Futures, and Other Derivatives*: time in
years, annualised volatility, continuously compounded rate and dividend yield.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from enum import StrEnum

from scipy.optimize import brentq
from scipy.stats import norm

from app.core.exceptions import ConvergenceError, InvalidInputError


class OptionType(StrEnum):
    CALL = "call"
    PUT = "put"


@dataclass(frozen=True)
class OptionContract:
    """A European option and its market environment (excluding volatility)."""

    spot: float
    strike: float
    expiry: float  # years
    rate: float
    dividend_yield: float = 0.0
    option_type: OptionType = OptionType.CALL

    def __post_init__(self) -> None:
        if self.spot <= 0 or self.strike <= 0:
            raise InvalidInputError("spot and strike must be positive")
        if self.expiry <= 0:
            raise InvalidInputError("time to expiry must be positive")
        object.__setattr__(self, "option_type", OptionType(self.option_type))

    @property
    def discounted_spot(self) -> float:
        return self.spot * math.exp(-self.dividend_yield * self.expiry)

    @property
    def discounted_strike(self) -> float:
        return self.strike * math.exp(-self.rate * self.expiry)

    def no_arbitrage_bounds(self) -> tuple[float, float]:
        """Open interval a European option price must lie in."""
        s, k = self.discounted_spot, self.discounted_strike
        if self.option_type is OptionType.CALL:
            return max(s - k, 0.0), s
        return max(k - s, 0.0), k


@dataclass(frozen=True)
class OptionValuation:
    price: float
    d1: float
    d2: float
    delta: float
    gamma: float
    vega: float  # per 1.00 change in volatility (divide by 100 for per 1%)
    theta: float  # per year (divide by 365 for per calendar day)
    rho: float  # per 1.00 change in rate (divide by 100 for per 1%)


class BlackScholesModel:
    """Closed-form pricer with analytic Greeks and an implied-volatility solver."""

    IV_LOWER = 1e-6
    IV_UPPER = 10.0

    def value(self, contract: OptionContract, volatility: float) -> OptionValuation:
        if volatility <= 0:
            raise InvalidInputError("volatility must be positive")
        c = contract
        sqrt_t = math.sqrt(c.expiry)
        d1 = (
            math.log(c.spot / c.strike)
            + (c.rate - c.dividend_yield + 0.5 * volatility**2) * c.expiry
        ) / (volatility * sqrt_t)
        d2 = d1 - volatility * sqrt_t

        s_q, k_r = c.discounted_spot, c.discounted_strike
        pdf_d1 = float(norm.pdf(d1))
        gamma = s_q * pdf_d1 / (c.spot**2 * volatility * sqrt_t)
        vega = s_q * pdf_d1 * sqrt_t
        decay = -s_q * pdf_d1 * volatility / (2 * sqrt_t)

        if c.option_type is OptionType.CALL:
            n_d1, n_d2 = float(norm.cdf(d1)), float(norm.cdf(d2))
            price = s_q * n_d1 - k_r * n_d2
            delta = s_q / c.spot * n_d1
            theta = decay - c.rate * k_r * n_d2 + c.dividend_yield * s_q * n_d1
            rho = c.expiry * k_r * n_d2
        else:
            n_md1, n_md2 = float(norm.cdf(-d1)), float(norm.cdf(-d2))
            price = k_r * n_md2 - s_q * n_md1
            delta = -s_q / c.spot * n_md1
            theta = decay + c.rate * k_r * n_md2 - c.dividend_yield * s_q * n_md1
            rho = -c.expiry * k_r * n_md2

        return OptionValuation(price, d1, d2, delta, gamma, vega, theta, rho)

    def price(self, contract: OptionContract, volatility: float) -> float:
        return self.value(contract, volatility).price

    def implied_volatility(self, contract: OptionContract, market_price: float) -> float:
        """Invert the pricing formula for volatility using Brent's method."""
        lower, upper = contract.no_arbitrage_bounds()
        if not lower < market_price < upper:
            raise InvalidInputError(
                f"price {market_price:.6g} violates no-arbitrage bounds ({lower:.6g}, {upper:.6g})"
            )
        try:
            return float(
                brentq(
                    lambda vol: self.price(contract, vol) - market_price,
                    self.IV_LOWER,
                    self.IV_UPPER,
                    xtol=1e-12,
                    maxiter=200,
                )
            )
        except ValueError as exc:  # no sign change inside the bracket
            raise ConvergenceError(f"implied volatility not found: {exc}") from exc

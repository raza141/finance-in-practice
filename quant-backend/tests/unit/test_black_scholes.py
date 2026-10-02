import math

import pytest

from app.core.exceptions import InvalidInputError
from app.engines.pricing import BlackScholesModel, OptionContract, OptionType


@pytest.fixture
def model() -> BlackScholesModel:
    return BlackScholesModel()


class TestHullPricingExample:
    """Hull, *Options, Futures, and Other Derivatives*, Example 15.6:
    S0=42, K=40, r=10%, sigma=20%, T=0.5 -> c=4.76, p=0.81, d1=0.7693, d2=0.6278."""

    def contract(self, kind: OptionType) -> OptionContract:
        return OptionContract(spot=42, strike=40, expiry=0.5, rate=0.10, option_type=kind)

    def test_call_price(self, model):
        v = model.value(self.contract(OptionType.CALL), 0.20)
        assert v.price == pytest.approx(4.76, abs=0.005)
        assert v.d1 == pytest.approx(0.7693, abs=5e-5)
        assert v.d2 == pytest.approx(0.6278, abs=5e-5)

    def test_put_price(self, model):
        assert model.price(self.contract(OptionType.PUT), 0.20) == pytest.approx(0.81, abs=0.005)


class TestHullGreeksExample:
    """Hull, Greeks chapter: S0=49, K=50, r=5%, sigma=20%, T=20 weeks.
    Call price 2.40, delta 0.522, gamma 0.066, vega 12.1, theta -4.31/yr, rho 8.91."""

    contract = OptionContract(spot=49, strike=50, expiry=20 / 52, rate=0.05)

    def test_price_and_greeks(self, model):
        v = model.value(self.contract, 0.20)
        assert v.price == pytest.approx(2.40, abs=0.005)
        assert v.delta == pytest.approx(0.522, abs=5e-4)
        assert v.gamma == pytest.approx(0.066, abs=5e-4)
        assert v.vega == pytest.approx(12.1, abs=0.05)
        assert v.theta == pytest.approx(-4.31, abs=0.005)
        assert v.rho == pytest.approx(8.91, abs=0.005)

    def test_greeks_match_finite_differences(self, model):
        c, sigma, h = self.contract, 0.20, 1e-4

        def bump(**kw) -> float:
            fields = dict(spot=c.spot, strike=c.strike, expiry=c.expiry, rate=c.rate)
            vol = kw.pop("sigma", sigma)
            fields.update(kw)
            return model.price(OptionContract(**fields), vol)

        v = model.value(c, sigma)
        assert v.delta == pytest.approx(
            (bump(spot=c.spot + h) - bump(spot=c.spot - h)) / (2 * h), rel=1e-6
        )
        assert v.gamma == pytest.approx(
            (bump(spot=c.spot + h) - 2 * v.price + bump(spot=c.spot - h)) / h**2, rel=1e-3
        )
        assert v.vega == pytest.approx(
            (bump(sigma=sigma + h) - bump(sigma=sigma - h)) / (2 * h), rel=1e-6
        )
        assert v.rho == pytest.approx(
            (bump(rate=c.rate + h) - bump(rate=c.rate - h)) / (2 * h), rel=1e-6
        )
        # theta is dV/dt in calendar time = -dV/dT
        assert v.theta == pytest.approx(
            -(bump(expiry=c.expiry + h) - bump(expiry=c.expiry - h)) / (2 * h), rel=1e-6
        )


class TestNoArbitrageRelations:
    @pytest.mark.parametrize("q", [0.0, 0.03])
    def test_put_call_parity(self, model, q):
        args = dict(spot=100, strike=95, expiry=1.25, rate=0.04, dividend_yield=q)
        call = model.price(OptionContract(**args, option_type=OptionType.CALL), 0.3)
        put = model.price(OptionContract(**args, option_type=OptionType.PUT), 0.3)
        assert call - put == pytest.approx(
            100 * math.exp(-q * 1.25) - 95 * math.exp(-0.04 * 1.25), abs=1e-10
        )

    def test_put_delta_relation(self, model):
        args = dict(spot=100, strike=100, expiry=1.0, rate=0.03, dividend_yield=0.02)
        call = model.value(OptionContract(**args, option_type=OptionType.CALL), 0.25)
        put = model.value(OptionContract(**args, option_type=OptionType.PUT), 0.25)
        assert call.delta - put.delta == pytest.approx(math.exp(-0.02), abs=1e-12)
        assert call.gamma == pytest.approx(put.gamma)
        assert call.vega == pytest.approx(put.vega)


class TestImpliedVolatility:
    @pytest.mark.parametrize("kind", list(OptionType))
    @pytest.mark.parametrize("sigma", [0.05, 0.2, 0.8, 2.0])
    def test_round_trip(self, model, kind, sigma):
        c = OptionContract(
            spot=100, strike=110, expiry=0.75, rate=0.03, dividend_yield=0.01, option_type=kind
        )
        assert model.implied_volatility(c, model.price(c, sigma)) == pytest.approx(sigma, abs=1e-8)

    def test_price_outside_bounds_rejected(self, model):
        c = OptionContract(spot=42, strike=40, expiry=0.5, rate=0.10)
        with pytest.raises(InvalidInputError, match="no-arbitrage"):
            model.implied_volatility(c, 50.0)  # above the spot price
        with pytest.raises(InvalidInputError, match="no-arbitrage"):
            model.implied_volatility(c, 3.0)  # below intrinsic S - K e^{-rT}


class TestInputValidation:
    @pytest.mark.parametrize("field,value", [("spot", 0), ("strike", -1), ("expiry", 0)])
    def test_invalid_contract(self, field, value):
        args = dict(spot=100, strike=100, expiry=1.0, rate=0.05)
        args[field] = value
        with pytest.raises(InvalidInputError):
            OptionContract(**args)

    def test_non_positive_volatility(self, model):
        with pytest.raises(InvalidInputError):
            model.value(OptionContract(spot=100, strike=100, expiry=1.0, rate=0.05), 0.0)

import numpy as np
import pytest

from app.core.exceptions import InvalidInputError
from app.engines.pricing import (
    Compounding,
    CurveInstrument,
    FixedRateBond,
    ZeroCurve,
    ZeroCurveBootstrapper,
    ZeroPoint,
)


class TestBondTextbookValues:
    def test_hull_duration_example(self):
        """Hull, section 4.8: 3-year 10% semiannual bond, 12% continuous yield.
        Price 94.213, duration 2.653 years."""
        result = FixedRateBond(0.10, 3, frequency=2).analytics(
            ytm=0.12, compounding=Compounding.CONTINUOUS
        )
        assert result.price == pytest.approx(94.213, abs=5e-4)
        assert result.macaulay_duration == pytest.approx(2.653, abs=5e-4)
        assert result.modified_duration == result.macaulay_duration

    def test_hull_bond_yield_example(self):
        """Hull, section 4.4: 2-year 6% semiannual bond priced at 98.39 yields 6.76%
        (continuous)."""
        ytm = FixedRateBond(0.06, 2, frequency=2).yield_to_maturity(98.39, Compounding.CONTINUOUS)
        assert ytm == pytest.approx(0.0676, abs=5e-5)

    def test_cfa_annual_coupon_bond(self):
        """3-year 5% annual-pay bond at a 6% yield: 5/1.06 + 5/1.06^2 + 105/1.06^3 = 97.327."""
        assert FixedRateBond(0.05, 3, frequency=1).price(0.06) == pytest.approx(97.327, abs=5e-4)

    @pytest.mark.parametrize("freq", [1, 2, 4, 12])
    def test_par_bond_prices_at_face(self, freq):
        assert FixedRateBond(0.07, 10, frequency=freq).price(0.07) == pytest.approx(100.0, abs=1e-9)

    def test_zero_coupon_duration_equals_maturity(self):
        result = FixedRateBond(0.0, 7.3, frequency=2).analytics(ytm=0.05)
        assert result.macaulay_duration == pytest.approx(7.3)
        assert result.price == pytest.approx(100 / 1.025 ** (2 * 7.3))


class TestBondRiskMeasures:
    @pytest.mark.parametrize("compounding", list(Compounding))
    def test_duration_convexity_match_finite_differences(self, compounding):
        """Modified duration = -P'/P and convexity = P''/P with respect to the yield."""
        bond = FixedRateBond(0.045, 12, frequency=2)
        y, h = 0.055, 1e-5
        a = bond.analytics(ytm=y, compounding=compounding)
        up, down = bond.price(y + h, compounding), bond.price(y - h, compounding)
        assert a.modified_duration == pytest.approx(-(up - down) / (2 * h * a.price), rel=1e-7)
        assert a.convexity == pytest.approx((up - 2 * a.price + down) / (h**2 * a.price), rel=1e-5)

    def test_second_order_approximation_error_is_third_order(self):
        """Halving the yield shock should cut the duration+convexity error ~8x."""
        bond = FixedRateBond(0.045, 12, frequency=2)
        a = bond.analytics(ytm=0.055)

        def error(dy: float) -> float:
            approx = a.price * (1 - a.modified_duration * dy + 0.5 * a.convexity * dy**2)
            return abs(bond.price(0.055 + dy) - approx)

        assert error(0.01) / error(0.005) == pytest.approx(8, rel=0.05)

    @pytest.mark.parametrize("compounding", list(Compounding))
    def test_price_yield_round_trip(self, compounding):
        bond = FixedRateBond(0.08, 5, frequency=4)
        price = bond.price(0.0612, compounding)
        assert bond.yield_to_maturity(price, compounding) == pytest.approx(0.0612, abs=1e-12)

    def test_analytics_from_price_matches_from_yield(self):
        bond = FixedRateBond(0.06, 8, frequency=2)
        from_yield = bond.analytics(ytm=0.07)
        from_price = bond.analytics(price=from_yield.price)
        assert from_price.yield_to_maturity == pytest.approx(0.07, abs=1e-12)
        assert from_price.convexity == pytest.approx(from_yield.convexity)

    def test_cash_flow_schedule(self):
        flows = FixedRateBond(0.06, 1.5, frequency=2).analytics(ytm=0.06).cash_flows
        assert [f.time for f in flows] == [0.5, 1.0, 1.5]
        assert [f.amount for f in flows] == [3.0, 3.0, 103.0]


class TestBondValidation:
    def test_broken_period_rejected(self):
        with pytest.raises(InvalidInputError, match="whole number"):
            FixedRateBond(0.05, 2.3, frequency=2)

    def test_exactly_one_of_ytm_or_price(self):
        bond = FixedRateBond(0.05, 2)
        with pytest.raises(InvalidInputError):
            bond.analytics()
        with pytest.raises(InvalidInputError):
            bond.analytics(ytm=0.05, price=100)


class TestZeroCurveBootstrapper:
    """Hull, Tables 4.3/4.4: bootstrapped continuously compounded zero rates."""

    INSTRUMENTS = [
        CurveInstrument(0.25, 0.00, 97.5),
        CurveInstrument(0.50, 0.00, 94.9),
        CurveInstrument(1.00, 0.00, 90.0),
        CurveInstrument(1.50, 0.08, 96.0),
        CurveInstrument(2.00, 0.12, 101.6),
    ]
    EXPECTED = [0.10127, 0.10469, 0.10536, 0.10681, 0.10808]

    def test_hull_zero_rates(self):
        curve = ZeroCurveBootstrapper(frequency=2).build(self.INSTRUMENTS)
        rates = [p.zero_rate for p in curve.points]
        np.testing.assert_allclose(rates, self.EXPECTED, atol=1e-5)

    def test_input_order_does_not_matter(self):
        shuffled = list(reversed(self.INSTRUMENTS))
        a = ZeroCurveBootstrapper().build(self.INSTRUMENTS)
        b = ZeroCurveBootstrapper().build(shuffled)
        assert [p.zero_rate for p in a.points] == pytest.approx([p.zero_rate for p in b.points])

    def test_curve_reprices_inputs(self):
        curve = ZeroCurveBootstrapper().build(self.INSTRUMENTS)
        for inst in self.INSTRUMENTS:
            bond = FixedRateBond(inst.coupon_rate, inst.maturity, frequency=2)
            assert float(np.sum(bond.amounts * curve.discount_factor(bond.times))) == pytest.approx(
                inst.price, abs=1e-9
            )

    def test_duplicate_maturities_rejected(self):
        with pytest.raises(InvalidInputError, match="unique"):
            ZeroCurveBootstrapper().build([CurveInstrument(1, 0, 95), CurveInstrument(1, 0, 96)])


class TestZeroCurve:
    def test_linear_interpolation_and_flat_extrapolation(self):
        curve = ZeroCurve([ZeroPoint(1.0, 0.02), ZeroPoint(3.0, 0.04)])
        assert curve.zero_rate(2.0) == pytest.approx(0.03)
        assert curve.zero_rate(0.5) == pytest.approx(0.02)
        assert curve.zero_rate(10.0) == pytest.approx(0.04)
        assert curve.discount_factor(2.0) == pytest.approx(np.exp(-0.06))

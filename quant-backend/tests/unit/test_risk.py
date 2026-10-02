import math

import numpy as np
import pytest
from scipy.stats import norm

from app.core.exceptions import InvalidInputError
from app.engines.risk import (
    AssetClass,
    HistoricalVaR,
    MonteCarloVaR,
    ParametricVaR,
    ScenarioLibrary,
    StressPosition,
    StressScenario,
    StressTester,
)


class TestParametricVaR:
    def test_hull_single_asset(self):
        """Hull: $10m in Microsoft, 2% daily vol. 1-day 99% VaR = $465,300;
        10-day 99% VaR = $1,471,300."""
        cov = np.array([[0.02**2]])
        one_day = ParametricVaR(cov, confidence=0.99).calculate([10_000_000])
        ten_day = ParametricVaR(cov, confidence=0.99, horizon_days=10).calculate([10_000_000])
        assert one_day.var == pytest.approx(465_300, rel=1e-4)
        assert ten_day.var == pytest.approx(1_471_300, rel=1e-4)

    def test_hull_two_asset_portfolio(self, hull_two_asset_var):
        """Hull: portfolio sigma $220,227/day; 10-day 99% VaR = $1,620,100."""
        d = hull_two_asset_var
        result = ParametricVaR(d["cov"], horizon_days=10).calculate(d["positions"])
        sigma = math.sqrt(d["positions"] @ d["cov"] @ d["positions"])
        assert sigma == pytest.approx(220_227, abs=1)
        assert result.var == pytest.approx(1_620_100, rel=1e-4)
        assert result.portfolio_value == 15_000_000

    def test_diversification_benefit(self, hull_two_asset_var):
        """Hull: stand-alone 10-day VaRs $1,471,300 + $367,800 exceed the
        diversified $1,620,100 by a $219,000 diversification benefit."""
        d = hull_two_asset_var
        model = ParametricVaR(d["cov"], horizon_days=10)
        msft = model.calculate([10_000_000, 0]).var
        att = model.calculate([0, 5_000_000]).var
        assert att == pytest.approx(367_800, rel=1e-4)
        benefit = msft + att - model.calculate(d["positions"]).var
        assert benefit == pytest.approx(219_000, rel=1e-3)

    def test_normal_expected_shortfall(self):
        """For a normal distribution, 99% ES = sigma * phi(2.326) / 0.01 = 2.665 sigma."""
        result = ParametricVaR(np.array([[1.0]]), confidence=0.99).calculate([1.0])
        assert result.expected_shortfall == pytest.approx(2.6652, abs=1e-4)
        assert result.expected_shortfall > result.var

    def test_mean_reduces_var(self):
        cov = np.array([[0.0001]])
        zero = ParametricVaR(cov).calculate([1e6]).var
        drift = ParametricVaR(cov, mean_returns=[0.001]).calculate([1e6]).var
        assert zero - drift == pytest.approx(1000)

    def test_short_position_has_same_var_under_zero_mean(self):
        cov = np.array([[0.0004]])
        assert ParametricVaR(cov).calculate([-1e6]).var == pytest.approx(
            ParametricVaR(cov).calculate([1e6]).var
        )


class TestHistoricalVaR:
    def test_hull_500_scenario_convention(self):
        """500 scenarios at 99%: VaR is the 5th-worst loss, ES the mean of the 5 worst."""
        losses = np.arange(1, 501, dtype=float)
        np.random.default_rng(0).shuffle(losses)
        returns = (-losses / 1000).reshape(-1, 1)
        result = HistoricalVaR(returns, confidence=0.99).calculate([1000])
        assert result.var == pytest.approx(496)
        assert result.expected_shortfall == pytest.approx(np.mean([496, 497, 498, 499, 500]))

    def test_square_root_of_time(self):
        returns = np.random.default_rng(1).normal(0, 0.01, size=(1000, 2))
        one = HistoricalVaR(returns, horizon_days=1).calculate([1e6, 5e5])
        ten = HistoricalVaR(returns, horizon_days=10).calculate([1e6, 5e5])
        assert ten.var == pytest.approx(one.var * math.sqrt(10))

    def test_too_few_observations_rejected(self):
        returns = np.zeros((99, 1))
        with pytest.raises(InvalidInputError, match="at least 100"):
            HistoricalVaR(returns, confidence=0.99).calculate([1.0])

    def test_position_count_must_match(self):
        with pytest.raises(InvalidInputError):
            HistoricalVaR(np.zeros((200, 2))).calculate([1.0])


class TestMonteCarloVaR:
    def test_normal_converges_to_parametric(self, hull_two_asset_var):
        d = hull_two_asset_var
        mc = MonteCarloVaR(d["cov"], horizon_days=10, n_sims=100_000, seed=42)
        analytic = ParametricVaR(d["cov"], horizon_days=10).calculate(d["positions"])
        result = mc.calculate(d["positions"])
        assert result.var == pytest.approx(analytic.var, rel=0.02)
        assert result.expected_shortfall == pytest.approx(analytic.expected_shortfall, rel=0.03)

    def test_simulated_covariance_matches_input(self, hull_two_asset_var):
        cov = hull_two_asset_var["cov"]
        for dist in MonteCarloVaR.Distribution:
            sims = MonteCarloVaR(cov, n_sims=200_000, distribution=dist, seed=7).simulate_returns()
            np.testing.assert_allclose(np.cov(sims, rowvar=False), cov, rtol=0.05)

    def test_student_t_has_fatter_tail(self):
        """t(5) rescaled to unit variance: 99% quantile = 3.365 * sqrt(3/5) = 2.606 > 2.326."""
        cov = np.array([[1.0]])
        normal = MonteCarloVaR(cov, n_sims=100_000, seed=3).calculate([1.0])
        fat = MonteCarloVaR(
            cov, n_sims=100_000, distribution="student_t", degrees_of_freedom=5, seed=3
        ).calculate([1.0])
        assert normal.var == pytest.approx(norm.ppf(0.99), rel=0.02)
        assert fat.var == pytest.approx(2.606, rel=0.03)
        assert fat.expected_shortfall > normal.expected_shortfall

    def test_seed_reproducibility(self, hull_two_asset_var):
        d = hull_two_asset_var
        a = MonteCarloVaR(d["cov"], seed=11).calculate(d["positions"])
        b = MonteCarloVaR(d["cov"], seed=11).calculate(d["positions"])
        assert a == b

    def test_singular_covariance_supported(self):
        """Perfectly correlated assets: Cholesky fails, eigen fallback must still work."""
        cov = np.array([[0.0004, 0.0004], [0.0004, 0.0004]])
        mc = MonteCarloVaR(cov, n_sims=100_000, seed=5).calculate([1e6, 1e6])
        analytic = ParametricVaR(cov).calculate([1e6, 1e6])
        assert mc.var == pytest.approx(analytic.var, rel=0.02)

    def test_invalid_degrees_of_freedom(self):
        with pytest.raises(InvalidInputError):
            MonteCarloVaR(np.eye(1), distribution="student_t", degrees_of_freedom=2)


class TestCovarianceValidation:
    @pytest.mark.parametrize(
        "cov,match",
        [
            ([[1.0, 0.5], [0.4, 1.0]], "symmetric"),
            ([[1.0, 2.0], [2.0, 1.0]], "positive semi-definite"),
            ([[1.0, 0.0, 0.0], [0.0, 1.0, 0.0]], "matrix"),
        ],
    )
    def test_rejects_bad_matrices(self, cov, match):
        with pytest.raises(InvalidInputError, match=match):
            ParametricVaR(cov)

    def test_invalid_confidence(self):
        with pytest.raises(InvalidInputError):
            ParametricVaR(np.eye(1), confidence=1.0)


class TestStressTesting:
    def test_preset_library(self):
        library = ScenarioLibrary.default()
        assert {"gfc_2008", "covid_2020", "rates_up_200bp", "stagflation"} <= {
            s.key for s in library
        }
        with pytest.raises(InvalidInputError, match="unknown scenario"):
            library.get("does_not_exist")

    def test_revaluation_arithmetic(self):
        scenario = StressScenario(
            "t", "Test", "", {AssetClass.EQUITY: -0.30, AssetClass.FIXED_INCOME: 0.05}
        )
        positions = [
            StressPosition("Stocks", AssetClass.EQUITY, 600_000),
            StressPosition("Bonds", AssetClass.FIXED_INCOME, 300_000),
            StressPosition("Cash", AssetClass.CASH, 100_000),
        ]
        result = StressTester().run(positions, scenario)
        assert [line.pnl for line in result.lines] == pytest.approx([-180_000, 15_000, 0])
        assert result.pnl == pytest.approx(-165_000)
        assert result.value_after == pytest.approx(835_000)
        assert result.pnl_pct == pytest.approx(-0.165)

    def test_short_position_gains_in_crash(self):
        scenario = ScenarioLibrary.default().get("gfc_2008")
        result = StressTester().run(
            [StressPosition("Short SPX", AssetClass.EQUITY, -100_000)], scenario
        )
        assert result.pnl == pytest.approx(50_000)

    def test_shock_below_minus_100pct_rejected(self):
        with pytest.raises(InvalidInputError):
            StressScenario("bad", "Bad", "", {AssetClass.EQUITY: -1.5})

    def test_duplicate_registration_rejected(self):
        library = ScenarioLibrary.default()
        with pytest.raises(InvalidInputError, match="already registered"):
            library.register(library.get("gfc_2008"))

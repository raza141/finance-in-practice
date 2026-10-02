import numpy as np
import pytest

from app.core.exceptions import InfeasibleProblemError, InvalidInputError
from app.engines.portfolio import EfficientFrontier, MeanVarianceOptimizer, PortfolioConstraints

UNCONSTRAINED = PortfolioConstraints(long_only=False)
LONG_ONLY = PortfolioConstraints(long_only=True)


def optimizer(data: dict, constraints: PortfolioConstraints) -> MeanVarianceOptimizer:
    return MeanVarianceOptimizer(data["mu"], data["cov"], data["rf"], constraints)


@pytest.fixture
def three_assets() -> dict:
    """A universe where the unconstrained tangency portfolio shorts asset C."""
    sd = np.array([0.15, 0.20, 0.25])
    corr = np.array([[1.0, 0.3, 0.8], [0.3, 1.0, 0.4], [0.8, 0.4, 1.0]])
    return {"mu": np.array([0.10, 0.12, 0.09]), "cov": np.outer(sd, sd) * corr, "rf": 0.03}


class TestBodieKaneMarcus:
    """BKM *Investments* ch. 7: D (8%, 12%), E (13%, 20%), rho 0.3, rf 5%.
    Min-variance: wD 0.82, E[r] 8.90%, sigma 11.45%.
    Optimal risky: wD 0.40, E[r] 11%, sigma 14.2%, Sharpe 0.42."""

    @pytest.mark.parametrize("constraints", [UNCONSTRAINED, LONG_ONLY])
    def test_min_variance(self, bkm_two_assets, constraints):
        result = optimizer(bkm_two_assets, constraints).min_variance()
        np.testing.assert_allclose(result.weights, [0.82, 0.18], atol=1e-6)
        assert result.expected_return == pytest.approx(0.0890, abs=1e-6)
        assert result.volatility == pytest.approx(0.1145, abs=5e-5)

    @pytest.mark.parametrize("constraints", [UNCONSTRAINED, LONG_ONLY])
    def test_tangency(self, bkm_two_assets, constraints):
        result = optimizer(bkm_two_assets, constraints).max_sharpe()
        np.testing.assert_allclose(result.weights, [0.40, 0.60], atol=1e-6)
        assert result.expected_return == pytest.approx(0.11, abs=1e-6)
        assert result.volatility == pytest.approx(0.142, abs=5e-4)
        assert result.sharpe == pytest.approx(0.42, abs=5e-3)

    def test_two_asset_closed_form_min_variance(self, bkm_two_assets):
        cov = bkm_two_assets["cov"]
        w_d = (cov[1, 1] - cov[0, 1]) / (cov[0, 0] + cov[1, 1] - 2 * cov[0, 1])
        result = optimizer(bkm_two_assets, UNCONSTRAINED).min_variance()
        assert result.weights[0] == pytest.approx(w_d, abs=1e-12)


class TestConstrainedOptimisation:
    def test_long_only_removes_short(self, three_assets):
        free = optimizer(three_assets, UNCONSTRAINED).max_sharpe()
        constrained = optimizer(three_assets, LONG_ONLY).max_sharpe()
        assert free.weights.min() < 0
        assert constrained.weights.min() >= 0
        assert constrained.weights.sum() == pytest.approx(1.0)
        assert constrained.sharpe <= free.sharpe + 1e-9

    def test_long_only_max_sharpe_beats_random_portfolios(self, three_assets):
        opt = optimizer(three_assets, LONG_ONLY)
        best = opt.max_sharpe().sharpe
        rng = np.random.default_rng(0)
        for w in rng.dirichlet(np.ones(3), size=2000):
            assert opt.evaluate(w).sharpe <= best + 1e-9

    def test_max_weight_cap(self, three_assets):
        constraints = PortfolioConstraints(long_only=True, max_weight=0.4)
        opt = optimizer(three_assets, constraints)
        for result in (opt.min_variance(), opt.max_sharpe(), opt.target_return(0.105)):
            assert result.weights.max() <= 0.4 + 1e-8
            assert result.weights.sum() == pytest.approx(1.0)

    def test_infeasible_cap(self, three_assets):
        with pytest.raises(InfeasibleProblemError):
            optimizer(three_assets, PortfolioConstraints(max_weight=0.3)).min_variance()

    def test_target_return_outside_range(self, three_assets):
        with pytest.raises(InfeasibleProblemError, match="outside feasible range"):
            optimizer(three_assets, LONG_ONLY).target_return(0.20)


class TestTargetReturn:
    def test_merton_matches_slsqp_when_interior(self, bkm_two_assets):
        free = optimizer(bkm_two_assets, UNCONSTRAINED).target_return(0.10)
        constrained = optimizer(bkm_two_assets, LONG_ONLY).target_return(0.10)
        np.testing.assert_allclose(free.weights, constrained.weights, atol=1e-6)
        assert free.expected_return == pytest.approx(0.10)

    def test_frontier_portfolio_hits_target(self, three_assets):
        result = optimizer(three_assets, UNCONSTRAINED).target_return(0.15)
        assert result.expected_return == pytest.approx(0.15, abs=1e-12)
        assert result.weights.sum() == pytest.approx(1.0)


class TestEfficientFrontier:
    @pytest.mark.parametrize("constraints", [UNCONSTRAINED, LONG_ONLY])
    def test_frontier_shape(self, three_assets, constraints):
        frontier = EfficientFrontier(optimizer(three_assets, constraints)).compute(n_points=25)
        returns = [p.expected_return for p in frontier.points]
        vols = [p.volatility for p in frontier.points]
        assert len(frontier.points) == 25
        assert np.all(np.diff(returns) > 0)
        assert np.all(np.diff(vols) >= -1e-9)
        assert frontier.points[0] is frontier.min_variance
        assert frontier.tangency is not None
        assert frontier.tangency.sharpe >= max(p.sharpe for p in frontier.points) - 1e-6

    def test_tangency_none_when_rf_too_high(self, bkm_two_assets):
        data = {**bkm_two_assets, "rf": 0.20}
        frontier = EfficientFrontier(optimizer(data, UNCONSTRAINED)).compute(10)
        assert frontier.tangency is None


class TestInputs:
    def test_from_returns_annualises(self):
        rng = np.random.default_rng(2)
        returns = rng.normal([0.0004, 0.0006], [0.01, 0.015], size=(2000, 2))
        opt = MeanVarianceOptimizer.from_returns(returns, periods_per_year=252)
        np.testing.assert_allclose(opt.mu, returns.mean(axis=0) * 252)
        np.testing.assert_allclose(opt.cov, np.cov(returns, rowvar=False) * 252)

    def test_singular_covariance_rejected(self):
        with pytest.raises(InvalidInputError, match="positive definite"):
            MeanVarianceOptimizer([0.1, 0.1], [[0.04, 0.04], [0.04, 0.04]])

    def test_rf_above_mvp_return_has_no_tangency(self, bkm_two_assets):
        data = {**bkm_two_assets, "rf": 0.20}
        with pytest.raises(InfeasibleProblemError, match="no tangency"):
            optimizer(data, UNCONSTRAINED).max_sharpe()

    def test_max_weight_requires_long_only(self):
        with pytest.raises(InvalidInputError):
            PortfolioConstraints(long_only=False, max_weight=0.5)


class TestAtInputLimits:
    """Exercise the optimizer at the API's own caps (MAX_ASSETS, MAX_FRONTIER_POINTS)."""

    @pytest.fixture
    def universe(self) -> dict:
        from app.core.limits import MAX_ASSETS

        rng = np.random.default_rng(0)
        loadings = rng.normal(0, 0.1, size=(MAX_ASSETS, 5))
        cov = loadings @ loadings.T + np.diag(rng.uniform(0.01, 0.05, MAX_ASSETS))
        return {"mu": rng.uniform(0.02, 0.15, MAX_ASSETS), "cov": cov, "rf": 0.03}

    @pytest.mark.parametrize("cap", [None, 0.1])
    def test_long_only_frontier_at_cap(self, universe, cap):
        from app.core.limits import MAX_FRONTIER_POINTS

        opt = optimizer(universe, PortfolioConstraints(long_only=True, max_weight=cap))
        frontier = EfficientFrontier(opt).compute(MAX_FRONTIER_POINTS)
        returns = np.array([p.expected_return for p in frontier.points])
        vols = np.array([p.volatility for p in frontier.points])
        weights = np.array([p.weights for p in frontier.points])
        assert len(frontier.points) == MAX_FRONTIER_POINTS
        assert np.all(np.diff(returns) > 0)
        assert np.all(np.diff(vols) >= -1e-7)
        assert weights.min() >= 0
        np.testing.assert_allclose(weights.sum(axis=1), 1.0)
        if cap is not None:
            assert weights.max() <= cap + 1e-7

    def test_max_return_corner_is_single_best_asset(self, universe):
        """The top of an uncapped long-only frontier is 100% in the highest-return asset."""
        opt = optimizer(universe, LONG_ONLY)
        top = opt.target_return(opt.return_range()[1])
        assert top.weights.argmax() == universe["mu"].argmax()
        assert top.weights.max() == pytest.approx(1.0, abs=1e-6)

    def test_qp_matches_closed_form_when_unconstrained_is_long(self, bkm_two_assets):
        """Interior solutions: QP and closed form must agree to solver precision."""
        qp = optimizer(bkm_two_assets, LONG_ONLY)
        closed = optimizer(bkm_two_assets, UNCONSTRAINED)
        for name in ("min_variance", "max_sharpe"):
            np.testing.assert_allclose(
                getattr(qp, name)().weights, getattr(closed, name)().weights, atol=1e-7
            )

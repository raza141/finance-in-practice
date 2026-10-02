import pytest

BS_HULL = {"spot": 42, "strike": 40, "time_to_expiry": 0.5, "rate": 0.10, "volatility": 0.20}
HULL_COV = [[0.0004, 0.00006], [0.00006, 0.0001]]
POSITIONS = [{"name": "MSFT", "value": 10_000_000}, {"name": "T", "value": 5_000_000}]
BKM = {
    "assets": ["Bond fund", "Stock fund"],
    "expected_returns": [0.08, 0.13],
    "covariance": [[0.0144, 0.0072], [0.0072, 0.04]],
    "risk_free_rate": 0.05,
}


class TestMeta:
    def test_health(self, client):
        response = client.get("/health")
        assert response.status_code == 200
        assert response.json()["status"] == "ok"

    def test_openapi_schema_available(self, client):
        paths = client.get("/openapi.json").json()["paths"]
        assert "/api/v1/portfolio/optimize" in paths
        assert "post" in paths["/api/v1/portfolio/optimize"]


class TestPricingEndpoints:
    def test_black_scholes(self, client):
        body = client.post("/api/v1/pricing/black-scholes", json=BS_HULL).json()
        assert body["price"] == pytest.approx(4.76, abs=0.005)

    def test_put(self, client):
        body = client.post(
            "/api/v1/pricing/black-scholes", json={**BS_HULL, "option_type": "put"}
        ).json()
        assert body["price"] == pytest.approx(0.81, abs=0.005)

    def test_implied_volatility(self, client):
        payload = {k: v for k, v in BS_HULL.items() if k != "volatility"}
        price = client.post("/api/v1/pricing/black-scholes", json=BS_HULL).json()["price"]
        body = client.post(
            "/api/v1/pricing/implied-volatility", json={**payload, "market_price": price}
        ).json()
        assert body["implied_volatility"] == pytest.approx(0.20, abs=1e-8)

    def test_implied_volatility_arbitrage_violation_is_422(self, client):
        payload = {k: v for k, v in BS_HULL.items() if k != "volatility"}
        response = client.post(
            "/api/v1/pricing/implied-volatility", json={**payload, "market_price": 100}
        )
        assert response.status_code == 422
        assert response.json()["type"] == "InvalidInputError"

    def test_bond(self, client):
        body = client.post(
            "/api/v1/pricing/bond",
            json={
                "coupon_rate": 0.10,
                "maturity_years": 3,
                "ytm": 0.12,
                "compounding": "continuous",
            },
        ).json()
        assert body["price"] == pytest.approx(94.213, abs=5e-4)
        assert body["macaulay_duration"] == pytest.approx(2.653, abs=5e-4)
        assert len(body["cash_flows"]) == 6

    def test_bond_requires_exactly_one_of_ytm_or_price(self, client):
        response = client.post(
            "/api/v1/pricing/bond", json={"coupon_rate": 0.05, "maturity_years": 2}
        )
        assert response.status_code == 422

    def test_bootstrap(self, client):
        instruments = [
            {"maturity": 0.25, "price": 97.5},
            {"maturity": 0.5, "price": 94.9},
            {"maturity": 1.0, "price": 90.0},
            {"maturity": 1.5, "coupon_rate": 0.08, "price": 96.0},
            {"maturity": 2.0, "coupon_rate": 0.12, "price": 101.6},
        ]
        body = client.post(
            "/api/v1/pricing/yield-curve/bootstrap", json={"instruments": instruments}
        ).json()
        assert body["points"][-1]["zero_rate"] == pytest.approx(0.10808, abs=1e-5)

    @pytest.mark.parametrize(
        "override",
        [{"spot": -1}, {"volatility": 0}, {"volatility": 50}, {"spot": "NaN"}, {"unknown": 1}],
    )
    def test_invalid_payloads(self, client, override):
        response = client.post("/api/v1/pricing/black-scholes", json={**BS_HULL, **override})
        assert response.status_code == 422


class TestRiskEndpoints:
    def test_parametric_var(self, client):
        body = client.post(
            "/api/v1/risk/var/parametric",
            json={"positions": POSITIONS, "covariance": HULL_COV, "horizon_days": 10},
        ).json()
        assert body["var"] == pytest.approx(1_620_100, rel=1e-4)
        assert body["var_pct"] == pytest.approx(body["var"] / 15_000_000)

    def test_monte_carlo_var(self, client):
        body = client.post(
            "/api/v1/risk/var/monte-carlo",
            json={
                "positions": POSITIONS,
                "covariance": HULL_COV,
                "horizon_days": 10,
                "n_sims": 50_000,
                "seed": 1,
            },
        ).json()
        assert body["method"] == "monte_carlo"
        assert body["var"] == pytest.approx(1_620_100, rel=0.03)

    def test_historical_var(self, client):
        returns = [[-(i + 1) / 1000] for i in range(500)]
        body = client.post(
            "/api/v1/risk/var/historical",
            json={"positions": [{"name": "A", "value": 1000}], "returns": returns},
        ).json()
        assert body["var"] == pytest.approx(496)

    @pytest.mark.parametrize(
        "override,reason",
        [
            ({"n_sims": 500_000}, "above MAX_MC_SIMS"),
            ({"n_sims": 10}, "below MIN_MC_SIMS"),
            ({"horizon_days": 1000}, "horizon too long"),
            ({"confidence": 0.5}, "confidence too low"),
            ({"covariance": [[0.0004, 0.1], [0.1, 0.0001]]}, "not PSD"),
            ({"covariance": [[0.0004]]}, "wrong shape"),
            ({"distribution": "cauchy"}, "unknown distribution"),
        ],
    )
    def test_monte_carlo_limits(self, client, override, reason):
        payload = {"positions": POSITIONS, "covariance": HULL_COV, **override}
        response = client.post("/api/v1/risk/var/monte-carlo", json=payload)
        assert response.status_code == 422, reason

    def test_monte_carlo_cell_budget(self, client):
        n = 50
        payload = {
            "positions": [{"name": f"A{i}", "value": 1.0} for i in range(n)],
            "covariance": [[0.0001 if i == j else 0.0 for j in range(n)] for i in range(n)],
            "n_sims": 100_000,  # 100k x 50 = 5M cells: exactly at the limit
        }
        assert client.post("/api/v1/risk/var/monte-carlo", json=payload).status_code == 200
        payload["positions"].append({"name": "extra", "value": 1.0})
        payload["covariance"] = [
            [0.0001 if i == j else 0.0 for j in range(n + 1)] for i in range(n + 1)
        ]
        response = client.post("/api/v1/risk/var/monte-carlo", json=payload)
        assert response.status_code == 422

    def test_historical_requires_enough_observations(self, client):
        response = client.post(
            "/api/v1/risk/var/historical",
            json={"positions": [{"name": "A", "value": 1}], "returns": [[0.01]] * 50},
        )
        assert response.status_code == 422
        assert "at least 100" in response.text


class TestStressTestEndpoints:
    def test_list_scenarios(self, client):
        keys = {s["key"] for s in client.get("/api/v1/stress-test/scenarios").json()}
        assert "gfc_2008" in keys

    def test_preset(self, client):
        body = client.post(
            "/api/v1/stress-test",
            json={
                "scenario": "gfc_2008",
                "positions": [
                    {"name": "Stocks", "asset_class": "equity", "value": 600_000},
                    {"name": "Treasuries", "asset_class": "fixed_income", "value": 400_000},
                ],
            },
        ).json()
        assert body["pnl"] == pytest.approx(-300_000 + 32_000)

    def test_custom_shocks(self, client):
        body = client.post(
            "/api/v1/stress-test",
            json={
                "custom_shocks": {"equity": -0.2},
                "positions": [{"name": "Stocks", "asset_class": "equity", "value": 100}],
            },
        ).json()
        assert body["value_after"] == pytest.approx(80)

    def test_unknown_scenario(self, client):
        response = client.post(
            "/api/v1/stress-test",
            json={
                "scenario": "nope",
                "positions": [{"name": "A", "asset_class": "equity", "value": 1}],
            },
        )
        assert response.status_code == 422

    def test_scenario_and_custom_are_exclusive(self, client):
        response = client.post(
            "/api/v1/stress-test",
            json={
                "scenario": "gfc_2008",
                "custom_shocks": {"equity": -0.1},
                "positions": [{"name": "A", "asset_class": "equity", "value": 1}],
            },
        )
        assert response.status_code == 422


class TestPortfolioEndpoints:
    def test_max_sharpe(self, client):
        body = client.post("/api/v1/portfolio/optimize", json=BKM).json()
        assert body["weights"]["Bond fund"] == pytest.approx(0.40, abs=1e-6)
        assert body["sharpe"] == pytest.approx(0.42, abs=5e-3)

    def test_min_variance(self, client):
        body = client.post(
            "/api/v1/portfolio/optimize", json={**BKM, "objective": "min_variance"}
        ).json()
        assert body["weights"]["Bond fund"] == pytest.approx(0.82, abs=1e-6)

    def test_target_return_requires_target(self, client):
        response = client.post(
            "/api/v1/portfolio/optimize", json={**BKM, "objective": "target_return"}
        )
        assert response.status_code == 422

    def test_infeasible_target_is_422(self, client):
        response = client.post(
            "/api/v1/portfolio/optimize",
            json={**BKM, "objective": "target_return", "target_return": 0.5},
        )
        assert response.status_code == 422
        assert response.json()["type"] == "InfeasibleProblemError"

    def test_from_returns_history(self, client):
        import numpy as np

        returns = np.random.default_rng(0).normal([0.0004, 0.0005], [0.01, 0.012], (500, 2))
        body = client.post(
            "/api/v1/portfolio/optimize",
            json={"assets": ["A", "B"], "returns": returns.tolist(), "objective": "min_variance"},
        ).json()
        assert sum(body["weights"].values()) == pytest.approx(1.0)

    def test_inputs_are_mutually_exclusive(self, client):
        response = client.post(
            "/api/v1/portfolio/optimize", json={**BKM, "returns": [[0.0, 0.0]] * 10}
        )
        assert response.status_code == 422

    def test_frontier(self, client):
        body = client.post("/api/v1/portfolio/frontier", json={**BKM, "n_points": 20}).json()
        assert len(body["points"]) == 20
        assert body["tangency"]["weights"]["Stock fund"] == pytest.approx(0.60, abs=1e-6)

    def test_optimize_is_post_only(self, client):
        assert client.get("/api/v1/portfolio/optimize").status_code == 405


class TestRateLimiting:
    @pytest.fixture
    def limiter(self, client):
        limiter = client.app.state.rate_limiter
        limiter.enabled = True
        limiter.reset()
        yield limiter
        limiter.enabled = False
        limiter.reset()

    def test_requests_beyond_limit_get_429(self, client, limiter):
        statuses = [
            client.post("/api/v1/pricing/black-scholes", json=BS_HULL).status_code
            for _ in range(61)
        ]
        assert statuses[:60] == [200] * 60
        last = client.post("/api/v1/pricing/black-scholes", json=BS_HULL)
        assert last.status_code == 429
        assert int(last.headers["Retry-After"]) >= 1

    def test_health_is_exempt(self, client, limiter):
        assert all(client.get("/health").status_code == 200 for _ in range(70))

    def test_cors_preflight_is_never_limited(self, client, limiter):
        for _ in range(61):
            client.get("/api/v1/stress-test/scenarios")
        preflight = client.options(
            "/api/v1/pricing/black-scholes",
            headers={"Origin": "http://localhost:3000", "Access-Control-Request-Method": "POST"},
        )
        assert preflight.status_code == 200

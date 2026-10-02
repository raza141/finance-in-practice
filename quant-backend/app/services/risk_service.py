"""Application service mapping risk schemas to VaR and stress-test engines."""

from dataclasses import asdict

from app.engines.risk import (
    HistoricalVaR,
    MonteCarloVaR,
    ParametricVaR,
    ScenarioLibrary,
    StressPosition,
    StressScenario,
    StressTester,
    VaRModel,
    VaRResult,
)
from app.schemas.risk import (
    HistoricalVaRRequest,
    MonteCarloVaRRequest,
    ParametricVaRRequest,
    Position,
    ScenarioOut,
    StressTestRequest,
    StressTestResponse,
    VaRResponse,
)


class VaRService:
    def parametric(self, req: ParametricVaRRequest) -> VaRResponse:
        model = ParametricVaR(req.covariance, req.mean_returns, req.confidence, req.horizon_days)
        return self._run(model, req.positions)

    def historical(self, req: HistoricalVaRRequest) -> VaRResponse:
        model = HistoricalVaR(req.returns, req.confidence, req.horizon_days)
        return self._run(model, req.positions)

    def monte_carlo(self, req: MonteCarloVaRRequest) -> VaRResponse:
        model = MonteCarloVaR(
            req.covariance,
            req.mean_returns,
            req.confidence,
            req.horizon_days,
            n_sims=req.n_sims,
            distribution=req.distribution,
            degrees_of_freedom=req.degrees_of_freedom,
            seed=req.seed,
        )
        return self._run(model, req.positions)

    @staticmethod
    def _run(model: VaRModel, positions: list[Position]) -> VaRResponse:
        result: VaRResult = model.calculate([p.value for p in positions])
        return VaRResponse(**asdict(result), var_pct=result.var_pct)


class StressTestService:
    def __init__(
        self, library: ScenarioLibrary | None = None, tester: StressTester | None = None
    ) -> None:
        self._library = library or ScenarioLibrary.default()
        self._tester = tester or StressTester()

    def scenarios(self) -> list[ScenarioOut]:
        return [
            ScenarioOut(key=s.key, name=s.name, description=s.description, shocks=dict(s.shocks))
            for s in self._library
        ]

    def run(self, req: StressTestRequest) -> StressTestResponse:
        if req.scenario is not None:
            scenario = self._library.get(req.scenario)
        else:
            scenario = StressScenario("custom", "Custom scenario", "", req.custom_shocks or {})
        positions = [StressPosition(p.name, p.asset_class, p.value) for p in req.positions]
        return StressTestResponse(**asdict(self._tester.run(positions, scenario)))

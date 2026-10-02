"""Scenario-based stress testing with asset-class return shocks."""

from __future__ import annotations

from collections.abc import Iterator, Mapping, Sequence
from dataclasses import dataclass, field
from enum import StrEnum
from types import MappingProxyType

from app.core.exceptions import InvalidInputError


class AssetClass(StrEnum):
    EQUITY = "equity"
    FIXED_INCOME = "fixed_income"
    CREDIT = "credit"
    COMMODITY = "commodity"
    REAL_ESTATE = "real_estate"
    FX = "fx"
    CASH = "cash"


@dataclass(frozen=True)
class StressScenario:
    key: str
    name: str
    description: str
    shocks: Mapping[AssetClass, float] = field(default_factory=dict)

    def __post_init__(self) -> None:
        if any(s < -1 for s in self.shocks.values()):
            raise InvalidInputError("a shock below -100% is not meaningful for a linear position")
        object.__setattr__(self, "shocks", MappingProxyType(dict(self.shocks)))

    def shock_for(self, asset_class: AssetClass) -> float:
        return float(self.shocks.get(asset_class, 0.0))


@dataclass(frozen=True)
class StressPosition:
    name: str
    asset_class: AssetClass
    value: float


@dataclass(frozen=True)
class StressLine:
    name: str
    asset_class: AssetClass
    value_before: float
    shock: float
    pnl: float
    value_after: float


@dataclass(frozen=True)
class StressResult:
    scenario: str
    lines: list[StressLine]
    value_before: float
    value_after: float
    pnl: float
    pnl_pct: float


class ScenarioLibrary:
    """Registry of named stress scenarios.

    The default presets are illustrative, rounded shocks loosely based on
    broad index moves. They are teaching scenarios, not calibrated outputs.
    """

    def __init__(self, scenarios: Sequence[StressScenario] = ()) -> None:
        self._scenarios: dict[str, StressScenario] = {}
        for scenario in scenarios:
            self.register(scenario)

    def register(self, scenario: StressScenario) -> None:
        if scenario.key in self._scenarios:
            raise InvalidInputError(f"scenario {scenario.key!r} already registered")
        self._scenarios[scenario.key] = scenario

    def get(self, key: str) -> StressScenario:
        try:
            return self._scenarios[key]
        except KeyError:
            raise InvalidInputError(f"unknown scenario {key!r}") from None

    def __contains__(self, key: object) -> bool:
        return key in self._scenarios

    def __iter__(self) -> Iterator[StressScenario]:
        return iter(self._scenarios.values())

    def __len__(self) -> int:
        return len(self._scenarios)

    @classmethod
    def default(cls) -> ScenarioLibrary:
        A = AssetClass
        return cls(
            [
                StressScenario(
                    "gfc_2008",
                    "Global Financial Crisis (2008-09)",
                    "Equity crash, credit spread blow-out, flight to quality into "
                    "government bonds.",
                    {
                        A.EQUITY: -0.50,
                        A.CREDIT: -0.25,
                        A.FIXED_INCOME: 0.08,
                        A.COMMODITY: -0.50,
                        A.REAL_ESTATE: -0.60,
                        A.FX: -0.10,
                    },
                ),
                StressScenario(
                    "covid_2020",
                    "COVID-19 Crash (Feb-Mar 2020)",
                    "Rapid liquidity shock across risk assets with a short-lived Treasury rally.",
                    {
                        A.EQUITY: -0.34,
                        A.CREDIT: -0.20,
                        A.FIXED_INCOME: 0.03,
                        A.COMMODITY: -0.35,
                        A.REAL_ESTATE: -0.40,
                        A.FX: -0.05,
                    },
                ),
                StressScenario(
                    "rates_up_200bp",
                    "Parallel Rate Shock (+200bp)",
                    "Instantaneous +200bp move in yields on ~6-year duration bonds; "
                    "equities re-rate lower.",
                    {A.EQUITY: -0.10, A.CREDIT: -0.12, A.FIXED_INCOME: -0.12, A.REAL_ESTATE: -0.15},
                ),
                StressScenario(
                    "stagflation",
                    "Stagflation (1970s-style)",
                    "High inflation with weak growth: real assets outperform nominal ones.",
                    {
                        A.EQUITY: -0.25,
                        A.CREDIT: -0.15,
                        A.FIXED_INCOME: -0.15,
                        A.COMMODITY: 0.30,
                        A.REAL_ESTATE: -0.05,
                        A.FX: -0.10,
                    },
                ),
            ]
        )


class StressTester:
    """Revalues linear positions under instantaneous asset-class shocks.

    Asset classes missing from a scenario are left unchanged.
    """

    def run(self, positions: Sequence[StressPosition], scenario: StressScenario) -> StressResult:
        lines = []
        for p in positions:
            shock = scenario.shock_for(p.asset_class)
            pnl = p.value * shock
            lines.append(StressLine(p.name, p.asset_class, p.value, shock, pnl, p.value + pnl))
        before = sum(line.value_before for line in lines)
        total_pnl = sum(line.pnl for line in lines)
        pct = total_pnl / before if before else 0.0
        return StressResult(scenario.name, lines, before, before + total_pnl, total_pnl, pct)

"""Application service mapping pricing schemas to pricing engines."""

from dataclasses import asdict

from app.engines.pricing import (
    BlackScholesModel,
    CurveInstrument,
    FixedRateBond,
    OptionContract,
    ZeroCurveBootstrapper,
)
from app.schemas.pricing import (
    BlackScholesRequest,
    BlackScholesResponse,
    BondRequest,
    BondResponse,
    BootstrapRequest,
    BootstrapResponse,
    ImpliedVolRequest,
    ImpliedVolResponse,
    ZeroPointOut,
)


class PricingService:
    def __init__(self, option_model: BlackScholesModel | None = None) -> None:
        self._options = option_model or BlackScholesModel()

    @staticmethod
    def _contract(req: BlackScholesRequest | ImpliedVolRequest) -> OptionContract:
        return OptionContract(
            spot=req.spot,
            strike=req.strike,
            expiry=req.time_to_expiry,
            rate=req.rate,
            dividend_yield=req.dividend_yield,
            option_type=req.option_type,
        )

    def black_scholes(self, req: BlackScholesRequest) -> BlackScholesResponse:
        valuation = self._options.value(self._contract(req), req.volatility)
        return BlackScholesResponse(**asdict(valuation))

    def implied_volatility(self, req: ImpliedVolRequest) -> ImpliedVolResponse:
        iv = self._options.implied_volatility(self._contract(req), req.market_price)
        return ImpliedVolResponse(implied_volatility=iv)

    def bond(self, req: BondRequest) -> BondResponse:
        bond = FixedRateBond(req.coupon_rate, req.maturity_years, req.frequency, req.face)
        analytics = asdict(
            bond.analytics(ytm=req.ytm, price=req.price, compounding=req.compounding)
        )
        analytics["ytm"] = analytics.pop("yield_to_maturity")
        return BondResponse(**analytics)

    def bootstrap(self, req: BootstrapRequest) -> BootstrapResponse:
        instruments = [CurveInstrument(i.maturity, i.coupon_rate, i.price) for i in req.instruments]
        curve = ZeroCurveBootstrapper(req.frequency, req.face).build(instruments)
        return BootstrapResponse(
            points=[ZeroPointOut(maturity=p.maturity, zero_rate=p.zero_rate) for p in curve.points]
        )

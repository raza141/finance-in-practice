from typing import Annotated

from fastapi import APIRouter, Depends

from app.api.deps import get_pricing_service
from app.schemas.pricing import (
    BlackScholesRequest,
    BlackScholesResponse,
    BondRequest,
    BondResponse,
    BootstrapRequest,
    BootstrapResponse,
    ImpliedVolRequest,
    ImpliedVolResponse,
)
from app.services.pricing_service import PricingService

router = APIRouter(prefix="/pricing", tags=["pricing"])
Service = Annotated[PricingService, Depends(get_pricing_service)]


@router.post("/black-scholes", response_model=BlackScholesResponse)
def black_scholes(req: BlackScholesRequest, service: Service) -> BlackScholesResponse:
    return service.black_scholes(req)


@router.post("/implied-volatility", response_model=ImpliedVolResponse)
def implied_volatility(req: ImpliedVolRequest, service: Service) -> ImpliedVolResponse:
    return service.implied_volatility(req)


@router.post("/bond", response_model=BondResponse)
def bond(req: BondRequest, service: Service) -> BondResponse:
    return service.bond(req)


@router.post("/yield-curve/bootstrap", response_model=BootstrapResponse)
def bootstrap(req: BootstrapRequest, service: Service) -> BootstrapResponse:
    return service.bootstrap(req)

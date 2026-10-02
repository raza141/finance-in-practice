from typing import Annotated

from fastapi import APIRouter, Depends

from app.api.deps import get_portfolio_service
from app.schemas.portfolio import FrontierRequest, FrontierResponse, OptimizeRequest, PortfolioOut
from app.services.portfolio_service import PortfolioService

router = APIRouter(prefix="/portfolio", tags=["portfolio"])
Service = Annotated[PortfolioService, Depends(get_portfolio_service)]


@router.post("/optimize", response_model=PortfolioOut)
def optimize(req: OptimizeRequest, service: Service) -> PortfolioOut:
    return service.optimize(req)


@router.post("/frontier", response_model=FrontierResponse)
def frontier(req: FrontierRequest, service: Service) -> FrontierResponse:
    return service.frontier(req)

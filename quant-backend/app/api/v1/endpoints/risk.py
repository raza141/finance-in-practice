from typing import Annotated

from fastapi import APIRouter, Depends

from app.api.deps import get_var_service
from app.schemas.risk import (
    HistoricalVaRRequest,
    MonteCarloVaRRequest,
    ParametricVaRRequest,
    VaRResponse,
)
from app.services.risk_service import VaRService

router = APIRouter(prefix="/risk", tags=["risk"])
Service = Annotated[VaRService, Depends(get_var_service)]


@router.post("/var/parametric", response_model=VaRResponse)
def parametric_var(req: ParametricVaRRequest, service: Service) -> VaRResponse:
    return service.parametric(req)


@router.post("/var/historical", response_model=VaRResponse)
def historical_var(req: HistoricalVaRRequest, service: Service) -> VaRResponse:
    return service.historical(req)


@router.post("/var/monte-carlo", response_model=VaRResponse)
def monte_carlo_var(req: MonteCarloVaRRequest, service: Service) -> VaRResponse:
    return service.monte_carlo(req)

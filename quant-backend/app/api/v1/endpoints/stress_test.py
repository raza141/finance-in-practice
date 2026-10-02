from typing import Annotated

from fastapi import APIRouter, Depends

from app.api.deps import get_stress_test_service
from app.schemas.risk import ScenarioOut, StressTestRequest, StressTestResponse
from app.services.risk_service import StressTestService

router = APIRouter(prefix="/stress-test", tags=["stress-test"])
Service = Annotated[StressTestService, Depends(get_stress_test_service)]


@router.get("/scenarios", response_model=list[ScenarioOut])
def list_scenarios(service: Service) -> list[ScenarioOut]:
    return service.scenarios()


@router.post("", response_model=StressTestResponse)
def run_stress_test(req: StressTestRequest, service: Service) -> StressTestResponse:
    return service.run(req)

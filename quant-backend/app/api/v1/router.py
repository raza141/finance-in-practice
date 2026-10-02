from fastapi import APIRouter

from app.api.v1.endpoints import portfolio, pricing, risk, stress_test

api_router = APIRouter(prefix="/api/v1")
for module in (pricing, risk, stress_test, portfolio):
    api_router.include_router(module.router)

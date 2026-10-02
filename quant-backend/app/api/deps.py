"""Dependency providers. Override these in tests via ``app.dependency_overrides``."""

from functools import lru_cache

from app.services.portfolio_service import PortfolioService
from app.services.pricing_service import PricingService
from app.services.risk_service import StressTestService, VaRService


@lru_cache
def get_pricing_service() -> PricingService:
    return PricingService()


@lru_cache
def get_var_service() -> VaRService:
    return VaRService()


@lru_cache
def get_stress_test_service() -> StressTestService:
    return StressTestService()


@lru_cache
def get_portfolio_service() -> PortfolioService:
    return PortfolioService()

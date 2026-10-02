import os

# Must be set before the app (and its rate limiter) is imported.
os.environ.setdefault("RATE_LIMIT_ENABLED", "false")
os.environ.setdefault("ENVIRONMENT", "test")

import numpy as np  # noqa: E402
import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402


@pytest.fixture(scope="session")
def client() -> TestClient:
    return TestClient(app)


@pytest.fixture
def bkm_two_assets() -> dict:
    """Bodie, Kane & Marcus, *Investments*, ch. 7: bond fund D and stock fund E."""
    sd_d, sd_e, rho = 0.12, 0.20, 0.30
    return {
        "mu": np.array([0.08, 0.13]),
        "cov": np.array([[sd_d**2, rho * sd_d * sd_e], [rho * sd_d * sd_e, sd_e**2]]),
        "rf": 0.05,
    }


@pytest.fixture
def hull_two_asset_var() -> dict:
    """Hull, *Risk Management and Financial Institutions*: $10m Microsoft (2% daily
    vol) and $5m AT&T (1% daily vol), correlation 0.3."""
    s1, s2, rho = 0.02, 0.01, 0.3
    return {
        "positions": np.array([10_000_000.0, 5_000_000.0]),
        "cov": np.array([[s1**2, rho * s1 * s2], [rho * s1 * s2, s2**2]]),
    }

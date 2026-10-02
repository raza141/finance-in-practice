"""Shared schema base class and reusable field types."""

from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field

from app.core.limits import MAX_CONFIDENCE, MIN_CONFIDENCE


class Schema(BaseModel):
    """Strict base: unknown fields are rejected and NaN/inf are never accepted."""

    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)


Confidence = Annotated[
    float,
    Field(ge=MIN_CONFIDENCE, le=MAX_CONFIDENCE, description="VaR confidence level, e.g. 0.99"),
]
Name = Annotated[str, Field(min_length=1, max_length=64)]
Matrix = list[list[float]]

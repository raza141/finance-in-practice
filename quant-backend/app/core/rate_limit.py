"""Per-client rate limiting as a pure ASGI middleware.

Built on ``limits`` directly rather than slowapi: slowapi's middleware cannot
resolve routes inside FastAPI's nested included routers (FastAPI >= 0.13x),
so it silently stops limiting.
"""

from __future__ import annotations

import math
import time
from collections.abc import Iterable

from limits import parse
from limits.storage import storage_from_string
from limits.strategies import MovingWindowRateLimiter
from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Receive, Scope, Send


class RateLimiter:
    """Moving-window limiter keyed by client identity.

    Use ``memory://`` for a single process; use a shared backend such as
    ``redis://host:6379`` when running several workers or replicas.
    """

    def __init__(self, limit: str, storage_uri: str = "memory://", enabled: bool = True) -> None:
        self.item = parse(limit)
        self.storage = storage_from_string(storage_uri)
        self.strategy = MovingWindowRateLimiter(self.storage)
        self.enabled = enabled

    def hit(self, key: str) -> bool:
        """Record a request; return False when the client is over its limit."""
        return self.strategy.hit(self.item, key)

    def retry_after(self, key: str) -> int:
        reset_at = self.strategy.get_window_stats(self.item, key).reset_time
        return max(1, math.ceil(reset_at - time.time()))

    def reset(self) -> None:
        self.storage.reset()


class RateLimitMiddleware:
    """Rejects over-limit HTTP requests with 429 and a ``Retry-After`` header."""

    def __init__(
        self,
        app: ASGIApp,
        limiter: RateLimiter,
        exempt_paths: Iterable[str] = ("/health",),
    ) -> None:
        self.app = app
        self.limiter = limiter
        self.exempt_paths = frozenset(exempt_paths)

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if not self._applies_to(scope):
            await self.app(scope, receive, send)
            return

        key = self._client_key(scope)
        if self.limiter.hit(key):
            await self.app(scope, receive, send)
            return

        response = JSONResponse(
            {"detail": "rate limit exceeded", "type": "RateLimitExceeded"},
            status_code=429,
            headers={"Retry-After": str(self.limiter.retry_after(key))},
        )
        await response(scope, receive, send)

    def _applies_to(self, scope: Scope) -> bool:
        return (
            scope["type"] == "http"
            and self.limiter.enabled
            and scope.get("method") != "OPTIONS"  # never block CORS preflight
            and scope["path"] not in self.exempt_paths
        )

    @staticmethod
    def _client_key(scope: Scope) -> str:
        # Behind a reverse proxy this is the proxy's IP unless uvicorn runs with
        # --proxy-headers AND FORWARDED_ALLOW_IPS lists the proxy (see Dockerfile).
        # Otherwise every client shares a single rate-limit bucket.
        client = scope.get("client")
        return client[0] if client else "anonymous"

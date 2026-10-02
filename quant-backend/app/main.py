"""FastAPI entry point. Run with ``uvicorn app.main:app``."""

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.v1.router import api_router
from app.core.config import Settings, get_settings
from app.core.exceptions import DomainError
from app.core.rate_limit import RateLimiter, RateLimitMiddleware

API_VERSION = "0.1.0"


class ApplicationFactory:
    """Assembles the FastAPI app: middleware, error mapping and routes."""

    def __init__(self, settings: Settings | None = None) -> None:
        self.settings = settings or get_settings()

    def create(self) -> FastAPI:
        app = FastAPI(
            title=self.settings.app_name,
            version=API_VERSION,
            docs_url=None if self.settings.is_production else "/docs",
            redoc_url=None,
        )
        self._configure_middleware(app)
        self._configure_exception_handlers(app)
        self._configure_routes(app)
        return app

    def _configure_middleware(self, app: FastAPI) -> None:
        limiter = RateLimiter(
            self.settings.rate_limit,
            self.settings.rate_limit_storage_uri,
            enabled=self.settings.rate_limit_enabled,
        )
        app.state.rate_limiter = limiter
        # Added first so CORS (added last) wraps it and 429s still carry CORS headers.
        app.add_middleware(RateLimitMiddleware, limiter=limiter, exempt_paths=("/health",))
        app.add_middleware(
            CORSMiddleware,
            allow_origins=self.settings.cors_origin_list,
            allow_methods=["GET", "POST"],
            allow_headers=["Content-Type"],
        )

    @staticmethod
    def _configure_exception_handlers(app: FastAPI) -> None:
        @app.exception_handler(DomainError)
        async def domain_error(_: Request, exc: DomainError) -> JSONResponse:
            return JSONResponse({"detail": str(exc), "type": type(exc).__name__}, 422)

    @staticmethod
    def _configure_routes(app: FastAPI) -> None:
        @app.get("/health", tags=["meta"])
        def health() -> dict[str, str]:
            return {"status": "ok", "version": API_VERSION}

        app.include_router(api_router)


app = ApplicationFactory().create()

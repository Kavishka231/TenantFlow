import logging
import time
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from uuid import uuid4

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import RequestResponseEndpoint
from starlette.responses import Response

from app.api.router import api_router
from app.auth.jwt import SupabaseJwtVerifier
from app.core.config import Settings, get_settings
from app.core.errors import register_error_handlers
from app.core.logging import configure_logging, valid_request_id
from app.db.session import create_database_engine, create_session_factory, validate_runtime_role


def create_app(settings: Settings | None = None) -> FastAPI:
    configured = settings or get_settings()
    configure_logging(configured.log_level)

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        logger = logging.getLogger(__name__)
        logger.info("TenantFlow backend starting")
        engine = create_database_engine(configured)
        app.state.database_engine = engine
        app.state.session_factory = create_session_factory(engine)
        app.state.jwt_verifier = SupabaseJwtVerifier(configured)
        if configured.validate_database_role:
            await validate_runtime_role(engine)
            logger.info("Restricted runtime database role validated")
        try:
            yield
        finally:
            await engine.dispose()
            logger.info("TenantFlow backend stopped")

    app = FastAPI(
        title="TenantFlow API",
        version="0.1.0",
        description=(
            "Authenticated TenantFlow APIs. Every tenant request verifies a Supabase "
            "JWT and executes through transaction-local PostgreSQL RLS context."
        ),
        docs_url="/docs" if configured.environment != "production" else None,
        redoc_url=None,
        lifespan=lifespan,
    )
    app.state.settings = configured
    app.add_middleware(
        CORSMiddleware,
        allow_origins=configured.cors_origins,
        allow_credentials=True,
        allow_methods=["DELETE", "GET", "OPTIONS", "PATCH", "POST", "PUT"],
        allow_headers=[
            "Authorization",
            "Content-Type",
            "Stripe-Signature",
            "X-Expense-Version",
            "X-Receipt-Name",
            "X-Request-ID",
        ],
        expose_headers=["Content-Disposition", "X-Request-ID"],
    )

    @app.middleware("http")
    async def request_context(
        request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        request_id = valid_request_id(request.headers.get("X-Request-ID")) or str(uuid4())
        request.state.request_id = request_id
        started = time.perf_counter()
        status_code = 500
        try:
            response = await call_next(request)
            status_code = response.status_code
            response.headers["X-Request-ID"] = request_id
            response.headers["X-Content-Type-Options"] = "nosniff"
            return response
        finally:
            logging.getLogger("tenantflow.access").info(
                "HTTP request completed",
                extra={
                    "duration_ms": round((time.perf_counter() - started) * 1000, 2),
                    "http_method": request.method,
                    "http_path": request.url.path,
                    "http_status": status_code,
                    "request_id": request_id,
                },
            )

    register_error_handlers(app)
    app.include_router(api_router)
    return app

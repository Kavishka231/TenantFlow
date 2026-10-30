import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from uuid import uuid4

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.auth.jwt import SupabaseJwtVerifier
from app.core.config import Settings, get_settings
from app.core.errors import register_error_handlers
from app.core.logging import configure_logging
from app.db.session import create_database_engine, create_session_factory, validate_runtime_role


def create_app(settings: Settings | None = None) -> FastAPI:
    configured = settings or get_settings()
    configure_logging(configured.log_level)

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        logging.getLogger(__name__).info("TenantFlow backend starting")
        engine = create_database_engine(configured)
        app.state.database_engine = engine
        app.state.session_factory = create_session_factory(engine)
        app.state.jwt_verifier = SupabaseJwtVerifier(configured)
        if configured.validate_database_role:
            await validate_runtime_role(engine)
        try:
            yield
        finally:
            await engine.dispose()
            logging.getLogger(__name__).info("TenantFlow backend stopped")

    app = FastAPI(
        title="TenantFlow API",
        version="0.1.0",
        docs_url="/docs" if configured.environment != "production" else None,
        redoc_url=None,
        lifespan=lifespan,
    )
    app.state.settings = configured
    app.add_middleware(
        CORSMiddleware,
        allow_origins=configured.cors_origins,
        allow_credentials=True,
        allow_methods=["DELETE", "GET", "OPTIONS", "PATCH", "POST"],
        allow_headers=["Authorization", "Content-Type", "X-Request-ID"],
    )

    @app.middleware("http")
    async def request_context(request: Request, call_next):  # type: ignore[no-untyped-def]
        request_id = request.headers.get("X-Request-ID") or str(uuid4())
        request.state.request_id = request_id
        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        return response

    register_error_handlers(app)
    app.include_router(api_router)
    return app

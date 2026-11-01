import logging
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

logger = logging.getLogger(__name__)


class ApiError(Exception):
    def __init__(
        self,
        status_code: int,
        code: str,
        message: str,
        headers: dict[str, str] | None = None,
    ) -> None:
        self.status_code = status_code
        self.code = code
        self.message = message
        self.headers = headers
        super().__init__(message)


def error_body(request: Request, code: str, message: str, details: Any = None) -> dict[str, Any]:
    body: dict[str, Any] = {
        "error": {"code": code, "message": message},
        "request_id": getattr(request.state, "request_id", None),
    }
    if details is not None:
        body["error"]["details"] = details
    return body


def safe_validation_details(exc: RequestValidationError) -> list[dict[str, Any]]:
    return [
        {
            "location": [str(part) for part in error["loc"]],
            "message": error["msg"],
            "type": error["type"],
        }
        for error in exc.errors()
    ]


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(ApiError)
    async def api_error_handler(request: Request, exc: ApiError) -> JSONResponse:
        return JSONResponse(
            content=error_body(request, exc.code, exc.message),
            headers=exc.headers,
            status_code=exc.status_code,
        )

    @app.exception_handler(RequestValidationError)
    async def validation_error_handler(
        request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        return JSONResponse(
            content=error_body(
                request,
                "validation_error",
                "The request is invalid.",
                safe_validation_details(exc),
            ),
            status_code=422,
        )

    @app.exception_handler(Exception)
    async def unexpected_error_handler(request: Request, exc: Exception) -> JSONResponse:
        logger.exception(
            "Unhandled API error",
            extra={"request_id": getattr(request.state, "request_id", None)},
            exc_info=exc,
        )
        return JSONResponse(
            content=error_body(
                request,
                "internal_error",
                "The request could not be completed.",
            ),
            status_code=500,
        )

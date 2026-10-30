from typing import Annotated

from fastapi import Depends, Request
from fastapi.concurrency import run_in_threadpool
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.auth.jwt import SupabaseJwtVerifier, TokenVerificationError
from app.auth.models import AuthenticatedUser
from app.core.errors import ApiError

bearer_scheme = HTTPBearer(auto_error=False)


def get_jwt_verifier(request: Request) -> SupabaseJwtVerifier:
    return request.app.state.jwt_verifier  # type: ignore[no-any-return]


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
    verifier: Annotated[SupabaseJwtVerifier, Depends(get_jwt_verifier)],
) -> AuthenticatedUser:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise ApiError(
            401,
            "authentication_required",
            "A valid bearer token is required.",
            {"WWW-Authenticate": "Bearer"},
        )
    try:
        return await run_in_threadpool(verifier.verify, credentials.credentials)
    except TokenVerificationError as exc:
        raise ApiError(
            401,
            "invalid_access_token",
            "The access token is invalid or expired.",
            {"WWW-Authenticate": "Bearer"},
        ) from exc


CurrentUser = Annotated[AuthenticatedUser, Depends(get_current_user)]

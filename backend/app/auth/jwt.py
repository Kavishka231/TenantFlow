from collections.abc import Mapping
from typing import Any, Protocol
from uuid import UUID

import jwt
from jwt import InvalidTokenError, PyJWKClient, PyJWKClientError

from app.auth.models import AuthenticatedUser
from app.core.config import Settings

ALLOWED_ALGORITHMS = frozenset({"ES256", "RS256"})


class SigningKey(Protocol):
    @property
    def key(self) -> Any: ...


class SigningKeyProvider(Protocol):
    def get_signing_key_from_jwt(self, token: str) -> SigningKey: ...


class TokenVerificationError(ValueError):
    """Raised when a bearer token is not a valid Supabase access token."""


class SupabaseJwtVerifier:
    def __init__(
        self,
        settings: Settings,
        signing_keys: SigningKeyProvider | None = None,
    ) -> None:
        self._audience = settings.supabase_jwt_audience
        self._issuer = settings.supabase_issuer
        self._signing_keys = signing_keys or PyJWKClient(
            settings.supabase_jwks_url,
            cache_keys=True,
            max_cached_keys=16,
            cache_jwk_set=True,
            lifespan=300,
            timeout=5,
        )

    def verify(self, token: str) -> AuthenticatedUser:
        try:
            header = jwt.get_unverified_header(token)
            algorithm = header.get("alg")
            if algorithm not in ALLOWED_ALGORITHMS:
                raise TokenVerificationError("The token signing algorithm is not allowed.")
            signing_key = self._signing_keys.get_signing_key_from_jwt(token)
            claims: Mapping[str, Any] = jwt.decode(
                token,
                signing_key.key,
                algorithms=[algorithm],
                audience=self._audience,
                issuer=self._issuer,
                leeway=15,
                options={"require": ["aud", "exp", "iat", "iss", "sub"]},
            )
            if claims.get("role") != "authenticated":
                raise TokenVerificationError("The token is not an authenticated user token.")
            user_id = UUID(str(claims["sub"]))
            email = claims.get("email")
            session_id = claims.get("session_id")
            return AuthenticatedUser(
                id=user_id,
                email=email if isinstance(email, str) else None,
                role="authenticated",
                session_id=session_id if isinstance(session_id, str) else None,
            )
        except TokenVerificationError:
            raise
        except (InvalidTokenError, PyJWKClientError, KeyError, TypeError, ValueError) as exc:
            raise TokenVerificationError("The access token is invalid or expired.") from exc

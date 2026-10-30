from fastapi import APIRouter

from app.auth.dependencies import CurrentUser
from app.auth.models import AuthenticatedUser

router = APIRouter(prefix="/auth", tags=["authentication"])


@router.get("/me", response_model=AuthenticatedUser)
async def current_user(user: CurrentUser) -> AuthenticatedUser:
    return user

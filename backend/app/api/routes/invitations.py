from fastapi import APIRouter, status

from app.core.errors import ApiError
from app.db.dependencies import RlsSession
from app.team.models import AcceptedInvitationResponse, AcceptInvitationRequest
from app.team.service import InvalidInvitationError, accept_invitation

router = APIRouter(prefix="/invitations", tags=["invitations"])


@router.post("/accept", response_model=AcceptedInvitationResponse)
async def invitation_accept(
    request: AcceptInvitationRequest, session: RlsSession
) -> AcceptedInvitationResponse:
    try:
        return await accept_invitation(session, request.token)
    except InvalidInvitationError as error:
        raise ApiError(
            status.HTTP_400_BAD_REQUEST,
            "invalid_invitation",
            "This invitation is invalid, expired, used, or belongs to another account.",
        ) from error

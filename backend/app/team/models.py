from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, StringConstraints, field_validator

from app.organizations.models import OrganizationRole


class TeamMember(BaseModel):
    user_id: UUID
    full_name: str | None
    role: OrganizationRole
    joined_at: datetime


class TeamResponse(BaseModel):
    members: list[TeamMember]
    invitations: list["PendingInvitation"] = []


class ChangeMemberRoleRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    role: Annotated[str, StringConstraints(pattern=r"^(admin|member)$")]


class MembershipMutationResponse(BaseModel):
    changed: bool


class PendingInvitation(BaseModel):
    id: UUID
    email: str
    role: Literal["admin", "member"]
    expires_at: datetime
    created_at: datetime


class CreateInvitationRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    email: Annotated[str, StringConstraints(strip_whitespace=True, max_length=320)]
    role: Literal["admin", "member"]

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        normalized = value.lower()
        if normalized.count("@") != 1 or any(char.isspace() for char in normalized):
            raise ValueError("Enter a valid email address.")
        local, domain = normalized.split("@")
        if not local or "." not in domain or domain.startswith(".") or domain.endswith("."):
            raise ValueError("Enter a valid email address.")
        return normalized


class InvitationDeliveryStatus(BaseModel):
    channel: Literal["webhook", "development-outbox", "unconfigured", "delivery-error"]
    delivered: bool


class InvitationCreatedResponse(BaseModel):
    id: UUID
    expires_at: datetime
    delivery: InvitationDeliveryStatus


class AcceptInvitationRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    token: Annotated[
        str,
        StringConstraints(min_length=40, max_length=200, pattern=r"^[A-Za-z0-9_-]+$"),
    ]


class AcceptedInvitationResponse(BaseModel):
    organization_id: UUID
    organization_name: str
    role: Literal["admin", "member"]

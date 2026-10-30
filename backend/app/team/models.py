from datetime import datetime
from typing import Annotated
from uuid import UUID

from pydantic import BaseModel, ConfigDict, StringConstraints

from app.organizations.models import OrganizationRole


class TeamMember(BaseModel):
    user_id: UUID
    full_name: str | None
    role: OrganizationRole
    joined_at: datetime


class TeamResponse(BaseModel):
    members: list[TeamMember]


class ChangeMemberRoleRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    role: Annotated[str, StringConstraints(pattern=r"^(admin|member)$")]


class MembershipMutationResponse(BaseModel):
    changed: bool

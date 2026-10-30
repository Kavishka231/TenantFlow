from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


class AuditEvent(BaseModel):
    id: UUID
    actor_id: UUID
    event_type: str
    metadata: dict[str, Any]
    created_at: datetime


async def list_audit_events(
    session: AsyncSession, organization_id: UUID, limit: int = 50
) -> list[AuditEvent]:
    bounded_limit = min(max(limit, 1), 100)
    result = await session.execute(
        text(
            """
            select id, actor_id, event_type::text as event_type, metadata, created_at
            from public.audit_events
            where organization_id = :organization_id
            order by created_at desc, id desc
            limit :limit
            """
        ),
        {"limit": bounded_limit, "organization_id": str(organization_id)},
    )
    return [AuditEvent.model_validate(dict(row)) for row in result.mappings()]

from datetime import date, datetime
from enum import StrEnum
from typing import Any
from uuid import UUID

from sqlalchemy import JSON, BigInteger, Date, DateTime, Enum, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import UUID as PostgreSQLUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.models import Base


class PipelineStageKind(StrEnum):
    OPEN = "open"
    WON = "won"
    LOST = "lost"


class DealOutcome(StrEnum):
    OPEN = "open"
    WON = "won"
    LOST = "lost"


class DealActivityType(StrEnum):
    CREATED = "created"
    UPDATED = "updated"
    STAGE_CHANGED = "stage_changed"
    WON = "won"
    LOST = "lost"
    NOTE_ADDED = "note_added"


def postgres_enum(enum: type[StrEnum], name: str) -> Enum:
    return Enum(
        enum,
        name=name,
        schema="public",
        values_callable=lambda values: [item.value for item in values],
    )


class PipelineStage(Base):
    """Mapping for the existing Drizzle-managed pipeline_stages table."""

    __tablename__ = "pipeline_stages"
    __table_args__ = {"schema": "public"}  # noqa: RUF012

    id: Mapped[UUID] = mapped_column(
        PostgreSQLUUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid()
    )
    organization_id: Mapped[UUID] = mapped_column(PostgreSQLUUID(as_uuid=True))
    name: Mapped[str] = mapped_column(String(80))
    color: Mapped[str] = mapped_column(String(7))
    position: Mapped[int] = mapped_column(Integer)
    kind: Mapped[PipelineStageKind] = mapped_column(
        postgres_enum(PipelineStageKind, "pipeline_stage_kind")
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Deal(Base):
    """Mapping for the existing Drizzle-managed deals table."""

    __tablename__ = "deals"
    __table_args__ = {"schema": "public"}  # noqa: RUF012

    id: Mapped[UUID] = mapped_column(
        PostgreSQLUUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid()
    )
    organization_id: Mapped[UUID] = mapped_column(PostgreSQLUUID(as_uuid=True))
    customer_id: Mapped[UUID] = mapped_column(PostgreSQLUUID(as_uuid=True))
    stage_id: Mapped[UUID] = mapped_column(PostgreSQLUUID(as_uuid=True))
    assigned_user_id: Mapped[UUID | None] = mapped_column(PostgreSQLUUID(as_uuid=True))
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text)
    value_minor: Mapped[int] = mapped_column(BigInteger)
    currency: Mapped[str] = mapped_column(String(3))
    expected_close_date: Mapped[date | None] = mapped_column(Date)
    outcome: Mapped[DealOutcome] = mapped_column(postgres_enum(DealOutcome, "deal_outcome"))
    outcome_reason: Mapped[str | None] = mapped_column(String(500))
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_by: Mapped[UUID] = mapped_column(PostgreSQLUUID(as_uuid=True))
    updated_by: Mapped[UUID] = mapped_column(PostgreSQLUUID(as_uuid=True))
    version: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class DealActivity(Base):
    """Mapping for the existing append-only deal_activities table."""

    __tablename__ = "deal_activities"
    __table_args__ = {"schema": "public"}  # noqa: RUF012

    id: Mapped[UUID] = mapped_column(
        PostgreSQLUUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid()
    )
    organization_id: Mapped[UUID] = mapped_column(PostgreSQLUUID(as_uuid=True))
    deal_id: Mapped[UUID] = mapped_column(PostgreSQLUUID(as_uuid=True))
    actor_id: Mapped[UUID] = mapped_column(PostgreSQLUUID(as_uuid=True))
    type: Mapped[DealActivityType] = mapped_column(
        postgres_enum(DealActivityType, "deal_activity_type")
    )
    note: Mapped[str | None] = mapped_column(Text)
    metadata_: Mapped[dict[str, Any]] = mapped_column("metadata", JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

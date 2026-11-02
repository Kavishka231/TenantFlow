from datetime import datetime
from enum import StrEnum
from uuid import UUID

from sqlalchemy import DateTime, Enum, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import UUID as PostgreSQLUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.models import Base


class CustomerStatus(StrEnum):
    LEAD = "lead"
    ACTIVE = "active"
    INACTIVE = "inactive"


class Customer(Base):
    """Read/write mapping for the existing Drizzle-managed customers table."""

    __tablename__ = "customers"
    __table_args__ = {"schema": "public"}  # noqa: RUF012

    id: Mapped[UUID] = mapped_column(
        PostgreSQLUUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid()
    )
    organization_id: Mapped[UUID] = mapped_column(
        PostgreSQLUUID(as_uuid=True), nullable=False
    )
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    email: Mapped[str | None] = mapped_column(String(320))
    phone: Mapped[str | None] = mapped_column(String(32))
    company: Mapped[str | None] = mapped_column(String(160))
    address: Mapped[str | None] = mapped_column(Text)
    status: Mapped[CustomerStatus] = mapped_column(
        Enum(
            CustomerStatus,
            name="customer_status",
            schema="public",
            values_callable=lambda enum: [item.value for item in enum],
        ),
        nullable=False,
        server_default="lead",
    )
    notes: Mapped[str | None] = mapped_column(Text)
    created_by: Mapped[UUID] = mapped_column(PostgreSQLUUID(as_uuid=True), nullable=False)
    updated_by: Mapped[UUID] = mapped_column(PostgreSQLUUID(as_uuid=True), nullable=False)
    version: Mapped[int] = mapped_column(Integer, nullable=False, server_default="1")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

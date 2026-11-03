from datetime import date, datetime
from enum import StrEnum
from uuid import UUID

from sqlalchemy import BigInteger, Date, DateTime, Enum, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import UUID as PostgreSQLUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.models import Base


class InvoiceStatus(StrEnum):
    DRAFT = "draft"
    SENT = "sent"
    PARTIALLY_PAID = "partially_paid"
    PAID = "paid"
    OVERDUE = "overdue"
    CANCELLED = "cancelled"


class PaymentMethod(StrEnum):
    CASH = "cash"
    BANK_TRANSFER = "bank_transfer"
    CARD = "card"
    CHECK = "check"
    OTHER = "other"


def postgres_enum(enum: type[StrEnum], name: str) -> Enum:
    return Enum(
        enum,
        name=name,
        schema="public",
        values_callable=lambda values: [item.value for item in values],
    )


class Invoice(Base):
    """Mapping for the existing Drizzle-managed invoices table."""

    __tablename__ = "invoices"
    __table_args__ = {"schema": "public"}  # noqa: RUF012

    id: Mapped[UUID] = mapped_column(
        PostgreSQLUUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid()
    )
    organization_id: Mapped[UUID] = mapped_column(PostgreSQLUUID(as_uuid=True))
    customer_id: Mapped[UUID] = mapped_column(PostgreSQLUUID(as_uuid=True))
    invoice_number: Mapped[str] = mapped_column(String(64))
    number_sequence: Mapped[int] = mapped_column(Integer)
    status: Mapped[InvoiceStatus] = mapped_column(postgres_enum(InvoiceStatus, "invoice_status"))
    currency: Mapped[str] = mapped_column(String(3))
    issue_date: Mapped[date] = mapped_column(Date)
    due_date: Mapped[date] = mapped_column(Date)
    notes: Mapped[str | None] = mapped_column(Text)
    discount_minor: Mapped[int] = mapped_column(BigInteger)
    tax_rate_bps: Mapped[int] = mapped_column(Integer)
    subtotal_minor: Mapped[int] = mapped_column(BigInteger)
    tax_minor: Mapped[int] = mapped_column(BigInteger)
    total_minor: Mapped[int] = mapped_column(BigInteger)
    paid_minor: Mapped[int] = mapped_column(BigInteger)
    created_by: Mapped[UUID] = mapped_column(PostgreSQLUUID(as_uuid=True))
    updated_by: Mapped[UUID] = mapped_column(PostgreSQLUUID(as_uuid=True))
    version: Mapped[int] = mapped_column(Integer)
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class InvoiceItem(Base):
    """Mapping for the existing Drizzle-managed invoice_items table."""

    __tablename__ = "invoice_items"
    __table_args__ = {"schema": "public"}  # noqa: RUF012

    id: Mapped[UUID] = mapped_column(
        PostgreSQLUUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid()
    )
    organization_id: Mapped[UUID] = mapped_column(PostgreSQLUUID(as_uuid=True))
    invoice_id: Mapped[UUID] = mapped_column(PostgreSQLUUID(as_uuid=True))
    description: Mapped[str] = mapped_column(String(500))
    quantity: Mapped[int] = mapped_column(Integer)
    unit_price_minor: Mapped[int] = mapped_column(BigInteger)
    line_total_minor: Mapped[int] = mapped_column(BigInteger)
    position: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class PaymentRecord(Base):
    """Mapping for immutable rows in the existing payment_records table."""

    __tablename__ = "payment_records"
    __table_args__ = {"schema": "public"}  # noqa: RUF012

    id: Mapped[UUID] = mapped_column(
        PostgreSQLUUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid()
    )
    organization_id: Mapped[UUID] = mapped_column(PostgreSQLUUID(as_uuid=True))
    invoice_id: Mapped[UUID] = mapped_column(PostgreSQLUUID(as_uuid=True))
    idempotency_key: Mapped[UUID] = mapped_column(PostgreSQLUUID(as_uuid=True))
    amount_minor: Mapped[int] = mapped_column(BigInteger)
    payment_date: Mapped[date] = mapped_column(Date)
    method: Mapped[PaymentMethod] = mapped_column(postgres_enum(PaymentMethod, "payment_method"))
    reference: Mapped[str | None] = mapped_column(String(160))
    notes: Mapped[str | None] = mapped_column(Text)
    recorded_by: Mapped[UUID] = mapped_column(PostgreSQLUUID(as_uuid=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

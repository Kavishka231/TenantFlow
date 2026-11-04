from datetime import date, datetime
from enum import StrEnum
from uuid import UUID

from sqlalchemy import BigInteger, Date, DateTime, Enum, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import UUID as PostgreSQLUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.models import Base


class ExpenseStatus(StrEnum):
    PENDING = "pending"
    PAID = "paid"
    REIMBURSED = "reimbursed"
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


class ExpenseCategory(Base):
    """Mapping for the existing Drizzle-managed expense_categories table."""

    __tablename__ = "expense_categories"
    __table_args__ = {"schema": "public"}  # noqa: RUF012

    id: Mapped[UUID] = mapped_column(
        PostgreSQLUUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid()
    )
    organization_id: Mapped[UUID] = mapped_column(PostgreSQLUUID(as_uuid=True))
    name: Mapped[str] = mapped_column(String(80))
    color: Mapped[str] = mapped_column(String(7))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Expense(Base):
    """Mapping for the existing Drizzle-managed expenses table."""

    __tablename__ = "expenses"
    __table_args__ = {"schema": "public"}  # noqa: RUF012

    id: Mapped[UUID] = mapped_column(
        PostgreSQLUUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid()
    )
    organization_id: Mapped[UUID] = mapped_column(PostgreSQLUUID(as_uuid=True))
    category_id: Mapped[UUID] = mapped_column(PostgreSQLUUID(as_uuid=True))
    amount_minor: Mapped[int] = mapped_column(BigInteger)
    currency: Mapped[str] = mapped_column(String(3))
    expense_date: Mapped[date] = mapped_column(Date)
    vendor: Mapped[str] = mapped_column(String(160))
    payment_method: Mapped[PaymentMethod] = mapped_column(
        postgres_enum(PaymentMethod, "payment_method")
    )
    status: Mapped[ExpenseStatus] = mapped_column(postgres_enum(ExpenseStatus, "expense_status"))
    paid_date: Mapped[date | None] = mapped_column(Date)
    description: Mapped[str | None] = mapped_column(Text)
    receipt_path: Mapped[str | None] = mapped_column(Text)
    receipt_name: Mapped[str | None] = mapped_column(String(255))
    receipt_mime_type: Mapped[str | None] = mapped_column(String(100))
    receipt_size: Mapped[int | None] = mapped_column(Integer)
    created_by: Mapped[UUID] = mapped_column(PostgreSQLUUID(as_uuid=True))
    updated_by: Mapped[UUID] = mapped_column(PostgreSQLUUID(as_uuid=True))
    version: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

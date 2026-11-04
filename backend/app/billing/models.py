from datetime import datetime
from enum import StrEnum
from typing import Any
from uuid import UUID

from sqlalchemy import JSON, BigInteger, Boolean, DateTime, Enum, Integer, String, func
from sqlalchemy.dialects.postgresql import UUID as PostgreSQLUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.models import Base


class SubscriptionStatus(StrEnum):
    INCOMPLETE = "incomplete"
    INCOMPLETE_EXPIRED = "incomplete_expired"
    TRIALING = "trialing"
    ACTIVE = "active"
    PAST_DUE = "past_due"
    CANCELED = "canceled"
    UNPAID = "unpaid"
    PAUSED = "paused"


subscription_status_enum = Enum(
    SubscriptionStatus,
    name="subscription_status",
    schema="public",
    values_callable=lambda values: [item.value for item in values],
)


class SubscriptionPlan(Base):
    __tablename__ = "subscription_plans"
    __table_args__ = {"schema": "public"}  # noqa: RUF012
    id: Mapped[UUID] = mapped_column(PostgreSQLUUID(as_uuid=True), primary_key=True)
    key: Mapped[str] = mapped_column(String(32))
    name: Mapped[str] = mapped_column(String(80))
    description: Mapped[str] = mapped_column(String(500))
    monthly_price_minor: Mapped[int] = mapped_column(BigInteger)
    currency: Mapped[str] = mapped_column(String(3))
    features: Mapped[list[str]] = mapped_column(JSON)
    limits: Mapped[dict[str, Any]] = mapped_column(JSON)
    active: Mapped[bool] = mapped_column(Boolean)
    sort_order: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class StripeCustomer(Base):
    __tablename__ = "stripe_customers"
    __table_args__ = {"schema": "public"}  # noqa: RUF012
    organization_id: Mapped[UUID] = mapped_column(PostgreSQLUUID(as_uuid=True), primary_key=True)
    stripe_customer_id: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class OrganizationSubscription(Base):
    __tablename__ = "organization_subscriptions"
    __table_args__ = {"schema": "public"}  # noqa: RUF012
    organization_id: Mapped[UUID] = mapped_column(PostgreSQLUUID(as_uuid=True), primary_key=True)
    plan_id: Mapped[UUID] = mapped_column(PostgreSQLUUID(as_uuid=True))
    stripe_customer_id: Mapped[str] = mapped_column(String(255))
    stripe_subscription_id: Mapped[str] = mapped_column(String(255))
    stripe_price_id: Mapped[str] = mapped_column(String(255))
    status: Mapped[SubscriptionStatus] = mapped_column(subscription_status_enum)
    cancel_at_period_end: Mapped[bool] = mapped_column(Boolean)
    current_period_start: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    current_period_end: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    stripe_event_created_at: Mapped[int] = mapped_column(BigInteger)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class StripeWebhookEvent(Base):
    __tablename__ = "stripe_webhook_events"
    __table_args__ = {"schema": "public"}  # noqa: RUF012
    stripe_event_id: Mapped[str] = mapped_column(String(255), primary_key=True)
    event_type: Mapped[str] = mapped_column(String(120))
    organization_id: Mapped[UUID | None] = mapped_column(PostgreSQLUUID(as_uuid=True))
    payload_sha256: Mapped[str] = mapped_column(String(64))
    stripe_created_at: Mapped[int] = mapped_column(BigInteger)
    processed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

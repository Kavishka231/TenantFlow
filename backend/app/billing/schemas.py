from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.billing.models import SubscriptionStatus


class PlanResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    key: str
    name: str
    description: str
    monthly_price_minor: int
    currency: str
    features: list[str]
    limits: dict[str, Any]
    sort_order: int


class SubscriptionResponse(BaseModel):
    status: SubscriptionStatus
    cancel_at_period_end: bool
    current_period_end: datetime | None
    plan_key: str
    plan_name: str


class BillingResponse(BaseModel):
    customer_id: str | None
    subscription: SubscriptionResponse | None
    stripe_configured: bool = False


class CheckoutRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    plan_key: Literal["starter", "growth"]


class BillingUrlResponse(BaseModel):
    url: str


class WebhookResponse(BaseModel):
    received: bool = True
    processed: bool


class CurrencyMetric(BaseModel):
    currency: str
    amount_minor: int


class DashboardMetrics(BaseModel):
    total_customers: int
    total_invoices: int
    overdue_invoices: int
    paid_amounts: list[CurrencyMetric]
    outstanding_balances: list[CurrencyMetric]


class FinancialPoint(BaseModel):
    month: str
    invoiced_minor: int
    paid_minor: int


class FinancialSeries(BaseModel):
    currency: str
    points: list[FinancialPoint]


class CustomerGrowthPoint(BaseModel):
    month: str
    new_customers: int
    total_customers: int


class InvoiceStatusMetric(BaseModel):
    status: str
    count: int


class RecentActivity(BaseModel):
    id: UUID
    type: Literal["customer_created", "invoice_created", "payment_recorded"]
    title: str
    description: str
    occurred_at: datetime


class DashboardInsights(BaseModel):
    customer_growth: list[CustomerGrowthPoint]
    invoice_statuses: list[InvoiceStatusMetric]
    recent_activity: list[RecentActivity]


class DashboardAnalyticsResponse(BaseModel):
    metrics: DashboardMetrics
    financial: list[FinancialSeries]
    insights: DashboardInsights

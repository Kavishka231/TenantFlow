from datetime import date, datetime
from enum import StrEnum
from typing import Annotated
from uuid import UUID

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    StringConstraints,
    field_validator,
    model_validator,
)

from app.invoices.models import InvoiceStatus, PaymentMethod

MAX_SAFE_MINOR = 9_007_199_254_740_991
Description = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=500)]


class InvoiceItemRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    description: Description
    quantity: Annotated[int, Field(ge=1, le=1_000_000)]
    unit_price_minor: Annotated[int, Field(ge=0, le=1_000_000_000)]


class InvoiceFields(BaseModel):
    model_config = ConfigDict(extra="forbid")
    customer_id: UUID
    currency: Annotated[
        str, StringConstraints(strip_whitespace=True, pattern=r"^[A-Z]{3}$")
    ]
    issue_date: date
    due_date: date
    notes: str | None = Field(default=None, max_length=5000)
    discount_minor: Annotated[int, Field(ge=0, le=MAX_SAFE_MINOR)] = 0
    tax_rate_bps: Annotated[int, Field(ge=0, le=10_000)] = 0
    items: Annotated[list[InvoiceItemRequest], Field(min_length=1, max_length=100)]

    @field_validator("notes", mode="before")
    @classmethod
    def normalize_notes(cls, value: object) -> object:
        if isinstance(value, str):
            return value.strip() or None
        return value

    @field_validator("currency", mode="before")
    @classmethod
    def normalize_currency(cls, value: object) -> object:
        return value.strip().upper() if isinstance(value, str) else value

    @model_validator(mode="after")
    def validate_dates_and_totals(self) -> "InvoiceFields":
        if self.due_date < self.issue_date:
            raise ValueError("The due date cannot precede the issue date.")
        calculate_totals(self.items, self.discount_minor, self.tax_rate_bps)
        return self


class CreateInvoiceRequest(InvoiceFields):
    pass


class UpdateInvoiceRequest(InvoiceFields):
    version: Annotated[int, Field(gt=0)]


class VersionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    version: Annotated[int, Field(gt=0)]


class RecordPaymentRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    idempotency_key: UUID
    amount_minor: Annotated[int, Field(gt=0, le=MAX_SAFE_MINOR)]
    payment_date: date
    method: PaymentMethod
    reference: str | None = Field(default=None, min_length=1, max_length=160)
    notes: str | None = Field(default=None, max_length=2000)

    @field_validator("reference", "notes", mode="before")
    @classmethod
    def normalize_optional_text(cls, value: object) -> object:
        if isinstance(value, str):
            return value.strip() or None
        return value

    @field_validator("payment_date")
    @classmethod
    def reject_future_payment(cls, value: date) -> date:
        if value > date.today():
            raise ValueError("The payment date cannot be in the future.")
        return value


class InvoiceItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    organization_id: UUID
    invoice_id: UUID
    description: str
    quantity: int
    unit_price_minor: int
    line_total_minor: int
    position: int
    created_at: datetime


class PaymentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    organization_id: UUID
    invoice_id: UUID
    idempotency_key: UUID
    amount_minor: int
    payment_date: date
    method: PaymentMethod
    reference: str | None
    notes: str | None
    recorded_by: UUID
    created_at: datetime


class InvoiceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    organization_id: UUID
    customer_id: UUID
    invoice_number: str
    number_sequence: int
    status: InvoiceStatus
    currency: str
    issue_date: date
    due_date: date
    notes: str | None
    discount_minor: int
    tax_rate_bps: int
    subtotal_minor: int
    tax_minor: int
    total_minor: int
    paid_minor: int
    version: int
    sent_at: datetime | None
    cancelled_at: datetime | None
    created_at: datetime
    updated_at: datetime


class InvoiceDetailResponse(InvoiceResponse):
    customer_name: str
    customer_company: str | None
    customer_email: str | None
    items: list[InvoiceItemResponse]
    payments: list[PaymentResponse]


class InvoiceListItem(BaseModel):
    id: UUID
    invoice_number: str
    customer_name: str
    status: InvoiceStatus
    currency: str
    issue_date: date
    due_date: date
    total_minor: int
    paid_minor: int


class InvoiceSort(StrEnum):
    NEWEST = "newest"
    OLDEST = "oldest"
    DUE_SOON = "due_soon"
    AMOUNT_HIGH = "amount_high"


class InvoiceListResponse(BaseModel):
    invoices: list[InvoiceListItem]
    page: int
    page_count: int
    page_size: int
    total: int


class InvoiceCustomerOption(BaseModel):
    id: UUID
    name: str
    company: str | None


def calculate_totals(
    items: list[InvoiceItemRequest], discount_minor: int, tax_rate_bps: int
) -> tuple[int, int, int]:
    subtotal = sum(item.quantity * item.unit_price_minor for item in items)
    if discount_minor > subtotal:
        raise ValueError("The discount cannot exceed the invoice subtotal.")
    taxable = subtotal - discount_minor
    tax = (taxable * tax_rate_bps + 5_000) // 10_000
    total = taxable + tax
    if subtotal > MAX_SAFE_MINOR or total > MAX_SAFE_MINOR:
        raise ValueError("The invoice total exceeds the supported amount.")
    return subtotal, tax, total

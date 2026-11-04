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

from app.expenses.models import ExpenseStatus, PaymentMethod

Currency = Annotated[str, StringConstraints(strip_whitespace=True, pattern=r"^[A-Z]{3}$")]


class ExpenseFields(BaseModel):
    model_config = ConfigDict(extra="forbid")

    category_id: UUID
    amount_minor: Annotated[int, Field(ge=1, le=1_000_000_000_000)]
    currency: Currency
    expense_date: date
    vendor: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=160)]
    payment_method: PaymentMethod
    status: ExpenseStatus = ExpenseStatus.PENDING
    paid_date: date | None = None
    description: str | None = Field(default=None, max_length=5000)

    @field_validator("currency", mode="before")
    @classmethod
    def normalize_currency(cls, value: object) -> object:
        return value.strip().upper() if isinstance(value, str) else value

    @field_validator("description", mode="before")
    @classmethod
    def normalize_description(cls, value: object) -> object:
        return value.strip() or None if isinstance(value, str) else value

    @model_validator(mode="after")
    def validate_payment_date(self) -> "ExpenseFields":
        needs_date = self.status in {ExpenseStatus.PAID, ExpenseStatus.REIMBURSED}
        if needs_date != (self.paid_date is not None):
            raise ValueError("Payment date does not match the selected status.")
        return self


class CreateExpenseRequest(ExpenseFields):
    pass


class UpdateExpenseRequest(ExpenseFields):
    version: Annotated[int, Field(gt=0)]


class VersionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    version: Annotated[int, Field(gt=0)]


class TransitionExpenseRequest(VersionRequest):
    status: ExpenseStatus
    paid_date: date | None = None

    @model_validator(mode="after")
    def validate_payment_date(self) -> "TransitionExpenseRequest":
        needs_date = self.status in {ExpenseStatus.PAID, ExpenseStatus.REIMBURSED}
        if needs_date != (self.paid_date is not None):
            raise ValueError("Payment date does not match the selected status.")
        return self


class CategoryFields(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=80)]
    color: Annotated[str, StringConstraints(pattern=r"^#[0-9A-Fa-f]{6}$")]


class ExpenseCategoryResponse(CategoryFields):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    organization_id: UUID
    created_at: datetime
    updated_at: datetime


class ExpenseResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    organization_id: UUID
    category_id: UUID
    amount_minor: int
    currency: str
    expense_date: date
    vendor: str
    payment_method: PaymentMethod
    status: ExpenseStatus
    paid_date: date | None
    description: str | None
    receipt_name: str | None
    receipt_mime_type: str | None
    receipt_size: int | None
    version: int
    created_at: datetime
    updated_at: datetime


class ExpenseDetailResponse(ExpenseResponse):
    category_name: str
    category_color: str


class ExpenseListItem(BaseModel):
    id: UUID
    amount_minor: int
    currency: str
    expense_date: date
    vendor: str
    payment_method: PaymentMethod
    status: ExpenseStatus
    receipt_name: str | None
    category_name: str
    category_color: str


class ExpenseSort(StrEnum):
    NEWEST = "newest"
    OLDEST = "oldest"
    AMOUNT_DESC = "amount_desc"
    AMOUNT_ASC = "amount_asc"
    VENDOR_ASC = "vendor_asc"
    VENDOR_DESC = "vendor_desc"


class ExpenseListResponse(BaseModel):
    expenses: list[ExpenseListItem]
    page: int
    page_count: int
    page_size: int
    total: int


class ExpenseTotal(BaseModel):
    currency: str
    amount_minor: int
    paid_minor: int


class MonthlyPoint(BaseModel):
    month: str
    amount_minor: int


class MonthlyExpenseSeries(BaseModel):
    currency: str
    points: list[MonthlyPoint]


class CategoryExpenseTotal(BaseModel):
    category_id: UUID
    category_name: str
    color: str
    currency: str
    amount_minor: int


class ExpenseMetricsResponse(BaseModel):
    totals: list[ExpenseTotal]
    monthly: list[MonthlyExpenseSeries]
    categories: list[CategoryExpenseTotal]


class ReceiptResponse(BaseModel):
    name: str
    mime_type: str
    size: int
    version: int


class SignedReceiptResponse(BaseModel):
    signed_url: str
    expires_in: int

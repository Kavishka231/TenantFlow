from datetime import datetime
from enum import StrEnum
from typing import Annotated
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, field_validator

from app.customers.models import CustomerStatus

CustomerName = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=160)
]


class CustomerFields(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: CustomerName
    email: str | None = Field(default=None, max_length=320)
    phone: str | None = Field(default=None, min_length=3, max_length=32)
    company: str | None = Field(default=None, max_length=160)
    address: str | None = Field(default=None, max_length=1000)
    status: CustomerStatus = CustomerStatus.LEAD
    notes: str | None = Field(default=None, max_length=5000)

    @field_validator("email", "phone", "company", "address", "notes", mode="before")
    @classmethod
    def normalize_optional_text(cls, value: object) -> object:
        if isinstance(value, str):
            stripped = value.strip()
            return stripped or None
        return value

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.lower()
        if normalized.count("@") != 1 or any(char.isspace() for char in normalized):
            raise ValueError("Enter a valid email address.")
        local, domain = normalized.split("@")
        if not local or "." not in domain or domain.startswith(".") or domain.endswith("."):
            raise ValueError("Enter a valid email address.")
        return normalized

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, value: str | None) -> str | None:
        if value is not None and any(
            not (character.isdigit() or character in "+() .-") for character in value
        ):
            raise ValueError("The phone number contains unsupported characters.")
        return value


class CreateCustomerRequest(CustomerFields):
    pass


class UpdateCustomerRequest(CustomerFields):
    version: Annotated[int, Field(gt=0)]


class CustomerResponse(CustomerFields):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    organization_id: UUID
    version: int
    created_at: datetime
    updated_at: datetime


class CustomerListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    email: str | None
    phone: str | None
    company: str | None
    status: CustomerStatus
    created_at: datetime
    updated_at: datetime


class CustomerSort(StrEnum):
    NAME_ASC = "name_asc"
    NAME_DESC = "name_desc"
    NEWEST = "newest"
    OLDEST = "oldest"
    RECENTLY_UPDATED = "recently_updated"


class CustomerListResponse(BaseModel):
    customers: list[CustomerListItem]
    page: int
    page_count: int
    page_size: int
    total: int


class DeleteCustomerRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    version: Annotated[int, Field(gt=0)]

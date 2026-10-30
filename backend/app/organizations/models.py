from enum import StrEnum
from typing import Annotated
from uuid import UUID

from pydantic import BaseModel, ConfigDict, StringConstraints

OrganizationName = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=2, max_length=120)
]
OrganizationSlug = Annotated[
    str,
    StringConstraints(
        strip_whitespace=True,
        to_lower=True,
        min_length=2,
        max_length=63,
        pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$",
    ),
]


class OrganizationRole(StrEnum):
    OWNER = "owner"
    ADMIN = "admin"
    MEMBER = "member"


class OrganizationPermission(StrEnum):
    READ_WORKSPACE = "read_workspace"
    UPDATE_ORGANIZATION = "update_organization"
    MANAGE_MEMBERS = "manage_members"
    MANAGE_OWNERSHIP = "manage_ownership"
    DELETE_ORGANIZATION = "delete_organization"
    READ_CUSTOMERS = "read_customers"
    MANAGE_CUSTOMERS = "manage_customers"
    READ_INVOICES = "read_invoices"
    MANAGE_INVOICES = "manage_invoices"
    READ_ANALYTICS = "read_analytics"
    READ_DEALS = "read_deals"
    MANAGE_DEALS = "manage_deals"
    READ_EXPENSES = "read_expenses"
    MANAGE_EXPENSES = "manage_expenses"
    READ_BILLING = "read_billing"
    MANAGE_BILLING = "manage_billing"


class OrganizationSummary(BaseModel):
    id: UUID
    name: str
    slug: str
    role: OrganizationRole


class CreateOrganizationRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: OrganizationName
    slug: OrganizationSlug


class UpdateOrganizationRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: OrganizationName

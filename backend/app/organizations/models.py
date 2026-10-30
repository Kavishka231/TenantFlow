from enum import StrEnum
from uuid import UUID

from pydantic import BaseModel


class OrganizationRole(StrEnum):
    OWNER = "owner"
    ADMIN = "admin"
    MEMBER = "member"


class OrganizationPermission(StrEnum):
    READ_WORKSPACE = "read_workspace"
    UPDATE_ORGANIZATION = "update_organization"
    MANAGE_MEMBERS = "manage_members"
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

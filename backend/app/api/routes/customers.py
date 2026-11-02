from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, status

from app.auth.dependencies import CurrentUser
from app.core.errors import ApiError
from app.customers.schemas import (
    CreateCustomerRequest,
    CustomerResponse,
    DeleteCustomerRequest,
    UpdateCustomerRequest,
)
from app.customers.service import (
    CustomerConflictError,
    CustomerPlanLimitError,
    create_customer,
    delete_customer,
    get_customer,
    update_customer,
)
from app.db.dependencies import RlsSession
from app.organizations.authorization import require_organization_permission
from app.organizations.models import OrganizationPermission, OrganizationSummary

router = APIRouter(
    prefix="/organizations/{organization_id}/customers", tags=["customers"]
)
ReadCustomers = Annotated[
    OrganizationSummary,
    Depends(require_organization_permission(OrganizationPermission.READ_CUSTOMERS)),
]
ManageCustomers = Annotated[
    OrganizationSummary,
    Depends(require_organization_permission(OrganizationPermission.MANAGE_CUSTOMERS)),
]


def conflict_error() -> ApiError:
    return ApiError(
        status.HTTP_409_CONFLICT,
        "customer_version_conflict",
        "This customer changed since it was loaded.",
    )


@router.post("", response_model=CustomerResponse, status_code=status.HTTP_201_CREATED)
async def customer_create(
    organization_id: UUID,
    request: CreateCustomerRequest,
    organization: ManageCustomers,
    user: CurrentUser,
    session: RlsSession,
) -> CustomerResponse:
    del organization
    try:
        customer = await create_customer(session, organization_id, user.id, request)
    except CustomerPlanLimitError as error:
        raise ApiError(
            status.HTTP_409_CONFLICT,
            "customer_plan_limit",
            "This workspace has reached its customer plan limit.",
        ) from error
    return CustomerResponse.model_validate(customer)


@router.get("/{customer_id}", response_model=CustomerResponse)
async def customer_detail(
    organization_id: UUID,
    customer_id: UUID,
    organization: ReadCustomers,
    session: RlsSession,
) -> CustomerResponse:
    del organization
    customer = await get_customer(session, organization_id, customer_id)
    if customer is None:
        raise ApiError(404, "customer_not_found", "The customer was not found.")
    return CustomerResponse.model_validate(customer)


@router.patch("/{customer_id}", response_model=CustomerResponse)
async def customer_update(
    organization_id: UUID,
    customer_id: UUID,
    request: UpdateCustomerRequest,
    organization: ManageCustomers,
    user: CurrentUser,
    session: RlsSession,
) -> CustomerResponse:
    del organization
    try:
        customer = await update_customer(
            session, organization_id, customer_id, user.id, request
        )
    except CustomerConflictError as error:
        raise conflict_error() from error
    return CustomerResponse.model_validate(customer)


@router.delete("/{customer_id}", status_code=status.HTTP_204_NO_CONTENT)
async def customer_delete(
    organization_id: UUID,
    customer_id: UUID,
    request: DeleteCustomerRequest,
    organization: ManageCustomers,
    session: RlsSession,
) -> None:
    del organization
    try:
        await delete_customer(session, organization_id, customer_id, request.version)
    except CustomerConflictError as error:
        raise conflict_error() from error

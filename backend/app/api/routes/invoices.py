from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy import select

from app.auth.dependencies import CurrentUser
from app.core.errors import ApiError
from app.customers.models import Customer
from app.db.dependencies import RlsSession
from app.invoices.models import InvoiceStatus
from app.invoices.pdf import build_invoice_pdf
from app.invoices.schemas import (
    CreateInvoiceRequest,
    InvoiceCustomerOption,
    InvoiceDetailResponse,
    InvoiceListResponse,
    InvoiceResponse,
    InvoiceSort,
    PaymentResponse,
    RecordPaymentRequest,
    UpdateInvoiceRequest,
    VersionRequest,
)
from app.invoices.service import (
    InvoiceConflictError,
    InvoiceNotFoundError,
    InvoicePlanLimitError,
    PaymentConflictError,
    create_invoice,
    delete_invoice,
    get_invoice,
    list_invoices,
    record_payment,
    transition_invoice,
    update_invoice,
)
from app.organizations.authorization import require_organization_permission
from app.organizations.models import OrganizationPermission, OrganizationSummary

router = APIRouter(prefix="/organizations/{organization_id}/invoices", tags=["invoices"])
ReadInvoices = Annotated[
    OrganizationSummary,
    Depends(require_organization_permission(OrganizationPermission.READ_INVOICES)),
]
ManageInvoices = Annotated[
    OrganizationSummary,
    Depends(require_organization_permission(OrganizationPermission.MANAGE_INVOICES)),
]


def invoice_conflict(error: InvoiceConflictError) -> ApiError:
    return ApiError(status.HTTP_409_CONFLICT, "invoice_conflict", str(error))


@router.get("", response_model=InvoiceListResponse)
async def invoice_list(
    organization_id: UUID,
    organization: ReadInvoices,
    session: RlsSession,
    q: Annotated[str, Query(max_length=100)] = "",
    invoice_status: Annotated[InvoiceStatus | None, Query(alias="status")] = None,
    sort: InvoiceSort = InvoiceSort.NEWEST,
    page: Annotated[int, Query(gt=0)] = 1,
    page_size: Literal[10, 25, 50] = 10,
) -> InvoiceListResponse:
    del organization
    return await list_invoices(
        session,
        organization_id,
        page=page,
        page_size=page_size,
        query=q.strip(),
        sort=sort,
        status=invoice_status,
    )


@router.get("/customer-options", response_model=list[InvoiceCustomerOption])
async def invoice_customer_options(
    organization_id: UUID, organization: ReadInvoices, session: RlsSession
) -> list[InvoiceCustomerOption]:
    del organization
    rows = (
        await session.execute(
            select(Customer.id, Customer.name, Customer.company)
            .where(Customer.organization_id == organization_id)
            .order_by(Customer.name, Customer.id)
            .limit(500)
        )
    ).all()
    return [InvoiceCustomerOption(id=row.id, name=row.name, company=row.company) for row in rows]


@router.post("", response_model=InvoiceResponse, status_code=status.HTTP_201_CREATED)
async def invoice_create(
    organization_id: UUID,
    request: CreateInvoiceRequest,
    organization: ManageInvoices,
    user: CurrentUser,
    session: RlsSession,
) -> InvoiceResponse:
    del organization
    try:
        invoice = await create_invoice(session, organization_id, user.id, request)
    except InvoicePlanLimitError as error:
        raise ApiError(
            409, "invoice_plan_limit", "This workspace has reached its invoice plan limit."
        ) from error
    except InvoiceConflictError as error:
        raise invoice_conflict(error) from error
    return InvoiceResponse.model_validate(invoice)


@router.get("/{invoice_id}", response_model=InvoiceDetailResponse)
async def invoice_detail(
    organization_id: UUID, invoice_id: UUID, organization: ReadInvoices, session: RlsSession
) -> InvoiceDetailResponse:
    del organization
    invoice = await get_invoice(session, organization_id, invoice_id)
    if invoice is None:
        raise ApiError(404, "invoice_not_found", "The invoice was not found.")
    return invoice


@router.patch("/{invoice_id}", response_model=InvoiceResponse)
async def invoice_update(
    organization_id: UUID,
    invoice_id: UUID,
    request: UpdateInvoiceRequest,
    organization: ManageInvoices,
    user: CurrentUser,
    session: RlsSession,
) -> InvoiceResponse:
    del organization
    try:
        invoice = await update_invoice(session, organization_id, invoice_id, user.id, request)
    except InvoiceConflictError as error:
        raise invoice_conflict(error) from error
    return InvoiceResponse.model_validate(invoice)


@router.delete("/{invoice_id}", status_code=status.HTTP_204_NO_CONTENT)
async def invoice_delete(
    organization_id: UUID,
    invoice_id: UUID,
    request: VersionRequest,
    organization: ManageInvoices,
    session: RlsSession,
) -> None:
    del organization
    try:
        await delete_invoice(session, organization_id, invoice_id, request.version)
    except InvoiceConflictError as error:
        raise invoice_conflict(error) from error


async def lifecycle_response(
    organization_id: UUID,
    invoice_id: UUID,
    version: int,
    transition: str,
    session: RlsSession,
) -> InvoiceResponse:
    try:
        invoice = await transition_invoice(
            session, organization_id, invoice_id, version, transition
        )
    except InvoiceNotFoundError as error:
        raise ApiError(404, "invoice_not_found", "The invoice was not found.") from error
    except InvoiceConflictError as error:
        raise invoice_conflict(error) from error
    return InvoiceResponse.model_validate(invoice)


@router.post("/{invoice_id}/send", response_model=InvoiceResponse)
async def invoice_send(
    organization_id: UUID,
    invoice_id: UUID,
    request: VersionRequest,
    organization: ManageInvoices,
    session: RlsSession,
) -> InvoiceResponse:
    del organization
    return await lifecycle_response(organization_id, invoice_id, request.version, "send", session)


@router.post("/{invoice_id}/cancel", response_model=InvoiceResponse)
async def invoice_cancel(
    organization_id: UUID,
    invoice_id: UUID,
    request: VersionRequest,
    organization: ManageInvoices,
    session: RlsSession,
) -> InvoiceResponse:
    del organization
    return await lifecycle_response(organization_id, invoice_id, request.version, "cancel", session)


@router.post("/{invoice_id}/payments", response_model=PaymentResponse, status_code=201)
async def invoice_payment(
    organization_id: UUID,
    invoice_id: UUID,
    request: RecordPaymentRequest,
    organization: ManageInvoices,
    session: RlsSession,
) -> PaymentResponse:
    del organization
    try:
        return await record_payment(session, organization_id, invoice_id, request)
    except PaymentConflictError as error:
        raise ApiError(409, "payment_conflict", str(error)) from error


@router.get("/{invoice_id}/pdf")
async def invoice_pdf(
    organization_id: UUID,
    invoice_id: UUID,
    organization: ReadInvoices,
    session: RlsSession,
) -> Response:
    invoice = await get_invoice(session, organization_id, invoice_id)
    if invoice is None:
        raise ApiError(404, "invoice_not_found", "The invoice was not found.")
    return Response(
        build_invoice_pdf(invoice, organization.name),
        media_type="application/pdf",
        headers={
            "Cache-Control": "private, no-store",
            "Content-Disposition": f'attachment; filename="{invoice.invoice_number}.pdf"',
            "X-Content-Type-Options": "nosniff",
        },
    )

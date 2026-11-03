from datetime import UTC, date, datetime
from uuid import UUID

from sqlalchemy import and_, asc, delete, desc, func, or_, select, text
from sqlalchemy.exc import DBAPIError
from sqlalchemy.ext.asyncio import AsyncSession

from app.customers.models import Customer
from app.invoices.models import Invoice, InvoiceItem, InvoiceStatus, PaymentRecord
from app.invoices.schemas import (
    CreateInvoiceRequest,
    InvoiceDetailResponse,
    InvoiceItemResponse,
    InvoiceListItem,
    InvoiceListResponse,
    InvoiceSort,
    PaymentResponse,
    RecordPaymentRequest,
    UpdateInvoiceRequest,
    calculate_totals,
)


class InvoiceConflictError(Exception):
    pass


class InvoiceNotFoundError(Exception):
    pass


class InvoicePlanLimitError(Exception):
    pass


class PaymentConflictError(Exception):
    pass


async def require_tenant_customer(
    session: AsyncSession, organization_id: UUID, customer_id: UUID
) -> None:
    customer_id_result = await session.scalar(
        select(Customer.id).where(
            Customer.organization_id == organization_id,
            Customer.id == customer_id,
        )
    )
    if customer_id_result is None:
        raise InvoiceConflictError("Select a customer from this workspace.")


async def assert_invoice_capacity(session: AsyncSession, organization_id: UUID) -> None:
    await session.execute(
        text("select pg_advisory_xact_lock(hashtextextended(:organization_id, 6146))"),
        {"organization_id": str(organization_id)},
    )
    entitlement = (
        (
            await session.execute(
                text(
                    "select max_invoices "
                    "from public.get_organization_entitlements(:organization_id)"
                ),
                {"organization_id": str(organization_id)},
            )
        )
        .mappings()
        .one_or_none()
    )
    if entitlement is None:
        raise InvoicePlanLimitError
    maximum = entitlement["max_invoices"]
    if maximum is None:
        return
    usage = await session.scalar(
        select(func.count()).select_from(Invoice).where(Invoice.organization_id == organization_id)
    )
    if int(usage or 0) >= int(maximum):
        raise InvoicePlanLimitError


def item_models(
    organization_id: UUID, invoice_id: UUID, request: CreateInvoiceRequest | UpdateInvoiceRequest
) -> list[InvoiceItem]:
    return [
        InvoiceItem(
            organization_id=organization_id,
            invoice_id=invoice_id,
            description=item.description,
            quantity=item.quantity,
            unit_price_minor=item.unit_price_minor,
            line_total_minor=item.quantity * item.unit_price_minor,
            position=index,
        )
        for index, item in enumerate(request.items, start=1)
    ]


async def create_invoice(
    session: AsyncSession,
    organization_id: UUID,
    user_id: UUID,
    request: CreateInvoiceRequest,
) -> Invoice:
    await require_tenant_customer(session, organization_id, request.customer_id)
    await assert_invoice_capacity(session, organization_id)
    current_sequence = await session.scalar(
        select(func.max(Invoice.number_sequence)).where(Invoice.organization_id == organization_id)
    )
    sequence = int(current_sequence or 0) + 1
    subtotal, tax, total = calculate_totals(
        request.items, request.discount_minor, request.tax_rate_bps
    )
    invoice = Invoice(
        organization_id=organization_id,
        customer_id=request.customer_id,
        invoice_number=f"INV-{sequence:06d}",
        number_sequence=sequence,
        status=InvoiceStatus.DRAFT,
        currency=request.currency,
        issue_date=request.issue_date,
        due_date=request.due_date,
        notes=request.notes,
        discount_minor=request.discount_minor,
        tax_rate_bps=request.tax_rate_bps,
        subtotal_minor=subtotal,
        tax_minor=tax,
        total_minor=total,
        paid_minor=0,
        created_by=user_id,
        updated_by=user_id,
        version=1,
    )
    session.add(invoice)
    await session.flush()
    session.add_all(item_models(organization_id, invoice.id, request))
    await session.flush()
    await session.refresh(invoice)
    return invoice


async def get_invoice_model(
    session: AsyncSession, organization_id: UUID, invoice_id: UUID, *, lock: bool = False
) -> Invoice | None:
    statement = select(Invoice).where(
        Invoice.organization_id == organization_id, Invoice.id == invoice_id
    )
    if lock:
        statement = statement.with_for_update()
    return (await session.execute(statement)).scalar_one_or_none()


async def update_invoice(
    session: AsyncSession,
    organization_id: UUID,
    invoice_id: UUID,
    user_id: UUID,
    request: UpdateInvoiceRequest,
) -> Invoice:
    invoice = await get_invoice_model(session, organization_id, invoice_id, lock=True)
    if (
        invoice is None
        or invoice.status is not InvoiceStatus.DRAFT
        or invoice.version != request.version
    ):
        raise InvoiceConflictError("Only the current draft invoice can be edited.")
    await require_tenant_customer(session, organization_id, request.customer_id)
    subtotal, tax, total = calculate_totals(
        request.items, request.discount_minor, request.tax_rate_bps
    )
    invoice.customer_id = request.customer_id
    invoice.currency = request.currency
    invoice.issue_date = request.issue_date
    invoice.due_date = request.due_date
    invoice.notes = request.notes
    invoice.discount_minor = request.discount_minor
    invoice.tax_rate_bps = request.tax_rate_bps
    invoice.subtotal_minor = subtotal
    invoice.tax_minor = tax
    invoice.total_minor = total
    invoice.updated_by = user_id
    invoice.updated_at = datetime.now(UTC)
    invoice.version += 1
    await session.execute(
        delete(InvoiceItem).where(
            InvoiceItem.organization_id == organization_id,
            InvoiceItem.invoice_id == invoice_id,
        )
    )
    session.add_all(item_models(organization_id, invoice_id, request))
    await session.flush()
    await session.refresh(invoice)
    return invoice


async def delete_invoice(
    session: AsyncSession, organization_id: UUID, invoice_id: UUID, version: int
) -> None:
    invoice = await get_invoice_model(session, organization_id, invoice_id, lock=True)
    if invoice is None or invoice.status is not InvoiceStatus.DRAFT or invoice.version != version:
        raise InvoiceConflictError("Only the current draft invoice can be deleted.")
    await session.delete(invoice)
    await session.flush()


async def transition_invoice(
    session: AsyncSession,
    organization_id: UUID,
    invoice_id: UUID,
    version: int,
    transition: str,
) -> Invoice:
    invoice = await get_invoice_model(session, organization_id, invoice_id, lock=True)
    if invoice is None:
        raise InvoiceNotFoundError
    if invoice.version != version:
        raise InvoiceConflictError("This invoice changed since it was loaded.")
    function = {"send": "send_invoice", "cancel": "cancel_invoice"}[transition]
    try:
        await session.execute(
            text(f"select (public.{function}(:organization_id, :invoice_id)).id"),
            {"organization_id": organization_id, "invoice_id": invoice_id},
        )
    except DBAPIError as error:
        raise InvoiceConflictError("This invoice cannot make that status transition.") from error
    await session.refresh(invoice)
    return invoice


async def record_payment(
    session: AsyncSession,
    organization_id: UUID,
    invoice_id: UUID,
    request: RecordPaymentRequest,
) -> PaymentResponse:
    try:
        row = (
            (
                await session.execute(
                    text(
                        """
                    select * from public.record_invoice_payment(
                      :organization_id, :invoice_id, :idempotency_key,
                      :amount_minor, :payment_date, cast(:method as public.payment_method),
                      :reference, :notes
                    )
                    """
                    ),
                    {
                        "organization_id": organization_id,
                        "invoice_id": invoice_id,
                        **request.model_dump(),
                        "method": request.method.value,
                    },
                )
            )
            .mappings()
            .one()
        )
    except DBAPIError as error:
        raise PaymentConflictError(
            "The payment conflicts with the invoice balance, status, or idempotency key."
        ) from error
    return PaymentResponse.model_validate(dict(row))


async def get_invoice(
    session: AsyncSession, organization_id: UUID, invoice_id: UUID
) -> InvoiceDetailResponse | None:
    result = await session.execute(
        select(Invoice, Customer.name, Customer.company, Customer.email)
        .join(
            Customer,
            and_(
                Customer.id == Invoice.customer_id,
                Customer.organization_id == Invoice.organization_id,
            ),
        )
        .where(Invoice.organization_id == organization_id, Invoice.id == invoice_id)
    )
    row = result.one_or_none()
    if row is None:
        return None
    invoice, customer_name, customer_company, customer_email = row
    items = list(
        (
            await session.execute(
                select(InvoiceItem)
                .where(
                    InvoiceItem.organization_id == organization_id,
                    InvoiceItem.invoice_id == invoice_id,
                )
                .order_by(InvoiceItem.position)
            )
        ).scalars()
    )
    payments = list(
        (
            await session.execute(
                select(PaymentRecord)
                .where(
                    PaymentRecord.organization_id == organization_id,
                    PaymentRecord.invoice_id == invoice_id,
                )
                .order_by(PaymentRecord.payment_date, PaymentRecord.created_at)
            )
        ).scalars()
    )
    data = InvoiceDetailResponse.model_validate(invoice).model_dump()
    return InvoiceDetailResponse(
        **data,
        customer_name=customer_name,
        customer_company=customer_company,
        customer_email=customer_email,
        items=[InvoiceItemResponse.model_validate(item) for item in items],
        payments=[PaymentResponse.model_validate(payment) for payment in payments],
    )


async def list_invoices(
    session: AsyncSession,
    organization_id: UUID,
    *,
    page: int,
    page_size: int,
    query: str,
    sort: InvoiceSort,
    status: InvoiceStatus | None,
) -> InvoiceListResponse:
    today = date.today()
    conditions = [Invoice.organization_id == organization_id]
    if status is InvoiceStatus.OVERDUE:
        conditions.append(
            or_(
                Invoice.status == InvoiceStatus.OVERDUE,
                and_(Invoice.status == InvoiceStatus.SENT, Invoice.due_date < today),
            )
        )
    elif status is InvoiceStatus.SENT:
        conditions.append(and_(Invoice.status == InvoiceStatus.SENT, Invoice.due_date >= today))
    elif status is not None:
        conditions.append(Invoice.status == status)
    if query:
        escaped = query.lower().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        pattern = f"%{escaped}%"
        conditions.append(
            or_(
                func.lower(Invoice.invoice_number).like(pattern, escape="\\"),
                func.lower(Customer.name).like(pattern, escape="\\"),
                func.lower(func.coalesce(Customer.company, "")).like(pattern, escape="\\"),
            )
        )
    ordering = {
        InvoiceSort.NEWEST: (desc(Invoice.issue_date), desc(Invoice.id)),
        InvoiceSort.OLDEST: (asc(Invoice.issue_date), asc(Invoice.id)),
        InvoiceSort.DUE_SOON: (asc(Invoice.due_date), asc(Invoice.id)),
        InvoiceSort.AMOUNT_HIGH: (desc(Invoice.total_minor), desc(Invoice.id)),
    }[sort]
    join = and_(
        Customer.id == Invoice.customer_id, Customer.organization_id == Invoice.organization_id
    )
    rows = (
        await session.execute(
            select(Invoice, Customer.name)
            .join(Customer, join)
            .where(*conditions)
            .order_by(*ordering)
            .limit(page_size)
            .offset((page - 1) * page_size)
        )
    ).all()
    total = int(
        await session.scalar(
            select(func.count()).select_from(Invoice).join(Customer, join).where(*conditions)
        )
        or 0
    )
    return InvoiceListResponse(
        invoices=[
            InvoiceListItem(
                id=invoice.id,
                invoice_number=invoice.invoice_number,
                customer_name=customer_name,
                status=(
                    InvoiceStatus.OVERDUE
                    if invoice.status is InvoiceStatus.SENT and invoice.due_date < today
                    else invoice.status
                ),
                currency=invoice.currency,
                issue_date=invoice.issue_date,
                due_date=invoice.due_date,
                total_minor=invoice.total_minor,
                paid_minor=invoice.paid_minor,
            )
            for invoice, customer_name in rows
        ],
        page=page,
        page_count=max(1, (total + page_size - 1) // page_size),
        page_size=page_size,
        total=total,
    )

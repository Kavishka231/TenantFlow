from datetime import date
from uuid import UUID

from sqlalchemy import delete, func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.expenses.models import Expense, ExpenseCategory, ExpenseStatus, PaymentMethod
from app.expenses.schemas import (
    CategoryExpenseTotal,
    CategoryFields,
    CreateExpenseRequest,
    ExpenseCategoryResponse,
    ExpenseDetailResponse,
    ExpenseListItem,
    ExpenseListResponse,
    ExpenseMetricsResponse,
    ExpenseSort,
    ExpenseTotal,
    MonthlyExpenseSeries,
    MonthlyPoint,
    TransitionExpenseRequest,
    UpdateExpenseRequest,
)


class ExpenseConflictError(Exception):
    pass


VALID_TRANSITIONS = {
    ExpenseStatus.PENDING: {ExpenseStatus.PAID, ExpenseStatus.CANCELLED},
    ExpenseStatus.PAID: {ExpenseStatus.PENDING, ExpenseStatus.REIMBURSED, ExpenseStatus.CANCELLED},
    ExpenseStatus.REIMBURSED: {ExpenseStatus.PAID, ExpenseStatus.CANCELLED},
    ExpenseStatus.CANCELLED: {ExpenseStatus.PENDING},
}


async def require_category(session: AsyncSession, organization_id: UUID, category_id: UUID) -> None:
    category_id_found = await session.scalar(
        select(ExpenseCategory.id).where(
            ExpenseCategory.organization_id == organization_id,
            ExpenseCategory.id == category_id,
        )
    )
    if category_id_found is None:
        raise ExpenseConflictError("Select a category from this workspace.")


async def create_expense(
    session: AsyncSession, organization_id: UUID, user_id: UUID, request: CreateExpenseRequest
) -> Expense:
    await require_category(session, organization_id, request.category_id)
    expense = Expense(
        organization_id=organization_id,
        category_id=request.category_id,
        amount_minor=request.amount_minor,
        currency=request.currency,
        expense_date=request.expense_date,
        vendor=request.vendor,
        payment_method=request.payment_method,
        status=request.status,
        paid_date=request.paid_date,
        description=request.description,
        receipt_path=None,
        receipt_name=None,
        receipt_mime_type=None,
        receipt_size=None,
        created_by=user_id,
        updated_by=user_id,
        version=1,
    )
    session.add(expense)
    await session.flush()
    await session.refresh(expense)
    return expense


async def expense_model(
    session: AsyncSession, organization_id: UUID, expense_id: UUID, *, lock: bool = False
) -> Expense | None:
    statement = select(Expense).where(
        Expense.organization_id == organization_id, Expense.id == expense_id
    )
    if lock:
        statement = statement.with_for_update()
    return (await session.execute(statement)).scalar_one_or_none()


async def update_expense(
    session: AsyncSession, organization_id: UUID, expense_id: UUID, request: UpdateExpenseRequest
) -> Expense:
    expense = await expense_model(session, organization_id, expense_id, lock=True)
    if expense is None or expense.version != request.version:
        raise ExpenseConflictError("This expense changed since it was loaded.")
    await require_category(session, organization_id, request.category_id)
    expense.category_id = request.category_id
    expense.amount_minor = request.amount_minor
    expense.currency = request.currency
    expense.expense_date = request.expense_date
    expense.vendor = request.vendor
    expense.payment_method = request.payment_method
    expense.status = request.status
    expense.paid_date = request.paid_date
    expense.description = request.description
    await session.flush()
    await session.refresh(expense)
    return expense


async def transition_expense(
    session: AsyncSession,
    organization_id: UUID,
    expense_id: UUID,
    request: TransitionExpenseRequest,
) -> Expense:
    expense = await expense_model(session, organization_id, expense_id, lock=True)
    if expense is None or expense.version != request.version:
        raise ExpenseConflictError("This expense changed since it was loaded.")
    if request.status not in VALID_TRANSITIONS[expense.status]:
        raise ExpenseConflictError(
            f"An expense cannot transition from {expense.status.value} to {request.status.value}."
        )
    expense.status = request.status
    expense.paid_date = request.paid_date
    await session.flush()
    await session.refresh(expense)
    return expense


async def delete_expense(
    session: AsyncSession, organization_id: UUID, expense_id: UUID, version: int
) -> str | None:
    expense = await expense_model(session, organization_id, expense_id, lock=True)
    if expense is None or expense.version != version:
        raise ExpenseConflictError("This expense changed since it was loaded.")
    receipt_path = expense.receipt_path
    await session.delete(expense)
    await session.flush()
    return receipt_path


async def get_expense(
    session: AsyncSession, organization_id: UUID, expense_id: UUID
) -> ExpenseDetailResponse | None:
    row = (
        (
            await session.execute(
                text(
                    """
                select e.*, c.name as category_name, c.color as category_color
                from public.expenses e
                join public.expense_categories c
                  on c.organization_id = e.organization_id and c.id = e.category_id
                where e.organization_id = :organization_id and e.id = :expense_id
                """
                ),
                {"organization_id": organization_id, "expense_id": expense_id},
            )
        )
        .mappings()
        .one_or_none()
    )
    return ExpenseDetailResponse.model_validate(dict(row)) if row else None


def _filters(
    query: str,
    category_id: UUID | None,
    status: ExpenseStatus | None,
    payment_method: PaymentMethod | None,
) -> tuple[str, dict[str, object]]:
    clauses: list[str] = []
    values: dict[str, object] = {}
    if query:
        escaped = query.lower().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        clauses.append(
            "(lower(e.vendor) like :query escape '\\' or "
            "lower(coalesce(e.description, '')) like :query escape '\\')"
        )
        values["query"] = f"%{escaped}%"
    for key, value, column in (
        ("category_id", category_id, "e.category_id"),
        ("status", status.value if status else None, "e.status"),
        ("payment_method", payment_method.value if payment_method else None, "e.payment_method"),
    ):
        if value is not None:
            clauses.append(f"{column} = :{key}")
            values[key] = value
    return (" and " + " and ".join(clauses) if clauses else ""), values


async def list_expenses(
    session: AsyncSession,
    organization_id: UUID,
    *,
    page: int,
    page_size: int,
    query: str,
    sort: ExpenseSort,
    category_id: UUID | None,
    status: ExpenseStatus | None,
    payment_method: PaymentMethod | None,
) -> ExpenseListResponse:
    filters, values = _filters(query, category_id, status, payment_method)
    ordering = {
        ExpenseSort.NEWEST: "e.expense_date desc, e.created_at desc, e.id desc",
        ExpenseSort.OLDEST: "e.expense_date asc, e.id asc",
        ExpenseSort.AMOUNT_DESC: "e.amount_minor desc, e.id desc",
        ExpenseSort.AMOUNT_ASC: "e.amount_minor asc, e.id asc",
        ExpenseSort.VENDOR_ASC: "e.vendor asc, e.id asc",
        ExpenseSort.VENDOR_DESC: "e.vendor desc, e.id desc",
    }[sort]
    base = """
        from public.expenses e join public.expense_categories c
          on c.organization_id = e.organization_id and c.id = e.category_id
        where e.organization_id = :organization_id
    """
    bind = {"organization_id": organization_id, **values}
    rows = (
        await session.execute(
            text(
                "select e.id, e.amount_minor, e.currency, e.expense_date, e.vendor, "
                "e.payment_method, e.status, e.receipt_name, c.name as category_name, "
                "c.color as category_color "
                + base
                + filters
                + f" order by {ordering} limit :limit offset :offset"
            ),
            {**bind, "limit": page_size, "offset": (page - 1) * page_size},
        )
    ).mappings()
    total = int(await session.scalar(text("select count(*) " + base + filters), bind) or 0)
    return ExpenseListResponse(
        expenses=[ExpenseListItem.model_validate(dict(row)) for row in rows],
        page=page,
        page_count=max(1, (total + page_size - 1) // page_size),
        page_size=page_size,
        total=total,
    )


async def list_categories(
    session: AsyncSession, organization_id: UUID
) -> list[ExpenseCategoryResponse]:
    categories = (
        await session.execute(
            select(ExpenseCategory)
            .where(ExpenseCategory.organization_id == organization_id)
            .order_by(ExpenseCategory.name, ExpenseCategory.id)
        )
    ).scalars()
    return [ExpenseCategoryResponse.model_validate(item) for item in categories]


async def create_category(
    session: AsyncSession, organization_id: UUID, request: CategoryFields
) -> ExpenseCategory:
    category = ExpenseCategory(
        organization_id=organization_id, name=request.name, color=request.color
    )
    session.add(category)
    await session.flush()
    await session.refresh(category)
    return category


async def update_category(
    session: AsyncSession, organization_id: UUID, category_id: UUID, request: CategoryFields
) -> ExpenseCategory:
    category = (
        await session.execute(
            select(ExpenseCategory)
            .where(
                ExpenseCategory.organization_id == organization_id,
                ExpenseCategory.id == category_id,
            )
            .with_for_update()
        )
    ).scalar_one_or_none()
    if category is None:
        raise ExpenseConflictError("The expense category was not found.")
    category.name = request.name
    category.color = request.color
    await session.flush()
    await session.refresh(category)
    return category


async def delete_category(session: AsyncSession, organization_id: UUID, category_id: UUID) -> None:
    used = await session.scalar(
        select(func.count())
        .select_from(Expense)
        .where(Expense.organization_id == organization_id, Expense.category_id == category_id)
    )
    if used:
        raise ExpenseConflictError("Categories used by expenses cannot be deleted.")
    result = await session.execute(
        delete(ExpenseCategory).where(
            ExpenseCategory.organization_id == organization_id, ExpenseCategory.id == category_id
        )
    )
    if result.rowcount != 1:  # type: ignore[attr-defined]
        raise ExpenseConflictError("The expense category was not found.")


async def expense_metrics(
    session: AsyncSession, organization_id: UUID, start: date, end_exclusive: date
) -> ExpenseMetricsResponse:
    bind = {"organization_id": organization_id, "start": start, "end_exclusive": end_exclusive}
    where = """where e.organization_id = :organization_id and e.expense_date >= :start
        and e.expense_date < :end_exclusive and e.status <> 'cancelled'"""
    total_rows = (
        await session.execute(
            text(
                "select e.currency, sum(e.amount_minor)::bigint amount_minor, "
                "sum(case when e.status in ('paid','reimbursed') "
                "then e.amount_minor else 0 end)::bigint paid_minor "
                "from public.expenses e " + where + " group by e.currency order by e.currency"
            ),
            bind,
        )
    ).mappings()
    month_sql = (
        "select e.currency, "  # noqa: S608 -- static fragments; values are bound
        "to_char(date_trunc('month', e.expense_date::timestamp), 'YYYY-MM') month, "
        "sum(e.amount_minor)::bigint amount_minor from public.expenses e "
        + where
        + " group by e.currency, date_trunc('month', e.expense_date::timestamp) "
        "order by e.currency, month"
    )
    month_rows = (await session.execute(text(month_sql), bind)).mappings().all()
    category_sql = (
        "select c.id category_id, c.name category_name, c.color, e.currency, "  # noqa: S608
        "sum(e.amount_minor)::bigint amount_minor from public.expenses e "
        "join public.expense_categories c "
        "on c.organization_id=e.organization_id and c.id=e.category_id "
        + where
        + " group by c.id,c.name,c.color,e.currency order by e.currency,c.name"
    )
    category_rows = (await session.execute(text(category_sql), bind)).mappings()
    months: list[str] = []
    cursor = start.replace(day=1)
    while cursor < end_exclusive:
        months.append(cursor.strftime("%Y-%m"))
        cursor = date(
            cursor.year + (cursor.month == 12), 1 if cursor.month == 12 else cursor.month + 1, 1
        )
    currencies = sorted({str(row["currency"]) for row in month_rows})
    return ExpenseMetricsResponse(
        totals=[ExpenseTotal.model_validate(dict(row)) for row in total_rows],
        monthly=[
            MonthlyExpenseSeries(
                currency=currency,
                points=[
                    MonthlyPoint(
                        month=month,
                        amount_minor=next(
                            (
                                int(row["amount_minor"])
                                for row in month_rows
                                if row["currency"] == currency and row["month"] == month
                            ),
                            0,
                        ),
                    )
                    for month in months
                ],
            )
            for currency in currencies
        ],
        categories=[CategoryExpenseTotal.model_validate(dict(row)) for row in category_rows],
    )


async def attach_receipt_metadata(
    session: AsyncSession,
    organization_id: UUID,
    expense_id: UUID,
    user_id: UUID,
    *,
    version: int,
    path: str,
    name: str,
    mime_type: str,
    size: int,
) -> Expense:
    expense = await expense_model(session, organization_id, expense_id, lock=True)
    if expense is None or expense.version != version or expense.receipt_path is not None:
        raise ExpenseConflictError(
            "This expense already has a receipt or changed before upload completed."
        )
    expense.receipt_path, expense.receipt_name = path, name
    expense.receipt_mime_type, expense.receipt_size = mime_type, size
    expense.updated_by = user_id
    await session.flush()
    await session.refresh(expense)
    return expense


async def detach_receipt_metadata(
    session: AsyncSession, organization_id: UUID, expense_id: UUID, user_id: UUID, version: int
) -> tuple[Expense, str]:
    expense = await expense_model(session, organization_id, expense_id, lock=True)
    if expense is None or expense.version != version or expense.receipt_path is None:
        raise ExpenseConflictError("This receipt was already removed or the expense changed.")
    path = expense.receipt_path
    expense.receipt_path = expense.receipt_name = expense.receipt_mime_type = None
    expense.receipt_size = None
    expense.updated_by = user_id
    await session.flush()
    await session.refresh(expense)
    return expense, path

from datetime import date
from typing import Annotated, Literal
from uuid import UUID, uuid4

from fastapi import APIRouter, BackgroundTasks, Depends, Header, Query, Request, status
from sqlalchemy.exc import IntegrityError

from app.auth.dependencies import AccessToken, CurrentUser
from app.core.config import Settings, get_settings
from app.core.errors import ApiError
from app.db.dependencies import RlsSession
from app.expenses.models import ExpenseStatus, PaymentMethod
from app.expenses.schemas import (
    CategoryFields,
    CreateExpenseRequest,
    ExpenseCategoryResponse,
    ExpenseDetailResponse,
    ExpenseListResponse,
    ExpenseMetricsResponse,
    ExpenseResponse,
    ExpenseSort,
    ReceiptResponse,
    SignedReceiptResponse,
    TransitionExpenseRequest,
    UpdateExpenseRequest,
    VersionRequest,
)
from app.expenses.service import (
    ExpenseConflictError,
    attach_receipt_metadata,
    create_category,
    create_expense,
    delete_category,
    delete_expense,
    detach_receipt_metadata,
    expense_metrics,
    expense_model,
    get_expense,
    list_categories,
    list_expenses,
    transition_expense,
    update_category,
    update_expense,
)
from app.expenses.storage import (
    MAX_RECEIPT_BYTES,
    ReceiptStorage,
    ReceiptStorageError,
    safe_object_path,
    validate_receipt,
)
from app.organizations.authorization import require_organization_permission
from app.organizations.models import OrganizationPermission, OrganizationSummary

router = APIRouter(prefix="/organizations/{organization_id}/expenses", tags=["expenses"])
ReadExpenses = Annotated[
    OrganizationSummary,
    Depends(require_organization_permission(OrganizationPermission.READ_EXPENSES)),
]
ManageExpenses = Annotated[
    OrganizationSummary,
    Depends(require_organization_permission(OrganizationPermission.MANAGE_EXPENSES)),
]


def conflict(error: ExpenseConflictError) -> ApiError:
    return ApiError(status.HTTP_409_CONFLICT, "expense_conflict", str(error))


def storage(settings: Settings, token: str) -> ReceiptStorage:
    try:
        return ReceiptStorage(settings, token)
    except ReceiptStorageError as error:
        raise ApiError(503, "receipt_storage_unavailable", str(error)) from error


@router.get("", response_model=ExpenseListResponse)
async def expense_list(
    organization_id: UUID,
    organization: ReadExpenses,
    session: RlsSession,
    q: Annotated[str, Query(max_length=100)] = "",
    sort: ExpenseSort = ExpenseSort.NEWEST,
    category_id: UUID | None = None,
    expense_status: Annotated[ExpenseStatus | None, Query(alias="status")] = None,
    payment_method: PaymentMethod | None = None,
    page: Annotated[int, Query(gt=0)] = 1,
    page_size: Literal[10, 25, 50] = 10,
) -> ExpenseListResponse:
    del organization
    return await list_expenses(
        session,
        organization_id,
        page=page,
        page_size=page_size,
        query=q.strip(),
        sort=sort,
        category_id=category_id,
        status=expense_status,
        payment_method=payment_method,
    )


@router.get("/categories", response_model=list[ExpenseCategoryResponse])
async def category_list(
    organization_id: UUID, organization: ReadExpenses, session: RlsSession
) -> list[ExpenseCategoryResponse]:
    del organization
    return await list_categories(session, organization_id)


@router.post("/categories", response_model=ExpenseCategoryResponse, status_code=201)
async def category_create(
    organization_id: UUID,
    request: CategoryFields,
    organization: ManageExpenses,
    session: RlsSession,
) -> ExpenseCategoryResponse:
    del organization
    try:
        category = await create_category(session, organization_id, request)
    except IntegrityError as error:
        raise ApiError(
            409, "category_conflict", "A category with this name already exists."
        ) from error
    return ExpenseCategoryResponse.model_validate(category)


@router.patch("/categories/{category_id}", response_model=ExpenseCategoryResponse)
async def category_update(
    organization_id: UUID,
    category_id: UUID,
    request: CategoryFields,
    organization: ManageExpenses,
    session: RlsSession,
) -> ExpenseCategoryResponse:
    del organization
    try:
        category = await update_category(session, organization_id, category_id, request)
    except ExpenseConflictError as error:
        raise conflict(error) from error
    except IntegrityError as error:
        raise ApiError(
            409, "category_conflict", "A category with this name already exists."
        ) from error
    return ExpenseCategoryResponse.model_validate(category)


@router.delete("/categories/{category_id}", status_code=204)
async def category_delete(
    organization_id: UUID, category_id: UUID, organization: ManageExpenses, session: RlsSession
) -> None:
    del organization
    try:
        await delete_category(session, organization_id, category_id)
    except ExpenseConflictError as error:
        raise conflict(error) from error


@router.get("/metrics", response_model=ExpenseMetricsResponse)
async def metrics(
    organization_id: UUID,
    organization: ReadExpenses,
    session: RlsSession,
    start: date,
    end_exclusive: date,
) -> ExpenseMetricsResponse:
    del organization
    if end_exclusive <= start or (end_exclusive - start).days > 367:
        raise ApiError(
            422, "invalid_date_range", "The date range must contain between 1 and 367 days."
        )
    return await expense_metrics(session, organization_id, start, end_exclusive)


@router.post("", response_model=ExpenseResponse, status_code=201)
async def expense_create(
    organization_id: UUID,
    request: CreateExpenseRequest,
    organization: ManageExpenses,
    user: CurrentUser,
    session: RlsSession,
) -> ExpenseResponse:
    del organization
    try:
        expense = await create_expense(session, organization_id, user.id, request)
    except ExpenseConflictError as error:
        raise conflict(error) from error
    return ExpenseResponse.model_validate(expense)


@router.get("/{expense_id}", response_model=ExpenseDetailResponse)
async def expense_detail(
    organization_id: UUID, expense_id: UUID, organization: ReadExpenses, session: RlsSession
) -> ExpenseDetailResponse:
    del organization
    expense = await get_expense(session, organization_id, expense_id)
    if expense is None:
        raise ApiError(404, "expense_not_found", "The expense was not found.")
    return expense


@router.patch("/{expense_id}", response_model=ExpenseResponse)
async def expense_update(
    organization_id: UUID,
    expense_id: UUID,
    request: UpdateExpenseRequest,
    organization: ManageExpenses,
    session: RlsSession,
) -> ExpenseResponse:
    del organization
    try:
        expense = await update_expense(session, organization_id, expense_id, request)
    except ExpenseConflictError as error:
        raise conflict(error) from error
    return ExpenseResponse.model_validate(expense)


@router.post("/{expense_id}/transition", response_model=ExpenseResponse)
async def expense_transition(
    organization_id: UUID,
    expense_id: UUID,
    request: TransitionExpenseRequest,
    organization: ManageExpenses,
    session: RlsSession,
) -> ExpenseResponse:
    del organization
    try:
        expense = await transition_expense(session, organization_id, expense_id, request)
    except ExpenseConflictError as error:
        raise conflict(error) from error
    return ExpenseResponse.model_validate(expense)


@router.delete("/{expense_id}", status_code=204)
async def expense_delete(
    organization_id: UUID,
    expense_id: UUID,
    request: VersionRequest,
    organization: ManageExpenses,
    session: RlsSession,
    user_token: AccessToken,
    settings: Annotated[Settings, Depends(get_settings)],
    background: BackgroundTasks,
) -> None:
    del organization
    try:
        path = await delete_expense(session, organization_id, expense_id, request.version)
    except ExpenseConflictError as error:
        raise conflict(error) from error
    if path:
        background.add_task(storage(settings, user_token).delete, path)


@router.put("/{expense_id}/receipt", response_model=ReceiptResponse)
async def receipt_upload(
    organization_id: UUID,
    expense_id: UUID,
    request: Request,
    organization: ManageExpenses,
    user: CurrentUser,
    user_token: AccessToken,
    session: RlsSession,
    settings: Annotated[Settings, Depends(get_settings)],
    receipt_name: Annotated[str, Header(alias="X-Receipt-Name")],
    expense_version: Annotated[int, Header(alias="X-Expense-Version", gt=0)],
) -> ReceiptResponse:
    del organization
    content_length = request.headers.get("content-length")
    if content_length and int(content_length) > MAX_RECEIPT_BYTES:
        raise ApiError(413, "receipt_too_large", "Receipts must be 5 MB or smaller.")
    content = await request.body()
    mime_type = request.headers.get("content-type", "").split(";", 1)[0].lower()
    try:
        name = validate_receipt(receipt_name, mime_type, content)
        path = safe_object_path(str(organization_id), str(expense_id), str(uuid4()), mime_type)
    except ValueError as error:
        raise ApiError(422, "invalid_receipt", str(error)) from error
    gateway = storage(settings, user_token)
    await gateway.upload(path, content, mime_type)
    try:
        expense = await attach_receipt_metadata(
            session,
            organization_id,
            expense_id,
            user.id,
            version=expense_version,
            path=path,
            name=name,
            mime_type=mime_type,
            size=len(content),
        )
    except ExpenseConflictError as error:
        await gateway.delete(path)
        raise conflict(error) from error
    return ReceiptResponse(
        name=name, mime_type=mime_type, size=len(content), version=expense.version
    )


@router.get("/{expense_id}/receipt", response_model=SignedReceiptResponse)
async def receipt_download(
    organization_id: UUID,
    expense_id: UUID,
    organization: ReadExpenses,
    session: RlsSession,
    user_token: AccessToken,
    settings: Annotated[Settings, Depends(get_settings)],
) -> SignedReceiptResponse:
    del organization
    expense = await get_expense(session, organization_id, expense_id)
    if expense is None or expense.receipt_name is None:
        raise ApiError(404, "receipt_not_found", "The receipt was not found.")
    model = await expense_model(session, organization_id, expense_id)
    if model is None or model.receipt_path is None:
        raise ApiError(404, "receipt_not_found", "The receipt was not found.")
    try:
        signed = await storage(settings, user_token).signed_url(model.receipt_path)
    except ReceiptStorageError as error:
        raise ApiError(502, "receipt_signing_failed", str(error)) from error
    return SignedReceiptResponse(signed_url=signed, expires_in=60)


@router.delete("/{expense_id}/receipt", response_model=ReceiptResponse)
async def receipt_delete(
    organization_id: UUID,
    expense_id: UUID,
    request: VersionRequest,
    organization: ManageExpenses,
    user: CurrentUser,
    session: RlsSession,
    user_token: AccessToken,
    settings: Annotated[Settings, Depends(get_settings)],
    background: BackgroundTasks,
) -> ReceiptResponse:
    del organization
    try:
        expense, path = await detach_receipt_metadata(
            session, organization_id, expense_id, user.id, request.version
        )
    except ExpenseConflictError as error:
        raise conflict(error) from error
    background.add_task(storage(settings, user_token).delete, path)
    return ReceiptResponse(name="", mime_type="", size=0, version=expense.version)

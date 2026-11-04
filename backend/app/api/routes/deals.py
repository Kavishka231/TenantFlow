from datetime import date
from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status

from app.auth.dependencies import CurrentUser
from app.core.errors import ApiError
from app.db.dependencies import RlsSession
from app.deals.models import DealOutcome
from app.deals.schemas import (
    AddDealNoteRequest,
    CreateDealRequest,
    DealDetailResponse,
    DealListResponse,
    DealNoteCreatedResponse,
    DealOptionsResponse,
    DealResponse,
    DealSort,
    PipelineResponse,
    SalesMetricsResponse,
    TransitionDealRequest,
    UpdateDealRequest,
    VersionRequest,
)
from app.deals.service import (
    DealConflictError,
    DealNotFoundError,
    add_deal_note,
    create_deal,
    delete_deal,
    get_deal,
    get_options,
    get_pipeline,
    get_sales_metrics,
    list_deals,
    transition_deal,
    update_deal,
)
from app.organizations.authorization import require_organization_permission
from app.organizations.models import OrganizationPermission, OrganizationSummary

router = APIRouter(prefix="/organizations/{organization_id}/deals", tags=["deals"])
ReadDeals = Annotated[
    OrganizationSummary,
    Depends(require_organization_permission(OrganizationPermission.READ_DEALS)),
]
ManageDeals = Annotated[
    OrganizationSummary,
    Depends(require_organization_permission(OrganizationPermission.MANAGE_DEALS)),
]


def conflict_error(error: DealConflictError) -> ApiError:
    return ApiError(status.HTTP_409_CONFLICT, "deal_conflict", str(error))


@router.get("", response_model=DealListResponse)
async def deal_list(
    organization_id: UUID,
    organization: ReadDeals,
    session: RlsSession,
    q: Annotated[str, Query(max_length=100)] = "",
    sort: DealSort = DealSort.CLOSE_DATE,
    deal_outcome: Annotated[DealOutcome | None, Query(alias="outcome")] = None,
    stage_id: UUID | None = None,
    assignee_id: UUID | None = None,
    customer_id: UUID | None = None,
    currency: Annotated[str | None, Query(pattern=r"^[A-Z]{3}$")] = None,
    page: Annotated[int, Query(gt=0)] = 1,
    page_size: Literal[10, 25, 50] = 25,
) -> DealListResponse:
    del organization
    return await list_deals(
        session,
        organization_id,
        page=page,
        page_size=page_size,
        query=q.strip(),
        sort=sort,
        stage_id=stage_id,
        outcome=deal_outcome,
        assignee_id=assignee_id,
        customer_id=customer_id,
        currency=currency,
    )


@router.get("/pipeline", response_model=PipelineResponse)
async def pipeline_read(
    organization_id: UUID, organization: ReadDeals, session: RlsSession
) -> PipelineResponse:
    del organization
    return await get_pipeline(session, organization_id)


@router.get("/options", response_model=DealOptionsResponse)
async def deal_options(
    organization_id: UUID, organization: ReadDeals, session: RlsSession
) -> DealOptionsResponse:
    del organization
    return await get_options(session, organization_id)


@router.get("/metrics", response_model=SalesMetricsResponse)
async def deal_metrics(
    organization_id: UUID,
    organization: ReadDeals,
    session: RlsSession,
    start: date,
    end_exclusive: date,
) -> SalesMetricsResponse:
    del organization
    if end_exclusive <= start or (end_exclusive - start).days > 367:
        raise ApiError(
            422,
            "invalid_date_range",
            "The date range must contain between 1 and 367 days.",
        )
    return await get_sales_metrics(session, organization_id, start, end_exclusive)


@router.post("", response_model=DealResponse, status_code=status.HTTP_201_CREATED)
async def deal_create(
    organization_id: UUID,
    request: CreateDealRequest,
    organization: ManageDeals,
    user: CurrentUser,
    session: RlsSession,
) -> DealResponse:
    del organization
    try:
        deal = await create_deal(session, organization_id, user.id, request)
    except DealConflictError as error:
        raise conflict_error(error) from error
    return DealResponse.model_validate(deal)


@router.get("/{deal_id}", response_model=DealDetailResponse)
async def deal_detail(
    organization_id: UUID,
    deal_id: UUID,
    organization: ReadDeals,
    session: RlsSession,
) -> DealDetailResponse:
    del organization
    deal = await get_deal(session, organization_id, deal_id)
    if deal is None:
        raise ApiError(404, "deal_not_found", "The deal was not found.")
    return deal


@router.patch("/{deal_id}", response_model=DealResponse)
async def deal_update(
    organization_id: UUID,
    deal_id: UUID,
    request: UpdateDealRequest,
    organization: ManageDeals,
    session: RlsSession,
) -> DealResponse:
    del organization
    try:
        deal = await update_deal(session, organization_id, deal_id, request)
    except DealConflictError as error:
        raise conflict_error(error) from error
    return DealResponse.model_validate(deal)


@router.delete("/{deal_id}", status_code=status.HTTP_204_NO_CONTENT)
async def deal_delete(
    organization_id: UUID,
    deal_id: UUID,
    request: VersionRequest,
    organization: ManageDeals,
    session: RlsSession,
) -> None:
    del organization
    try:
        await delete_deal(session, organization_id, deal_id, request.version)
    except DealConflictError as error:
        raise conflict_error(error) from error


@router.post("/{deal_id}/transition", response_model=DealResponse)
async def deal_transition(
    organization_id: UUID,
    deal_id: UUID,
    request: TransitionDealRequest,
    organization: ManageDeals,
    session: RlsSession,
) -> DealResponse:
    del organization
    try:
        deal = await transition_deal(session, organization_id, deal_id, request)
    except DealConflictError as error:
        raise conflict_error(error) from error
    return DealResponse.model_validate(deal)


@router.post(
    "/{deal_id}/notes",
    response_model=DealNoteCreatedResponse,
    status_code=status.HTTP_201_CREATED,
)
async def deal_note(
    organization_id: UUID,
    deal_id: UUID,
    request: AddDealNoteRequest,
    organization: ManageDeals,
    user: CurrentUser,
    session: RlsSession,
) -> DealNoteCreatedResponse:
    del organization
    try:
        activity = await add_deal_note(
            session, organization_id, deal_id, user.id, request
        )
    except DealNotFoundError as error:
        raise ApiError(404, "deal_not_found", "The deal was not found.") from error
    return DealNoteCreatedResponse(id=activity.id)

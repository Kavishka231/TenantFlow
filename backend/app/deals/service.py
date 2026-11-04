from datetime import UTC, date, datetime
from uuid import UUID

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.customers.models import Customer
from app.deals.models import Deal, DealActivity, DealActivityType, DealOutcome, PipelineStage
from app.deals.schemas import (
    AddDealNoteRequest,
    CreateDealRequest,
    CurrencyAggregate,
    DealActivityResponse,
    DealCustomerOption,
    DealDetailResponse,
    DealListItem,
    DealListResponse,
    DealMemberOption,
    DealOptionsResponse,
    DealSort,
    PipelineResponse,
    PipelineStageResponse,
    SalesMetricsResponse,
    StageAggregate,
    TransitionDealRequest,
    UpdateDealRequest,
)


class DealConflictError(Exception):
    pass


class DealNotFoundError(Exception):
    pass


def calculate_conversion_rate(won: int, lost: int) -> float:
    total = won + lost
    if total == 0:
        return 0
    rounded_tenths = (2 * won * 1_000 + total) // (2 * total)
    return rounded_tenths / 10


async def require_deal_references(
    session: AsyncSession,
    organization_id: UUID,
    customer_id: UUID,
    stage_id: UUID,
    assigned_user_id: UUID | None,
) -> None:
    customer = await session.scalar(
        select(Customer.id).where(
            Customer.organization_id == organization_id,
            Customer.id == customer_id,
        )
    )
    stage = await session.scalar(
        select(PipelineStage.id).where(
            PipelineStage.organization_id == organization_id,
            PipelineStage.id == stage_id,
        )
    )
    member_valid = assigned_user_id is None
    if assigned_user_id is not None:
        member = await session.scalar(
            text(
                """
                select user_id from public.organization_members
                where organization_id = :organization_id and user_id = :user_id
                """
            ),
            {"organization_id": organization_id, "user_id": assigned_user_id},
        )
        member_valid = member is not None
    if customer is None or stage is None or not member_valid:
        raise DealConflictError(
            "The customer, stage, and assignee must belong to this workspace."
        )


async def create_deal(
    session: AsyncSession,
    organization_id: UUID,
    user_id: UUID,
    request: CreateDealRequest,
) -> Deal:
    await require_deal_references(
        session,
        organization_id,
        request.customer_id,
        request.stage_id,
        request.assigned_user_id,
    )
    deal = Deal(
        organization_id=organization_id,
        customer_id=request.customer_id,
        stage_id=request.stage_id,
        assigned_user_id=request.assigned_user_id,
        title=request.title,
        description=request.description,
        value_minor=request.value_minor,
        currency=request.currency,
        expected_close_date=request.expected_close_date,
        outcome=DealOutcome.OPEN,
        outcome_reason=None,
        closed_at=None,
        created_by=user_id,
        updated_by=user_id,
        version=1,
    )
    session.add(deal)
    await session.flush()
    await session.refresh(deal)
    return deal


async def get_deal_model(
    session: AsyncSession,
    organization_id: UUID,
    deal_id: UUID,
    *,
    lock: bool = False,
) -> Deal | None:
    statement = select(Deal).where(
        Deal.organization_id == organization_id,
        Deal.id == deal_id,
    )
    if lock:
        statement = statement.with_for_update()
    return (await session.execute(statement)).scalar_one_or_none()


async def update_deal(
    session: AsyncSession,
    organization_id: UUID,
    deal_id: UUID,
    request: UpdateDealRequest,
) -> Deal:
    deal = await get_deal_model(session, organization_id, deal_id, lock=True)
    if deal is None or deal.version != request.version:
        raise DealConflictError("This deal changed since it was loaded.")
    await require_deal_references(
        session,
        organization_id,
        request.customer_id,
        request.stage_id,
        request.assigned_user_id,
    )
    deal.customer_id = request.customer_id
    deal.stage_id = request.stage_id
    deal.assigned_user_id = request.assigned_user_id
    deal.title = request.title
    deal.description = request.description
    deal.value_minor = request.value_minor
    deal.currency = request.currency
    deal.expected_close_date = request.expected_close_date
    await session.flush()
    await session.refresh(deal)
    return deal


async def transition_deal(
    session: AsyncSession,
    organization_id: UUID,
    deal_id: UUID,
    request: TransitionDealRequest,
) -> Deal:
    deal = await get_deal_model(session, organization_id, deal_id, lock=True)
    if deal is None or deal.version != request.version:
        raise DealConflictError("This deal changed since it was loaded.")
    stage = await session.scalar(
        select(PipelineStage.id).where(
            PipelineStage.organization_id == organization_id,
            PipelineStage.id == request.stage_id,
        )
    )
    if stage is None:
        raise DealConflictError("Select a pipeline stage from this workspace.")
    deal.stage_id = request.stage_id
    deal.outcome_reason = request.outcome_reason
    await session.flush()
    await session.refresh(deal)
    return deal


async def delete_deal(
    session: AsyncSession,
    organization_id: UUID,
    deal_id: UUID,
    version: int,
) -> None:
    deal = await get_deal_model(session, organization_id, deal_id, lock=True)
    if deal is None or deal.version != version:
        raise DealConflictError("This deal changed since it was loaded.")
    await session.delete(deal)
    await session.flush()


async def add_deal_note(
    session: AsyncSession,
    organization_id: UUID,
    deal_id: UUID,
    user_id: UUID,
    request: AddDealNoteRequest,
) -> DealActivity:
    deal = await get_deal_model(session, organization_id, deal_id)
    if deal is None:
        raise DealNotFoundError
    activity = DealActivity(
        organization_id=organization_id,
        deal_id=deal_id,
        actor_id=user_id,
        type=DealActivityType.NOTE_ADDED,
        note=request.note,
        metadata_={},
    )
    session.add(activity)
    await session.flush()
    await session.refresh(activity)
    return activity


def list_filters(
    *,
    query: str,
    stage_id: UUID | None,
    outcome: DealOutcome | None,
    assignee_id: UUID | None,
    customer_id: UUID | None,
    currency: str | None,
) -> tuple[str, dict[str, object]]:
    clauses: list[str] = []
    parameters: dict[str, object] = {}
    if query:
        clauses.append(
            "(lower(d.title) like :query escape '\\' "
            "or lower(c.name) like :query escape '\\')"
        )
        escaped = query.lower().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        parameters["query"] = f"%{escaped}%"
    for key, value, column in (
        ("stage_id", stage_id, "d.stage_id"),
        ("outcome", outcome.value if outcome else None, "d.outcome"),
        ("assignee_id", assignee_id, "d.assigned_user_id"),
        ("customer_id", customer_id, "d.customer_id"),
        ("currency", currency, "d.currency"),
    ):
        if value is not None:
            clauses.append(f"{column} = :{key}")
            parameters[key] = value
    return (" and " + " and ".join(clauses) if clauses else ""), parameters


DEAL_SELECT = """
    select d.id, d.title, d.stage_id, c.name as customer_name,
           p.full_name as assignee_name, d.value_minor, d.currency,
           d.expected_close_date, d.outcome, d.version
    from public.deals d
    join public.customers c
      on c.organization_id = d.organization_id and c.id = d.customer_id
    left join public.profiles p on p.id = d.assigned_user_id
    where d.organization_id = :organization_id
"""
DEAL_COUNT_SELECT = """
    select count(*) from public.deals d
    join public.customers c
      on c.organization_id = d.organization_id and c.id = d.customer_id
    where d.organization_id = :organization_id
"""


async def list_deals(
    session: AsyncSession,
    organization_id: UUID,
    *,
    page: int,
    page_size: int,
    query: str,
    sort: DealSort,
    stage_id: UUID | None,
    outcome: DealOutcome | None,
    assignee_id: UUID | None,
    customer_id: UUID | None,
    currency: str | None,
) -> DealListResponse:
    filters, parameters = list_filters(
        query=query,
        stage_id=stage_id,
        outcome=outcome,
        assignee_id=assignee_id,
        customer_id=customer_id,
        currency=currency,
    )
    ordering = {
        DealSort.CLOSE_DATE: "d.expected_close_date asc nulls last, d.title asc, d.id asc",
        DealSort.NEWEST: "d.created_at desc, d.id desc",
        DealSort.OLDEST: "d.created_at asc, d.id asc",
        DealSort.VALUE_HIGH: "d.value_minor desc, d.id desc",
        DealSort.TITLE: "d.title asc, d.id asc",
    }[sort]
    bind = {"organization_id": organization_id, **parameters}
    rows = (
        await session.execute(
            text(
                DEAL_SELECT
                + filters
                + f" order by {ordering} limit :limit offset :offset"
            ),
            {**bind, "limit": page_size, "offset": (page - 1) * page_size},
        )
    ).mappings()
    count_sql = DEAL_COUNT_SELECT + filters
    total = int(
        await session.scalar(
            text(count_sql),
            bind,
        )
        or 0
    )
    return DealListResponse(
        deals=[DealListItem.model_validate(dict(row)) for row in rows],
        page=page,
        page_count=max(1, (total + page_size - 1) // page_size),
        page_size=page_size,
        total=total,
    )


async def list_stages(
    session: AsyncSession, organization_id: UUID
) -> list[PipelineStageResponse]:
    stages = list(
        (
            await session.execute(
                select(PipelineStage)
                .where(PipelineStage.organization_id == organization_id)
                .order_by(PipelineStage.position, PipelineStage.id)
            )
        ).scalars()
    )
    return [PipelineStageResponse.model_validate(stage) for stage in stages]


async def get_pipeline(
    session: AsyncSession, organization_id: UUID
) -> PipelineResponse:
    stages = await list_stages(session, organization_id)
    rows = (
        await session.execute(
            text(DEAL_SELECT + " order by d.expected_close_date asc nulls last, d.title, d.id"),
            {"organization_id": organization_id},
        )
    ).mappings()
    return PipelineResponse(
        stages=stages,
        deals=[DealListItem.model_validate(dict(row)) for row in rows],
    )


async def get_deal(
    session: AsyncSession, organization_id: UUID, deal_id: UUID
) -> DealDetailResponse | None:
    row = (
        await session.execute(
            text(
                """
                select d.*, c.name as customer_name, s.name as stage_name,
                       s.kind as stage_kind, s.color as stage_color,
                       p.full_name as assignee_name
                from public.deals d
                join public.customers c
                  on c.organization_id = d.organization_id and c.id = d.customer_id
                join public.pipeline_stages s
                  on s.organization_id = d.organization_id and s.id = d.stage_id
                left join public.profiles p on p.id = d.assigned_user_id
                where d.organization_id = :organization_id and d.id = :deal_id
                """
            ),
            {"organization_id": organization_id, "deal_id": deal_id},
        )
    ).mappings().one_or_none()
    if row is None:
        return None
    activity_rows = (
        await session.execute(
            text(
                """
                select a.id, a.type, a.note, a.metadata, a.created_at,
                       p.full_name as actor_name
                from public.deal_activities a
                left join public.profiles p on p.id = a.actor_id
                where a.organization_id = :organization_id and a.deal_id = :deal_id
                order by a.created_at desc, a.id desc
                """
            ),
            {"organization_id": organization_id, "deal_id": deal_id},
        )
    ).mappings()
    return DealDetailResponse(
        **dict(row),
        activities=[DealActivityResponse.model_validate(dict(item)) for item in activity_rows],
    )


async def get_options(
    session: AsyncSession, organization_id: UUID
) -> DealOptionsResponse:
    customer_rows = (
        await session.execute(
            select(Customer.id, Customer.name, Customer.company)
            .where(Customer.organization_id == organization_id)
            .order_by(Customer.name, Customer.id)
            .limit(500)
        )
    ).all()
    member_rows = (
        await session.execute(
            text(
                """
                select m.user_id, p.full_name, m.role
                from public.organization_members m
                join public.profiles p on p.id = m.user_id
                where m.organization_id = :organization_id
                order by p.full_name nulls last, m.user_id
                limit 500
                """
            ),
            {"organization_id": organization_id},
        )
    ).mappings()
    return DealOptionsResponse(
        customers=[
            DealCustomerOption(id=row.id, name=row.name, company=row.company)
            for row in customer_rows
        ],
        stages=await list_stages(session, organization_id),
        members=[DealMemberOption.model_validate(dict(row)) for row in member_rows],
    )


async def get_sales_metrics(
    session: AsyncSession,
    organization_id: UUID,
    start: date,
    end_exclusive: date,
) -> SalesMetricsResponse:
    pipeline_rows = (
        await session.execute(
            text(
                """
                select currency, sum(value_minor)::bigint as amount_minor, count(*) as count
                from public.deals
                where organization_id = :organization_id and outcome = 'open'
                group by currency order by currency
                """
            ),
            {"organization_id": organization_id},
        )
    ).mappings()
    won_rows = (
        await session.execute(
            text(
                """
                select currency, sum(value_minor)::bigint as amount_minor, count(*) as count
                from public.deals
                where organization_id = :organization_id and outcome = 'won'
                  and closed_at >= :start and closed_at < :end_exclusive
                group by currency order by currency
                """
            ),
            {
                "organization_id": organization_id,
                "start": datetime.combine(start, datetime.min.time(), UTC),
                "end_exclusive": datetime.combine(
                    end_exclusive, datetime.min.time(), UTC
                ),
            },
        )
    ).mappings()
    stage_rows = (
        await session.execute(
            text(
                """
                select s.id as stage_id, s.name as stage_name, s.color, s.kind,
                       count(d.id) as count
                from public.pipeline_stages s
                left join public.deals d
                  on d.organization_id = s.organization_id and d.stage_id = s.id
                where s.organization_id = :organization_id
                group by s.id order by s.position
                """
            ),
            {"organization_id": organization_id},
        )
    ).mappings()
    closed_rows = (
        await session.execute(
            text(
                """
                select outcome, count(*) as count from public.deals
                where organization_id = :organization_id
                  and outcome in ('won', 'lost')
                  and closed_at >= :start and closed_at < :end_exclusive
                group by outcome
                """
            ),
            {
                "organization_id": organization_id,
                "start": datetime.combine(start, datetime.min.time(), UTC),
                "end_exclusive": datetime.combine(
                    end_exclusive, datetime.min.time(), UTC
                ),
            },
        )
    ).mappings()
    closed = {str(row["outcome"]): int(row["count"]) for row in closed_rows}
    won = closed.get("won", 0)
    lost = closed.get("lost", 0)
    return SalesMetricsResponse(
        pipeline_value=[CurrencyAggregate.model_validate(dict(row)) for row in pipeline_rows],
        won_revenue=[CurrencyAggregate.model_validate(dict(row)) for row in won_rows],
        stages=[StageAggregate.model_validate(dict(row)) for row in stage_rows],
        won_deals=won,
        lost_deals=lost,
        conversion_rate=calculate_conversion_rate(won, lost),
    )

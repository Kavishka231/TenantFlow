from datetime import UTC, date, datetime
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.billing.schemas import (
    CurrencyMetric,
    CustomerGrowthPoint,
    DashboardAnalyticsResponse,
    DashboardInsights,
    DashboardMetrics,
    FinancialPoint,
    FinancialSeries,
    InvoiceStatusMetric,
    RecentActivity,
)


def month_keys(start: date, end_exclusive: date) -> list[str]:
    keys: list[str] = []
    cursor = start.replace(day=1)
    while cursor < end_exclusive:
        keys.append(cursor.strftime("%Y-%m"))
        cursor = date(
            cursor.year + (cursor.month == 12), 1 if cursor.month == 12 else cursor.month + 1, 1
        )
    return keys


async def dashboard_analytics(
    session: AsyncSession, organization_id: UUID, start: date, end_exclusive: date
) -> DashboardAnalyticsResponse:
    bind = {"organization_id": organization_id, "start": start, "end_exclusive": end_exclusive}
    total_customers = int(
        await session.scalar(
            text("select count(*) from public.customers where organization_id=:organization_id"),
            bind,
        )
        or 0
    )
    invoice_summary = (
        (
            await session.execute(
                text("""
        select count(*) total_invoices,
          count(*) filter (where due_date < :end_exclusive and status in ('overdue','sent')
            and paid_minor < total_minor) overdue_invoices
        from public.invoices where organization_id=:organization_id
          and issue_date>=:start and issue_date<:end_exclusive
    """),
                bind,
            )
        )
        .mappings()
        .one()
    )
    paid_rows = (
        await session.execute(
            text("""
        select i.currency, sum(p.amount_minor)::bigint amount_minor
        from public.payment_records p join public.invoices i
          on i.organization_id=p.organization_id and i.id=p.invoice_id
        where p.organization_id=:organization_id and p.payment_date>=:start
          and p.payment_date<:end_exclusive group by i.currency order by i.currency
    """),
            bind,
        )
    ).mappings()
    outstanding_rows = (
        await session.execute(
            text("""
        select currency, sum(total_minor-paid_minor)::bigint amount_minor
        from public.invoices where organization_id=:organization_id
          and issue_date>=:start and issue_date<:end_exclusive and status<>'cancelled'
        group by currency order by currency
    """),
            bind,
        )
    ).mappings()
    financial_rows = (
        (
            await session.execute(
                text("""
        with values_by_month as (
          select to_char(date_trunc('month',issue_date::timestamp),'YYYY-MM') month,
                 currency, sum(total_minor)::bigint invoiced_minor, 0::bigint paid_minor
          from public.invoices where organization_id=:organization_id
            and issue_date>=:start and issue_date<:end_exclusive and status<>'cancelled'
          group by date_trunc('month',issue_date::timestamp),currency
          union all
          select to_char(date_trunc('month',p.payment_date::timestamp),'YYYY-MM'),
                 i.currency,0::bigint,sum(p.amount_minor)::bigint
          from public.payment_records p join public.invoices i
            on i.organization_id=p.organization_id and i.id=p.invoice_id
          where p.organization_id=:organization_id and p.payment_date>=:start
            and p.payment_date<:end_exclusive
          group by date_trunc('month',p.payment_date::timestamp),i.currency
        ) select month,currency,sum(invoiced_minor)::bigint invoiced_minor,
          sum(paid_minor)::bigint paid_minor from values_by_month
          group by month,currency order by currency,month
    """),
                bind,
            )
        )
        .mappings()
        .all()
    )
    start_time = datetime.combine(start, datetime.min.time(), UTC)
    end_time = datetime.combine(end_exclusive, datetime.min.time(), UTC)
    time_bind = {"organization_id": organization_id, "start_time": start_time, "end_time": end_time}
    baseline = int(
        await session.scalar(
            text("""
        select count(*) from public.customers
        where organization_id=:organization_id and created_at<:start_time
    """),
            time_bind,
        )
        or 0
    )
    growth_rows = (
        (
            await session.execute(
                text("""
        select to_char(date_trunc('month',created_at),'YYYY-MM') month,count(*) count
        from public.customers where organization_id=:organization_id
          and created_at>=:start_time and created_at<:end_time
        group by date_trunc('month',created_at) order by month
    """),
                time_bind,
            )
        )
        .mappings()
        .all()
    )
    status_rows = (
        await session.execute(
            text("""
        select case when status='sent' and due_date<:end_exclusive and paid_minor<total_minor
          then 'overdue' else status::text end status,count(*) count
        from public.invoices where organization_id=:organization_id
          and issue_date>=:start and issue_date<:end_exclusive group by 1 order by 1
    """),
            bind,
        )
    ).mappings()
    recent_rows = (
        await session.execute(
            text("""
        select * from (
          select id,'customer_created' type,'Customer added' title,
            name description,created_at occurred_at
          from public.customers where organization_id=:organization_id
          union all
          select id,'invoice_created','Invoice created',invoice_number,created_at
          from public.invoices where organization_id=:organization_id
          union all
          select p.id,'payment_recorded','Payment recorded',
            i.currency||' '||to_char(p.amount_minor/100.0,'FM9999999990.00')
              ||' · '||i.invoice_number,
            p.created_at from public.payment_records p join public.invoices i
              on i.organization_id=p.organization_id and i.id=p.invoice_id
            where p.organization_id=:organization_id
        ) activity where occurred_at>=:start_time and occurred_at<:end_time
        order by occurred_at desc limit 8
    """),
            time_bind,
        )
    ).mappings()
    months = month_keys(start, end_exclusive)
    currencies = sorted({str(row["currency"]) for row in financial_rows})
    running = baseline
    growth: list[CustomerGrowthPoint] = []
    for month in months:
        new = next((int(row["count"]) for row in growth_rows if row["month"] == month), 0)
        running += new
        growth.append(CustomerGrowthPoint(month=month, new_customers=new, total_customers=running))
    return DashboardAnalyticsResponse(
        metrics=DashboardMetrics(
            total_customers=total_customers,
            total_invoices=int(invoice_summary["total_invoices"]),
            overdue_invoices=int(invoice_summary["overdue_invoices"]),
            paid_amounts=[CurrencyMetric.model_validate(dict(row)) for row in paid_rows],
            outstanding_balances=[
                CurrencyMetric.model_validate(dict(row)) for row in outstanding_rows
            ],
        ),
        financial=[
            FinancialSeries(
                currency=currency,
                points=[
                    FinancialPoint(
                        month=month,
                        invoiced_minor=next(
                            (
                                int(row["invoiced_minor"])
                                for row in financial_rows
                                if row["currency"] == currency and row["month"] == month
                            ),
                            0,
                        ),
                        paid_minor=next(
                            (
                                int(row["paid_minor"])
                                for row in financial_rows
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
        insights=DashboardInsights(
            customer_growth=growth,
            invoice_statuses=[InvoiceStatusMetric.model_validate(dict(row)) for row in status_rows],
            recent_activity=[RecentActivity.model_validate(dict(row)) for row in recent_rows],
        ),
    )

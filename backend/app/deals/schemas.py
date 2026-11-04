from datetime import date, datetime
from enum import StrEnum
from typing import Annotated, Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, field_validator

from app.deals.models import DealActivityType, DealOutcome, PipelineStageKind

DealTitle = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)
]


class DealFields(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: DealTitle
    description: str | None = Field(default=None, max_length=5000)
    customer_id: UUID
    stage_id: UUID
    assigned_user_id: UUID | None = None
    value_minor: Annotated[int, Field(ge=0, le=1_000_000_000_000)]
    currency: Annotated[str, StringConstraints(strip_whitespace=True, pattern=r"^[A-Z]{3}$")]
    expected_close_date: date | None = None

    @field_validator("description", mode="before")
    @classmethod
    def normalize_description(cls, value: object) -> object:
        if isinstance(value, str):
            return value.strip() or None
        return value

    @field_validator("currency", mode="before")
    @classmethod
    def normalize_currency(cls, value: object) -> object:
        return value.strip().upper() if isinstance(value, str) else value


class CreateDealRequest(DealFields):
    pass


class UpdateDealRequest(DealFields):
    version: Annotated[int, Field(gt=0)]


class VersionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    version: Annotated[int, Field(gt=0)]


class TransitionDealRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    stage_id: UUID
    version: Annotated[int, Field(gt=0)]
    outcome_reason: str | None = Field(default=None, max_length=500)

    @field_validator("outcome_reason", mode="before")
    @classmethod
    def normalize_reason(cls, value: object) -> object:
        if isinstance(value, str):
            return value.strip() or None
        return value


class AddDealNoteRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    note: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=1, max_length=5000)
    ]


class PipelineStageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    organization_id: UUID
    name: str
    color: str
    position: int
    kind: PipelineStageKind
    created_at: datetime
    updated_at: datetime


class DealResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    organization_id: UUID
    customer_id: UUID
    stage_id: UUID
    assigned_user_id: UUID | None
    title: str
    description: str | None
    value_minor: int
    currency: str
    expected_close_date: date | None
    outcome: DealOutcome
    outcome_reason: str | None
    closed_at: datetime | None
    version: int
    created_at: datetime
    updated_at: datetime


class DealActivityResponse(BaseModel):
    id: UUID
    type: DealActivityType
    note: str | None
    metadata: dict[str, Any]
    created_at: datetime
    actor_name: str | None


class DealNoteCreatedResponse(BaseModel):
    id: UUID


class DealDetailResponse(DealResponse):
    customer_name: str
    stage_name: str
    stage_kind: PipelineStageKind
    stage_color: str
    assignee_name: str | None
    activities: list[DealActivityResponse]


class DealListItem(BaseModel):
    id: UUID
    title: str
    stage_id: UUID
    customer_name: str
    assignee_name: str | None
    value_minor: int
    currency: str
    expected_close_date: date | None
    outcome: DealOutcome
    version: int


class DealSort(StrEnum):
    CLOSE_DATE = "close_date"
    NEWEST = "newest"
    OLDEST = "oldest"
    VALUE_HIGH = "value_high"
    TITLE = "title"


class DealListResponse(BaseModel):
    deals: list[DealListItem]
    page: int
    page_count: int
    page_size: int
    total: int


class PipelineResponse(BaseModel):
    stages: list[PipelineStageResponse]
    deals: list[DealListItem]


class DealCustomerOption(BaseModel):
    id: UUID
    name: str
    company: str | None


class DealMemberOption(BaseModel):
    user_id: UUID
    full_name: str | None
    role: str


class DealOptionsResponse(BaseModel):
    customers: list[DealCustomerOption]
    stages: list[PipelineStageResponse]
    members: list[DealMemberOption]


class CurrencyAggregate(BaseModel):
    currency: str
    amount_minor: int
    count: int


class StageAggregate(BaseModel):
    stage_id: UUID
    stage_name: str
    color: str
    kind: PipelineStageKind
    count: int


class SalesMetricsResponse(BaseModel):
    pipeline_value: list[CurrencyAggregate]
    won_revenue: list[CurrencyAggregate]
    stages: list[StageAggregate]
    won_deals: int
    lost_deals: int
    conversion_rate: float

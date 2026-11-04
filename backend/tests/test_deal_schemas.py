from uuid import uuid4

import pytest
from pydantic import ValidationError

from app.deals.schemas import CreateDealRequest, TransitionDealRequest


def valid_deal(**overrides: object) -> CreateDealRequest:
    values: dict[str, object] = {
        "title": "Expansion opportunity",
        "description": "  Annual renewal  ",
        "customer_id": uuid4(),
        "stage_id": uuid4(),
        "assigned_user_id": None,
        "value_minor": 250_000,
        "currency": "usd",
        "expected_close_date": "2026-12-01",
    }
    values.update(overrides)
    return CreateDealRequest.model_validate(values)


def test_deal_schema_normalizes_currency_and_optional_text() -> None:
    deal = valid_deal(description="  ")
    assert deal.currency == "USD"
    assert deal.description is None
    assert deal.value_minor == 250_000


@pytest.mark.parametrize(
    "overrides",
    [
        {"title": ""},
        {"currency": "US"},
        {"value_minor": -1},
        {"value_minor": 1_000_000_000_001},
        {"unexpected": "never accepted"},
    ],
)
def test_deal_schema_rejects_invalid_business_values(
    overrides: dict[str, object],
) -> None:
    with pytest.raises(ValidationError):
        valid_deal(**overrides)


def test_transition_requires_current_version_and_tenant_stage() -> None:
    transition = TransitionDealRequest(
        stage_id=uuid4(), version=3, outcome_reason="  Customer selected us  "
    )
    assert transition.outcome_reason == "Customer selected us"
    with pytest.raises(ValidationError):
        TransitionDealRequest(stage_id=uuid4(), version=0, outcome_reason=None)

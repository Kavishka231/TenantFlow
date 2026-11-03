from datetime import date, timedelta
from uuid import uuid4

import pytest
from pydantic import ValidationError

from app.invoices.schemas import (
    CreateInvoiceRequest,
    InvoiceItemRequest,
    RecordPaymentRequest,
    calculate_totals,
)


def invoice_request(**overrides: object) -> CreateInvoiceRequest:
    values: dict[str, object] = {
        "customer_id": uuid4(),
        "currency": "usd",
        "issue_date": "2026-01-01",
        "due_date": "2026-01-31",
        "discount_minor": 100,
        "tax_rate_bps": 1000,
        "items": [{"description": "Consulting", "quantity": 2, "unit_price_minor": 1000}],
    }
    values.update(overrides)
    return CreateInvoiceRequest.model_validate(values)


def test_invoice_totals_use_integer_half_up_rounding() -> None:
    items = [InvoiceItemRequest(description="Small item", quantity=1, unit_price_minor=5)]
    assert calculate_totals(items, 0, 1000) == (5, 1, 6)
    request = invoice_request()
    assert request.currency == "USD"
    assert calculate_totals(request.items, request.discount_minor, request.tax_rate_bps) == (
        2000,
        190,
        2090,
    )


@pytest.mark.parametrize(
    "overrides",
    [
        {"due_date": "2025-12-31"},
        {"discount_minor": 2001},
        {"items": []},
        {"currency": "US"},
    ],
)
def test_invoice_validation_rejects_invalid_business_values(
    overrides: dict[str, object],
) -> None:
    with pytest.raises(ValidationError):
        invoice_request(**overrides)


def test_payment_validation_rejects_future_dates_and_unknown_fields() -> None:
    with pytest.raises(ValidationError):
        RecordPaymentRequest.model_validate(
            {
                "idempotency_key": uuid4(),
                "amount_minor": 100,
                "payment_date": date.today() + timedelta(days=1),
                "method": "cash",
                "privileged": True,
            }
        )

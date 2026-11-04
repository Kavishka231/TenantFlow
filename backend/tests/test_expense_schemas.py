from datetime import date
from uuid import UUID

import pytest
from pydantic import ValidationError

from app.expenses.models import ExpenseStatus, PaymentMethod
from app.expenses.schemas import CreateExpenseRequest, TransitionExpenseRequest

CATEGORY_ID = UUID("30000000-0000-4000-8000-000000000001")


def expense_request(**changes: object) -> CreateExpenseRequest:
    values: dict[str, object] = {
        "category_id": CATEGORY_ID,
        "amount_minor": 1250,
        "currency": "usd",
        "expense_date": date(2026, 11, 1),
        "vendor": "  Acme Cloud  ",
        "payment_method": PaymentMethod.CARD,
        "status": ExpenseStatus.PENDING,
        "paid_date": None,
        "description": "  hosting  ",
    }
    values.update(changes)
    return CreateExpenseRequest.model_validate(values)


def test_expense_request_normalizes_financial_fields() -> None:
    request = expense_request()
    assert request.currency == "USD"
    assert request.vendor == "Acme Cloud"
    assert request.description == "hosting"
    assert isinstance(request.amount_minor, int)


@pytest.mark.parametrize("status", [ExpenseStatus.PAID, ExpenseStatus.REIMBURSED])
def test_paid_states_require_payment_date(status: ExpenseStatus) -> None:
    with pytest.raises(ValidationError, match="Payment date"):
        expense_request(status=status)


def test_pending_state_rejects_payment_date() -> None:
    with pytest.raises(ValidationError, match="Payment date"):
        expense_request(paid_date=date(2026, 11, 1))


def test_transition_rejects_unknown_fields() -> None:
    with pytest.raises(ValidationError):
        TransitionExpenseRequest.model_validate(
            {
                "version": 1,
                "status": "pending",
                "paid_date": None,
                "organization_id": str(CATEGORY_ID),
            }
        )

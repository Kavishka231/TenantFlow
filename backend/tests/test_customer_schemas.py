import pytest
from pydantic import ValidationError

from app.customers.models import CustomerStatus
from app.customers.schemas import CreateCustomerRequest, UpdateCustomerRequest


def test_customer_input_normalizes_optional_values() -> None:
    request = CreateCustomerRequest(
        name="  Acme Contact  ",
        email="  PERSON@EXAMPLE.COM ",
        phone="  +1 555 0100  ",
        company="   ",
        status=CustomerStatus.ACTIVE,
    )

    assert request.name == "Acme Contact"
    assert request.email == "person@example.com"
    assert request.phone == "+1 555 0100"
    assert request.company is None


@pytest.mark.parametrize("field", ["email", "phone"])
def test_customer_input_rejects_invalid_contact_fields(field: str) -> None:
    values = {"name": "Customer", field: "invalid value"}
    with pytest.raises(ValidationError):
        CreateCustomerRequest.model_validate(values)


def test_customer_update_requires_positive_version() -> None:
    with pytest.raises(ValidationError):
        UpdateCustomerRequest(name="Customer", version=0)

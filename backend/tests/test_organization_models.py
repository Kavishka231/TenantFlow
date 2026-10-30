import pytest
from pydantic import ValidationError

from app.organizations.models import (
    CreateOrganizationRequest,
    UpdateOrganizationRequest,
)


def test_create_organization_normalizes_name_and_slug() -> None:
    request = CreateOrganizationRequest(name="  Acme Labs  ", slug="  acme-labs  ")

    assert request.name == "Acme Labs"
    assert request.slug == "acme-labs"


@pytest.mark.parametrize("slug", ["Uppercase", "two words", "-leading", "trailing-"])
def test_create_organization_rejects_invalid_slug(slug: str) -> None:
    with pytest.raises(ValidationError):
        CreateOrganizationRequest(name="Acme Labs", slug=slug)


def test_organization_requests_reject_unknown_fields() -> None:
    with pytest.raises(ValidationError):
        UpdateOrganizationRequest.model_validate({"name": "Acme", "role": "owner"})

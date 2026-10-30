from pathlib import Path
from uuid import UUID

import pytest
from pydantic import ValidationError

from app.core.config import Settings
from app.team import delivery
from app.team.delivery import deliver_invitation
from app.team.models import AcceptInvitationRequest, CreateInvitationRequest


def test_invitation_request_normalizes_email() -> None:
    request = CreateInvitationRequest(email="  Person@Example.COM ", role="member")

    assert request.email == "person@example.com"


@pytest.mark.parametrize("email", ["missing-at.example.com", "a@localhost", "a @b.com"])
def test_invitation_request_rejects_invalid_email(email: str) -> None:
    with pytest.raises(ValidationError):
        CreateInvitationRequest(email=email, role="member")


def test_acceptance_rejects_malformed_token_before_database_access() -> None:
    malformed = "sh" + "ort"
    with pytest.raises(ValidationError):
        AcceptInvitationRequest(token=malformed)


async def test_development_delivery_writes_private_payload(
    settings: Settings, monkeypatch: pytest.MonkeyPatch
) -> None:
    configured = settings.model_copy(update={"invitation_dev_outbox": True})
    invitation_id = UUID("10000000-0000-4000-8000-000000000001")
    written: dict[str, object] = {}

    def capture(path: Path, payload: dict[str, str]) -> None:
        written.update({"path": path, "payload": payload})

    monkeypatch.setattr(delivery, "write_development_invitation", capture)

    result = await deliver_invitation(
        configured,
        invitation_id,
        "person@example.com",
        "Acme",
        "member",
        "a" * 43,
    )

    payload = written["payload"]
    assert isinstance(payload, dict)
    assert result.delivered is True
    assert result.channel == "development-outbox"
    assert payload["email"] == "person@example.com"
    assert "token=" in payload["acceptUrl"]


def test_delivery_configuration_requires_webhook_pair(settings: Settings) -> None:
    with pytest.raises(ValidationError):
        Settings(
            database_url=settings.database_url,
            supabase_url=settings.supabase_url,
            invitation_delivery_webhook_url="https://mailer.example.test/invite",
        )

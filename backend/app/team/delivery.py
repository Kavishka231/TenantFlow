import asyncio
import json
from pathlib import Path
from urllib.parse import urlencode
from uuid import UUID

import httpx

from app.core.config import Settings
from app.team.models import InvitationDeliveryStatus


def write_development_invitation(path: Path, payload: dict[str, str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("x", encoding="utf-8") as invitation_file:
        invitation_file.write(json.dumps(payload, indent=2))


async def deliver_invitation(
    settings: Settings,
    invitation_id: UUID,
    email: str,
    organization_name: str,
    role: str,
    token: str,
) -> InvitationDeliveryStatus:
    accept_url = (
        f"{str(settings.frontend_app_url).rstrip('/')}/invitations/accept?"
        f"{urlencode({'token': token})}"
    )
    payload = {
        "acceptUrl": accept_url,
        "email": email,
        "organizationName": organization_name,
        "role": role,
    }

    if settings.invitation_delivery_webhook_url:
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                response = await client.post(
                    str(settings.invitation_delivery_webhook_url),
                    headers={
                        "Authorization": (
                            f"Bearer {settings.invitation_delivery_webhook_secret}"
                        )
                    },
                    json=payload,
                )
                response.raise_for_status()
            return InvitationDeliveryStatus(channel="webhook", delivered=True)
        except httpx.HTTPError:
            return InvitationDeliveryStatus(channel="delivery-error", delivered=False)

    if settings.invitation_dev_outbox:
        path = Path(".tenantflow-dev/invitations") / f"{invitation_id}.json"
        try:
            await asyncio.to_thread(write_development_invitation, path, payload)
            return InvitationDeliveryStatus(
                channel="development-outbox", delivered=True
            )
        except OSError:
            return InvitationDeliveryStatus(channel="delivery-error", delivered=False)

    return InvitationDeliveryStatus(channel="unconfigured", delivered=False)

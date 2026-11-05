import hashlib
import hmac
from typing import Any

import pytest
from pydantic import ValidationError

from app.billing.webhook import StripeSubscriptionEvent, verify_signature


def signature(payload: bytes, secret: str, timestamp: int) -> str:
    digest = hmac.new(
        secret.encode(), str(timestamp).encode() + b"." + payload, hashlib.sha256
    ).hexdigest()
    return f"t={timestamp},v1={digest}"


def test_signature_covers_exact_raw_request_bytes() -> None:
    payload = rb'{"id":"evt_123","value":"caf\u00e9"}'
    secret, now = "whsec_test", 1_800_000_000
    header = signature(payload, secret, now)
    assert verify_signature(payload, header, secret, now=now)
    assert not verify_signature(payload.replace(b"caf", b"CAF"), header, secret, now=now)
    assert not verify_signature(payload, header, secret, now=now + 301)


def test_event_schema_rejects_live_mode_and_invalid_identifiers() -> None:
    event: dict[str, Any] = {
        "id": "evt_123",
        "type": "customer.subscription.updated",
        "created": 1,
        "livemode": False,
        "data": {
            "object": {
                "id": "sub_123",
                "customer": "cus_123",
                "status": "active",
                "metadata": {"tenantflowOrganizationId": "10000000-0000-4000-8000-000000000001"},
                "items": {"data": [{"price": {"id": "price_123"}}]},
            }
        },
    }
    assert StripeSubscriptionEvent.model_validate(event).livemode is False
    with pytest.raises(ValidationError):
        StripeSubscriptionEvent.model_validate({**event, "livemode": True})
    event["data"]["object"]["customer"] = "customer_unsafe"
    with pytest.raises(ValidationError):
        StripeSubscriptionEvent.model_validate(event)

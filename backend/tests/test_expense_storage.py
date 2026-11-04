from uuid import UUID

import pytest

from app.expenses.storage import MAX_RECEIPT_BYTES, safe_object_path, validate_receipt


def test_receipt_path_contains_only_server_controlled_identifiers() -> None:
    organization_id = UUID("10000000-0000-4000-8000-000000000001")
    expense_id = UUID("70000000-0000-4000-8000-000000000001")
    object_id = UUID("80000000-0000-4000-8000-000000000001")
    assert safe_object_path(str(organization_id), str(expense_id), str(object_id), "image/png") == (
        f"{organization_id}/{expense_id}/{object_id}.png"
    )


@pytest.mark.parametrize("mime_type", ["text/html", "image/svg+xml", "application/octet-stream"])
def test_receipt_validation_rejects_active_or_unknown_content(mime_type: str) -> None:
    with pytest.raises(ValueError, match="PDF"):
        validate_receipt("receipt.svg", mime_type, b"payload")


def test_receipt_validation_enforces_five_megabyte_limit() -> None:
    with pytest.raises(ValueError, match="5 MB"):
        validate_receipt("receipt.pdf", "application/pdf", b"x" * (MAX_RECEIPT_BYTES + 1))


def test_receipt_validation_rejects_header_injection() -> None:
    with pytest.raises(ValueError, match="safe"):
        validate_receipt("receipt.pdf\r\nX-Forged: true", "application/pdf", b"pdf")

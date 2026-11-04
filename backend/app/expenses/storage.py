from urllib.parse import quote

import httpx

from app.core.config import Settings

BUCKET = "expense-receipts"
MAX_RECEIPT_BYTES = 5 * 1024 * 1024
ALLOWED_RECEIPT_TYPES = {
    "application/pdf": "pdf",
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
}


class ReceiptStorageError(Exception):
    pass


def safe_object_path(organization_id: str, expense_id: str, object_id: str, mime_type: str) -> str:
    extension = ALLOWED_RECEIPT_TYPES.get(mime_type)
    if extension is None:
        raise ValueError("Upload a PDF, JPEG, PNG, or WebP receipt.")
    return f"{organization_id}/{expense_id}/{object_id}.{extension}"


def validate_receipt(name: str, mime_type: str, content: bytes) -> str:
    cleaned = name.strip()
    if not cleaned or len(cleaned) > 255 or any(character in cleaned for character in "\r\n\0"):
        raise ValueError("Receipt filenames must contain at most 255 safe characters.")
    if mime_type not in ALLOWED_RECEIPT_TYPES:
        raise ValueError("Upload a PDF, JPEG, PNG, or WebP receipt.")
    if not content or len(content) > MAX_RECEIPT_BYTES:
        raise ValueError("Receipts must be between 1 byte and 5 MB.")
    return cleaned


class ReceiptStorage:
    def __init__(self, settings: Settings, access_token: str) -> None:
        if not settings.supabase_publishable_key:
            raise ReceiptStorageError("Supabase Storage is not configured.")
        self.base_url = f"{str(settings.supabase_url).rstrip('/')}/storage/v1"
        self.headers = {
            "Authorization": f"Bearer {access_token}",
            "apikey": settings.supabase_publishable_key,
        }

    @staticmethod
    def _encoded(path: str) -> str:
        return "/".join(quote(segment, safe="") for segment in path.split("/"))

    async def upload(self, path: str, content: bytes, mime_type: str) -> None:
        headers = {**self.headers, "Content-Type": mime_type, "x-upsert": "false"}
        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.post(
                f"{self.base_url}/object/{BUCKET}/{self._encoded(path)}",
                headers=headers,
                content=content,
            )
        if response.status_code not in {200, 201}:
            raise ReceiptStorageError("The private receipt upload failed.")

    async def delete(self, path: str) -> None:
        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.delete(
                f"{self.base_url}/object/{BUCKET}/{self._encoded(path)}", headers=self.headers
            )
        if response.status_code not in {200, 204, 404}:
            raise ReceiptStorageError("The private receipt deletion failed.")

    async def signed_url(self, path: str, *, expires_in: int = 60) -> str:
        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.post(
                f"{self.base_url}/object/sign/{BUCKET}/{self._encoded(path)}",
                headers={**self.headers, "Content-Type": "application/json"},
                json={"expiresIn": expires_in},
            )
        if response.status_code != 200:
            raise ReceiptStorageError("The private receipt download could not be signed.")
        value = response.json().get("signedURL") or response.json().get("signedUrl")
        if not isinstance(value, str) or not value.startswith("/"):
            raise ReceiptStorageError("Supabase returned an invalid signed receipt URL.")
        return f"{str(self.base_url).split('/storage/v1', 1)[0]}{value}"

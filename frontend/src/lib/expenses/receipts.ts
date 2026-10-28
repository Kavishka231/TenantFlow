const receiptTypes = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

export const EXPENSE_RECEIPT_BUCKET = "expense-receipts";
export const MAX_RECEIPT_BYTES = 5 * 1024 * 1024;

export function validateReceiptFile(value: FormDataEntryValue | null) {
  if (!(value instanceof File) || value.size === 0) return { error: "Choose a receipt file." } as const;
  if (value.size > MAX_RECEIPT_BYTES) return { error: "Receipts must be 5 MB or smaller." } as const;
  const extension = receiptTypes[value.type as keyof typeof receiptTypes];
  if (!extension) return { error: "Upload a PDF, JPEG, PNG, or WebP receipt." } as const;
  const name = value.name.trim();
  if (!name || name.length > 255) return { error: "Receipt filenames must contain at most 255 characters." } as const;
  return { extension, file: value, name } as const;
}

export function receiptObjectPath(organizationId: string, expenseId: string, objectId: string, extension: string) {
  return `${organizationId}/${expenseId}/${objectId}.${extension}`;
}

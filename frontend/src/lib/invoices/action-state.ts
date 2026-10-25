export type InvoiceActionState = {
  message?: string;
  status: "idle" | "error";
};

export const initialInvoiceActionState: InvoiceActionState = { status: "idle" };

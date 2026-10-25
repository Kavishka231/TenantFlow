import { z } from "zod";

export const invoiceListQuerySchema = z.object({
  page: z.coerce.number().int().positive().catch(1),
  pageSize: z.coerce.number().pipe(z.union([z.literal(10), z.literal(25), z.literal(50)])).catch(10),
  q: z.string().trim().max(100).catch(""),
  sort: z.enum(["newest", "oldest", "due_soon", "amount_high"]).catch("newest"),
  status: z.enum(["all", "draft", "sent", "partially_paid", "paid", "overdue", "cancelled"]).catch("all"),
});

export type InvoiceListQuery = z.infer<typeof invoiceListQuerySchema>;

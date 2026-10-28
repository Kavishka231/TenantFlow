import { z } from "zod";

export const expenseSortOptions = ["newest", "oldest", "amount_desc", "amount_asc", "vendor_asc", "vendor_desc"] as const;

export const expenseListQuerySchema = z.object({
  categoryId: z.union([z.literal("all"), z.uuid()]).catch("all").default("all"),
  page: z.coerce.number().int().positive().catch(1).default(1),
  pageSize: z.coerce.number().int().refine((value) => [10, 25, 50].includes(value)).catch(10).default(10),
  paymentMethod: z.enum(["all", "cash", "bank_transfer", "card", "check", "other"]).catch("all").default("all"),
  q: z.preprocess((value) => typeof value === "string" ? value.trim() : value, z.string().max(100).catch("").default("")),
  sort: z.enum(expenseSortOptions).catch("newest").default("newest"),
  status: z.enum(["all", "pending", "paid", "reimbursed", "cancelled"]).catch("all").default("all"),
});

export type ExpenseListQuery = z.infer<typeof expenseListQuerySchema>;
export function expenseListOffset(query: ExpenseListQuery) { return (query.page - 1) * query.pageSize; }

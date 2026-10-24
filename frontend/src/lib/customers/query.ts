import { z } from "zod";

export const customerSortOptions = [
  "name_asc",
  "name_desc",
  "newest",
  "oldest",
  "recently_updated",
] as const;

export const customerListQuerySchema = z.object({
  page: z.coerce.number().int().positive().catch(1).default(1),
  pageSize: z.coerce
    .number()
    .int()
    .refine((value) => [10, 25, 50].includes(value))
    .catch(10)
    .default(10),
  q: z.preprocess(
    (value) => (typeof value === "string" ? value.trim() : value),
    z.string().max(100).catch("").default(""),
  ),
  sort: z.enum(customerSortOptions).catch("name_asc").default("name_asc"),
  status: z
    .enum(["all", "lead", "active", "inactive"])
    .catch("all")
    .default("all"),
});

export type CustomerListQuery = z.infer<typeof customerListQuerySchema>;

export function customerListOffset(query: CustomerListQuery) {
  return (query.page - 1) * query.pageSize;
}

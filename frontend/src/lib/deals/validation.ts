import { z } from "zod";

const optionalText = (max: number) => z.preprocess(
  value => typeof value === "string" && value.trim() === "" ? null : value,
  z.string().trim().max(max).nullable(),
);
const optionalUuid = z.preprocess(value => value === "" ? null : value, z.uuid().nullable());

export const dealFieldsSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: optionalText(5000),
  customerId: z.uuid(),
  stageId: z.uuid(),
  assignedUserId: optionalUuid,
  valueMinor: z.number().int().min(0).max(1_000_000_000_000),
  currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/),
  expectedCloseDate: z.preprocess(value => value === "" ? null : value, z.iso.date().nullable()),
});

export const createDealSchema = dealFieldsSchema.extend({ organizationId: z.uuid() });
export const updateDealSchema = dealFieldsSchema.extend({ organizationId: z.uuid(), dealId: z.uuid(), version: z.coerce.number().int().positive() });
export const deleteDealSchema = z.object({ organizationId: z.uuid(), dealId: z.uuid(), version: z.coerce.number().int().positive() });
export const transitionDealSchema = z.object({ organizationId: z.uuid(), dealId: z.uuid(), stageId: z.uuid(), version: z.coerce.number().int().positive(), outcomeReason: optionalText(500) });
export const addDealNoteSchema = z.object({ organizationId: z.uuid(), dealId: z.uuid(), note: z.string().trim().min(1).max(5000) });

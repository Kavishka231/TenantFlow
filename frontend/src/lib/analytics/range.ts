import { z } from "zod";

export const analyticsPresetSchema = z.enum(["30d", "90d", "6m", "12m", "custom"]);
export type AnalyticsPreset = z.infer<typeof analyticsPresetSchema>;

const dateSchema = z.iso.date();

function utcDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function isoDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

export type AnalyticsRange = {
  start: string;
  end: string;
  endExclusive: string;
  preset: AnalyticsPreset;
};

export function resolveAnalyticsRange(
  input: { preset?: unknown; start?: unknown; end?: unknown },
  today = new Date(),
): AnalyticsRange {
  const preset = analyticsPresetSchema.catch("6m").parse(input.preset);
  const end = isoDate(today);
  if (preset === "custom") {
    const parsed = z.object({ start: dateSchema, end: dateSchema }).safeParse(input);
    if (parsed.success) {
      const startDate = utcDate(parsed.data.start);
      const endDate = utcDate(parsed.data.end);
      const days = Math.floor((endDate.getTime() - startDate.getTime()) / 86_400_000);
      if (days >= 0 && days <= 366) {
        endDate.setUTCDate(endDate.getUTCDate() + 1);
        return { start: parsed.data.start, end: parsed.data.end, endExclusive: isoDate(endDate), preset };
      }
    }
  }

  const startDate = utcDate(end);
  if (preset === "30d") startDate.setUTCDate(startDate.getUTCDate() - 29);
  else if (preset === "90d") startDate.setUTCDate(startDate.getUTCDate() - 89);
  else if (preset === "12m") startDate.setUTCMonth(startDate.getUTCMonth() - 11, 1);
  else startDate.setUTCMonth(startDate.getUTCMonth() - 5, 1);
  const endExclusiveDate = utcDate(end);
  endExclusiveDate.setUTCDate(endExclusiveDate.getUTCDate() + 1);
  return { start: isoDate(startDate), end, endExclusive: isoDate(endExclusiveDate), preset: preset === "custom" ? "6m" : preset };
}

import { describe, expect, it } from "vitest";

import { resolveAnalyticsRange } from "./range";

describe("analytics date ranges", () => {
  const today = new Date("2026-10-26T12:00:00.000Z");

  it("uses a six-month calendar range by default", () => {
    expect(resolveAnalyticsRange({}, today)).toEqual({
      start: "2026-05-01", end: "2026-10-26", endExclusive: "2026-10-27", preset: "6m",
    });
  });

  it("accepts bounded inclusive custom ranges", () => {
    expect(resolveAnalyticsRange({ preset: "custom", start: "2026-10-01", end: "2026-10-26" }, today)).toEqual({
      start: "2026-10-01", end: "2026-10-26", endExclusive: "2026-10-27", preset: "custom",
    });
  });

  it("falls back safely for reversed or oversized custom ranges", () => {
    expect(resolveAnalyticsRange({ preset: "custom", start: "2026-10-27", end: "2026-10-01" }, today).preset).toBe("6m");
    expect(resolveAnalyticsRange({ preset: "custom", start: "2020-01-01", end: "2026-10-01" }, today).preset).toBe("6m");
  });
});

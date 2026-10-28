import { describe, expect, it } from "vitest";

import { calculateConversionRate } from "./metrics-model";

describe("sales conversion metrics", () => {
  it("uses only closed outcomes", () => {
    expect(calculateConversionRate(3, 1)).toBe(75);
    expect(calculateConversionRate(1, 2)).toBe(33.3);
  });

  it("returns zero when there are no closed deals", () => {
    expect(calculateConversionRate(0, 0)).toBe(0);
  });
});

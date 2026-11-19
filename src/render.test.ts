import { describe, expect, it } from "vitest";
import { sameRegion } from "./render";

describe("sameRegion", () => {
  it("compares by position and size, not identity", () => {
    const region = { x: 1, y: 2, width: 3, height: 4 };
    expect(sameRegion(region, { ...region })).toBe(true);
    expect(sameRegion(region, { ...region, width: 5 })).toBe(false);
  });
});

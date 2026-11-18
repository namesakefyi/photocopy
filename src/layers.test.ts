import { describe, expect, it } from "vitest";
import { nextRevision } from "./layers";

describe("nextRevision", () => {
  it("never repeats", () => {
    const seen = new Set(Array.from({ length: 100 }, nextRevision));
    expect(seen.size).toBe(100);
  });
});

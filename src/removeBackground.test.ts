import { describe, expect, it } from "vitest";
import { overallProgress } from "./removeBackground";

function track() {
  const reports: [string, number][] = [];
  const progress = overallProgress((label, fraction) =>
    reports.push([label, fraction]),
  );
  const last = () => reports.at(-1);
  return { progress, last };
}

describe("overallProgress", () => {
  it("starts at zero while loading", () => {
    const { progress, last } = track();
    progress.loading();
    expect(last()).toEqual(["Loading", 0]);
  });

  it("combines every file's download into one stretch of the bar", () => {
    const { progress, last } = track();
    progress.library("fetch:/model", 0, 100);
    progress.library("fetch:/wasm", 0, 100);
    progress.library("fetch:/model", 50, 100);
    // Half of the bytes so far: halfway through downloading.
    expect(last()?.[0]).toBe("Downloading model");
    expect(last()?.[1]).toBeCloseTo(0.05 + 0.25 * 0.55);
    progress.library("fetch:/wasm", 100, 100);
    progress.library("fetch:/model", 100, 100);
    expect(last()?.[1]).toBeCloseTo(0.6);
  });

  it("never moves backward when a new file joins the total", () => {
    const { progress, last } = track();
    progress.library("fetch:/model", 100, 100);
    const before = last()?.[1] ?? 0;
    progress.library("fetch:/wasm", 0, 1000);
    expect(last()?.[1]).toBe(before);
  });

  it("gives inference most of the cutting out", () => {
    const { progress, last } = track();
    progress.library("compute:inference", 1, 4);
    expect(last()).toEqual(["Cutting out", expect.closeTo(0.64)]);
    progress.library("compute:mask", 2, 4);
    expect(last()?.[1]).toBeCloseTo(0.94);
    progress.library("compute:encode", 4, 4);
    expect(last()?.[1]).toBe(1);
  });
});

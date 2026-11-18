import { describe, expect, it } from "vitest";
import {
  containsRegion,
  expandRegion,
  layerBounds,
  nextPreviewRegion,
  sameRegion,
  unionRegion,
} from "./render";
import type { Layer } from "./types";

/** Only the fields layerBounds reads; the canvases don't matter here. */
function layer(changes: Partial<Layer>): Layer {
  return {
    x: 0,
    y: 0,
    width: 100,
    height: 50,
    scale: 1,
    rotation: 0,
    visible: true,
    ...changes,
  } as Layer;
}

describe("layerBounds", () => {
  it("frames a photo around its center", () => {
    expect(layerBounds([layer({ x: 200, y: 100 })])).toEqual({
      x: 150,
      y: 75,
      width: 100,
      height: 50,
    });
  });

  it("accounts for scale and rotation", () => {
    const [bounds] = [layerBounds([layer({ scale: 2, rotation: 90 })])];
    // Rotated a quarter turn, the 200×100 photo stands 100 wide and 200 tall.
    expect(bounds?.width).toBe(100);
    expect(bounds?.height).toBe(200);
  });

  it("covers every visible photo and skips hidden ones", () => {
    const bounds = layerBounds([
      layer({ x: 0, y: 0 }),
      layer({ x: 1000, y: 500 }),
      layer({ x: 5000, y: 5000, visible: false }),
    ]);
    expect(bounds).toEqual({ x: -50, y: -25, width: 1100, height: 550 });
  });

  it("is null with nothing visible", () => {
    expect(layerBounds([])).toBeNull();
    expect(layerBounds([layer({ visible: false })])).toBeNull();
  });

  it("snaps outward to whole pixels", () => {
    const bounds = layerBounds([
      layer({ x: 10.4, y: 10.4, width: 3, height: 3 }),
    ]);
    expect(bounds).toEqual({ x: 8, y: 8, width: 4, height: 4 });
  });
});

describe("unionRegion", () => {
  it("holds both regions", () => {
    expect(
      unionRegion(
        { x: 0, y: 0, width: 10, height: 10 },
        { x: 20, y: -5, width: 10, height: 10 },
      ),
    ).toEqual({ x: 0, y: -5, width: 30, height: 15 });
  });
});

describe("expandRegion", () => {
  it("grows by a fraction of the size on every side", () => {
    expect(
      expandRegion({ x: 100, y: 100, width: 200, height: 100 }, 0.25),
    ).toEqual({ x: 50, y: 75, width: 300, height: 150 });
  });
});

describe("containsRegion", () => {
  const outer = { x: 0, y: 0, width: 100, height: 100 };

  it("counts a region inside, or exactly matching, as covered", () => {
    expect(containsRegion(outer, { x: 10, y: 10, width: 50, height: 50 })).toBe(
      true,
    );
    expect(containsRegion(outer, outer)).toBe(true);
  });

  it("doesn't count a region poking out of any side", () => {
    for (const inner of [
      { x: -1, y: 10, width: 50, height: 50 },
      { x: 10, y: -1, width: 50, height: 50 },
      { x: 60, y: 10, width: 50, height: 50 },
      { x: 10, y: 60, width: 50, height: 50 },
    ]) {
      expect(containsRegion(outer, inner)).toBe(false);
    }
  });
});

describe("nextPreviewRegion", () => {
  const view = { x: 0, y: 0, width: 100, height: 100 };

  it("starts with the view plus a margin", () => {
    expect(nextPreviewRegion(null, view, 0.25, 3)).toEqual({
      x: -25,
      y: -25,
      width: 150,
      height: 150,
    });
  });

  it("keeps the current region through small pans", () => {
    const current = nextPreviewRegion(null, view, 0.25, 3);
    const panned = { ...view, x: 20 };
    expect(nextPreviewRegion(current, panned, 0.25, 3)).toBe(current);
  });

  it("moves once the view pans past it", () => {
    const current = nextPreviewRegion(null, view, 0.25, 3);
    const panned = { ...view, x: 60 };
    expect(nextPreviewRegion(current, panned, 0.25, 3)).toEqual({
      x: 35,
      y: -25,
      width: 150,
      height: 150,
    });
  });

  it("shrinks once the view zooms far in", () => {
    const current = nextPreviewRegion(null, view, 0.25, 3);
    const zoomedIn = { x: 40, y: 40, width: 20, height: 20 };
    expect(nextPreviewRegion(current, zoomedIn, 0.25, 3)).toEqual(
      expandRegion(zoomedIn, 0.25),
    );
  });
});

describe("sameRegion", () => {
  it("compares by position and size, not identity", () => {
    const region = { x: 1, y: 2, width: 3, height: 4 };
    expect(sameRegion(region, { ...region })).toBe(true);
    expect(sameRegion(region, { ...region, width: 5 })).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import {
  clampPoint,
  clampZoom,
  FIT_VIEWPORT,
  MAX_ZOOM,
  MIN_ZOOM,
  moveViewport,
  resolutionStep,
  resolveViewport,
  wheelZoomFactor,
  zoomAround,
  zoomStep,
  zoomViewport,
} from "./zoom";

describe("zoomStep", () => {
  it("moves from a fitted zoom to the neighboring levels", () => {
    expect(zoomStep(0.21, 1)).toBe(0.25);
    expect(zoomStep(0.21, -1)).toBe(0.167);
  });

  it("moves one level from an exact level", () => {
    expect(zoomStep(1, 1)).toBe(1.5);
    expect(zoomStep(1, -1)).toBe(0.667);
  });

  it("stops at the ends", () => {
    expect(zoomStep(MAX_ZOOM, 1)).toBe(MAX_ZOOM);
    expect(zoomStep(MIN_ZOOM, -1)).toBe(MIN_ZOOM);
  });

  it("never zooms the wrong way from outside the levels", () => {
    // A tiny canvas fits far above the top level, a huge one below the bottom.
    expect(zoomStep(14, 1)).toBe(14);
    expect(zoomStep(14, -1)).toBe(MAX_ZOOM);
    expect(zoomStep(0.035, -1)).toBe(0.035);
    expect(zoomStep(0.035, 1)).toBe(MIN_ZOOM);
  });
});

describe("clampZoom", () => {
  it("keeps zooms within the levels", () => {
    expect(clampZoom(20, 1)).toBe(MAX_ZOOM);
    expect(clampZoom(0.001, 1)).toBe(MIN_ZOOM);
  });

  it("doesn't pull a zoom outside the levels back toward them", () => {
    expect(clampZoom(15, 14)).toBe(14);
    expect(clampZoom(13, 14)).toBe(13);
    expect(clampZoom(0.03, 0.035)).toBe(0.035);
  });
});

describe("wheelZoomFactor", () => {
  it("zooms a mouse notch by a modest fixed step", () => {
    expect(wheelZoomFactor(100)).toBeCloseTo(wheelZoomFactor(400));
    expect(wheelZoomFactor(-100)).toBeGreaterThan(1.2);
    expect(wheelZoomFactor(-100)).toBeLessThan(1.35);
  });

  it("passes small pinch steps through", () => {
    expect(wheelZoomFactor(-4)).toBeCloseTo(Math.exp(0.04));
  });
});

describe("zoomAround", () => {
  it("keeps the point under the pointer in place", () => {
    const center = { x: 500, y: 400 };
    const pointer = { x: 120, y: -80 };
    const next = zoomAround(center, pointer, 0.5, 2);
    // The artboard point under the pointer, before and after.
    expect(center.x + pointer.x / 0.5).toBeCloseTo(next.x + pointer.x / 2);
    expect(center.y + pointer.y / 0.5).toBeCloseTo(next.y + pointer.y / 2);
  });
});

describe("clampPoint", () => {
  const region = { x: 0, y: 0, width: 100, height: 50 };

  it("leaves points inside alone", () => {
    expect(clampPoint({ x: 30, y: 20 }, region)).toEqual({ x: 30, y: 20 });
  });

  it("pulls points outside to the nearest edge", () => {
    expect(clampPoint({ x: -10, y: 80 }, region)).toEqual({ x: 0, y: 50 });
    expect(clampPoint({ x: 500, y: -5 }, region)).toEqual({ x: 100, y: 0 });
  });
});

describe("resolutionStep", () => {
  it("rounds up to the next power of √2", () => {
    expect(resolutionStep(0.5)).toBeCloseTo(0.5);
    expect(resolutionStep(0.4)).toBeCloseTo(0.5);
    expect(resolutionStep(0.3)).toBeCloseTo(Math.SQRT2 / 4);
  });

  it("never goes above 1", () => {
    expect(resolutionStep(1)).toBe(1);
    expect(resolutionStep(3)).toBe(1);
  });

  it("treats a missing or zero scale as full resolution", () => {
    expect(resolutionStep(0)).toBe(1);
    expect(resolutionStep(Number.NaN)).toBe(1);
  });
});

describe("viewport", () => {
  const frame = {
    view: { width: 1096, height: 696 },
    artboard: { width: 2000, height: 1000 },
  };

  it("fits the artboard inside the padded view, centered", () => {
    expect(resolveViewport(FIT_VIEWPORT, frame)).toEqual({
      scale: 0.5,
      center: { x: 1000, y: 500 },
    });
  });

  it("zooms from the fitted view to the next level, then back to fit", () => {
    const zoomed = zoomViewport(FIT_VIEWPORT, "zoomIn", frame);
    expect(zoomed).toEqual({ zoom: 0.667, center: { x: 1000, y: 500 } });
    expect(zoomViewport(zoomed, "zoomFit", frame)).toBe(FIT_VIEWPORT);
  });

  it("keeps the point under the pointer still while zooming", () => {
    const pointer = { x: 148, y: 98 };
    const next = moveViewport(
      FIT_VIEWPORT,
      { pointer, factor: 2, pan: { x: 0, y: 0 } },
      frame,
    );
    // The artboard point (200, 0) stays under the pointer: 400 × 250 from the middle.
    expect(next).toEqual({ zoom: 1, center: { x: 600, y: 250 } });
  });

  it("stops panning once the view's middle reaches the artboard's edge", () => {
    const next = moveViewport(
      FIT_VIEWPORT,
      { pointer: { x: 0, y: 0 }, factor: 1, pan: { x: -10000, y: 10000 } },
      frame,
    );
    expect(next.center).toEqual({ x: 0, y: 1000 });
  });
});

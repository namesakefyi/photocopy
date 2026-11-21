import type { Region } from "./types";

export type ZoomAction =
  | "zoomIn"
  | "zoomOut"
  | "zoomActual"
  | "zoomDouble"
  | "zoomFit";

export interface Point {
  x: number;
  y: number;
}

/** A null zoom fits the artboard; a null center is the artboard's center. */
export interface Viewport {
  zoom: number | null;
  center: Point | null;
}

export const FIT_VIEWPORT: Viewport = { zoom: null, center: null };

/** 1 is one artboard pixel per screen pixel. */
export const ZOOM_LEVELS = [
  0.05, 0.1, 0.125, 0.167, 0.25, 0.333, 0.5, 0.667, 1, 1.5, 2, 3, 4, 6, 8,
];
export const MIN_ZOOM = ZOOM_LEVELS[0];
export const MAX_ZOOM = ZOOM_LEVELS[ZOOM_LEVELS.length - 1];
const EPSILON = 0.001;

/** Clamps to the levels' range, but never pulls an already out-of-range zoom further away. */
export function clampZoom(zoom: number, current: number) {
  const min = Math.min(MIN_ZOOM, current);
  const max = Math.max(MAX_ZOOM, current);
  return Math.min(max, Math.max(min, zoom));
}

/** The next level in `direction`, or `zoom` itself past the last one. */
export function zoomStep(zoom: number, direction: 1 | -1) {
  if (direction === 1) {
    return ZOOM_LEVELS.find((level) => level > zoom + EPSILON) ?? zoom;
  }
  const below = ZOOM_LEVELS.filter((level) => level < zoom - EPSILON);
  return below.at(-1) ?? zoom;
}

/** Mouse wheels report big notches (around 100px); trackpad pinches, small steps. */
const NOTCH = 50;
const NOTCH_AMOUNT = 25;
const WHEEL_ZOOM_SPEED = 0.01;

/** How much one ctrl-scroll or pinch event zooms: about 1.28× per mouse notch. */
export function wheelZoomFactor(deltaY: number) {
  const amount =
    Math.abs(deltaY) >= NOTCH ? Math.sign(deltaY) * NOTCH_AMOUNT : deltaY;
  return Math.exp(-amount * WHEEL_ZOOM_SPEED);
}

/** The center that keeps the point under `pointer` (screen pixels from the middle) fixed. */
export function zoomAround(
  center: Point,
  pointer: Point,
  scale: number,
  next: number,
): Point {
  return {
    x: center.x + pointer.x / scale - pointer.x / next,
    y: center.y + pointer.y / scale - pointer.y / next,
  };
}

export function clampPoint(point: Point, region: Region): Point {
  return {
    x: Math.min(region.x + region.width, Math.max(region.x, point.x)),
    y: Math.min(region.y + region.height, Math.max(region.y, point.y)),
  };
}

/** Image pixels per artboard pixel, rounded up to √2 steps for reuse and capped at 1. */
export function resolutionStep(scale: number) {
  if (!(scale > 0)) return 1;
  // The tolerance keeps exact steps (like 0.5) from rounding up a step.
  const steps = Math.log(scale) / Math.log(Math.SQRT2);
  return Math.min(1, Math.SQRT2 ** Math.ceil(steps - EPSILON));
}

import type { Region } from "./types";

export type ZoomAction = "zoomIn" | "zoomOut" | "zoomActual" | "zoomFit";

export interface Point {
  x: number;
  y: number;
}

/**
 * What the canvas shows. A null zoom fits the artboard in view, centered;
 * otherwise `center` is the artboard point at the middle of the view (null
 * for the artboard's own center).
 */
export interface Viewport {
  zoom: number | null;
  center: Point | null;
}

export const FIT_VIEWPORT: Viewport = { zoom: null, center: null };

/** The steps the zoom buttons and shortcuts move between. 1 is 100%: one artboard pixel per screen pixel. */
export const ZOOM_LEVELS = [
  0.05, 0.1, 0.125, 0.167, 0.25, 0.333, 0.5, 0.667, 1, 1.5, 2, 3, 4, 6, 8,
];
export const MIN_ZOOM = ZOOM_LEVELS[0];
export const MAX_ZOOM = ZOOM_LEVELS[ZOOM_LEVELS.length - 1];
const EPSILON = 0.001;

/**
 * Keeps a zoom within the levels' range, except that it never pulls a zoom
 * that is already outside the range further away: a tiny canvas can fit
 * above the top level, and zooming it in shouldn't zoom it out.
 */
export function clampZoom(zoom: number, current: number) {
  const min = Math.min(MIN_ZOOM, current);
  const max = Math.max(MAX_ZOOM, current);
  return Math.min(max, Math.max(min, zoom));
}

/**
 * The next zoom level in or out from any zoom, including one between levels.
 * Past the last level in that direction, the zoom stays where it is.
 */
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

/**
 * The new center after zooming from `scale` to `next`, keeping the artboard
 * point under `pointer` (in screen pixels from the view's middle) in place.
 */
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

/** The nearest point to `point` inside `region`. */
export function clampPoint(point: Point, region: Region): Point {
  return {
    x: Math.min(region.x + region.width, Math.max(region.x, point.x)),
    y: Math.min(region.y + region.height, Math.max(region.y, point.y)),
  };
}

/**
 * Image pixels per artboard pixel for a given screen scale: rounded up to
 * steps of √2, so small zoom changes reuse what's already rendered, and never
 * above 1, past which zooming in shows nothing new.
 */
export function resolutionStep(scale: number) {
  if (!(scale > 0)) return 1;
  // The tolerance keeps exact steps (like 0.5) from rounding up a step.
  const steps = Math.log(scale) / Math.log(Math.SQRT2);
  return Math.min(1, Math.SQRT2 ** Math.ceil(steps - EPSILON));
}

/**
 * The canvas draws at most 2 device pixels per CSS pixel: 3× phones would
 * otherwise draw over twice as many pixels for little visible gain.
 */
export const MAX_PIXEL_RATIO = 2;

export function screenPixelRatio() {
  return Math.min(globalThis.devicePixelRatio || 1, MAX_PIXEL_RATIO);
}

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

type Size = { width: number; height: number };

export interface Frame {
  view: Size;
  artboard: Size;
}

const FIT_PADDING = 48;

export function fitScale({ view, artboard }: Frame) {
  return Math.max(
    0.01,
    Math.min(
      (view.width - FIT_PADDING * 2) / artboard.width,
      (view.height - FIT_PADDING * 2) / artboard.height,
    ),
  );
}

export function resolveViewport(viewport: Viewport, frame: Frame) {
  const { artboard } = frame;
  return {
    scale: viewport.zoom ?? fitScale(frame),
    center:
      viewport.zoom !== null && viewport.center
        ? viewport.center
        : { x: artboard.width / 2, y: artboard.height / 2 },
  };
}

export function zoomViewport(
  viewport: Viewport,
  action: ZoomAction,
  frame: Frame,
): Viewport {
  if (action === "zoomFit") return FIT_VIEWPORT;
  const { scale, center } = resolveViewport(viewport, frame);
  const zoom =
    action === "zoomActual"
      ? 1
      : action === "zoomDouble"
        ? 2
        : zoomStep(scale, action === "zoomIn" ? 1 : -1);
  return { zoom, center };
}

/** Screen pixels of the artboard kept in view, however far it's panned. */
const KEEP_VISIBLE = 48;

/**
 * Where the view's middle may go: far enough for any artboard edge to reach the
 * opposite side of the view, so it can be panned clear of controls floating over
 * the canvas, while a strip of it always stays in view.
 */
function pannableCenters({ view, artboard }: Frame, scale: number): Region {
  const reach = (side: number) => Math.max(0, side / 2 - KEEP_VISIBLE) / scale;
  const x = reach(view.width);
  const y = reach(view.height);
  return {
    x: -x,
    y: -y,
    width: artboard.width + x * 2,
    height: artboard.height + y * 2,
  };
}

export interface ViewMove {
  /** Screen pixels from the view's top left. */
  pointer: Point;
  factor: number;
  /** Screen pixels to pan by after zooming. */
  pan: Point;
}

export function moveViewport(
  viewport: Viewport,
  { pointer, factor, pan }: ViewMove,
  frame: Frame,
): Viewport {
  const { scale, center } = resolveViewport(viewport, frame);
  const next = clampZoom(scale * factor, scale);
  const fromMiddle = {
    x: pointer.x - frame.view.width / 2,
    y: pointer.y - frame.view.height / 2,
  };
  const zoomed = zoomAround(center, fromMiddle, scale, next);
  return {
    zoom: next,
    center: clampPoint(
      { x: zoomed.x + pan.x / next, y: zoomed.y + pan.y / next },
      pannableCenters(frame, next),
    ),
  };
}

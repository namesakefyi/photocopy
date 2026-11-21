import type { Layer, Region } from "./types";

type Size = { width: number; height: number };

export function createCanvas({ width, height }: Size) {
  return Object.assign(document.createElement("canvas"), { width, height });
}

export function context2d(
  canvas: HTMLCanvasElement,
  options?: CanvasRenderingContext2DSettings,
): CanvasRenderingContext2D;
export function context2d(
  canvas: OffscreenCanvas,
  options?: CanvasRenderingContext2DSettings,
): OffscreenCanvasRenderingContext2D;
export function context2d(
  canvas: HTMLCanvasElement | OffscreenCanvas,
  options?: CanvasRenderingContext2DSettings,
) {
  const ctx = canvas.getContext("2d", options);
  if (!ctx) throw new Error("Canvas 2D is not available");
  return ctx;
}

/** `size` at `scale`, in whole pixels, at least 1×1. */
export function scaledSize(size: Size, scale: number): Size {
  return {
    width: Math.max(1, Math.round(size.width * scale)),
    height: Math.max(1, Math.round(size.height * scale)),
  };
}

/** Where a layer sits on the artboard: everything drawing it needs but the pixels. */
export type LayerPlacement = Pick<
  Layer,
  | "x"
  | "y"
  | "width"
  | "height"
  | "scale"
  | "rotation"
  | "flipX"
  | "flipY"
  | "visible"
>;

/** Draws visible layers in `region` at `scale`, stretching each image to its layer's size. */
export function drawLayers(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  layers: (LayerPlacement & { image: CanvasImageSource })[],
  region: Region,
  scale: number,
) {
  ctx.imageSmoothingQuality = "high";
  for (const layer of layers) {
    if (!layer.visible) continue;
    ctx.save();
    ctx.scale(scale, scale);
    ctx.translate(layer.x - region.x, layer.y - region.y);
    ctx.rotate((layer.rotation * Math.PI) / 180);
    ctx.scale(
      layer.scale * (layer.flipX ? -1 : 1),
      layer.scale * (layer.flipY ? -1 : 1),
    );
    ctx.drawImage(
      layer.image,
      -layer.width / 2,
      -layer.height / 2,
      layer.width,
      layer.height,
    );
    ctx.restore();
  }
}

/** Flattens visible layers in `region` onto a transparent canvas at `scale`. */
export function renderRegion(layers: Layer[], region: Region, scale: number) {
  const canvas = createCanvas(scaledSize(region, scale));
  const ctx = context2d(canvas, { willReadFrequently: true });
  drawLayers(
    ctx,
    layers.map((layer) => ({ ...layer, image: layer.composed })),
    region,
    scale,
  );
  return { canvas, ctx };
}

/** 3× screens would draw over twice the pixels for little visible gain. */
const MAX_PIXEL_RATIO = 2;

export function screenPixelRatio() {
  return Math.min(globalThis.devicePixelRatio || 1, MAX_PIXEL_RATIO);
}

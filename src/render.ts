import type { Layer, Region } from "./types";

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

/**
 * Draws each visible layer's image within `region`, multiplied by `scale`.
 * The image may be any size: it's stretched over the layer's full width and
 * height, so a scaled-down copy draws in the same place. Mirrors how the
 * canvas positions each Konva image around its center.
 */
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

/** The pixel size of `region` at `scale`, at least 1×1. */
export function regionPixels(region: Region, scale: number) {
  return {
    width: Math.max(1, Math.round(region.width * scale)),
    height: Math.max(1, Math.round(region.height * scale)),
  };
}

/**
 * Flattens the visible layers within `region` onto a transparent canvas,
 * multiplied by `scale`.
 */
export function renderRegion(layers: Layer[], region: Region, scale: number) {
  const canvas = document.createElement("canvas");
  Object.assign(canvas, regionPixels(region, scale));
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas 2D is not available");
  drawLayers(
    ctx,
    layers.map((layer) => ({ ...layer, image: layer.composed })),
    region,
    scale,
  );
  return { canvas, ctx };
}

export function sameRegion(a: Region, b: Region) {
  return (
    a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height
  );
}

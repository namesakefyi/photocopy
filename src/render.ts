import type { Layer, Region } from "./types";

/** Where each visible layer's rotated corners land, in artboard pixels. */
export function layerBounds(layers: Layer[]): Region | null {
  let left = Number.POSITIVE_INFINITY;
  let top = Number.POSITIVE_INFINITY;
  let right = Number.NEGATIVE_INFINITY;
  let bottom = Number.NEGATIVE_INFINITY;
  for (const layer of layers) {
    if (!layer.visible) continue;
    const angle = (layer.rotation * Math.PI) / 180;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const halfWidth = (layer.width * layer.scale) / 2;
    const halfHeight = (layer.height * layer.scale) / 2;
    for (const [dx, dy] of [
      [-halfWidth, -halfHeight],
      [halfWidth, -halfHeight],
      [halfWidth, halfHeight],
      [-halfWidth, halfHeight],
    ]) {
      const x = layer.x + dx * cos - dy * sin;
      const y = layer.y + dx * sin + dy * cos;
      left = Math.min(left, x);
      right = Math.max(right, x);
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
    }
  }
  if (!Number.isFinite(left)) return null;
  const x = Math.floor(left);
  const y = Math.floor(top);
  return { x, y, width: Math.ceil(right) - x, height: Math.ceil(bottom) - y };
}

/**
 * Flattens the visible layers within `region` onto a transparent canvas,
 * multiplied by `scale`. Mirrors how the bed positions each Konva image
 * around its center.
 */
export function renderRegion(layers: Layer[], region: Region, scale: number) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(region.width * scale));
  canvas.height = Math.max(1, Math.round(region.height * scale));
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas 2D is not available");
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
    ctx.drawImage(layer.composed, -layer.width / 2, -layer.height / 2);
    ctx.restore();
  }
  return { canvas, ctx };
}

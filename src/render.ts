import type { Layer, Region } from "./types";

const SNAP_TOLERANCE = 1e-6;

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
  // Rotation math leaves edges a hair off whole pixels (cos 90° isn't exactly
  // 0), which would otherwise snap out a whole extra pixel.
  const x = Math.floor(left + SNAP_TOLERANCE);
  const y = Math.floor(top + SNAP_TOLERANCE);
  return {
    x,
    y,
    width: Math.ceil(right - SNAP_TOLERANCE) - x,
    height: Math.ceil(bottom - SNAP_TOLERANCE) - y,
  };
}

/**
 * Flattens the visible layers within `region` onto a transparent canvas,
 * multiplied by `scale`. Mirrors how the canvas positions each Konva image
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

/** The smallest region holding both. */
export function unionRegion(a: Region, b: Region): Region {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return {
    x,
    y,
    width: Math.max(a.x + a.width, b.x + b.width) - x,
    height: Math.max(a.y + a.height, b.y + b.height) - y,
  };
}

/** Grows a region by a fraction of its size on every side. */
export function expandRegion(region: Region, fraction: number): Region {
  const dx = region.width * fraction;
  const dy = region.height * fraction;
  return {
    x: region.x - dx,
    y: region.y - dy,
    width: region.width + dx * 2,
    height: region.height + dy * 2,
  };
}

/** Whether `outer` covers all of `inner`. */
export function containsRegion(outer: Region, inner: Region) {
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.width <= outer.x + outer.width &&
    inner.y + inner.height <= outer.y + outer.height
  );
}

/**
 * The region a trimmed canvas's preview should cover: the current one while
 * it still covers the view (so small pans reuse it), or the view plus a
 * margin of `margin` of its size on each side. Also replaced once the view
 * has zoomed in so far that the old one is over `maxGrowth` times wider,
 * mostly rendering pixels nobody sees.
 */
export function nextPreviewRegion(
  current: Region | null,
  view: Region,
  margin: number,
  maxGrowth: number,
): Region {
  return current &&
    containsRegion(current, view) &&
    current.width <= view.width * maxGrowth
    ? current
    : expandRegion(view, margin);
}

export function sameRegion(a: Region, b: Region) {
  return (
    a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height
  );
}

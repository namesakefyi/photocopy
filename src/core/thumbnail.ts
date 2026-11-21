import { context2d, scaledSize } from "./render";
import type { Region } from "./types";

const THUMBNAIL_LONG_SIDE = 240;

/** Scales down the live preview, which is already photocopied, so it's cheap. */
export async function renderThumbnail(
  artboard: { width: number; height: number },
  fill: string,
  preview: { image: ImageBitmap; region: Region } | null,
) {
  const fit = THUMBNAIL_LONG_SIDE / Math.max(artboard.width, artboard.height);
  const { width, height } = scaledSize(artboard, fit);
  const canvas = new OffscreenCanvas(width, height);
  const ctx = context2d(canvas);
  ctx.fillStyle = fill;
  ctx.fillRect(0, 0, width, height);
  if (preview) {
    const { image, region } = preview;
    ctx.imageSmoothingQuality = "high";
    ctx.globalCompositeOperation = "multiply";
    ctx.drawImage(
      image,
      region.x * fit,
      region.y * fit,
      region.width * fit,
      region.height * fit,
    );
  }
  // Browsers without WebP encoding fall back to PNG, which is fine this small.
  return canvas.convertToBlob({ type: "image/webp", quality: 0.85 });
}

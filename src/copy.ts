import { canvasToBlob } from "./layers";
import { contentBounds, type PhotocopySettings } from "./photocopy";
import { photocopyImageData } from "./photocopyClient";
import { renderRegion } from "./render";
import type { Layer, Region } from "./types";

export interface Copy {
  url: string;
  blob: Blob;
  width: number;
  height: number;
}

export interface CopyOptions {
  /** Crop to the visible pixels instead of keeping the whole region. */
  trim: boolean;
  /** Fill behind the copy, or null to leave it transparent. */
  background: string | null;
}

/** Renders a region at full size, photocopies it, and encodes a PNG. */
export async function makeCopy(
  layers: Layer[],
  region: Region,
  settings: PhotocopySettings,
  { trim, background }: CopyOptions,
): Promise<Copy | null> {
  const { canvas, ctx } = renderRegion(layers, region, 1);
  const flat = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const result = await photocopyImageData(flat, settings, 1);

  const bounds = trim
    ? contentBounds(result)
    : { x: 0, y: 0, width: result.width, height: result.height };
  if (!bounds) return null;

  ctx.putImageData(result, 0, 0);
  const cropped = document.createElement("canvas");
  cropped.width = bounds.width;
  cropped.height = bounds.height;
  const croppedCtx = cropped.getContext("2d");
  if (!croppedCtx) throw new Error("Canvas 2D is not available");
  if (background) {
    croppedCtx.fillStyle = background;
    croppedCtx.fillRect(0, 0, bounds.width, bounds.height);
    // White paper takes on the background color, like copying onto colored stock.
    croppedCtx.globalCompositeOperation = "multiply";
  }
  croppedCtx.drawImage(
    canvas,
    bounds.x,
    bounds.y,
    bounds.width,
    bounds.height,
    0,
    0,
    bounds.width,
    bounds.height,
  );

  const blob = await canvasToBlob(cropped);
  return {
    blob,
    url: URL.createObjectURL(blob),
    width: bounds.width,
    height: bounds.height,
  };
}

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

/** A finished photocopy on a transparent canvas, ready to encode. */
export interface Photocopy {
  canvas: HTMLCanvasElement;
  /** The photocopied pixels, or null when they fill the whole canvas. */
  cropBounds: Region | null;
}

export interface EncodeOptions {
  /** Fill behind the copy, or null to leave it transparent. */
  background: string | null;
  cropToFit: boolean;
}

/**
 * Renders a region at full size (or scaled down so neither side passes
 * `maxSize`) and photocopies it. Null when nothing would print.
 */
export async function makePhotocopy(
  layers: Layer[],
  region: Region,
  settings: PhotocopySettings,
  maxSize: number,
): Promise<Photocopy | null> {
  const scale = Math.min(1, maxSize / region.width, maxSize / region.height);
  const { canvas, ctx } = renderRegion(layers, region, scale);
  const flat = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const result = await photocopyImageData(flat, settings, scale);
  const bounds = contentBounds(result);
  if (!bounds) return null;
  ctx.putImageData(result, 0, 0);
  const isWhole =
    bounds.width === canvas.width && bounds.height === canvas.height;
  return { canvas, cropBounds: isWhole ? null : bounds };
}

export async function encodeCopy(
  { canvas: source, cropBounds }: Photocopy,
  { background, cropToFit }: EncodeOptions,
): Promise<Copy> {
  const { x, y, width, height } = (cropToFit && cropBounds) || {
    x: 0,
    y: 0,
    width: source.width,
    height: source.height,
  };
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D is not available");
  if (background) {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, width, height);
    // White paper takes on the background color, like copying onto colored stock.
    ctx.globalCompositeOperation = "multiply";
  }
  ctx.drawImage(source, x, y, width, height, 0, 0, width, height);
  const blob = await canvasToBlob(canvas);
  return { blob, url: URL.createObjectURL(blob), width, height };
}

const CROP_KEY = "photocopy-crop-to-fit";
const TRANSPARENT_KEY = "photocopy-transparent-export";

export interface ExportOptions {
  cropToFit: boolean;
  transparent: boolean;
}

export function savedExportOptions(): ExportOptions {
  try {
    return {
      cropToFit: localStorage.getItem(CROP_KEY) === "true",
      transparent: localStorage.getItem(TRANSPARENT_KEY) === "true",
    };
  } catch {
    return { cropToFit: false, transparent: false };
  }
}

export function saveExportOptions({ cropToFit, transparent }: ExportOptions) {
  try {
    localStorage.setItem(CROP_KEY, String(cropToFit));
    localStorage.setItem(TRANSPARENT_KEY, String(transparent));
  } catch {
    // Storage can be unavailable (private windows); the choices still apply.
  }
}

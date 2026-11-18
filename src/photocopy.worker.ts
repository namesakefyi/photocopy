import { type PhotocopySettings, photocopy } from "./photocopy";
import { drawLayers, type LayerPlacement, regionPixels } from "./render";
import type { Region } from "./types";

/** Photocopies already-flattened pixels (exports). */
export interface PhotocopyRequest {
  kind: "photocopy";
  id: number;
  buffer: ArrayBuffer;
  width: number;
  height: number;
  settings: PhotocopySettings;
  pixelScale: number;
}

/** A layer as the preview draws it; `key` names the bitmap it needs. */
export interface PreviewLayer extends LayerPlacement {
  id: string;
  key: string;
}

/**
 * Flattens and photocopies a region of the canvas (the live preview). The
 * worker keeps each layer's bitmap between requests, so `images` carries only
 * those that changed; layers missing from `layers` are dropped.
 */
export interface PreviewRequest {
  kind: "preview";
  id: number;
  layers: PreviewLayer[];
  images: { id: string; key: string; bitmap: ImageBitmap }[];
  region: Region;
  scale: number;
  settings: PhotocopySettings;
}

export type WorkerRequest = PhotocopyRequest | PreviewRequest;

export type PhotocopyResponse =
  | { id: number; buffer: ArrayBuffer }
  | { id: number; bitmap: ImageBitmap }
  | { id: number; error: string };

const bitmaps = new Map<string, { key: string; bitmap: ImageBitmap }>();

function preview(request: PreviewRequest): ImageBitmap {
  for (const image of request.images) {
    bitmaps.get(image.id)?.bitmap.close();
    bitmaps.set(image.id, { key: image.key, bitmap: image.bitmap });
  }
  const ids = new Set(request.layers.map((layer) => layer.id));
  for (const [id, cached] of bitmaps) {
    if (ids.has(id)) continue;
    cached.bitmap.close();
    bitmaps.delete(id);
  }

  const { width, height } = regionPixels(request.region, request.scale);
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas 2D is not available in the worker");
  drawLayers(
    ctx,
    request.layers.map((layer) => {
      const cached = bitmaps.get(layer.id);
      if (cached?.key !== layer.key) {
        throw new Error(`The preview is missing the image for ${layer.id}`);
      }
      return { ...layer, image: cached.bitmap };
    }),
    request.region,
    request.scale,
  );
  const flat = ctx.getImageData(0, 0, width, height);
  const result = photocopy(flat, request.settings, request.scale);
  ctx.putImageData(
    new ImageData(result.data as Uint8ClampedArray<ArrayBuffer>, width, height),
    0,
    0,
  );
  return canvas.transferToImageBitmap();
}

self.onmessage = ({ data }: MessageEvent<WorkerRequest>) => {
  try {
    if (data.kind === "preview") {
      const bitmap = preview(data);
      const response: PhotocopyResponse = { id: data.id, bitmap };
      self.postMessage(response, { transfer: [bitmap] });
      return;
    }
    const result = photocopy(
      {
        data: new Uint8ClampedArray(data.buffer),
        width: data.width,
        height: data.height,
      },
      data.settings,
      data.pixelScale,
    );
    const buffer = result.data.buffer as ArrayBuffer;
    const response: PhotocopyResponse = { id: data.id, buffer };
    self.postMessage(response, { transfer: [buffer] });
  } catch (cause) {
    const response: PhotocopyResponse = {
      id: data.id,
      error: cause instanceof Error ? cause.message : String(cause),
    };
    self.postMessage(response);
  }
};

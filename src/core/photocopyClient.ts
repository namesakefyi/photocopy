import type { PhotocopySettings } from "./photocopy";
import type {
  PhotocopyRequest,
  PhotocopyResponse,
  PreviewLayer,
  PreviewRequest,
} from "./photocopy.worker";
import { context2d, scaledSize } from "./render";
import type { Layer, Region } from "./types";
import { resolutionStep } from "./zoom";

interface Pending {
  resolve: (result: ArrayBuffer | ImageBitmap) => void;
  reject: (error: Error) => void;
}

let worker: Worker | null = null;
let nextId = 0;
const pending = new Map<number, Pending>();
/** Which bitmap (by key) the worker holds for each layer, for the preview. */
const sentImages = new Map<string, string>();

/** Rejects waiting requests and discards a crashed worker, so the next request starts fresh. */
function failAll(error: Error) {
  for (const request of pending.values()) request.reject(error);
  pending.clear();
  sentImages.clear();
  worker?.terminate();
  worker = null;
}

function getWorker() {
  if (!worker) {
    worker = new Worker(new URL("./photocopy.worker.ts", import.meta.url), {
      type: "module",
    });
    worker.onmessage = ({ data }: MessageEvent<PhotocopyResponse>) => {
      const request = pending.get(data.id);
      pending.delete(data.id);
      if (!request) return;
      if ("error" in data) request.reject(new Error(data.error));
      else request.resolve("bitmap" in data ? data.bitmap : data.buffer);
    };
    worker.onerror = (event) => {
      event.preventDefault();
      failAll(new Error(event.message || "The photocopy worker failed"));
    };
    worker.onmessageerror = () => {
      failAll(new Error("The photocopy worker sent an unreadable message"));
    };
  }
  return worker;
}

function send(
  request: PhotocopyRequest | PreviewRequest,
  transfer: Transferable[],
) {
  return new Promise<ArrayBuffer | ImageBitmap>((resolve, reject) => {
    pending.set(request.id, { resolve, reject });
    getWorker().postMessage(request, transfer);
  });
}

/** Runs the photocopy pipeline off the main thread. */
export async function photocopyImageData(
  image: ImageData,
  settings: PhotocopySettings,
  pixelScale: number,
) {
  const buffer = image.data.buffer as ArrayBuffer;
  const result = await send(
    {
      kind: "photocopy",
      id: nextId++,
      buffer,
      width: image.width,
      height: image.height,
      settings,
      pixelScale,
    },
    [buffer],
  );
  return new ImageData(
    new Uint8ClampedArray(result as ArrayBuffer),
    image.width,
    image.height,
  );
}

function scaledBitmap(layer: Layer, scale: number) {
  const { width, height } = scaledSize(layer, scale);
  const canvas = new OffscreenCanvas(width, height);
  const ctx = context2d(canvas);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(layer.composed, 0, 0, width, height);
  return canvas.transferToImageBitmap();
}

/** Photocopies `region` for the live preview, sending only layer bitmaps that changed. */
export async function renderPreview(
  layers: Layer[],
  region: Region,
  scale: number,
  settings: PhotocopySettings,
) {
  const visible = layers.filter((layer) => layer.visible);
  const images: PreviewRequest["images"] = [];
  const placed: PreviewLayer[] = visible.map((layer) => {
    const imageScale = resolutionStep(layer.scale * scale);
    const key = `${layer.revision}@${imageScale}`;
    if (sentImages.get(layer.id) !== key) {
      images.push({
        id: layer.id,
        key,
        bitmap: scaledBitmap(layer, imageScale),
      });
      sentImages.set(layer.id, key);
    }
    return {
      id: layer.id,
      key,
      x: layer.x,
      y: layer.y,
      width: layer.width,
      height: layer.height,
      scale: layer.scale,
      rotation: layer.rotation,
      flipX: layer.flipX,
      flipY: layer.flipY,
      visible: true,
    };
  });
  // The worker drops the bitmaps of layers it isn't sent.
  const ids = new Set(visible.map((layer) => layer.id));
  for (const id of sentImages.keys()) {
    if (!ids.has(id)) sentImages.delete(id);
  }
  const result = await send(
    {
      kind: "preview",
      id: nextId++,
      layers: placed,
      images,
      region,
      scale,
      settings,
    },
    images.map((image) => image.bitmap),
  );
  return result as ImageBitmap;
}

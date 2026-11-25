import type { PhotocopySettings } from "./photocopy";
import type {
  PhotocopyRequest,
  PhotocopyResponse,
  PreviewLayer,
  PreviewRequest,
} from "./photocopy.worker";
import { context2d, scaledSize } from "./render";
import type { Layer, Region } from "./types";
import { createWorkerClient } from "./workerClient";
import { resolutionStep } from "./zoom";

/** Which bitmap (by key) the worker holds for each layer, for the preview. */
const sentImages = new Map<string, string>();

const client = createWorkerClient<
  PhotocopyRequest | PreviewRequest,
  PhotocopyResponse
>(
  () =>
    new Worker(new URL("./photocopy.worker.ts", import.meta.url), {
      type: "module",
    }),
  "The photocopy worker",
  () => sentImages.clear(),
);

async function send(
  request: PhotocopyRequest | PreviewRequest,
  transfer: Transferable[],
) {
  const response = await client.send(request, { transfer });
  return "bitmap" in response ? response.bitmap : response.buffer;
}

export async function photocopyImageData(
  image: ImageData,
  settings: PhotocopySettings,
  pixelScale: number,
) {
  const buffer = image.data.buffer as ArrayBuffer;
  const result = await send(
    {
      kind: "photocopy",
      id: client.nextId(),
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

/** Sends only the layer bitmaps that changed since the last preview. */
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
      id: client.nextId(),
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

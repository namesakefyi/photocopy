import type { PhotocopySettings } from "./photocopy";
import type { PhotocopyRequest } from "./photocopy.worker";

let worker: Worker | null = null;
let nextId = 0;
const pending = new Map<number, (buffer: ArrayBuffer) => void>();

function getWorker() {
  if (!worker) {
    worker = new Worker(new URL("./photocopy.worker.ts", import.meta.url), {
      type: "module",
    });
    worker.onmessage = ({
      data,
    }: MessageEvent<{ id: number; buffer: ArrayBuffer }>) => {
      pending.get(data.id)?.(data.buffer);
      pending.delete(data.id);
    };
  }
  return worker;
}

/** Runs the photocopy pipeline off the main thread. */
export function photocopyImageData(
  image: ImageData,
  settings: PhotocopySettings,
  pixelScale: number,
) {
  const id = nextId++;
  const buffer = image.data.buffer as ArrayBuffer;
  const request: PhotocopyRequest = {
    id,
    buffer,
    width: image.width,
    height: image.height,
    settings,
    pixelScale,
  };
  return new Promise<ImageData>((resolve) => {
    pending.set(id, (result) => {
      resolve(
        new ImageData(new Uint8ClampedArray(result), image.width, image.height),
      );
    });
    getWorker().postMessage(request, [buffer]);
  });
}

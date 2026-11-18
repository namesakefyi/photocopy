import type { PhotocopySettings } from "./photocopy";
import type { PhotocopyRequest, PhotocopyResponse } from "./photocopy.worker";

interface Pending {
  resolve: (buffer: ArrayBuffer) => void;
  reject: (error: Error) => void;
}

let worker: Worker | null = null;
let nextId = 0;
const pending = new Map<number, Pending>();

/**
 * Fails every waiting request and discards the worker, so the next request
 * starts a fresh one. Without this, a crashed worker (say, out of memory on a
 * huge export) would leave its callers waiting forever.
 */
function failAll(error: Error) {
  for (const request of pending.values()) request.reject(error);
  pending.clear();
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
      else request.resolve(data.buffer);
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
  return new Promise<ImageData>((resolve, reject) => {
    pending.set(id, {
      resolve: (result) =>
        resolve(
          new ImageData(
            new Uint8ClampedArray(result),
            image.width,
            image.height,
          ),
        ),
      reject,
    });
    getWorker().postMessage(request, [buffer]);
  });
}

import { canvasToBlob } from "./layers";
import type {
  RemovalRequest,
  RemovalResponse,
} from "./removeBackground.worker";

export type RemovalProgress = (label: string, fraction: number) => void;

/** Where each stage starts within the whole: loading, downloading, cutting out. */
const DOWNLOAD_START = 0.05;
const COMPUTE_START = 0.6;
/** Inference takes nearly all the compute time, so the library's even steps are reweighted. */
const COMPUTE_STEPS: Record<string, number> = {
  "compute:decode": 0,
  "compute:inference": 0.1,
  "compute:mask": 0.85,
  "compute:encode": 0.95,
};

export function overallProgress(onProgress: RemovalProgress) {
  const downloads = new Map<string, { current: number; total: number }>();
  let reached = 0;
  const report = (label: string, fraction: number) => {
    reached = Math.max(reached, Math.min(1, fraction));
    onProgress(label, reached);
  };
  return {
    loading: () => report("Loading", 0),
    library: (key: string, current: number, total: number) => {
      if (key.startsWith("fetch")) {
        downloads.set(key, { current, total });
        let done = 0;
        let size = 0;
        for (const file of downloads.values()) {
          done += file.current;
          size += file.total;
        }
        const fraction = size ? done / size : 0;
        report(
          "Downloading model",
          DOWNLOAD_START + fraction * (COMPUTE_START - DOWNLOAD_START),
        );
      } else {
        const step =
          current >= total ? 1 : (COMPUTE_STEPS[key] ?? current / total);
        report("Cutting out", COMPUTE_START + step * (1 - COMPUTE_START));
      }
    },
  };
}

interface Pending {
  resolve: (result: Blob) => void;
  reject: (error: Error) => void;
  progress: (key: string, current: number, total: number) => void;
}

let worker: Worker | null = null;
let nextId = 0;
const pending = new Map<number, Pending>();

function failAll(error: Error) {
  for (const request of pending.values()) request.reject(error);
  pending.clear();
  worker?.terminate();
  worker = null;
}

function getWorker() {
  if (!worker) {
    worker = new Worker(
      new URL("./removeBackground.worker.ts", import.meta.url),
      { type: "module" },
    );
    worker.onmessage = ({ data }: MessageEvent<RemovalResponse>) => {
      const request = pending.get(data.id);
      if (!request) return;
      if ("progress" in data) return request.progress(...data.progress);
      pending.delete(data.id);
      if ("error" in data) request.reject(new Error(data.error));
      else request.resolve(data.result);
    };
    worker.onerror = (event) => {
      event.preventDefault();
      failAll(new Error(event.message || "Background removal failed"));
    };
  }
  return worker;
}

/** Cuts out the subject on-device, loading the model (tens of MB) on first use. */
export async function removeBackground(
  source: HTMLCanvasElement,
  onProgress: RemovalProgress,
) {
  const progress = overallProgress(onProgress);
  progress.loading();
  const image = await canvasToBlob(source);
  const result = await new Promise<Blob>((resolve, reject) => {
    const request: RemovalRequest = { id: nextId++, image };
    pending.set(request.id, { resolve, reject, progress: progress.library });
    getWorker().postMessage(request);
  });
  return createImageBitmap(result);
}

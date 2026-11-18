import { canvasToBlob } from "./layers";

/** What's happening, and how far along the whole removal is, from 0 to 1. */
export type RemovalProgress = (label: string, fraction: number) => void;

/** Where each stage starts within the whole: loading, downloading, cutting out. */
const DOWNLOAD_START = 0.05;
const COMPUTE_START = 0.6;
/**
 * The library reports four compute steps evenly, but inference takes nearly
 * all the time, so each step's report moves the bar this far through cutting out.
 */
const COMPUTE_STEPS: Record<string, number> = {
  "compute:decode": 0,
  "compute:inference": 0.1,
  "compute:mask": 0.85,
  "compute:encode": 0.95,
};

/**
 * Turns the library's per-file download and per-step compute reports into
 * one overall fraction that never moves backward (new files join the
 * download total as they start).
 */
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

type Device = "gpu" | "cpu";

/**
 * WebGPU only when the browser can actually provide an adapter: some expose
 * `navigator.gpu` but have no usable GPU (common on Linux, or blocklisted
 * drivers).
 */
async function detectDevice(): Promise<Device> {
  const gpu = (
    navigator as Navigator & {
      gpu?: { requestAdapter(): Promise<unknown | null> };
    }
  ).gpu;
  try {
    return (await gpu?.requestAdapter()) ? "gpu" : "cpu";
  } catch {
    return "cpu";
  }
}

/**
 * Cuts the subject out of a photo in the browser. The library and its model
 * (tens of MB, from IMG.LY's CDN) load on first use; the photo never leaves
 * the device. Resolves to an image whose alpha is the cutout mask.
 */
/** Checked once: asking for an adapter can take a while and wake the GPU. */
let preferred: Promise<Device> | null = null;

export async function removeBackground(
  source: HTMLCanvasElement,
  onProgress: RemovalProgress,
) {
  const progress = overallProgress(onProgress);
  progress.loading();
  const { removeBackground: run } = await import("@imgly/background-removal");
  const blob = await canvasToBlob(source);
  const cutOut = (device: Device) =>
    run(blob, { device, progress: progress.library });
  preferred ??= detectDevice();
  const device = await preferred;
  let result: Blob;
  try {
    result = await cutOut(device);
  } catch (cause) {
    // A GPU that has an adapter can still fail to run the model; once it has,
    // later cutouts go straight to the CPU.
    if (device === "cpu") throw cause;
    console.warn("Background removal on the GPU failed; using the CPU", cause);
    preferred = Promise.resolve("cpu");
    result = await cutOut("cpu");
  }
  return createImageBitmap(result);
}

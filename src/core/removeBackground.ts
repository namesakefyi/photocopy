import { canvasToBlob } from "./layers";

/** What's happening, and how far along the whole removal is, from 0 to 1. */
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

/** Combines the library's download and compute reports into one fraction that never goes back. */
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

/** Some browsers expose `navigator.gpu` without a usable adapter. */
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

/** Checked once: asking for an adapter can take a while and wake the GPU. */
let preferred: Promise<Device> | null = null;

/** Cuts out the subject on-device, loading the model (tens of MB) on first use. */
export async function removeBackground(
  source: HTMLCanvasElement,
  onProgress: RemovalProgress,
) {
  const progress = overallProgress(onProgress);
  progress.loading();
  preferred ??= detectDevice();
  const [{ removeBackground: run }, blob, device] = await Promise.all([
    import("@imgly/background-removal"),
    canvasToBlob(source),
    preferred,
  ]);
  const cutOut = (device: Device) =>
    run(blob, { device, progress: progress.library });
  let result: Blob;
  try {
    result = await cutOut(device);
  } catch (cause) {
    // Some GPUs have an adapter but can't run the model; stay on the CPU after.
    if (device === "cpu") throw cause;
    console.warn("Background removal on the GPU failed; using the CPU", cause);
    preferred = Promise.resolve("cpu");
    result = await cutOut("cpu");
  }
  return createImageBitmap(result);
}

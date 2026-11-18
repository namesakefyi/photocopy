import { canvasToBlob } from "./layers";

export type RemovalProgress = (label: string, fraction: number) => void;

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
  const { removeBackground: run } = await import("@imgly/background-removal");
  const blob = await canvasToBlob(source);
  const cutOut = (device: Device) =>
    run(blob, {
      device,
      progress: (key, current, total) => {
        const fraction = total ? current / total : 0;
        onProgress(
          key.startsWith("fetch") ? "Downloading model" : "Cutting out",
          fraction,
        );
      },
    });
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

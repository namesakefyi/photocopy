import { removeBackground } from "@imgly/background-removal";

export interface RemovalRequest {
  id: number;
  image: Blob;
}

export type RemovalResponse =
  | { id: number; progress: [key: string, current: number, total: number] }
  | { id: number; result: Blob }
  | { id: number; error: string };

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

const post = (response: RemovalResponse) => self.postMessage(response);

self.onmessage = async ({ data }: MessageEvent<RemovalRequest>) => {
  const { id, image } = data;
  preferred ??= detectDevice();
  const device = await preferred;
  const cutOut = (device: Device) =>
    removeBackground(image, {
      device,
      progress: (key, current, total) =>
        post({ id, progress: [key, current, total] }),
    });
  try {
    let result: Blob;
    try {
      result = await cutOut(device);
    } catch (cause) {
      // Some GPUs have an adapter but can't run the model; stay on the CPU after.
      if (device === "cpu") throw cause;
      console.warn(
        "Background removal on the GPU failed; using the CPU",
        cause,
      );
      preferred = Promise.resolve("cpu");
      result = await cutOut("cpu");
    }
    post({ id, result });
  } catch (cause) {
    post({ id, error: cause instanceof Error ? cause.message : String(cause) });
  }
};

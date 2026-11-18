import { canvasToBlob } from "./layers";

export type RemovalProgress = (label: string, fraction: number) => void;

/**
 * Cuts the subject out of a photo in the browser. The library and its model
 * (tens of MB, from IMG.LY's CDN) load on first use; the photo never leaves
 * the device. Resolves to an image whose alpha is the cutout mask.
 */
export async function removeBackground(
  source: HTMLCanvasElement,
  onProgress: RemovalProgress,
) {
  const { removeBackground: run } = await import("@imgly/background-removal");
  const blob = await canvasToBlob(source);
  const result = await run(blob, {
    device: "gpu" in navigator ? "gpu" : "cpu",
    progress: (key, current, total) => {
      const fraction = total ? current / total : 0;
      onProgress(
        key.startsWith("fetch") ? "Downloading model" : "Cutting out",
        fraction,
      );
    },
  });
  return createImageBitmap(result);
}

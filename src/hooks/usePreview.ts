import { useCallback, useEffect, useRef, useState } from "react";
import type { PhotocopySettings } from "../core/photocopy";
import { renderPreview } from "../core/photocopyClient";
import { screenPixelRatio } from "../core/render";
import type { Layer, Region } from "../core/types";
import { resolutionStep } from "../core/zoom";

const PREVIEW_DELAY = 150;

export interface Preview {
  image: ImageBitmap;
  region: Region;
}

/** Photocopies the artboard in the worker shortly after anything changes. */
export function usePreview(
  layers: Layer[],
  settings: PhotocopySettings,
  width: number,
  height: number,
) {
  const [preview, setPreview] = useState<Preview | null>(null);
  // In resolution steps, so most zooms don't re-render the preview.
  const [scale, setScale] = useState<number | null>(null);
  const latestRequest = useRef(0);

  // Frees each preview's bitmap once a newer one (or none) replaces it.
  useEffect(() => () => preview?.image.close(), [preview]);

  useEffect(() => {
    if (layers.length === 0 || scale === null) {
      // Also retires any preview still rendering, so it can't land afterward.
      latestRequest.current += 1;
      setPreview(null);
      return;
    }
    const region = { x: 0, y: 0, width, height };
    const request = ++latestRequest.current;
    const timer = setTimeout(async () => {
      try {
        const image = await renderPreview(layers, region, scale, settings);
        if (request !== latestRequest.current) {
          image.close();
          return;
        }
        setPreview({ image, region });
      } catch (cause) {
        // The canvas keeps showing the photos themselves; the next change retries.
        console.warn("Preview failed", cause);
        if (request === latestRequest.current) setPreview(null);
      }
    }, PREVIEW_DELAY);
    return () => clearTimeout(timer);
  }, [layers, settings, scale, width, height]);

  // A preview that lands after closing would otherwise never be freed.
  useEffect(
    () => () => {
      latestRequest.current += 1;
    },
    [],
  );

  const setViewScale = useCallback(
    (viewScale: number) =>
      setScale(resolutionStep(viewScale * screenPixelRatio())),
    [],
  );

  return { preview, setViewScale };
}

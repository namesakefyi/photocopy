import { useCallback, useState } from "react";
import { MAX_CANVAS_SIZE } from "../core/canvasFormat";
import { makePhotocopy, type Photocopy } from "../core/copy";
import type { PhotocopySettings } from "../core/photocopy";
import type { Layer } from "../core/types";

/** Makes a full-size photocopy of the artboard for the export dialog. */
export function useExport(
  layers: Layer[],
  settings: PhotocopySettings,
  width: number,
  height: number,
  onError: (message: string | null) => void,
) {
  const [photocopy, setPhotocopy] = useState<Photocopy | null>(null);
  const [isCopying, setIsCopying] = useState(false);

  const runExport = useCallback(async () => {
    setIsCopying(true);
    onError(null);
    try {
      const region = { x: 0, y: 0, width, height };
      const result = await makePhotocopy(
        layers,
        region,
        settings,
        MAX_CANVAS_SIZE,
      );
      if (result) setPhotocopy(result);
      else onError("Nothing to export: the canvas is empty.");
    } catch (cause) {
      console.error(cause);
      onError("Export failed.");
    } finally {
      setIsCopying(false);
    }
  }, [layers, settings, width, height, onError]);

  const closeExport = useCallback(() => setPhotocopy(null), []);

  return { photocopy, isCopying, runExport, closeExport };
}

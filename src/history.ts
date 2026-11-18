import { useCallback, useEffect, useRef, useState } from "react";
import { composeLayer } from "./layers";
import type { PhotocopySettings } from "./photocopy";
import type { Theme } from "./themes";
import type { CanvasFormat, Layer } from "./types";

/** Changes this close together (like one slider drag) are one undo step. */
const MERGE_WINDOW = 500;
const MAX_STEPS = 50;

export interface DocumentState {
  layers: Layer[];
  settings: PhotocopySettings;
  canvasFormat: CanvasFormat;
  theme: Theme;
}

const maskKey = (layer: Layer) => `${layer.id}:${layer.revision}`;

/**
 * Brush strokes edit a mask canvas in place, so each mask version is kept as
 * its alpha channel alone: a quarter of the memory of a full copy.
 */
function captureAlpha(layer: Layer) {
  const ctx = layer.mask.getContext("2d");
  if (!ctx) return new Uint8ClampedArray(0);
  const { data } = ctx.getImageData(0, 0, layer.width, layer.height);
  const alpha = new Uint8ClampedArray(layer.width * layer.height);
  for (let pixel = 0; pixel < alpha.length; pixel++) {
    alpha[pixel] = data[pixel * 4 + 3];
  }
  return alpha;
}

function restoreAlpha(layer: Layer, alpha: Uint8ClampedArray) {
  const ctx = layer.mask.getContext("2d");
  if (!ctx || alpha.length !== layer.width * layer.height) return;
  const image = ctx.createImageData(layer.width, layer.height);
  for (let pixel = 0; pixel < alpha.length; pixel++) {
    image.data.set([255, 255, 255, alpha[pixel]], pixel * 4);
  }
  ctx.putImageData(image, 0, 0);
  composeLayer(layer);
}

/**
 * Records the document after each change and steps back and forth through
 * those records. Recording starts once `isReady` (after the saved session
 * has loaded), so the restored session is the first step.
 */
export function useHistory(
  current: DocumentState,
  isReady: boolean,
  apply: (state: DocumentState) => void,
) {
  const steps = useRef<DocumentState[]>([]);
  const index = useRef(-1);
  const masks = useRef(new Map<string, Uint8ClampedArray>());
  const lastChange = useRef(0);
  const isApplying = useRef(false);
  const latest = useRef(current);
  latest.current = current;
  const [position, setPosition] = useState({ index: -1, length: 0 });

  const { layers, settings, canvasFormat, theme } = current;

  useEffect(() => {
    if (!isReady) return;
    if (isApplying.current) {
      isApplying.current = false;
      return;
    }
    const state = { layers, settings, canvasFormat, theme };
    for (const layer of layers) {
      const key = maskKey(layer);
      if (!masks.current.has(key)) masks.current.set(key, captureAlpha(layer));
    }

    const now = performance.now();
    const kept = steps.current.slice(0, index.current + 1);
    // The first step is the starting point, so it's never merged into.
    if (index.current > 0 && now - lastChange.current < MERGE_WINDOW) {
      kept[kept.length - 1] = state;
    } else {
      kept.push(state);
    }
    steps.current = kept.slice(-MAX_STEPS);
    index.current = steps.current.length - 1;
    lastChange.current = now;

    const referenced = new Set(
      steps.current.flatMap((step) => step.layers.map(maskKey)),
    );
    for (const key of masks.current.keys()) {
      if (!referenced.has(key)) masks.current.delete(key);
    }
    setPosition({ index: index.current, length: steps.current.length });
  }, [layers, settings, canvasFormat, theme, isReady]);

  const goTo = useCallback(
    (target: number) => {
      const state = steps.current[target];
      if (!state) return;
      for (const layer of state.layers) {
        const alpha = masks.current.get(maskKey(layer));
        if (alpha) restoreAlpha(layer, alpha);
      }
      const now = latest.current;
      // Only skip the next recording if applying will actually change state.
      isApplying.current =
        now.layers !== state.layers ||
        now.settings !== state.settings ||
        now.canvasFormat !== state.canvasFormat ||
        now.theme !== state.theme;
      index.current = target;
      lastChange.current = 0;
      apply(state);
      setPosition({ index: target, length: steps.current.length });
    },
    [apply],
  );

  return {
    canUndo: position.index > 0,
    canRedo: position.index < position.length - 1,
    undo: useCallback(() => goTo(index.current - 1), [goTo]),
    redo: useCallback(() => goTo(index.current + 1), [goTo]),
  };
}

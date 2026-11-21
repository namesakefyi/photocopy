import { useCallback, useEffect, useMemo, useRef } from "react";
import { saveArtboardState } from "../core/persistence";
import { type ArtboardState, sameArtboardState } from "../core/types";
import { useEventListener } from "./useEventListener";

const SAVE_DELAY = 400;

interface AutosaveOptions {
  /** Once true, the state is what was restored, so it's already saved. */
  isRestored: boolean;
  /** False while another tab has the artboard open. */
  canSave: boolean;
  onError?: (cause: unknown) => void;
  /** How long changes settle before saving; tests shorten it. */
  delay?: number;
}

/**
 * Saves shortly after changes, re-encoding only changed masks. Saves run in
 * order, skipping superseded ones; `flush` saves immediately before closing.
 */
export function useAutosave(
  artboardId: string,
  state: ArtboardState,
  { isRestored, canSave, onError, delay = SAVE_DELAY }: AutosaveOptions,
) {
  const savedRevisions = useRef<Map<string, number> | null>(null);
  const restoredState = useRef<ArtboardState | null>(null);
  const pending = useRef<(() => Promise<void>) | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const lastSave = useRef<Promise<void>>(Promise.resolve());
  const latestError = useRef(onError);
  latestError.current = onError;
  const { layers, settings, canvasFormat, background } = state;

  // What was just restored is already saved; only later changes need saving.
  if (isRestored && !savedRevisions.current) {
    savedRevisions.current = new Map(
      layers.map((layer) => [layer.id, layer.revision]),
    );
    restoredState.current = state;
  }

  const runPending = useCallback(() => {
    clearTimeout(timer.current);
    const save = pending.current;
    pending.current = null;
    if (save) lastSave.current = save();
    return lastSave.current;
  }, []);

  useEffect(() => {
    const revisions = savedRevisions.current;
    const restored = restoredState.current;
    const current = { layers, settings, canvasFormat, background };
    if (!revisions || !canSave) return;
    if (restored && sameArtboardState(restored, current)) return;
    restoredState.current = null;
    pending.current = () =>
      saveArtboardState(artboardId, current, revisions).catch((cause) => {
        console.warn("Couldn’t save the artboard locally", cause);
        latestError.current?.(cause);
      });
    clearTimeout(timer.current);
    timer.current = setTimeout(runPending, delay);
  }, [
    artboardId,
    layers,
    settings,
    canvasFormat,
    background,
    canSave,
    delay,
    runPending,
  ]);

  // Saves anything still waiting when the artboard closes, or the page hides.
  useEffect(() => () => void runPending(), [runPending]);
  useEventListener(document, "visibilitychange", () => {
    if (document.visibilityState === "hidden") runPending();
  });

  return useMemo(() => ({ flush: runPending }), [runPending]);
}

import { useCallback, useEffect, useEffectEvent, useMemo, useRef } from "react";
import { saveArtboardState } from "../../core/persistence";
import { type ArtboardState, sameArtboardState } from "../../core/types";

const SAVE_DELAY = 400;

interface AutosaveOptions {
  /** Once true, the state is what was restored, so it's already saved. */
  isRestored: boolean;
  onError?: (cause: unknown) => void;
  onSaved?: (state: ArtboardState) => void;
  /** How long changes settle before saving; tests shorten it. */
  delay?: number;
}

/** Saves run in order, and a save replaced by a newer one is skipped. */
export function useAutosave(
  artboardId: string,
  state: ArtboardState,
  { isRestored, onError, onSaved, delay = SAVE_DELAY }: AutosaveOptions,
) {
  const savedRevisions = useRef<Map<string, number> | null>(null);
  const restoredState = useRef<ArtboardState | null>(null);
  const pending = useRef<(() => Promise<void>) | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const lastSave = useRef<Promise<void>>(Promise.resolve());
  const reportError = useEffectEvent((cause: unknown) => onError?.(cause));
  const reportSaved = useEffectEvent((saved: ArtboardState) =>
    onSaved?.(saved),
  );
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
    if (!revisions) return;
    if (restored && sameArtboardState(restored, current)) return;
    restoredState.current = null;
    pending.current = () =>
      saveArtboardState(artboardId, current, revisions)
        .then(() => reportSaved(current))
        .catch((cause) => {
          console.warn("Couldn’t save the artboard locally", cause);
          reportError(cause);
        });
    clearTimeout(timer.current);
    timer.current = setTimeout(runPending, delay);
  }, [
    artboardId,
    layers,
    settings,
    canvasFormat,
    background,
    delay,
    runPending,
  ]);

  // Saves anything still waiting when the artboard closes.
  useEffect(() => () => void runPending(), [runPending]);

  return useMemo(() => ({ flush: runPending }), [runPending]);
}

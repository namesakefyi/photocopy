import { useEffect, useEffectEvent, useState } from "react";
import { restoreArtboard } from "../../core/persistence";
import type { ArtboardState } from "../../core/types";
import { useAutosave } from "./useAutosave";

interface SyncOptions {
  onLoad: (loaded: ArtboardState) => void;
  onSaved: (saved: ArtboardState) => void;
  onSaveError: (cause: unknown) => void;
}

/** Loads the open artboard and saves changes to it. */
export function useArtboardSync(
  artboardId: string,
  content: ArtboardState,
  { onLoad, onSaved, onSaveError }: SyncOptions,
) {
  // What was loaded, or null for a new artboard; undefined while loading.
  const [restored, setRestored] = useState<ArtboardState | null>();
  const isRestored = restored !== undefined;
  const load = useEffectEvent(onLoad);

  useEffect(() => {
    let isCurrent = true;
    restoreArtboard(artboardId).then((loaded) => {
      if (!isCurrent) return;
      if (loaded) load(loaded);
      setRestored(loaded);
    });
    return () => {
      isCurrent = false;
    };
  }, [artboardId]);

  const autosave = useAutosave(artboardId, content, {
    isRestored,
    onError: onSaveError,
    onSaved,
  });

  return { restored, isRestored, flush: autosave.flush };
}

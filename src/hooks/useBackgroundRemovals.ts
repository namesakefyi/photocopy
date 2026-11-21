import { useCallback, useMemo, useRef, useState } from "react";
import { maskBlob } from "../core/layers";
import { applyStoredCutout } from "../core/persistence";
import { removeBackground } from "../core/removeBackground";
import type { Layer, Removal } from "../core/types";

interface Editor {
  applyCutout: (
    layerId: string,
    revision: number | null,
    cutout: ImageBitmap,
  ) => void;
  showError: (message: string) => void;
}

/** Runs above the editor, so a removal finishes even if its artboard closes. */
export function useBackgroundRemovals(
  editorRef: React.RefObject<Editor | null>,
  activeId: string,
  editorKey: string,
) {
  const [removals, setRemovals] = useState<
    Record<string, Removal & { artboardId: string }>
  >({});
  const latest = useRef({ activeId, editorKey });
  latest.current = { activeId, editorKey };

  const start = useCallback(
    async (layer: Layer) => {
      const artboardId = activeId;
      // Only what's needed later, so a closed artboard's layers can be freed.
      const { id, revision, width, height, source } = layer;
      const setProgress = (removal: Removal | null) =>
        setRemovals(({ [id]: _, ...rest }) =>
          removal ? { ...rest, [id]: { ...removal, artboardId } } : rest,
        );
      setProgress({ label: "Starting", fraction: 0 });
      // The library keeps reporting progress after it resolves.
      let isDone = false;
      try {
        const cutout = await removeBackground(source, (label, fraction) => {
          if (!isDone) setProgress({ label, fraction });
        });
        try {
          const editor = editorRef.current;
          if (editor && latest.current.activeId === artboardId) {
            // If reopened, the photo couldn't change mid-removal, so the cutout fits.
            const isSameEditor = latest.current.editorKey === editorKey;
            editor.applyCutout(id, isSameEditor ? revision : null, cutout);
          } else {
            const mask = await maskBlob({ width, height }, cutout);
            await applyStoredCutout(artboardId, id, mask);
          }
        } finally {
          cutout.close();
        }
      } catch (cause) {
        console.error(cause);
        if (latest.current.activeId === artboardId) {
          editorRef.current?.showError(
            "Background removal failed. Check your connection and try again.",
          );
        }
      } finally {
        isDone = true;
        setProgress(null);
      }
    },
    [editorRef, activeId, editorKey],
  );

  const busyIds = useMemo(
    () => new Set(Object.values(removals).map((removal) => removal.artboardId)),
    [removals],
  );
  const activeRemovals = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(removals).filter(
          ([, removal]) => removal.artboardId === activeId,
        ),
      ),
    [removals, activeId],
  );

  return { start, busyIds, activeRemovals };
}

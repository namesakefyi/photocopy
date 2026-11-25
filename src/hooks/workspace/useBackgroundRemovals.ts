import { useCallback, useMemo, useRef, useState } from "react";
import type { EditorHandle } from "../../components/editor/Editor";
import { maskBlob } from "../../core/layers";
import { applyStoredCutout } from "../../core/persistence";
import { removeBackground } from "../../core/removeBackground";
import type { Layer, Removal } from "../../core/types";
import type { Removals } from "./useWorkspace";

export function useBackgroundRemovals(
  editorRef: React.RefObject<EditorHandle | null>,
  activeId: string,
) {
  const [removals, setRemovals] = useState<
    Record<string, Removal & { artboardId: string }>
  >({});
  const latest = useRef({ activeId });
  latest.current = { activeId };

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
            editor.applyCutout(id, revision, cutout);
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
    [editorRef, activeId],
  );

  const state = useMemo<Removals>(
    () => ({
      active: Object.fromEntries(
        Object.entries(removals).filter(
          ([, removal]) => removal.artboardId === activeId,
        ),
      ),
      busyIds: new Set(
        Object.values(removals).map((removal) => removal.artboardId),
      ),
    }),
    [removals, activeId],
  );

  return { start, state };
}

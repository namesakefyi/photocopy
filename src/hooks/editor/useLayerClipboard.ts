import { useMemo, useRef } from "react";
import type { EditorAction } from "../../core/editor";
import {
  copyLayer,
  isCopiedLayer,
  LAYER_CLIPBOARD_TYPE,
  pasteLayer,
} from "../../core/layerClipboard";
import {
  isQuotaError,
  QUOTA_MESSAGE,
  saveSource,
} from "../../core/persistence";
import type { Layer } from "../../core/types";
import { useEventListener } from "../useEventListener";

/** Fields, dialogs, menus and the artboard list handle their own keys and clipboard. */
export function isOwnInputTarget(event: Event) {
  return (
    event.defaultPrevented ||
    (event.target as HTMLElement).closest?.(
      "input, textarea, select, [role=dialog], [role=menu], [data-own-keys]",
    ) != null
  );
}

/** Selected text on the page is the browser's to copy. */
export const hasNoTextSelected = () =>
  window.getSelection()?.isCollapsed ?? true;

interface LayerClipboardOptions {
  artboard: { width: number; height: number };
  latestLayers: React.RefObject<Layer[]>;
  latestSelected: React.RefObject<Layer | null>;
  dispatch: React.Dispatch<EditorAction>;
  addFiles: (files: File[]) => void;
  setError: (message: string | null) => void;
}

/** Copy, cut and paste of layers, through the system clipboard where the browser allows. */
export function useLayerClipboard({
  artboard,
  latestLayers,
  latestSelected,
  dispatch,
  addFiles,
  setError,
}: LayerClipboardOptions) {
  // While a copy or cut runs, whether its event came, so as not to copy twice.
  const copying = useRef<{ isHandled: boolean } | null>(null);
  const clipboard = useMemo(() => {
    const copySelected = (isCut: boolean, token: string | null) => {
      const layer = latestSelected.current;
      if (!layer) return;
      copyLayer(layer, artboard, token);
      if (isCut) dispatch({ type: "deleteSelected" });
    };
    return {
      copySelected,
      /** From a shortcut, the browser's own copy or cut event follows to reach the system clipboard. */
      expectCopyEvent(isCut: boolean) {
        const run = { isHandled: false };
        copying.current = run;
        setTimeout(() => {
          copying.current = null;
          // Safari fires no event with nothing selected on the page.
          if (!run.isHandled) copySelected(isCut, null);
        });
      },
      async paste() {
        const layer = pasteLayer(artboard, latestLayers.current);
        if (!layer) return;
        setError(null);
        // Stored before the layer exists, so autosave never sees it unsaved.
        try {
          await saveSource(layer);
        } catch (cause) {
          console.warn("Couldn’t save photo locally", cause);
          if (isQuotaError(cause)) setError(QUOTA_MESSAGE);
        }
        dispatch({ type: "addLayers", layers: [layer] });
      },
    };
  }, [artboard, latestLayers, latestSelected, dispatch, setError]);

  /** Also the browser's own Edit menu, which needs no keydown. */
  const copyByEvent = (event: ClipboardEvent, isCut: boolean) => {
    const run = copying.current;
    const isOurs = run !== null;
    if (!isOurs && (isOwnInputTarget(event) || !hasNoTextSelected())) return;
    if (!latestSelected.current || !event.clipboardData) return;
    event.preventDefault();
    if (run) run.isHandled = true;
    const token = crypto.randomUUID();
    event.clipboardData.setData(LAYER_CLIPBOARD_TYPE, token);
    clipboard.copySelected(isCut, token);
  };

  useEventListener(window, "copy", (event) => copyByEvent(event, false));
  useEventListener(window, "cut", (event) => copyByEvent(event, true));
  useEventListener(window, "paste", (event) => {
    if (isOwnInputTarget(event)) return;
    const files = [...(event.clipboardData?.files ?? [])].filter((file) =>
      file.type.startsWith("image/"),
    );
    if (files.length > 0) {
      event.preventDefault();
      addFiles(files);
      return;
    }
    // Only if nothing else was copied since, here or in another app.
    const token = event.clipboardData?.getData(LAYER_CLIPBOARD_TYPE) || null;
    if (isCopiedLayer(token)) {
      event.preventDefault();
      clipboard.paste();
    }
  });

  return clipboard;
}

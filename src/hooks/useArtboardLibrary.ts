import { useCallback, useEffect, useRef, useState } from "react";
import type { ArtboardEditorHandle } from "../components/ArtboardEditor";
import { DEFAULT_CANVAS } from "../core/canvasFormat";
import {
  artboardBeside,
  indexKey,
  insertAfter,
  reorderArtboards,
  withChanges,
  withoutArtboard,
} from "../core/library";
import {
  type ArtboardSummary,
  createArtboard,
  deleteArtboard,
  duplicateArtboard,
  isQuotaError,
  loadLibrary,
  QUOTA_MESSAGE,
  saveIndex,
  saveThumbnail,
} from "../core/persistence";
import { savedBackground } from "../core/themes";
import type { CanvasFormat } from "../core/types";

/** Asks the browser not to evict saved work under storage pressure. */
function persistStorage() {
  navigator.storage?.persist?.().catch(() => {});
}

/** Switching waits for the editor to save; `onOpen` runs on every open request. */
export function useArtboardLibrary(
  editorRef: React.RefObject<ArtboardEditorHandle | null>,
  onOpen: () => void,
) {
  const [artboards, setArtboards] = useState<ArtboardSummary[] | null>(null);
  const [activeId, setActiveId] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const latestActiveId = useRef(activeId);
  latestActiveId.current = activeId;
  const isSwitching = useRef(false);
  const savedIndex = useRef("");

  useEffect(() => {
    let isCurrent = true;
    loadLibrary()
      .then((library) => {
        if (!isCurrent) return;
        savedIndex.current = indexKey(library.artboards, library.activeId);
        setArtboards(library.artboards);
        setActiveId(library.activeId);
        if (library.artboards.length > 1) persistStorage();
      })
      .catch((cause) => {
        // Storage is off (some private windows): work in one unsaved artboard.
        console.warn("Couldn’t load saved artboards", cause);
        if (!isCurrent) return;
        const id = crypto.randomUUID();
        setArtboards([{ id, backgroundId: "", canvasFormat: DEFAULT_CANVAS }]);
        setActiveId(id);
      });
    return () => {
      isCurrent = false;
    };
  }, []);

  useEffect(() => {
    if (!artboards) return;
    const key = indexKey(artboards, activeId);
    if (key === savedIndex.current) return;
    savedIndex.current = key;
    saveIndex(
      artboards.map((artboard) => artboard.id),
      activeId,
    ).catch(() => {});
  }, [artboards, activeId]);

  function reportError(message: string, cause: unknown) {
    console.warn(message, cause);
    editorRef.current?.showError(isQuotaError(cause) ? QUOTA_MESSAGE : message);
  }

  async function open(id: string) {
    if (isSwitching.current) return;
    onOpen();
    if (id === latestActiveId.current) return;
    isSwitching.current = true;
    try {
      await editorRef.current?.flush();
      setActiveId(id);
    } finally {
      isSwitching.current = false;
    }
  }

  async function create() {
    try {
      // Saves a size change just made, so the new artboard picks it up.
      await editorRef.current?.flush();
      const artboard = await createArtboard(savedBackground().id);
      setArtboards((current) => [...(current ?? []), artboard]);
      persistStorage();
      await open(artboard.id);
    } catch (cause) {
      reportError("Couldn’t create an artboard.", cause);
    }
  }

  async function duplicate(id: string) {
    try {
      if (id === activeId) await editorRef.current?.flush();
      const copy = await duplicateArtboard(id);
      if (!copy) return;
      setArtboards((current) => insertAfter(current ?? [], id, copy));
      persistStorage();
    } catch (cause) {
      reportError("Couldn’t duplicate the artboard.", cause);
    }
  }

  async function remove(id: string) {
    if (!artboards?.some((artboard) => artboard.id === id)) return;
    const { remaining, nextId } = withoutArtboard(artboards, id);
    try {
      // There's always an artboard to work in.
      if (!nextId) remaining.push(await createArtboard(savedBackground().id));
      setArtboards(remaining);
      if (id === latestActiveId.current) {
        await open(nextId ?? remaining[0].id);
      }
      await deleteArtboard(id);
    } catch (cause) {
      reportError("Couldn’t delete the artboard.", cause);
    }
  }

  const setThumbnail = useCallback(
    (thumbnail: Blob) => {
      setArtboards((current) =>
        current ? withChanges(current, activeId, { thumbnail }) : current,
      );
      saveThumbnail(activeId, thumbnail).catch((cause) =>
        console.warn("Couldn’t save the thumbnail", cause),
      );
    },
    [activeId],
  );

  return {
    artboards,
    activeId,
    editorKey: `${activeId}:${reloadKey}`,
    reload: () => setReloadKey((key) => key + 1),
    open,
    create,
    duplicate,
    remove,
    reorder: (order: string[]) =>
      setArtboards((current) => current && reorderArtboards(current, order)),
    switchBy(direction: 1 | -1) {
      const id = artboards && artboardBeside(artboards, activeId, direction);
      if (id) open(id);
    },
    setThumbnail,
    setSaved(id: string, canvasFormat: CanvasFormat) {
      setArtboards((current) =>
        current ? withChanges(current, id, { canvasFormat }) : current,
      );
    },
  };
}

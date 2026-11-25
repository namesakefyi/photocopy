import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { EditorHandle } from "../../components/editor/Editor";
import {
  artboardBeside,
  indexKey,
  insertAfter,
  reorderArtboards,
  withChanges,
  withoutArtboard,
} from "../../core/artboardList";
import {
  type ArtboardSummary,
  createArtboard,
  deleteArtboard,
  duplicateArtboard,
  isQuotaError,
  loadArtboards,
  QUOTA_MESSAGE,
  saveIndex,
  saveThumbnail,
  toEntry,
  unsavedSummary,
} from "../../core/persistence";
import { readSetting, writeSetting } from "../../core/settings";
import { savedBackground } from "../../core/themes";
import type { ArtboardState } from "../../core/types";
import { useBackgroundRemovals } from "./useBackgroundRemovals";
import type { Workspace, WorkspaceActions } from "./useWorkspace";

const ARTBOARD_LIST_KEY = "photocopy-file-viewer";

/** Asks the browser not to evict saved work under storage pressure. */
function persistStorage() {
  navigator.storage?.persist?.().catch(() => {});
}

/** Switching waits for the editor to save. On narrow screens the list is a drawer, closed on opening. */
export function useWorkspaceState(
  editorRef: React.RefObject<EditorHandle | null>,
  isNarrow: boolean,
) {
  const [isArtboardListOpen, setIsArtboardListOpen] = useState(
    () => readSetting(ARTBOARD_LIST_KEY) !== "closed",
  );
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  useEffect(() => {
    writeSetting(ARTBOARD_LIST_KEY, isArtboardListOpen ? "open" : "closed");
  }, [isArtboardListOpen]);

  const [artboards, setArtboards] = useState<ArtboardSummary[] | null>(null);
  const [activeId, setActiveId] = useState("");
  const latestActiveId = useRef(activeId);
  latestActiveId.current = activeId;
  const isSwitching = useRef(false);
  const savedIndex = useRef("");

  useEffect(() => {
    let isCurrent = true;
    loadArtboards()
      .then((loaded) => {
        if (!isCurrent) return;
        savedIndex.current = indexKey(loaded.artboards, loaded.activeId);
        setArtboards(loaded.artboards);
        setActiveId(loaded.activeId);
        if (loaded.artboards.length > 1) persistStorage();
      })
      .catch((cause) => {
        // Storage is off (some private windows): work in one unsaved artboard.
        console.warn("Couldn’t load saved artboards", cause);
        if (!isCurrent) return;
        const artboard = unsavedSummary();
        setArtboards([artboard]);
        setActiveId(artboard.id);
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
    setIsDrawerOpen(false);
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
      // Saves changes just made, so the new artboard picks them up.
      await editorRef.current?.flush();
      const artboard = await createArtboard(
        savedBackground().id,
        latestActiveId.current,
      );
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

  function setSaved(
    id: string,
    { layers, canvasFormat, settings, background }: ArtboardState,
  ) {
    setArtboards((current) =>
      current
        ? withChanges(current, id, {
            canvasFormat,
            settings,
            layers: layers.map(toEntry),
            backgroundId: background.id,
          })
        : current,
    );
  }

  const removals = useBackgroundRemovals(editorRef, activeId);

  // Read when an action runs, so the actions stay one object for the app's life.
  const current = {
    artboards,
    activeId,
    isNarrow,
    open,
    create,
    duplicate,
    remove,
    setSaved,
    setThumbnail,
    startRemoval: removals.start,
  };
  const latest = useRef(current);
  latest.current = current;
  const [actions] = useState<WorkspaceActions>(() => ({
    openArtboard: (id) => latest.current.open(id),
    createArtboard() {
      // Shows where the new artboard went; the narrow drawer would just cover it.
      if (!latest.current.isNarrow) setIsArtboardListOpen(true);
      latest.current.create();
    },
    duplicateArtboard: (id) => latest.current.duplicate(id),
    deleteArtboard: (id) => latest.current.remove(id),
    reorderArtboards: (order) =>
      setArtboards((current) => current && reorderArtboards(current, order)),
    switchArtboard(direction) {
      const { artboards, activeId, open } = latest.current;
      const id = artboards && artboardBeside(artboards, activeId, direction);
      if (id) open(id);
    },
    setSaved: (id, saved) => latest.current.setSaved(id, saved),
    setThumbnail: (thumbnail) => latest.current.setThumbnail(thumbnail),
    startBackgroundRemoval: (layer) => latest.current.startRemoval(layer),
    setArtboardListShown(isShown) {
      if (latest.current.isNarrow) setIsDrawerOpen(isShown);
      else setIsArtboardListOpen(isShown);
    },
  }));

  const isArtboardListShown = isNarrow ? isDrawerOpen : isArtboardListOpen;
  const workspace = useMemo<Workspace | null>(
    () =>
      artboards && {
        ...actions,
        artboards,
        activeId,
        activeArtboard: artboards.find((artboard) => artboard.id === activeId),
        isArtboardListShown,
        isNarrow,
      },
    [actions, artboards, activeId, isArtboardListShown, isNarrow],
  );

  return { workspace, removals: removals.state };
}

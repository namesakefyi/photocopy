import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Dialog, Modal, ModalOverlay } from "react-aria-components";
import {
  ArtboardEditor,
  type ArtboardEditorHandle,
} from "./components/ArtboardEditor";
import { FileViewer } from "./components/FileViewer";
import { SidebarIcon } from "./components/ui/icons";
import { ToolToggleButton } from "./components/ui/ToolButton";
import { maskBlob } from "./layers";
import {
  type ArtboardSummary,
  applyStoredCutout,
  createArtboard,
  deleteArtboard,
  duplicateArtboard,
  isQuotaError,
  loadLibrary,
  QUOTA_MESSAGE,
  saveIndex,
  saveThumbnail,
} from "./persistence";
import { removeBackground } from "./removeBackground";
import { SHORTCUTS } from "./shortcuts";
import { savedBackground } from "./themes";
import type { Layer, Removal } from "./types";

const FILE_VIEWER_KEY = "photocopy-file-viewer";
const NARROW = "(width < 760px)";

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() => matchMedia(query).matches);
  useEffect(() => {
    const list = matchMedia(query);
    const update = () => setMatches(list.matches);
    list.addEventListener("change", update);
    return () => list.removeEventListener("change", update);
  }, [query]);
  return matches;
}

function savedFileViewerOpen() {
  try {
    return localStorage.getItem(FILE_VIEWER_KEY) !== "closed";
  } catch {
    return true;
  }
}

/** Asks the browser not to evict saved work under storage pressure. */
function persistStorage() {
  navigator.storage?.persist?.().catch(() => {});
}

/**
 * Only the open artboard is loaded: each photo can take tens of megabytes of
 * canvas memory, so the rest wait in IndexedDB until they're opened.
 */
export function App() {
  const [artboards, setArtboards] = useState<ArtboardSummary[] | null>(null);
  const [activeId, setActiveId] = useState("");
  // Bumped to load the open artboard again from storage.
  const [reloadKey, setReloadKey] = useState(0);
  /** Background removals in flight, by layer id. */
  const [removals, setRemovals] = useState<
    Record<string, Removal & { artboardId: string }>
  >({});
  const isNarrow = useMediaQuery(NARROW);
  const [isFileViewerOpen, setIsFileViewerOpen] = useState(savedFileViewerOpen);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const editorRef = useRef<ArtboardEditorHandle>(null);
  const isSwitching = useRef(false);
  // For async work that finishes after a switch.
  const editorKey = `${activeId}:${reloadKey}`;
  const latestEditorKey = useRef(editorKey);
  latestEditorKey.current = editorKey;
  const latestActiveId = useRef(activeId);
  latestActiveId.current = activeId;
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
        setArtboards([{ id, backgroundId: "" }]);
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

  useEffect(() => {
    try {
      localStorage.setItem(
        FILE_VIEWER_KEY,
        isFileViewerOpen ? "open" : "closed",
      );
    } catch {
      // Storage can be unavailable; the file viewer still toggles.
    }
  }, [isFileViewerOpen]);

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

  function switchBy(direction: 1 | -1) {
    if (!artboards || artboards.length < 2) return;
    const index = artboards.findIndex((artboard) => artboard.id === activeId);
    open(
      artboards[(index + direction + artboards.length) % artboards.length].id,
    );
  }

  async function handleNew() {
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

  async function handleDuplicate(id: string) {
    try {
      if (id === activeId) await editorRef.current?.flush();
      const copy = await duplicateArtboard(id);
      if (!copy) return;
      setArtboards((current) => {
        const next = [...(current ?? [])];
        next.splice(
          next.findIndex((artboard) => artboard.id === id) + 1,
          0,
          copy,
        );
        return next;
      });
      persistStorage();
    } catch (cause) {
      reportError("Couldn’t duplicate the artboard.", cause);
    }
  }

  async function handleDelete(id: string) {
    if (!artboards) return;
    const index = artboards.findIndex((artboard) => artboard.id === id);
    if (index < 0) return;
    let remaining = artboards.filter((artboard) => artboard.id !== id);
    try {
      // There's always an artboard to work in.
      if (remaining.length === 0) {
        remaining = [await createArtboard(savedBackground().id)];
      }
      setArtboards(remaining);
      if (id === latestActiveId.current) {
        await open(remaining[Math.min(index, remaining.length - 1)].id);
      }
      await deleteArtboard(id);
    } catch (cause) {
      reportError("Couldn’t delete the artboard.", cause);
    }
  }

  function handleReorder(order: string[]) {
    setArtboards((current) => {
      const byId = new Map(current?.map((artboard) => [artboard.id, artboard]));
      return order.flatMap((id) => byId.get(id) ?? []);
    });
  }

  const handleThumbnail = useCallback(
    (thumbnail: Blob) => {
      setArtboards(
        (current) =>
          current?.map((artboard) =>
            artboard.id === activeId ? { ...artboard, thumbnail } : artboard,
          ) ?? current,
      );
      saveThumbnail(activeId, thumbnail).catch((cause) =>
        console.warn("Couldn’t save the thumbnail", cause),
      );
    },
    [activeId],
  );

  /**
   * Background removal runs here rather than in the editor, so it keeps going
   * when its artboard is closed, and lands wherever that artboard is.
   */
  const handleRemoveBackground = useCallback(
    async (layer: Layer) => {
      const artboardId = activeId;
      const session = latestEditorKey.current;
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
          if (editor && latestActiveId.current === artboardId) {
            // Opened again since, the photo couldn't change while its
            // removal was in flight, so the cutout still fits.
            const sameEditor = latestEditorKey.current === session;
            editor.applyCutout(id, sameEditor ? revision : null, cutout);
          } else {
            await applyStoredCutout(
              artboardId,
              id,
              await maskBlob({ width, height }, cutout),
            );
          }
        } finally {
          cutout.close();
        }
      } catch (cause) {
        console.error(cause);
        if (latestActiveId.current === artboardId) {
          editorRef.current?.showError(
            "Background removal failed. Check your connection and try again.",
          );
        }
      } finally {
        isDone = true;
        setProgress(null);
      }
    },
    [activeId],
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

  if (!artboards) return <div className="app" />;

  const fileViewer = (
    <FileViewer
      artboards={artboards}
      activeId={activeId}
      busyIds={busyIds}
      onOpen={open}
      onNew={handleNew}
      onDuplicate={handleDuplicate}
      onDelete={handleDelete}
      onReorder={handleReorder}
    />
  );
  const showsFileViewer = !isNarrow && isFileViewerOpen;

  return (
    <div className="app" data-file-viewer={showsFileViewer || undefined}>
      <h1 className="visually-hidden">Photocopy</h1>
      {showsFileViewer && (
        <nav className="file-viewer-panel" aria-label="Artboards">
          {fileViewer}
        </nav>
      )}
      <ArtboardEditor
        key={editorKey}
        ref={editorRef}
        artboardId={activeId}
        removals={activeRemovals}
        needsThumbnail={
          !artboards.find((artboard) => artboard.id === activeId)?.thumbnail
        }
        toolbarStart={
          <ToolToggleButton
            label="Show artboards"
            shortcut={`${SHORTCUTS.previousArtboard} ${SHORTCUTS.nextArtboard}`}
            isSelected={isNarrow ? isDrawerOpen : isFileViewerOpen}
            onChange={(isOpen) =>
              isNarrow ? setIsDrawerOpen(isOpen) : setIsFileViewerOpen(isOpen)
            }
          >
            <SidebarIcon />
          </ToolToggleButton>
        }
        onRemoveBackground={handleRemoveBackground}
        onThumbnail={handleThumbnail}
        onSwitchArtboard={switchBy}
        onReload={() => setReloadKey((key) => key + 1)}
      />
      {isNarrow && (
        <ModalOverlay
          className="modal-overlay drawer-overlay"
          isDismissable
          isOpen={isDrawerOpen}
          onOpenChange={setIsDrawerOpen}
        >
          <Modal className="drawer">
            <Dialog aria-label="Artboards" className="drawer-dialog">
              {fileViewer}
            </Dialog>
          </Modal>
        </ModalOverlay>
      )}
    </div>
  );
}

function indexKey(artboards: ArtboardSummary[], activeId: string) {
  return `${artboards.map((artboard) => artboard.id).join()}|${activeId}`;
}

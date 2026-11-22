import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import { ProgressBar } from "react-aria-components";
import { cacheArtboard, cachedArtboard } from "../core/artboardCache";
import { canvasSize } from "../core/canvasFormat";
import { creditsOf } from "../core/credits";
import {
  editorReducer,
  initialEditorState,
  placeNewPhotos,
  selectionState,
  shortcutAction,
  statusMessage,
} from "../core/editor";
import {
  copyLayer,
  isCopiedLayer,
  LAYER_CLIPBOARD_TYPE,
  pasteLayer,
} from "../core/layerClipboard";
import {
  croppableBounds,
  cropToVisible,
  loadPhoto,
  nextRevision,
  setMask,
} from "../core/layers";
import {
  isQuotaError,
  QUOTA_MESSAGE,
  restoreArtboard,
  saveSource,
} from "../core/persistence";
import { shortcutFor } from "../core/shortcuts";
import { saveBackground, savedBackground } from "../core/themes";
import type {
  ArtboardState,
  CanvasFormat,
  Credit,
  Layer,
  Removal,
} from "../core/types";
import { createValueStore } from "../core/valueStore";
import { FIT_VIEWPORT, type Viewport } from "../core/zoom";
import { useArtboardLock } from "../hooks/useArtboardLock";
import { useAutosave } from "../hooks/useAutosave";
import { useBrushPreview } from "../hooks/useBrushPreview";
import { type EditorCommands, EditorContext } from "../hooks/useEditor";
import { useEventListener } from "../hooks/useEventListener";
import { useExport } from "../hooks/useExport";
import { useHistory } from "../hooks/useHistory";
import { usePreview } from "../hooks/usePreview";
import { useThumbnail } from "../hooks/useThumbnail";
import { AboutDialog } from "./AboutDialog";
import styles from "./ArtboardEditor.module.css";
import { Canvas, type CanvasHandle } from "./Canvas";
import { ControlStrip } from "./ControlStrip";
import { ExportDialog } from "./ExportDialog";
import { ImageSearch } from "./ImageSearch";
import { LayerToolbar } from "./LayerToolbar";

export interface ArtboardEditorHandle {
  flush: () => Promise<void>;
  /** `revision` is the photo's version when removal started, or null if reopened since. */
  applyCutout: (
    layerId: string,
    revision: number | null,
    cutout: ImageBitmap,
  ) => void;
  showError: (message: string) => void;
}

export interface ArtboardEditorProps {
  artboardId: string;
  removals: Record<string, Removal>;
  needsThumbnail: boolean;
  toolbarStart?: React.ReactNode;
  isArtboardListShown: boolean;
  onArtboardListShownChange: (isShown: boolean) => void;
  onRemoveBackground: (layer: Layer) => void;
  onThumbnail: (thumbnail: Blob) => void;
  onSaved: (id: string, canvasFormat: CanvasFormat) => void;
  onSwitchArtboard: (direction: 1 | -1) => void;
  onReload: () => void;
  ref?: React.Ref<ArtboardEditorHandle>;
}

/** Fields, dialogs, menus and the artboard list handle their own keys and clipboard. */
function isOwnInputTarget(event: Event) {
  return (
    event.defaultPrevented ||
    (event.target as HTMLElement).closest?.(
      "input, textarea, select, [role=dialog], [role=menu], [data-own-keys]",
    ) != null
  );
}

/** Selected text on the page is the browser's to copy. */
const hasNoTextSelected = () => window.getSelection()?.isCollapsed ?? true;

export function ArtboardEditor({
  artboardId,
  removals,
  needsThumbnail,
  toolbarStart,
  isArtboardListShown,
  onArtboardListShownChange,
  onRemoveBackground,
  onThumbnail,
  onSaved,
  onSwitchArtboard,
  onReload,
  ref,
}: ArtboardEditorProps) {
  // Reopened from the cache, it shows at once, without loading or decoding.
  const [cached] = useState(() => cachedArtboard(artboardId));
  const [state, dispatch] = useReducer(
    editorReducer,
    savedBackground(),
    (background) => ({
      ...initialEditorState(background),
      ...cached?.state,
    }),
  );
  const { layers, settings, canvasFormat, background, selectedId, tool } =
    state;
  // What was loaded, or null for a new artboard; undefined while loading.
  const [restored, setRestored] = useState<ArtboardState | null | undefined>(
    cached?.state,
  );
  const isRestored = restored !== undefined;
  const [error, setError] = useState<string | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [isSizingBrush, showBrushSize] = useBrushPreview();
  // The toolbar's zoom level; a store, so zooming re-renders only that.
  const [zoom] = useState(() => createValueStore(1));
  const canvasRef = useRef<CanvasHandle>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  // For work that finishes later, like background removal, and for commands.
  const latestLayers = useRef(layers);
  latestLayers.current = layers;
  const latestSelected = useRef<Layer | null>(null);
  const lock = useArtboardLock(artboardId, onReload);

  useEffect(() => {
    if (cached) return;
    let isCurrent = true;
    restoreArtboard(artboardId).then((loaded) => {
      if (!isCurrent) return;
      if (loaded) dispatch({ type: "load", state: loaded });
      setRestored(loaded);
    });
    return () => {
      isCurrent = false;
    };
  }, [artboardId, cached]);

  // The last background picked becomes the default for new artboards.
  useEffect(() => {
    if (isRestored) saveBackground(background);
  }, [background, isRestored]);

  const content = useMemo<ArtboardState>(
    () => ({ layers, settings, canvasFormat, background }),
    [layers, settings, canvasFormat, background],
  );
  // Kept for the cache on close; only while this tab holds the artboard, so it's current.
  const viewport = useRef<Viewport>(cached?.viewport ?? FIT_VIEWPORT);
  const rememberViewport = useCallback((next: Viewport) => {
    viewport.current = next;
  }, []);
  const closing = useRef({ content, isRestored, lock });
  closing.current = { content, isRestored, lock };
  useEffect(
    () => () => {
      const { content, isRestored, lock } = closing.current;
      if (isRestored && lock === "held") {
        cacheArtboard(artboardId, {
          state: content,
          viewport: viewport.current,
        });
      }
    },
    [artboardId],
  );

  const autosave = useAutosave(artboardId, content, {
    isRestored,
    canSave: lock === "held",
    onError: (cause) => {
      if (isQuotaError(cause)) setError(QUOTA_MESSAGE);
    },
    onSaved: (saved) => onSaved(artboardId, saved.canvasFormat),
  });
  const undoTo = useCallback(
    (snapshot: ArtboardState) => dispatch({ type: "undoTo", state: snapshot }),
    [],
  );
  const { canUndo, canRedo, undo, redo } = useHistory(
    content,
    isRestored,
    undoTo,
  );

  const { width, height } = canvasSize(canvasFormat);
  const artboard = useMemo(() => ({ width, height }), [width, height]);
  const { preview, setViewScale } = usePreview(layers, settings, width, height);

  const saveThumbnail = useThumbnail({
    content,
    restored,
    needsThumbnail,
    width,
    height,
    preview,
    onThumbnail,
  });
  const { photocopy, isExporting, runExport, closeExport } = useExport(
    layers,
    settings,
    width,
    height,
    setError,
  );

  const addFiles = useCallback(
    async (files: File[], credit?: Credit) => {
      setError(null);
      let added: Layer[];
      try {
        const places = placeNewPhotos(files.length, { width, height });
        added = await Promise.all(
          files.map((file, index) => loadPhoto(file, places[index], credit)),
        );
      } catch {
        setError("Couldn’t open one of those files as an image.");
        return;
      }
      // Stored before the layers exist, so autosave never sees them unsaved.
      try {
        await Promise.all(added.map((layer) => saveSource(layer)));
      } catch (cause) {
        console.warn("Couldn’t save photo locally", cause);
        if (isQuotaError(cause)) setError(QUOTA_MESSAGE);
      }
      dispatch({ type: "addLayers", layers: added });
    },
    [width, height],
  );

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
      /** Through the browser's copy or cut event, to reach the system clipboard where it fires one. */
      copy(isCut: boolean) {
        const run = { isHandled: false };
        copying.current = run;
        try {
          document.execCommand(isCut ? "cut" : "copy");
        } finally {
          copying.current = null;
        }
        // Safari fires no event with nothing selected on the page.
        if (!run.isHandled) copySelected(isCut, null);
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
  }, [artboard]);

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

  const commands = useMemo<EditorCommands>(() => {
    const find = (id: string) =>
      latestLayers.current.find((layer) => layer.id === id);
    return {
      dispatch,
      undo,
      redo,
      copy: () => clipboard.copy(false),
      cut: () => clipboard.copy(true),
      paste: clipboard.paste,
      addFiles,
      removeBackground(layerId) {
        const layer = find(layerId);
        if (!layer || layer.backgroundRemoved) return;
        setError(null);
        dispatch({ type: "stopRefining", layerId });
        onRemoveBackground(layer);
      },
      cropToVisible(layerId) {
        const layer = find(layerId);
        const cropped = layer && cropToVisible(layer);
        if (cropped) dispatch({ type: "replaceLayer", layer: cropped });
      },
      showBrushSize,
      zoom: (action) => canvasRef.current?.zoom(action),
      reportZoom(scale) {
        zoom.set(scale);
        setViewScale(scale);
      },
      openUpload: () => fileInput.current?.click(),
      openSearch: () => setIsSearchOpen(true),
      openAbout: () => setIsAboutOpen(true),
    };
  }, [
    undo,
    redo,
    clipboard,
    addFiles,
    onRemoveBackground,
    showBrushSize,
    zoom,
    setViewScale,
  ]);

  // Leaving the page (or switching apps on a phone) may be the last chance.
  useEventListener(document, "visibilitychange", () => {
    if (document.visibilityState !== "hidden") return;
    autosave.flush();
    saveThumbnail();
  });

  useImperativeHandle(
    ref,
    () => ({
      async flush() {
        await Promise.all([autosave.flush(), saveThumbnail()]);
      },
      applyCutout(layerId, revision, cutout) {
        // The cutout only fits the photo version it started from.
        const current = latestLayers.current.find(
          (other) => other.id === layerId,
        );
        if (!current || (revision !== null && current.revision !== revision)) {
          if (current) {
            setError("The photo changed during background removal. Try again.");
          }
          return;
        }
        setMask(current, cutout);
        dispatch({
          type: "updateLayer",
          id: layerId,
          changes: { backgroundRemoved: true, revision: nextRevision() },
        });
      },
      showError: setError,
    }),
    [autosave, saveThumbnail],
  );

  const { selected, removal, ...selection } = selectionState(state, removals);
  latestSelected.current = selected;
  // Reads the selected photo's pixels, so only when its mask or crop changes.
  // biome-ignore lint/correctness/useExhaustiveDependencies: keyed on the canvas and revision, not the layer object
  const canCropSelected = useMemo(
    () => (selected ? croppableBounds(selected) !== null : false),
    [selected?.composed, selected?.revision],
  );
  // Every removal in flight, as one bar: the photos' average progress.
  const allRemovals = Object.values(removals);
  const removalProgress =
    allRemovals.length > 0
      ? allRemovals.reduce((sum, { fraction }) => sum + fraction, 0) /
        allRemovals.length
      : null;
  const status = statusMessage(lock === "elsewhere", removal, tool);
  const credits = useMemo(() => creditsOf(layers), [layers]);

  useEventListener(window, "keydown", (event) => {
    if (isOwnInputTarget(event)) return;
    const command = shortcutFor(event);
    if (!command) return;
    if (command === "copy" || command === "cut") {
      if (!selected || !hasNoTextSelected()) return;
      event.preventDefault();
      clipboard.copy(command === "cut");
      return;
    }
    const isBrushSize = command === "brushLarger" || command === "brushSmaller";
    if ((command === "delete" || isBrushSize) && !selected) return;
    if (
      (command === "restore" || command === "erase") &&
      !selection.canEditMask
    ) {
      return;
    }
    event.preventDefault();
    const action = shortcutAction(command);
    if (action) {
      dispatch(action);
      if (isBrushSize) showBrushSize();
      return;
    }
    switch (command) {
      case "undo":
        return undo();
      case "redo":
        return redo();
      case "export":
        return void runExport();
      case "zoomIn":
      case "zoomOut":
      case "zoomActual":
      case "zoomDouble":
      case "zoomFit":
        return commands.zoom(command);
      case "previousArtboard":
        return onSwitchArtboard(-1);
      case "nextArtboard":
        return onSwitchArtboard(1);
    }
  });

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

  return (
    <EditorContext value={commands}>
      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(event) => {
          const files = [...(event.target.files ?? [])];
          event.target.value = "";
          if (files.length > 0) addFiles(files);
        }}
      />
      <main
        className={styles.workspace}
        data-has-selection={selectedId !== null || undefined}
      >
        <LayerToolbar
          start={toolbarStart}
          selectedId={selectedId}
          {...selection}
          canCrop={canCropSelected && removal === undefined}
          isRefining={tool !== "move"}
          tool={tool}
          brushSize={state.brushSize}
          canUndo={canUndo}
          canRedo={canRedo}
          isArtboardListShown={isArtboardListShown}
          onArtboardListShownChange={onArtboardListShownChange}
        />
        <div className={styles.canvasArea}>
          {removalProgress !== null && (
            <ProgressBar
              className={styles.progress}
              aria-label="Removing background"
              value={removalProgress * 100}
            >
              {({ percentage }) => (
                <div
                  className={styles.progressFill}
                  style={{ width: `${percentage}%` }}
                />
              )}
            </ProgressBar>
          )}
          <Canvas
            layers={layers}
            artboard={artboard}
            selectedId={selectedId}
            tool={tool}
            brushSize={state.brushSize}
            isSizingBrush={isSizingBrush && selected !== null}
            isMaskMode={tool !== "move"}
            preview={preview}
            canvasFill={background.color}
            initialViewport={cached?.viewport}
            onViewportChange={rememberViewport}
            ref={canvasRef}
          />
          <p className={styles.toast} role="status">
            {status}
          </p>
        </div>
      </main>
      <ControlStrip
        layers={layers}
        selectedId={selectedId}
        settings={settings}
        canvasFormat={canvasFormat}
        background={background}
        isExporting={isExporting}
        error={error}
        onExport={runExport}
      />
      <AboutDialog isOpen={isAboutOpen} onOpenChange={setIsAboutOpen} />
      <ImageSearch isOpen={isSearchOpen} onOpenChange={setIsSearchOpen} />
      <ExportDialog
        photocopy={photocopy}
        background={background.color}
        credits={credits}
        onClose={closeExport}
      />
    </EditorContext>
  );
}

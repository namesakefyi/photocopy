import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
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
import type { ArtboardState, Credit, Layer, Removal } from "../core/types";
import { createValueStore } from "../core/valueStore";
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
import { ProgressLine } from "./ProgressLine";

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
  onRemoveBackground: (layer: Layer) => void;
  onThumbnail: (thumbnail: Blob) => void;
  onSwitchArtboard: (direction: 1 | -1) => void;
  /** Asks to load the artboard again, once another tab has let it go. */
  onReload: () => void;
  ref?: React.Ref<ArtboardEditorHandle>;
}

/** Fields, dialogs, menus and the file viewer handle their own keys and paste. */
function isOwnInputTarget(event: Event) {
  return (
    event.defaultPrevented ||
    (event.target as HTMLElement).closest?.(
      "input, textarea, select, [role=dialog], [role=menu], [data-own-keys]",
    ) != null
  );
}

export function ArtboardEditor({
  artboardId,
  removals,
  needsThumbnail,
  toolbarStart,
  onRemoveBackground,
  onThumbnail,
  onSwitchArtboard,
  onReload,
  ref,
}: ArtboardEditorProps) {
  const [state, dispatch] = useReducer(
    editorReducer,
    savedBackground(),
    initialEditorState,
  );
  const { layers, settings, canvasFormat, background, selectedId, tool } =
    state;
  // What was loaded, or null for a new artboard; undefined while loading.
  const [restored, setRestored] = useState<ArtboardState | null>();
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
  const lock = useArtboardLock(artboardId, onReload);

  useEffect(() => {
    let isCurrent = true;
    restoreArtboard(artboardId).then((loaded) => {
      if (!isCurrent) return;
      if (loaded) dispatch({ type: "load", state: loaded });
      setRestored(loaded);
    });
    return () => {
      isCurrent = false;
    };
  }, [artboardId]);

  // The last background picked becomes the default for new artboards.
  useEffect(() => {
    if (isRestored) saveBackground(background);
  }, [background, isRestored]);

  const content = useMemo<ArtboardState>(
    () => ({ layers, settings, canvasFormat, background }),
    [layers, settings, canvasFormat, background],
  );
  const reportSaveError = useCallback((cause: unknown) => {
    if (isQuotaError(cause)) setError(QUOTA_MESSAGE);
  }, []);
  const autosave = useAutosave(artboardId, content, {
    isRestored,
    canSave: lock === "held",
    onError: reportSaveError,
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
  const { photocopy, isCopying, runExport, closeExport } = useExport(
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
        await Promise.all(
          added.map((layer, index) => saveSource(layer, files[index])),
        );
      } catch (cause) {
        console.warn("Couldn’t save photo locally", cause);
        if (isQuotaError(cause)) setError(QUOTA_MESSAGE);
      }
      dispatch({ type: "addLayers", layers: added });
    },
    [width, height],
  );

  const commands = useMemo<EditorCommands>(() => {
    const find = (id: string) =>
      latestLayers.current.find((layer) => layer.id === id);
    return {
      dispatch,
      undo,
      redo,
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
    addFiles,
    onRemoveBackground,
    showBrushSize,
    zoom,
    setViewScale,
  ]);

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

  useEventListener(window, "paste", (event) => {
    if (isOwnInputTarget(event)) return;
    const files = [...(event.clipboardData?.files ?? [])].filter((file) =>
      file.type.startsWith("image/"),
    );
    if (files.length === 0) return;
    event.preventDefault();
    addFiles(files);
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
      <main className={styles.workspace}>
        <LayerToolbar
          start={toolbarStart}
          selectedId={selectedId}
          {...selection}
          canCrop={canCropSelected && removal === undefined}
          isRefining={state.isRefining}
          tool={tool}
          brushSize={state.brushSize}
          canUndo={canUndo}
          canRedo={canRedo}
          zoom={zoom}
        />
        <div className={styles.canvasArea}>
          {removalProgress !== null && (
            <ProgressLine
              label="Removing background"
              fraction={removalProgress}
            />
          )}
          <Canvas
            layers={layers}
            artboard={artboard}
            selectedId={selectedId}
            tool={tool}
            brushSize={state.brushSize}
            isSizingBrush={isSizingBrush && selected !== null}
            isMaskMode={state.isRefining}
            preview={preview}
            canvasFill={background.color}
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
        isCopying={isCopying}
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

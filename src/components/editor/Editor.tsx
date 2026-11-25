import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import { canvasSize } from "../../core/canvasFormat";
import { creditsOf } from "../../core/credits";
import {
  editorReducer,
  initialEditorState,
  placeNewPhotos,
  selectionState,
  shortcutAction,
  statusMessage,
} from "../../core/editor";
import {
  croppableBounds,
  cropToVisible,
  loadPhoto,
  nextRevision,
  setMask,
} from "../../core/layers";
import {
  isQuotaError,
  QUOTA_MESSAGE,
  saveSource,
} from "../../core/persistence";
import { SHORTCUTS, shortcutFor } from "../../core/shortcuts";
import { saveBackground, savedBackground, themeById } from "../../core/themes";
import type { ArtboardState, Credit, Layer, Removal } from "../../core/types";
import { createValueStore } from "../../core/valueStore";
import { useArtboardSync } from "../../hooks/editor/useArtboardSync";
import { useBrushPreview } from "../../hooks/editor/useBrushPreview";
import {
  type EditorCommands,
  EditorContext,
  type EditorStatus,
} from "../../hooks/editor/useEditor";
import { useExport } from "../../hooks/editor/useExport";
import { useHistory } from "../../hooks/editor/useHistory";
import {
  hasNoTextSelected,
  isOwnInputTarget,
  useLayerClipboard,
} from "../../hooks/editor/useLayerClipboard";
import { usePreview } from "../../hooks/editor/usePreview";
import { useEventListener } from "../../hooks/useEventListener";
import { useRemovals, useWorkspace } from "../../hooks/workspace/useWorkspace";
import { ExportDialog } from "../dialogs/ExportDialog";
import { ImageSearchDialog } from "../dialogs/ImageSearchDialog";
import { MenuBar } from "../menubar/MenuBar";
import { ControlPanes } from "../panes/ControlPanes";
import { LayerToolbar } from "../toolbar/LayerToolbar";
import { SidebarIcon } from "../ui/icons";
import { ToolToggleButton } from "../ui/ToolButton";
import { Canvas, type CanvasHandle } from "./Canvas";
import styles from "./Editor.module.css";
import { Progress, type ProgressProps } from "./Progress";

export interface EditorHandle {
  flush: () => Promise<void>;
  /** `revision` is the photo's version when removal started. */
  applyCutout: (layerId: string, revision: number, cutout: ImageBitmap) => void;
  showError: (message: string) => void;
}

export interface EditorProps {
  ref?: React.Ref<EditorHandle>;
}

export function Editor({ ref }: EditorProps) {
  const workspace = useWorkspace();
  const { activeId: artboardId, activeArtboard: summary } = workspace;
  const removals = useRemovals().active;
  const [state, dispatch] = useReducer(editorReducer, summary, (summary) =>
    summary
      ? {
          ...initialEditorState(themeById(summary.backgroundId)),
          settings: summary.settings,
          canvasFormat: summary.canvasFormat,
        }
      : initialEditorState(savedBackground()),
  );
  const { layers, settings, canvasFormat, background, selectedId, tool } =
    state;
  const content = useMemo<ArtboardState>(
    () => ({ layers, settings, canvasFormat, background }),
    [layers, settings, canvasFormat, background],
  );
  const [error, setError] = useState<string | null>(null);
  const sync = useArtboardSync(artboardId, content, {
    onLoad: (loaded) => dispatch({ type: "load", state: loaded }),
    onSaved: (saved) => workspace.setSaved(artboardId, saved),
    onSaveError: (cause) => {
      if (isQuotaError(cause)) setError(QUOTA_MESSAGE);
    },
  });
  const { restored, isRestored } = sync;
  const { isNarrow } = workspace;
  const listedLayers = isRestored ? layers : (summary?.layers ?? []);
  const canExport = listedLayers.some((layer) => layer.visible);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isSizingBrush, showBrushSize] = useBrushPreview();
  const canvasRef = useRef<CanvasHandle>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  // For work that finishes later, like background removal, and for commands.
  const latestLayers = useRef(layers);
  latestLayers.current = layers;
  const latestSelected = useRef<Layer | null>(null);

  // The last background picked becomes the default for new artboards.
  useEffect(() => {
    if (isRestored) saveBackground(background);
  }, [background, isRestored]);

  const undoTo = useCallback(
    (snapshot: ArtboardState) => dispatch({ type: "undoTo", state: snapshot }),
    [],
  );
  const { canUndo, canRedo, undo, redo } = useHistory(
    content,
    isRestored,
    undoTo,
  );

  const { selected, removal, ...selection } = selectionState(state, removals);
  latestSelected.current = selected;
  // Reads the selected photo's pixels, so only when its mask or crop changes.
  // biome-ignore lint/correctness/useExhaustiveDependencies: keyed on the canvas and revision, not the layer object
  const canCropSelected = useMemo(
    () => (selected ? croppableBounds(selected) !== null : false),
    [selected?.composed, selected?.revision],
  );
  const nextStatus: EditorStatus = {
    canUndo,
    canRedo,
    canCopy: selectedId !== null,
    canExport,
    selectedId,
    tool,
    brushSize: state.brushSize,
    ...selection,
    canCrop: canCropSelected && removal === undefined,
  };
  const [statusStore] = useState(() => createValueStore(nextStatus));
  useLayoutEffect(() => {
    const shown = statusStore.get();
    const keys = Object.keys(nextStatus) as (keyof EditorStatus)[];
    if (keys.some((key) => shown[key] !== nextStatus[key])) {
      statusStore.set(nextStatus);
    }
  });

  const { width, height } = canvasSize(canvasFormat);
  const artboard = useMemo(() => ({ width, height }), [width, height]);
  const { preview, setViewScale, saveThumbnail } = usePreview({
    content,
    width,
    height,
    restored,
    needsThumbnail: !summary?.thumbnail,
    onThumbnail: workspace.setThumbnail,
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

  const clipboard = useLayerClipboard({
    artboard,
    latestLayers,
    latestSelected,
    dispatch,
    addFiles,
    setError,
  });

  // Read when a command runs, so the commands stay the same object across edits.
  const current = { runExport, isRestored };
  const latest = useRef(current);
  latest.current = current;

  const commands = useMemo<EditorCommands>(() => {
    const find = (id: string) =>
      latestLayers.current.find((layer) => layer.id === id);
    return {
      dispatch,
      undo,
      redo,
      copy: () => clipboard.copySelected(false, null),
      cut: () => clipboard.copySelected(true, null),
      paste: clipboard.paste,
      addFiles,
      removeBackground(layerId) {
        const layer = find(layerId);
        if (!layer || layer.backgroundRemoved) return;
        setError(null);
        dispatch({ type: "stopRefining", layerId });
        workspace.startBackgroundRemoval(layer);
      },
      cropToVisible(layerId) {
        const layer = find(layerId);
        const cropped = layer && cropToVisible(layer);
        if (cropped) dispatch({ type: "replaceLayer", layer: cropped });
      },
      showBrushSize,
      zoom: (action) => canvasRef.current?.zoom(action),
      reportZoom: setViewScale,
      openUpload: () => fileInput.current?.click(),
      openSearch: () => setIsSearchOpen(true),
      export() {
        if (latest.current.isRestored) latest.current.runExport();
      },
      status: statusStore,
    };
  }, [
    undo,
    redo,
    clipboard,
    addFiles,
    workspace.startBackgroundRemoval,
    showBrushSize,
    setViewScale,
    statusStore,
  ]);

  // Leaving the page (or switching apps on a phone) may be the last chance.
  useEventListener(document, "visibilitychange", () => {
    if (document.visibilityState !== "hidden") return;
    sync.flush();
    saveThumbnail();
  });

  useImperativeHandle(
    ref,
    () => ({
      async flush() {
        await Promise.all([sync.flush(), saveThumbnail()]);
      },
      applyCutout(layerId, revision, cutout) {
        // The cutout only fits the photo version it started from.
        const current = latestLayers.current.find(
          (other) => other.id === layerId,
        );
        if (!current || current.revision !== revision) {
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
    [sync.flush, saveThumbnail],
  );

  const status = statusMessage(tool);
  const progress = removalProgress(Object.values(removals));
  const credits = useMemo(() => creditsOf(layers), [layers]);

  useEventListener(window, "keydown", (event) => {
    if (isOwnInputTarget(event)) return;
    const command = shortcutFor(event);
    if (!command) return;
    if (command === "copy" || command === "cut") {
      if (!selected || !hasNoTextSelected()) return;
      clipboard.expectCopyEvent(command === "cut");
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
        return commands.export();
      case "zoomIn":
      case "zoomOut":
      case "zoomActual":
      case "zoomDouble":
      case "zoomFit":
        return commands.zoom(command);
      case "previousArtboard":
        return workspace.switchArtboard(-1);
      case "nextArtboard":
        return workspace.switchArtboard(1);
    }
  });

  const controls = (
    <ControlPanes
      isNarrow={isNarrow}
      layers={listedLayers}
      selectedId={selectedId}
      settings={settings}
      canvasFormat={canvasFormat}
      background={background}
      isExporting={isExporting}
      error={error}
      onExport={commands.export}
    />
  );

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
        className={styles.editor}
        data-has-selection={selectedId !== null || undefined}
      >
        <div className={styles.toolbar}>
          <SidebarToggle />
          <MenuBar />
          <LayerToolbar />
        </div>
        <div className={styles.canvasArea}>
          {progress && <Progress {...progress} />}
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
            isEmpty={isRestored && layers.length === 0}
            ref={canvasRef}
          />
          <p className={styles.toast} role="status">
            {status && (
              <>
                {status.label}
                <span className={styles.toastHint}> · {status.hint}</span>
              </>
            )}
          </p>
          {isNarrow && controls}
        </div>
      </main>
      {!isNarrow && controls}
      <ImageSearchDialog isOpen={isSearchOpen} onOpenChange={setIsSearchOpen} />
      <ExportDialog
        photocopy={photocopy}
        background={background.color}
        credits={credits}
        onClose={closeExport}
      />
    </EditorContext>
  );
}

function SidebarToggle() {
  const { isArtboardListShown, setArtboardListShown } = useWorkspace();
  return (
    <ToolToggleButton
      className={styles.sidebarToggle}
      label="Show Artboard List"
      shortcut={`${SHORTCUTS.previousArtboard} ${SHORTCUTS.nextArtboard}`}
      isSelected={isArtboardListShown}
      onChange={setArtboardListShown}
    >
      <SidebarIcon />
    </ToolToggleButton>
  );
}

/** Every removal in flight, as one process: the photos' average progress. */
function removalProgress(removals: Removal[]): ProgressProps | null {
  if (removals.length === 0) return null;
  const total = removals.reduce((sum, { fraction }) => sum + fraction, 0);
  const [{ label }] = removals;
  return {
    value: (total / removals.length) * 100,
    message:
      removals.length === 1
        ? `${label}…`
        : `${label}… (${removals.length} photos)`,
  };
}

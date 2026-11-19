import {
  useCallback,
  useEffect,
  useEffectEvent,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  canvasSize,
  DEFAULT_CANVAS,
  type FitMemory,
  fitLayersToCanvas,
  MAX_CANVAS_SIZE,
} from "../canvasFormat";
import { makePhotocopy, type Photocopy } from "../copy";
import { type ArtboardState, useHistory } from "../history";
import {
  composeLayer,
  croppableBounds,
  cropToVisible,
  loadPhoto,
  nextRevision,
  setMask,
} from "../layers";
import {
  isQuotaError,
  QUOTA_MESSAGE,
  restoreArtboard,
  saveSource,
  useAutosave,
} from "../persistence";
import { DEFAULT_SETTINGS, type PhotocopySettings } from "../photocopy";
import { renderPreview } from "../photocopyClient";
import { sameRegion } from "../render";
import { shortcutFor } from "../shortcuts";
import { saveBackground, savedBackground, type Theme } from "../themes";
import { renderThumbnail } from "../thumbnail";
import type {
  CanvasFormat,
  Credit,
  Layer,
  LayerChanges,
  Region,
  Removal,
  Tool,
} from "../types";
import { createValueStore } from "../valueStore";
import { resolutionStep, screenPixelRatio } from "../zoom";
import { AboutDialog } from "./AboutDialog";
import { MAX_BRUSH, MIN_BRUSH } from "./BrushSizeMenu";
import { Canvas, type CanvasHandle } from "./Canvas";
import { CanvasPanel, CanvasPresetPicker } from "./CanvasPanel";
import { ControlStrip } from "./ControlStrip";
import { CopyResult } from "./CopyResult";
import { ImageSearch } from "./ImageSearch";
import { LayerList } from "./LayerList";
import {
  type LayerAction,
  type LayerActionsProps,
  LayerToolbar,
} from "./LayerToolbar";
import { ProgressLine } from "./ProgressLine";

const PREVIEW_DELAY = 150;
const THUMBNAIL_DELAY = 1000;
/** How long to wait for another tab to let go before saying it has this open. */
const LOCK_GRACE = 300;
const BRUSH_STEP = 1.25;
const BRUSH_LABELS: Record<Tool, string> = {
  move: "",
  restore: "Erasing mask",
  erase: "Masking",
};

export interface ArtboardEditorHandle {
  flush: () => Promise<void>;
  /**
   * Applies a finished background removal. `revision` is the photo's version
   * when removal started, or null if this editor opened since then.
   */
  applyCutout: (
    layerId: string,
    revision: number | null,
    cutout: ImageBitmap,
  ) => void;
  showError: (message: string) => void;
}

export interface ArtboardEditorProps {
  artboardId: string;
  /** Background removals in flight for this artboard, by layer id. */
  removals: Record<string, Removal>;
  /** No thumbnail is saved yet, so make one even if nothing changes. */
  needsThumbnail: boolean;
  toolbarStart?: React.ReactNode;
  onRemoveBackground: (layer: Layer) => void;
  onThumbnail: (thumbnail: Blob) => void;
  onSwitchArtboard: (direction: 1 | -1) => void;
  /** Asks to load the artboard again, once another tab has let it go. */
  onReload: () => void;
  ref?: React.Ref<ArtboardEditorHandle>;
}

type LockState = "waiting" | "held" | "elsewhere";

/**
 * Holds this artboard's lock while it's open, so two tabs never save over
 * each other. Without the Web Locks API, every tab can edit, as before.
 */
function useArtboardLock(artboardId: string, onRegained: () => void) {
  const [state, setState] = useState<LockState>(() =>
    "locks" in navigator ? "waiting" : "held",
  );
  const regained = useEffectEvent(onRegained);

  useEffect(() => {
    if (!("locks" in navigator)) return;
    const controller = new AbortController();
    let release = () => {};
    let wasElsewhere = false;
    const timer = setTimeout(() => {
      wasElsewhere = true;
      setState("elsewhere");
    }, LOCK_GRACE);
    navigator.locks
      .request(
        `photocopy-artboard:${artboardId}`,
        { signal: controller.signal },
        () => {
          clearTimeout(timer);
          // What loaded while another tab had it may be out of date.
          if (wasElsewhere) regained();
          else setState("held");
          return new Promise<void>((resolve) => {
            release = resolve;
          });
        },
      )
      .catch(() => {});
    return () => {
      clearTimeout(timer);
      controller.abort();
      release();
    };
  }, [artboardId]);

  return state;
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
  const [layers, setLayers] = useState<Layer[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tool, setTool] = useState<Tool>("move");
  const [isRefining, setIsRefining] = useState(false);
  const [brushSize, setBrushSize] = useState(40);
  const [settings, setSettings] = useState<PhotocopySettings>(DEFAULT_SETTINGS);
  const [canvasFormat, setCanvasFormat] =
    useState<CanvasFormat>(DEFAULT_CANVAS);
  const [preview, setPreview] = useState<{
    image: ImageBitmap;
    region: Region;
  } | null>(null);
  // Frees each preview's bitmap once a newer one (or none) replaces it.
  useEffect(() => () => preview?.image.close(), [preview]);
  // What the preview should cover, and at what resolution. Updated from the
  // canvas's view only when one of them changes, so panning and zooming
  // don't re-render the whole app.
  const [previewTarget, setPreviewTarget] = useState<{
    scale: number;
    region: Region;
  }>({ scale: 1, region: { x: 0, y: 0, width: 0, height: 0 } });
  const canvasRef = useRef<CanvasHandle>(null);
  // The toolbar's zoom level; a store, so zooming re-renders only that.
  const [zoom] = useState(() => createValueStore(1));
  const [photocopy, setPhotocopy] = useState<Photocopy | null>(null);
  const [isCopying, setIsCopying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [background, setBackground] = useState<Theme>(savedBackground);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isSizingBrush, setIsSizingBrush] = useState(false);
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const sizingTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const fileInput = useRef<HTMLInputElement>(null);
  const fitMemory = useRef<FitMemory>({});
  // For async work that finishes later, like background removal.
  const latestLayers = useRef(layers);
  latestLayers.current = layers;
  const [isRestored, setIsRestored] = useState(false);
  const lock = useArtboardLock(artboardId, onReload);

  // Compared with the current state to tell when something's changed.
  const restoredContent = useRef<ArtboardState | null>(null);

  useEffect(() => {
    let isCurrent = true;
    restoreArtboard(artboardId).then((restored) => {
      if (!isCurrent) return;
      if (restored) {
        restoredContent.current = restored;
        setLayers(restored.layers);
        setSettings(restored.settings);
        setCanvasFormat(restored.canvasFormat);
        setBackground(restored.background);
      }
      setIsRestored(true);
    });
    return () => {
      isCurrent = false;
    };
  }, [artboardId]);

  const reportSaveError = useCallback((cause: unknown) => {
    if (isQuotaError(cause)) setError(QUOTA_MESSAGE);
  }, []);

  const autosave = useAutosave(
    artboardId,
    { layers, settings, canvasFormat, background },
    { isRestored, canSave: lock === "held", onError: reportSaveError },
  );

  const applyHistory = useCallback((state: ArtboardState) => {
    setLayers(state.layers);
    setSettings(state.settings);
    setCanvasFormat(state.canvasFormat);
    setBackground(state.background);
    setSelectedId((id) =>
      state.layers.some((layer) => layer.id === id) ? id : null,
    );
    setTool("move");
    setIsRefining(false);
  }, []);

  const history = useHistory(
    { layers, settings, canvasFormat, background },
    isRestored,
    applyHistory,
  );
  const previewRequest = useRef(0);

  const artboard = canvasSize(canvasFormat);
  const { width: artboardWidth, height: artboardHeight } = artboard;
  const credits = [
    ...new Map(
      layers
        .filter((layer) => layer.visible && layer.credit)
        .map((layer) => [layer.credit?.sourceUrl, layer.credit as Credit]),
    ).values(),
  ];
  const { region: previewRegion, scale: previewScale } = previewTarget;

  const handleView = useCallback(
    (view: { scale: number; region: Region }) => {
      zoom.set(view.scale);
      setPreviewTarget((current) => {
        const scale = resolutionStep(view.scale * screenPixelRatio());
        const region = {
          x: 0,
          y: 0,
          width: artboardWidth,
          height: artboardHeight,
        };
        return scale === current.scale && sameRegion(region, current.region)
          ? current
          : { scale, region };
      });
    },
    [zoom, artboardWidth, artboardHeight],
  );
  const selectedIndex = layers.findIndex((layer) => layer.id === selectedId);
  const selected = layers[selectedIndex] ?? null;
  const removal = selected ? removals[selected.id] : undefined;
  // Every removal in flight, as one bar: the photos' average progress.
  const allRemovals = Object.values(removals);
  const removalProgress =
    allRemovals.length > 0
      ? allRemovals.reduce((sum, { fraction }) => sum + fraction, 0) /
        allRemovals.length
      : null;
  // Background removal replaces the mask, so mask edits wait for it.
  const canEditMask = selected !== null && removal === undefined;
  const status =
    lock === "elsewhere"
      ? "Open in another tab · Changes here won’t be saved"
      : removal
        ? `${removal.label}…`
        : tool !== "move"
          ? `${BRUSH_LABELS[tool]} · Esc to stop`
          : null;
  // Reads the selected photo's pixels, so only when its mask or crop changes.
  // biome-ignore lint/correctness/useExhaustiveDependencies: keyed on the canvas and revision, not the layer object
  const canCropSelected = useMemo(
    () => (selected ? croppableBounds(selected) !== null : false),
    [selected?.composed, selected?.revision],
  );

  const select = useCallback(
    (id: string | null) => {
      if (id === selectedId) return;
      setSelectedId(id);
      setTool("move");
      setIsRefining(false);
    },
    [selectedId],
  );

  const updateLayer = useCallback((id: string, changes: LayerChanges) => {
    setLayers((current) =>
      current.map((layer) => {
        if (layer.id !== id) return layer;
        return { ...layer, ...changes };
      }),
    );
  }, []);

  const deleteLayer = useCallback(
    (id: string) => {
      setLayers((current) => current.filter((layer) => layer.id !== id));
      if (id === selectedId) select(null);
    },
    [select, selectedId],
  );

  async function addFiles(files: File[], credit?: Credit) {
    setError(null);
    let added: Layer[];
    try {
      added = await Promise.all(
        files.map((file, index) =>
          loadPhoto(
            file,
            {
              x: artboard.width / 2 + index * 60,
              y: artboard.height / 2 + index * 60,
              maxWidth: artboard.width * 0.6,
              maxHeight: artboard.height * 0.6,
            },
            credit,
          ),
        ),
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
    setLayers((current) => [...current, ...added]);
    const last = added.at(-1);
    if (last) select(last.id);
  }

  function moveLayer(direction: 1 | -1) {
    if (selectedIndex < 0) return;
    const target = selectedIndex + direction;
    if (target < 0 || target >= layers.length) return;
    const next = [...layers];
    [next[selectedIndex], next[target]] = [next[target], next[selectedIndex]];
    setLayers(next);
  }

  function cutOut(layer: Layer) {
    setError(null);
    // The cutout replaces the mask, so mask editing waits until it's done.
    if (layer.id === selectedId) changeRefining(false);
    onRemoveBackground(layer);
  }

  useImperativeHandle(
    ref,
    () => ({
      async flush() {
        await Promise.all([autosave.flush(), saveThumbnailNow()]);
      },
      applyCutout(layerId, revision, cutout) {
        // Undo, or a crop or stroke from the right-click menu, may have changed
        // the photo meanwhile; the cutout only fits the version it started from.
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
        composeLayer(current);
        updateLayer(current.id, {
          backgroundRemoved: true,
          revision: nextRevision(),
        });
      },
      showError: setError,
    }),
    [autosave, updateLayer],
  );

  // Only content changes need a new thumbnail, not a zoom's sharper preview.
  const isThumbnailStale = useRef(needsThumbnail);
  useEffect(() => {
    const restored = restoredContent.current;
    if (
      !isRestored ||
      (restored?.layers === layers &&
        restored.settings === settings &&
        restored.canvasFormat === canvasFormat &&
        restored.background === background)
    ) {
      return;
    }
    isThumbnailStale.current = true;
  }, [layers, settings, canvasFormat, background, isRestored]);

  const saveThumbnailNow = useEffectEvent(async () => {
    // Photos without a preview yet would make a blank thumbnail.
    if (!isThumbnailStale.current || (layers.length > 0 && !preview)) return;
    isThumbnailStale.current = false;
    try {
      onThumbnail(await renderThumbnail(artboard, background.color, preview));
    } catch (cause) {
      isThumbnailStale.current = true;
      console.warn("Couldn’t make a thumbnail", cause);
    }
  });

  // biome-ignore lint/correctness/useExhaustiveDependencies: re-runs when the picture changes
  useEffect(() => {
    if (!isRestored) return;
    const timer = setTimeout(saveThumbnailNow, THUMBNAIL_DELAY);
    return () => clearTimeout(timer);
  }, [preview, background.color, isRestored]);

  // Leaving the page (or switching apps on a phone) may be the last chance.
  useEffect(() => {
    function handleHidden() {
      if (document.visibilityState === "hidden") {
        autosave.flush();
        saveThumbnailNow();
      }
    }
    document.addEventListener("visibilitychange", handleHidden);
    return () => document.removeEventListener("visibilitychange", handleHidden);
  }, [autosave]);

  function cropLayer(layer: Layer) {
    const cropped = cropToVisible(layer);
    if (!cropped) return;
    setLayers((current) =>
      current.map((other) => (other.id === layer.id ? cropped : other)),
    );
  }

  // Mask mode always has a brush, starting with Mask itself.
  function changeRefining(next: boolean) {
    setIsRefining(next);
    setTool(next ? "erase" : "move");
  }

  /** Picking a brush opens the mask, so the red overlay shows. */
  function changeTool(next: Tool) {
    if (next === "move") {
      changeRefining(false);
      return;
    }
    setTool(next);
    setIsRefining(true);
  }

  /** Shows the brush's size on the canvas until shortly after it last changes. */
  function showBrushSize() {
    setIsSizingBrush(true);
    clearTimeout(sizingTimer.current);
    sizingTimer.current = setTimeout(() => setIsSizingBrush(false), 700);
  }

  function resizeBrush(direction: 1 | -1) {
    setBrushSize((size) =>
      Math.min(
        MAX_BRUSH,
        Math.max(MIN_BRUSH, Math.round(size * BRUSH_STEP ** direction)),
      ),
    );
    showBrushSize();
  }

  function handleAction(action: LayerAction) {
    switch (action) {
      case "upload":
        fileInput.current?.click();
        return;
      case "search":
        setIsSearchOpen(true);
        return;
      case "export":
        runCopy();
        return;
      case "undo":
        history.undo();
        return;
      case "redo":
        history.redo();
        return;
    }
    if (!selected) return;
    switch (action) {
      case "delete":
        deleteLayer(selected.id);
        break;
      case "removeBackground":
        if (!selected.backgroundRemoved) cutOut(selected);
        break;
      case "crop":
        cropLayer(selected);
        break;
      case "flipX":
        updateLayer(selected.id, { flipX: !selected.flipX });
        break;
      case "flipY":
        updateLayer(selected.id, { flipY: !selected.flipY });
        break;
      case "forward":
        moveLayer(1);
        break;
      case "back":
        moveLayer(-1);
        break;
      case "brushLarger":
        resizeBrush(1);
        break;
      case "brushSmaller":
        resizeBrush(-1);
        break;
    }
  }

  // Keyboard shortcuts for the menu items, skipped while typing, in a dialog,
  // or in a part of the app with keys of its own, like the file viewer.
  const handleShortcut = useEffectEvent((event: KeyboardEvent) => {
    const target = event.target as HTMLElement;
    if (
      event.defaultPrevented ||
      target.closest(
        "input, textarea, select, [role=dialog], [role=menu], [data-own-keys]",
      )
    ) {
      return;
    }
    const command = shortcutFor(event);
    if (!command) return;
    if (command === "delete" && !selected) return;
    if ((command === "restore" || command === "erase") && !canEditMask) return;
    event.preventDefault();
    switch (command) {
      case "zoomIn":
      case "zoomOut":
      case "zoomActual":
      case "zoomDouble":
      case "zoomFit":
        canvasRef.current?.zoom(command);
        return;
      case "restore":
      case "erase":
        changeTool(command);
        return;
      case "escape":
        if (isRefining) changeRefining(false);
        else select(null);
        return;
      case "previousArtboard":
        onSwitchArtboard(-1);
        return;
      case "nextArtboard":
        onSwitchArtboard(1);
        return;
      default:
        handleAction(command);
    }
  });

  useEffect(() => {
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  function changeCanvas(changes: Partial<CanvasFormat>) {
    const next = canvasSize({ ...canvasFormat, ...changes });
    const fitted = fitLayersToCanvas(layers, artboard, next, fitMemory.current);
    fitMemory.current = fitted.memory;
    setLayers(fitted.layers);
    setCanvasFormat((current) => ({ ...current, ...changes }));
  }

  async function runCopy() {
    setIsCopying(true);
    setError(null);
    try {
      const result = await makePhotocopy(
        layers,
        { x: 0, y: 0, ...artboard },
        settings,
        MAX_CANVAS_SIZE,
      );
      if (!result) {
        setError("Nothing to export: the canvas is empty.");
        return;
      }
      setPhotocopy(result);
    } catch (cause) {
      console.error(cause);
      setError("Export failed.");
    } finally {
      setIsCopying(false);
    }
  }

  // The last background picked becomes the default for new artboards.
  useEffect(() => {
    if (isRestored) saveBackground(background);
  }, [background, isRestored]);

  // The region's numbers are the dependencies, not its object identity.
  // biome-ignore lint/correctness/useExhaustiveDependencies: see above
  useEffect(() => {
    if (layers.length === 0 || previewRegion.width === 0) {
      // Also retires any preview still rendering, so it can't land afterward.
      previewRequest.current += 1;
      setPreview(null);
      return;
    }
    const region = previewRegion;
    const request = ++previewRequest.current;
    const pixelScale = previewScale;
    const timer = setTimeout(async () => {
      try {
        const image = await renderPreview(layers, region, pixelScale, settings);
        if (request !== previewRequest.current) {
          image.close();
          return;
        }
        setPreview({ image, region });
      } catch (cause) {
        // The canvas keeps showing the photos themselves; the next change retries.
        console.warn("Preview failed", cause);
        if (request === previewRequest.current) setPreview(null);
      }
    }, PREVIEW_DELAY);
    return () => clearTimeout(timer);
  }, [
    layers,
    settings,
    previewScale,
    previewRegion.x,
    previewRegion.y,
    previewRegion.width,
    previewRegion.height,
  ]);

  // A preview that lands after closing would otherwise never be freed.
  useEffect(
    () => () => {
      previewRequest.current += 1;
    },
    [],
  );

  const layerActions: LayerActionsProps = {
    hasSelection: selected !== null,
    canEditMask,
    canRemoveBackground: canEditMask && !selected.backgroundRemoved,
    canCrop: canCropSelected && removal === undefined,
    canBringForward: selected !== null && selectedIndex < layers.length - 1,
    canSendBack: selected !== null && selectedIndex > 0,
    isRefining,
    tool,
    onAction: handleAction,
    onRefining: changeRefining,
    onTool: changeTool,
    onBrushSize: setBrushSize,
    onShowBrushSize: showBrushSize,
  };

  return (
    <>
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
      <main className="workspace">
        <LayerToolbar
          {...layerActions}
          start={toolbarStart}
          brushSize={brushSize}
          canUndo={history.canUndo}
          canRedo={history.canRedo}
          zoom={zoom}
          onZoom={(action) => canvasRef.current?.zoom(action)}
          onAbout={() => setIsAboutOpen(true)}
        />
        <div className="canvas-area">
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
            brushSize={brushSize}
            isSizingBrush={isSizingBrush && selected !== null}
            isMaskMode={isRefining}
            preview={preview}
            canvasFill={background.color}
            onSelect={select}
            onChange={updateLayer}
            onFiles={addFiles}
            onView={handleView}
            ref={canvasRef}
          />
          {/* Progress and hints, like background removal or the brush in use. */}
          <p className="canvas-toast" role="status">
            {status}
          </p>
        </div>
      </main>
      <ControlStrip
        layers={layers}
        settings={settings}
        isCopying={isCopying}
        error={error}
        onSettings={(changes) =>
          setSettings((current) => ({ ...current, ...changes }))
        }
        onCopy={runCopy}
        onUpload={() => fileInput.current?.click()}
        onSearch={() => setIsSearchOpen(true)}
        canvasPanel={
          <CanvasPanel
            canvasFormat={canvasFormat}
            onCanvas={changeCanvas}
            background={background}
            onBackground={setBackground}
          />
        }
        canvasPresetPicker={
          <CanvasPresetPicker
            canvasFormat={canvasFormat}
            onCanvas={changeCanvas}
          />
        }
        layerList={
          <LayerList
            layers={layers}
            selectedId={selectedId}
            onSelect={select}
            onReorder={setLayers}
            onToggleVisible={(layer) =>
              updateLayer(layer.id, { visible: !layer.visible })
            }
          />
        }
      />
      <AboutDialog isOpen={isAboutOpen} onOpenChange={setIsAboutOpen} />
      <ImageSearch
        isOpen={isSearchOpen}
        onOpenChange={setIsSearchOpen}
        onAdd={(file, credit) => addFiles([file], credit)}
      />
      <CopyResult
        photocopy={photocopy}
        background={background.color}
        credits={credits}
        onClose={() => setPhotocopy(null)}
      />
    </>
  );
}

import {
  useCallback,
  useEffect,
  useEffectEvent,
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
} from "./canvasFormat";
import { AboutDialog } from "./components/AboutDialog";
import { MAX_BRUSH, MIN_BRUSH } from "./components/BrushSizeMenu";
import { Canvas, type CanvasHandle } from "./components/Canvas";
import { CanvasPanel, CanvasPresetPicker } from "./components/CanvasPanel";
import { ControlStrip } from "./components/ControlStrip";
import { CopyResult } from "./components/CopyResult";
import { ImageSearch } from "./components/ImageSearch";
import { LayerList } from "./components/LayerList";
import {
  type LayerAction,
  type LayerActionsProps,
  LayerToolbar,
} from "./components/LayerToolbar";
import { ProgressLine } from "./components/ProgressLine";
import { makePhotocopy, type Photocopy } from "./copy";
import { type DocumentState, useHistory } from "./history";
import {
  composeLayer,
  croppableBounds,
  cropToVisible,
  loadPhoto,
  nextRevision,
  setMask,
} from "./layers";
import { restoreSession, saveSource, useAutosave } from "./persistence";
import { DEFAULT_SETTINGS, type PhotocopySettings } from "./photocopy";
import { renderPreview } from "./photocopyClient";
import { removeBackground } from "./removeBackground";
import { sameRegion } from "./render";
import { shortcutFor } from "./shortcuts";
import { saveBackground, savedBackground, type Theme } from "./themes";
import type {
  CanvasFormat,
  Credit,
  Layer,
  LayerChanges,
  Region,
  Removal,
  Tool,
} from "./types";
import { createValueStore } from "./valueStore";
import { resolutionStep, screenPixelRatio } from "./zoom";

const PREVIEW_DELAY = 150;
const BRUSH_STEP = 1.25;
const BRUSH_LABELS: Record<Tool, string> = {
  move: "",
  restore: "Erasing mask",
  erase: "Masking",
};

export function App() {
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
  const [removals, setRemovals] = useState<Record<string, Removal>>({});
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

  useEffect(() => {
    let isCurrent = true;
    restoreSession().then((session) => {
      if (!isCurrent) return;
      if (session) {
        setLayers(session.layers);
        setSettings(session.settings);
        setCanvasFormat(session.canvasFormat);
      }
      setIsRestored(true);
    });
    return () => {
      isCurrent = false;
    };
  }, []);

  useAutosave(layers, settings, canvasFormat, isRestored);

  const applyHistory = useCallback((state: DocumentState) => {
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
  const status = removal
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
    try {
      const added = await Promise.all(
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
      // Stored before the layers exist, so autosave never sees them unsaved.
      await Promise.all(
        added.map((layer, index) => saveSource(layer, files[index])),
      );
      setLayers((current) => [...current, ...added]);
      const last = added.at(-1);
      if (last) select(last.id);
    } catch {
      setError("Couldn’t open one of those files as an image.");
    }
  }

  function moveLayer(direction: 1 | -1) {
    if (selectedIndex < 0) return;
    const target = selectedIndex + direction;
    if (target < 0 || target >= layers.length) return;
    const next = [...layers];
    [next[selectedIndex], next[target]] = [next[target], next[selectedIndex]];
    setLayers(next);
  }

  async function cutOut(layer: Layer) {
    setError(null);
    // The cutout replaces the mask, so mask editing waits until it's done.
    if (layer.id === selectedId) changeRefining(false);
    setRemovals((current) => ({
      ...current,
      [layer.id]: { label: "Starting", fraction: 0 },
    }));
    // The library keeps reporting progress after it resolves.
    let isDone = false;
    try {
      const cutout = await removeBackground(layer.source, (label, fraction) => {
        if (isDone) return;
        setRemovals((current) => ({
          ...current,
          [layer.id]: { label, fraction },
        }));
      });
      // Undo, or a crop or stroke from the right-click menu, may have changed
      // the photo meanwhile; the cutout only fits the version it started from.
      const current = latestLayers.current.find(
        (other) => other.id === layer.id,
      );
      if (!current || current.revision !== layer.revision) {
        cutout.close();
        if (current) {
          setError("The photo changed during background removal. Try again.");
        }
        return;
      }
      setMask(current, cutout);
      cutout.close();
      composeLayer(current);
      updateLayer(current.id, {
        backgroundRemoved: true,
        revision: nextRevision(),
      });
    } catch (cause) {
      console.error(cause);
      setError(
        "Background removal failed. Check your connection and try again.",
      );
    } finally {
      isDone = true;
      setRemovals(({ [layer.id]: _, ...rest }) => rest);
    }
  }

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

  // Keyboard shortcuts for the menu items, skipped while typing or in a dialog.
  const handleShortcut = useEffectEvent((event: KeyboardEvent) => {
    const target = event.target as HTMLElement;
    if (
      event.defaultPrevented ||
      target.closest("input, textarea, select, [role=dialog], [role=menu]")
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

  useEffect(() => saveBackground(background), [background]);

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
    <div className="app">
      <h1 className="visually-hidden">Photocopy</h1>
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
    </div>
  );
}

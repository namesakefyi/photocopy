import {
  useCallback,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
} from "react";
import { canvasSize, DEFAULT_CANVAS } from "./canvasFormat";
import { AboutDialog } from "./components/AboutDialog";
import { Bed } from "./components/Bed";
import { CommonsSearch } from "./components/CommonsSearch";
import { ControlStrip } from "./components/ControlStrip";
import { CopyResult } from "./components/CopyResult";
import { CustomSizeDialog } from "./components/CustomSizeDialog";
import { ImagePanel } from "./components/ImagePanel";
import { LayerList } from "./components/LayerList";
import {
  LayerMenu,
  type LayerMenuProps,
  type MenuAction,
  MenuBar,
} from "./components/MenuBar";
import { type Copy, makeCopy } from "./copy";
import { type DocumentState, useHistory } from "./history";
import {
  composeLayer,
  croppableBounds,
  cropToVisible,
  loadPhoto,
  setMask,
} from "./layers";
import { restoreSession, saveSource, useAutosave } from "./persistence";
import { DEFAULT_SETTINGS, type PhotocopySettings } from "./photocopy";
import { photocopyImageData } from "./photocopyClient";
import { removeBackground } from "./removeBackground";
import { layerBounds, renderRegion } from "./render";
import { savedTheme, saveTheme, type Theme } from "./themes";
import type {
  CanvasFormat,
  Credit,
  Layer,
  LayerChanges,
  Region,
  Removal,
  Tool,
} from "./types";

const PREVIEW_DELAY = 150;
const MIN_BRUSH = 4;
const MAX_BRUSH = 300;
const BRUSH_STEP = 1.25;
const BRUSH_LABELS: Record<Tool, string> = {
  move: "",
  restore: "Subtract from mask",
  erase: "Add to mask",
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
    canvas: HTMLCanvasElement;
    region: Region;
  } | null>(null);
  const [view, setView] = useState<{ scale: number; region: Region }>({
    scale: 0.2,
    region: { x: 0, y: 0, width: 3000, height: 3000 },
  });
  const [removals, setRemovals] = useState<Record<string, Removal>>({});
  const [copy, setCopy] = useState<Copy | null>(null);
  const [isCopying, setIsCopying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [theme, setTheme] = useState<Theme>(savedTheme);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isSizingBrush, setIsSizingBrush] = useState(false);
  const [isCustomSizeOpen, setIsCustomSizeOpen] = useState(false);
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const sizingTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const fileInput = useRef<HTMLInputElement>(null);
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
    setTheme(state.theme);
    setSelectedId((id) =>
      state.layers.some((layer) => layer.id === id) ? id : null,
    );
    setTool("move");
  }, []);

  const history = useHistory(
    { layers, settings, canvasFormat, theme },
    isRestored,
    applyHistory,
  );
  const previewRequest = useRef(0);

  const artboard = canvasSize(canvasFormat);
  const credits = [
    ...new Map(
      layers
        .filter((layer) => layer.visible && layer.credit)
        .map((layer) => [layer.credit?.sourceUrl, layer.credit as Credit]),
    ).values(),
  ];
  const isTrimmed = canvasFormat.preset === "trimmed";
  // Trimmed canvases have no edges, so the preview covers whatever the bed shows.
  const previewRegion: Region = isTrimmed
    ? view.region
    : { x: 0, y: 0, ...artboard };
  const selectedIndex = layers.findIndex((layer) => layer.id === selectedId);
  const selected = layers[selectedIndex] ?? null;
  const removal = selected ? removals[selected.id] : undefined;
  const status = removal
    ? `${removal.label}… ${Math.round(removal.fraction * 100)}%`
    : tool !== "move"
      ? `${BRUSH_LABELS[tool]} · ${brushSize} px · Esc to stop`
      : isRefining
        ? "Mask shown: choose Add to Mask or Subtract from Mask"
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
      setMask(layer, cutout);
      cutout.close();
      composeLayer(layer);
      updateLayer(layer.id, {
        backgroundRemoved: true,
        revision: layer.revision + 1,
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

  function changeRefining(next: boolean) {
    setIsRefining(next);
    if (!next) setTool("move");
  }

  /** Picking a brush opens Refine Mask, so the red overlay shows. */
  function changeTool(next: Tool) {
    setTool(next);
    if (next !== "move") setIsRefining(true);
  }

  function resizeBrush(direction: 1 | -1) {
    setBrushSize((size) =>
      Math.min(
        MAX_BRUSH,
        Math.max(MIN_BRUSH, Math.round(size * BRUSH_STEP ** direction)),
      ),
    );
    setIsSizingBrush(true);
    clearTimeout(sizingTimer.current);
    sizingTimer.current = setTimeout(() => setIsSizingBrush(false), 700);
  }

  function handleMenuAction(action: MenuAction) {
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
      case "deselect":
        select(null);
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
    const mod = event.metaKey || event.ctrlKey;
    const key = event.key.toLowerCase();
    let action: MenuAction | null = null;
    if (mod && key === "z") action = event.shiftKey ? "redo" : "undo";
    else if (mod && key === "y") action = "redo";
    else if (mod && key === "e") action = "export";
    else if (mod && key === "]") action = "forward";
    else if (mod && key === "[") action = "back";
    else if (mod) return;
    else if (key === "]") action = "brushLarger";
    else if (key === "[") action = "brushSmaller";
    else if ((key === "delete" || key === "backspace") && selected)
      action = "delete";
    else if (key === "b" && selected) {
      changeTool("restore");
    } else if (key === "e" && selected) {
      changeTool("erase");
    } else if (key === "escape") {
      if (tool !== "move") setTool("move");
      else if (isRefining) changeRefining(false);
      else select(null);
    } else return;
    event.preventDefault();
    if (action) handleMenuAction(action);
  });

  useEffect(() => {
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  /** Keeps photos in the same relative spot when the canvas changes size. */
  function changeCanvas(changes: Partial<CanvasFormat>) {
    const next = canvasSize({ ...canvasFormat, ...changes });
    const scaleX = next.width / artboard.width;
    const scaleY = next.height / artboard.height;
    setLayers((current) =>
      current.map((layer) => ({
        ...layer,
        x: layer.x * scaleX,
        y: layer.y * scaleY,
        scale: layer.scale * Math.min(scaleX, scaleY),
      })),
    );
    setCanvasFormat((current) => ({ ...current, ...changes }));
  }

  async function runCopy() {
    setIsCopying(true);
    setError(null);
    try {
      const region = isTrimmed
        ? layerBounds(layers)
        : { x: 0, y: 0, ...artboard };
      const result =
        region &&
        (await makeCopy(layers, region, settings, {
          trim: isTrimmed,
          background: theme.color,
        }));
      if (!result) {
        setError("Nothing to export: the canvas is empty.");
        return;
      }
      setCopy((previous) => {
        if (previous) URL.revokeObjectURL(previous.url);
        return result;
      });
    } catch (cause) {
      console.error(cause);
      setError("Export failed.");
    } finally {
      setIsCopying(false);
    }
  }

  useEffect(() => saveTheme(theme), [theme]);

  // The region's numbers are the dependencies, not its object identity.
  // biome-ignore lint/correctness/useExhaustiveDependencies: see above
  useEffect(() => {
    if (layers.length === 0) {
      setPreview(null);
      return;
    }
    const region = previewRegion;
    const request = ++previewRequest.current;
    const timer = setTimeout(async () => {
      const pixelScale = Math.min(1, view.scale * window.devicePixelRatio);
      const { canvas, ctx } = renderRegion(layers, region, pixelScale);
      const flat = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const result = await photocopyImageData(flat, settings, pixelScale);
      if (request !== previewRequest.current) return;
      ctx.putImageData(result, 0, 0);
      setPreview({ canvas, region });
    }, PREVIEW_DELAY);
    return () => clearTimeout(timer);
  }, [
    layers,
    settings,
    view.scale,
    previewRegion.x,
    previewRegion.y,
    previewRegion.width,
    previewRegion.height,
  ]);

  const layerMenu: LayerMenuProps = {
    hasSelection: selected !== null,
    canRemoveBackground:
      selected !== null &&
      !selected.backgroundRemoved &&
      removals[selected.id] === undefined,
    canCrop: canCropSelected,
    canBringForward: selected !== null && selectedIndex < layers.length - 1,
    canSendBack: selected !== null && selectedIndex > 0,
    isRefining,
    tool,
    onAction: handleMenuAction,
    onRefining: changeRefining,
    onTool: changeTool,
  };

  return (
    <div className="app" data-has-layers={layers.length > 0 || undefined}>
      <h1 className="visually-hidden">Copyshop</h1>
      <MenuBar
        {...layerMenu}
        canExport={!isCopying && layers.some((layer) => layer.visible)}
        canUndo={history.canUndo}
        canRedo={history.canRedo}
        status={status}
        canvasFormat={canvasFormat}
        onCanvasPreset={(preset) => changeCanvas({ preset })}
        onCustomSize={() => {
          changeCanvas({ preset: "custom" });
          setIsCustomSizeOpen(true);
        }}
        theme={theme}
        onTheme={setTheme}
        onAbout={() => setIsAboutOpen(true)}
      />
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
      <Bed
        layers={layers}
        artboard={artboard}
        selectedId={selectedId}
        tool={tool}
        brushSize={brushSize}
        isSizingBrush={isSizingBrush && selected !== null}
        isMaskMode={isRefining}
        preview={preview}
        isTrimmed={isTrimmed}
        canvasFill={theme.color}
        onSelect={select}
        onTool={setTool}
        onChange={updateLayer}
        onDelete={deleteLayer}
        onFiles={addFiles}
        onUpload={() => fileInput.current?.click()}
        onSearch={() => setIsSearchOpen(true)}
        layerMenu={<LayerMenu {...layerMenu} />}
        onView={setView}
      />
      {layers.length > 0 && (
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
          imagePanel={
            <ImagePanel
              canvasFormat={canvasFormat}
              onCanvasPreset={(preset) => changeCanvas({ preset })}
              onCustomSize={() => setIsCustomSizeOpen(true)}
              theme={theme}
              onTheme={setTheme}
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
      )}
      <AboutDialog isOpen={isAboutOpen} onOpenChange={setIsAboutOpen} />
      <CustomSizeDialog
        isOpen={isCustomSizeOpen}
        onOpenChange={setIsCustomSizeOpen}
        canvasFormat={canvasFormat}
        onCanvas={changeCanvas}
      />
      <CommonsSearch
        isOpen={isSearchOpen}
        onOpenChange={setIsSearchOpen}
        onAdd={(file, credit) => addFiles([file], credit)}
      />
      <CopyResult
        copy={copy}
        credits={credits}
        onClose={() => {
          if (copy) URL.revokeObjectURL(copy.url);
          setCopy(null);
        }}
      />
    </div>
  );
}

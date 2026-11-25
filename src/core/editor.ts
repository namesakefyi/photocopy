import {
  canvasSize,
  DEFAULT_CANVAS,
  type FitMemory,
  fitLayersToCanvas,
} from "./canvasFormat";
import { DEFAULT_SETTINGS, type PhotocopySettings } from "./photocopy";
import type { ShortcutCommand } from "./shortcuts";
import type { Theme } from "./themes";
import type {
  ArtboardState,
  CanvasFormat,
  Layer,
  LayerChanges,
  Removal,
  Tool,
} from "./types";

export const MIN_BRUSH = 4;
export const MAX_BRUSH = 300;
const BRUSH_STEP = 1.25;

export interface EditorState extends ArtboardState {
  selectedId: string | null;
  /** Any tool but "move" is mask mode: the red overlay shows, and a brush is active. */
  tool: Tool;
  brushSize: number;
  fitMemory: FitMemory;
}

export type EditorAction =
  | { type: "load"; state: ArtboardState }
  | { type: "undoTo"; state: ArtboardState }
  | { type: "select"; id: string | null }
  | { type: "addLayers"; layers: Layer[] }
  | { type: "updateLayer"; id: string; changes: LayerChanges }
  | { type: "replaceLayer"; layer: Layer }
  | { type: "reorderLayers"; ids: string[] }
  | { type: "deleteSelected" }
  | { type: "moveSelected"; direction: 1 | -1 }
  | { type: "flipSelected"; axis: "flipX" | "flipY" }
  | { type: "setTool"; tool: Tool }
  | { type: "stopRefining"; layerId: string }
  | { type: "setBrushSize"; size: number }
  | { type: "resizeBrush"; direction: 1 | -1 }
  | { type: "escape" }
  | { type: "changeSettings"; changes: Partial<PhotocopySettings> }
  | { type: "changeCanvas"; changes: Partial<CanvasFormat> }
  | { type: "setBackground"; background: Theme };

export const initialEditorState = (background: Theme): EditorState => ({
  layers: [],
  settings: DEFAULT_SETTINGS,
  canvasFormat: DEFAULT_CANVAS,
  background,
  selectedId: null,
  tool: "move",
  brushSize: 40,
  fitMemory: {},
});

/** Selecting another layer (or none) puts the brushes away. */
const select = (state: EditorState, id: string | null): EditorState =>
  id === state.selectedId ? state : { ...state, selectedId: id, tool: "move" };

const mapLayer = (
  state: EditorState,
  id: string | null,
  change: (layer: Layer) => Layer,
): EditorState => ({
  ...state,
  layers: state.layers.map((layer) =>
    layer.id === id ? change(layer) : layer,
  ),
});

export function editorReducer(
  state: EditorState,
  action: EditorAction,
): EditorState {
  switch (action.type) {
    case "load":
      return { ...state, ...action.state };
    case "undoTo": {
      const { layers } = action.state;
      const isKept = layers.some((layer) => layer.id === state.selectedId);
      return {
        ...state,
        ...action.state,
        selectedId: isKept ? state.selectedId : null,
        tool: "move",
      };
    }
    case "select":
      return select(state, action.id);
    case "addLayers": {
      const added = { ...state, layers: [...state.layers, ...action.layers] };
      return select(added, action.layers.at(-1)?.id ?? state.selectedId);
    }
    case "updateLayer":
      return mapLayer(state, action.id, (layer) => ({
        ...layer,
        ...action.changes,
      }));
    case "replaceLayer":
      return mapLayer(state, action.layer.id, () => action.layer);
    case "reorderLayers": {
      const byId = new Map(state.layers.map((layer) => [layer.id, layer]));
      const layers = action.ids.flatMap((id) => byId.get(id) ?? []);
      return { ...state, layers };
    }
    case "deleteSelected":
      return select(
        {
          ...state,
          layers: state.layers.filter((layer) => layer.id !== state.selectedId),
        },
        null,
      );
    case "moveSelected": {
      const index = state.layers.findIndex(
        (layer) => layer.id === state.selectedId,
      );
      const target = index + action.direction;
      if (index < 0 || target < 0 || target >= state.layers.length) {
        return state;
      }
      const layers = [...state.layers];
      [layers[index], layers[target]] = [layers[target], layers[index]];
      return { ...state, layers };
    }
    case "flipSelected":
      return mapLayer(state, state.selectedId, (layer) => ({
        ...layer,
        [action.axis]: !layer[action.axis],
      }));
    case "setTool":
      return { ...state, tool: action.tool };
    case "stopRefining":
      return state.selectedId === action.layerId && state.tool !== "move"
        ? { ...state, tool: "move" }
        : state;
    case "setBrushSize":
      return { ...state, brushSize: action.size };
    case "resizeBrush": {
      const size = Math.round(state.brushSize * BRUSH_STEP ** action.direction);
      return {
        ...state,
        brushSize: Math.min(MAX_BRUSH, Math.max(MIN_BRUSH, size)),
      };
    }
    case "escape":
      return state.tool !== "move"
        ? { ...state, tool: "move" }
        : select(state, null);
    case "changeSettings":
      return { ...state, settings: { ...state.settings, ...action.changes } };
    case "changeCanvas": {
      const canvasFormat = { ...state.canvasFormat, ...action.changes };
      const fitted = fitLayersToCanvas(
        state.layers,
        canvasSize(state.canvasFormat),
        canvasSize(canvasFormat),
        state.fitMemory,
      );
      return {
        ...state,
        canvasFormat,
        layers: fitted.layers,
        fitMemory: fitted.memory,
      };
    }
    case "setBackground":
      return { ...state, background: action.background };
  }
}

export function placeNewPhotos(
  count: number,
  { width, height }: { width: number; height: number },
) {
  return Array.from({ length: count }, (_, index) => ({
    x: width / 2 + index * 60,
    y: height / 2 + index * 60,
    maxWidth: width * 0.6,
    maxHeight: height * 0.6,
  }));
}

export function selectionState(
  { layers, selectedId }: EditorState,
  removals: Record<string, Removal>,
) {
  const index = layers.findIndex((layer) => layer.id === selectedId);
  const selected = layers[index] ?? null;
  const removal = selected ? removals[selected.id] : undefined;
  // Background removal replaces the mask, so mask edits wait for it.
  const canEditMask = selected !== null && removal === undefined;
  return {
    selected,
    removal,
    canEditMask,
    canRemoveBackground: canEditMask && !selected.backgroundRemoved,
    canBringForward: selected !== null && index < layers.length - 1,
    canSendBack: selected !== null && index > 0,
  };
}

const BRUSH_LABELS = { restore: "Erasing mask", erase: "Masking" };

export function statusMessage(tool: Tool) {
  return tool === "move"
    ? null
    : { label: BRUSH_LABELS[tool], hint: "Esc to stop" };
}

export function shortcutAction(command: ShortcutCommand): EditorAction | null {
  switch (command) {
    case "restore":
    case "erase":
      return { type: "setTool", tool: command };
    case "escape":
      return { type: "escape" };
    case "delete":
      return { type: "deleteSelected" };
    case "forward":
    case "back":
      return {
        type: "moveSelected",
        direction: command === "forward" ? 1 : -1,
      };
    case "brushLarger":
    case "brushSmaller":
      return {
        type: "resizeBrush",
        direction: command === "brushLarger" ? 1 : -1,
      };
    default:
      return null;
  }
}

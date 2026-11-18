import type { CanvasFormat, CanvasPreset, Layer } from "./types";

export interface CanvasPresetInfo {
  id: Exclude<CanvasPreset, "custom" | "trimmed">;
  /** Short name shown in the canvas preset menus. */
  name: string;
  ratio: string;
  width: number;
  height: number;
}

/**
 * The largest canvas side, and the largest export side. 4000 × 4000 (16MP)
 * stays under Safari's canvas area limit (about 16.7MP), past which drawing
 * and reading canvases fails.
 */
export const MAX_CANVAS_SIZE = 4000;
export const MIN_CANVAS_SIZE = 100;

/** The usual pixel sizes for each place an image is posted. */
export const CANVAS_PRESETS: CanvasPresetInfo[] = [
  {
    id: "square",
    name: "Square",
    ratio: "1:1",
    width: 1080,
    height: 1080,
  },
  {
    id: "social",
    name: "Social",
    ratio: "1.91:1",
    width: 1200,
    height: 630,
  },
  {
    id: "video",
    name: "Video",
    ratio: "16:9",
    width: 1920,
    height: 1080,
  },
  {
    id: "story",
    name: "Stories",
    ratio: "9:16",
    width: 1080,
    height: 1920,
  },
];

/**
 * A trimmed canvas has no edges; this is only the area the canvas view frames and
 * new photos are placed in.
 */
const TRIMMED_WORKSPACE = { width: 1500, height: 1500 };

export const DEFAULT_CANVAS: CanvasFormat = {
  preset: "trimmed",
  customWidth: 1500,
  customHeight: 1000,
};

export function canvasSize(format: CanvasFormat) {
  if (format.preset === "trimmed") return TRIMMED_WORKSPACE;
  if (format.preset === "custom") {
    return { width: format.customWidth, height: format.customHeight };
  }
  const preset = CANVAS_PRESETS.find((option) => option.id === format.preset);
  if (!preset) throw new Error(`Unknown canvas preset: ${format.preset}`);
  return { width: preset.width, height: preset.height };
}

type Size = { width: number; height: number };
type Placement = Pick<Layer, "x" | "y" | "scale">;

/**
 * For each photo, where it was last placed by hand and on what size of
 * canvas, and where fitting last put it. Fitting always works from the
 * hand-placed position, so switching sizes never accumulates rounding or
 * shrinkage.
 */
export type FitMemory = Record<
  string,
  { placed: Placement; canvas: Size; fitted: Placement }
>;

function samePlacement(a: Placement, b: Placement) {
  return a.x === b.x && a.y === b.y && a.scale === b.scale;
}

/**
 * Keeps photos in the same relative spot when the canvas changes size, scaled
 * to fit the way they fit the canvas they were placed on: never wider or
 * taller, relative to the canvas, than they were. Switching sizes and back
 * returns them exactly to where they were placed.
 */
export function fitLayersToCanvas<T extends Placement & Pick<Layer, "id">>(
  layers: T[],
  from: Size,
  to: Size,
  memory: FitMemory = {},
): { layers: T[]; memory: FitMemory } {
  const nextMemory: FitMemory = {};
  const fitted = layers.map((layer) => {
    const remembered = memory[layer.id];
    // A photo moved or scaled since the last fit starts over from here.
    const isUntouched =
      remembered !== undefined && samePlacement(remembered.fitted, layer);
    const placed = isUntouched
      ? remembered.placed
      : { x: layer.x, y: layer.y, scale: layer.scale };
    const canvas = isUntouched ? remembered.canvas : from;
    const scaleX = to.width / canvas.width;
    const scaleY = to.height / canvas.height;
    const placement = {
      x: placed.x * scaleX,
      y: placed.y * scaleY,
      scale: placed.scale * Math.min(scaleX, scaleY),
    };
    nextMemory[layer.id] = { placed, canvas, fitted: placement };
    return { ...layer, ...placement };
  });
  return { layers: fitted, memory: nextMemory };
}

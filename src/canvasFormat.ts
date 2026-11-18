import type { CanvasFormat, CanvasPreset } from "./types";

export interface CanvasPresetInfo {
  id: Exclude<CanvasPreset, "custom" | "trimmed">;
  ratio: string;
  description: string;
  width: number;
  height: number;
}

// Social and video sizes are 2× the usual pixels (1200 × 630, 1920 × 1080,
// 1080 × 1920), so the grain stays as fine as it is on the square canvas.
export const CANVAS_PRESETS: CanvasPresetInfo[] = [
  {
    id: "square",
    ratio: "1:1",
    description: "Square",
    width: 3000,
    height: 3000,
  },
  {
    id: "social",
    ratio: "1.91:1",
    description: "Link previews",
    width: 2400,
    height: 1260,
  },
  {
    id: "video",
    ratio: "16:9",
    description: "Video",
    width: 3840,
    height: 2160,
  },
  {
    id: "story",
    ratio: "9:16",
    description: "Instagram Stories",
    width: 2160,
    height: 3840,
  },
];

/**
 * A trimmed canvas has no edges; this is only the area the bed frames and
 * new photos are placed in.
 */
const TRIMMED_WORKSPACE = { width: 3000, height: 3000 };

export const DEFAULT_CANVAS: CanvasFormat = {
  preset: "trimmed",
  customWidth: 3000,
  customHeight: 2000,
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

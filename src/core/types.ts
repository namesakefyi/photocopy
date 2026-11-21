import type { PhotocopySettings } from "./photocopy";
import type { Theme } from "./themes";

export interface Credit {
  title: string;
  author: string;
  license: string;
  licenseUrl?: string;
  sourceUrl: string;
  /** The collection it came from, like "SMK". */
  source: string;
  attributionRequired: boolean;
}

export interface Layer {
  id: string;
  name: string;
  width: number;
  height: number;
  /** The photo as loaded, never modified. */
  source: HTMLCanvasElement;
  mask: HTMLCanvasElement;
  backgroundRemoved: boolean;
  /** Where the source sits within the photo as loaded, after shrink to fit. */
  crop: Region | null;
  /** Source with the mask applied; what the canvas and copies draw. */
  composed: HTMLCanvasElement;
  /** Center of the layer, in artboard pixels. */
  x: number;
  y: number;
  scale: number;
  rotation: number;
  flipX: boolean;
  flipY: boolean;
  visible: boolean;
  credit?: Credit;
  /** Bumped whenever the mask changes, so dependents re-render. */
  revision: number;
}

export type LayerChanges = Partial<
  Pick<
    Layer,
    | "x"
    | "y"
    | "scale"
    | "rotation"
    | "flipX"
    | "flipY"
    | "visible"
    | "revision"
    | "backgroundRemoved"
  >
>;

export type Tool = "move" | "erase" | "restore";

export type CanvasPreset = "square" | "social" | "video" | "story" | "custom";

export interface CanvasFormat {
  preset: CanvasPreset;
  customWidth: number;
  customHeight: number;
}

/** A rectangle in artboard pixels. */
export interface Region {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Removal {
  label: string;
  fraction: number;
}

export interface ArtboardState {
  layers: Layer[];
  settings: PhotocopySettings;
  canvasFormat: CanvasFormat;
  background: Theme;
}

export function sameArtboardState(a: ArtboardState, b: ArtboardState) {
  return (
    a.layers === b.layers &&
    a.settings === b.settings &&
    a.canvasFormat === b.canvasFormat &&
    a.background === b.background
  );
}

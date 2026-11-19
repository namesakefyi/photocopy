/** Where an openly licensed photo came from, for attribution. */
export interface Credit {
  title: string;
  author: string;
  license: string;
  licenseUrl?: string;
  sourceUrl: string;
  /** Where the photo comes from, like "flickr.com". */
  source?: string;
  attributionRequired: boolean;
}

export interface Layer {
  id: string;
  name: string;
  width: number;
  height: number;
  /** The photo as loaded, never modified. */
  source: HTMLCanvasElement;
  /** Alpha mask painted by background removal and the brushes. */
  mask: HTMLCanvasElement;
  /** Set once Remove background has cut this photo out. */
  backgroundRemoved: boolean;
  /** Where the source sits within the photo as loaded, after crop to fit. */
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
  /** Set for photos added from an image search. */
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

/** Progress of an in-flight background removal. */
export interface Removal {
  label: string;
  fraction: number;
}

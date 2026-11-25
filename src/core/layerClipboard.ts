import { composeLayer, nextRevision } from "./layers";
import { context2d, createCanvas } from "./render";
import type { Layer } from "./types";

type Size = { width: number; height: number };

/** Marks a clipboard entry as ours; the system clipboard only carries the token. */
export const LAYER_CLIPBOARD_TYPE = "application/x-photocopy-layer";

/** How far each paste over an identical spot steps down and right. */
export const PASTE_OFFSET = 24;

interface CopiedLayer {
  /** Null when the browser gave no copy event to put it on the system clipboard. */
  token: string | null;
  layer: Layer;
  artboard: Size;
}

// Kept in memory, so layers move between artboards in this tab without encoding.
let copied: CopiedLayer | null = null;

function cloneCanvas(canvas: HTMLCanvasElement) {
  const clone = createCanvas(canvas);
  context2d(clone).drawImage(canvas, 0, 0);
  return clone;
}

/** Snapshots the mask, since brushes paint into it in place. */
export function copyLayer(layer: Layer, artboard: Size, token: string | null) {
  // The source is never drawn into, so it can be shared.
  copied = {
    token,
    layer: { ...layer, mask: cloneCanvas(layer.mask) },
    artboard,
  };
}

export function hasCopiedLayer() {
  return copied !== null;
}

/**
 * Whether a paste carrying `token` (null for none) is the copied layer. A
 * layer that went onto the system clipboard needs its token back; without
 * one, something else was copied since.
 */
export function isCopiedLayer(token: string | null) {
  return copied !== null && copied.token === token;
}

/**
 * Keeps the layer's offset from the artboard's center, then steps it
 * off any layer already sitting in exactly that spot.
 */
export function pastePosition(
  from: { x: number; y: number },
  source: Size,
  target: Size,
  existing: { x: number; y: number }[],
) {
  let x = from.x + (target.width - source.width) / 2;
  let y = from.y + (target.height - source.height) / 2;
  const isTaken = () =>
    existing.some(
      (other) => Math.abs(other.x - x) < 1 && Math.abs(other.y - y) < 1,
    );
  while (isTaken()) {
    x += PASTE_OFFSET;
    y += PASTE_OFFSET;
  }
  return { x, y };
}

/**
 * A new layer with its own id and canvases. Its source is saved as is, so
 * the crop that produced it is already applied.
 */
export function pasteLayer(artboard: Size, existing: Layer[]): Layer | null {
  if (!copied) return null;
  const { layer, artboard: source } = copied;
  const pasted: Layer = {
    ...layer,
    ...pastePosition(layer, source, artboard, existing),
    id: crypto.randomUUID(),
    mask: cloneCanvas(layer.mask),
    composed: createCanvas(layer),
    crop: null,
    revision: nextRevision(),
  };
  composeLayer(pasted);
  return pasted;
}

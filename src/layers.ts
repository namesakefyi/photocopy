import { contentBounds } from "./photocopy";
import type { Credit, Layer, Region, Tool } from "./types";

/** Keeps memory in check: each layer holds three canvases this size. */
const MAX_SIDE = 2560;

function createCanvas(width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function context(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d", { willReadFrequently: false });
  if (!ctx) throw new Error("Canvas 2D is not available");
  return ctx;
}

function fillOpaque(canvas: HTMLCanvasElement) {
  const ctx = context(canvas);
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

let lastRevision = 0;

/**
 * A number for a new version of a photo's pixels, never reused in a session.
 * Undo history and autosave key mask snapshots by it, so a new edit after an
 * undo must never get the number of an edit that was undone.
 */
export function nextRevision() {
  lastRevision += 1;
  return lastRevision;
}

export async function loadPhoto(
  file: File,
  placement: { x: number; y: number; maxWidth: number; maxHeight: number },
  credit?: Credit,
): Promise<Layer> {
  const bitmap = await createImageBitmap(file, {
    imageOrientation: "from-image",
  });
  const fit = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * fit);
  const height = Math.round(bitmap.height * fit);

  const source = createCanvas(width, height);
  context(source).drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const mask = createCanvas(width, height);
  fillOpaque(mask);

  const layer: Layer = {
    id: crypto.randomUUID(),
    name: file.name.replace(/\.[^.]+$/, ""),
    width,
    height,
    source,
    mask,
    backgroundRemoved: false,
    crop: null,
    composed: createCanvas(width, height),
    x: placement.x,
    y: placement.y,
    scale: Math.min(
      placement.maxWidth / width,
      placement.maxHeight / height,
      4,
    ),
    rotation: 0,
    flipX: false,
    flipY: false,
    visible: true,
    credit,
    revision: nextRevision(),
  };
  composeLayer(layer);
  return layer;
}

export function composeLayer(layer: Layer) {
  const ctx = context(layer.composed);
  ctx.save();
  ctx.clearRect(0, 0, layer.width, layer.height);
  ctx.drawImage(layer.source, 0, 0);
  ctx.globalCompositeOperation = "destination-in";
  ctx.drawImage(layer.mask, 0, 0);
  ctx.restore();
}

export function paintMask(
  layer: Layer,
  from: { x: number; y: number },
  to: { x: number; y: number },
  size: number,
  tool: Exclude<Tool, "move">,
) {
  const ctx = context(layer.mask);
  ctx.save();
  ctx.globalCompositeOperation =
    tool === "erase" ? "destination-out" : "source-over";
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = size;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.stroke();
  ctx.restore();
}

export function setMask(layer: Layer, image: CanvasImageSource | null) {
  const ctx = context(layer.mask);
  ctx.save();
  ctx.globalCompositeOperation = "copy";
  if (image) {
    ctx.drawImage(image, 0, 0, layer.width, layer.height);
  } else {
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, layer.width, layer.height);
  }
  ctx.restore();
}

export function canvasToBlob(canvas: HTMLCanvasElement, type = "image/png") {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Export failed"))),
      type,
    );
  });
}

function cropCanvas(canvas: HTMLCanvasElement, region: Region) {
  const cropped = createCanvas(region.width, region.height);
  context(cropped).drawImage(canvas, -region.x, -region.y);
  return cropped;
}

/** Trims every canvas of a layer to `region`, in the layer's own pixels. */
export function cropLayerCanvases(layer: Layer, region: Region): Layer {
  const previous = layer.crop ?? { x: 0, y: 0 };
  const cropped: Layer = {
    ...layer,
    width: region.width,
    height: region.height,
    source: cropCanvas(layer.source, region),
    mask: cropCanvas(layer.mask, region),
    composed: createCanvas(region.width, region.height),
    crop: {
      x: previous.x + region.x,
      y: previous.y + region.y,
      width: region.width,
      height: region.height,
    },
  };
  composeLayer(cropped);
  return cropped;
}

/** Pixels at least this opaque are the ones that print in the copy. */
const PRINTED_ALPHA = 128;

/**
 * The part of a layer that will print, or null when that's already the whole
 * layer (or nothing at all), so there's nothing to crop.
 */
export function croppableBounds(layer: Layer): Region | null {
  const { data } = context(layer.composed).getImageData(
    0,
    0,
    layer.width,
    layer.height,
  );
  const bounds = contentBounds(
    { data, width: layer.width, height: layer.height },
    PRINTED_ALPHA,
  );
  if (
    !bounds ||
    (bounds.width === layer.width && bounds.height === layer.height)
  ) {
    return null;
  }
  return bounds;
}

/**
 * Shrinks a layer to the part that will actually print, keeping it in the
 * same place on the artboard. Null when there's nothing to trim.
 */
export function cropToVisible(layer: Layer): Layer | null {
  const bounds = croppableBounds(layer);
  if (!bounds) return null;

  // The layer is positioned by its center, so move that center to the middle
  // of the kept area, through the layer's flip, scale and rotation.
  const localX =
    (bounds.x + bounds.width / 2 - layer.width / 2) *
    layer.scale *
    (layer.flipX ? -1 : 1);
  const localY =
    (bounds.y + bounds.height / 2 - layer.height / 2) *
    layer.scale *
    (layer.flipY ? -1 : 1);
  const angle = (layer.rotation * Math.PI) / 180;
  const cropped = cropLayerCanvases(layer, bounds);
  return {
    ...cropped,
    x: layer.x + localX * Math.cos(angle) - localY * Math.sin(angle),
    y: layer.y + localX * Math.sin(angle) + localY * Math.cos(angle),
    revision: nextRevision(),
  };
}

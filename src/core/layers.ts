import { contentBounds } from "./photocopy";
import { context2d, createCanvas } from "./render";
import type { Credit, Layer, Region, Tool } from "./types";

/** Keeps memory in check: each layer holds three canvases this size. */
const MAX_SIDE = 2560;

let lastRevision = 0;

/** Never reused in a session: undo history and autosave key mask snapshots by it. */
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

  const source = createCanvas({ width, height });
  context2d(source).drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const layer: Layer = {
    id: crypto.randomUUID(),
    name: file.name.replace(/\.[^.]+$/, ""),
    width,
    height,
    source,
    mask: createCanvas({ width, height }),
    backgroundRemoved: false,
    crop: null,
    composed: createCanvas({ width, height }),
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
  setMask(layer, null);
  return layer;
}

export function composeLayer(layer: Layer) {
  const ctx = context2d(layer.composed);
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
  const ctx = context2d(layer.mask);
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
  const ctx = context2d(layer.mask);
  ctx.save();
  ctx.globalCompositeOperation = "copy";
  if (image) {
    ctx.drawImage(image, 0, 0, layer.width, layer.height);
  } else {
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, layer.width, layer.height);
  }
  ctx.restore();
  composeLayer(layer);
}

export function maskBlob(
  layer: Pick<Layer, "width" | "height">,
  image: CanvasImageSource,
) {
  const canvas = createCanvas(layer);
  context2d(canvas).drawImage(image, 0, 0, layer.width, layer.height);
  return canvasToBlob(canvas);
}

export function canvasToBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) =>
      blob ? resolve(blob) : reject(new Error("Export failed")),
    );
  });
}

function cropCanvas(canvas: HTMLCanvasElement, region: Region) {
  const cropped = createCanvas(region);
  context2d(cropped).drawImage(canvas, -region.x, -region.y);
  return cropped;
}

export function cropLayerCanvases(layer: Layer, region: Region): Layer {
  const previous = layer.crop ?? { x: 0, y: 0 };
  const cropped: Layer = {
    ...layer,
    width: region.width,
    height: region.height,
    source: cropCanvas(layer.source, region),
    mask: cropCanvas(layer.mask, region),
    composed: createCanvas(region),
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

const PRINTED_ALPHA = 128;

export function croppableBounds(layer: Layer): Region | null {
  const { width, height } = layer;
  const pixels = context2d(layer.composed).getImageData(0, 0, width, height);
  const bounds = contentBounds(pixels, PRINTED_ALPHA);
  const isWhole = bounds?.width === width && bounds.height === height;
  return isWhole ? null : bounds;
}

export function cropToVisible(layer: Layer): Layer | null {
  const bounds = croppableBounds(layer);
  if (!bounds) return null;

  // Moves the center to the kept area's middle, through flip, scale and rotation.
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

import { DEFAULT_CANVAS } from "./canvasFormat";
import { canvasToBlob, cropLayerCanvases, loadPhoto, setMask } from "./layers";
import { DEFAULT_SETTINGS, type PhotocopySettings } from "./photocopy";
import * as storage from "./storage";
import { savedBackground, themeById } from "./themes";
import type { ArtboardState, CanvasFormat, Layer } from "./types";

const INDEX_KEY = "index";

/** Pixels are stored as blobs; sizes and revisions are rebuilt on load. */
export type SavedLayer = Omit<
  Layer,
  "width" | "height" | "source" | "mask" | "composed" | "revision"
>;

/** Its photos and masks are blobs, keyed by layer id. */
export interface SavedArtboard {
  version: 2;
  id: string;
  updatedAt: number;
  layers: SavedLayer[];
  settings: PhotocopySettings;
  canvasFormat: CanvasFormat;
  backgroundId: string;
}

interface SavedIndex {
  version: 1;
  order: string[];
  activeId: string;
}

export interface ArtboardSummary {
  id: string;
  backgroundId: string;
  thumbnail?: Blob;
}

const BLOB_KINDS = ["source", "mask"] as const;
type BlobKind = (typeof BLOB_KINDS)[number];

const blobKey = (id: string, kind: BlobKind) => `${id}:${kind}`;
// Stored under their first name, so saved artboards keep loading.
const ARTBOARD_PREFIX = "doc:";
const artboardKey = (id: string) => `${ARTBOARD_PREFIX}${id}`;
const thumbKey = (id: string) => `thumb:${id}`;

/** Runs storage changes in order, so overlapping read-modify-writes never lose updates. */
let queue: Promise<unknown> = Promise.resolve();
function exclusive<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task);
  queue = run.catch(() => {});
  return run;
}

export function isQuotaError(cause: unknown) {
  return cause instanceof DOMException && cause.name === "QuotaExceededError";
}

export const QUOTA_MESSAGE =
  "Out of browser storage. Delete an artboard to free space.";

/** Keeps the original file so a restore rebuilds the photo at full quality. */
export async function saveSource(layer: Layer, file: Blob) {
  await storage.put(storage.BLOB_STORE, blobKey(layer.id, "source"), file);
}

async function restoreLayer(saved: SavedLayer): Promise<Layer | null> {
  const [source, mask] = await Promise.all(
    BLOB_KINDS.map((kind) =>
      storage.get<Blob>(storage.BLOB_STORE, blobKey(saved.id, kind)),
    ),
  );
  if (!source) return null;
  const layer = await loadPhoto(new File([source], saved.name), {
    x: saved.x,
    y: saved.y,
    maxWidth: 1,
    maxHeight: 1,
  });
  const restored: Layer = {
    ...(saved.crop ? cropLayerCanvases(layer, saved.crop) : layer),
    ...saved,
  };
  if (mask) {
    const bitmap = await createImageBitmap(mask);
    setMask(restored, bitmap);
    bitmap.close();
  }
  return restored;
}

/** Sessions saved with the old edgeless canvas keep the area it framed. */
function restoreCanvasFormat(format: CanvasFormat): CanvasFormat {
  return (format.preset as string) === "trimmed"
    ? { ...format, preset: "custom", customWidth: 1500, customHeight: 1500 }
    : format;
}

async function getArtboard(id: string) {
  const artboard = await storage.get<SavedArtboard>(
    storage.STATE_STORE,
    artboardKey(id),
  );
  return artboard?.version === 2 ? artboard : undefined;
}

async function allArtboards() {
  const keys = (await storage.keys(storage.STATE_STORE)).filter((key) =>
    key.startsWith(ARTBOARD_PREFIX),
  );
  const artboards = await Promise.all(
    keys.map((key) => getArtboard(key.slice(ARTBOARD_PREFIX.length))),
  );
  return artboards.filter((artboard) => artboard !== undefined);
}

function newArtboard(changes: Partial<SavedArtboard> = {}): SavedArtboard {
  return {
    version: 2,
    id: crypto.randomUUID(),
    updatedAt: Date.now(),
    layers: [],
    settings: DEFAULT_SETTINGS,
    canvasFormat: DEFAULT_CANVAS,
    backgroundId: savedBackground().id,
    ...changes,
  };
}

function putArtboard(artboard: SavedArtboard) {
  return storage.put(storage.STATE_STORE, artboardKey(artboard.id), artboard);
}

function summarize(artboard: SavedArtboard, thumbnail?: Blob): ArtboardSummary {
  return { id: artboard.id, backgroundId: artboard.backgroundId, thumbnail };
}

/** Runs at start-up, not on delete, so undoing a layer's deletion keeps its photo. */
async function removeUnusedFiles(artboards: SavedArtboard[]) {
  const layerIds = new Set(
    artboards.flatMap((artboard) => artboard.layers.map((layer) => layer.id)),
  );
  const artboardIds = new Set(artboards.map((artboard) => artboard.id));
  const unused = (await storage.keys(storage.BLOB_STORE)).filter((key) => {
    const [id, kind] = key.split(":");
    return id === "thumb"
      ? !artboardIds.has(kind)
      : !layerIds.has(id) || !(BLOB_KINDS as readonly string[]).includes(kind);
  });
  await Promise.all(
    unused.map((key) => storage.remove(storage.BLOB_STORE, key)),
  );
}

async function readIndex() {
  const index = await storage.get<SavedIndex>(storage.STATE_STORE, INDEX_KEY);
  return index?.version === 1 ? index : null;
}

function writeIndex(order: string[], activeId: string) {
  const index: SavedIndex = { version: 1, order, activeId };
  return storage.put(storage.STATE_STORE, INDEX_KEY, index);
}

/** Creates a first artboard if needed; cleans up unused files without blocking. */
export function loadLibrary() {
  return exclusive(async () => {
    const artboards = await allArtboards();
    if (artboards.length === 0) {
      const first = newArtboard();
      await putArtboard(first);
      artboards.push(first);
    }
    exclusive(() => removeUnusedFiles(artboards)).catch((cause) =>
      console.warn("Couldn’t clean up unused files", cause),
    );

    const index = await readIndex();
    const byId = new Map(artboards.map((artboard) => [artboard.id, artboard]));
    const order = [
      ...(index?.order ?? []).filter((id) => byId.has(id)),
      ...artboards
        .filter((artboard) => !index?.order.includes(artboard.id))
        .sort((a, b) => a.updatedAt - b.updatedAt)
        .map((artboard) => artboard.id),
    ];
    const activeId =
      index && byId.has(index.activeId) ? index.activeId : order[0];
    if (index?.activeId !== activeId || index.order.join() !== order.join()) {
      await writeIndex(order, activeId);
    }
    const artboardSummaries = await Promise.all(
      order.map(async (id) =>
        summarize(
          byId.get(id) as SavedArtboard,
          await storage.get<Blob>(storage.BLOB_STORE, thumbKey(id)),
        ),
      ),
    );
    return { artboards: artboardSummaries, activeId };
  });
}

export function saveIndex(order: string[], activeId: string) {
  return exclusive(() => writeIndex(order, activeId));
}

/** Starts at the canvas size of the most recently edited artboard. */
export function createArtboard(backgroundId: string) {
  return exclusive(async () => {
    const [latest] = (await allArtboards()).sort(
      (a, b) => b.updatedAt - a.updatedAt,
    );
    const artboard = newArtboard({
      backgroundId,
      canvasFormat: latest
        ? restoreCanvasFormat(latest.canvasFormat)
        : DEFAULT_CANVAS,
    });
    await putArtboard(artboard);
    return summarize(artboard);
  });
}

export function deleteArtboard(id: string) {
  return exclusive(async () => {
    const artboard = await getArtboard(id);
    const blobKeys = (artboard?.layers ?? []).flatMap((layer) =>
      BLOB_KINDS.map((kind) => blobKey(layer.id, kind)),
    );
    await Promise.all([
      storage.remove(storage.STATE_STORE, artboardKey(id)),
      ...[thumbKey(id), ...blobKeys].map((key) =>
        storage.remove(storage.BLOB_STORE, key),
      ),
    ]);
  });
}

/** The copy's layers get new ids, so each artboard owns its files. */
export function duplicateArtboard(id: string) {
  return exclusive(async () => {
    const artboard = await getArtboard(id);
    if (!artboard) return null;
    const copy: SavedArtboard = {
      ...artboard,
      id: crypto.randomUUID(),
      updatedAt: Date.now(),
      layers: artboard.layers.map((layer) => ({
        ...layer,
        id: crypto.randomUUID(),
      })),
    };
    const copyBlob = async (from: string, to: string) => {
      const blob = await storage.get<Blob>(storage.BLOB_STORE, from);
      if (blob) await storage.put(storage.BLOB_STORE, to, blob);
      return blob;
    };
    const [thumbnail] = await Promise.all([
      copyBlob(thumbKey(artboard.id), thumbKey(copy.id)),
      ...artboard.layers.flatMap((layer, index) =>
        BLOB_KINDS.map((kind) =>
          copyBlob(
            blobKey(layer.id, kind),
            blobKey(copy.layers[index].id, kind),
          ),
        ),
      ),
    ]);
    await putArtboard(copy);
    return summarize(copy, thumbnail);
  });
}

/** Skipped once deleted, so a late save can't bring an artboard back. */
async function updateArtboard(
  id: string,
  change: (artboard: SavedArtboard) => Partial<SavedArtboard>,
) {
  const artboard = await getArtboard(id);
  if (!artboard) return;
  await putArtboard({
    ...artboard,
    ...change(artboard),
    updatedAt: Date.now(),
  });
}

export function saveThumbnail(id: string, thumbnail: Blob) {
  return exclusive(async () => {
    if (await getArtboard(id)) {
      await storage.put(storage.BLOB_STORE, thumbKey(id), thumbnail);
    }
  });
}

/** Saves a cutout that finished after its artboard was closed. */
export function applyStoredCutout(
  artboardId: string,
  layerId: string,
  mask: Blob,
) {
  return exclusive(async () => {
    const artboard = await getArtboard(artboardId);
    if (!artboard?.layers.some((layer) => layer.id === layerId)) return;
    await storage.put(storage.BLOB_STORE, blobKey(layerId, "mask"), mask);
    await updateArtboard(artboardId, ({ layers }) => ({
      layers: layers.map((layer) =>
        layer.id === layerId ? { ...layer, backgroundRemoved: true } : layer,
      ),
    }));
  });
}

export async function restoreArtboard(
  id: string,
): Promise<ArtboardState | null> {
  try {
    const artboard = await getArtboard(id);
    if (!artboard) return null;
    // A photo that won't load is dropped rather than losing the whole artboard.
    const layers = (
      await Promise.all(
        artboard.layers.map((saved) =>
          restoreLayer(saved).catch((cause) => {
            console.warn(`Couldn’t restore “${saved.name}”`, cause);
            return null;
          }),
        ),
      )
    ).filter((layer): layer is Layer => layer !== null);
    return {
      layers,
      settings: artboard.settings,
      canvasFormat: restoreCanvasFormat(artboard.canvasFormat),
      background: themeById(artboard.backgroundId),
    };
  } catch (cause) {
    console.warn("Couldn’t restore the artboard", cause);
    return null;
  }
}

function toSaved(layer: Layer): SavedLayer {
  const { width, height, source, mask, composed, revision, ...saved } = layer;
  return saved;
}

/**
 * Saves `state` in order with other storage changes, re-encoding only the masks
 * whose revision differs from `revisions`, which it updates as they're written.
 */
export function saveArtboardState(
  artboardId: string,
  { layers, settings, canvasFormat, background }: ArtboardState,
  revisions: Map<string, number>,
) {
  return exclusive(async () => {
    const changed = layers.filter(
      (layer) => revisions.get(layer.id) !== layer.revision,
    );
    const masks = await Promise.all(
      changed.map((layer) => canvasToBlob(layer.mask)),
    );
    await Promise.all(
      changed.map((layer, index) =>
        storage.put(
          storage.BLOB_STORE,
          blobKey(layer.id, "mask"),
          masks[index],
        ),
      ),
    );
    for (const layer of changed) revisions.set(layer.id, layer.revision);
    await updateArtboard(artboardId, () => ({
      layers: layers.map(toSaved),
      settings,
      canvasFormat,
      backgroundId: background.id,
    }));
  });
}

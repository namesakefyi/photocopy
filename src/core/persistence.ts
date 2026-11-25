import { DEFAULT_CANVAS } from "./canvasFormat";
import { newId } from "./id";
import { canvasToBlob, cropLayerCanvases, loadPhoto, setMask } from "./layers";
import { DEFAULT_SETTINGS, type PhotocopySettings } from "./photocopy";
import * as storage from "./storage";
import { savedBackground, themeById } from "./themes";
import type { ArtboardState, CanvasFormat, Layer, LayerEntry } from "./types";

const INDEX_KEY = "index";

/** Pixels are stored as blobs; sizes and revisions are rebuilt on load. */
export type SavedLayer = Omit<
  Layer,
  "width" | "height" | "source" | "mask" | "composed" | "revision"
>;

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
  canvasFormat: CanvasFormat;
  settings: PhotocopySettings;
  layers: LayerEntry[];
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

/** Covert loaded images to webp at 0.9 quality to conserve storage and improve load times */
export async function saveSource(layer: Layer) {
  const blob = await canvasToBlob(layer.source, "image/webp", 0.9);
  await storage.put(storage.BLOB_STORE, blobKey(layer.id, "source"), blob);
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
  // Photos saved as the original upload are swapped for the smaller copy once.
  if (source.type === "image/jpeg" || source.type === "image/heic") {
    saveSource({ ...layer, id: saved.id }).catch((cause) =>
      console.warn("Couldn’t shrink the saved photo", cause),
    );
  }
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
    id: newId(),
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
  const { id, backgroundId, canvasFormat, settings } = artboard;
  return {
    id,
    backgroundId,
    canvasFormat,
    settings,
    layers: artboard.layers.map(toEntry),
    thumbnail,
  };
}

export function unsavedArtboard() {
  return summarize(newArtboard());
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

export function createArtboard(backgroundId: string, fromId?: string) {
  return exclusive(async () => {
    const source =
      (fromId && (await getArtboard(fromId))) ||
      (await allArtboards()).sort((a, b) => b.updatedAt - a.updatedAt)[0];
    const artboard = newArtboard({
      backgroundId,
      canvasFormat: source?.canvasFormat ?? DEFAULT_CANVAS,
      settings: source?.settings ?? DEFAULT_SETTINGS,
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
      id: newId(),
      updatedAt: Date.now(),
      layers: artboard.layers.map((layer) => ({
        ...layer,
        id: newId(),
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

export function saveThumbnail(id: string, thumbnail: Blob) {
  return exclusive(async () => {
    if (await getArtboard(id)) {
      await storage.put(storage.BLOB_STORE, thumbKey(id), thumbnail);
    }
  });
}

export function applyStoredCutout(
  artboardId: string,
  layerId: string,
  mask: Blob,
) {
  return exclusive(async () => {
    const artboard = await getArtboard(artboardId);
    if (!artboard?.layers.some((layer) => layer.id === layerId)) return;
    await storage.put(storage.BLOB_STORE, blobKey(layerId, "mask"), mask);
    await putArtboard({
      ...artboard,
      layers: artboard.layers.map((layer) =>
        layer.id === layerId ? { ...layer, backgroundRemoved: true } : layer,
      ),
      updatedAt: Date.now(),
    });
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
      canvasFormat: artboard.canvasFormat,
      background: themeById(artboard.backgroundId),
    };
  } catch (cause) {
    console.warn("Couldn’t restore the artboard", cause);
    return null;
  }
}

export function toEntry({ id, name, visible }: LayerEntry): LayerEntry {
  return { id, name, visible };
}

function toSaved(layer: Layer): SavedLayer {
  const { width, height, source, mask, composed, revision, ...saved } = layer;
  return saved;
}

/** Re-encodes only the masks whose revision differs from `revisions`. */
export function saveArtboardState(
  artboardId: string,
  { layers, settings, canvasFormat, background }: ArtboardState,
  revisions: Map<string, number>,
) {
  return exclusive(async () => {
    const changed = layers.filter(
      (layer) => revisions.get(layer.id) !== layer.revision,
    );
    await Promise.all(
      changed.map(async (layer) =>
        storage.put(
          storage.BLOB_STORE,
          blobKey(layer.id, "mask"),
          await canvasToBlob(layer.mask),
        ),
      ),
    );
    for (const layer of changed) revisions.set(layer.id, layer.revision);
    const artboard = await getArtboard(artboardId);
    if (!artboard) return;
    await putArtboard({
      ...artboard,
      layers: layers.map(toSaved),
      settings,
      canvasFormat,
      backgroundId: background.id,
      updatedAt: Date.now(),
    });
  });
}

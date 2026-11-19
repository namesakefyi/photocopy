import { useCallback, useEffect, useMemo, useRef } from "react";
import { DEFAULT_CANVAS } from "./canvasFormat";
import {
  canvasToBlob,
  composeLayer,
  cropLayerCanvases,
  loadPhoto,
  setMask,
} from "./layers";
import { DEFAULT_SETTINGS, type PhotocopySettings } from "./photocopy";
import * as storage from "./storage";
import { savedBackground, type Theme, themeById } from "./themes";
import type { CanvasFormat, Credit, Layer, Region } from "./types";

const INDEX_KEY = "index";
/** Where the single session lived before there were several artboards. */
const LEGACY_KEY = "current";
const SAVE_DELAY = 400;

export interface SavedLayer {
  id: string;
  name: string;
  x: number;
  y: number;
  scale: number;
  rotation: number;
  flipX: boolean;
  flipY: boolean;
  visible: boolean;
  credit?: Credit;
  backgroundRemoved: boolean;
  crop: Region | null;
}

export interface LegacyState {
  version: 1;
  layers: SavedLayer[];
  settings: PhotocopySettings;
  canvasFormat: CanvasFormat;
}

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

/**
 * Runs storage changes one at a time, in order, so a read-modify-write (like
 * a cutout landing while an autosave runs) never loses the other's change.
 */
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
  const source = await storage.get<Blob>(
    storage.BLOB_STORE,
    blobKey(saved.id, "source"),
  );
  if (!source) return null;
  const layer = await loadPhoto(
    new File([source], saved.name),
    { x: saved.x, y: saved.y, maxWidth: 1, maxHeight: 1 },
    saved.credit,
  );
  const base = saved.crop ? cropLayerCanvases(layer, saved.crop) : layer;
  const restored: Layer = {
    ...base,
    id: saved.id,
    name: saved.name,
    scale: saved.scale,
    rotation: saved.rotation,
    flipX: saved.flipX,
    flipY: saved.flipY,
    visible: saved.visible,
    backgroundRemoved: saved.backgroundRemoved,
  };

  const mask = await storage.get<Blob>(
    storage.BLOB_STORE,
    blobKey(saved.id, "mask"),
  );
  if (mask) {
    const bitmap = await createImageBitmap(mask);
    setMask(restored, bitmap);
    bitmap.close();
  }
  composeLayer(restored);
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

/**
 * Removes files that no artboard uses. Done at start-up rather than on
 * delete, so undoing a layer's deletion can still bring its photo back.
 */
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

async function migrateLegacy() {
  const legacy = await storage.get<LegacyState>(
    storage.STATE_STORE,
    LEGACY_KEY,
  );
  if (!legacy) return;
  if (legacy.version === 1) {
    await putArtboard(
      newArtboard({
        layers: legacy.layers,
        settings: legacy.settings,
        canvasFormat: legacy.canvasFormat,
      }),
    );
  }
  await storage.remove(storage.STATE_STORE, LEGACY_KEY);
}

/**
 * Migrates an older single session, and creates a first artboard when there
 * are none. Artboards the index doesn't list (say, from a crash mid-create)
 * go at the end. Unused files are cleaned up afterward, without holding up
 * the first render.
 */
export function loadLibrary() {
  return exclusive(async () => {
    await migrateLegacy();
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
    const latest = (await allArtboards()).reduce<SavedArtboard | undefined>(
      (latest, artboard) =>
        !latest || artboard.updatedAt > latest.updatedAt ? artboard : latest,
      undefined,
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

/**
 * Merges changes into a saved artboard. Skipped if it's been deleted, so a
 * late save can never bring a deleted artboard back.
 */
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

/**
 * Saves a background removal that finished after its artboard was closed.
 * Nothing can change a closed artboard, so the cutout still fits.
 */
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
      updatedAt: Date.now(),
      layers: artboard.layers.map((layer) =>
        layer.id === layerId ? { ...layer, backgroundRemoved: true } : layer,
      ),
    });
  });
}

export async function restoreArtboard(id: string): Promise<{
  layers: Layer[];
  settings: PhotocopySettings;
  canvasFormat: CanvasFormat;
  background: Theme;
} | null> {
  try {
    const artboard = await getArtboard(id);
    if (!artboard) return null;
    // One photo that won't load (a corrupt or unsupported file) is dropped,
    // rather than losing the whole artboard with it.
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
  return {
    id: layer.id,
    name: layer.name,
    x: layer.x,
    y: layer.y,
    scale: layer.scale,
    rotation: layer.rotation,
    flipX: layer.flipX,
    flipY: layer.flipY,
    visible: layer.visible,
    credit: layer.credit,
    backgroundRemoved: layer.backgroundRemoved,
    crop: layer.crop,
  };
}

interface AutosaveState {
  layers: Layer[];
  settings: PhotocopySettings;
  canvasFormat: CanvasFormat;
  background: Theme;
}

interface AutosaveOptions {
  /** Once true, the state is what was restored, so it's already saved. */
  isRestored: boolean;
  /** False while another tab has the artboard open. */
  canSave: boolean;
  onError?: (cause: unknown) => void;
  /** How long changes settle before saving; tests shorten it. */
  delay?: number;
}

/**
 * Saves the artboard shortly after anything changes. Masks are re-encoded
 * only when their revision changes. Saves run one at a time, in order, and a
 * save that a newer one has replaced is skipped, so an older state can never
 * finish last and overwrite a newer one. `flush` saves any pending change
 * right away, for before the artboard is closed.
 */
export function useAutosave(
  artboardId: string,
  state: AutosaveState,
  { isRestored, canSave, onError, delay = SAVE_DELAY }: AutosaveOptions,
) {
  const savedRevisions = useRef<Map<string, number> | null>(null);
  const restoredState = useRef<AutosaveState | null>(null);
  const pending = useRef<(() => Promise<void>) | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const lastSave = useRef<Promise<void>>(Promise.resolve());
  const latestError = useRef(onError);
  latestError.current = onError;
  const { layers, settings, canvasFormat, background } = state;

  // What was just restored is already saved; only later changes need saving.
  if (isRestored && !savedRevisions.current) {
    savedRevisions.current = new Map(
      layers.map((layer) => [layer.id, layer.revision]),
    );
    restoredState.current = state;
  }

  const runPending = useCallback(() => {
    clearTimeout(timer.current);
    const save = pending.current;
    pending.current = null;
    if (save) lastSave.current = exclusive(save);
    return lastSave.current;
  }, []);

  useEffect(() => {
    const revisions = savedRevisions.current;
    const restored = restoredState.current;
    if (!revisions || !canSave) return;
    if (
      restored?.layers === layers &&
      restored.settings === settings &&
      restored.canvasFormat === canvasFormat &&
      restored.background === background
    ) {
      return;
    }
    restoredState.current = null;
    pending.current = async () => {
      try {
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
      } catch (cause) {
        console.warn("Couldn’t save the artboard locally", cause);
        latestError.current?.(cause);
      }
    };
    clearTimeout(timer.current);
    timer.current = setTimeout(runPending, delay);
  }, [
    artboardId,
    layers,
    settings,
    canvasFormat,
    background,
    canSave,
    delay,
    runPending,
  ]);

  // Saves anything still waiting when the artboard closes.
  useEffect(() => () => void runPending(), [runPending]);

  return useMemo(() => ({ flush: runPending }), [runPending]);
}

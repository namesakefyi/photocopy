import { useEffect, useRef } from "react";
import {
  canvasToBlob,
  composeLayer,
  cropLayerCanvases,
  loadPhoto,
  setMask,
} from "./layers";
import type { PhotocopySettings } from "./photocopy";
import * as storage from "./storage";
import type { CanvasFormat, Credit, Layer, Region } from "./types";

const STATE_KEY = "current";
const SAVE_DELAY = 400;

interface SavedLayer {
  id: string;
  name: string;
  x: number;
  y: number;
  scale: number;
  rotation: number;
  flipX: boolean;
  /** Missing in sessions saved before vertical flip existed. */
  flipY?: boolean;
  visible: boolean;
  credit?: Credit;
  backgroundRemoved?: boolean;
  /** Older sessions: the stored automatic cutout meant background removed. */
  hasAutoMask?: boolean;
  /** Missing in sessions saved before crop to fit existed. */
  crop?: Region | null;
}

interface SavedState {
  version: 1;
  layers: SavedLayer[];
  settings: PhotocopySettings;
  canvasFormat: CanvasFormat;
}

const BLOB_KINDS = ["source", "mask"] as const;

const blobKey = (id: string, kind: (typeof BLOB_KINDS)[number]) =>
  `${id}:${kind}`;

/** Keeps the original file so a restore rebuilds the photo at full quality. */
export async function saveSource(layer: Layer, file: Blob) {
  try {
    await storage.put(storage.BLOB_STORE, blobKey(layer.id, "source"), file);
  } catch (cause) {
    console.warn("Couldn’t save photo locally", cause);
  }
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
    flipY: saved.flipY ?? false,
    visible: saved.visible,
    backgroundRemoved: saved.backgroundRemoved ?? saved.hasAutoMask ?? false,
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

/** Loads the last session, or null if there isn't one (or storage is off). */
/**
 * Removes files for photos that aren't in the saved session. Done at start-up
 * rather than on delete, so undoing a delete can still bring a photo back.
 */
async function removeUnusedFiles(liveIds: Set<string>) {
  for (const key of await storage.keys(storage.BLOB_STORE)) {
    const [id, kind] = key.split(":");
    const isKnownKind = (BLOB_KINDS as readonly string[]).includes(kind);
    if (!liveIds.has(id) || !isKnownKind) {
      await storage.remove(storage.BLOB_STORE, key);
    }
  }
}

export async function restoreSession() {
  try {
    const state = await storage.get<SavedState>(storage.STATE_STORE, STATE_KEY);
    await removeUnusedFiles(
      new Set(
        state?.version === 1 ? state.layers.map((layer) => layer.id) : [],
      ),
    );
    if (state?.version !== 1) return null;
    const layers = await Promise.all(state.layers.map(restoreLayer));
    return {
      layers: layers.filter((layer): layer is Layer => layer !== null),
      settings: state.settings,
      canvasFormat: state.canvasFormat,
    };
  } catch (cause) {
    console.warn("Couldn’t restore the last session", cause);
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

/**
 * Saves the session shortly after anything changes. Masks are re-encoded
 * only when their revision changes.
 */
export function useAutosave(
  layers: Layer[],
  settings: PhotocopySettings,
  canvasFormat: CanvasFormat,
  isRestored: boolean,
) {
  const savedRevisions = useRef(new Map<string, number>());

  useEffect(() => {
    if (!isRestored) return;
    const timer = setTimeout(async () => {
      try {
        for (const layer of layers) {
          if (savedRevisions.current.get(layer.id) !== layer.revision) {
            await storage.put(
              storage.BLOB_STORE,
              blobKey(layer.id, "mask"),
              await canvasToBlob(layer.mask),
            );
            savedRevisions.current.set(layer.id, layer.revision);
          }
        }

        const state: SavedState = {
          version: 1,
          layers: layers.map(toSaved),
          settings,
          canvasFormat,
        };
        await storage.put(storage.STATE_STORE, STATE_KEY, state);
      } catch (cause) {
        console.warn("Couldn’t save the session locally", cause);
      }
    }, SAVE_DELAY);
    return () => clearTimeout(timer);
  }, [layers, settings, canvasFormat, isRestored]);
}

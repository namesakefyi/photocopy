import { DEFAULT_CANVAS } from "../core/canvasFormat";
import type { SavedArtboard } from "../core/persistence";
import { DEFAULT_SETTINGS } from "../core/photocopy";
import * as storage from "../core/storage";
import { DEFAULT_THEME } from "../core/themes";

/** Empties both IndexedDB stores, so each test starts from a blank slate. */
export async function clearStorage() {
  for (const name of [storage.STATE_STORE, storage.BLOB_STORE] as const) {
    for (const key of await storage.keys(name)) await storage.remove(name, key);
  }
}

export function artboard(changes: Partial<SavedArtboard> = {}): SavedArtboard {
  return {
    version: 2,
    id: "artboard-1",
    updatedAt: 1,
    layers: [],
    settings: DEFAULT_SETTINGS,
    canvasFormat: DEFAULT_CANVAS,
    backgroundId: DEFAULT_THEME.id,
    ...changes,
  };
}

export const putArtboard = (saved: SavedArtboard) =>
  storage.put(storage.STATE_STORE, `doc:${saved.id}`, saved);
export const readArtboard = (id: string) =>
  storage.get<SavedArtboard>(storage.STATE_STORE, `doc:${id}`);

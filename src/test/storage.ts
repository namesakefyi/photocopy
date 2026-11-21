import * as storage from "../core/storage";

/** Empties both IndexedDB stores, so each test starts from a blank slate. */
export async function clearStorage() {
  for (const name of [storage.STATE_STORE, storage.BLOB_STORE] as const) {
    for (const key of await storage.keys(name)) await storage.remove(name, key);
  }
}

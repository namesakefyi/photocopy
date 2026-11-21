/** A tiny promise wrapper around one IndexedDB database with two stores. */

const DB_NAME = "photocopy";
const DB_VERSION = 1;
export const STATE_STORE = "state";
export const BLOB_STORE = "blobs";

type StoreName = typeof STATE_STORE | typeof BLOB_STORE;

let database: Promise<IDBDatabase> | null = null;

function open() {
  database ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STATE_STORE);
      request.result.createObjectStore(BLOB_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return database;
}

function promisify<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function store(name: StoreName, mode: IDBTransactionMode) {
  return (await open()).transaction(name, mode).objectStore(name);
}

export async function get<T>(name: StoreName, key: string) {
  return promisify<T | undefined>((await store(name, "readonly")).get(key));
}

export async function put(name: StoreName, key: string, value: unknown) {
  await promisify((await store(name, "readwrite")).put(value, key));
}

export async function remove(name: StoreName, key: string) {
  await promisify((await store(name, "readwrite")).delete(key));
}

export async function keys(name: StoreName) {
  const all = await promisify((await store(name, "readonly")).getAllKeys());
  return all.map(String);
}

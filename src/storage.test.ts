import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import * as storage from "./storage";
import { clearStorage } from "./test/storage";

beforeEach(clearStorage);

describe("storage", () => {
  it("stores, reads and removes values", async () => {
    await storage.put(storage.STATE_STORE, "a", { value: 1 });
    expect(await storage.get(storage.STATE_STORE, "a")).toEqual({ value: 1 });
    await storage.remove(storage.STATE_STORE, "a");
    expect(await storage.get(storage.STATE_STORE, "a")).toBeUndefined();
  });

  it("lists keys per store", async () => {
    await storage.put(storage.STATE_STORE, "state", 1);
    await storage.put(storage.BLOB_STORE, "x:source", 2);
    await storage.put(storage.BLOB_STORE, "x:mask", 3);
    expect(await storage.keys(storage.STATE_STORE)).toEqual(["state"]);
    expect((await storage.keys(storage.BLOB_STORE)).sort()).toEqual([
      "x:mask",
      "x:source",
    ]);
  });

  it("overwrites a key", async () => {
    await storage.put(storage.STATE_STORE, "a", 1);
    await storage.put(storage.STATE_STORE, "a", 2);
    expect(await storage.get(storage.STATE_STORE, "a")).toBe(2);
  });
});

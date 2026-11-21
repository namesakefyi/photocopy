// @vitest-environment happy-dom
import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  artboard,
  clearStorage,
  putArtboard,
  readArtboard,
} from "../test/storage";
import { DEFAULT_CANVAS } from "./canvasFormat";
import {
  applyStoredCutout,
  createArtboard,
  deleteArtboard,
  duplicateArtboard,
  loadLibrary,
  restoreArtboard,
  type SavedLayer,
} from "./persistence";
import { DEFAULT_SETTINGS } from "./photocopy";
import * as storage from "./storage";
import { DEFAULT_THEME, THEMES } from "./themes";
import type { CanvasFormat } from "./types";

const savedLayer = (id: string): SavedLayer => ({
  id,
  name: id,
  x: 0,
  y: 0,
  scale: 1,
  rotation: 0,
  flipX: false,
  flipY: false,
  visible: true,
  backgroundRemoved: false,
  crop: null,
});

const putBlob = (key: string, text = key) =>
  storage.put(storage.BLOB_STORE, key, new Blob([text]));
const blobKeys = async () => (await storage.keys(storage.BLOB_STORE)).sort();

beforeEach(async () => {
  await clearStorage();
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("loadLibrary", () => {
  it("starts with one empty artboard", async () => {
    const library = await loadLibrary();
    expect(library.artboards).toHaveLength(1);
    expect(library.activeId).toBe(library.artboards[0].id);
    expect((await readArtboard(library.activeId))?.layers).toEqual([]);
  });

  it("is the same library when loaded again", async () => {
    const first = await loadLibrary();
    const second = await loadLibrary();
    expect(second.artboards.map((d) => d.id)).toEqual(
      first.artboards.map((d) => d.id),
    );
  });

  it("removes files no artboard uses", async () => {
    await putBlob("a:source");
    const library = await loadLibrary();
    expect(library.artboards).toHaveLength(1);
    // Cleaned up after loading, without holding it up.
    await vi.waitFor(async () => expect(await blobKeys()).toEqual([]));
  });

  it("keeps the index's order and open artboard", async () => {
    await putArtboard(artboard({ id: "a" }));
    await putArtboard(artboard({ id: "b" }));
    await putArtboard(artboard({ id: "c", updatedAt: 5 }));
    await storage.put(storage.STATE_STORE, "index", {
      version: 1,
      order: ["b", "gone", "a"],
      activeId: "a",
    });
    const library = await loadLibrary();
    // Unlisted artboards go at the end; missing ones are dropped.
    expect(library.artboards.map((d) => d.id)).toEqual(["b", "a", "c"]);
    expect(library.activeId).toBe("a");
  });

  it("cleans up files no artboard uses", async () => {
    await putArtboard(artboard({ id: "a", layers: [savedLayer("one")] }));
    await putArtboard(artboard({ id: "b", layers: [savedLayer("two")] }));
    for (const key of [
      "one:source",
      "one:mask",
      "one:unknown",
      "two:source",
      "gone:source",
      "thumb:a",
      "thumb:gone",
    ]) {
      await putBlob(key);
    }
    const library = await loadLibrary();
    await vi.waitFor(async () =>
      expect(await blobKeys()).toEqual([
        "one:mask",
        "one:source",
        "thumb:a",
        "two:source",
      ]),
    );
    expect(library.artboards.find((d) => d.id === "a")?.thumbnail).toBeTruthy();
  });
});

describe("restoreArtboard", () => {
  it("is null for an artboard that doesn't exist", async () => {
    expect(await restoreArtboard("nope")).toBeNull();
  });

  it("restores the settings, canvas and background", async () => {
    const canvasFormat: CanvasFormat = { ...DEFAULT_CANVAS, preset: "video" };
    const settings = { ...DEFAULT_SETTINGS, darkness: 70 };
    await putArtboard(
      artboard({ canvasFormat, settings, backgroundId: THEMES[1].id }),
    );
    expect(await restoreArtboard("artboard-1")).toEqual({
      layers: [],
      settings,
      canvasFormat,
      background: THEMES[1],
    });
  });

  it("turns an old trimmed canvas into the custom size it framed", async () => {
    const canvasFormat = {
      ...DEFAULT_CANVAS,
      preset: "trimmed",
    } as unknown as CanvasFormat;
    await putArtboard(artboard({ canvasFormat }));
    expect((await restoreArtboard("artboard-1"))?.canvasFormat).toEqual({
      preset: "custom",
      customWidth: 1500,
      customHeight: 1500,
    });
  });

  it("drops photos whose files are missing or won't load", async () => {
    await putArtboard(
      artboard({ layers: [savedLayer("missing"), savedLayer("broken")] }),
    );
    // There's no image decoder here, so this file can't load, like a corrupt one.
    await putBlob("broken:source", "x");
    const restored = await restoreArtboard("artboard-1");
    expect(restored?.layers).toEqual([]);
    expect(restored?.settings).toEqual(DEFAULT_SETTINGS);
  });
});

describe("managing artboards", () => {
  it("creates an empty artboard with the background given", async () => {
    const created = await createArtboard(THEMES[2].id);
    expect(created.backgroundId).toBe(THEMES[2].id);
    expect((await readArtboard(created.id))?.layers).toEqual([]);
  });

  it("starts at the canvas size of the most recently edited artboard", async () => {
    const square: CanvasFormat = { ...DEFAULT_CANVAS, preset: "square" };
    const custom: CanvasFormat = {
      preset: "custom",
      customWidth: 800,
      customHeight: 600,
    };
    await putArtboard(
      artboard({ id: "a", updatedAt: 2, canvasFormat: custom }),
    );
    await putArtboard(
      artboard({ id: "b", updatedAt: 1, canvasFormat: square }),
    );
    const created = await createArtboard(DEFAULT_THEME.id);
    expect((await readArtboard(created.id))?.canvasFormat).toEqual(custom);
  });

  it("starts at the default size when there are no artboards", async () => {
    const created = await createArtboard(DEFAULT_THEME.id);
    expect((await readArtboard(created.id))?.canvasFormat).toEqual(
      DEFAULT_CANVAS,
    );
  });

  it("deletes an artboard with its files", async () => {
    await putArtboard(artboard({ id: "a", layers: [savedLayer("one")] }));
    await putArtboard(artboard({ id: "b", layers: [savedLayer("two")] }));
    for (const key of ["one:source", "one:mask", "thumb:a", "two:source"]) {
      await putBlob(key);
    }
    await deleteArtboard("a");
    expect(await readArtboard("a")).toBeUndefined();
    expect(await blobKeys()).toEqual(["two:source"]);
  });

  it("duplicates an artboard and its files under new ids", async () => {
    await putArtboard(artboard({ id: "a", layers: [savedLayer("one")] }));
    await putBlob("one:source", "photo");
    await putBlob("one:mask", "mask");
    await putBlob("thumb:a");
    const copy = await duplicateArtboard("a");
    const saved = await readArtboard(copy?.id ?? "");
    const newId = saved?.layers[0].id ?? "";
    expect(newId).not.toBe("one");
    expect(await blobKeys()).toEqual(
      [
        "one:mask",
        "one:source",
        `${newId}:mask`,
        `${newId}:source`,
        "thumb:a",
        `thumb:${copy?.id}`,
      ].sort(),
    );
  });

  it("saves a cutout into a closed artboard", async () => {
    await putArtboard(artboard({ layers: [savedLayer("one")] }));
    await applyStoredCutout("artboard-1", "one", new Blob(["cutout"]));
    expect(
      (await readArtboard("artboard-1"))?.layers[0].backgroundRemoved,
    ).toBe(true);
    expect(await blobKeys()).toEqual(["one:mask"]);
  });

  it("drops a cutout for an artboard deleted meanwhile", async () => {
    await applyStoredCutout("gone", "one", new Blob(["cutout"]));
    expect(await blobKeys()).toEqual([]);
    expect(await readArtboard("gone")).toBeUndefined();
  });
});

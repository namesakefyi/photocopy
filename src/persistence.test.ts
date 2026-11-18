// @vitest-environment happy-dom
import "fake-indexeddb/auto";
import { act, useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_CANVAS } from "./canvasFormat";
import { restoreSession, type SavedState, useAutosave } from "./persistence";
import { DEFAULT_SETTINGS } from "./photocopy";
import * as storage from "./storage";
import { renderHook } from "./test/renderHook";
import { clearStorage } from "./test/storage";
import type { CanvasFormat } from "./types";

function saved(changes: Partial<SavedState> = {}): SavedState {
  return {
    version: 1,
    layers: [],
    settings: DEFAULT_SETTINGS,
    canvasFormat: DEFAULT_CANVAS,
    ...changes,
  };
}

const savedLayer = (id: string) => ({
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

describe("restoreSession", () => {
  beforeEach(async () => {
    await clearStorage();
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("is null with nothing saved", async () => {
    expect(await restoreSession()).toBeNull();
  });

  it("restores the settings and canvas", async () => {
    const canvasFormat: CanvasFormat = { ...DEFAULT_CANVAS, preset: "video" };
    const settings = { ...DEFAULT_SETTINGS, darkness: 70 };
    await storage.put(
      storage.STATE_STORE,
      "current",
      saved({ canvasFormat, settings }),
    );
    expect(await restoreSession()).toEqual({
      layers: [],
      settings,
      canvasFormat,
    });
  });

  it("drops photos whose files are missing or won't load, keeping the session", async () => {
    await storage.put(
      storage.STATE_STORE,
      "current",
      saved({ layers: [savedLayer("missing"), savedLayer("broken")] }),
    );
    // There's no image decoder here, so this file can't load, like a corrupt one.
    await storage.put(storage.BLOB_STORE, "broken:source", new Blob(["x"]));
    const session = await restoreSession();
    expect(session?.layers).toEqual([]);
    expect(session?.settings).toEqual(DEFAULT_SETTINGS);
  });

  it("cleans up files for photos that aren't in the session", async () => {
    await storage.put(
      storage.STATE_STORE,
      "current",
      saved({ layers: [savedLayer("kept")] }),
    );
    await storage.put(storage.BLOB_STORE, "kept:source", new Blob(["a"]));
    await storage.put(storage.BLOB_STORE, "kept:mask", new Blob(["b"]));
    await storage.put(storage.BLOB_STORE, "kept:unknown", new Blob(["c"]));
    await storage.put(storage.BLOB_STORE, "gone:source", new Blob(["d"]));
    await restoreSession();
    expect((await storage.keys(storage.BLOB_STORE)).sort()).toEqual([
      "kept:mask",
      "kept:source",
    ]);
  });

  it("ignores sessions from an unknown version, and clears their files", async () => {
    await storage.put(storage.STATE_STORE, "current", { version: 2 });
    await storage.put(storage.BLOB_STORE, "a:source", new Blob(["a"]));
    expect(await restoreSession()).toBeNull();
    expect(await storage.keys(storage.BLOB_STORE)).toEqual([]);
  });
});

/** Short, so saves still wait for changes to settle, without slowing tests. */
const TEST_DELAY = 5;
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("useAutosave", () => {
  beforeEach(clearStorage);

  const readSaved = () =>
    storage.get<SavedState>(storage.STATE_STORE, "current");

  function renderAutosave(isRestored: boolean) {
    return renderHook(() => {
      const [settings, setSettings] = useState(DEFAULT_SETTINGS);
      const [canvasFormat, setCanvasFormat] = useState(DEFAULT_CANVAS);
      useAutosave([], settings, canvasFormat, isRestored, TEST_DELAY);
      return { setSettings, setCanvasFormat };
    });
  }

  it("saves the latest state shortly after changes", async () => {
    const { result, unmount } = renderAutosave(true);
    act(() => {
      result.current.setSettings({ ...DEFAULT_SETTINGS, darkness: 10 });
    });
    act(() => {
      result.current.setSettings({ ...DEFAULT_SETTINGS, darkness: 20 });
      result.current.setCanvasFormat({ ...DEFAULT_CANVAS, preset: "story" });
    });
    await vi.waitFor(async () => {
      const state = await readSaved();
      expect(state?.settings.darkness).toBe(20);
      expect(state?.canvasFormat.preset).toBe("story");
    });
    unmount();
  });

  it("writes newer changes last, even when they come while saving", async () => {
    const { result, unmount } = renderAutosave(true);
    for (const darkness of [11, 12, 13, 14]) {
      act(() => {
        result.current.setSettings({ ...DEFAULT_SETTINGS, darkness });
      });
      // Past the delay, so each change starts a save while the last may
      // still be writing.
      await wait(TEST_DELAY + 1);
    }
    await vi.waitFor(async () => {
      expect((await readSaved())?.settings.darkness).toBe(14);
    });
    unmount();
  });

  it("saves nothing until the last session has been restored", async () => {
    const { unmount } = renderAutosave(false);
    await wait(TEST_DELAY * 10);
    expect(await readSaved()).toBeUndefined();
    unmount();
  });
});

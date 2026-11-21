// @vitest-environment happy-dom
import "fake-indexeddb/auto";
import { act, useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_CANVAS } from "../core/canvasFormat";
import { deleteArtboard } from "../core/persistence";
import { DEFAULT_SETTINGS } from "../core/photocopy";
import { DEFAULT_THEME } from "../core/themes";
import { renderHook } from "../test/renderHook";
import {
  artboard,
  clearStorage,
  putArtboard,
  readArtboard,
} from "../test/storage";
import { useAutosave } from "./useAutosave";

beforeEach(async () => {
  await clearStorage();
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

/** Short, so saves still wait for changes to settle, without slowing tests. */
const TEST_DELAY = 5;
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("useAutosave", () => {
  beforeEach(() => putArtboard(artboard()));

  function renderAutosave(
    { isRestored = true, canSave = true } = {},
    delay = TEST_DELAY,
  ) {
    return renderHook(() => {
      const [settings, setSettings] = useState(DEFAULT_SETTINGS);
      const [canvasFormat, setCanvasFormat] = useState(DEFAULT_CANVAS);
      const [lock, setCanSave] = useState(canSave);
      const autosave = useAutosave(
        "artboard-1",
        { layers: [], settings, canvasFormat, background: DEFAULT_THEME },
        { isRestored, canSave: lock, delay },
      );
      return { setSettings, setCanvasFormat, setCanSave, autosave };
    });
  }

  it("saves the latest state shortly after changes", async () => {
    const { result, unmount } = renderAutosave();
    act(() => {
      result.current.setSettings({ ...DEFAULT_SETTINGS, darkness: 10 });
    });
    act(() => {
      result.current.setSettings({ ...DEFAULT_SETTINGS, darkness: 20 });
      result.current.setCanvasFormat({ ...DEFAULT_CANVAS, preset: "story" });
    });
    await vi.waitFor(async () => {
      const state = await readArtboard("artboard-1");
      expect(state?.settings.darkness).toBe(20);
      expect(state?.canvasFormat.preset).toBe("story");
    });
    unmount();
  });

  it("writes newer changes last, even when they come while saving", async () => {
    const { result, unmount } = renderAutosave();
    for (const darkness of [11, 12, 13, 14]) {
      act(() => {
        result.current.setSettings({ ...DEFAULT_SETTINGS, darkness });
      });
      // Past the delay, so each save starts while the last may still be writing.
      await wait(TEST_DELAY + 1);
    }
    await vi.waitFor(async () => {
      expect((await readArtboard("artboard-1"))?.settings.darkness).toBe(14);
    });
    unmount();
  });

  it("doesn't save what was just loaded", async () => {
    const { unmount } = renderAutosave();
    await wait(TEST_DELAY * 10);
    expect((await readArtboard("artboard-1"))?.updatedAt).toBe(1);
    unmount();
  });

  it("saves nothing until restored", async () => {
    const { result, unmount } = renderAutosave({ isRestored: false });
    act(() => {
      result.current.setSettings({ ...DEFAULT_SETTINGS, darkness: 10 });
    });
    await wait(TEST_DELAY * 10);
    expect((await readArtboard("artboard-1"))?.settings.darkness).toBe(
      DEFAULT_SETTINGS.darkness,
    );
    unmount();
  });

  it("saves changes made while another tab had it, once it's let go", async () => {
    const { result, unmount } = renderAutosave({ canSave: false });
    act(() => {
      result.current.setSettings({ ...DEFAULT_SETTINGS, darkness: 21 });
    });
    await wait(TEST_DELAY * 10);
    expect((await readArtboard("artboard-1"))?.settings.darkness).toBe(
      DEFAULT_SETTINGS.darkness,
    );
    act(() => result.current.setCanSave(true));
    await vi.waitFor(async () => {
      expect((await readArtboard("artboard-1"))?.settings.darkness).toBe(21);
    });
    unmount();
  });

  it("saves a change right away when flushed", async () => {
    const { result, unmount } = renderAutosave({}, 60_000);
    act(() => {
      result.current.setSettings({ ...DEFAULT_SETTINGS, darkness: 33 });
    });
    await act(() => result.current.autosave.flush());
    expect((await readArtboard("artboard-1"))?.settings.darkness).toBe(33);
    unmount();
  });

  it("never brings back a deleted artboard", async () => {
    const { result, unmount } = renderAutosave();
    await deleteArtboard("artboard-1");
    act(() => {
      result.current.setSettings({ ...DEFAULT_SETTINGS, darkness: 10 });
    });
    await act(() => result.current.autosave.flush());
    expect(await readArtboard("artboard-1")).toBeUndefined();
    unmount();
  });
});

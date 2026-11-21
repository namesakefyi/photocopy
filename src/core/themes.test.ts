import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_THEME,
  saveBackground,
  savedBackground,
  THEMES,
} from "./themes";

const purple = THEMES[0];

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("saved background", () => {
  it("round-trips through storage", () => {
    vi.stubGlobal("localStorage", memoryStorage());
    saveBackground(purple);
    expect(savedBackground()).toBe(purple);
  });

  it("uses the default for nothing saved or an old transparent background", () => {
    const storage = memoryStorage();
    vi.stubGlobal("localStorage", storage);
    expect(savedBackground()).toBe(DEFAULT_THEME);
    storage.setItem("photocopy-background", "transparent");
    expect(savedBackground()).toBe(DEFAULT_THEME);
  });

  it("falls back to the default when storage is unavailable", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    });
    expect(() => saveBackground(purple)).not.toThrow();
    expect(savedBackground()).toBe(DEFAULT_THEME);
  });
});

describe("THEMES", () => {
  it("has unique ids", () => {
    const ids = THEMES.map((theme) => theme.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

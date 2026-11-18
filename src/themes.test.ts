import { afterEach, describe, expect, it, vi } from "vitest";
import {
  exportFill,
  NO_BACKGROUND,
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

describe("exportFill", () => {
  it("fills with the color only when included", () => {
    expect(exportFill({ theme: purple, includeInExport: true })).toBe(
      purple.color,
    );
    expect(exportFill({ theme: purple, includeInExport: false })).toBeNull();
  });

  it("leaves a transparent background transparent", () => {
    expect(exportFill({ theme: null, includeInExport: true })).toBeNull();
  });
});

describe("saved background", () => {
  it("round-trips through storage", () => {
    vi.stubGlobal("localStorage", memoryStorage());
    saveBackground({ theme: purple, includeInExport: false });
    expect(savedBackground()).toEqual({
      theme: purple,
      includeInExport: false,
    });
  });

  it("round-trips a transparent background", () => {
    vi.stubGlobal("localStorage", memoryStorage());
    saveBackground({ theme: null, includeInExport: true });
    expect(savedBackground()).toEqual({ theme: null, includeInExport: true });
  });

  it("falls back to none when storage is unavailable", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    });
    expect(() =>
      saveBackground({ theme: purple, includeInExport: true }),
    ).not.toThrow();
    expect(savedBackground()).toEqual(NO_BACKGROUND);
  });
});

describe("THEMES", () => {
  it("has unique ids", () => {
    const ids = THEMES.map((theme) => theme.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

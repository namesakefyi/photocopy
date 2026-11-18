import { describe, expect, it } from "vitest";
import { type KeyPress, shortcutFor } from "./shortcuts";

const press = (key: string, changes: Partial<KeyPress> = {}): KeyPress => ({
  key,
  metaKey: false,
  ctrlKey: false,
  shiftKey: false,
  ...changes,
});
const mod = (key: string, changes: Partial<KeyPress> = {}) =>
  press(key, { metaKey: true, ...changes });

describe("shortcutFor", () => {
  it("maps the modifier shortcuts", () => {
    expect(shortcutFor(mod("z"))).toBe("undo");
    expect(shortcutFor(mod("Z", { shiftKey: true }))).toBe("redo");
    expect(shortcutFor(mod("y"))).toBe("redo");
    expect(shortcutFor(mod("e"))).toBe("export");
    expect(shortcutFor(mod("]"))).toBe("forward");
    expect(shortcutFor(mod("["))).toBe("back");
  });

  it("treats Ctrl like ⌘", () => {
    expect(shortcutFor(press("z", { ctrlKey: true }))).toBe("undo");
  });

  it("zooms with or without Shift on the plus key", () => {
    expect(shortcutFor(mod("="))).toBe("zoomIn");
    expect(shortcutFor(mod("+", { shiftKey: true }))).toBe("zoomIn");
    expect(shortcutFor(mod("-"))).toBe("zoomOut");
    expect(shortcutFor(mod("_", { shiftKey: true }))).toBe("zoomOut");
    expect(shortcutFor(mod("1"))).toBe("zoomActual");
    expect(shortcutFor(mod("0"))).toBe("zoomFit");
  });

  it("maps the single-key shortcuts", () => {
    expect(shortcutFor(press("]"))).toBe("brushLarger");
    expect(shortcutFor(press("["))).toBe("brushSmaller");
    expect(shortcutFor(press("Delete"))).toBe("delete");
    expect(shortcutFor(press("Backspace"))).toBe("delete");
    expect(shortcutFor(press("b"))).toBe("restore");
    expect(shortcutFor(press("E"))).toBe("erase");
    expect(shortcutFor(press("Escape"))).toBe("escape");
  });

  it("keeps a modifier's shortcut from triggering its single-key one", () => {
    // ⌘E exports; it must not also pick the Add to Mask brush.
    expect(shortcutFor(mod("e"))).toBe("export");
    expect(shortcutFor(mod("b"))).toBeNull();
  });

  it("leaves other keys to the browser", () => {
    expect(shortcutFor(press("a"))).toBeNull();
    expect(shortcutFor(mod("c"))).toBeNull();
    expect(shortcutFor(mod("r"))).toBeNull();
  });
});

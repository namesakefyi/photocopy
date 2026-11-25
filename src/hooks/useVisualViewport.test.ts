// @vitest-environment happy-dom
import { act } from "react";
import { describe, expect, it, vi } from "vitest";
import { renderHook } from "../test/renderHook";
import { useVisualViewport } from "./useVisualViewport";

function stubViewport(height: number, scale = 1) {
  const viewport = Object.assign(new EventTarget(), {
    height,
    offsetTop: 0,
    scale,
  });
  vi.stubGlobal("visualViewport", viewport);
  return viewport;
}

const value = (name: string) =>
  document.documentElement.style.getPropertyValue(name);

describe("useVisualViewport", () => {
  it("follows the visible area as a keyboard opens and the page shifts", () => {
    const viewport = stubViewport(800);
    const { unmount } = renderHook(useVisualViewport);
    expect(value("--viewport-height")).toBe("800px");
    act(() => {
      viewport.height = 450;
      viewport.offsetTop = 120;
      viewport.dispatchEvent(new Event("resize"));
    });
    expect(value("--viewport-height")).toBe("450px");
    expect(value("--viewport-top")).toBe("120px");
    unmount();
    expect(value("--viewport-height")).toBe("");
  });

  it("keeps the app's size while pinch zoomed", () => {
    const viewport = stubViewport(800);
    const { unmount } = renderHook(useVisualViewport);
    act(() => {
      viewport.height = 400;
      viewport.scale = 2;
      viewport.dispatchEvent(new Event("resize"));
    });
    expect(value("--viewport-height")).toBe("800px");
    unmount();
  });
});

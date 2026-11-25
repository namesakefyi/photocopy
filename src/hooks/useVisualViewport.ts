import { useEffect } from "react";

/**
 * Sets `--viewport-top` and `--viewport-height` on the page to the visible
 * area. Mobile browsers slide the on-screen keyboard over the page, and iOS
 * also shifts the page to show a focused field; pinning the app to these keeps
 * all of it, bottom controls included, above the keyboard.
 */
export function useVisualViewport() {
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const root = document.documentElement;
    let top = Number.NaN;
    let height = Number.NaN;
    const update = () => {
      // Pinch zoom also shrinks the visible area; the app keeps its size then.
      if (viewport.scale > 1.01) return;
      // Written only on change: each write restyles the page and resizes the canvas.
      if (viewport.offsetTop !== top) {
        top = viewport.offsetTop;
        root.style.setProperty("--viewport-top", `${top}px`);
      }
      if (viewport.height !== height) {
        height = viewport.height;
        root.style.setProperty("--viewport-height", `${height}px`);
      }
    };
    update();
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);
    return () => {
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
      root.style.removeProperty("--viewport-top");
      root.style.removeProperty("--viewport-height");
    };
  }, []);
}

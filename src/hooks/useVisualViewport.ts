import { useEffect } from "react";

/** Pins the app to the visible area, since mobile keyboards cover the page rather than shrink it. */
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

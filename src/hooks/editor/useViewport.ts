import {
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  FIT_VIEWPORT,
  type Frame,
  moveViewport,
  type Point,
  resolveViewport,
  type ViewMove,
  type Viewport,
  wheelZoomFactor,
  type ZoomAction,
  zoomViewport,
} from "../../core/zoom";

const NO_PAN = { x: 0, y: 0 };

/** Scrolling pans; pinching or ctrl-scrolling zooms around the pointer. */
export function useViewport(
  containerRef: React.RefObject<HTMLElement | null>,
  artboard: { width: number; height: number },
  onPinchStart: () => void,
) {
  const [viewport, setViewport] = useState<Viewport>(FIT_VIEWPORT);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const frame: Frame = { view: size, artboard };
  const { scale, center } = resolveViewport(viewport, frame);
  const offset = {
    x: size.width / 2 - center.x * scale,
    y: size.height / 2 - center.y * scale,
  };

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    // Measure now so the first paint fits the real size, not 0×0 (a 1% zoom).
    setSize({ width: container.clientWidth, height: container.clientHeight });
    const observer = new ResizeObserver(([entry]) =>
      setSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      }),
    );
    observer.observe(container);
    return () => observer.disconnect();
  }, [containerRef]);

  // A new canvas size starts over, fitted.
  const fittedSize = useRef(artboard);
  useEffect(() => {
    const { width, height } = fittedSize.current;
    if (artboard.width === width && artboard.height === height) return;
    fittedSize.current = artboard;
    setViewport(FIT_VIEWPORT);
  }, [artboard]);

  // Wheel, pinch and pan moves are batched to render once per frame.
  const queuedMoves = useRef<ViewMove[]>([]);
  const queuedFrame = useRef(0);
  useEffect(() => () => cancelAnimationFrame(queuedFrame.current), []);

  function move(viewMove: ViewMove) {
    queuedMoves.current.push(viewMove);
    if (queuedFrame.current) return;
    const at = frame;
    queuedFrame.current = requestAnimationFrame(() => {
      queuedFrame.current = 0;
      const moves = queuedMoves.current;
      queuedMoves.current = [];
      setViewport((current) =>
        moves.reduce((view, next) => moveViewport(view, next, at), current),
      );
    });
  }

  function pointerIn(event: { clientX: number; clientY: number }): Point {
    const bounds = containerRef.current?.getBoundingClientRect();
    return {
      x: event.clientX - (bounds?.left ?? 0),
      y: event.clientY - (bounds?.top ?? 0),
    };
  }

  // Dragging the background pans, with a mouse or one finger.
  const panStart = useRef<Point | null>(null);
  const touches = useRef(new Map<number, Point>());
  const pinch = useRef<{ distance: number; middle: Point } | null>(null);

  function measurePinch() {
    const [a, b] = [...touches.current.values()];
    return {
      distance: Math.hypot(a.x - b.x, a.y - b.y) || 1,
      middle: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
    };
  }

  const handleWheel = useEffectEvent((event: WheelEvent) => {
    event.preventDefault();
    const lineHeight = event.deltaMode === 1 ? 16 : 1;
    if (event.ctrlKey || event.metaKey) {
      const factor = wheelZoomFactor(event.deltaY * lineHeight);
      move({ pointer: pointerIn(event), factor, pan: NO_PAN });
    } else {
      const pan = {
        x: event.deltaX * lineHeight,
        y: event.deltaY * lineHeight,
      };
      move({ pointer: NO_PAN, factor: 1, pan });
    }
  });

  const handleTouchDown = useEffectEvent((event: PointerEvent) => {
    if (event.pointerType !== "touch") return;
    touches.current.set(event.pointerId, pointerIn(event));
    if (touches.current.size === 2) {
      onPinchStart();
      panStart.current = null;
      pinch.current = measurePinch();
    }
  });

  const handleTouchMove = useEffectEvent((event: PointerEvent) => {
    if (!touches.current.has(event.pointerId)) return;
    touches.current.set(event.pointerId, pointerIn(event));
    const previous = pinch.current;
    if (!previous || touches.current.size !== 2) return;
    const current = measurePinch();
    move({
      pointer: previous.middle,
      factor: current.distance / previous.distance,
      pan: {
        x: previous.middle.x - current.middle.x,
        y: previous.middle.y - current.middle.y,
      },
    });
    pinch.current = current;
  });

  const handleTouchUp = useEffectEvent((event: PointerEvent) => {
    touches.current.delete(event.pointerId);
    if (touches.current.size < 2) pinch.current = null;
  });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const options = { capture: true };
    container.addEventListener("wheel", handleWheel, { passive: false });
    container.addEventListener("pointerdown", handleTouchDown, options);
    container.addEventListener("pointermove", handleTouchMove, options);
    container.addEventListener("pointerup", handleTouchUp, options);
    container.addEventListener("pointercancel", handleTouchUp, options);
    return () => {
      container.removeEventListener("wheel", handleWheel);
      container.removeEventListener("pointerdown", handleTouchDown, options);
      container.removeEventListener("pointermove", handleTouchMove, options);
      container.removeEventListener("pointerup", handleTouchUp, options);
      container.removeEventListener("pointercancel", handleTouchUp, options);
    };
  }, [containerRef]);

  return {
    size,
    scale,
    offset,
    zoom: (action: ZoomAction) =>
      setViewport((current) => zoomViewport(current, action, frame)),
    startPan(event: PointerEvent) {
      if (touches.current.size < 2) panStart.current = pointerIn(event);
    },
    panTo(event: PointerEvent) {
      const start = panStart.current;
      if (!start || pinch.current) return;
      const now = pointerIn(event);
      move({
        pointer: NO_PAN,
        factor: 1,
        pan: { x: start.x - now.x, y: start.y - now.y },
      });
      panStart.current = now;
    },
    endPan() {
      panStart.current = null;
    },
  };
}

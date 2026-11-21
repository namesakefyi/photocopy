import Konva from "konva";
import {
  memo,
  useEffect,
  useEffectEvent,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { DropZone } from "react-aria-components";
import {
  Circle,
  Group,
  Image as KonvaImage,
  Layer as KonvaLayer,
  Rect,
  Stage,
  Transformer,
} from "react-konva";
import { composeLayer, nextRevision, paintMask } from "../core/layers";
import { screenPixelRatio } from "../core/render";
import type { Layer, LayerChanges, Region, Tool } from "../core/types";
import {
  clampPoint,
  clampZoom,
  FIT_VIEWPORT,
  type Point,
  type Viewport,
  wheelZoomFactor,
  type ZoomAction,
  zoomAround,
  zoomStep,
} from "../core/zoom";
import { useEditor } from "../hooks/useEditor";

// Set before any stage is created; Konva reads it for each canvas it makes.
Konva.pixelRatio = screenPixelRatio();

const PADDING = 48;
const NUDGE = 10;
const BIG_NUDGE = 50;
const MASK_COLOR = "#ff2020";
/** The surround's color, covering anything hanging off the artboard (not saved). */
const OFF_CANVAS = "rgb(22 22 22 / 0.8)";

/** White under black, so the brush outline shows on any photo. */
function BrushOutline({
  x,
  y,
  radius,
}: {
  x: number;
  y: number;
  radius: number;
}) {
  return (
    <>
      <Circle
        x={x}
        y={y}
        radius={radius}
        stroke="#fff"
        strokeWidth={3}
        listening={false}
      />
      <Circle
        x={x}
        y={y}
        radius={radius}
        stroke="#000"
        strokeWidth={1}
        listening={false}
      />
    </>
  );
}

const IMAGE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/avif",
  "image/heic",
];

export interface CanvasProps {
  layers: Layer[];
  artboard: { width: number; height: number };
  selectedId: string | null;
  tool: Tool;
  brushSize: number;
  /** Shows the brush circle over the selected photo while its size changes. */
  isSizingBrush: boolean;
  /** Shows the selected photo uncropped, with what its mask hides in red. */
  isMaskMode: boolean;
  /** The photocopied region, shown over the photos. */
  preview: { image: ImageBitmap; region: Region } | null;
  canvasFill: string;
  /** For zooming from outside, like keyboard shortcuts. */
  ref?: React.Ref<CanvasHandle>;
}

export interface CanvasHandle {
  zoom: (action: ZoomAction) => void;
}

export const Canvas = memo(function Canvas({
  layers,
  artboard,
  selectedId,
  tool,
  brushSize,
  isSizingBrush,
  isMaskMode,
  preview,
  canvasFill,
  ref,
}: CanvasProps) {
  const { dispatch, addFiles, reportZoom } = useEditor();
  const select = (id: string | null) => dispatch({ type: "select", id });
  const updateLayer = (id: string, changes: LayerChanges) =>
    dispatch({ type: "updateLayer", id, changes });
  // The canvas owns its zoom and pan, so panning re-renders only the canvas.
  const [viewport, setViewport] = useState<Viewport>(FIT_VIEWPORT);
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const nodes = useRef(new Map<string, Konva.Group>());
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);
  const stroke = useRef<{ x: number; y: number } | null>(null);
  const frame = useRef(0);
  const [isInteracting, setIsInteracting] = useState(false);
  // Hidden after a drag until a preview of the new position arrives.
  const [stalePreview, setStalePreview] =
    useState<CanvasProps["preview"]>(null);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(([entry]) => {
      setSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      });
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const fitScale = Math.max(
    0.01,
    Math.min(
      (size.width - PADDING * 2) / artboard.width,
      (size.height - PADDING * 2) / artboard.height,
    ),
  );
  const artboardCenter = { x: artboard.width / 2, y: artboard.height / 2 };

  function resolve(view: Viewport) {
    return {
      scale: view.zoom ?? fitScale,
      center: view.zoom !== null && view.center ? view.center : artboardCenter,
    };
  }

  const { scale, center } = resolve(viewport);

  /** Zooms around the view's middle, from the latest viewport. */
  function zoom(action: ZoomAction) {
    if (action === "zoomFit") {
      setViewport(FIT_VIEWPORT);
      return;
    }
    setViewport((current) => {
      const view = resolve(current);
      return {
        zoom:
          action === "zoomActual"
            ? 1
            : action === "zoomDouble"
              ? 2
              : zoomStep(view.scale, action === "zoomIn" ? 1 : -1),
        center: view.center,
      };
    });
  }

  useImperativeHandle(ref, () => ({ zoom }));

  // A new canvas size starts over, fitted.
  // biome-ignore lint/correctness/useExhaustiveDependencies: the size is the trigger
  useEffect(() => setViewport(FIT_VIEWPORT), [artboard.width, artboard.height]);
  const offset = {
    x: size.width / 2 - center.x * scale,
    y: size.height / 2 - center.y * scale,
  };

  // Panning keeps the view's middle over the artboard.
  // biome-ignore lint/correctness/useExhaustiveDependencies: the artboard's size is the dependency, not its object identity
  const panBounds = useMemo(
    () => ({ x: 0, y: 0, ...artboard }),
    [artboard.width, artboard.height],
  );

  /** Zooms around `pointer`, then pans; applied to the latest viewport so quick events add up. */
  function moveView(pointer: Point, factor: number, pan: Point) {
    queueView((current) => {
      const view = resolve(current);
      const next = clampZoom(view.scale * factor, view.scale);
      const fromMiddle = {
        x: pointer.x - size.width / 2,
        y: pointer.y - size.height / 2,
      };
      const zoomed = zoomAround(view.center, fromMiddle, view.scale, next);
      return {
        zoom: next,
        center: clampPoint(
          { x: zoomed.x + pan.x / next, y: zoomed.y + pan.y / next },
          panBounds,
        ),
      };
    });
  }

  // Wheel, pinch and pan moves are batched to render once per frame.
  const queuedMoves = useRef<((view: Viewport) => Viewport)[]>([]);
  const viewFrame = useRef(0);

  function queueView(move: (view: Viewport) => Viewport) {
    queuedMoves.current.push(move);
    if (viewFrame.current) return;
    viewFrame.current = requestAnimationFrame(() => {
      viewFrame.current = 0;
      const moves = queuedMoves.current;
      queuedMoves.current = [];
      setViewport((current) =>
        moves.reduce((view, apply) => apply(view), current),
      );
    });
  }

  useEffect(() => () => cancelAnimationFrame(viewFrame.current), []);

  function pointerIn(event: { clientX: number; clientY: number }): Point {
    const bounds = containerRef.current?.getBoundingClientRect();
    return {
      x: event.clientX - (bounds?.left ?? 0),
      y: event.clientY - (bounds?.top ?? 0),
    };
  }

  // Scrolling pans; pinching or ctrl-scrolling zooms around the pointer.
  const handleWheel = useEffectEvent((event: WheelEvent) => {
    event.preventDefault();
    const lineHeight = event.deltaMode === 1 ? 16 : 1;
    if (event.ctrlKey || event.metaKey) {
      moveView(pointerIn(event), wheelZoomFactor(event.deltaY * lineHeight), {
        x: 0,
        y: 0,
      });
    } else {
      moveView({ x: 0, y: 0 }, 1, {
        x: event.deltaX * lineHeight,
        y: event.deltaY * lineHeight,
      });
    }
  });

  // Dragging the background (not a photo) pans, with a mouse or one finger.
  const panStart = useRef<Point | null>(null);
  // Two fingers pinch to zoom and drag to pan, wherever they land.
  const touches = useRef(new Map<number, Point>());
  const pinch = useRef<{ distance: number; middle: Point } | null>(null);

  function measurePinch() {
    const [a, b] = [...touches.current.values()];
    return {
      distance: Math.hypot(a.x - b.x, a.y - b.y) || 1,
      middle: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
    };
  }

  const handleTouchDown = useEffectEvent((event: PointerEvent) => {
    if (event.pointerType !== "touch") return;
    touches.current.set(event.pointerId, pointerIn(event));
    if (touches.current.size === 2) {
      // The second finger turns any drag of a photo or the view into a pinch.
      for (const node of nodes.current.values()) {
        if (node.isDragging()) node.stopDrag();
      }
      transformerRef.current?.stopTransform();
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
    moveView(previous.middle, current.distance / previous.distance, {
      x: previous.middle.x - current.middle.x,
      y: previous.middle.y - current.middle.y,
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
  }, []);

  useEffect(() => reportZoom(scale), [scale, reportZoom]);

  // Mask edits redraw the same canvas object, which Konva can't see.
  useEffect(() => {
    if (layers) stageRef.current?.batchDraw();
  }, [layers]);

  const selected = layers.find((layer) => layer.id === selectedId) ?? null;
  const brushing = tool !== "move" && selected !== null;
  const showPreview =
    preview !== null &&
    !brushing &&
    !isMaskMode &&
    !isInteracting &&
    preview !== stalePreview;

  // Quick-mask style: red wherever the selected photo's mask hides it.
  const maskOverlay = useMemo(() => document.createElement("canvas"), []);

  function drawMaskOverlay(layer: Layer) {
    if (maskOverlay.width !== layer.width) maskOverlay.width = layer.width;
    if (maskOverlay.height !== layer.height) maskOverlay.height = layer.height;
    const ctx = maskOverlay.getContext("2d");
    if (!ctx) return;
    ctx.globalCompositeOperation = "copy";
    ctx.fillStyle = MASK_COLOR;
    ctx.fillRect(0, 0, layer.width, layer.height);
    ctx.globalCompositeOperation = "destination-out";
    ctx.drawImage(layer.mask, 0, 0);
    ctx.globalCompositeOperation = "source-over";
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: redraw when the mask's revision changes
  useEffect(() => {
    if (!isMaskMode || !selected) return;
    drawMaskOverlay(selected);
    stageRef.current?.batchDraw();
  }, [isMaskMode, selected?.id, selected?.revision]);

  function startInteracting() {
    setIsInteracting(true);
  }

  function stopInteracting() {
    setIsInteracting(false);
    setStalePreview(preview);
  }

  // Re-attach after every layer change: Konva nodes are recreated on reorder.
  // biome-ignore lint/correctness/useExhaustiveDependencies: layers is the trigger, not a value read here
  useEffect(() => {
    const transformer = transformerRef.current;
    if (!transformer) return;
    const node = selectedId ? nodes.current.get(selectedId) : undefined;
    transformer.nodes(node && !brushing ? [node] : []);
    transformer.getLayer()?.batchDraw();
  }, [selectedId, brushing, layers]);

  const sizingNode =
    isSizingBrush && selectedId ? nodes.current.get(selectedId) : undefined;
  const sizingBox = sizingNode?.getClientRect();
  const sizingCenter = sizingBox && {
    x: sizingBox.x + sizingBox.width / 2,
    y: sizingBox.y + sizingBox.height / 2,
  };

  function toLayerSpace(layer: Layer) {
    const node = nodes.current.get(layer.id);
    const pointer = stageRef.current?.getPointerPosition();
    if (!node || !pointer) return null;
    return node.getAbsoluteTransform().copy().invert().point(pointer);
  }

  function paintTo(layer: Layer) {
    const point = toLayerSpace(layer);
    if (!point || !stroke.current || tool === "move") return;
    paintMask(
      layer,
      stroke.current,
      point,
      brushSize / (scale * layer.scale),
      tool,
    );
    stroke.current = point;
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      composeLayer(layer);
      if (isMaskMode) drawMaskOverlay(layer);
      nodes.current.get(layer.id)?.getLayer()?.batchDraw();
    });
  }

  function handlePointerDown(event: Konva.KonvaEventObject<PointerEvent>) {
    containerRef.current?.focus({ preventScroll: true });
    if (brushing && selected) {
      stroke.current = toLayerSpace(selected);
      paintTo(selected);
      return;
    }
    if (
      event.target === event.target.getStage() ||
      event.target.name() === "artboard"
    ) {
      select(null);
      if (touches.current.size < 2) panStart.current = pointerIn(event.evt);
    }
  }

  function handlePointerMove(event: Konva.KonvaEventObject<PointerEvent>) {
    const pointer = stageRef.current?.getPointerPosition();
    setCursor(brushing && pointer ? pointer : null);
    if (brushing && selected && stroke.current) paintTo(selected);
    const start = panStart.current;
    if (start && !pinch.current) {
      const now = pointerIn(event.evt);
      moveView({ x: 0, y: 0 }, 1, { x: start.x - now.x, y: start.y - now.y });
      panStart.current = now;
    }
  }

  function handlePointerUp() {
    panStart.current = null;
    if (stroke.current && selected) {
      stroke.current = null;
      updateLayer(selected.id, { revision: nextRevision() });
    }
  }

  function handleKeyDown(event: React.KeyboardEvent) {
    if (!selected) return;
    const step = event.shiftKey ? BIG_NUDGE : NUDGE;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    if (event.key in moves) {
      const [dx, dy] = moves[event.key];
      updateLayer(selected.id, { x: selected.x + dx, y: selected.y + dy });
    } else {
      return;
    }
    event.preventDefault();
  }

  const far = 100000;

  return (
    <DropZone
      className="canvas"
      aria-label="Canvas: drop photos here"
      getDropOperation={(types) =>
        IMAGE_TYPES.some((type) => types.has(type)) ? "copy" : "cancel"
      }
      onDrop={async (event) => {
        const files = await Promise.all(
          event.items
            .filter((item) => item.kind === "file")
            .filter((item) => item.type.startsWith("image/"))
            .map((item) => item.getFile()),
        );
        addFiles(files);
      }}
    >
      <div
        ref={containerRef}
        className="stage"
        // biome-ignore lint/a11y/noNoninteractiveTabindex: focus target for nudging the selected photo with arrow keys
        tabIndex={0}
        role="application"
        aria-label="Arrange photos. Arrow keys move the selected photo, Delete removes it."
        onKeyDown={handleKeyDown}
        data-brushing={brushing || undefined}
      >
        <Stage
          ref={stageRef}
          width={size.width}
          height={size.height}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={() => {
            setCursor(null);
            handlePointerUp();
          }}
        >
          <KonvaLayer x={offset.x} y={offset.y} scaleX={scale} scaleY={scale}>
            <Rect name="artboard" {...artboard} fill={canvasFill} />
            {layers.map((layer) => {
              const showMask = isMaskMode && layer.id === selectedId;
              return (
                <Group
                  key={layer.id}
                  ref={(node) => {
                    if (node) nodes.current.set(layer.id, node);
                    else nodes.current.delete(layer.id);
                  }}
                  x={layer.x}
                  y={layer.y}
                  offsetX={layer.width / 2}
                  offsetY={layer.height / 2}
                  rotation={layer.rotation}
                  scaleX={layer.scale * (layer.flipX ? -1 : 1)}
                  scaleY={layer.scale * (layer.flipY ? -1 : 1)}
                  visible={layer.visible}
                  opacity={showPreview ? 0 : 1}
                  draggable={!brushing}
                  onDragStart={startInteracting}
                  onTransformStart={startInteracting}
                  onPointerDown={() => {
                    if (!brushing) select(layer.id);
                  }}
                  onDragEnd={(event) => {
                    stopInteracting();
                    updateLayer(layer.id, {
                      x: event.target.x(),
                      y: event.target.y(),
                    });
                  }}
                  onTransformEnd={(event) => {
                    stopInteracting();
                    const node = event.target;
                    updateLayer(layer.id, {
                      x: node.x(),
                      y: node.y(),
                      rotation: node.rotation(),
                      scale: Math.abs(node.scaleY()),
                      flipX: node.scaleX() < 0,
                      flipY: node.scaleY() < 0,
                    });
                  }}
                >
                  <KonvaImage
                    image={showMask ? layer.source : layer.composed}
                    width={layer.width}
                    height={layer.height}
                  />
                  {showMask && (
                    <KonvaImage
                      image={maskOverlay}
                      width={layer.width}
                      height={layer.height}
                      opacity={0.5}
                      listening={false}
                    />
                  )}
                </Group>
              );
            })}
            {showPreview && (
              <KonvaImage
                image={preview.image}
                {...preview.region}
                globalCompositeOperation="multiply"
                listening={false}
              />
            )}
            <Rect
              x={-far}
              y={-far}
              width={far * 2 + artboard.width}
              height={far}
              fill={OFF_CANVAS}
              listening={false}
            />
            <Rect
              x={-far}
              y={artboard.height}
              width={far * 2 + artboard.width}
              height={far}
              fill={OFF_CANVAS}
              listening={false}
            />
            <Rect
              x={-far}
              y={0}
              width={far}
              height={artboard.height}
              fill={OFF_CANVAS}
              listening={false}
            />
            <Rect
              x={artboard.width}
              y={0}
              width={far}
              height={artboard.height}
              fill={OFF_CANVAS}
              listening={false}
            />
            <Rect
              width={artboard.width}
              height={artboard.height}
              stroke="#555"
              strokeWidth={1}
              strokeScaleEnabled={false}
              listening={false}
            />
          </KonvaLayer>
          <KonvaLayer>
            <Transformer
              ref={transformerRef}
              keepRatio
              flipEnabled={false}
              enabledAnchors={[
                "top-left",
                "top-right",
                "bottom-left",
                "bottom-right",
              ]}
              rotationSnaps={[0, 90, 180, 270]}
              anchorSize={9}
              anchorCornerRadius={0}
              anchorStroke="#888"
              anchorFill="#fff"
              borderStroke="#888"
              borderDash={[4, 4]}
              rotateAnchorOffset={24}
              boundBoxFunc={(oldBox, newBox) =>
                Math.abs(newBox.width) < 12 || Math.abs(newBox.height) < 12
                  ? oldBox
                  : newBox
              }
            />
            {isSizingBrush && sizingCenter && (
              <BrushOutline {...sizingCenter} radius={brushSize / 2} />
            )}
            {cursor && <BrushOutline {...cursor} radius={brushSize / 2} />}
          </KonvaLayer>
        </Stage>
      </div>
    </DropZone>
  );
});

import Konva from "konva";
import {
  memo,
  useEffect,
  useImperativeHandle,
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
import type { ZoomAction } from "../core/zoom";
import { useEditor } from "../hooks/useEditor";
import { useViewport } from "../hooks/useViewport";
import { ADD_IMAGE_ITEMS } from "./addImageItems";
import styles from "./Canvas.module.css";
import { Button } from "./ui/Button";

// Set before any stage is created; Konva reads it for each canvas it makes.
Konva.pixelRatio = screenPixelRatio();

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
  return (["#fff", "#000"] as const).map((stroke, index) => (
    <Circle
      key={stroke}
      x={x}
      y={y}
      radius={radius}
      stroke={stroke}
      strokeWidth={index === 0 ? 3 : 1}
      listening={false}
    />
  ));
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
  preview: { image: ImageBitmap; region: Region } | null;
  canvasFill: string;
  /** Loaded with no layers: offers ways to add a photo, over the artboard. */
  isEmpty: boolean;
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
  isEmpty,
  ref,
}: CanvasProps) {
  const editor = useEditor();
  const { dispatch, addFiles, reportZoom } = editor;
  const select = (id: string | null) => dispatch({ type: "select", id });
  const updateLayer = (id: string, changes: LayerChanges) =>
    dispatch({ type: "updateLayer", id, changes });
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const nodes = useRef(new Map<string, Konva.Group>());
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);
  const stroke = useRef<{ x: number; y: number } | null>(null);
  const frame = useRef(0);
  const [isInteracting, setIsInteracting] = useState(false);
  // Hidden after a drag until a preview of the new position arrives.
  const [stalePreview, setStalePreview] =
    useState<CanvasProps["preview"]>(null);
  // The canvas owns its zoom and pan, so panning re-renders only the canvas.
  const view = useViewport(containerRef, artboard, () => {
    for (const node of nodes.current.values()) {
      if (node.isDragging()) node.stopDrag();
    }
    transformerRef.current?.stopTransform();
  });
  const { size, scale, offset } = view;
  useImperativeHandle(ref, () => ({ zoom: view.zoom }));

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
      view.startPan(event.evt);
    }
  }

  function handlePointerMove(event: Konva.KonvaEventObject<PointerEvent>) {
    const pointer = stageRef.current?.getPointerPosition();
    setCursor(brushing && pointer ? pointer : null);
    if (brushing && selected && stroke.current) paintTo(selected);
    view.panTo(event.evt);
  }

  function handlePointerUp() {
    view.endPan();
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
    if (!(event.key in moves)) return;
    const [dx, dy] = moves[event.key];
    updateLayer(selected.id, { x: selected.x + dx, y: selected.y + dy });
    event.preventDefault();
  }

  const far = 100000;

  return (
    <DropZone
      className={styles.canvas}
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
        className={styles.stage}
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
                  onDragStart={() => setIsInteracting(true)}
                  onTransformStart={() => setIsInteracting(true)}
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
            {[
              [-far, -far, far * 2 + artboard.width, far],
              [-far, artboard.height, far * 2 + artboard.width, far],
              [-far, 0, far, artboard.height],
              [artboard.width, 0, far, artboard.height],
            ].map(([x, y, width, height]) => (
              <Rect
                key={`${x},${y}`}
                x={x}
                y={y}
                width={width}
                height={height}
                fill={OFF_CANVAS}
                listening={false}
              />
            ))}
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
      {isEmpty && (
        <div
          className={styles.empty}
          style={{
            left: offset.x,
            top: offset.y,
            width: artboard.width * scale,
            height: artboard.height * scale,
          }}
        >
          {ADD_IMAGE_ITEMS.map((item) => (
            <Button
              key={item.id}
              variant="overlay"
              onPress={() => item.run(editor)}
            >
              {item.label}
            </Button>
          ))}
        </div>
      )}
    </DropZone>
  );
});

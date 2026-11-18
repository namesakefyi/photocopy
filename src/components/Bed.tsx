import type Konva from "konva";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  DropZone,
  MenuTrigger,
  Popover,
  Pressable,
} from "react-aria-components";
import {
  Circle,
  Group,
  Image as KonvaImage,
  Layer as KonvaLayer,
  Rect,
  Stage,
  Transformer,
} from "react-konva";
import { composeLayer, paintMask } from "../layers";
import type { Layer, LayerChanges, Region, Tool } from "../types";
import { Button } from "./ui/Button";

const PADDING = 48;
const NUDGE = 10;
const BIG_NUDGE = 50;
const CHECKER_SIZE = 8;
const MASK_COLOR = "#ff2020";
/** The bed's color, covering anything hanging off the canvas (not saved). */
const OFF_CANVAS = "rgb(22 22 22 / 0.8)";

/** The light grid that stands in for transparency, like in image editors. */
function createChecker() {
  const canvas = document.createElement("canvas");
  canvas.width = CHECKER_SIZE * 2;
  canvas.height = CHECKER_SIZE * 2;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#e8e8e8";
    ctx.fillRect(0, 0, CHECKER_SIZE, CHECKER_SIZE);
    ctx.fillRect(CHECKER_SIZE, CHECKER_SIZE, CHECKER_SIZE, CHECKER_SIZE);
  }
  return canvas;
}

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

export interface BedProps {
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
  preview: { canvas: HTMLCanvasElement; region: Region } | null;
  /** No canvas edges: the whole bed is the canvas. */
  isTrimmed: boolean;
  /** Saved background color, or null for transparent. */
  canvasFill: string | null;
  onSelect: (id: string | null) => void;
  onTool: (tool: Tool) => void;
  onChange: (id: string, changes: LayerChanges) => void;
  onDelete: (id: string) => void;
  onFiles: (files: File[]) => void;
  /** Opens the file picker, from the empty canvas. */
  onUpload: () => void;
  onSearch: () => void;
  /** The Layer menu, opened by right-clicking a photo. */
  layerMenu: React.ReactNode;
  /** Reports the zoom and the part of the artboard the bed shows. */
  onView: (view: { scale: number; region: Region }) => void;
}

export function Bed({
  layers,
  artboard,
  selectedId,
  tool,
  brushSize,
  isSizingBrush,
  isMaskMode,
  preview,
  isTrimmed,
  canvasFill,
  onSelect,
  onTool,
  onChange,
  onDelete,
  onFiles,
  onUpload,
  onSearch,
  layerMenu,
  onView,
}: BedProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const nodes = useRef(new Map<string, Konva.Group>());
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);
  const stroke = useRef<{ x: number; y: number } | null>(null);
  const frame = useRef(0);
  const checker = useMemo(createChecker, []);
  const [isInteracting, setIsInteracting] = useState(false);
  // The preview from before a drag still shows the old position, so it stays
  // hidden until a fresh one arrives.
  const [stalePreview, setStalePreview] = useState<BedProps["preview"]>(null);

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

  const scale = Math.max(
    0.01,
    Math.min(
      (size.width - PADDING * 2) / artboard.width,
      (size.height - PADDING * 2) / artboard.height,
    ),
  );
  const offset = {
    x: (size.width - artboard.width * scale) / 2,
    y: (size.height - artboard.height * scale) / 2,
  };

  const visible: Region = {
    x: -offset.x / scale,
    y: -offset.y / scale,
    width: size.width / scale,
    height: size.height / scale,
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: the numbers are the dependencies, not the object
  useEffect(
    () => onView({ scale, region: visible }),
    [scale, visible.x, visible.y, visible.width, visible.height, onView],
  );

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
      onSelect(null);
    }
  }

  function handlePointerMove() {
    const pointer = stageRef.current?.getPointerPosition();
    setCursor(brushing && pointer ? pointer : null);
    if (brushing && selected && stroke.current) paintTo(selected);
  }

  function handlePointerUp() {
    if (stroke.current && selected) {
      stroke.current = null;
      onChange(selected.id, { revision: selected.revision + 1 });
    }
  }

  /**
   * Lets the context menu open only over a photo, selecting it first. From the
   * keyboard (no pointer position), it opens for the selected photo.
   */
  function guardContextMenu(event: React.MouseEvent) {
    const stage = stageRef.current;
    let id: string | undefined;
    if (stage && !brushing) {
      const isKeyboard = event.detail === 0 && event.clientX === 0;
      if (isKeyboard) {
        id = selectedId ?? undefined;
      } else {
        stage.setPointersPositions(event.nativeEvent);
        const pointer = stage.getPointerPosition();
        const shape = pointer && stage.getIntersection(pointer);
        if (shape) {
          id = [...nodes.current].find(([, group]) =>
            group.isAncestorOf(shape),
          )?.[0];
        }
      }
    }
    if (id) {
      if (id !== selectedId) onSelect(id);
    } else {
      event.preventDefault();
      event.stopPropagation();
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
      onChange(selected.id, { x: selected.x + dx, y: selected.y + dy });
    } else if (event.key === "Delete" || event.key === "Backspace") {
      onDelete(selected.id);
    } else if (event.key === "Escape") {
      if (brushing) onTool("move");
      else onSelect(null);
    } else {
      return;
    }
    event.preventDefault();
  }

  const far = 100000;

  return (
    <DropZone
      className="bed"
      aria-label="Bed: drop photos here"
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
        onFiles(files);
      }}
    >
      {/* Right-clicking a photo selects it and opens the Layer menu there. */}
      <div className="context-guard" onContextMenuCapture={guardContextMenu}>
        <MenuTrigger trigger="contextMenu">
          <Pressable>
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
                <KonvaLayer
                  x={offset.x}
                  y={offset.y}
                  scaleX={scale}
                  scaleY={scale}
                >
                  {/* With no layers yet, the bare dark bed is the zero state. */}
                  {layers.length > 0 && (
                    <Rect
                      name="artboard"
                      {...(isTrimmed ? visible : artboard)}
                      {...(canvasFill
                        ? { fill: canvasFill }
                        : {
                            fillPatternImage:
                              checker as unknown as HTMLImageElement,
                            fillPatternScale: { x: 1 / scale, y: 1 / scale },
                          })}
                    />
                  )}
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
                          if (!brushing) onSelect(layer.id);
                        }}
                        onDragEnd={(event) => {
                          stopInteracting();
                          onChange(layer.id, {
                            x: event.target.x(),
                            y: event.target.y(),
                          });
                        }}
                        onTransformEnd={(event) => {
                          stopInteracting();
                          const node = event.target;
                          onChange(layer.id, {
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
                      image={preview.canvas}
                      {...preview.region}
                      globalCompositeOperation={
                        canvasFill ? "multiply" : "source-over"
                      }
                      listening={false}
                    />
                  )}
                  {!isTrimmed && layers.length > 0 && (
                    <>
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
                    </>
                  )}
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
                      Math.abs(newBox.width) < 12 ||
                      Math.abs(newBox.height) < 12
                        ? oldBox
                        : newBox
                    }
                  />
                  {isSizingBrush && sizingCenter && (
                    <BrushOutline {...sizingCenter} radius={brushSize / 2} />
                  )}
                  {cursor && (
                    <BrushOutline {...cursor} radius={brushSize / 2} />
                  )}
                </KonvaLayer>
              </Stage>
            </div>
          </Pressable>
          <Popover className="menu-popover" placement="bottom start">
            {layerMenu}
          </Popover>
        </MenuTrigger>
      </div>
      {layers.length === 0 && (
        <div className="empty">
          <p>Drop photos here</p>
          <div className="empty-actions">
            <Button onPress={onUpload}>Upload image</Button>
            <Button onPress={onSearch}>Search Wikimedia Commons</Button>
          </div>
        </div>
      )}
    </DropZone>
  );
}

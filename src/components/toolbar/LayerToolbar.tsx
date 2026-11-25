import { memo, useRef, useState } from "react";
import {
  Dialog,
  DialogTrigger,
  Group,
  Separator,
  Toolbar,
} from "react-aria-components";
import { createPortal } from "react-dom";
import { MAX_BRUSH, MIN_BRUSH } from "../../core/editor";
import { SHORTCUTS } from "../../core/shortcuts";
import { useEditor } from "../../hooks/editor/useEditor";
import { useEventListener } from "../../hooks/useEventListener";
import { Button, Chevron } from "../ui/Button";
import {
  BringForwardIcon,
  EraserIcon,
  FlipHorizontalIcon,
  FlipVerticalIcon,
  SendBackIcon,
  TrashIcon,
} from "../ui/icons";
import { Popover } from "../ui/Popover";
import { Slider } from "../ui/Slider";
import { ToolButton, ToolToggleButton } from "../ui/ToolButton";
import styles from "./LayerToolbar.module.css";

/** Lets a mouse wheel scroll the toolbar sideways when it overflows. */
function scrollSideways(event: React.WheelEvent<HTMLElement>) {
  if (Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return;
  event.currentTarget.scrollLeft += event.deltaY;
}

/** The selected layer's actions. */
export const LayerToolbar = memo(function LayerToolbar() {
  const editor = useEditor();
  const {
    dispatch,
    selectedId,
    tool,
    brushSize,
    canEditMask,
    canRemoveBackground,
    canCrop,
    canBringForward,
    canSendBack,
  } = editor;
  if (selectedId === null) return null;
  const isRefining = tool !== "move";

  return (
    <div className={styles.scroll} onWheel={scrollSideways}>
      <Toolbar aria-label="Layer" className={styles.actions}>
        <Group className={styles.group} aria-label="Cut out">
          <Button
            variant="toolbar"
            isDisabled={!canRemoveBackground}
            onPress={() => editor.removeBackground(selectedId)}
          >
            Remove Background
          </Button>
          <Button
            variant="toolbar"
            isDisabled={!canCrop}
            onPress={() => editor.cropToVisible(selectedId)}
          >
            Shrink to Fit
          </Button>
        </Group>
        <Separator className={styles.separator} orientation="vertical" />
        <Group className={styles.group} aria-label="Mask">
          <ToolToggleButton
            label="Mask"
            shortcut={SHORTCUTS.erase}
            hasText
            isDisabled={!canEditMask}
            isSelected={isRefining}
            onChange={(isRefining) =>
              dispatch({
                type: "setTool",
                tool: isRefining ? "erase" : "move",
              })
            }
          >
            Mask
          </ToolToggleButton>
          {isRefining && (
            <>
              <ToolToggleButton
                label="Erase"
                shortcut={SHORTCUTS.restore}
                isSelected={tool === "restore"}
                onChange={(isErasing) =>
                  dispatch({
                    type: "setTool",
                    tool: isErasing ? "restore" : "erase",
                  })
                }
              >
                <EraserIcon />
              </ToolToggleButton>
              <BrushSizeMenu
                size={brushSize}
                onChange={(size) => dispatch({ type: "setBrushSize", size })}
                onShowOnCanvas={editor.showBrushSize}
              />
            </>
          )}
        </Group>
        <Separator className={styles.separator} orientation="vertical" />
        <Group className={styles.group} aria-label="Flip">
          <ToolButton
            label="Flip Horizontal"
            onPress={() => dispatch({ type: "flipSelected", axis: "flipX" })}
          >
            <FlipHorizontalIcon />
          </ToolButton>
          <ToolButton
            label="Flip Vertical"
            onPress={() => dispatch({ type: "flipSelected", axis: "flipY" })}
          >
            <FlipVerticalIcon />
          </ToolButton>
        </Group>
        <Separator className={styles.separator} orientation="vertical" />
        <Group className={styles.group} aria-label="Order">
          <ToolButton
            label="Send Back"
            shortcut={SHORTCUTS.back}
            isDisabled={!canSendBack}
            onPress={() => dispatch({ type: "moveSelected", direction: -1 })}
          >
            <SendBackIcon />
          </ToolButton>
          <ToolButton
            label="Bring Forward"
            shortcut={SHORTCUTS.forward}
            isDisabled={!canBringForward}
            onPress={() => dispatch({ type: "moveSelected", direction: 1 })}
          >
            <BringForwardIcon />
          </ToolButton>
        </Group>
        <Separator className={styles.separator} orientation="vertical" />
        <ToolButton
          label="Delete Layer"
          shortcut={SHORTCUTS.delete}
          onPress={() => dispatch({ type: "deleteSelected" })}
        >
          <TrashIcon />
        </ToolButton>
      </Toolbar>
    </div>
  );
});

interface BrushSizeMenuProps {
  /** The brush's diameter in screen pixels. */
  size: number;
  onChange: (size: number) => void;
  /** For keyboard changes, which have no pointer to show the size around. */
  onShowOnCanvas: () => void;
}

/** While dragging the slider, the brush outline follows the pointer at real size. */
function BrushSizeMenu({ size, onChange, onShowOnCanvas }: BrushSizeMenuProps) {
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null);
  // Set as the press starts, before the slider's first change arrives.
  const isPressed = useRef(false);
  const end = () => {
    if (!pointer) return;
    isPressed.current = false;
    setPointer(null);
  };
  useEventListener(window, "pointermove", (event) => {
    if (pointer) setPointer({ x: event.clientX, y: event.clientY });
  });
  useEventListener(window, "pointerup", end);
  useEventListener(window, "pointercancel", end);

  return (
    <DialogTrigger>
      <Button
        variant="toolbar"
        className={styles.brushTrigger}
        aria-label="Brush size"
      >
        {size} px
        <Chevron />
      </Button>
      <Popover className={styles.brushPopover} placement="bottom">
        <Dialog
          aria-label="Brush size"
          className={styles.brushDialog}
          onPointerDownCapture={(event) => {
            isPressed.current = true;
            setPointer({ x: event.clientX, y: event.clientY });
          }}
        >
          <Slider
            label="Brush size"
            minValue={MIN_BRUSH}
            maxValue={MAX_BRUSH}
            value={size}
            onChange={(next) => {
              onChange(next);
              if (!isPressed.current) onShowOnCanvas();
            }}
          />
        </Dialog>
      </Popover>
      {pointer &&
        createPortal(
          <div
            className={styles.brushPreview}
            aria-hidden="true"
            style={{
              left: pointer.x,
              top: pointer.y,
              width: size,
              height: size,
            }}
          />,
          document.body,
        )}
    </DialogTrigger>
  );
}

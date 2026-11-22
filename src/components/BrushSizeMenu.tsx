import { useRef, useState } from "react";
import { Dialog, DialogTrigger } from "react-aria-components";
import { createPortal } from "react-dom";
import { MAX_BRUSH, MIN_BRUSH } from "../core/editor";
import { useEventListener } from "../hooks/useEventListener";
import styles from "./BrushSizeMenu.module.css";
import { Button, Chevron } from "./ui/Button";
import { Popover } from "./ui/Popover";
import { Slider } from "./ui/Slider";

export interface BrushSizeMenuProps {
  /** The brush's diameter in screen pixels. */
  size: number;
  onChange: (size: number) => void;
  /** For keyboard changes, which have no pointer to show the size around. */
  onShowOnCanvas: () => void;
}

/** While dragging the slider, the brush outline follows the pointer at real size. */
export function BrushSizeMenu({
  size,
  onChange,
  onShowOnCanvas,
}: BrushSizeMenuProps) {
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
        className={styles.trigger}
        aria-label="Brush size"
      >
        {size} px
        <Chevron />
      </Button>
      <Popover className={styles.popover} placement="bottom">
        <Dialog
          aria-label="Brush size"
          className={styles.dialog}
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
            className={styles.preview}
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

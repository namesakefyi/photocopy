import { useEffect, useRef, useState } from "react";
import { Button, Dialog, DialogTrigger, Popover } from "react-aria-components";
import { createPortal } from "react-dom";
import { Slider } from "./ui/Slider";

export const MIN_BRUSH = 4;
export const MAX_BRUSH = 300;

export interface BrushSizeMenuProps {
  /** The brush's diameter in screen pixels. */
  size: number;
  onChange: (size: number) => void;
  /**
   * Called when the size changes without a pointer to show it around (from
   * the keyboard), so the canvas can show it instead.
   */
  onShowOnCanvas: () => void;
}

/**
 * The brush size, opening a slider to change it. While the slider is
 * dragged, the brush's outline follows the pointer at its real size.
 */
export function BrushSizeMenu({
  size,
  onChange,
  onShowOnCanvas,
}: BrushSizeMenuProps) {
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null);
  // Set as the press starts, before the slider's first change arrives.
  const isPressed = useRef(false);
  const isDragging = pointer !== null;

  // Follows the pointer from press to release, wherever it goes.
  useEffect(() => {
    if (!isDragging) return;
    const move = (event: PointerEvent) =>
      setPointer({ x: event.clientX, y: event.clientY });
    const end = () => {
      isPressed.current = false;
      setPointer(null);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
    };
  }, [isDragging]);

  return (
    <DialogTrigger>
      <Button className="toolbar-button brush-size" aria-label="Brush size">
        {size} px
        <span className="chevron" aria-hidden="true">
          ▾
        </span>
      </Button>
      <Popover className="menu-popover slider-popover" placement="bottom">
        <Dialog
          aria-label="Brush size"
          className="slider-popover-dialog"
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
            className="brush-preview"
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

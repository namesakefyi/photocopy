import { memo } from "react";
import {
  CANVAS_PRESETS,
  canvasSize,
  MAX_CANVAS_SIZE,
  MIN_CANVAS_SIZE,
} from "../core/canvasFormat";
import { THEMES, type Theme } from "../core/themes";
import type { CanvasFormat, CanvasPreset } from "../core/types";
import { useEditor } from "../hooks/useEditor";
import { CanvasShape } from "./CanvasShape";
import { NumberField } from "./ui/NumberField";
import { Select } from "./ui/Select";

export interface CanvasPresetPickerProps {
  canvasFormat: CanvasFormat;
}

export const CanvasPresetPicker = memo(function CanvasPresetPicker({
  canvasFormat,
}: CanvasPresetPickerProps) {
  const { dispatch } = useEditor();
  const options = [
    ...CANVAS_PRESETS.map((preset) => ({
      id: preset.id,
      label: `${preset.name} (${preset.ratio})`,
      shape: (
        <CanvasShape width={preset.width} height={preset.height} size={14} />
      ),
    })),
    {
      id: "custom" as const,
      label: "Custom",
      shape: (
        <CanvasShape
          width={canvasFormat.customWidth}
          height={canvasFormat.customHeight}
          size={14}
        />
      ),
    },
  ];

  return (
    <Select
      variant="compact"
      label="Canvas preset"
      items={options}
      selectedKey={canvasFormat.preset}
      onSelectionChange={(preset) =>
        dispatch({
          type: "changeCanvas",
          changes: { preset: preset as CanvasPreset },
        })
      }
      textOf={(option) => option.label}
      iconOf={(option) => option.shape}
    />
  );
});

export interface CanvasPanelProps {
  canvasFormat: CanvasFormat;
  background: Theme;
}

export const CanvasPanel = memo(function CanvasPanel({
  canvasFormat,
  background,
}: CanvasPanelProps) {
  const { dispatch } = useEditor();
  const size = canvasSize(canvasFormat);

  /** Editing a preset's dimensions turns it into a custom size. */
  function changeSize(changes: { width?: number; height?: number }) {
    const width = changes.width ?? size.width;
    const height = changes.height ?? size.height;
    if (Number.isNaN(width) || Number.isNaN(height)) return;
    dispatch({
      type: "changeCanvas",
      changes: { preset: "custom", customWidth: width, customHeight: height },
    });
  }

  return (
    <>
      <fieldset className="field">
        <legend className="field-label">Size</legend>
        <div className="canvas-size">
          <NumberField
            aria-label="Width (px)"
            prefix="W"
            minValue={MIN_CANVAS_SIZE}
            maxValue={MAX_CANVAS_SIZE}
            formatOptions={{ useGrouping: false }}
            value={size.width}
            onChange={(width) => changeSize({ width })}
          />
          <span className="canvas-size-times" aria-hidden="true">
            ×
          </span>
          <NumberField
            aria-label="Height (px)"
            prefix="H"
            minValue={MIN_CANVAS_SIZE}
            maxValue={MAX_CANVAS_SIZE}
            formatOptions={{ useGrouping: false }}
            value={size.height}
            onChange={(height) => changeSize({ height })}
          />
        </div>
      </fieldset>
      <Select
        variant="field"
        label="Background"
        items={THEMES}
        selectedKey={background.id}
        onSelectionChange={(id) => {
          const theme = THEMES.find((option) => option.id === id);
          if (theme) dispatch({ type: "setBackground", background: theme });
        }}
        textOf={(option) => option.name}
        iconOf={(option) => (
          <span
            className="menu-swatch"
            style={{ background: option.color }}
            aria-hidden="true"
          />
        )}
      />
    </>
  );
});

import {
  CANVAS_PRESETS,
  canvasSize,
  MAX_CANVAS_SIZE,
  MIN_CANVAS_SIZE,
} from "../canvasFormat";
import { THEMES, type Theme } from "../themes";
import type { CanvasFormat, CanvasPreset } from "../types";
import { CanvasShape } from "./CanvasShape";
import { NumberField } from "./ui/NumberField";
import { Select } from "./ui/Select";

export interface CanvasPresetPickerProps {
  canvasFormat: CanvasFormat;
  onCanvas: (changes: Partial<CanvasFormat>) => void;
}

/** A compact dropdown that sits in the Canvas heading, like the Appearance one. */
export function CanvasPresetPicker({
  canvasFormat,
  onCanvas,
}: CanvasPresetPickerProps) {
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
        onCanvas({ preset: preset as CanvasPreset })
      }
      textOf={(option) => option.label}
      iconOf={(option) => option.shape}
    />
  );
}

export interface CanvasPanelProps {
  canvasFormat: CanvasFormat;
  onCanvas: (changes: Partial<CanvasFormat>) => void;
  background: Theme;
  onBackground: (background: Theme) => void;
}

/** Canvas dimensions and background; the preset picker sits in the heading. */
export function CanvasPanel({
  canvasFormat,
  onCanvas,
  background,
  onBackground,
}: CanvasPanelProps) {
  const size = canvasSize(canvasFormat);

  /** Editing a preset's dimensions turns it into a custom size. */
  function changeSize(changes: { width?: number; height?: number }) {
    const width = changes.width ?? size.width;
    const height = changes.height ?? size.height;
    if (Number.isNaN(width) || Number.isNaN(height)) return;
    onCanvas({ preset: "custom", customWidth: width, customHeight: height });
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
          if (theme) onBackground(theme);
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
}

import {
  CANVAS_PRESETS,
  canvasSize,
  MAX_CANVAS_SIZE,
  MIN_CANVAS_SIZE,
} from "../canvasFormat";
import { type Background, THEMES } from "../themes";
import type { CanvasFormat, CanvasPreset } from "../types";
import { CanvasShape } from "./CanvasShape";
import { Checkbox } from "./ui/Checkbox";
import { NumberField } from "./ui/NumberField";
import { Select } from "./ui/Select";

const NONE = "none";

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
    {
      id: "trimmed" as const,
      label: "Trimmed",
      shape: <CanvasShape width={4} height={3} isOpen size={14} />,
    },
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
  background: Background;
  onBackground: (background: Background) => void;
}

/** Canvas dimensions and background; the preset picker sits in the heading. */
export function CanvasPanel({
  canvasFormat,
  onCanvas,
  background,
  onBackground,
}: CanvasPanelProps) {
  const isTrimmed = canvasFormat.preset === "trimmed";
  const size = canvasSize(canvasFormat);
  const colors = [{ id: NONE, name: "None", color: null }, ...THEMES];

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
            isDisabled={isTrimmed}
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
            isDisabled={isTrimmed}
            onChange={(height) => changeSize({ height })}
          />
        </div>
      </fieldset>
      <Select
        variant="field"
        label="Background"
        items={colors}
        selectedKey={background.theme?.id ?? NONE}
        onSelectionChange={(id) =>
          onBackground({
            ...background,
            theme: THEMES.find((option) => option.id === id) ?? null,
          })
        }
        textOf={(option) => option.name}
        iconOf={(option) => (
          <span
            className="menu-swatch"
            data-transparent={option.color === null || undefined}
            style={option.color ? { background: option.color } : undefined}
            aria-hidden="true"
          />
        )}
      />
      {background.theme && (
        <Checkbox
          isSelected={background.includeInExport}
          onChange={(includeInExport) =>
            onBackground({ ...background, includeInExport })
          }
        >
          Include in export
        </Checkbox>
      )}
    </>
  );
}

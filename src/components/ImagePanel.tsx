import { Label, Radio, RadioGroup } from "react-aria-components";
import { CANVAS_PRESETS } from "../canvasFormat";
import { THEMES, type Theme } from "../themes";
import type { CanvasFormat, CanvasPreset } from "../types";
import { CanvasShape } from "./CanvasShape";
import { Button } from "./ui/Button";

export interface ImagePanelProps {
  canvasFormat: CanvasFormat;
  onCanvasPreset: (preset: CanvasPreset) => void;
  onCustomSize: () => void;
  theme: Theme;
  onTheme: (theme: Theme) => void;
}

/** Size tiles and background swatches; the same choices as the Image menu. */
export function ImagePanel({
  canvasFormat,
  onCanvasPreset,
  onCustomSize,
  theme,
  onTheme,
}: ImagePanelProps) {
  const tiles = [
    {
      id: "trimmed" as const,
      label: "Trimmed",
      shape: <CanvasShape width={4} height={3} isOpen size={20} />,
    },
    ...CANVAS_PRESETS.map((preset) => ({
      id: preset.id,
      label: preset.ratio,
      shape: (
        <CanvasShape width={preset.width} height={preset.height} size={20} />
      ),
    })),
    {
      id: "custom" as const,
      label: "Custom",
      shape: (
        <CanvasShape
          width={canvasFormat.customWidth}
          height={canvasFormat.customHeight}
          size={20}
        />
      ),
    },
  ];

  return (
    <>
      <RadioGroup
        className="size-tiles"
        value={canvasFormat.preset}
        onChange={(preset) => {
          onCanvasPreset(preset as CanvasPreset);
          if (preset === "custom") onCustomSize();
        }}
      >
        <Label>Size</Label>
        <div className="size-grid">
          {tiles.map((tile) => (
            <Radio key={tile.id} value={tile.id}>
              {tile.shape}
              <span>{tile.label}</span>
            </Radio>
          ))}
        </div>
      </RadioGroup>
      {canvasFormat.preset === "custom" && (
        <div className="custom-size-summary">
          <span>
            {canvasFormat.customWidth} × {canvasFormat.customHeight} px
          </span>
          <Button variant="quiet" onPress={onCustomSize}>
            Edit
          </Button>
        </div>
      )}
      <RadioGroup
        className="swatches"
        orientation="horizontal"
        value={theme.id}
        onChange={(id) => {
          const next = THEMES.find((option) => option.id === id);
          if (next) onTheme(next);
        }}
      >
        <Label>Background</Label>
        <div className="swatch-row">
          {THEMES.map((option) => (
            <Radio
              key={option.id}
              value={option.id}
              aria-label={option.name}
              data-transparent={option.color === null || undefined}
              style={
                option.color
                  ? ({ "--swatch": option.color } as React.CSSProperties)
                  : undefined
              }
            />
          ))}
        </div>
      </RadioGroup>
    </>
  );
}

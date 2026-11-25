import { memo } from "react";
import {
  CANVAS_PRESETS,
  canvasSize,
  MAX_CANVAS_SIZE,
  MIN_CANVAS_SIZE,
} from "../../core/canvasFormat";
import { THEMES, type Theme } from "../../core/themes";
import type { CanvasFormat, CanvasPreset } from "../../core/types";
import { useEditor } from "../../hooks/editor/useEditor";
import fieldStyles from "../ui/field.module.css";
import { NumberField } from "../ui/NumberField";
import { Select } from "../ui/Select";
import styles from "./CanvasPane.module.css";
import { Section, SectionBody, SectionHeader } from "./shared/Section";

export interface CanvasPaneProps {
  canvasFormat: CanvasFormat;
  background: Theme;
}

export const CanvasPane = memo(function CanvasPane({
  canvasFormat,
  background,
}: CanvasPaneProps) {
  const { dispatch } = useEditor();
  const size = canvasSize(canvasFormat);
  const presets = [
    ...CANVAS_PRESETS.map((preset) => ({
      id: preset.id,
      label: `${preset.name} (${preset.ratio})`,
      shape: <CanvasShape width={preset.width} height={preset.height} />,
    })),
    {
      id: "custom" as const,
      label: "Custom",
      shape: (
        <CanvasShape
          width={canvasFormat.customWidth}
          height={canvasFormat.customHeight}
        />
      ),
    },
  ];

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
    <Section>
      <SectionHeader title="Canvas">
        <Select
          variant="compact"
          label="Canvas preset"
          items={presets}
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
      </SectionHeader>
      <SectionBody>
        <fieldset className={fieldStyles.field}>
          <legend className={fieldStyles.label}>Size</legend>
          <div className={styles.size}>
            <NumberField
              aria-label="Width (px)"
              prefix="W"
              minValue={MIN_CANVAS_SIZE}
              maxValue={MAX_CANVAS_SIZE}
              formatOptions={{ useGrouping: false }}
              value={size.width}
              onChange={(width) => changeSize({ width })}
            />
            <span className={styles.times} aria-hidden="true">
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
              className={styles.swatch}
              style={{ background: option.color }}
              aria-hidden="true"
            />
          )}
        />
      </SectionBody>
    </Section>
  );
});

const size = 14;

function CanvasShape({ width, height }: { width: number; height: number }) {
  const fit = size / Math.max(width, height);
  return (
    <span
      className={styles.shapeBox}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <span
        className={styles.shape}
        style={{ width: width * fit, height: height * fit }}
      />
    </span>
  );
}

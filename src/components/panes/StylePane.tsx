import { memo } from "react";
import {
  matchingPreset,
  type PhotocopySettings,
  PRESETS,
} from "../../core/photocopy";
import { useEditor } from "../../hooks/editor/useEditor";
import { Select } from "../ui/Select";
import { Slider } from "../ui/Slider";
import { Section, SectionBody, SectionHeader } from "./shared/Section";

const SLIDERS = [
  ["Ink", "darkness"],
  ["Grain", "grain"],
  ["Edge contrast", "contrast"],
] as const;

const CUSTOM = "custom";

export interface StylePaneProps {
  settings: PhotocopySettings;
}

export const StylePane = memo(function StylePane({ settings }: StylePaneProps) {
  const { dispatch } = useEditor();
  const current = matchingPreset(settings);
  const presets = PRESETS.map(({ id, title }) => ({ id, title }));
  if (!current) presets.push({ id: CUSTOM, title: "Custom" });

  return (
    <Section>
      <SectionHeader title="Style">
        <Select
          variant="compact"
          label="Preset"
          items={presets}
          selectedKey={current?.id ?? CUSTOM}
          onSelectionChange={(id) => {
            const preset = PRESETS.find((option) => option.id === id);
            if (preset) {
              dispatch({ type: "changeSettings", changes: preset.look });
            }
          }}
          textOf={(option) => option.title}
        />
      </SectionHeader>
      <SectionBody>
        {SLIDERS.map(([label, key]) => (
          <Slider
            key={key}
            label={label}
            value={settings[key]}
            onChange={(value) =>
              dispatch({ type: "changeSettings", changes: { [key]: value } })
            }
          />
        ))}
      </SectionBody>
    </Section>
  );
});

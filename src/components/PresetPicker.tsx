import {
  matchingPreset,
  type PhotocopyLook,
  type PhotocopySettings,
  PRESETS,
} from "../core/photocopy";
import { Select } from "./ui/Select";

const CUSTOM = "custom";

export interface PresetPickerProps {
  settings: PhotocopySettings;
  onChange: (look: PhotocopyLook) => void;
}

export function PresetPicker({ settings, onChange }: PresetPickerProps) {
  const current = matchingPreset(settings);
  const options = PRESETS.map(({ id, title }) => ({ id, title }));
  if (!current) options.push({ id: CUSTOM, title: "Custom" });

  return (
    <Select
      variant="compact"
      label="Preset"
      items={options}
      selectedKey={current?.id ?? CUSTOM}
      onSelectionChange={(id) => {
        const preset = PRESETS.find((option) => option.id === id);
        if (preset) onChange(preset.look);
      }}
      textOf={(option) => option.title}
    />
  );
}

import {
  Button,
  ListBox,
  ListBoxItem,
  Popover,
  Select,
  SelectValue,
} from "react-aria-components";
import {
  matchingPreset,
  type PhotocopyLook,
  type PhotocopySettings,
  PRESETS,
} from "../photocopy";

const CUSTOM = "custom";

export interface PresetPickerProps {
  settings: PhotocopySettings;
  onChange: (look: PhotocopyLook) => void;
}

/** A compact dropdown that sits in the Appearance heading. */
export function PresetPicker({ settings, onChange }: PresetPickerProps) {
  const current = matchingPreset(settings);
  const options = PRESETS.map(({ id, title }) => ({ id, title }));
  if (!current) options.push({ id: CUSTOM, title: "Custom" });

  return (
    <Select
      aria-label="Preset"
      className="compact-select"
      selectedKey={current?.id ?? CUSTOM}
      onSelectionChange={(id) => {
        const preset = PRESETS.find((option) => option.id === id);
        if (preset) onChange(preset.look);
      }}
    >
      <Button className="compact-select-button">
        <SelectValue />
        <span className="chevron" aria-hidden="true">
          ▾
        </span>
      </Button>
      <Popover className="select-popover compact" placement="bottom end">
        <ListBox items={options}>
          {(option) => <ListBoxItem id={option.id}>{option.title}</ListBoxItem>}
        </ListBox>
      </Popover>
    </Select>
  );
}

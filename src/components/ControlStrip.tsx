import {
  Keyboard,
  Menu,
  MenuItem,
  MenuTrigger,
  Popover,
  Text,
} from "react-aria-components";
import type { PhotocopySettings } from "../photocopy";
import { SHORTCUTS } from "../shortcuts";
import type { Layer } from "../types";
import { PresetPicker } from "./PresetPicker";
import { Button } from "./ui/Button";
import { ChevronIcon, PlusIcon } from "./ui/icons";
import { Slider } from "./ui/Slider";

export interface ControlStripProps {
  layers: Layer[];
  settings: PhotocopySettings;
  isCopying: boolean;
  error: string | null;
  layerList: React.ReactNode;
  /** Size and background, shown below Appearance. */
  canvasPanel: React.ReactNode;
  /** Preset dropdown shown in the Canvas heading. */
  canvasPresetPicker: React.ReactNode;
  onSettings: (changes: Partial<PhotocopySettings>) => void;
  onCopy: () => void;
  onUpload: () => void;
  onSearch: () => void;
}

export function ControlStrip({
  layers,
  settings,
  isCopying,
  error,
  layerList,
  canvasPanel,
  canvasPresetPicker,
  onSettings,
  onCopy,
  onUpload,
  onSearch,
}: ControlStripProps) {
  return (
    <aside className="strip" aria-label="Controls">
      <div className="strip-scroll">
        <Section
          title="Layers"
          action={
            layers.length > 0 && (
              <MenuTrigger>
                <Button variant="quiet" aria-label="Add layer">
                  <PlusIcon />
                </Button>
                <Popover className="menu-popover" placement="bottom end">
                  <Menu
                    aria-label="Add layer"
                    onAction={(key) =>
                      key === "upload" ? onUpload() : onSearch()
                    }
                  >
                    <MenuItem id="upload" textValue="Upload image…">
                      <Text slot="label">Upload image…</Text>
                    </MenuItem>
                    <MenuItem id="search" textValue="Search for images…">
                      <Text slot="label">Search for images…</Text>
                    </MenuItem>
                  </Menu>
                </Popover>
              </MenuTrigger>
            )
          }
        >
          {layers.length > 0 ? (
            layerList
          ) : (
            <div className="layers-empty">
              <Button onPress={onUpload}>Upload image…</Button>
              <Button onPress={onSearch}>Search for images…</Button>
            </div>
          )}
        </Section>

        <Section
          title="Appearance"
          action={
            <PresetPicker
              settings={settings}
              onChange={(look) => onSettings(look)}
            />
          }
        >
          <Slider
            label="Ink"
            minValue={0}
            maxValue={100}
            value={settings.darkness}
            onChange={(darkness) => onSettings({ darkness })}
          />
          <Slider
            label="Grain"
            minValue={0}
            maxValue={100}
            value={settings.grain}
            onChange={(grain) => onSettings({ grain })}
          />
          <Slider
            label="Edge contrast"
            minValue={0}
            maxValue={100}
            value={settings.contrast}
            onChange={(contrast) => onSettings({ contrast })}
          />
        </Section>

        <Section title="Canvas" action={canvasPresetPicker}>
          {canvasPanel}
        </Section>
      </div>

      <div className="strip-footer">
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <Button
          variant="primary"
          className="copy-button"
          onPress={onCopy}
          isDisabled={isCopying || !layers.some((layer) => layer.visible)}
        >
          {isCopying ? "Exporting…" : "Export"}
          {!isCopying && (
            <Keyboard className="shortcut">{SHORTCUTS.export}</Keyboard>
          )}
        </Button>
      </div>
    </aside>
  );
}

/**
 * A collapsible sidebar section. Its trailing control sits beside the summary
 * rather than in it, so the toggle never contains another button.
 */
function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <details className="section" open>
      <summary className="section-heading">
        <h2 className="section-title">{title}</h2>
        <ChevronIcon className="section-chevron" />
      </summary>
      {action && <div className="section-action">{action}</div>}
      <div className="section-body">{children}</div>
    </details>
  );
}

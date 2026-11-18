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
import { PlusIcon } from "./ui/icons";
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
        <section>
          <div className="section-heading">
            <h2>Layers</h2>
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
                  <MenuItem id="upload" textValue="Upload Image…">
                    <Text slot="label">Upload Image…</Text>
                  </MenuItem>
                  <MenuItem id="search" textValue="Search Wikimedia Commons…">
                    <Text slot="label">Search Wikimedia Commons…</Text>
                  </MenuItem>
                </Menu>
              </Popover>
            </MenuTrigger>
          </div>
          {layerList}
        </section>

        <section>
          <div className="section-heading">
            <h2>Appearance</h2>
            <PresetPicker
              settings={settings}
              onChange={(look) => onSettings(look)}
            />
          </div>
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
        </section>

        <section>
          <div className="section-heading">
            <h2>Canvas</h2>
            {canvasPresetPicker}
          </div>
          {canvasPanel}
        </section>
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

import { memo } from "react";
import {
  Keyboard,
  Menu,
  MenuItem,
  MenuTrigger,
  Popover,
  Text,
} from "react-aria-components";
import type { PhotocopySettings } from "../core/photocopy";
import { SHORTCUTS } from "../core/shortcuts";
import type { Theme } from "../core/themes";
import type { CanvasFormat, Layer } from "../core/types";
import { useEditor } from "../hooks/useEditor";
import { CanvasPanel, CanvasPresetPicker } from "./CanvasPanel";
import { LayerList } from "./LayerList";
import { PresetPicker } from "./PresetPicker";
import { Button } from "./ui/Button";
import { ChevronIcon, PlusIcon } from "./ui/icons";
import { Slider } from "./ui/Slider";

export interface ControlStripProps {
  layers: Layer[];
  selectedId: string | null;
  settings: PhotocopySettings;
  canvasFormat: CanvasFormat;
  background: Theme;
  isCopying: boolean;
  error: string | null;
  onExport: () => void;
}

export const ControlStrip = memo(function ControlStrip({
  layers,
  selectedId,
  settings,
  canvasFormat,
  background,
  isCopying,
  error,
  onExport,
}: ControlStripProps) {
  const { dispatch, openUpload, openSearch } = useEditor();
  const onSettings = (changes: Partial<PhotocopySettings>) =>
    dispatch({ type: "changeSettings", changes });
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
                      key === "upload" ? openUpload() : openSearch()
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
            <LayerList layers={layers} selectedId={selectedId} />
          ) : (
            <div className="layers-empty">
              <Button onPress={openUpload}>Upload image…</Button>
              <Button onPress={openSearch}>Search for images…</Button>
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

        <Section
          title="Canvas"
          action={<CanvasPresetPicker canvasFormat={canvasFormat} />}
        >
          <CanvasPanel canvasFormat={canvasFormat} background={background} />
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
          onPress={onExport}
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
});

/** The trailing control sits beside the toggle, never nested inside it. */
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

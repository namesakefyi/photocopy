import { memo, useRef, useState } from "react";
import {
  Keyboard,
  MenuTrigger,
  ToggleButton,
  Toolbar,
} from "react-aria-components";
import type { PhotocopySettings } from "../core/photocopy";
import { SHORTCUTS } from "../core/shortcuts";
import type { Theme } from "../core/themes";
import type { CanvasFormat, LayerEntry } from "../core/types";
import { useEditor } from "../hooks/useEditor";
import { useEventListener } from "../hooks/useEventListener";
import { NARROW, useMediaQuery } from "../hooks/useMediaQuery";
import { ADD_IMAGE_ITEMS } from "./addImageItems";
import { CanvasPanel, CanvasPresetPicker } from "./CanvasPanel";
import styles from "./ControlStrip.module.css";
import { LayerList } from "./LayerList";
import { PresetPicker } from "./PresetPicker";
import { Button, buttonClassName } from "./ui/Button";
import {
  CanvasIcon,
  ChevronIcon,
  ExportIcon,
  LayersIcon,
  PlusIcon,
  StyleIcon,
} from "./ui/icons";
import { Menu, MenuItem } from "./ui/Menu";
import messageStyles from "./ui/message.module.css";
import { Popover } from "./ui/Popover";
import { Slider } from "./ui/Slider";

export interface ControlStripProps {
  layers: LayerEntry[];
  isLoading: boolean;
  selectedId: string | null;
  settings: PhotocopySettings;
  canvasFormat: CanvasFormat;
  background: Theme;
  canExport: boolean;
  isExporting: boolean;
  error: string | null;
  onExport: () => void;
}

const SLIDERS = [
  ["Ink", "darkness"],
  ["Grain", "grain"],
  ["Edge contrast", "contrast"],
] as const;

export const ControlStrip = memo(function ControlStrip({
  layers,
  isLoading,
  selectedId,
  settings,
  canvasFormat,
  background,
  canExport,
  isExporting,
  error,
  onExport,
}: ControlStripProps) {
  const editor = useEditor();
  const isNarrow = useMediaQuery(NARROW);
  const onSettings = (changes: Partial<PhotocopySettings>) =>
    editor.dispatch({ type: "changeSettings", changes });

  const sections: SectionContent[] = [
    {
      title: "Layers",
      icon: <LayersIcon />,
      action: (
        <MenuTrigger>
          <Button variant="quiet" aria-label="Add layer">
            <PlusIcon />
          </Button>
          <Popover placement="bottom end">
            <Menu aria-label="Add layer" items={ADD_IMAGE_ITEMS}>
              {(item) => (
                <MenuItem onAction={() => item.run(editor)}>
                  {item.label}
                </MenuItem>
              )}
            </Menu>
          </Popover>
        </MenuTrigger>
      ),
      body: (
        <LayerList
          layers={layers}
          selectedId={selectedId}
          isLoading={isLoading}
        />
      ),
    },
    {
      title: "Style",
      icon: <StyleIcon />,
      action: <PresetPicker settings={settings} onChange={onSettings} />,
      body: SLIDERS.map(([label, key]) => (
        <Slider
          key={key}
          label={label}
          value={settings[key]}
          onChange={(value) => onSettings({ [key]: value })}
        />
      )),
    },
    {
      title: "Canvas",
      icon: <CanvasIcon />,
      action: <CanvasPresetPicker canvasFormat={canvasFormat} />,
      body: <CanvasPanel canvasFormat={canvasFormat} background={background} />,
    },
  ];
  const errorMessage = error && (
    <p role="alert" className={messageStyles.error}>
      {error}
    </p>
  );
  const exportLabel = isExporting ? "Exporting…" : "Export";
  const isExportDisabled = isExporting || !canExport;

  if (isNarrow) {
    return (
      <FloatingControls
        sections={sections}
        error={errorMessage}
        exportButton={
          <Button
            variant="primary"
            className={styles.floatingButton}
            onPress={onExport}
            isDisabled={isExportDisabled}
          >
            <ExportIcon />
            {exportLabel}
          </Button>
        }
      />
    );
  }

  return (
    <aside className={styles.strip} aria-label="Controls">
      <div className={styles.scroll}>
        {sections.map(({ title, action, body }) => (
          <Section key={title} title={title} action={action}>
            {body}
          </Section>
        ))}
      </div>
      <div className={styles.footer}>
        {errorMessage}
        <Button
          variant="primary"
          size="large"
          onPress={onExport}
          isDisabled={isExportDisabled}
        >
          {exportLabel}
          {!isExporting && <Keyboard>{SHORTCUTS.export}</Keyboard>}
        </Button>
      </div>
    </aside>
  );
});

function FloatingControls({
  sections,
  error,
  exportButton,
}: {
  sections: SectionContent[];
  error: React.ReactNode;
  exportButton: React.ReactNode;
}) {
  const [openTitle, setOpenTitle] = useState<string | null>(null);
  const containerRef = useRef<HTMLElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const open = sections.find((section) => section.title === openTitle);

  // Native, so Escape in menus opened from the panel (rendered elsewhere) never arrives.
  useEventListener(containerRef, "keydown", (event) => {
    if (event.key !== "Escape" || !openTitle) return;
    if (!panelRef.current?.contains(event.target as Node)) return;
    event.stopPropagation();
    containerRef.current
      ?.querySelector<HTMLElement>(`[aria-controls="${PANEL_ID}"]`)
      ?.focus();
    setOpenTitle(null);
  });

  return (
    <aside ref={containerRef} className={styles.floating} aria-label="Controls">
      {open && (
        <section
          ref={panelRef}
          id={PANEL_ID}
          className={styles.panel}
          aria-label={open.title}
        >
          <div className={styles.panelHeading}>
            <h2 className={styles.title}>{open.title}</h2>
            {open.action}
          </div>
          <div className={styles.body}>{open.body}</div>
        </section>
      )}
      {error}
      <Toolbar aria-label="Control sections" className={styles.floatingBar}>
        {sections.map(({ title, icon }) => (
          <ToggleButton
            key={title}
            className={buttonClassName("toolbar", styles.floatingButton)}
            isSelected={openTitle === title}
            onChange={(isSelected) => setOpenTitle(isSelected ? title : null)}
            aria-controls={openTitle === title ? PANEL_ID : undefined}
          >
            {icon}
            {title}
          </ToggleButton>
        ))}
        {exportButton}
      </Toolbar>
    </aside>
  );
}

const PANEL_ID = "control-panel";

interface SectionContent {
  title: string;
  icon: React.ReactNode;
  action: React.ReactNode;
  body: React.ReactNode;
}

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
    <details className={styles.section} open>
      <summary className={styles.heading}>
        <h2 className={styles.title}>{title}</h2>
        <ChevronIcon className={styles.chevron} />
      </summary>
      {action && <div className={styles.action}>{action}</div>}
      <div className={styles.body}>{children}</div>
    </details>
  );
}

import { createContext, memo, useContext, useRef, useState } from "react";
import { Keyboard, ToggleButton, Toolbar } from "react-aria-components";
import type { PhotocopySettings } from "../../core/photocopy";
import { SHORTCUTS } from "../../core/shortcuts";
import type { Theme } from "../../core/themes";
import type { CanvasFormat, LayerEntry } from "../../core/types";
import { useEditor } from "../../hooks/editor/useEditor";
import { useEventListener } from "../../hooks/useEventListener";
import { Button, buttonClassName } from "../ui/Button";
import { CanvasIcon, ExportIcon, LayersIcon, StyleIcon } from "../ui/icons";
import messageStyles from "../ui/message.module.css";
import { CanvasPane } from "./CanvasPane";
import styles from "./ControlPanes.module.css";
import { LayerPane } from "./LayerPane";
import { StylePane } from "./StylePane";
import { SectionLayoutContext } from "./shared/Section";

export interface ControlPanesProps {
  /** Phones: a toolbar floating over the canvas, with each section in a panel above it. */
  isNarrow: boolean;
  layers: LayerEntry[];
  selectedId: string | null;
  settings: PhotocopySettings;
  canvasFormat: CanvasFormat;
  background: Theme;
  isExporting: boolean;
  error: string | null;
  onExport: () => void;
}

const PANES = [
  { id: "layers", title: "Layers", Icon: LayersIcon },
  { id: "style", title: "Style", Icon: StyleIcon },
  { id: "canvas", title: "Canvas", Icon: CanvasIcon },
] as const;

type PaneId = (typeof PANES)[number]["id"];

const PANEL_ID = "control-panel";

export const ControlPanes = memo(function ControlPanes({
  isNarrow,
  layers,
  selectedId,
  settings,
  canvasFormat,
  background,
  isExporting,
  error,
  onExport,
}: ControlPanesProps) {
  const { canExport } = useEditor();
  const isExportDisabled = isExporting || !canExport;
  const layersPane = <LayerPane layers={layers} selectedId={selectedId} />;
  const stylePane = <StylePane settings={settings} />;
  const canvasPane = (
    <CanvasPane canvasFormat={canvasFormat} background={background} />
  );

  if (isNarrow) {
    return (
      <FloatingControls
        error={error}
        isExporting={isExporting}
        isExportDisabled={isExportDisabled}
        onExport={onExport}
      >
        <FloatingPane id="layers">{layersPane}</FloatingPane>
        <FloatingPane id="style">{stylePane}</FloatingPane>
        <FloatingPane id="canvas">{canvasPane}</FloatingPane>
      </FloatingControls>
    );
  }

  return (
    <aside className={styles.sidebar} aria-label="Controls">
      <div className={styles.scroll}>
        {layersPane}
        {stylePane}
        {canvasPane}
      </div>
      <div className={styles.footer}>
        <ErrorMessage error={error} />
        <Button
          variant="primary"
          size="large"
          onPress={onExport}
          isDisabled={isExportDisabled}
        >
          {isExporting ? "Exporting…" : "Export"}
          {!isExporting && <Keyboard>{SHORTCUTS.export}</Keyboard>}
        </Button>
      </div>
    </aside>
  );
});

function ErrorMessage({ error }: { error: string | null }) {
  return (
    error && (
      <p role="alert" className={messageStyles.error}>
        {error}
      </p>
    )
  );
}

const OpenPaneContext = createContext<PaneId | null>(null);

function FloatingPane({
  id,
  children,
}: {
  id: PaneId;
  children: React.ReactNode;
}) {
  if (useContext(OpenPaneContext) !== id) return null;
  return (
    <div id={PANEL_ID} className={styles.panel}>
      <SectionLayoutContext value="panel">{children}</SectionLayoutContext>
    </div>
  );
}

function FloatingControls({
  error,
  isExporting,
  isExportDisabled,
  onExport,
  children,
}: {
  error: string | null;
  isExporting: boolean;
  isExportDisabled: boolean;
  onExport: () => void;
  children: React.ReactNode;
}) {
  const [openId, setOpenId] = useState<PaneId | null>(null);
  const containerRef = useRef<HTMLElement>(null);

  // Native, so Escape in menus opened from the panel (rendered elsewhere) never arrives.
  useEventListener(containerRef, "keydown", (event) => {
    if (event.key !== "Escape" || !openId) return;
    if (!(event.target as Element).closest?.(`#${PANEL_ID}`)) return;
    event.stopPropagation();
    containerRef.current
      ?.querySelector<HTMLElement>(`[aria-controls="${PANEL_ID}"]`)
      ?.focus();
    setOpenId(null);
  });

  return (
    <aside ref={containerRef} className={styles.floating} aria-label="Controls">
      <OpenPaneContext value={openId}>{children}</OpenPaneContext>
      <ErrorMessage error={error} />
      <Toolbar aria-label="Control sections" className={styles.floatingBar}>
        {PANES.map(({ id, title, Icon }) => (
          <ToggleButton
            key={id}
            className={buttonClassName("toolbar", styles.floatingButton)}
            isSelected={openId === id}
            onChange={(isSelected) => setOpenId(isSelected ? id : null)}
            aria-controls={openId === id ? PANEL_ID : undefined}
          >
            <Icon />
            {title}
          </ToggleButton>
        ))}
        <Button
          variant="primary"
          className={styles.floatingButton}
          onPress={onExport}
          isDisabled={isExportDisabled}
        >
          <ExportIcon />
          {isExporting ? "Exporting…" : "Export"}
        </Button>
      </Toolbar>
    </aside>
  );
}

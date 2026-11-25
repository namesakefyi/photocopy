import { useEffect, useRef, useState } from "react";
import {
  Dialog,
  Modal,
  ModalOverlay,
  VisuallyHidden,
} from "react-aria-components";
import styles from "./App.module.css";
import {
  ArtboardEditor,
  type ArtboardEditorHandle,
} from "./components/ArtboardEditor";
import { ArtboardList, DeleteDialog } from "./components/ArtboardList";
import { cx } from "./components/ui/cx";
import dialogStyles from "./components/ui/Dialog.module.css";
import { SidebarIcon } from "./components/ui/icons";
import { ToolToggleButton } from "./components/ui/ToolButton";
import { readSetting, writeSetting } from "./core/settings";
import { SHORTCUTS } from "./core/shortcuts";
import {
  type ArtboardActions,
  ArtboardActionsContext,
} from "./hooks/useArtboardActions";
import { useArtboardLibrary } from "./hooks/useArtboardLibrary";
import { useBackgroundRemovals } from "./hooks/useBackgroundRemovals";
import { NARROW, useMediaQuery } from "./hooks/useMediaQuery";
import { useVisualViewport } from "./hooks/useVisualViewport";

const ARTBOARD_LIST_KEY = "photocopy-file-viewer";

export function App() {
  const isNarrow = useMediaQuery(NARROW);
  useVisualViewport();
  const [isArtboardListOpen, setIsArtboardListOpen] = useState(
    () => readSetting(ARTBOARD_LIST_KEY) !== "closed",
  );
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const editorRef = useRef<ArtboardEditorHandle>(null);
  const library = useArtboardLibrary(editorRef, () => setIsDrawerOpen(false));
  const { artboards, activeId, editorKey } = library;
  const removals = useBackgroundRemovals(editorRef, activeId, editorKey);

  useEffect(() => {
    writeSetting(ARTBOARD_LIST_KEY, isArtboardListOpen ? "open" : "closed");
  }, [isArtboardListOpen]);

  if (!artboards) return <div className={styles.app} />;
  const activeSummary = artboards.find((artboard) => artboard.id === activeId);

  const artboardList = (
    <ArtboardList
      artboards={artboards}
      activeId={activeId}
      busyIds={removals.busyIds}
      onOpen={library.open}
      onNew={library.create}
      onDuplicate={library.duplicate}
      onRequestDelete={setDeletingId}
      onReorder={library.reorder}
    />
  );
  const showsArtboardList = !isNarrow && isArtboardListOpen;
  const isArtboardListShown = isNarrow ? isDrawerOpen : isArtboardListOpen;
  const setArtboardListShown = isNarrow
    ? setIsDrawerOpen
    : setIsArtboardListOpen;

  const artboardActions: ArtboardActions = {
    newArtboard() {
      if (!isNarrow) setIsArtboardListOpen(true);
      library.create();
    },
    duplicateArtboard: () => library.duplicate(activeId),
    deleteArtboard: () => setDeletingId(activeId),
  };

  return (
    <ArtboardActionsContext value={artboardActions}>
      <div
        className={styles.app}
        data-artboard-list={showsArtboardList || undefined}
      >
        <VisuallyHidden elementType="h1">Photocopy</VisuallyHidden>
        {showsArtboardList && (
          <nav className={styles.filesPanel} aria-label="Artboards">
            {artboardList}
          </nav>
        )}
        <ArtboardEditor
          key={editorKey}
          ref={editorRef}
          artboardId={activeId}
          summary={activeSummary}
          removals={removals.activeRemovals}
          toolbarStart={
            <ToolToggleButton
              label="Show artboards"
              shortcut={`${SHORTCUTS.previousArtboard} ${SHORTCUTS.nextArtboard}`}
              isSelected={isArtboardListShown}
              onChange={setArtboardListShown}
            >
              <SidebarIcon />
            </ToolToggleButton>
          }
          isArtboardListShown={isArtboardListShown}
          onArtboardListShownChange={setArtboardListShown}
          onRemoveBackground={removals.start}
          onThumbnail={library.setThumbnail}
          onSaved={library.setSaved}
          onSwitchArtboard={library.switchBy}
          onReload={library.reload}
        />
        <DeleteDialog
          artboard={
            artboards.find((artboard) => artboard.id === deletingId) ?? null
          }
          onClose={() => setDeletingId(null)}
          onDelete={library.remove}
        />
        {isNarrow && (
          <ModalOverlay
            className={cx(dialogStyles.overlay, styles.drawerOverlay)}
            isDismissable
            isOpen={isDrawerOpen}
            onOpenChange={setIsDrawerOpen}
          >
            <Modal className={styles.drawer}>
              <Dialog aria-label="Artboards" className={styles.drawerDialog}>
                {artboardList}
              </Dialog>
            </Modal>
          </ModalOverlay>
        )}
      </div>
    </ArtboardActionsContext>
  );
}

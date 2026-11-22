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
import { ArtboardList } from "./components/ArtboardList";
import { cx } from "./components/ui/cx";
import dialogStyles from "./components/ui/Dialog.module.css";
import { SidebarIcon } from "./components/ui/icons";
import { ToolToggleButton } from "./components/ui/ToolButton";
import { readSetting, writeSetting } from "./core/settings";
import { SHORTCUTS } from "./core/shortcuts";
import { useArtboardLibrary } from "./hooks/useArtboardLibrary";
import { useBackgroundRemovals } from "./hooks/useBackgroundRemovals";
import { useMediaQuery } from "./hooks/useMediaQuery";

const ARTBOARD_LIST_KEY = "photocopy-file-viewer";
const NARROW = "(width < 760px)";

export function App() {
  const isNarrow = useMediaQuery(NARROW);
  const [isArtboardListOpen, setIsArtboardListOpen] = useState(
    () => readSetting(ARTBOARD_LIST_KEY) !== "closed",
  );
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const editorRef = useRef<ArtboardEditorHandle>(null);
  const library = useArtboardLibrary(editorRef, () => setIsDrawerOpen(false));
  const { artboards, activeId, editorKey } = library;
  const removals = useBackgroundRemovals(editorRef, activeId, editorKey);

  useEffect(() => {
    writeSetting(ARTBOARD_LIST_KEY, isArtboardListOpen ? "open" : "closed");
  }, [isArtboardListOpen]);

  if (!artboards) return <div className={styles.app} />;

  const artboardList = (
    <ArtboardList
      artboards={artboards}
      activeId={activeId}
      busyIds={removals.busyIds}
      onOpen={library.open}
      onNew={library.create}
      onDuplicate={library.duplicate}
      onDelete={library.remove}
      onReorder={library.reorder}
    />
  );
  const showsArtboardList = !isNarrow && isArtboardListOpen;
  // On narrow screens the list is a drawer instead of a panel.
  const isArtboardListShown = isNarrow ? isDrawerOpen : isArtboardListOpen;
  const setArtboardListShown = isNarrow
    ? setIsDrawerOpen
    : setIsArtboardListOpen;

  return (
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
        removals={removals.activeRemovals}
        needsThumbnail={
          !artboards.find((artboard) => artboard.id === activeId)?.thumbnail
        }
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
  );
}

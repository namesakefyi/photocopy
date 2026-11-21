import { useEffect, useRef, useState } from "react";
import { Dialog, Modal, ModalOverlay } from "react-aria-components";
import styles from "./App.module.css";
import {
  ArtboardEditor,
  type ArtboardEditorHandle,
} from "./components/ArtboardEditor";
import { FileViewer } from "./components/FileViewer";
import { cx } from "./components/ui/cx";
import dialogStyles from "./components/ui/Dialog.module.css";
import { SidebarIcon } from "./components/ui/icons";
import { ToolToggleButton } from "./components/ui/ToolButton";
import { readSetting, writeSetting } from "./core/settings";
import { SHORTCUTS } from "./core/shortcuts";
import { useArtboardLibrary } from "./hooks/useArtboardLibrary";
import { useBackgroundRemovals } from "./hooks/useBackgroundRemovals";
import { useMediaQuery } from "./hooks/useMediaQuery";

const FILE_VIEWER_KEY = "photocopy-file-viewer";
const NARROW = "(width < 760px)";

export function App() {
  const isNarrow = useMediaQuery(NARROW);
  const [isFileViewerOpen, setIsFileViewerOpen] = useState(
    () => readSetting(FILE_VIEWER_KEY) !== "closed",
  );
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const editorRef = useRef<ArtboardEditorHandle>(null);
  const library = useArtboardLibrary(editorRef, () => setIsDrawerOpen(false));
  const { artboards, activeId, editorKey } = library;
  const removals = useBackgroundRemovals(editorRef, activeId, editorKey);

  useEffect(() => {
    writeSetting(FILE_VIEWER_KEY, isFileViewerOpen ? "open" : "closed");
  }, [isFileViewerOpen]);

  if (!artboards) return <div className={styles.app} />;

  const fileViewer = (
    <FileViewer
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
  const showsFileViewer = !isNarrow && isFileViewerOpen;

  return (
    <div className={styles.app} data-file-viewer={showsFileViewer || undefined}>
      <h1 className="visually-hidden">Photocopy</h1>
      {showsFileViewer && (
        <nav className={styles.filesPanel} aria-label="Artboards">
          {fileViewer}
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
            isSelected={isNarrow ? isDrawerOpen : isFileViewerOpen}
            onChange={(isOpen) =>
              isNarrow ? setIsDrawerOpen(isOpen) : setIsFileViewerOpen(isOpen)
            }
          >
            <SidebarIcon />
          </ToolToggleButton>
        }
        onRemoveBackground={removals.start}
        onThumbnail={library.setThumbnail}
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
              {fileViewer}
            </Dialog>
          </Modal>
        </ModalOverlay>
      )}
    </div>
  );
}

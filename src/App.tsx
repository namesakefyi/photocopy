import { useRef } from "react";
import {
  Dialog,
  Modal,
  ModalOverlay,
  VisuallyHidden,
} from "react-aria-components";
import styles from "./App.module.css";
import { Editor, type EditorHandle } from "./components/editor/Editor";
import { ArtboardListPane } from "./components/panes/ArtboardListPane";
import { cx } from "./components/ui/cx";
import dialogStyles from "./components/ui/Dialog.module.css";
import { NARROW, useMediaQuery } from "./hooks/useMediaQuery";
import { useVisualViewport } from "./hooks/useVisualViewport";
import {
  RemovalsContext,
  WorkspaceContext,
} from "./hooks/workspace/useWorkspace";
import { useWorkspaceState } from "./hooks/workspace/useWorkspaceState";

export function App() {
  const isNarrow = useMediaQuery(NARROW);
  useVisualViewport();
  const editorRef = useRef<EditorHandle>(null);
  const { workspace, removals } = useWorkspaceState(editorRef, isNarrow);

  if (!workspace) return <div className={styles.app} />;
  const showsArtboardList = !isNarrow && workspace.isArtboardListShown;

  return (
    <WorkspaceContext value={workspace}>
      <RemovalsContext value={removals}>
        <div
          className={styles.app}
          data-artboard-list={showsArtboardList || undefined}
        >
          <VisuallyHidden elementType="h1">Photocopy</VisuallyHidden>
          {showsArtboardList && (
            <nav className={styles.artboardsPanel} aria-label="Artboards">
              <ArtboardListPane />
            </nav>
          )}
          <Editor key={workspace.activeId} ref={editorRef} />
          {isNarrow && (
            <ModalOverlay
              className={cx(dialogStyles.overlay, styles.drawerOverlay)}
              isDismissable
              isOpen={workspace.isArtboardListShown}
              onOpenChange={workspace.setArtboardListShown}
            >
              <Modal className={styles.drawer}>
                <Dialog aria-label="Artboards" className={styles.drawerDialog}>
                  <ArtboardListPane />
                </Dialog>
              </Modal>
            </ModalOverlay>
          )}
        </div>
      </RemovalsContext>
    </WorkspaceContext>
  );
}

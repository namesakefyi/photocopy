import type { ArtboardSummary } from "../../core/persistence";
import { ArtboardThumbnail } from "../panes/ArtboardListPane";
import { Button } from "../ui/Button";
import { Dialog, DialogActions, DialogHeading } from "../ui/Dialog";
import styles from "./DeleteArtboardDialog.module.css";

export function DeleteArtboardDialog({
  artboard,
  onClose,
  onDelete,
}: {
  artboard: ArtboardSummary | null;
  onClose: () => void;
  onDelete: (id: string) => void;
}) {
  return (
    <Dialog
      isOpen={artboard !== null}
      onOpenChange={(isOpen) => !isOpen && onClose()}
      role="alertdialog"
      className={styles.confirmWindow}
      contentClassName={styles.confirm}
    >
      {artboard && (
        <>
          <DialogHeading>Delete artboard?</DialogHeading>
          <div className={styles.confirmPreview}>
            <ArtboardThumbnail artboard={artboard} />
          </div>
          <p>This can’t be undone.</p>
          <DialogActions>
            <Button variant="quiet" onPress={onClose} autoFocus>
              Cancel
            </Button>
            <Button
              variant="primary"
              onPress={() => {
                onDelete(artboard.id);
                onClose();
              }}
            >
              Delete
            </Button>
          </DialogActions>
        </>
      )}
    </Dialog>
  );
}

import { useEffect, useState } from "react";
import {
  Dialog,
  GridList,
  GridListItem,
  Heading,
  Menu,
  MenuItem,
  MenuTrigger,
  Modal,
  ModalOverlay,
  Popover,
  useDragAndDrop,
} from "react-aria-components";
import type { ArtboardSummary } from "../core/persistence";
import { reorder } from "../core/reorder";
import { themeById } from "../core/themes";
import { Button } from "./ui/Button";
import { MoreIcon, PlusIcon } from "./ui/icons";

export interface FileViewerProps {
  artboards: ArtboardSummary[];
  activeId: string;
  /** Artboards with a background removal in flight. */
  busyIds: Set<string>;
  onOpen: (id: string) => void;
  onNew: () => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onReorder: (order: string[]) => void;
}

function Thumbnail({ artboard }: { artboard: ArtboardSummary }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!artboard.thumbnail) return;
    const next = URL.createObjectURL(artboard.thumbnail);
    setUrl(next);
    return () => {
      URL.revokeObjectURL(next);
      setUrl(null);
    };
  }, [artboard.thumbnail]);
  return url ? (
    <img className="file-thumb" src={url} alt="" draggable={false} />
  ) : (
    <span
      className="file-thumb placeholder"
      style={{ background: themeById(artboard.backgroundId).color }}
    />
  );
}

export function FileViewer({
  artboards,
  activeId,
  busyIds,
  onOpen,
  onNew,
  onDuplicate,
  onDelete,
  onReorder,
}: FileViewerProps) {
  const [deleting, setDeleting] = useState<ArtboardSummary | null>(null);
  const labels = new Map(
    artboards.map((artboard, index) => [artboard.id, `Artboard ${index + 1}`]),
  );

  const { dragAndDropHooks } = useDragAndDrop({
    // Always passed, so the list's hooks stay stable; one artboard has no order.
    isDisabled: artboards.length < 2,
    getItems: (keys) => [...keys].map((key) => ({ "text/plain": String(key) })),
    onReorder: ({ keys, target }) =>
      onReorder(
        reorder(
          artboards.map((artboard) => artboard.id),
          keys,
          target,
        ),
      ),
  });

  return (
    // The editor leaves keys pressed here alone.
    <div className="file-viewer" data-own-keys>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: keys bubble up from the list's rows */}
      <div
        className="file-scroll"
        onKeyDown={(event) => {
          if (event.key !== "Backspace" && event.key !== "Delete") return;
          const row = (event.target as HTMLElement).closest("[data-key]");
          // Only from the row itself, not its More button.
          if (!row || row !== event.target) return;
          const artboard = artboards.find(
            (other) => other.id === row.getAttribute("data-key"),
          );
          if (artboard) setDeleting(artboard);
        }}
      >
        <GridList
          aria-label="Artboards"
          className="file-list"
          items={artboards}
          selectionMode="single"
          disallowEmptySelection
          selectedKeys={[activeId]}
          onSelectionChange={(keys) => {
            const [key] = keys;
            if (key !== undefined) onOpen(String(key));
          }}
          dragAndDropHooks={dragAndDropHooks}
        >
          {(artboard) => {
            const label = labels.get(artboard.id);
            return (
              <GridListItem id={artboard.id} textValue={label}>
                <Thumbnail artboard={artboard} />
                <Button
                  slot="drag"
                  variant="quiet"
                  className="file-overlay file-drag drag-handle"
                  aria-label={`Reorder ${label}`}
                >
                  ⋮⋮
                </Button>
                {busyIds.has(artboard.id) && (
                  <span
                    className="spinner"
                    role="img"
                    aria-label="Removing background"
                  />
                )}
                <MenuTrigger>
                  <Button
                    variant="quiet"
                    className="file-overlay file-more"
                    aria-label={`More for ${label}`}
                  >
                    <MoreIcon />
                  </Button>
                  <Popover
                    className="menu-popover file-popover"
                    placement="bottom start"
                  >
                    <Menu
                      aria-label={label}
                      onAction={(action) => {
                        if (action === "duplicate") onDuplicate(artboard.id);
                        if (action === "delete") setDeleting(artboard);
                      }}
                    >
                      <MenuItem id="duplicate">Duplicate</MenuItem>
                      <MenuItem id="delete">Delete…</MenuItem>
                    </Menu>
                  </Popover>
                </MenuTrigger>
              </GridListItem>
            );
          }}
        </GridList>
        <Button className="file-new" aria-label="New artboard" onPress={onNew}>
          <PlusIcon />
        </Button>
      </div>
      <DeleteDialog
        artboard={deleting}
        onClose={() => setDeleting(null)}
        onDelete={onDelete}
      />
    </div>
  );
}

function DeleteDialog({
  artboard,
  onClose,
  onDelete,
}: {
  artboard: ArtboardSummary | null;
  onClose: () => void;
  onDelete: (id: string) => void;
}) {
  return (
    <ModalOverlay
      className="modal-overlay"
      isDismissable
      isOpen={artboard !== null}
      onOpenChange={(isOpen) => !isOpen && onClose()}
    >
      <Modal className="modal confirm-window">
        <Dialog className="confirm" role="alertdialog">
          {artboard && (
            <>
              <Heading slot="title">Delete artboard?</Heading>
              <div className="confirm-preview">
                <Thumbnail artboard={artboard} />
              </div>
              <p>This can’t be undone.</p>
              <div className="confirm-actions">
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
              </div>
            </>
          )}
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}

import { useEffect, useState } from "react";
import { MenuTrigger, useDragAndDrop } from "react-aria-components";
import type { ArtboardSummary } from "../core/persistence";
import { reorder } from "../core/reorder";
import { themeById } from "../core/themes";
import styles from "./FileViewer.module.css";
import { Button } from "./ui/Button";
import { cx } from "./ui/cx";
import { Dialog, DialogActions, DialogHeading } from "./ui/Dialog";
import { DragHandle } from "./ui/DragHandle";
import { GridList, GridListItem } from "./ui/GridList";
import { MoreIcon, PlusIcon } from "./ui/icons";
import { Menu, MenuItem } from "./ui/Menu";
import { Popover } from "./ui/Popover";

export interface FileViewerProps {
  artboards: ArtboardSummary[];
  activeId: string;
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
    <img className={styles.thumb} src={url} alt="" draggable={false} />
  ) : (
    <span
      className={cx(styles.thumb, styles.placeholder)}
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
    // biome-ignore lint/a11y/noStaticElementInteractions: keys bubble up from the list's rows
    <div
      className={styles.scroll}
      data-own-keys
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
        className={styles.list}
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
            <GridListItem
              className={styles.item}
              id={artboard.id}
              textValue={label}
            >
              <Thumbnail artboard={artboard} />
              <DragHandle
                variant="overlay"
                className={cx(styles.corner, styles.drag)}
                aria-label={`Reorder ${label}`}
              />
              {busyIds.has(artboard.id) && (
                <span
                  className={styles.spinner}
                  role="img"
                  aria-label="Removing background"
                />
              )}
              <MenuTrigger>
                <Button
                  variant="overlay"
                  className={cx(styles.corner, styles.more)}
                  aria-label={`More for ${label}`}
                >
                  <MoreIcon />
                </Button>
                <Popover placement="bottom start">
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
      <Button className={styles.new} aria-label="New artboard" onPress={onNew}>
        <PlusIcon />
      </Button>
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
            <Thumbnail artboard={artboard} />
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

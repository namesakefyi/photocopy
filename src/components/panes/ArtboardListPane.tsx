import { useEffect, useState } from "react";
import { MenuTrigger, useDragAndDrop } from "react-aria-components";
import { canvasSize } from "../../core/canvasFormat";
import type { ArtboardSummary } from "../../core/persistence";
import { reorder } from "../../core/reorder";
import { themeById } from "../../core/themes";
import { useRemovals, useWorkspace } from "../../hooks/workspace/useWorkspace";
import { DeleteArtboardDialog } from "../dialogs/DeleteArtboardDialog";
import { Button } from "../ui/Button";
import { cx } from "../ui/cx";
import { GridList, GridListDragHandle, GridListItem } from "../ui/GridList";
import { MoreIcon, PlusIcon } from "../ui/icons";
import { Menu, MenuItem } from "../ui/Menu";
import { Popover } from "../ui/Popover";
import styles from "./ArtboardListPane.module.css";

export function ArtboardThumbnail({ artboard }: { artboard: ArtboardSummary }) {
  const { width, height } = canvasSize(artboard.canvasFormat);
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
      className={styles.thumb}
      style={{
        aspectRatio: `${width} / ${height}`,
        background: themeById(artboard.backgroundId).color,
      }}
    />
  );
}

export function ArtboardListPane() {
  const {
    artboards,
    activeId,
    openArtboard,
    createArtboard,
    duplicateArtboard,
    deleteArtboard,
    reorderArtboards,
  } = useWorkspace();
  const { busyIds } = useRemovals();
  const [deleting, setDeleting] = useState<ArtboardSummary | null>(null);
  const labels = new Map(
    artboards.map((artboard, index) => [artboard.id, `Artboard ${index + 1}`]),
  );

  const { dragAndDropHooks } = useDragAndDrop({
    isDisabled: artboards.length < 2,
    getItems: (keys) => [...keys].map((key) => ({ "text/plain": String(key) })),
    onReorder: ({ keys, target }) =>
      reorderArtboards(
        reorder(
          artboards.map((artboard) => artboard.id),
          keys,
          target,
        ),
      ),
  });

  return (
    <>
      <GridList
        aria-label="Artboards"
        className={styles.list}
        // The editor leaves keys pressed here alone.
        data-own-keys
        items={artboards}
        selectionMode="single"
        selectionBehavior="replace"
        disallowEmptySelection
        selectedKeys={[activeId]}
        onSelectionChange={(keys) => {
          const [key] = keys;
          if (key !== undefined) openArtboard(String(key));
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
              <ArtboardThumbnail artboard={artboard} />
              <GridListDragHandle label={`Reorder ${label}`} />
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
                <Popover placement="end top">
                  <Menu
                    aria-label={label}
                    onAction={(action) => {
                      if (action === "duplicate")
                        duplicateArtboard(artboard.id);
                      if (action === "delete") setDeleting(artboard);
                    }}
                  >
                    <MenuItem id="duplicate">Duplicate Artboard</MenuItem>
                    <MenuItem id="delete">Delete Artboard…</MenuItem>
                  </Menu>
                </Popover>
              </MenuTrigger>
            </GridListItem>
          );
        }}
      </GridList>
      <Button size="large" className={styles.new} onPress={createArtboard}>
        <PlusIcon />
        New
      </Button>
      <DeleteArtboardDialog
        artboard={deleting}
        onClose={() => setDeleting(null)}
        onDelete={deleteArtboard}
      />
    </>
  );
}

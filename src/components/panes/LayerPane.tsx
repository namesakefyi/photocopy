import { memo, useEffect, useRef, useState } from "react";
import { Input, MenuTrigger, useDragAndDrop } from "react-aria-components";
import { reorder } from "../../core/reorder";
import type { LayerEntry } from "../../core/types";
import { useEditor } from "../../hooks/editor/useEditor";
import { Button } from "../ui/Button";
import { cx } from "../ui/cx";
import { GridList, GridListDragHandle, GridListItem } from "../ui/GridList";
import { EyeClosedIcon, EyeIcon, PlusIcon } from "../ui/icons";
import inputStyles from "../ui/input.module.css";
import { Menu, MenuItem } from "../ui/Menu";
import { Popover } from "../ui/Popover";
import styles from "./LayerPane.module.css";
import { Section, SectionBody, SectionHeader } from "./shared/Section";

export interface LayerPaneProps {
  layers: LayerEntry[];
  selectedId: string | null;
}

export const LayerPane = memo(function LayerPane({
  layers,
  selectedId,
}: LayerPaneProps) {
  const editor = useEditor();
  const { dispatch } = editor;
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const topFirst = [...layers].reverse();

  const { dragAndDropHooks } = useDragAndDrop({
    isDisabled: renamingId !== null,
    getItems: (keys) => [...keys].map((key) => ({ "text/plain": String(key) })),
    onReorder: ({ keys, target }) => {
      const order = reorder(
        topFirst.map((layer) => layer.id),
        keys,
        target,
      );
      dispatch({ type: "reorderLayers", ids: order.reverse() });
    },
  });

  return (
    <Section>
      <SectionHeader title="Layers">
        <MenuTrigger>
          <Button variant="quiet" aria-label="Add layer">
            <PlusIcon />
          </Button>
          <Popover placement="bottom end">
            <Menu aria-label="Add layer">
              <MenuItem onAction={editor.openUpload}>Upload Image…</MenuItem>
              <MenuItem onAction={editor.openSearch}>
                Search for Images…
              </MenuItem>
            </Menu>
          </Popover>
        </MenuTrigger>
      </SectionHeader>
      <SectionBody>
        <GridList
          aria-label="Layers"
          className={styles.layerList}
          items={topFirst}
          dependencies={[renamingId]}
          selectionMode="single"
          selectionBehavior="replace"
          onAction={(key) => setRenamingId(String(key))}
          selectedKeys={selectedId ? [selectedId] : []}
          onSelectionChange={(keys) => {
            const [key] = keys;
            dispatch({
              type: "select",
              id: key === undefined ? null : String(key),
            });
          }}
          dragAndDropHooks={dragAndDropHooks}
          renderEmptyState={() => <p className={styles.empty}>No layers yet</p>}
        >
          {(layer) => (
            <GridListItem
              className={styles.item}
              id={layer.id}
              textValue={layer.name}
            >
              <GridListDragHandle label={`Reorder ${layer.name}`} />
              {renamingId === layer.id ? (
                <NameInput
                  name={layer.name}
                  onDone={(name) => {
                    setRenamingId(null);
                    if (name && name !== layer.name) {
                      dispatch({
                        type: "updateLayer",
                        id: layer.id,
                        changes: { name },
                      });
                    }
                  }}
                />
              ) : (
                <span
                  className={styles.name}
                  data-hidden={!layer.visible || undefined}
                >
                  {layer.name}
                </span>
              )}
              <Button
                variant="quiet"
                aria-label={
                  layer.visible ? `Hide ${layer.name}` : `Show ${layer.name}`
                }
                onPress={() =>
                  dispatch({
                    type: "updateLayer",
                    id: layer.id,
                    changes: { visible: !layer.visible },
                  })
                }
              >
                {layer.visible ? <EyeIcon /> : <EyeClosedIcon />}
              </Button>
            </GridListItem>
          )}
        </GridList>
      </SectionBody>
    </Section>
  );
});

function NameInput({
  name,
  onDone,
}: {
  name: string;
  onDone: (name: string | null) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const isCancelled = useRef(false);

  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);

  const leave = () =>
    ref.current?.closest<HTMLElement>('[role="row"]')?.focus();

  return (
    <Input
      ref={ref}
      aria-label="Layer name"
      className={cx(inputStyles.input, styles.nameInput)}
      defaultValue={name}
      onBlur={(event) =>
        onDone(isCancelled.current ? null : event.target.value.trim())
      }
      // The list reads arrows, Space and letters as its own; the field needs them.
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === "Escape") {
          isCancelled.current = true;
          leave();
        } else if (event.key === "Enter") {
          leave();
        }
      }}
    />
  );
}

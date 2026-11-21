import { memo } from "react";
import { GridList, GridListItem, useDragAndDrop } from "react-aria-components";
import { reorder } from "../core/reorder";
import type { Layer } from "../core/types";
import { useEditor } from "../hooks/useEditor";
import styles from "./LayerList.module.css";
import { Button } from "./ui/Button";
import { cx } from "./ui/cx";
import { EyeClosedIcon, EyeIcon } from "./ui/icons";
import listStyles from "./ui/list.module.css";

export interface LayerListProps {
  layers: Layer[];
  selectedId: string | null;
}

/** Lists layers top-first, like a stack of paper seen from above. */
export const LayerList = memo(function LayerList({
  layers,
  selectedId,
}: LayerListProps) {
  const { dispatch } = useEditor();
  const topFirst = [...layers].reverse();

  const { dragAndDropHooks } = useDragAndDrop({
    getItems: (keys) => [...keys].map((key) => ({ "text/plain": String(key) })),
    onReorder: ({ keys, target }) => {
      const byId = new Map(layers.map((layer) => [layer.id, layer]));
      const order = reorder(
        topFirst.map((layer) => layer.id),
        keys,
        target,
      );
      dispatch({
        type: "reorderLayers",
        layers: order.reverse().map((id) => byId.get(id) as Layer),
      });
    },
  });

  if (layers.length === 0) return null;

  return (
    <GridList
      aria-label="Layers"
      className={cx(listStyles.list, styles.layerList)}
      items={topFirst}
      selectionMode="single"
      selectedKeys={selectedId ? [selectedId] : []}
      onSelectionChange={(keys) => {
        const [key] = keys;
        dispatch({
          type: "select",
          id: key === undefined ? null : String(key),
        });
      }}
      dragAndDropHooks={dragAndDropHooks}
    >
      {(layer) => (
        <GridListItem
          className={cx(listStyles.item, styles.item)}
          id={layer.id}
          textValue={layer.name}
        >
          <Button
            slot="drag"
            variant="quiet"
            className={styles.dragHandle}
            aria-label="Reorder"
          >
            ⋮⋮
          </Button>
          <span
            className={styles.name}
            data-hidden={!layer.visible || undefined}
          >
            {layer.name}
          </span>
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
  );
});

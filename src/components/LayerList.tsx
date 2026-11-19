import { GridList, GridListItem, useDragAndDrop } from "react-aria-components";
import { reorder } from "../reorder";
import type { Layer } from "../types";
import { Button } from "./ui/Button";
import { EyeClosedIcon, EyeIcon } from "./ui/icons";

export interface LayerListProps {
  layers: Layer[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onReorder: (layers: Layer[]) => void;
  onToggleVisible: (layer: Layer) => void;
}

/** Lists layers top-first, like a stack of paper seen from above. */
export function LayerList({
  layers,
  selectedId,
  onSelect,
  onReorder,
  onToggleVisible,
}: LayerListProps) {
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
      onReorder(order.reverse().map((id) => byId.get(id) as Layer));
    },
  });

  if (layers.length === 0) return null;

  return (
    <GridList
      aria-label="Layers"
      className="layer-list"
      items={topFirst}
      selectionMode="single"
      selectedKeys={selectedId ? [selectedId] : []}
      onSelectionChange={(keys) => {
        const [key] = keys;
        onSelect(key === undefined ? null : String(key));
      }}
      dragAndDropHooks={dragAndDropHooks}
    >
      {(layer) => (
        <GridListItem id={layer.id} textValue={layer.name}>
          <Button
            slot="drag"
            variant="quiet"
            className="drag-handle"
            aria-label="Reorder"
          >
            ⋮⋮
          </Button>
          <span
            className="layer-name"
            data-hidden={!layer.visible || undefined}
          >
            {layer.name}
          </span>
          <Button
            variant="quiet"
            aria-label={
              layer.visible ? `Hide ${layer.name}` : `Show ${layer.name}`
            }
            onPress={() => onToggleVisible(layer)}
          >
            {layer.visible ? <EyeIcon /> : <EyeClosedIcon />}
          </Button>
        </GridListItem>
      )}
    </GridList>
  );
}

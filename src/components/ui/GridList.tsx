import {
  GridList as AriaGridList,
  GridListItem as AriaGridListItem,
} from "react-aria-components";
import { Button } from "./Button";
import { withClassName } from "./cx";
import styles from "./GridList.module.css";

export const GridList = withClassName(AriaGridList, styles.list);
export const GridListItem = withClassName(AriaGridListItem, styles.item);

/** The row's reorder handle, out in the list's side padding. */
export function GridListDragHandle({ label }: { label: string }) {
  return (
    <Button
      slot="drag"
      variant="quiet"
      className={styles.dragHandle}
      aria-label={label}
    >
      ⋮⋮
    </Button>
  );
}

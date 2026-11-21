import {
  GridList as AriaGridList,
  GridListItem as AriaGridListItem,
  type GridListItemProps as AriaGridListItemProps,
  type GridListProps as AriaGridListProps,
} from "react-aria-components";
import { cx } from "./cx";
import styles from "./GridList.module.css";

/** A list of selectable, reorderable rows. */
export function GridList<T extends object>({
  className,
  ...props
}: Omit<AriaGridListProps<T>, "className"> & { className?: string }) {
  return <AriaGridList {...props} className={cx(styles.list, className)} />;
}

export function GridListItem<T extends object>({
  className,
  ...props
}: Omit<AriaGridListItemProps<T>, "className"> & { className?: string }) {
  return <AriaGridListItem {...props} className={cx(styles.item, className)} />;
}

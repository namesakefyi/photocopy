import {
  GridList as AriaGridList,
  GridListItem as AriaGridListItem,
} from "react-aria-components";
import { withClassName } from "./cx";
import styles from "./GridList.module.css";

export const GridList = withClassName(AriaGridList, styles.list);
export const GridListItem = withClassName(AriaGridListItem, styles.item);

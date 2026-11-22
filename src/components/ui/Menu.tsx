import {
  Menu as AriaMenu,
  MenuItem as AriaMenuItem,
  Separator as AriaSeparator,
} from "react-aria-components";
import { withClassName } from "./cx";
import styles from "./Menu.module.css";

export const Menu = withClassName(AriaMenu, styles.menu);
export const MenuItem = withClassName(AriaMenuItem, styles.item);
export const MenuSeparator = withClassName(AriaSeparator, styles.separator);

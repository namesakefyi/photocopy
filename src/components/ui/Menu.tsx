import {
  Menu as AriaMenu,
  MenuItem as AriaMenuItem,
} from "react-aria-components";
import { withClassName } from "./cx";
import styles from "./Menu.module.css";

export const Menu = withClassName(AriaMenu, styles.menu);
export const MenuItem = withClassName(AriaMenuItem, styles.item);

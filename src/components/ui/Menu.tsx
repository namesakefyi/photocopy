import {
  Menu as AriaMenu,
  MenuItem as AriaMenuItem,
  type MenuItemProps as AriaMenuItemProps,
  type MenuProps as AriaMenuProps,
} from "react-aria-components";
import styles from "./Menu.module.css";

export function Menu<T extends object>(
  props: Omit<AriaMenuProps<T>, "className">,
) {
  return <AriaMenu {...props} className={styles.menu} />;
}

export function MenuItem<T extends object>(
  props: Omit<AriaMenuItemProps<T>, "className">,
) {
  return <AriaMenuItem {...props} className={styles.item} />;
}

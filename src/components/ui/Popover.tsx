import { Popover as AriaPopover } from "react-aria-components";
import { withClassName } from "./cx";
import styles from "./Popover.module.css";

export const Popover = withClassName(AriaPopover, styles.popover);

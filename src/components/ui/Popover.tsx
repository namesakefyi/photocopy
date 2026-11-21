import {
  Popover as AriaPopover,
  type PopoverProps as AriaPopoverProps,
} from "react-aria-components";
import { cx } from "./cx";
import styles from "./Popover.module.css";

export interface PopoverProps extends Omit<AriaPopoverProps, "className"> {
  className?: string;
}

export function Popover({ className, ...props }: PopoverProps) {
  return <AriaPopover {...props} className={cx(styles.popover, className)} />;
}

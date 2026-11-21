import { Button, type ButtonVariant } from "./Button";
import { cx } from "./cx";
import styles from "./DragHandle.module.css";

export interface DragHandleProps {
  "aria-label": string;
  variant?: ButtonVariant;
  className?: string;
}

/** Drags its row to reorder a list; also reorders by keyboard. */
export function DragHandle({
  variant = "quiet",
  className,
  ...props
}: DragHandleProps) {
  return (
    <Button
      {...props}
      slot="drag"
      variant={variant}
      className={cx(styles.handle, className)}
    >
      ⋮⋮
    </Button>
  );
}

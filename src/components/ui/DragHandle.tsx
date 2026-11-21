import { Button, type ButtonProps } from "./Button";
import styles from "./Button.module.css";
import { cx } from "./cx";

export function DragHandle({
  variant = "quiet",
  className,
  ...props
}: Omit<ButtonProps, "slot" | "children" | "className"> & {
  className?: string;
}) {
  return (
    <Button
      {...props}
      slot="drag"
      variant={variant}
      className={cx(styles.dragHandle, className)}
    >
      ⋮⋮
    </Button>
  );
}

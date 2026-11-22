import {
  Button as AriaButton,
  type ButtonProps as AriaButtonProps,
  composeRenderProps,
} from "react-aria-components";
import styles from "./Button.module.css";
import { cx } from "./cx";

export type ButtonVariant =
  | "default"
  | "primary"
  | "quiet"
  | "toolbar"
  | "icon"
  | "overlay";

export function buttonClassName(
  variant: ButtonVariant,
  className?: string,
  size?: "large",
): string {
  return cx(styles.base, styles[variant], size && styles[size], className);
}

export function Chevron() {
  return (
    <span className={styles.chevron} aria-hidden="true">
      ▾
    </span>
  );
}

export interface ButtonProps extends AriaButtonProps {
  variant?: ButtonVariant;
  size?: "large";
}

export function Button({
  variant = "default",
  size,
  className,
  ...props
}: ButtonProps) {
  return (
    <AriaButton
      {...props}
      className={composeRenderProps(className, (className) =>
        buttonClassName(variant, className, size),
      )}
    />
  );
}

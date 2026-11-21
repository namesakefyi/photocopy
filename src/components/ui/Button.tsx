import {
  Button as AriaButton,
  type ButtonProps as AriaButtonProps,
  composeRenderProps,
} from "react-aria-components";
import styles from "./Button.module.css";
import { cx } from "./cx";

export type ButtonSize = "default" | "large";

export type ButtonVariant =
  | "default"
  | "primary"
  | "quiet"
  | "toolbar"
  | "icon"
  | "overlay";

const VARIANTS: Record<ButtonVariant, string> = {
  default: cx(styles.base, styles.default),
  primary: cx(styles.base, styles.default, styles.primary),
  quiet: cx(styles.base, styles.subtle, styles.quiet),
  toolbar: cx(styles.base, styles.subtle, styles.toolbar),
  icon: cx(styles.base, styles.subtle, styles.toolbar, styles.icon),
  overlay: cx(styles.base, styles.overlay),
};

/** A variant's classes, for elements styled as buttons, like a download link. */
export function buttonClassName(
  variant: ButtonVariant,
  className?: string,
  size: ButtonSize = "default",
): string {
  return cx(VARIANTS[variant], size === "large" && styles.large, className);
}

/** The ▾ after a button's text, for those that open a menu. */
export function Chevron() {
  return (
    <span className={styles.chevron} aria-hidden="true">
      ▾
    </span>
  );
}

export interface ButtonProps extends AriaButtonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
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

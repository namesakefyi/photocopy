import {
  Button,
  type ButtonProps,
  Keyboard,
  ToggleButton,
  type ToggleButtonProps,
  Tooltip,
  TooltipTrigger,
} from "react-aria-components";
import { buttonClassName } from "./Button";
import styles from "./ToolButton.module.css";

interface ToolTipProps {
  /** The accessible name, also shown in the tooltip. */
  label: string;
  shortcut?: string;
}

function ToolTip({ label, shortcut }: ToolTipProps) {
  return (
    <Tooltip className={styles.tooltip} offset={6}>
      {label}
      {shortcut && <Keyboard className={styles.shortcut}>{shortcut}</Keyboard>}
    </Tooltip>
  );
}

export function ToolButton({
  label,
  shortcut,
  className,
  children,
  ...props
}: Omit<ButtonProps, "className"> & ToolTipProps & { className?: string }) {
  return (
    <TooltipTrigger delay={400} closeDelay={0}>
      <Button
        {...props}
        aria-label={label}
        className={buttonClassName("icon", className)}
      >
        {children}
      </Button>
      <ToolTip label={label} shortcut={shortcut} />
    </TooltipTrigger>
  );
}

export function ToolToggleButton({
  label,
  shortcut,
  hasText = false,
  children,
  ...props
}: Omit<ToggleButtonProps, "className"> &
  ToolTipProps & { hasText?: boolean }) {
  return (
    <TooltipTrigger delay={400} closeDelay={0}>
      <ToggleButton
        {...props}
        aria-label={label}
        className={buttonClassName(hasText ? "toolbar" : "icon")}
      >
        {children}
      </ToggleButton>
      <ToolTip label={label} shortcut={shortcut} />
    </TooltipTrigger>
  );
}

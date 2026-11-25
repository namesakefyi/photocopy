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

function WithTooltip({
  label,
  shortcut,
  children,
}: ToolTipProps & { children: React.ReactNode }) {
  return (
    <TooltipTrigger delay={400} closeDelay={0}>
      {children}
      <Tooltip className={styles.tooltip} offset={6}>
        {label}
        {shortcut && (
          <Keyboard className={styles.shortcut}>{shortcut}</Keyboard>
        )}
      </Tooltip>
    </TooltipTrigger>
  );
}

export function ToolButton({
  label,
  shortcut,
  className,
  ...props
}: Omit<ButtonProps, "className"> & ToolTipProps & { className?: string }) {
  return (
    <WithTooltip label={label} shortcut={shortcut}>
      <Button
        {...props}
        aria-label={label}
        className={buttonClassName("icon", className)}
      />
    </WithTooltip>
  );
}

export function ToolToggleButton({
  label,
  shortcut,
  hasText = false,
  className,
  ...props
}: Omit<ToggleButtonProps, "className"> &
  ToolTipProps & { hasText?: boolean; className?: string }) {
  return (
    <WithTooltip label={label} shortcut={shortcut}>
      <ToggleButton
        {...props}
        aria-label={label}
        className={buttonClassName(hasText ? "toolbar" : "icon", className)}
      />
    </WithTooltip>
  );
}

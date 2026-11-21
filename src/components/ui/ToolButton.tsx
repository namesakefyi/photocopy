import {
  Button,
  type ButtonProps,
  Keyboard,
  ToggleButton,
  type ToggleButtonProps,
  Tooltip,
  TooltipTrigger,
} from "react-aria-components";

interface ToolTipProps {
  /** The accessible name, also shown in the tooltip. */
  label: string;
  shortcut?: string;
}

function ToolTip({ label, shortcut }: ToolTipProps) {
  return (
    <Tooltip className="tooltip" offset={6}>
      {label}
      {shortcut && <Keyboard className="shortcut">{shortcut}</Keyboard>}
    </Tooltip>
  );
}

/** An icon-only button that shows its name and shortcut on hover. */
export function ToolButton({
  label,
  shortcut,
  children,
  ...props
}: ButtonProps & ToolTipProps) {
  return (
    <TooltipTrigger delay={400} closeDelay={0}>
      <Button {...props} aria-label={label} className="toolbar-button icon">
        {children}
      </Button>
      <ToolTip label={label} shortcut={shortcut} />
    </TooltipTrigger>
  );
}

/** A toggle ToolButton, also for ToggleButtonGroups; `hasText` shows its label too. */
export function ToolToggleButton({
  label,
  shortcut,
  hasText = false,
  children,
  ...props
}: ToggleButtonProps & ToolTipProps & { hasText?: boolean }) {
  return (
    <TooltipTrigger delay={400} closeDelay={0}>
      <ToggleButton
        {...props}
        aria-label={label}
        className={hasText ? "toolbar-button" : "toolbar-button icon"}
      >
        {children}
      </ToggleButton>
      <ToolTip label={label} shortcut={shortcut} />
    </TooltipTrigger>
  );
}

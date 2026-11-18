import {
  Button as AriaButton,
  type ButtonProps as AriaButtonProps,
  composeRenderProps,
} from "react-aria-components";

export interface ButtonProps extends AriaButtonProps {
  variant?: "default" | "primary" | "quiet";
}

export function Button({
  variant = "default",
  className,
  ...props
}: ButtonProps) {
  return (
    <AriaButton
      {...props}
      className={composeRenderProps(className, (className) =>
        ["button", variant, className].filter(Boolean).join(" "),
      )}
    />
  );
}

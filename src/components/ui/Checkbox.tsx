import {
  Checkbox as AriaCheckbox,
  type CheckboxProps as AriaCheckboxProps,
} from "react-aria-components";

export interface CheckboxProps extends Omit<AriaCheckboxProps, "children"> {
  children: React.ReactNode;
}

export function Checkbox({ children, ...props }: CheckboxProps) {
  return (
    <AriaCheckbox {...props} className="checkbox">
      <span className="checkbox-box" aria-hidden="true">
        <svg viewBox="0 0 12 12">
          <path d="M2.5 6.5 5 9l4.5-6" />
        </svg>
      </span>
      {children}
    </AriaCheckbox>
  );
}

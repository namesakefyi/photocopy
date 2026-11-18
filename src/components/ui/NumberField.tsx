import {
  NumberField as AriaNumberField,
  type NumberFieldProps as AriaNumberFieldProps,
  Group,
  Input,
  Label,
} from "react-aria-components";

export interface NumberFieldProps extends AriaNumberFieldProps {
  /** Visible label; pass `aria-label` instead to hide it. */
  label?: string;
  /** A short marker inside the field, before the number, like "W". */
  prefix?: string;
}

export function NumberField({ label, prefix, ...props }: NumberFieldProps) {
  return (
    <AriaNumberField {...props} className="number-field">
      {label && <Label>{label}</Label>}
      <Group>
        {prefix && (
          <span className="number-prefix" aria-hidden="true">
            {prefix}
          </span>
        )}
        <Input />
      </Group>
    </AriaNumberField>
  );
}

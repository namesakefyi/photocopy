import {
  NumberField as AriaNumberField,
  type NumberFieldProps as AriaNumberFieldProps,
  Group,
  Input,
  Label,
} from "react-aria-components";

export interface NumberFieldProps extends AriaNumberFieldProps {
  label: string;
}

export function NumberField({ label, ...props }: NumberFieldProps) {
  return (
    <AriaNumberField {...props} className="number-field">
      <Label>{label}</Label>
      <Group>
        <Input />
      </Group>
    </AriaNumberField>
  );
}

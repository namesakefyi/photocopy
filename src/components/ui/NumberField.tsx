import {
  NumberField as AriaNumberField,
  type NumberFieldProps as AriaNumberFieldProps,
  Group,
  Input,
  Label,
} from "react-aria-components";
import { cx } from "./cx";
import inputStyles from "./input.module.css";
import styles from "./NumberField.module.css";

export interface NumberFieldProps extends AriaNumberFieldProps {
  /** Visible label; pass `aria-label` instead to hide it. */
  label?: string;
  /** A short marker inside the field, before the number, like "W". */
  prefix?: string;
}

export function NumberField({ label, prefix, ...props }: NumberFieldProps) {
  return (
    <AriaNumberField {...props} className={styles.numberField}>
      {label && <Label className={styles.label}>{label}</Label>}
      <Group className={styles.group}>
        {prefix && (
          <span className={styles.prefix} aria-hidden="true">
            {prefix}
          </span>
        )}
        <Input className={cx(inputStyles.input, prefix && styles.prefixed)} />
      </Group>
    </AriaNumberField>
  );
}

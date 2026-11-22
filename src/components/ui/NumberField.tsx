import {
  NumberField as AriaNumberField,
  type NumberFieldProps as AriaNumberFieldProps,
  Group,
  Input,
} from "react-aria-components";
import { cx } from "./cx";
import inputStyles from "./input.module.css";
import styles from "./NumberField.module.css";

export interface NumberFieldProps extends AriaNumberFieldProps {
  /** A short marker inside the field, before the number, like "W". */
  prefix: string;
}

export function NumberField({ prefix, ...props }: NumberFieldProps) {
  return (
    <AriaNumberField {...props} className={styles.numberField}>
      <Group className={styles.group}>
        <span className={styles.prefix} aria-hidden="true">
          {prefix}
        </span>
        <Input className={cx(inputStyles.input, styles.input)} />
      </Group>
    </AriaNumberField>
  );
}

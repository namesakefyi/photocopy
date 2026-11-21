import {
  SearchField as AriaSearchField,
  type SearchFieldProps as AriaSearchFieldProps,
  Input,
} from "react-aria-components";
import { cx } from "./cx";
import inputStyles from "./input.module.css";
import styles from "./SearchField.module.css";

export interface SearchFieldProps
  extends Omit<AriaSearchFieldProps, "className"> {
  placeholder?: string;
  className?: string;
}

export function SearchField({
  placeholder,
  className,
  ...props
}: SearchFieldProps) {
  return (
    <AriaSearchField {...props} className={cx(styles.field, className)}>
      <Input
        className={cx(inputStyles.input, styles.input)}
        placeholder={placeholder}
      />
    </AriaSearchField>
  );
}

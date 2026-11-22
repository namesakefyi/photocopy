import {
  SearchField as AriaSearchField,
  Input,
  type SearchFieldProps,
} from "react-aria-components";
import { cx } from "./cx";
import styles from "./input.module.css";

export function SearchField({
  placeholder,
  className,
  ...props
}: Omit<SearchFieldProps, "className"> & {
  placeholder?: string;
  className?: string;
}) {
  return (
    <AriaSearchField {...props} className={cx(styles.search, className)}>
      <Input className={styles.input} placeholder={placeholder} />
    </AriaSearchField>
  );
}

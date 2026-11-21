import {
  Select as AriaSelect,
  Button,
  Label,
  ListBox,
  ListBoxItem,
  SelectValue,
} from "react-aria-components";
import { Chevron } from "./Button";
import buttonStyles from "./Button.module.css";
import { cx } from "./cx";
import fieldStyles from "./field.module.css";
import { Popover } from "./Popover";
import styles from "./Select.module.css";

export interface SelectProps<Item extends { id: string }> {
  /** `compact` for section headings (text only); `field` is full-width with icons. */
  variant: "compact" | "field";
  /** Shown above a field; the accessible name for a compact one. */
  label: string;
  items: Item[];
  selectedKey: string;
  onSelectionChange: (id: string) => void;
  /** The option's text, also used for typeahead and screen readers. */
  textOf: (item: Item) => string;
  /** Shown before the text, like a color swatch or shape. */
  iconOf?: (item: Item) => React.ReactNode;
}

export function Select<Item extends { id: string }>({
  variant,
  label,
  items,
  selectedKey,
  onSelectionChange,
  textOf,
  iconOf,
}: SelectProps<Item>) {
  const isCompact = variant === "compact";
  return (
    <AriaSelect
      aria-label={isCompact ? label : undefined}
      className={isCompact ? undefined : fieldStyles.field}
      selectedKey={selectedKey}
      onSelectionChange={(key) => {
        if (key !== null) onSelectionChange(String(key));
      }}
    >
      {!isCompact && <Label className={fieldStyles.label}>{label}</Label>}
      <Button
        className={
          isCompact
            ? cx(
                buttonStyles.base,
                buttonStyles.subtle,
                styles.trigger,
                styles.compact,
              )
            : cx(buttonStyles.base, styles.trigger, styles.field)
        }
      >
        {isCompact ? (
          <SelectValue>{({ selectedText }) => selectedText}</SelectValue>
        ) : (
          <SelectValue className={styles.value} />
        )}
        <Chevron />
      </Button>
      <Popover
        className={styles.popover}
        placement={isCompact ? "bottom end" : "bottom start"}
      >
        <ListBox className={styles.listBox} items={items}>
          {(item) => (
            <ListBoxItem
              className={styles.item}
              id={item.id}
              textValue={textOf(item)}
            >
              <span className={styles.option}>
                {iconOf?.(item)}
                {textOf(item)}
              </span>
            </ListBoxItem>
          )}
        </ListBox>
      </Popover>
    </AriaSelect>
  );
}

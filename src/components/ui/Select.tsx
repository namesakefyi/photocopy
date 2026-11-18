import {
  Select as AriaSelect,
  Button,
  Label,
  ListBox,
  ListBoxItem,
  Popover,
  SelectValue,
} from "react-aria-components";

export interface SelectProps<Item extends { id: string }> {
  /**
   * `compact`: a small quiet dropdown for a section heading, showing only the
   * chosen option's text. `field`: a full-width, labelled dropdown showing the
   * whole option, icon included.
   */
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
      className={isCompact ? "compact-select" : "panel-select"}
      selectedKey={selectedKey}
      onSelectionChange={(key) => {
        if (key !== null) onSelectionChange(String(key));
      }}
    >
      {!isCompact && <Label className="field-label">{label}</Label>}
      <Button
        className={isCompact ? "compact-select-button" : "field-select-button"}
      >
        {isCompact ? (
          <SelectValue>{({ selectedText }) => selectedText}</SelectValue>
        ) : (
          <SelectValue />
        )}
        <span className="chevron" aria-hidden="true">
          ▾
        </span>
      </Button>
      <Popover
        className={isCompact ? "select-popover compact" : "select-popover"}
        placement={isCompact ? "bottom end" : "bottom start"}
      >
        <ListBox items={items}>
          {(item) => (
            <ListBoxItem id={item.id} textValue={textOf(item)}>
              <span className="select-option">
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

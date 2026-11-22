import { useState } from "react";
import { Keyboard, MenuTrigger, Text } from "react-aria-components";
import { hasCopiedLayer } from "../core/layerClipboard";
import { SHORTCUTS } from "../core/shortcuts";
import { useEditor } from "../hooks/useEditor";
import { Button } from "./ui/Button";
import { Menu, MenuItem, MenuSeparator } from "./ui/Menu";
import { Popover } from "./ui/Popover";

type EditAction = "undo" | "redo" | "cut" | "copy" | "paste";

const LABELS: Record<EditAction, string> = {
  undo: "Undo",
  redo: "Redo",
  cut: "Cut",
  copy: "Copy",
  paste: "Paste",
};

export interface EditMenuProps {
  canUndo: boolean;
  canRedo: boolean;
  /** Copy and cut need a selected layer. */
  canCopy: boolean;
  className?: string;
}

export function EditMenu({
  canUndo,
  canRedo,
  canCopy,
  className,
}: EditMenuProps) {
  const editor = useEditor();
  const [isOpen, setIsOpen] = useState(false);
  const disabled = [
    !canUndo && "undo",
    !canRedo && "redo",
    !canCopy && "cut",
    !canCopy && "copy",
    isOpen && !hasCopiedLayer() && "paste",
  ].filter((key): key is EditAction => key !== false);

  const item = (id: EditAction) => (
    <MenuItem id={id} textValue={LABELS[id]}>
      <Text slot="label">{LABELS[id]}</Text>
      <Keyboard>{SHORTCUTS[id]}</Keyboard>
    </MenuItem>
  );

  return (
    <MenuTrigger isOpen={isOpen} onOpenChange={setIsOpen}>
      <Button variant="toolbar" className={className}>
        Edit
      </Button>
      <Popover placement="bottom start">
        <Menu
          aria-label="Edit"
          disabledKeys={disabled}
          onAction={(key) => editor[key as EditAction]()}
        >
          {item("undo")}
          {item("redo")}
          <MenuSeparator />
          {item("cut")}
          {item("copy")}
          {item("paste")}
        </Menu>
      </Popover>
    </MenuTrigger>
  );
}

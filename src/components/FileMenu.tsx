import {
  Keyboard,
  MenuSection,
  MenuTrigger,
  Text,
} from "react-aria-components";
import { SHORTCUTS } from "../core/shortcuts";
import { useArtboardActions } from "../hooks/useArtboardActions";
import { useEditor } from "../hooks/useEditor";
import { ADD_IMAGE_ITEMS } from "./addImageItems";
import { Button } from "./ui/Button";
import { Menu, MenuItem, MenuSeparator } from "./ui/Menu";
import { Popover } from "./ui/Popover";

export interface FileMenuProps {
  canExport: boolean;
  className?: string;
}

export function FileMenu({ canExport, className }: FileMenuProps) {
  const editor = useEditor();
  const artboard = useArtboardActions();
  return (
    <MenuTrigger>
      <Button variant="toolbar" className={className}>
        File
      </Button>
      <Popover placement="bottom start">
        <Menu aria-label="File" disabledKeys={canExport ? [] : ["export"]}>
          <MenuSection aria-label="Artboard">
            <MenuItem onAction={artboard.newArtboard}>New Artboard</MenuItem>
            <MenuItem onAction={artboard.duplicateArtboard}>
              Duplicate Artboard
            </MenuItem>
          </MenuSection>
          <MenuSeparator />
          <MenuSection aria-label="Add images" items={ADD_IMAGE_ITEMS}>
            {(item) => (
              <MenuItem onAction={() => item.run(editor)}>
                {item.label}
              </MenuItem>
            )}
          </MenuSection>
          <MenuSeparator />
          <MenuItem
            id="export"
            textValue="Export…"
            onAction={editor.exportImage}
          >
            <Text slot="label">Export…</Text>
            <Keyboard>{SHORTCUTS.export}</Keyboard>
          </MenuItem>
          <MenuSeparator />
          <MenuItem onAction={artboard.deleteArtboard}>
            Delete Artboard…
          </MenuItem>
        </Menu>
      </Popover>
    </MenuTrigger>
  );
}

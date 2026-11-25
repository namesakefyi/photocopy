import { useState } from "react";
import {
  Keyboard,
  MenuSection,
  MenuTrigger,
  Text,
} from "react-aria-components";
import { SHORTCUTS } from "../../core/shortcuts";
import { useEditor } from "../../hooks/editor/useEditor";
import { useWorkspace } from "../../hooks/workspace/useWorkspace";
import { DeleteArtboardDialog } from "../dialogs/DeleteArtboardDialog";
import { Button } from "../ui/Button";
import { Menu, MenuItem, MenuSeparator } from "../ui/Menu";
import { Popover } from "../ui/Popover";

export interface FileMenuProps {
  className?: string;
}

export function FileMenu({ className }: FileMenuProps) {
  const editor = useEditor();
  const workspace = useWorkspace();
  const [isDeleting, setIsDeleting] = useState(false);
  return (
    <>
      <MenuTrigger>
        <Button variant="toolbar" className={className}>
          File
        </Button>
        <Popover placement="bottom start">
          <Menu
            aria-label="File"
            disabledKeys={editor.canExport ? [] : ["export"]}
          >
            <MenuSection aria-label="Artboard">
              <MenuItem onAction={workspace.createArtboard}>
                New Artboard
              </MenuItem>
              <MenuItem
                onAction={() => workspace.duplicateArtboard(workspace.activeId)}
              >
                Duplicate Artboard
              </MenuItem>
            </MenuSection>
            <MenuSeparator />
            <MenuSection aria-label="Add images">
              <MenuItem onAction={editor.openUpload}>Upload Image…</MenuItem>
              <MenuItem onAction={editor.openSearch}>
                Search for Images…
              </MenuItem>
            </MenuSection>
            <MenuSeparator />
            <MenuItem id="export" textValue="Export…" onAction={editor.export}>
              <Text slot="label">Export…</Text>
              <Keyboard>{SHORTCUTS.export}</Keyboard>
            </MenuItem>
            <MenuSeparator />
            <MenuItem onAction={() => setIsDeleting(true)}>
              Delete Artboard…
            </MenuItem>
          </Menu>
        </Popover>
      </MenuTrigger>
      <DeleteArtboardDialog
        artboard={isDeleting ? (workspace.activeArtboard ?? null) : null}
        onClose={() => setIsDeleting(false)}
        onDelete={workspace.deleteArtboard}
      />
    </>
  );
}

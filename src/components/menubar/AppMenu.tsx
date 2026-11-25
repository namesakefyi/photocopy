import { useState } from "react";
import { MenuTrigger } from "react-aria-components";
import { AboutDialog } from "../dialogs/AboutDialog";
import { Button } from "../ui/Button";
import { Menu, MenuItem, MenuSeparator } from "../ui/Menu";
import { Popover } from "../ui/Popover";

export interface AppMenuProps {
  className?: string;
}

export function AppMenu({ className }: AppMenuProps) {
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  return (
    <>
      <MenuTrigger>
        <Button variant="toolbar" className={className}>
          Photocopy
        </Button>
        <Popover placement="bottom start">
          <Menu aria-label="Photocopy">
            <MenuItem onAction={() => setIsAboutOpen(true)}>
              About Photocopy
            </MenuItem>
            <MenuSeparator />
            <MenuItem
              href="https://github.com/namesakefyi/photocopy"
              target="_blank"
              rel="noreferrer"
            >
              View on GitHub
            </MenuItem>
            <MenuItem
              href="https://github.com/namesakefyi/photocopy/issues"
              target="_blank"
              rel="noreferrer"
            >
              Report a Bug
            </MenuItem>
            <MenuItem
              href="https://namesake.fyi/donate"
              target="_blank"
              rel="noreferrer"
            >
              Donate to Namesake
            </MenuItem>
          </Menu>
        </Popover>
      </MenuTrigger>
      <AboutDialog isOpen={isAboutOpen} onOpenChange={setIsAboutOpen} />
    </>
  );
}

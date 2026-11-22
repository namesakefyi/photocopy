import {
  Keyboard,
  MenuSection,
  MenuTrigger,
  Text,
} from "react-aria-components";
import { SHORTCUTS } from "../core/shortcuts";
import type { ZoomAction } from "../core/zoom";
import { Button } from "./ui/Button";
import { Menu, MenuItem, MenuSeparator } from "./ui/Menu";
import { Popover } from "./ui/Popover";

const ZOOM_MENU: { id: ZoomAction; label: string }[] = [
  { id: "zoomIn", label: "Zoom In" },
  { id: "zoomOut", label: "Zoom Out" },
  { id: "zoomFit", label: "Zoom to Fit" },
  { id: "zoomActual", label: "Zoom to 100%" },
  { id: "zoomDouble", label: "Zoom to 200%" },
];

const ARTBOARDS = "artboards";

export interface ViewMenuProps {
  onZoom: (action: ZoomAction) => void;
  isArtboardListShown: boolean;
  onArtboardListShownChange: (isShown: boolean) => void;
  className?: string;
}

export function ViewMenu({
  onZoom,
  isArtboardListShown,
  onArtboardListShownChange,
  className,
}: ViewMenuProps) {
  return (
    <MenuTrigger>
      <Button variant="toolbar" className={className}>
        View
      </Button>
      <Popover placement="bottom start">
        <Menu
          aria-label="View"
          onAction={(key) =>
            key === ARTBOARDS
              ? onArtboardListShownChange(!isArtboardListShown)
              : onZoom(key as ZoomAction)
          }
        >
          <MenuItem id={ARTBOARDS}>
            {isArtboardListShown ? "Hide artboard list" : "Show artboard list"}
          </MenuItem>
          <MenuSeparator />
          <MenuSection>
            {ZOOM_MENU.map((item) => (
              <MenuItem key={item.id} id={item.id} textValue={item.label}>
                <Text slot="label">{item.label}</Text>
                <Keyboard>{SHORTCUTS[item.id]}</Keyboard>
              </MenuItem>
            ))}
          </MenuSection>
        </Menu>
      </Popover>
    </MenuTrigger>
  );
}

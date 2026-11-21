import { useSyncExternalStore } from "react";
import {
  Button,
  Keyboard,
  Menu,
  MenuItem,
  MenuTrigger,
  Popover,
  Text,
} from "react-aria-components";
import { SHORTCUTS } from "../core/shortcuts";
import type { ValueStore } from "../core/valueStore";
import type { ZoomAction } from "../core/zoom";

const ZOOM_MENU: { id: ZoomAction; label: string }[] = [
  { id: "zoomIn", label: "Zoom in" },
  { id: "zoomOut", label: "Zoom out" },
  { id: "zoomFit", label: "Zoom to fit" },
  { id: "zoomActual", label: "Zoom to 100%" },
  { id: "zoomDouble", label: "Zoom to 200%" },
];

export interface ZoomMenuProps {
  /** The canvas's scale; 1 is 100%. */
  zoom: ValueStore<number>;
  onZoom: (action: ZoomAction) => void;
}

export function ZoomMenu({ zoom, onZoom }: ZoomMenuProps) {
  const scale = useSyncExternalStore(zoom.subscribe, zoom.get);
  return (
    <MenuTrigger>
      <Button className="toolbar-button zoom-level" aria-label="Zoom">
        {Math.round(scale * 100)}%
        <span className="chevron" aria-hidden="true">
          ▾
        </span>
      </Button>
      <Popover className="menu-popover zoom-popover" placement="bottom start">
        <Menu
          aria-label="Zoom"
          items={ZOOM_MENU}
          onAction={(key) => onZoom(key as ZoomAction)}
        >
          {(item) => (
            <MenuItem id={item.id} textValue={item.label}>
              <Text slot="label" className="menu-label">
                {item.label}
              </Text>
              <Keyboard>{SHORTCUTS[item.id]}</Keyboard>
            </MenuItem>
          )}
        </Menu>
      </Popover>
    </MenuTrigger>
  );
}

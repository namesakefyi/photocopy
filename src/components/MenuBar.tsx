import type { Key } from "react-aria-components";
import {
  Button,
  Header,
  Keyboard,
  Menu,
  MenuItem,
  MenuSection,
  MenuTrigger,
  Popover,
  Separator,
  Text,
  Toolbar,
} from "react-aria-components";
import { CANVAS_PRESETS } from "../canvasFormat";
import { THEMES, type Theme } from "../themes";
import type { CanvasFormat, CanvasPreset, Tool } from "../types";
import { CanvasShape, simplifiedRatio } from "./CanvasShape";

export type MenuAction =
  | "undo"
  | "redo"
  | "upload"
  | "search"
  | "export"
  | "delete"
  | "deselect"
  | "removeBackground"
  | "crop"
  | "flipX"
  | "flipY"
  | "forward"
  | "back"
  | "brushLarger"
  | "brushSmaller";

export interface MenuBarProps extends Omit<LayerMenuProps, "onAction"> {
  canExport: boolean;
  canUndo: boolean;
  canRedo: boolean;
  /** Shown at the end of the bar, like background removal progress. */
  status: string | null;
  onAction: (action: MenuAction) => void;
  canvasFormat: CanvasFormat;
  onCanvasPreset: (preset: CanvasPreset) => void;
  /** Opens the width and height dialog for a custom canvas. */
  onCustomSize: () => void;
  theme: Theme;
  onTheme: (theme: Theme) => void;
  onAbout: () => void;
}

function Item({
  id,
  label,
  description,
  icon,
  shortcut,
  isDisabled,
  onAction,
}: {
  id: string;
  label: string;
  description?: string;
  icon?: React.ReactNode;
  shortcut?: string;
  isDisabled?: boolean;
  onAction?: () => void;
}) {
  return (
    <MenuItem
      id={id}
      textValue={label}
      isDisabled={isDisabled}
      onAction={onAction}
    >
      {({ isSelected, selectionMode }) => (
        <>
          {selectionMode !== "none" && (
            <span className="menu-check" aria-hidden="true">
              {isSelected ? "✓" : ""}
            </span>
          )}
          <Text slot="label" className="menu-label">
            {icon}
            {label}
            {description && (
              <span className="menu-description">{description}</span>
            )}
          </Text>
          {shortcut && <Keyboard>{shortcut}</Keyboard>}
        </>
      )}
    </MenuItem>
  );
}

function Swatch({ color }: { color: string | null }) {
  return (
    <span
      className="menu-swatch"
      data-transparent={color === null || undefined}
      style={color ? { background: color } : undefined}
      aria-hidden="true"
    />
  );
}

function TopMenu({
  label,
  className,
  disabledKeys,
  onAction,
  children,
}: {
  label: string;
  className?: string;
  disabledKeys?: Key[];
  onAction?: (key: Key) => void;
  children: React.ReactNode;
}) {
  return (
    <MenuTrigger>
      <Button
        className={["menubar-button", className].filter(Boolean).join(" ")}
      >
        {label}
      </Button>
      <Popover className="menu-popover" placement="bottom start" offset={2}>
        <Menu
          aria-label={label}
          disabledKeys={disabledKeys}
          onAction={onAction}
        >
          {children}
        </Menu>
      </Popover>
    </MenuTrigger>
  );
}

export interface LayerMenuProps {
  hasSelection: boolean;
  canRemoveBackground: boolean;
  canCrop: boolean;
  canBringForward: boolean;
  canSendBack: boolean;
  isRefining: boolean;
  tool: Tool;
  onAction: (action: MenuAction) => void;
  onRefining: (isRefining: boolean) => void;
  onTool: (tool: Tool) => void;
}

const IS_MAC = /Mac|iPhone|iPad/.test(navigator.platform);
const MOD = IS_MAC ? "⌘" : "Ctrl+";
const REDO_SHORTCUT = IS_MAC ? "⇧⌘Z" : "Ctrl+Shift+Z";

/** The Layer menu's items, shared by the menu bar and the canvas's right-click menu. */
export function LayerMenu({
  hasSelection,
  canRemoveBackground,
  canCrop,
  canBringForward,
  canSendBack,
  isRefining,
  tool,
  onAction,
  onRefining,
  onTool,
}: LayerMenuProps) {
  const act = (key: Key) => onAction(key as MenuAction);
  const disabledWhen = (entries: [string, boolean][]) =>
    entries.filter(([, isDisabled]) => isDisabled).map(([key]) => key);

  return (
    <Menu
      aria-label="Layer"
      onAction={(key) =>
        key === "toggleMask" ? onRefining(!isRefining) : act(key)
      }
      disabledKeys={disabledWhen([
        ["removeBackground", !canRemoveBackground],
        ["crop", !canCrop],
        ["toggleMask", !hasSelection],
        ["brushLarger", !hasSelection],
        ["brushSmaller", !hasSelection],
        ["flipX", !hasSelection],
        ["flipY", !hasSelection],
        ["forward", !canBringForward],
        ["back", !canSendBack],
      ])}
    >
      <Item id="removeBackground" label="Auto-Remove Background" />
      <Item id="crop" label="Crop to Fit" />
      <Separator />
      <Item id="toggleMask" label={isRefining ? "Hide Mask" : "Show Mask"} />
      <MenuSection
        selectionMode="single"
        selectedKeys={tool === "move" ? [] : [tool]}
        onSelectionChange={(keys) => {
          const [selected] = keys === "all" ? [] : [...keys];
          onTool(selected === undefined ? "move" : (selected as Tool));
        }}
      >
        {/* Sections with their own selection ignore the menu's disabledKeys. */}
        <Item
          id="erase"
          label="Add to Mask"
          shortcut="E"
          isDisabled={!hasSelection}
        />
        <Item
          id="restore"
          label="Subtract from Mask"
          shortcut="B"
          isDisabled={!hasSelection}
        />
      </MenuSection>
      <Item id="brushLarger" label="Larger Brush" shortcut="]" />
      <Item id="brushSmaller" label="Smaller Brush" shortcut="[" />
      <Separator />
      <Item id="flipX" label="Flip Horizontal" />
      <Item id="flipY" label="Flip Vertical" />
      <Separator />
      <Item id="forward" label="Bring Forward" shortcut={`${MOD}]`} />
      <Item id="back" label="Send Back" shortcut={`${MOD}[`} />
    </Menu>
  );
}

export function MenuBar({
  canExport,
  canUndo,
  canRedo,
  onAction,
  canvasFormat,
  onCanvasPreset,
  onCustomSize,
  theme,
  onTheme,
  onAbout,
  status,
  ...layerMenuProps
}: MenuBarProps) {
  const layerMenu = { ...layerMenuProps, onAction };
  const { hasSelection } = layerMenuProps;
  const act = (key: Key) => onAction(key as MenuAction);
  const disabledWhen = (entries: [string, boolean][]) =>
    entries.filter(([, isDisabled]) => isDisabled).map(([key]) => key);

  return (
    <header className="menubar">
      <Toolbar aria-label="Menu bar" className="menubar-menus">
        <TopMenu label="Copyshop" className="app-menu" onAction={onAbout}>
          <Item id="about" label="About Copyshop" />
        </TopMenu>
        <TopMenu
          label="File"
          onAction={act}
          disabledKeys={disabledWhen([["export", !canExport]])}
        >
          <Item id="upload" label="Upload Image…" />
          <Item id="search" label="Search Wikimedia Commons…" />
          <Separator />
          <Item id="export" label="Export…" shortcut={`${MOD}E`} />
        </TopMenu>

        <TopMenu
          label="Edit"
          onAction={act}
          disabledKeys={disabledWhen([
            ["undo", !canUndo],
            ["redo", !canRedo],
            ["delete", !hasSelection],
            ["deselect", !hasSelection],
          ])}
        >
          <Item id="undo" label="Undo" shortcut={`${MOD}Z`} />
          <Item id="redo" label="Redo" shortcut={REDO_SHORTCUT} />
          <Separator />
          <Item id="delete" label="Delete Photo" shortcut="⌫" />
          <Item id="deselect" label="Deselect" shortcut="Esc" />
        </TopMenu>

        <TopMenu label="Image">
          <MenuSection
            selectionMode="single"
            disallowEmptySelection
            selectedKeys={[canvasFormat.preset]}
            onSelectionChange={(keys) => {
              const [selected] = keys === "all" ? [] : [...keys];
              if (selected !== undefined) {
                onCanvasPreset(selected as CanvasPreset);
              }
            }}
          >
            <Header>Size</Header>
            <Item
              id="trimmed"
              label="Trimmed"
              description="Crop to fit"
              icon={<CanvasShape width={4} height={3} isOpen />}
            />
            {CANVAS_PRESETS.map((preset) => (
              <Item
                key={preset.id}
                id={preset.id}
                label={preset.ratio}
                description={preset.description}
                icon={
                  <CanvasShape width={preset.width} height={preset.height} />
                }
              />
            ))}
            <Item
              id="custom"
              label="Custom Size…"
              description={
                canvasFormat.preset === "custom"
                  ? `${canvasFormat.customWidth} × ${canvasFormat.customHeight} px · ${simplifiedRatio(canvasFormat.customWidth, canvasFormat.customHeight)}`
                  : undefined
              }
              icon={
                <CanvasShape
                  width={canvasFormat.customWidth}
                  height={canvasFormat.customHeight}
                />
              }
              onAction={onCustomSize}
            />
          </MenuSection>
          <Separator />
          <MenuSection
            selectionMode="single"
            disallowEmptySelection
            selectedKeys={[theme.id]}
            onSelectionChange={(keys) => {
              const [selected] = keys === "all" ? [] : [...keys];
              const next = THEMES.find((option) => option.id === selected);
              if (next) onTheme(next);
            }}
          >
            <Header>Background</Header>
            {THEMES.map((option) => (
              <Item
                key={option.id}
                id={option.id}
                label={option.name}
                icon={<Swatch color={option.color} />}
              />
            ))}
          </MenuSection>
        </TopMenu>

        <MenuTrigger>
          <Button className="menubar-button">Layer</Button>
          <Popover className="menu-popover" placement="bottom start" offset={2}>
            <LayerMenu {...layerMenu} />
          </Popover>
        </MenuTrigger>
      </Toolbar>
      {status && (
        <span className="menubar-status" role="status">
          {status}
        </span>
      )}
    </header>
  );
}

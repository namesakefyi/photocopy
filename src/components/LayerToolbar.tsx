import {
  Button,
  Group,
  Separator,
  ToggleButton,
  ToggleButtonGroup,
  Toolbar,
} from "react-aria-components";
import { SHORTCUTS } from "../shortcuts";
import type { Tool } from "../types";
import {
  BringForwardIcon,
  BrushAddIcon,
  BrushSubtractIcon,
  FlipHorizontalIcon,
  FlipVerticalIcon,
  MinusIcon,
  PlusIcon,
  RedoIcon,
  SendBackIcon,
  TrashIcon,
  UndoIcon,
} from "./ui/icons";
import { ToolButton, ToolToggleButton } from "./ui/ToolButton";

/** Everything the toolbar's buttons (and shortcuts) can ask the app to do. */
export type LayerAction =
  | "undo"
  | "redo"
  | "upload"
  | "search"
  | "export"
  | "delete"
  | "removeBackground"
  | "crop"
  | "flipX"
  | "flipY"
  | "forward"
  | "back"
  | "brushLarger"
  | "brushSmaller";

/** The selected layer's state, as the toolbar's buttons need it. */
export interface LayerActionsProps {
  hasSelection: boolean;
  /** False while the background is being removed, which replaces the mask. */
  canEditMask: boolean;
  canRemoveBackground: boolean;
  canCrop: boolean;
  canBringForward: boolean;
  canSendBack: boolean;
  isRefining: boolean;
  tool: Tool;
  onAction: (action: LayerAction) => void;
  onRefining: (isRefining: boolean) => void;
  onTool: (tool: Tool) => void;
}

export interface LayerToolbarProps extends LayerActionsProps {
  /** Shown at the end of the bar, like background removal progress. */
  status: string | null;
  /** The mask brush's diameter in pixels, shown while the mask is. */
  brushSize: number;
  canUndo: boolean;
  canRedo: boolean;
  onAbout: () => void;
}

/** Lets a mouse wheel scroll the toolbar sideways when it overflows. */
function scrollSideways(event: React.WheelEvent<HTMLElement>) {
  if (Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return;
  event.currentTarget.scrollLeft += event.deltaY;
}

/**
 * Above the canvas: the app name, undo and redo, then the selected layer's
 * actions, or ways to add a layer.
 */
export function LayerToolbar({
  hasSelection,
  status,
  canUndo,
  canRedo,
  onAbout,
  ...actions
}: LayerToolbarProps) {
  const { onAction } = actions;
  return (
    <div className="layer-toolbar">
      <Button className="toolbar-button brand" onPress={onAbout}>
        Photocopy
      </Button>
      <Toolbar aria-label="History" className="layer-toolbar-actions">
        <ToolButton
          label="Undo"
          shortcut={SHORTCUTS.undo}
          isDisabled={!canUndo}
          onPress={() => onAction("undo")}
        >
          <UndoIcon />
        </ToolButton>
        <ToolButton
          label="Redo"
          shortcut={SHORTCUTS.redo}
          isDisabled={!canRedo}
          onPress={() => onAction("redo")}
        >
          <RedoIcon />
        </ToolButton>
      </Toolbar>
      <div
        className="layer-toolbar-scroll"
        data-add-layer={!hasSelection || undefined}
        onWheel={scrollSideways}
      >
        {!hasSelection && (
          <Toolbar aria-label="Add layer" className="layer-toolbar-actions">
            <Button
              className="toolbar-button"
              onPress={() => onAction("upload")}
            >
              Upload Image
            </Button>
            <Button
              className="toolbar-button"
              onPress={() => onAction("search")}
            >
              Search Wikimedia Commons
            </Button>
          </Toolbar>
        )}
        {hasSelection && <LayerActions {...actions} />}
      </div>
      <span className="layer-toolbar-status" role="status">
        {status}
      </span>
    </div>
  );
}

function LayerActions({
  canEditMask,
  canRemoveBackground,
  canCrop,
  canBringForward,
  canSendBack,
  isRefining,
  tool,
  brushSize,
  onAction,
  onRefining,
  onTool,
}: Omit<LayerActionsProps, "hasSelection"> & { brushSize: number }) {
  return (
    <Toolbar aria-label="Layer" className="layer-toolbar-actions">
      <Group aria-label="Cut out">
        <Button
          className="toolbar-button"
          isDisabled={!canRemoveBackground}
          onPress={() => onAction("removeBackground")}
        >
          Remove Background
        </Button>
        <Button
          className="toolbar-button"
          isDisabled={!canCrop}
          onPress={() => onAction("crop")}
        >
          Crop to Fit
        </Button>
      </Group>
      <Separator orientation="vertical" />
      <Group aria-label="Mask">
        <ToggleButton
          className="toolbar-button"
          isDisabled={!canEditMask}
          isSelected={isRefining}
          onChange={onRefining}
        >
          Mask
        </ToggleButton>
        {isRefining && (
          <>
            <ToggleButtonGroup
              aria-label="Brush"
              className="toolbar-group"
              selectionMode="single"
              selectedKeys={tool === "move" ? [] : [tool]}
              onSelectionChange={(keys) => {
                const [selected] = [...keys];
                onTool(selected === undefined ? "move" : (selected as Tool));
              }}
            >
              <ToolToggleButton
                id="erase"
                label="Add to Mask"
                shortcut={SHORTCUTS.erase}
              >
                <BrushAddIcon />
              </ToolToggleButton>
              <ToolToggleButton
                id="restore"
                label="Subtract from Mask"
                shortcut={SHORTCUTS.restore}
              >
                <BrushSubtractIcon />
              </ToolToggleButton>
            </ToggleButtonGroup>
            <ToolButton
              label="Smaller Brush"
              shortcut={SHORTCUTS.brushSmaller}
              onPress={() => onAction("brushSmaller")}
            >
              <MinusIcon />
            </ToolButton>
            <output className="brush-size" aria-label="Brush size">
              {brushSize} px
            </output>
            <ToolButton
              label="Larger Brush"
              shortcut={SHORTCUTS.brushLarger}
              onPress={() => onAction("brushLarger")}
            >
              <PlusIcon />
            </ToolButton>
          </>
        )}
      </Group>
      <Separator orientation="vertical" />
      <Group aria-label="Flip">
        <ToolButton label="Flip Horizontal" onPress={() => onAction("flipX")}>
          <FlipHorizontalIcon />
        </ToolButton>
        <ToolButton label="Flip Vertical" onPress={() => onAction("flipY")}>
          <FlipVerticalIcon />
        </ToolButton>
      </Group>
      <Separator orientation="vertical" />
      <Group aria-label="Order">
        <ToolButton
          label="Send Back"
          shortcut={SHORTCUTS.back}
          isDisabled={!canSendBack}
          onPress={() => onAction("back")}
        >
          <SendBackIcon />
        </ToolButton>
        <ToolButton
          label="Bring Forward"
          shortcut={SHORTCUTS.forward}
          isDisabled={!canBringForward}
          onPress={() => onAction("forward")}
        >
          <BringForwardIcon />
        </ToolButton>
      </Group>
      <Separator orientation="vertical" />
      <ToolButton
        label="Delete Layer"
        shortcut={SHORTCUTS.delete}
        onPress={() => onAction("delete")}
      >
        <TrashIcon />
      </ToolButton>
    </Toolbar>
  );
}

import { Button, Group, Separator, Toolbar } from "react-aria-components";
import { SHORTCUTS } from "../shortcuts";
import type { Tool } from "../types";
import type { ValueStore } from "../valueStore";
import type { ZoomAction } from "../zoom";
import { BrushSizeMenu } from "./BrushSizeMenu";
import {
  BringForwardIcon,
  EraserIcon,
  FlipHorizontalIcon,
  FlipVerticalIcon,
  RedoIcon,
  SendBackIcon,
  TrashIcon,
  UndoIcon,
} from "./ui/icons";
import { ToolButton, ToolToggleButton } from "./ui/ToolButton";
import { ZoomMenu } from "./ZoomMenu";

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
  onBrushSize: (size: number) => void;
  /** Briefly outlines the brush's size over the selected photo. */
  onShowBrushSize: () => void;
}

export interface LayerToolbarProps extends LayerActionsProps {
  /** The mask brush's diameter in pixels, shown while the mask is. */
  brushSize: number;
  canUndo: boolean;
  canRedo: boolean;
  start?: React.ReactNode;
  zoom: ValueStore<number>;
  onZoom: (action: ZoomAction) => void;
  onAbout: () => void;
}

/** Lets a mouse wheel scroll the toolbar sideways when it overflows. */
function scrollSideways(event: React.WheelEvent<HTMLElement>) {
  if (Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return;
  event.currentTarget.scrollLeft += event.deltaY;
}

/**
 * Above the canvas: the app name, undo, redo and zoom, then the selected layer's
 * actions. Adding a layer lives in the Layers section.
 */
export function LayerToolbar({
  hasSelection,
  canUndo,
  canRedo,
  start,
  zoom,
  onZoom,
  onAbout,
  ...actions
}: LayerToolbarProps) {
  const { onAction } = actions;
  return (
    <div className="layer-toolbar">
      {start}
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
        <ZoomMenu zoom={zoom} onZoom={onZoom} />
      </Toolbar>
      {hasSelection && (
        <div className="layer-toolbar-scroll" onWheel={scrollSideways}>
          <LayerActions {...actions} />
        </div>
      )}
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
  onBrushSize,
  onShowBrushSize,
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
          Shrink to Fit
        </Button>
      </Group>
      <Separator orientation="vertical" />
      <Group aria-label="Mask">
        <ToolToggleButton
          label="Mask"
          shortcut={SHORTCUTS.erase}
          hasText
          isDisabled={!canEditMask}
          isSelected={isRefining}
          onChange={onRefining}
        >
          Mask
        </ToolToggleButton>
        {isRefining && (
          <>
            {/* Off, the brush masks; on, it erases the mask, bringing the photo back. */}
            <ToolToggleButton
              label="Erase"
              shortcut={SHORTCUTS.restore}
              isSelected={tool === "restore"}
              onChange={(isErasing) => onTool(isErasing ? "restore" : "erase")}
            >
              <EraserIcon />
            </ToolToggleButton>
            <BrushSizeMenu
              size={brushSize}
              onChange={onBrushSize}
              onShowOnCanvas={onShowBrushSize}
            />
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

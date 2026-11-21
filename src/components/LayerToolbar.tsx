import { memo } from "react";
import { Button, Group, Separator, Toolbar } from "react-aria-components";
import { SHORTCUTS } from "../core/shortcuts";
import type { Tool } from "../core/types";
import type { ValueStore } from "../core/valueStore";
import { useEditor } from "../hooks/useEditor";
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

interface LayerActionsProps {
  selectedId: string;
  /** False while the background is being removed, which replaces the mask. */
  canEditMask: boolean;
  canRemoveBackground: boolean;
  canCrop: boolean;
  canBringForward: boolean;
  canSendBack: boolean;
  isRefining: boolean;
  tool: Tool;
  /** The mask brush's diameter in pixels, shown while the mask is. */
  brushSize: number;
}

export interface LayerToolbarProps
  extends Omit<LayerActionsProps, "selectedId"> {
  selectedId: string | null;
  canUndo: boolean;
  canRedo: boolean;
  start?: React.ReactNode;
  zoom: ValueStore<number>;
}

/** Lets a mouse wheel scroll the toolbar sideways when it overflows. */
function scrollSideways(event: React.WheelEvent<HTMLElement>) {
  if (Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return;
  event.currentTarget.scrollLeft += event.deltaY;
}

export const LayerToolbar = memo(function LayerToolbar({
  selectedId,
  canUndo,
  canRedo,
  start,
  zoom,
  ...actions
}: LayerToolbarProps) {
  const editor = useEditor();
  return (
    <div className="layer-toolbar">
      {start}
      <Button className="toolbar-button brand" onPress={editor.openAbout}>
        Photocopy
      </Button>
      <Toolbar aria-label="History" className="layer-toolbar-actions">
        <ToolButton
          label="Undo"
          shortcut={SHORTCUTS.undo}
          isDisabled={!canUndo}
          onPress={editor.undo}
        >
          <UndoIcon />
        </ToolButton>
        <ToolButton
          label="Redo"
          shortcut={SHORTCUTS.redo}
          isDisabled={!canRedo}
          onPress={editor.redo}
        >
          <RedoIcon />
        </ToolButton>
        <ZoomMenu zoom={zoom} onZoom={editor.zoom} />
      </Toolbar>
      {selectedId !== null && (
        <div className="layer-toolbar-scroll" onWheel={scrollSideways}>
          <LayerActions selectedId={selectedId} {...actions} />
        </div>
      )}
    </div>
  );
});

function LayerActions({
  selectedId,
  canEditMask,
  canRemoveBackground,
  canCrop,
  canBringForward,
  canSendBack,
  isRefining,
  tool,
  brushSize,
}: LayerActionsProps) {
  const { dispatch, ...editor } = useEditor();
  return (
    <Toolbar aria-label="Layer" className="layer-toolbar-actions">
      <Group aria-label="Cut out">
        <Button
          className="toolbar-button"
          isDisabled={!canRemoveBackground}
          onPress={() => editor.removeBackground(selectedId)}
        >
          Remove Background
        </Button>
        <Button
          className="toolbar-button"
          isDisabled={!canCrop}
          onPress={() => editor.cropToVisible(selectedId)}
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
          onChange={(isRefining) =>
            dispatch({ type: "setRefining", isRefining })
          }
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
              onChange={(isErasing) =>
                dispatch({
                  type: "setTool",
                  tool: isErasing ? "restore" : "erase",
                })
              }
            >
              <EraserIcon />
            </ToolToggleButton>
            <BrushSizeMenu
              size={brushSize}
              onChange={(size) => dispatch({ type: "setBrushSize", size })}
              onShowOnCanvas={editor.showBrushSize}
            />
          </>
        )}
      </Group>
      <Separator orientation="vertical" />
      <Group aria-label="Flip">
        <ToolButton
          label="Flip Horizontal"
          onPress={() => dispatch({ type: "flipSelected", axis: "flipX" })}
        >
          <FlipHorizontalIcon />
        </ToolButton>
        <ToolButton
          label="Flip Vertical"
          onPress={() => dispatch({ type: "flipSelected", axis: "flipY" })}
        >
          <FlipVerticalIcon />
        </ToolButton>
      </Group>
      <Separator orientation="vertical" />
      <Group aria-label="Order">
        <ToolButton
          label="Send Back"
          shortcut={SHORTCUTS.back}
          isDisabled={!canSendBack}
          onPress={() => dispatch({ type: "moveSelected", direction: -1 })}
        >
          <SendBackIcon />
        </ToolButton>
        <ToolButton
          label="Bring Forward"
          shortcut={SHORTCUTS.forward}
          isDisabled={!canBringForward}
          onPress={() => dispatch({ type: "moveSelected", direction: 1 })}
        >
          <BringForwardIcon />
        </ToolButton>
      </Group>
      <Separator orientation="vertical" />
      <ToolButton
        label="Delete Layer"
        shortcut={SHORTCUTS.delete}
        onPress={() => dispatch({ type: "deleteSelected" })}
      >
        <TrashIcon />
      </ToolButton>
    </Toolbar>
  );
}

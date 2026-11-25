import { memo } from "react";
import { Group, Separator, Toolbar } from "react-aria-components";
import { SHORTCUTS } from "../core/shortcuts";
import type { Tool } from "../core/types";
import { useEditor } from "../hooks/useEditor";
import { AppMenu } from "./AppMenu";
import { BrushSizeMenu } from "./BrushSizeMenu";
import { EditMenu } from "./EditMenu";
import { FileMenu } from "./FileMenu";
import styles from "./LayerToolbar.module.css";
import { Button } from "./ui/Button";
import { cx } from "./ui/cx";
import {
  BringForwardIcon,
  EraserIcon,
  FlipHorizontalIcon,
  FlipVerticalIcon,
  SendBackIcon,
  TrashIcon,
} from "./ui/icons";
import { ToolButton, ToolToggleButton } from "./ui/ToolButton";
import { ViewMenu } from "./ViewMenu";

export interface LayerToolbarProps {
  selectedId: string | null;
  canUndo: boolean;
  canRedo: boolean;
  canExport: boolean;
  start?: React.ReactNode;
  isArtboardListShown: boolean;
  onArtboardListShownChange: (isShown: boolean) => void;
  canEditMask: boolean;
  canRemoveBackground: boolean;
  canCrop: boolean;
  canBringForward: boolean;
  canSendBack: boolean;
  isRefining: boolean;
  tool: Tool;
  brushSize: number;
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
  canExport,
  start,
  isArtboardListShown,
  onArtboardListShownChange,
  canEditMask,
  canRemoveBackground,
  canCrop,
  canBringForward,
  canSendBack,
  isRefining,
  tool,
  brushSize,
}: LayerToolbarProps) {
  const { dispatch, ...editor } = useEditor();
  return (
    <div className={styles.toolbar}>
      {start}
      <Toolbar aria-label="Menu bar" className={styles.menus}>
        <AppMenu
          className={cx(styles.menuTitle, styles.brand)}
          onAbout={editor.openAbout}
        />
        <FileMenu className={styles.menuTitle} canExport={canExport} />
        <EditMenu
          className={styles.menuTitle}
          canUndo={canUndo}
          canRedo={canRedo}
          canCopy={selectedId !== null}
        />
        <ViewMenu
          className={styles.menuTitle}
          onZoom={editor.zoom}
          isArtboardListShown={isArtboardListShown}
          onArtboardListShownChange={onArtboardListShownChange}
        />
      </Toolbar>
      {selectedId !== null && (
        <div className={styles.scroll} onWheel={scrollSideways}>
          <Toolbar aria-label="Layer" className={styles.actions}>
            <Group className={styles.group} aria-label="Cut out">
              <Button
                variant="toolbar"
                isDisabled={!canRemoveBackground}
                onPress={() => editor.removeBackground(selectedId)}
              >
                Remove Background
              </Button>
              <Button
                variant="toolbar"
                isDisabled={!canCrop}
                onPress={() => editor.cropToVisible(selectedId)}
              >
                Shrink to Fit
              </Button>
            </Group>
            <Separator className={styles.separator} orientation="vertical" />
            <Group className={styles.group} aria-label="Mask">
              <ToolToggleButton
                label="Mask"
                shortcut={SHORTCUTS.erase}
                hasText
                isDisabled={!canEditMask}
                isSelected={isRefining}
                onChange={(isRefining) =>
                  dispatch({
                    type: "setTool",
                    tool: isRefining ? "erase" : "move",
                  })
                }
              >
                Mask
              </ToolToggleButton>
              {isRefining && (
                <>
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
                    onChange={(size) =>
                      dispatch({ type: "setBrushSize", size })
                    }
                    onShowOnCanvas={editor.showBrushSize}
                  />
                </>
              )}
            </Group>
            <Separator className={styles.separator} orientation="vertical" />
            <Group className={styles.group} aria-label="Flip">
              <ToolButton
                label="Flip Horizontal"
                onPress={() =>
                  dispatch({ type: "flipSelected", axis: "flipX" })
                }
              >
                <FlipHorizontalIcon />
              </ToolButton>
              <ToolButton
                label="Flip Vertical"
                onPress={() =>
                  dispatch({ type: "flipSelected", axis: "flipY" })
                }
              >
                <FlipVerticalIcon />
              </ToolButton>
            </Group>
            <Separator className={styles.separator} orientation="vertical" />
            <Group className={styles.group} aria-label="Order">
              <ToolButton
                label="Send Back"
                shortcut={SHORTCUTS.back}
                isDisabled={!canSendBack}
                onPress={() =>
                  dispatch({ type: "moveSelected", direction: -1 })
                }
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
            <Separator className={styles.separator} orientation="vertical" />
            <ToolButton
              label="Delete Layer"
              shortcut={SHORTCUTS.delete}
              onPress={() => dispatch({ type: "deleteSelected" })}
            >
              <TrashIcon />
            </ToolButton>
          </Toolbar>
        </div>
      )}
    </div>
  );
});

// @vitest-environment happy-dom
import { act } from "react";
import { describe, expect, it, vi } from "vitest";
import type { LayerEntry } from "../../core/types";
import { createValueStore } from "../../core/valueStore";
import {
  type EditorCommands,
  EditorContext,
  type EditorStatus,
} from "../../hooks/editor/useEditor";
import { find, pressKey, render } from "../../test/render";
import { LayerPane } from "./LayerPane";

const layers: LayerEntry[] = [
  { id: "a", name: "Cat", visible: true },
  { id: "b", name: "Dog", visible: true },
];

function renderList() {
  const dispatch = vi.fn();
  const editor = {
    dispatch,
    status: createValueStore<EditorStatus>({
      canUndo: false,
      canRedo: false,
      canCopy: false,
      canExport: false,
      selectedId: null,
      tool: "move",
      brushSize: 40,
      canEditMask: false,
      canRemoveBackground: false,
      canCrop: false,
      canBringForward: false,
      canSendBack: false,
    }),
  } as unknown as EditorCommands;
  const view = render(
    <EditorContext value={editor}>
      <LayerPane layers={layers} selectedId={null} />
    </EditorContext>,
  );
  return { ...view, dispatch };
}

function startRenaming() {
  const view = renderList();
  const row = find(view.container, '[data-key="a"]');
  act(() => row.focus());
  pressKey(row, "Enter");
  const input = find<HTMLInputElement>(
    view.container,
    'input[aria-label="Layer name"]',
  );
  return { ...view, row, input };
}

describe("LayerPane", () => {
  it("renames a layer with Enter", () => {
    const { input, dispatch, unmount, container } = startRenaming();
    expect(document.activeElement).toBe(input);
    input.value = "Kitten";
    pressKey(input, "Enter");
    expect(dispatch).toHaveBeenCalledWith({
      type: "updateLayer",
      id: "a",
      changes: { name: "Kitten" },
    });
    expect(container.querySelector("input")).toBeNull();
    unmount();
  });

  it("keeps the old name on Escape", () => {
    const { input, row, dispatch, unmount } = startRenaming();
    input.value = "Kitten";
    pressKey(input, "Escape");
    expect(dispatch).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: "updateLayer" }),
    );
    expect(document.activeElement).toBe(row);
    unmount();
  });
});

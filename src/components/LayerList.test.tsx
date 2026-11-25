// @vitest-environment happy-dom
import { act } from "react";
import { describe, expect, it, vi } from "vitest";
import type { LayerEntry } from "../core/types";
import { type EditorCommands, EditorContext } from "../hooks/useEditor";
import { find, pressKey, render } from "../test/renderHook";
import { LayerList } from "./LayerList";

const layers: LayerEntry[] = [
  { id: "a", name: "Cat", visible: true },
  { id: "b", name: "Dog", visible: true },
];

function renderList() {
  const dispatch = vi.fn();
  const editor = { dispatch } as unknown as EditorCommands;
  const view = render(
    <EditorContext value={editor}>
      <LayerList layers={layers} selectedId={null} />
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

describe("LayerList", () => {
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

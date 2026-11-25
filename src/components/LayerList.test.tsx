// @vitest-environment happy-dom
import { act } from "react";
import { describe, expect, it, vi } from "vitest";
import type { LayerEntry } from "../core/types";
import { type EditorCommands, EditorContext } from "../hooks/useEditor";
import { find, press, pressKey, render } from "../test/renderHook";
import { LayerList } from "./LayerList";

const layers: LayerEntry[] = [
  { id: "a", name: "Cat", visible: true },
  { id: "b", name: "Dog", visible: true },
];

function renderList(isLoading: boolean) {
  const dispatch = vi.fn();
  const editor = { dispatch } as unknown as EditorCommands;
  const list = (isLoading: boolean) => (
    <EditorContext value={editor}>
      <LayerList layers={layers} selectedId={null} isLoading={isLoading} />
    </EditorContext>
  );
  const view = render(list(isLoading));
  return { ...view, dispatch, finishLoading: () => view.rerender(list(false)) };
}

const pressHide = (container: HTMLElement) =>
  press(find(container, '[aria-label="Hide Cat"]'));

/** Opens the name field on Cat's row with Enter, attached so focus works. */
function startRenaming() {
  const view = renderList(false);
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
  it("keeps working once the photos finish loading", () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const { container, finishLoading, unmount } = renderList(true);
    finishLoading();
    expect(container.textContent).toContain("Cat");
    expect(errors).not.toHaveBeenCalled();
    errors.mockRestore();
    unmount();
  });

  it("ignores changes while loading", () => {
    const { container, dispatch, finishLoading, unmount } = renderList(true);
    pressHide(container);
    expect(dispatch).not.toHaveBeenCalled();

    finishLoading();
    pressHide(container);
    expect(dispatch).toHaveBeenCalledWith({
      type: "updateLayer",
      id: "a",
      changes: { visible: false },
    });
    unmount();
  });

  it("selects a layer on click", () => {
    const { container, dispatch, unmount } = renderList(false);
    press(find(container, '[data-key="b"]'));
    expect(dispatch).toHaveBeenCalledWith({ type: "select", id: "b" });
    unmount();
  });

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

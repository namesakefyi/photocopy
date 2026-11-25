// @vitest-environment happy-dom
import { act } from "react";
import { expect, it } from "vitest";
import { createValueStore } from "../../core/valueStore";
import { render } from "../../test/render";
import {
  type EditorCommands,
  EditorContext,
  type EditorStatus,
  useEditor,
} from "./useEditor";

let renders = 0;

function Probe() {
  renders++;
  // A rest spread mustn't read, and so track, every status value.
  const { canUndo, ...rest } = useEditor();
  return <p>{String(canUndo ?? rest)}</p>;
}

it("re-renders only when a status value read while rendering changes", () => {
  const status = createValueStore<EditorStatus>({
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
  });
  const { container, unmount } = render(
    <EditorContext value={{ status } as unknown as EditorCommands}>
      <Probe />
    </EditorContext>,
  );
  const start = renders;
  act(() => status.set({ ...status.get(), canExport: true }));
  expect(renders).toBe(start);
  act(() => status.set({ ...status.get(), canUndo: true }));
  expect(renders).toBe(start + 1);
  expect(container.textContent).toBe("true");
  unmount();
});

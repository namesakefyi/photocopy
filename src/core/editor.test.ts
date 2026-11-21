import { describe, expect, it } from "vitest";
import { type EditorState, editorReducer, initialEditorState } from "./editor";
import { DEFAULT_THEME } from "./themes";
import type { Layer } from "./types";

const layer = (id: string) => ({ id, x: 0, y: 0, scale: 1 }) as Layer;

function withLayers(...ids: string[]): EditorState {
  return { ...initialEditorState(DEFAULT_THEME), layers: ids.map(layer) };
}

describe("editorReducer", () => {
  it("puts the brushes away when the selection changes", () => {
    const masking = editorReducer(
      { ...withLayers("a", "b"), selectedId: "a" },
      { type: "setTool", tool: "restore" },
    );
    expect(masking).toMatchObject({ tool: "restore", isRefining: true });
    const next = editorReducer(masking, { type: "select", id: "b" });
    expect(next).toMatchObject({ tool: "move", isRefining: false });
  });

  it("selects the last of the added layers", () => {
    const state = editorReducer(withLayers("a"), {
      type: "addLayers",
      layers: [layer("b"), layer("c")],
    });
    expect(state.layers.map((l) => l.id)).toEqual(["a", "b", "c"]);
    expect(state.selectedId).toBe("c");
  });

  it("escape leaves the mask first, then the selection", () => {
    const refining = editorReducer(
      { ...withLayers("a"), selectedId: "a" },
      { type: "setRefining", isRefining: true },
    );
    const once = editorReducer(refining, { type: "escape" });
    expect(once).toMatchObject({ selectedId: "a", isRefining: false });
    expect(editorReducer(once, { type: "escape" }).selectedId).toBeNull();
  });

  it("moves the selected layer within the stack, and no further", () => {
    const state = { ...withLayers("a", "b"), selectedId: "a" };
    const forward = editorReducer(state, {
      type: "moveSelected",
      direction: 1,
    });
    expect(forward.layers.map((l) => l.id)).toEqual(["b", "a"]);
    expect(editorReducer(forward, { type: "moveSelected", direction: 1 })).toBe(
      forward,
    );
  });

  it("keeps the selection after undo only if that layer still exists", () => {
    const state = { ...withLayers("a", "b"), selectedId: "b" };
    const undone = editorReducer(state, {
      type: "undoTo",
      state: { ...state, layers: [layer("a")] },
    });
    expect(undone.selectedId).toBeNull();
  });

  it("returns photos to where they were after switching canvas sizes and back", () => {
    const state = { ...withLayers("a"), layers: [{ ...layer("a"), x: 100 }] };
    const video = editorReducer(state, {
      type: "changeCanvas",
      changes: { preset: "video" },
    });
    const back = editorReducer(video, {
      type: "changeCanvas",
      changes: { preset: state.canvasFormat.preset },
    });
    expect(back.layers[0]).toMatchObject({ x: 100, y: 0, scale: 1 });
  });
});

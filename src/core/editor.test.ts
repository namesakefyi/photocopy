import { describe, expect, it } from "vitest";
import { creditsOf } from "./credits";
import {
  type EditorState,
  editorReducer,
  initialEditorState,
  placeNewPhotos,
  selectionState,
  statusMessage,
} from "./editor";
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
});

describe("selectionState", () => {
  it("can't edit the mask while the background is being removed", () => {
    const state = { ...withLayers("a", "b"), selectedId: "a" };
    expect(selectionState(state, {})).toMatchObject({
      canEditMask: true,
      canBringForward: true,
      canSendBack: false,
    });
    const removing = { a: { label: "Cutting out", fraction: 0.5 } };
    expect(selectionState(state, removing)).toMatchObject({
      canEditMask: false,
      canRemoveBackground: false,
    });
  });
});

describe("statusMessage", () => {
  it("puts another tab's lock first, then removal progress, then the brush", () => {
    const removal = { label: "Cutting out", fraction: 0.5 };
    expect(statusMessage(true, removal, "erase")).toMatch(/another tab/);
    expect(statusMessage(false, removal, "erase")).toBe("Cutting out…");
    expect(statusMessage(false, undefined, "erase")).toBe(
      "Masking · Esc to stop",
    );
    expect(statusMessage(false, undefined, "move")).toBeNull();
  });
});

it("staggers new photos from the middle of the artboard", () => {
  const [first, second] = placeNewPhotos(2, { width: 1000, height: 500 });
  expect(first).toEqual({ x: 500, y: 250, maxWidth: 600, maxHeight: 300 });
  expect(second).toMatchObject({ x: 560, y: 310 });
});

it("credits each visible source once", () => {
  const credit = { sourceUrl: "https://example.com/1" } as Layer["credit"];
  const layers = [
    { ...layer("a"), visible: true, credit },
    { ...layer("b"), visible: true, credit },
    { ...layer("c"), visible: false, credit: { ...credit, sourceUrl: "x" } },
  ] as Layer[];
  expect(creditsOf(layers)).toEqual([credit]);
});

// @vitest-environment happy-dom
import { act, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_CANVAS } from "./canvasFormat";
import { type DocumentState, useHistory } from "./history";
import { DEFAULT_SETTINGS } from "./photocopy";
import { renderHook } from "./test/renderHook";
import { DEFAULT_THEME } from "./themes";

const start: DocumentState = {
  layers: [],
  settings: DEFAULT_SETTINGS,
  canvasFormat: DEFAULT_CANVAS,
  background: DEFAULT_THEME,
};

const withDarkness = (darkness: number): DocumentState => ({
  ...start,
  settings: { ...DEFAULT_SETTINGS, darkness },
});

// The merge window is measured with performance.now, so tests set the clock.
let now = 0;
beforeEach(() => {
  now = 10_000;
  vi.spyOn(performance, "now").mockImplementation(() => now);
});
afterEach(() => {
  vi.restoreAllMocks();
});

function renderHistory(isReady = true) {
  return renderHook(() => {
    const [document, setDocument] = useState(start);
    const history = useHistory(document, isReady, setDocument);
    return { document, setDocument, history };
  });
}

/** Makes a change well after the last one, so it's its own undo step. */
function change(
  result: ReturnType<typeof renderHistory>["result"],
  state: DocumentState,
  after = 1000,
) {
  now += after;
  act(() => result.current.setDocument(state));
}

describe("useHistory", () => {
  it("starts with nothing to undo or redo", () => {
    const { result } = renderHistory();
    expect(result.current.history.canUndo).toBe(false);
    expect(result.current.history.canRedo).toBe(false);
  });

  it("undoes and redoes changes in order", () => {
    const { result } = renderHistory();
    change(result, withDarkness(10));
    change(result, withDarkness(20));
    expect(result.current.history.canUndo).toBe(true);

    act(() => result.current.history.undo());
    expect(result.current.document.settings.darkness).toBe(10);
    act(() => result.current.history.undo());
    expect(result.current.document).toEqual(start);
    expect(result.current.history.canUndo).toBe(false);

    act(() => result.current.history.redo());
    act(() => result.current.history.redo());
    expect(result.current.document.settings.darkness).toBe(20);
    expect(result.current.history.canRedo).toBe(false);
  });

  it("makes changes close together, like one slider drag, one step", () => {
    const { result } = renderHistory();
    change(result, withDarkness(10));
    change(result, withDarkness(11), 100);
    change(result, withDarkness(12), 100);
    act(() => result.current.history.undo());
    expect(result.current.document).toEqual(start);
  });

  it("never merges a change into the starting point", () => {
    const { result } = renderHistory();
    change(result, withDarkness(10), 10);
    act(() => result.current.history.undo());
    expect(result.current.document).toEqual(start);
  });

  it("drops the redo steps after a new change", () => {
    const { result } = renderHistory();
    change(result, withDarkness(10));
    change(result, withDarkness(20));
    act(() => result.current.history.undo());
    change(result, withDarkness(30));
    expect(result.current.history.canRedo).toBe(false);
    act(() => result.current.history.undo());
    expect(result.current.document.settings.darkness).toBe(10);
  });

  it("doesn't record undoing as a change of its own", () => {
    const { result } = renderHistory();
    change(result, withDarkness(10));
    act(() => result.current.history.undo());
    expect(result.current.history.canRedo).toBe(true);
    act(() => result.current.history.redo());
    expect(result.current.document.settings.darkness).toBe(10);
  });

  it("keeps the last 50 steps", () => {
    const { result } = renderHistory();
    for (let darkness = 1; darkness <= 60; darkness++) {
      change(result, withDarkness(darkness));
    }
    let undos = 0;
    while (result.current.history.canUndo) {
      act(() => result.current.history.undo());
      undos++;
    }
    expect(undos).toBe(49);
    expect(result.current.document.settings.darkness).toBe(11);
  });

  it("records nothing until the saved session has loaded", () => {
    const { result } = renderHistory(false);
    change(result, withDarkness(10));
    expect(result.current.history.canUndo).toBe(false);
  });
});

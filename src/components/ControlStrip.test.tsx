// @vitest-environment happy-dom
import { act } from "react";
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_CANVAS } from "../core/canvasFormat";
import { DEFAULT_SETTINGS } from "../core/photocopy";
import { DEFAULT_THEME } from "../core/themes";
import { type EditorCommands, EditorContext } from "../hooks/useEditor";
import { find, press, pressKey, render } from "../test/renderHook";
import { ControlStrip } from "./ControlStrip";

function renderPhoneStrip() {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: true,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
  const editor = { dispatch: vi.fn() } as unknown as EditorCommands;
  return render(
    <EditorContext value={editor}>
      <ControlStrip
        layers={[]}
        isLoading={false}
        selectedId={null}
        settings={DEFAULT_SETTINGS}
        canvasFormat={DEFAULT_CANVAS}
        background={DEFAULT_THEME}
        canExport={false}
        isExporting={false}
        error={null}
        onExport={() => {}}
      />
    </EditorContext>,
  );
}

const openSections = () =>
  [...document.querySelectorAll('aside[aria-label="Controls"] section')].map(
    (panel) => panel.getAttribute("aria-label"),
  );

function tab(container: HTMLElement, title: string) {
  const button = [
    ...container.querySelectorAll<HTMLElement>(
      '[aria-label="Control sections"] button',
    ),
  ].find((button) => button.textContent === title);
  if (!button) throw new Error(`No ${title} button`);
  return button;
}

describe("ControlStrip on phones", () => {
  it("switches sections with one tap, and closes from the open one", () => {
    const { container, unmount } = renderPhoneStrip();
    press(tab(container, "Layers"));
    expect(openSections()).toEqual(["Layers"]);
    press(tab(container, "Style"));
    expect(openSections()).toEqual(["Style"]);
    press(tab(container, "Style"));
    expect(openSections()).toEqual([]);
    unmount();
  });

  it("closes the open section on Escape and returns to its button", () => {
    const { container, unmount } = renderPhoneStrip();
    const style = tab(container, "Style");
    press(style);
    const slider = find(container, 'input[type="range"]');
    act(() => slider.focus());
    pressKey(slider, "Escape");
    expect(openSections()).toEqual([]);
    expect(document.activeElement).toBe(style);
    unmount();
  });
});

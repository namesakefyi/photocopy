// @vitest-environment happy-dom
import { act } from "react";
import { describe, expect, it, vi } from "vitest";
import { find, pressKey, render } from "../../test/render";
import { Slider } from "./Slider";

/** Types into the field the way React notices, then presses Enter. */
function typeAndCommit(input: HTMLInputElement, text: string) {
  const setValue = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value",
  )?.set;
  act(() => {
    input.focus();
    setValue?.call(input, text);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  pressKey(input, "Enter");
}

function renderSlider(value: number, minValue = 0) {
  const onChange = vi.fn();
  const view = render(
    <Slider
      label="Ink"
      minValue={minValue}
      maxValue={100}
      value={value}
      onChange={onChange}
    />,
  );
  const input = find<HTMLInputElement>(
    view.container,
    'input[aria-label="Ink"]',
  );
  return { ...view, input, onChange };
}

describe("Slider", () => {
  it.each([
    ["42", 42],
    ["500", 100],
    ["3", 10],
  ])("sets %s typed into the value as %d", (text, expected) => {
    const { input, onChange, unmount } = renderSlider(50, 10);
    typeAndCommit(input, text);
    expect(onChange).toHaveBeenLastCalledWith(expected);
    unmount();
  });

  it("is one tab stop, with Enter moving into the value and back", () => {
    const { input, onChange, unmount, container } = renderSlider(50);
    const thumb = find(container, 'input[type="range"]');
    expect(input.tabIndex).toBe(-1);

    act(() => thumb.focus());
    pressKey(thumb, "Enter");
    expect(document.activeElement).toBe(input);

    typeAndCommit(input, "70");
    expect(onChange).toHaveBeenLastCalledWith(70);
    expect(document.activeElement).toBe(thumb);
    unmount();
  });

  it("selects the whole value when pressed", () => {
    const { input, unmount } = renderSlider(50);
    act(() => {
      input.dispatchEvent(
        new MouseEvent("mousedown", { bubbles: true, cancelable: true }),
      );
    });
    expect(document.activeElement).toBe(input);
    expect([input.selectionStart, input.selectionEnd]).toEqual([0, 2]);
    unmount();
  });
});

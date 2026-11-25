import { act } from "react";
import { createRoot } from "react-dom/client";

// Tells React these renders happen inside act(), so updates flush in order.
(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

interface HarnessProps<Result> {
  useHook: () => Result;
  onRender: (result: Result) => void;
}

/** Calls the hook on every render and reports what it returned. */
function Harness<Result>({ useHook, onRender }: HarnessProps<Result>) {
  onRender(useHook());
  return null;
}

/** Renders a component into the page, for tests that look at its DOM. */
export function render(ui: React.ReactNode) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  act(() => root.render(ui));
  return {
    container,
    rerender: (next: React.ReactNode) => act(() => root.render(next)),
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

export function find<T extends HTMLElement = HTMLElement>(
  container: ParentNode,
  selector: string,
) {
  const element = container.querySelector<T>(selector);
  if (!element) throw new Error(`Nothing matches ${selector}`);
  return element;
}

export function press(element: Element) {
  const init = { bubbles: true, pointerId: 1, pointerType: "mouse", button: 0 };
  act(() => {
    element.dispatchEvent(new PointerEvent("pointerdown", init));
    element.dispatchEvent(new PointerEvent("pointerup", init));
    element.dispatchEvent(
      new MouseEvent("click", { bubbles: true, detail: 1 }),
    );
  });
}

export function pressKey(element: Element, key: string) {
  act(() => {
    element.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
    element.dispatchEvent(new KeyboardEvent("keyup", { key, bubbles: true }));
  });
}

/** Renders a hook (needs a DOM environment) and keeps `result.current` updated. */
export function renderHook<Result>(useHook: () => Result) {
  const result = { current: undefined as Result };
  const root = createRoot(document.createElement("div"));
  act(() =>
    root.render(
      <Harness
        useHook={useHook}
        onRender={(value: Result) => {
          result.current = value;
        }}
      />,
    ),
  );
  return {
    result,
    unmount: () => act(() => root.unmount()),
  };
}

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

/**
 * Renders a hook in a throwaway component (needs a DOM environment, like
 * happy-dom) and keeps `result.current` up to date with what it returns.
 */
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

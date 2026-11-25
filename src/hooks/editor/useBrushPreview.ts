import { useCallback, useRef, useState } from "react";

/** Shows the brush's size on the canvas until shortly after it last changes. */
export function useBrushPreview() {
  const [isShowing, setIsShowing] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const show = useCallback(() => {
    setIsShowing(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setIsShowing(false), 700);
  }, []);
  return [isShowing, show] as const;
}

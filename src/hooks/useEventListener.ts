import { useEffect, useEffectEvent } from "react";

type EventMap = WindowEventMap & DocumentEventMap;

/** Listens on `window` or `document` for as long as the component is mounted. */
export function useEventListener<K extends keyof EventMap>(
  target: Window | Document,
  type: K,
  handler: (event: EventMap[K]) => void,
) {
  const onEvent = useEffectEvent((event: Event) =>
    handler(event as EventMap[K]),
  );
  useEffect(() => {
    target.addEventListener(type, onEvent);
    return () => target.removeEventListener(type, onEvent);
  }, [target, type]);
}

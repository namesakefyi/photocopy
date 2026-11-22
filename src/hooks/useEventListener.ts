import { type RefObject, useEffect, useEffectEvent } from "react";

type EventMap = WindowEventMap & DocumentEventMap;

export function useEventListener<K extends keyof EventMap>(
  target: Window | Document | RefObject<HTMLElement | null>,
  type: K,
  handler: (event: EventMap[K]) => void,
) {
  const onEvent = useEffectEvent((event: Event) =>
    handler(event as EventMap[K]),
  );
  useEffect(() => {
    const element = "current" in target ? target.current : target;
    element?.addEventListener(type, onEvent);
    return () => element?.removeEventListener(type, onEvent);
  }, [target, type]);
}

import { useEffect, useEffectEvent, useState } from "react";

/** How long to wait for another tab to let go before saying it has this open. */
const LOCK_GRACE = 300;

export type LockState = "waiting" | "held" | "elsewhere";

/** Holds the artboard's lock while open, so two tabs never save over each other. */
export function useArtboardLock(artboardId: string, onRegained: () => void) {
  const [state, setState] = useState<LockState>(() =>
    "locks" in navigator ? "waiting" : "held",
  );
  const regained = useEffectEvent(onRegained);

  useEffect(() => {
    if (!("locks" in navigator)) return;
    const controller = new AbortController();
    let release = () => {};
    let wasElsewhere = false;
    const timer = setTimeout(() => {
      wasElsewhere = true;
      setState("elsewhere");
    }, LOCK_GRACE);
    navigator.locks
      .request(
        `photocopy-artboard:${artboardId}`,
        { signal: controller.signal },
        () => {
          clearTimeout(timer);
          // What loaded while another tab had it may be out of date.
          if (wasElsewhere) regained();
          else setState("held");
          return new Promise<void>((resolve) => {
            release = resolve;
          });
        },
      )
      .catch(() => {});
    return () => {
      clearTimeout(timer);
      controller.abort();
      release();
    };
  }, [artboardId]);

  return state;
}

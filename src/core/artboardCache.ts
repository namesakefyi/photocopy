import type { ArtboardState } from "./types";
import type { Viewport } from "./zoom";

/** Recently closed artboards, decoded, so reopening one needs no loading. */
export interface CachedArtboard {
  state: ArtboardState;
  viewport: Viewport;
}

// Each entry holds full-size canvases, so only a few are kept.
const LIMIT = 4;
const cache = new Map<string, CachedArtboard>();

// Other tabs say when they change an artboard, so a cached copy isn't reopened stale.
const channel =
  typeof BroadcastChannel === "undefined"
    ? null
    : new BroadcastChannel("photocopy-artboard-changes");
channel?.addEventListener("message", (event: MessageEvent<string>) =>
  cache.delete(event.data),
);

export function cachedArtboard(id: string) {
  return cache.get(id);
}

export function cacheArtboard(id: string, entry: CachedArtboard) {
  cache.delete(id);
  cache.set(id, entry);
  for (const oldest of cache.keys()) {
    if (cache.size <= LIMIT) break;
    cache.delete(oldest);
  }
}

/** For changes made in storage directly, which a cached copy wouldn't have. */
export function forgetCachedArtboard(id: string) {
  cache.delete(id);
  announceArtboardChange(id);
}

/** Tells other tabs this artboard was saved. */
export function announceArtboardChange(id: string) {
  channel?.postMessage(id);
}

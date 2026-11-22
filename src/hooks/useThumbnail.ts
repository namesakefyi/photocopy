import { useCallback, useEffect, useRef } from "react";
import { renderThumbnail } from "../core/thumbnail";
import { type ArtboardState, sameArtboardState } from "../core/types";
import type { Preview } from "./usePreview";

const THUMBNAIL_DELAY = 1000;

interface ThumbnailOptions {
  content: ArtboardState;
  /** What was loaded, or null for a new artboard; undefined while loading. */
  restored: ArtboardState | null | undefined;
  /** No thumbnail is saved yet, so make one even if nothing changes. */
  needsThumbnail: boolean;
  width: number;
  height: number;
  preview: Preview | null;
  onThumbnail: (thumbnail: Blob) => void;
}

export function useThumbnail({
  content,
  restored,
  needsThumbnail,
  width,
  height,
  preview,
  onThumbnail,
}: ThumbnailOptions) {
  const isLoaded = restored !== undefined;
  // Only content changes need a new thumbnail, not a zoom's sharper preview.
  const isStale = useRef(needsThumbnail);
  useEffect(() => {
    if (isLoaded && !(restored && sameArtboardState(restored, content))) {
      isStale.current = true;
    }
  }, [isLoaded, restored, content]);

  const hasLayers = content.layers.length > 0;
  const color = content.background.color;
  const save = useCallback(async () => {
    // Photos without a preview yet would make a blank thumbnail.
    if (!isStale.current || (hasLayers && !preview)) return;
    isStale.current = false;
    try {
      onThumbnail(await renderThumbnail({ width, height }, color, preview));
    } catch (cause) {
      isStale.current = true;
      console.warn("Couldn’t make a thumbnail", cause);
    }
  }, [hasLayers, preview, width, height, color, onThumbnail]);

  useEffect(() => {
    if (!isLoaded) return;
    const timer = setTimeout(save, THUMBNAIL_DELAY);
    return () => clearTimeout(timer);
  }, [isLoaded, save]);

  return save;
}

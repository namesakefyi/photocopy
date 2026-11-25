import { useCallback, useEffect, useRef, useState } from "react";
import { renderPreview } from "../../core/photocopyClient";
import { screenPixelRatio } from "../../core/render";
import { renderThumbnail } from "../../core/thumbnail";
import {
  type ArtboardState,
  type Region,
  sameArtboardState,
} from "../../core/types";
import { resolutionStep } from "../../core/zoom";

const PREVIEW_DELAY = 150;
const THUMBNAIL_DELAY = 1000;

export interface Preview {
  image: ImageBitmap;
  region: Region;
}

interface PreviewOptions {
  content: ArtboardState;
  width: number;
  height: number;
  /** What was loaded, or null for a new artboard; undefined while loading. */
  restored: ArtboardState | null | undefined;
  /** No thumbnail is saved yet, so make one even if nothing changes. */
  needsThumbnail: boolean;
  onThumbnail: (thumbnail: Blob) => void;
}

/** The photocopied preview, and the artboard's thumbnail made from it. */
export function usePreview({
  content,
  width,
  height,
  restored,
  needsThumbnail,
  onThumbnail,
}: PreviewOptions) {
  const { layers, settings } = content;
  const [preview, setPreview] = useState<Preview | null>(null);
  // In resolution steps, so most zooms don't re-render the preview.
  const [scale, setScale] = useState<number | null>(null);
  const latestRequest = useRef(0);
  const hasRendered = useRef(false);

  // Frees each preview's bitmap once a newer one (or none) replaces it.
  useEffect(() => () => preview?.image.close(), [preview]);

  useEffect(() => {
    if (layers.length === 0 || scale === null) {
      // Also retires any preview still rendering, so it can't land afterward.
      latestRequest.current += 1;
      setPreview(null);
      return;
    }
    const region = { x: 0, y: 0, width, height };
    const request = ++latestRequest.current;
    const timer = setTimeout(
      async () => {
        try {
          const image = await renderPreview(layers, region, scale, settings);
          if (request !== latestRequest.current) {
            image.close();
            return;
          }
          hasRendered.current = true;
          setPreview({ image, region });
        } catch (cause) {
          // The canvas keeps showing the photos themselves; the next change retries.
          console.warn("Preview failed", cause);
          if (request === latestRequest.current) setPreview(null);
        }
      },
      // The first preview isn't replacing anything on screen, so it needn't wait.
      hasRendered.current ? PREVIEW_DELAY : 0,
    );
    return () => clearTimeout(timer);
  }, [layers, settings, scale, width, height]);

  // A preview that lands after closing would otherwise never be freed.
  useEffect(
    () => () => {
      latestRequest.current += 1;
    },
    [],
  );

  const setViewScale = useCallback(
    (viewScale: number) =>
      setScale(resolutionStep(viewScale * screenPixelRatio())),
    [],
  );

  const isLoaded = restored !== undefined;
  // Only content changes need a new thumbnail, not a zoom's sharper preview.
  const isThumbnailStale = useRef(needsThumbnail);
  useEffect(() => {
    if (isLoaded && !(restored && sameArtboardState(restored, content))) {
      isThumbnailStale.current = true;
    }
  }, [isLoaded, restored, content]);

  const hasLayers = layers.length > 0;
  const color = content.background.color;
  const saveThumbnail = useCallback(async () => {
    // Photos without a preview yet would make a blank thumbnail.
    if (!isThumbnailStale.current || (hasLayers && !preview)) return;
    isThumbnailStale.current = false;
    try {
      onThumbnail(await renderThumbnail({ width, height }, color, preview));
    } catch (cause) {
      isThumbnailStale.current = true;
      console.warn("Couldn’t make a thumbnail", cause);
    }
  }, [hasLayers, preview, width, height, color, onThumbnail]);

  useEffect(() => {
    if (!isLoaded) return;
    const timer = setTimeout(saveThumbnail, THUMBNAIL_DELAY);
    return () => clearTimeout(timer);
  }, [isLoaded, saveThumbnail]);

  return { preview, setViewScale, saveThumbnail };
}

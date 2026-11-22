import type { ArtboardSummary } from "./persistence";

const ids = (artboards: ArtboardSummary[]) =>
  artboards.map((artboard) => artboard.id);

/** Changes when the saved index (the order and the open artboard) needs saving. */
export function indexKey(artboards: ArtboardSummary[], activeId: string) {
  return `${ids(artboards).join()}|${activeId}`;
}

export function insertAfter(
  artboards: ArtboardSummary[],
  afterId: string,
  artboard: ArtboardSummary,
) {
  const next = [...artboards];
  next.splice(ids(artboards).indexOf(afterId) + 1, 0, artboard);
  return next;
}

export function reorderArtboards(
  artboards: ArtboardSummary[],
  order: string[],
) {
  const byId = new Map(artboards.map((artboard) => [artboard.id, artboard]));
  return order.flatMap((id) => byId.get(id) ?? []);
}

export function withChanges(
  artboards: ArtboardSummary[],
  id: string,
  changes: Partial<ArtboardSummary>,
) {
  return artboards.map((artboard) =>
    artboard.id === id ? { ...artboard, ...changes } : artboard,
  );
}

export function artboardBeside(
  artboards: ArtboardSummary[],
  id: string,
  direction: 1 | -1,
) {
  if (artboards.length < 2) return null;
  const index = ids(artboards).indexOf(id);
  return artboards[(index + direction + artboards.length) % artboards.length]
    .id;
}

export function withoutArtboard(artboards: ArtboardSummary[], id: string) {
  const index = ids(artboards).indexOf(id);
  const remaining = artboards.filter((artboard) => artboard.id !== id);
  const next = remaining[Math.min(index, remaining.length - 1)];
  return { remaining, nextId: next?.id ?? null };
}

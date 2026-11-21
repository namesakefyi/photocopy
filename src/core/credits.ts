import type { Credit, Layer } from "./types";

/** One line of attribution, in the TASL style Creative Commons recommends. */
export function formatCredit({
  title,
  author,
  license,
  sourceUrl,
  source,
}: Credit) {
  return `“${title}” by ${author}, ${license}, via ${source} (${sourceUrl})`;
}

export function creditsOf(layers: Layer[]): Credit[] {
  const credits = layers.flatMap((layer) =>
    layer.visible && layer.credit ? [layer.credit] : [],
  );
  return [...new Map(credits.map((c) => [c.sourceUrl, c])).values()];
}

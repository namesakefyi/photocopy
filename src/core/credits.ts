import type { Credit, Layer } from "./types";

/** One line of attribution, in the TASL style Creative Commons recommends. */
export function formatCredit({
  title,
  author,
  license,
  sourceUrl,
  source,
}: Credit) {
  return `“${title}” by ${author}, ${license}, via ${creditSource(source)} (${sourceUrl})`;
}

/** The earliest saved credits have no source; they all came from Commons. */
export function creditSource(source?: string) {
  return source ?? "Wikimedia Commons";
}

export function creditsOf(layers: Layer[]): Credit[] {
  const credits = layers.flatMap((layer) =>
    layer.visible && layer.credit ? [layer.credit] : [],
  );
  return [...new Map(credits.map((c) => [c.sourceUrl, c])).values()];
}

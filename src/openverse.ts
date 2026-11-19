import type { Credit } from "./types";

const API = "https://api.openverse.org/v1/images/";
/** The most Openverse allows without an API key. */
const PAGE_SIZE = 20;
const NO_ATTRIBUTION = ["cc0", "pdm"];

export interface OpenverseResult {
  id: string;
  url: string;
  thumbnail: string;
  credit: Credit;
}

interface OpenverseImage {
  id: string;
  title?: string | null;
  url: string;
  thumbnail?: string | null;
  creator?: string | null;
  license: string;
  license_version?: string | null;
  license_url?: string | null;
  foreign_landing_url?: string | null;
}

interface ApiResponse {
  page_count: number;
  results: OpenverseImage[];
}

function licenseName(license: string, version?: string | null) {
  const name =
    license === "pdm"
      ? "Public Domain Mark"
      : license === "cc0"
        ? "CC0"
        : `CC ${license.toUpperCase()}`;
  return version ? `${name} ${version}` : name;
}

function siteName(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return undefined;
  }
}

function creditFrom(image: OpenverseImage): Credit {
  const sourceUrl = image.foreign_landing_url || image.url;
  return {
    title: image.title?.trim() || "Untitled",
    author: image.creator?.trim() || "Unknown author",
    license: licenseName(image.license, image.license_version),
    licenseUrl: image.license_url ?? undefined,
    sourceUrl,
    source: siteName(sourceUrl),
    attributionRequired: !NO_ATTRIBUTION.includes(image.license),
  };
}

export class OpenverseError extends Error {
  constructor(readonly status: number) {
    super(`Openverse returned ${status}`);
  }
}

/** What to tell someone when a search fails. */
export function searchErrorMessage(error: unknown) {
  const status = error instanceof OpenverseError ? error.status : null;
  if (status === 429) {
    return "Openverse is getting too many requests. Try again in a minute.";
  }
  if (status === 502 || status === 503 || status === 504) {
    return "Openverse is slow to respond right now. Try again in a moment.";
  }
  return "Couldn’t reach Openverse. Try again.";
}

/** Only licenses that allow modification, since every copy changes the photo. */
export async function searchOpenverse(search: string, { page = 1 } = {}) {
  const url = new URL(API);
  url.search = new URLSearchParams({
    q: search,
    category: "photograph",
    page: String(page),
    page_size: String(PAGE_SIZE),
    license_type: "commercial,modification",
  }).toString();
  const response = await fetch(url);
  if (!response.ok) throw new OpenverseError(response.status);
  const data = (await response.json()) as ApiResponse;
  const results: OpenverseResult[] = data.results.map((image) => ({
    id: image.id,
    url: image.url,
    thumbnail: image.thumbnail || image.url,
    credit: creditFrom(image),
  }));
  return { results, nextPage: page < data.page_count ? page + 1 : null };
}

async function fetchImage(url: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Download failed: ${response.status}`);
  const blob = await response.blob();
  if (!blob.type.startsWith("image/")) throw new Error("Not an image");
  return blob;
}

/** Not every site allows cross-origin downloads, so fall back to Openverse's proxy. */
export async function downloadOpenverse(result: OpenverseResult) {
  const blob = await fetchImage(result.url).catch(() =>
    fetchImage(`${API}${result.id}/thumb/?full_size=true`),
  );
  return new File([blob], result.credit.title, { type: blob.type });
}

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

/** Credits saved before the switch to Openverse all came from Commons. */
export function creditSource(source?: string) {
  return source ?? "Wikimedia Commons";
}

import type { Credit } from "./types";

const API = "https://commons.wikimedia.org/w/api.php";
const PAGE_SIZE = 30;
/** Matches the largest side photos are kept at once loaded. */
const FULL_WIDTH = 2560;
const THUMB_WIDTH = 320;
/**
 * Structured-data filter for files marked public domain (P6216) or licensed
 * CC0 (P275), the licenses that don't require attribution.
 */
const NO_ATTRIBUTION = "haswbstatement:P6216=Q19652|P275=Q6938433";

export interface CommonsResult {
  title: string;
  thumbnail: string;
  width: number;
  height: number;
  credit: Credit;
}

interface ImageInfo {
  url: string;
  thumburl?: string;
  width: number;
  height: number;
  descriptionurl: string;
  extmetadata?: Record<string, { value: string } | undefined>;
}

interface ApiResponse {
  continue?: { gsroffset?: number };
  query?: {
    pages?: { title: string; index?: number; imageinfo?: ImageInfo[] }[];
  };
}

/** Commons metadata fields are HTML; credits need plain text. */
function plainText(html = "") {
  return (
    new DOMParser().parseFromString(html, "text/html").body.textContent ?? ""
  )
    .replace(/\s+/g, " ")
    .trim();
}

function creditFrom(title: string, info: ImageInfo): Credit {
  const meta = info.extmetadata ?? {};
  return {
    title: plainText(meta.ObjectName?.value) || title.replace(/^File:/, ""),
    author: plainText(meta.Artist?.value) || "Unknown author",
    license: plainText(meta.LicenseShortName?.value) || "See source",
    licenseUrl: meta.LicenseUrl?.value,
    sourceUrl: info.descriptionurl,
    attributionRequired: meta.AttributionRequired?.value !== "false",
  };
}

async function query(params: Record<string, string>) {
  const url = new URL(API);
  url.search = new URLSearchParams({
    action: "query",
    format: "json",
    formatversion: "2",
    origin: "*",
    prop: "imageinfo",
    iiprop: "url|size|extmetadata",
    iiextmetadatafilter:
      "ObjectName|Artist|LicenseShortName|LicenseUrl|AttributionRequired",
    ...params,
  }).toString();
  const response = await fetch(url, {
    headers: {
      "Api-User-Agent": "Namesake-Copyshop/0.1 (https://namesake.fyi)",
    },
  });
  if (!response.ok) throw new Error(`Commons returned ${response.status}`);
  return (await response.json()) as ApiResponse;
}

/** Searches photos (not drawings or diagrams) on Wikimedia Commons. */
export async function searchCommons(
  search: string,
  { offset = 0, noAttributionOnly = false } = {},
) {
  const filters = noAttributionOnly
    ? `filetype:bitmap ${NO_ATTRIBUTION}`
    : "filetype:bitmap";
  const data = await query({
    generator: "search",
    gsrsearch: `${search} ${filters}`,
    gsrnamespace: "6",
    gsrlimit: String(PAGE_SIZE),
    gsroffset: String(offset),
    iiurlwidth: String(THUMB_WIDTH),
  });
  const pages = [...(data.query?.pages ?? [])].sort(
    (a, b) => (a.index ?? 0) - (b.index ?? 0),
  );
  const results: CommonsResult[] = pages.flatMap((page) => {
    const info = page.imageinfo?.[0];
    if (!info) return [];
    return [
      {
        title: page.title,
        thumbnail: info.thumburl ?? info.url,
        width: info.width,
        height: info.height,
        credit: creditFrom(page.title, info),
      },
    ];
  });
  return { results, nextOffset: data.continue?.gsroffset ?? null };
}

/** Downloads a large copy of a Commons file, ready to load as a layer. */
export async function downloadCommons(result: CommonsResult) {
  const data = await query({
    titles: result.title,
    iiurlwidth: String(FULL_WIDTH),
  });
  const info = data.query?.pages?.[0]?.imageinfo?.[0];
  if (!info) throw new Error("File not found on Commons");
  const response = await fetch(info.thumburl ?? info.url);
  if (!response.ok) throw new Error(`Download failed: ${response.status}`);
  const blob = await response.blob();
  return new File([blob], result.title.replace(/^File:/, ""), {
    type: blob.type,
  });
}

/** One line of attribution, in the TASL style Creative Commons recommends. */
export function formatCredit({ title, author, license, sourceUrl }: Credit) {
  return `“${title}” by ${author}, ${license}, via Wikimedia Commons (${sourceUrl})`;
}

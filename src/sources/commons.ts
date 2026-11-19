import {
  clean,
  downloadImage,
  fetchJson,
  type ImageResult,
  type ImageSource,
  PAGE_SIZE,
} from "../imageSearch";
import type { Credit } from "../types";

const NAME = "Wikimedia Commons";
const API = "https://commons.wikimedia.org/w/api.php";
/** Matches the largest side photos are kept at once loaded. */
const FULL_WIDTH = 2560;
const THUMB_WIDTH = 330;

interface ImageInfo {
  url: string;
  thumburl?: string;
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
  return clean(
    new DOMParser().parseFromString(html, "text/html").body.textContent,
  );
}

function creditFrom(title: string, info: ImageInfo): Credit {
  const meta = info.extmetadata ?? {};
  return {
    title: plainText(meta.ObjectName?.value) || title.replace(/^File:/, ""),
    author: plainText(meta.Artist?.value) || "Unknown author",
    license: plainText(meta.LicenseShortName?.value) || "See source",
    licenseUrl: meta.LicenseUrl?.value,
    sourceUrl: info.descriptionurl,
    source: NAME,
    attributionRequired: meta.AttributionRequired?.value !== "false",
  };
}

function query(params: Record<string, string>, signal?: AbortSignal) {
  const url = new URL(API);
  url.search = new URLSearchParams({
    action: "query",
    format: "json",
    formatversion: "2",
    origin: "*",
    prop: "imageinfo",
    iiprop: "url|extmetadata",
    iiextmetadatafilter:
      "ObjectName|Artist|LicenseShortName|LicenseUrl|AttributionRequired",
    ...params,
  }).toString();
  return fetchJson<ApiResponse>(NAME, url, {
    signal,
    headers: {
      "Api-User-Agent": "Namesake-Photocopy/0.1 (https://namesake.fyi)",
    },
  });
}

/** Asks again for a large copy, since search only returns thumbnails. */
async function download(title: string) {
  const data = await query({ titles: title, iiurlwidth: String(FULL_WIDTH) });
  const info = data.query?.pages?.[0]?.imageinfo?.[0];
  if (!info) throw new Error("File not found on Commons");
  return downloadImage(
    [info.thumburl ?? info.url],
    title.replace(/^File:/, ""),
  );
}

/** Commons only hosts freely licensed files, so no license filter is needed. */
export const commons: ImageSource = {
  id: "commons",
  label: "Wikimedia Commons",
  name: NAME,
  async search(search, page, signal) {
    const data = await query(
      {
        generator: "search",
        gsrsearch: `${search} filetype:bitmap`,
        gsrnamespace: "6",
        gsrlimit: String(PAGE_SIZE),
        gsroffset: String((page - 1) * PAGE_SIZE),
        iiurlwidth: String(THUMB_WIDTH),
      },
      signal,
    );
    const pages = [...(data.query?.pages ?? [])].sort(
      (a, b) => (a.index ?? 0) - (b.index ?? 0),
    );
    const results: ImageResult[] = pages.flatMap((page) => {
      const info = page.imageinfo?.[0];
      if (!info) return [];
      return [
        {
          id: page.title,
          thumbnail: info.thumburl ?? info.url,
          credit: creditFrom(page.title, info),
          download: () => download(page.title),
        },
      ];
    });
    return {
      results,
      nextPage: data.continue?.gsroffset != null ? page + 1 : null,
    };
  },
};

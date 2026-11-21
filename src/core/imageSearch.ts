import type { Credit } from "./types";

export interface ImageResult {
  id: string;
  thumbnail: string;
  credit: Credit;
  download: () => Promise<File>;
}

export interface SearchPage {
  results: ImageResult[];
  nextPage: number | null;
}

export interface ImageSource {
  id: string;
  label: string;
  name: string;
  search: (
    search: string,
    page: number,
    signal?: AbortSignal,
  ) => Promise<SearchPage>;
}

export const PAGE_SIZE = 30;

export const CC0 = {
  license: "CC0 1.0",
  licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
};

export const PUBLIC_DOMAIN_MARK = {
  license: "Public Domain Mark 1.0",
  licenseUrl: "https://creativecommons.org/publicdomain/mark/1.0/",
};

export class SearchError extends Error {
  constructor(
    readonly source: string,
    readonly status: number,
  ) {
    super(`${source} returned ${status}`);
  }
}

export async function fetchJson<T>(
  source: string,
  api: string,
  params: Record<string, string>,
  init?: RequestInit,
) {
  const response = await fetch(`${api}?${new URLSearchParams(params)}`, init);
  if (!response.ok) throw new SearchError(source, response.status);
  return (await response.json()) as T;
}

export function searchErrorMessage(error: unknown, source: string) {
  const status = error instanceof SearchError ? error.status : null;
  if (status === 429) {
    return `${source} is getting too many requests. Try again in a minute.`;
  }
  if (status === 502 || status === 503 || status === 504) {
    return `${source} is slow to respond right now. Try again in a moment.`;
  }
  return `Couldn’t reach ${source}. Try again.`;
}

async function fetchImage(url: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Download failed: ${response.status}`);
  const blob = await response.blob();
  if (!blob.type.startsWith("image/")) throw new Error("Not an image");
  return blob;
}

export async function downloadImage(urls: string[], name: string) {
  let error: unknown = new Error("No image to download");
  for (const url of urls) {
    try {
      const blob = await fetchImage(url);
      return new File([blob], name, { type: blob.type });
    } catch (caught) {
      error = caught;
    }
  }
  throw error;
}

export function clean(text?: string | null) {
  return text?.replace(/\s+/g, " ").trim() ?? "";
}

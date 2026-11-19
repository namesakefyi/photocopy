import {
  clean,
  downloadImage,
  fetchJson,
  type ImageSource,
  PAGE_SIZE,
  PUBLIC_DOMAIN_MARK,
} from "../imageSearch";

const NAME = "SMK – National Gallery of Denmark";
const API = "https://api.smk.dk/api/v1/art/search/";

interface Artwork {
  id: string;
  object_number?: string;
  titles?: { title: string; language?: string }[];
  production?: { creator?: string }[];
  image_thumbnail?: string;
  image_iiif_id?: string;
  frontend_url?: string;
  rights?: string;
}

interface ApiResponse {
  found: number;
  items?: Artwork[];
}

/** SMK titles are mostly Danish; prefer an English one when there is one. */
function titleOf(artwork: Artwork) {
  const titles = artwork.titles ?? [];
  const title =
    titles.find((title) => title.language === "engelsk") ?? titles[0];
  return clean(title?.title) || "Untitled";
}

/** Creators are filed "Surname, Forename". */
function authorOf(artwork: Artwork) {
  const creator = clean(artwork.production?.[0]?.creator);
  if (!creator) return "Unknown artist";
  const [surname, forename] = creator.split(/,\s*/);
  return forename ? `${forename} ${surname}` : creator;
}

export const smk: ImageSource = {
  id: "smk",
  label: "SMK",
  name: NAME,
  async search(search, page, signal) {
    const url = new URL(API);
    url.search = new URLSearchParams({
      keys: search,
      lang: "en",
      offset: String((page - 1) * PAGE_SIZE),
      rows: String(PAGE_SIZE),
      filters: "[public_domain:true],[has_image:true]",
    }).toString();
    const data = await fetchJson<ApiResponse>(NAME, url, { signal });
    const items = (data.items ?? []).filter(
      (artwork) => artwork.image_iiif_id && artwork.image_thumbnail,
    );
    return {
      results: items.map((artwork) => {
        const title = titleOf(artwork);
        const iiif = artwork.image_iiif_id as string;
        // The API's thumbnails are 1024px, far larger than the grid needs.
        const thumbnail = (artwork.image_thumbnail as string).replace(
          /\/full\/[^/]+\//,
          "/full/!400,/",
        );
        return {
          id: artwork.id,
          thumbnail,
          credit: {
            title,
            author: authorOf(artwork),
            ...PUBLIC_DOMAIN_MARK,
            sourceUrl:
              artwork.frontend_url ??
              `https://open.smk.dk/artwork/image/${artwork.object_number}`,
            source: "SMK",
            attributionRequired: false,
          },
          download: () =>
            downloadImage(
              [
                `${iiif}/full/!2560,2560/0/default.jpg`,
                artwork.image_thumbnail as string,
              ],
              title,
            ),
        };
      }),
      nextPage: page * PAGE_SIZE < data.found ? page + 1 : null,
    };
  },
};

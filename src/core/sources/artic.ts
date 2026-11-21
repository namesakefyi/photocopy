import {
  CC0,
  clean,
  downloadImage,
  fetchJson,
  type ImageSource,
  PAGE_SIZE,
} from "../imageSearch";

const NAME = "Art Institute of Chicago";
const API = "https://api.artic.edu/api/v1/artworks/search";
const IIIF = "https://www.artic.edu/iiif/2";

interface Artwork {
  id: number;
  title?: string | null;
  artist_display?: string | null;
  image_id: string;
}

interface ApiResponse {
  pagination: { total_pages: number };
  data: Artwork[];
}

/** The widths the Art Institute serves; 1686 isn't available for every work. */
const image = (id: string, width: number) =>
  `${IIIF}/${id}/full/${width},/0/default.jpg`;

/** Public domain works, which the Art Institute releases under CC0. */
export const artic: ImageSource = {
  id: "artic",
  label: "Art Institute of Chicago",
  name: NAME,
  async search(search, page, signal) {
    const data = await fetchJson<ApiResponse>(
      NAME,
      API,
      {
        q: search,
        page: String(page),
        limit: String(PAGE_SIZE),
        fields: "id,title,artist_display,image_id",
        "query[bool][filter][0][term][is_public_domain]": "true",
        "query[bool][filter][1][exists][field]": "image_id",
      },
      {
        signal,
        // The API's requested stand-in for User-Agent, which browsers can't set.
        headers: {
          "AIC-User-Agent": "Namesake-Photocopy/0.1 (hey@namesake.fyi)",
        },
      },
    );
    return {
      results: data.data.map((artwork) => {
        const title = clean(artwork.title) || "Untitled";
        return {
          id: String(artwork.id),
          thumbnail: image(artwork.image_id, 400),
          credit: {
            title,
            // The first line names the artist; the rest is nationality and dates.
            author:
              clean(artwork.artist_display?.split("\n")[0]) || "Unknown artist",
            ...CC0,
            sourceUrl: `https://www.artic.edu/artworks/${artwork.id}`,
            source: NAME,
            attributionRequired: false,
          },
          download: () =>
            downloadImage(
              [image(artwork.image_id, 1686), image(artwork.image_id, 843)],
              title,
            ),
        };
      }),
      nextPage: page < data.pagination.total_pages ? page + 1 : null,
    };
  },
};

import {
  clean,
  downloadImage,
  fetchJson,
  type ImageSource,
  PAGE_SIZE,
} from "../imageSearch";

const NAME = "Wellcome Collection";
const API = "https://api.wellcomecollection.org/catalogue/v2/images";
/** Licenses that allow changes and commercial use. */
const LICENSES = ["cc-0", "cc-by", "cc-by-sa", "pdm"];
const NO_ATTRIBUTION = ["cc-0", "pdm"];

interface Location {
  url: string;
  credit?: string;
  license?: { id: string; label: string; url?: string };
}

interface Image {
  id: string;
  locations: Location[];
  source: {
    id: string;
    title?: string;
    contributors?: { agent: { label: string } }[];
  };
}

interface ApiResponse {
  totalPages: number;
  results: Image[];
}

/** Labels read like "Attribution 4.0 International (CC BY 4.0)". */
function licenseName(license: Location["license"]) {
  if (!license) return "See source";
  if (license.id === "pdm") return "Public Domain Mark";
  return license.label.match(/\(([^)]+)\)/)?.[1] ?? license.label;
}

export const wellcome: ImageSource = {
  id: "wellcome",
  name: NAME,
  async search(search, page, signal) {
    const data = await fetchJson<ApiResponse>(
      NAME,
      API,
      {
        query: search,
        page: String(page),
        pageSize: String(PAGE_SIZE),
        "locations.license": LICENSES.join(","),
        include: "source.contributors",
      },
      { signal },
    );
    return {
      results: data.results.flatMap((image) => {
        const location = image.locations[0];
        if (!location) return [];
        const base = location.url.replace(/\/info\.json$/, "");
        const title = clean(image.source.title) || "Untitled";
        const contributors = (image.source.contributors ?? [])
          .map((contributor) => clean(contributor.agent.label))
          .filter(Boolean);
        return [
          {
            id: image.id,
            thumbnail: `${base}/full/!400,400/0/default.jpg`,
            credit: {
              title,
              author: contributors.join(", ") || clean(location.credit) || NAME,
              license: licenseName(location.license),
              licenseUrl: location.license?.url,
              sourceUrl: `https://wellcomecollection.org/works/${image.source.id}/images?id=${image.id}`,
              source: NAME,
              attributionRequired: !NO_ATTRIBUTION.includes(
                location.license?.id ?? "",
              ),
            },
            download: () =>
              downloadImage([`${base}/full/!2560,2560/0/default.jpg`], title),
          },
        ];
      }),
      nextPage: page < data.totalPages ? page + 1 : null,
    };
  },
};

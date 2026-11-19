// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { formatCredit } from "../credits";
import { downloadImage, SearchError, searchErrorMessage } from "../imageSearch";
import { artic } from "./artic";
import { commons } from "./commons";
import { smk } from "./smk";
import { wellcome } from "./wellcome";

afterEach(() => {
  vi.unstubAllGlobals();
});

interface StubResponse {
  ok?: boolean;
  status?: number;
  body?: unknown;
  type?: string;
}

/** The options each stubbed fetch was called with, in order. */
let inits: (RequestInit | undefined)[] = [];

/** Answers each fetch with the next response (the last one repeats). */
function stubFetch(...responses: StubResponse[]) {
  const urls: URL[] = [];
  inits = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: URL | string, init?: RequestInit) => {
      urls.push(new URL(input));
      inits.push(init);
      const response =
        responses[Math.min(urls.length, responses.length) - 1] ?? {};
      return {
        ok: response.ok ?? true,
        status: response.status ?? 200,
        json: async () => response.body,
        blob: async () =>
          new Blob(["image"], { type: response.type ?? "image/jpeg" }),
      };
    }),
  );
  return urls;
}

describe("commons", () => {
  const page = (title: string, index: number, meta = {}) => ({
    title,
    index,
    imageinfo: [
      {
        url: `https://upload.example/${title}`,
        thumburl: `https://upload.example/thumb/${title}`,
        descriptionurl: `https://commons.wikimedia.org/wiki/${title}`,
        extmetadata: meta,
      },
    ],
  });

  it("asks for bitmaps at the page's offset", async () => {
    const urls = stubFetch({ body: { query: { pages: [] } } });
    await commons.search("cat", 3);
    const params = urls[0].searchParams;
    expect(params.get("gsrsearch")).toBe("cat filetype:bitmap");
    expect(params.get("gsroffset")).toBe("60");
    expect(params.get("origin")).toBe("*");
  });

  it("keeps search order and has a next page while Commons continues", async () => {
    stubFetch({
      body: {
        continue: { gsroffset: 30 },
        query: { pages: [page("File:B.jpg", 2), page("File:A.jpg", 1)] },
      },
    });
    const { results, nextPage } = await commons.search("cat", 1);
    expect(results.map((result) => result.id)).toEqual([
      "File:A.jpg",
      "File:B.jpg",
    ]);
    expect(nextPage).toBe(2);
  });

  it("builds plain-text credits from HTML metadata", async () => {
    stubFetch({
      body: {
        query: {
          pages: [
            page("File:A.jpg", 1, {
              Artist: { value: '<a href="/wiki/User:Jo">Jo  Smith</a>' },
              LicenseShortName: { value: "CC BY-SA 4.0" },
              AttributionRequired: { value: "true" },
            }),
          ],
        },
      },
    });
    const { results, nextPage } = await commons.search("cat", 1);
    expect(nextPage).toBeNull();
    expect(results[0].credit).toEqual({
      title: "A.jpg",
      author: "Jo Smith",
      license: "CC BY-SA 4.0",
      licenseUrl: undefined,
      sourceUrl: "https://commons.wikimedia.org/wiki/File:A.jpg",
      source: "Wikimedia Commons",
      attributionRequired: true,
    });
  });

  it("downloads a large copy by asking for the file again", async () => {
    const urls = stubFetch(
      { body: { query: { pages: [page("File:A.jpg", 1)] } } },
      { body: { query: { pages: [page("File:A.jpg", 1)] } } },
      {},
    );
    const [result] = (await commons.search("cat", 1)).results;
    const file = await result.download();
    expect(urls[1].searchParams.get("titles")).toBe("File:A.jpg");
    expect(urls[1].searchParams.get("iiurlwidth")).toBe("2560");
    expect(urls[2].href).toBe("https://upload.example/thumb/File:A.jpg");
    expect(file.name).toBe("A.jpg");
  });
});

describe("artic", () => {
  const artwork = {
    id: 42,
    title: "Side Chair",
    artist_display: "Made by Jacob and Josef Kohn\nAustria, Vienna",
    image_id: "img",
  };

  it("asks for public domain works with images", async () => {
    const urls = stubFetch({
      body: { pagination: { total_pages: 1 }, data: [] },
    });
    await artic.search("chair", 2);
    const params = urls[0].searchParams;
    expect(params.get("q")).toBe("chair");
    expect(params.get("page")).toBe("2");
    expect(params.get("query[bool][filter][0][term][is_public_domain]")).toBe(
      "true",
    );
    expect(params.get("query[bool][filter][1][exists][field]")).toBe(
      "image_id",
    );
  });

  it("identifies the app, as the Art Institute asks", async () => {
    stubFetch({ body: { pagination: { total_pages: 1 }, data: [] } });
    await artic.search("chair", 1);
    expect(new Headers(inits[0]?.headers).get("AIC-User-Agent")).toBe(
      "Namesake-Photocopy/0.1 (hey@namesake.fyi)",
    );
  });

  it("passes the abort signal through", async () => {
    stubFetch({ body: { pagination: { total_pages: 1 }, data: [] } });
    const controller = new AbortController();
    await artic.search("chair", 1, controller.signal);
    expect(inits[0]?.signal).toBe(controller.signal);
  });

  it("credits the artist and CC0", async () => {
    stubFetch({ body: { pagination: { total_pages: 3 }, data: [artwork] } });
    const { results, nextPage } = await artic.search("chair", 1);
    expect(nextPage).toBe(2);
    expect(results[0].thumbnail).toBe(
      "https://www.artic.edu/iiif/2/img/full/400,/0/default.jpg",
    );
    expect(results[0].credit).toMatchObject({
      title: "Side Chair",
      author: "Made by Jacob and Josef Kohn",
      license: "CC0 1.0",
      sourceUrl: "https://www.artic.edu/artworks/42",
      attributionRequired: false,
    });
  });

  it("falls back to a smaller size when the large one fails", async () => {
    const urls = stubFetch(
      { body: { pagination: { total_pages: 1 }, data: [artwork] } },
      { ok: false, status: 403 },
      {},
    );
    const [result] = (await artic.search("chair", 1)).results;
    await result.download();
    expect(urls.slice(1).map((url) => url.pathname)).toEqual([
      "/iiif/2/img/full/1686,/0/default.jpg",
      "/iiif/2/img/full/843,/0/default.jpg",
    ]);
  });
});

describe("smk", () => {
  const artwork = {
    id: "1_object",
    titles: [
      { title: "Interiør", language: "dansk" },
      { title: "Interior", language: "engelsk" },
    ],
    production: [{ creator: "Hammershøi, Vilhelm" }],
    image_thumbnail:
      "https://iip-thumb.smk.dk/iiif/jp2/a.jp2/full/!1024,/0/default.jpg",
    image_iiif_id: "https://iip.smk.dk/iiif/jp2/a.jp2",
    frontend_url: "https://open.smk.dk/artwork/image/KMS1",
  };

  it("asks for public domain works with images", async () => {
    const urls = stubFetch({ body: { found: 0, items: [] } });
    await smk.search("chair", 2);
    const params = urls[0].searchParams;
    expect(params.get("keys")).toBe("chair");
    expect(params.get("offset")).toBe("30");
    expect(params.get("filters")).toBe("[public_domain:true],[has_image:true]");
  });

  it("prefers English titles and names artists forename first", async () => {
    stubFetch({ body: { found: 31, items: [artwork, { id: "no-image" }] } });
    const { results, nextPage } = await smk.search("chair", 1);
    expect(nextPage).toBe(2);
    expect(results).toHaveLength(1);
    expect(results[0].thumbnail).toBe(
      "https://iip-thumb.smk.dk/iiif/jp2/a.jp2/full/!400,/0/default.jpg",
    );
    expect(results[0].credit).toMatchObject({
      title: "Interior",
      author: "Vilhelm Hammershøi",
      license: "Public Domain Mark 1.0",
      sourceUrl: "https://open.smk.dk/artwork/image/KMS1",
      attributionRequired: false,
    });
  });
});

describe("wellcome", () => {
  const image = (license: { id: string; label: string }) => ({
    id: "img1",
    locations: [
      {
        url: "https://iiif.wellcomecollection.org/image/L1/info.json",
        credit: "Wellcome Collection",
        license,
      },
    ],
    source: { id: "work1", title: "Parturition chair", contributors: [] },
  });

  it("asks only for licenses that allow changes and commercial use", async () => {
    const urls = stubFetch({ body: { totalPages: 1, results: [] } });
    await wellcome.search("chair", 2);
    const params = urls[0].searchParams;
    expect(params.get("query")).toBe("chair");
    expect(params.get("page")).toBe("2");
    expect(params.get("locations.license")).toBe("cc-0,cc-by,cc-by-sa,pdm");
  });

  it("shortens license names and credits the collection", async () => {
    stubFetch({
      body: {
        totalPages: 2,
        results: [
          image({
            id: "cc-by",
            label: "Attribution 4.0 International (CC BY 4.0)",
          }),
        ],
      },
    });
    const { results, nextPage } = await wellcome.search("chair", 1);
    expect(nextPage).toBe(2);
    expect(results[0].thumbnail).toBe(
      "https://iiif.wellcomecollection.org/image/L1/full/!400,400/0/default.jpg",
    );
    expect(results[0].credit).toMatchObject({
      title: "Parturition chair",
      author: "Wellcome Collection",
      license: "CC BY 4.0",
      sourceUrl: "https://wellcomecollection.org/works/work1/images?id=img1",
      attributionRequired: true,
    });
  });

  it("marks public domain images as needing no credit", async () => {
    stubFetch({
      body: {
        totalPages: 1,
        results: [image({ id: "pdm", label: "Public Domain Mark" })],
      },
    });
    const [{ credit }] = (await wellcome.search("chair", 1)).results;
    expect(credit.license).toBe("Public Domain Mark");
    expect(credit.attributionRequired).toBe(false);
  });
});

describe("searchErrorMessage", () => {
  it("names the source that failed", () => {
    expect(searchErrorMessage(new SearchError("SMK", 429), "SMK")).toBe(
      "SMK is getting too many requests. Try again in a minute.",
    );
    expect(searchErrorMessage(new SearchError("SMK", 503), "SMK")).toContain(
      "slow to respond",
    );
    expect(searchErrorMessage(new TypeError("Failed to fetch"), "SMK")).toBe(
      "Couldn’t reach SMK. Try again.",
    );
  });

  it("is thrown for error responses", async () => {
    stubFetch({ ok: false, status: 503 });
    await expect(artic.search("chair", 1)).rejects.toThrow(
      new SearchError("Art Institute of Chicago", 503),
    );
  });
});

describe("downloadImage", () => {
  it("skips responses that aren't images", async () => {
    const urls = stubFetch({ type: "text/html" }, {});
    const file = await downloadImage(
      ["https://a.example", "https://b.example"],
      "Cat",
    );
    expect(urls).toHaveLength(2);
    expect(file.name).toBe("Cat");
  });

  it("fails when no copy downloads", async () => {
    stubFetch({ ok: false, status: 404 });
    await expect(downloadImage(["https://a.example"], "Cat")).rejects.toThrow(
      "404",
    );
  });
});

describe("formatCredit", () => {
  const credit = {
    title: "Cat",
    author: "Jo",
    license: "CC BY 4.0",
    sourceUrl: "https://example.org/cat",
    attributionRequired: true,
  };

  it("writes a TASL-style line naming the source", () => {
    expect(formatCredit({ ...credit, source: "SMK" })).toBe(
      "“Cat” by Jo, CC BY 4.0, via SMK (https://example.org/cat)",
    );
  });

  it("credits Commons for the earliest saved photos", () => {
    expect(formatCredit(credit)).toContain("via Wikimedia Commons");
  });
});

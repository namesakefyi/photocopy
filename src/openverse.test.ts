import { afterEach, describe, expect, it, vi } from "vitest";
import {
  downloadOpenverse,
  formatCredit,
  OpenverseError,
  type OpenverseResult,
  searchErrorMessage,
  searchOpenverse,
} from "./openverse";

afterEach(() => {
  vi.unstubAllGlobals();
});

interface StubResponse {
  ok?: boolean;
  status?: number;
  body?: unknown;
  type?: string;
}

/** Answers each fetch with the next response (the last one repeats). */
function stubFetch(...responses: StubResponse[]) {
  const urls: URL[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: URL | string) => {
      urls.push(new URL(input));
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

const image = (id: string, fields = {}) => ({
  id,
  title: `Photo ${id}`,
  url: `https://live.staticflickr.com/${id}.jpg`,
  thumbnail: `https://api.openverse.org/v1/images/${id}/thumb/`,
  creator: "Jo Smith",
  license: "by-sa",
  license_version: "4.0",
  license_url: "https://creativecommons.org/licenses/by-sa/4.0/",
  foreign_landing_url: `https://www.flickr.com/photos/jo/${id}`,
  ...fields,
});

const result: OpenverseResult = {
  id: "abc",
  url: "https://example.org/cat.jpg",
  thumbnail: "",
  credit: {
    title: "Cat",
    author: "Jo",
    license: "CC BY 4.0",
    sourceUrl: "https://example.org/cat",
    attributionRequired: true,
  },
};

describe("searchOpenverse", () => {
  it("asks for photos that can be changed and used commercially", async () => {
    const urls = stubFetch({ body: { page_count: 0, results: [] } });
    await searchOpenverse("cat", { page: 2 });
    const params = urls[0].searchParams;
    expect(urls[0].origin).toBe("https://api.openverse.org");
    expect(params.get("q")).toBe("cat");
    expect(params.get("category")).toBe("photograph");
    expect(params.get("page")).toBe("2");
    expect(params.get("page_size")).toBe("20");
    expect(params.get("license_type")).toBe("commercial,modification");
  });

  it("returns results with the next page number", async () => {
    stubFetch({ body: { page_count: 3, results: [image("a"), image("b")] } });
    const { results, nextPage } = await searchOpenverse("cat");
    expect(results.map((result) => result.id)).toEqual(["a", "b"]);
    expect(results[0].thumbnail).toBe(
      "https://api.openverse.org/v1/images/a/thumb/",
    );
    expect(nextPage).toBe(2);
  });

  it("has no next page on the last one", async () => {
    stubFetch({ body: { page_count: 2, results: [image("a")] } });
    expect((await searchOpenverse("cat", { page: 2 })).nextPage).toBeNull();
  });

  it("builds credits from the result", async () => {
    stubFetch({ body: { page_count: 1, results: [image("a")] } });
    const [{ credit }] = (await searchOpenverse("cat")).results;
    expect(credit).toEqual({
      title: "Photo a",
      author: "Jo Smith",
      license: "CC BY-SA 4.0",
      licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
      sourceUrl: "https://www.flickr.com/photos/jo/a",
      source: "flickr.com",
      attributionRequired: true,
    });
  });

  it("names public domain licenses and marks credit optional", async () => {
    stubFetch({
      body: {
        page_count: 1,
        results: [
          image("a", { license: "cc0", license_version: "1.0" }),
          image("b", { license: "pdm", license_version: "1.0" }),
        ],
      },
    });
    const [a, b] = (await searchOpenverse("cat")).results;
    expect(a.credit.license).toBe("CC0 1.0");
    expect(b.credit.license).toBe("Public Domain Mark 1.0");
    expect(a.credit.attributionRequired).toBe(false);
    expect(b.credit.attributionRequired).toBe(false);
  });

  it("fills in missing metadata", async () => {
    stubFetch({
      body: {
        page_count: 1,
        results: [
          image("a", {
            title: null,
            creator: "",
            thumbnail: null,
            license_version: null,
            license_url: null,
            foreign_landing_url: null,
          }),
        ],
      },
    });
    const [{ thumbnail, credit }] = (await searchOpenverse("cat")).results;
    expect(thumbnail).toBe("https://live.staticflickr.com/a.jpg");
    expect(credit.title).toBe("Untitled");
    expect(credit.author).toBe("Unknown author");
    expect(credit.license).toBe("CC BY-SA");
    expect(credit.licenseUrl).toBeUndefined();
    expect(credit.sourceUrl).toBe("https://live.staticflickr.com/a.jpg");
  });

  it("fails on an error response", async () => {
    stubFetch({ ok: false, status: 503 });
    await expect(searchOpenverse("cat")).rejects.toThrow(
      new OpenverseError(503),
    );
  });
});

describe("searchErrorMessage", () => {
  it("says when Openverse is rate limiting", () => {
    expect(searchErrorMessage(new OpenverseError(429))).toContain(
      "too many requests",
    );
  });

  it.each([502, 503, 504])("says when Openverse is slow (%i)", (status) => {
    expect(searchErrorMessage(new OpenverseError(status))).toContain(
      "slow to respond",
    );
  });

  it("falls back for other errors and network failures", () => {
    const fallback = "Couldn’t reach Openverse. Try again.";
    expect(searchErrorMessage(new OpenverseError(500))).toBe(fallback);
    expect(searchErrorMessage(new TypeError("Failed to fetch"))).toBe(fallback);
  });
});

describe("downloadOpenverse", () => {
  it("downloads the original file, named after the photo", async () => {
    const urls = stubFetch({});
    const file = await downloadOpenverse(result);
    expect(urls.map((url) => url.href)).toEqual([
      "https://example.org/cat.jpg",
    ]);
    expect(file.name).toBe("Cat");
    expect(file.type).toBe("image/jpeg");
  });

  it("falls back to Openverse's copy when the original fails", async () => {
    const urls = stubFetch({ ok: false, status: 403 }, {});
    await downloadOpenverse(result);
    expect(urls[1].href).toBe(
      "https://api.openverse.org/v1/images/abc/thumb/?full_size=true",
    );
  });

  it("falls back when the original isn't an image", async () => {
    const urls = stubFetch({ type: "text/html" }, {});
    await downloadOpenverse(result);
    expect(urls).toHaveLength(2);
  });

  it("fails when neither copy downloads", async () => {
    stubFetch({ ok: false, status: 404 });
    await expect(downloadOpenverse(result)).rejects.toThrow("404");
  });
});

describe("formatCredit", () => {
  it("writes a TASL-style line naming the source site", () => {
    expect(formatCredit({ ...result.credit, source: "flickr.com" })).toBe(
      "“Cat” by Jo, CC BY 4.0, via flickr.com (https://example.org/cat)",
    );
  });

  it("credits Commons for photos saved before Openverse", () => {
    expect(formatCredit(result.credit)).toContain("via Wikimedia Commons");
  });
});

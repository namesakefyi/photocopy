// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { downloadCommons, formatCredit, searchCommons } from "./commons";

afterEach(() => {
  vi.unstubAllGlobals();
});

/** Answers every fetch with `body` as JSON, and records the URLs asked for. */
function stubFetch(
  body: unknown,
  init: { ok?: boolean; status?: number } = {},
) {
  const urls: URL[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: URL | string) => {
      urls.push(new URL(input));
      return {
        ok: init.ok ?? true,
        status: init.status ?? 200,
        json: async () => body,
        blob: async () => new Blob(["image"], { type: "image/jpeg" }),
      };
    }),
  );
  return urls;
}

const page = (title: string, index: number, meta = {}) => ({
  title,
  index,
  imageinfo: [
    {
      url: `https://upload.example/${title}`,
      thumburl: `https://upload.example/thumb/${title}`,
      width: 1200,
      height: 800,
      descriptionurl: `https://commons.wikimedia.org/wiki/${title}`,
      extmetadata: meta,
    },
  ],
});

describe("searchCommons", () => {
  it("asks for bitmaps only, at the requested offset", async () => {
    const urls = stubFetch({ query: { pages: [] } });
    await searchCommons("cat", { offset: 30 });
    const params = urls[0].searchParams;
    expect(params.get("gsrsearch")).toBe("cat filetype:bitmap");
    expect(params.get("gsroffset")).toBe("30");
    expect(params.get("origin")).toBe("*");
  });

  it("adds the public domain and CC0 filter when asked", async () => {
    const urls = stubFetch({ query: { pages: [] } });
    await searchCommons("cat", { noAttributionOnly: true });
    expect(urls[0].searchParams.get("gsrsearch")).toContain(
      "haswbstatement:P6216=Q19652|P275=Q6938433",
    );
  });

  it("returns results in search order, with the next page's offset", async () => {
    stubFetch({
      continue: { gsroffset: 30 },
      query: { pages: [page("File:B.jpg", 2), page("File:A.jpg", 1)] },
    });
    const { results, nextOffset } = await searchCommons("cat");
    expect(results.map((result) => result.title)).toEqual([
      "File:A.jpg",
      "File:B.jpg",
    ]);
    expect(results[0].thumbnail).toBe(
      "https://upload.example/thumb/File:A.jpg",
    );
    expect(nextOffset).toBe(30);
  });

  it("has no next page on the last one", async () => {
    stubFetch({ query: { pages: [page("File:A.jpg", 1)] } });
    expect((await searchCommons("cat")).nextOffset).toBeNull();
  });

  it("skips pages without image info", async () => {
    stubFetch({ query: { pages: [{ title: "File:Gone.jpg", index: 1 }] } });
    expect((await searchCommons("cat")).results).toEqual([]);
  });

  it("turns the HTML metadata into plain-text credits", async () => {
    stubFetch({
      query: {
        pages: [
          page("File:Cat.jpg", 1, {
            ObjectName: { value: "A <i>sleepy</i>  cat" },
            Artist: { value: '<a href="/wiki/User:Jo">Jo  Smith</a>' },
            LicenseShortName: { value: "CC BY-SA 4.0" },
            LicenseUrl: {
              value: "https://creativecommons.org/licenses/by-sa/4.0",
            },
            AttributionRequired: { value: "true" },
          }),
        ],
      },
    });
    const [{ credit }] = (await searchCommons("cat")).results;
    expect(credit).toEqual({
      title: "A sleepy cat",
      author: "Jo Smith",
      license: "CC BY-SA 4.0",
      licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0",
      sourceUrl: "https://commons.wikimedia.org/wiki/File:Cat.jpg",
      attributionRequired: true,
    });
  });

  it("fills in missing metadata", async () => {
    stubFetch({
      query: {
        pages: [
          page("File:Cat.jpg", 1, { AttributionRequired: { value: "false" } }),
        ],
      },
    });
    const [{ credit }] = (await searchCommons("cat")).results;
    expect(credit.title).toBe("Cat.jpg");
    expect(credit.author).toBe("Unknown author");
    expect(credit.license).toBe("See source");
    expect(credit.attributionRequired).toBe(false);
  });

  it("fails on an error response", async () => {
    stubFetch({}, { ok: false, status: 503 });
    await expect(searchCommons("cat")).rejects.toThrow("503");
  });
});

describe("downloadCommons", () => {
  it("downloads the large copy, named after the file", async () => {
    const urls = stubFetch({ query: { pages: [page("File:Cat.jpg", 1)] } });
    const [result] = [
      {
        title: "File:Cat.jpg",
        thumbnail: "",
        width: 1,
        height: 1,
        credit: {
          title: "",
          author: "",
          license: "",
          sourceUrl: "",
          attributionRequired: true,
        },
      },
    ];
    const file = await downloadCommons(result);
    expect(urls[0].searchParams.get("titles")).toBe("File:Cat.jpg");
    expect(urls[0].searchParams.get("iiurlwidth")).toBe("2560");
    expect(urls[1].href).toBe("https://upload.example/thumb/File:Cat.jpg");
    expect(file.name).toBe("Cat.jpg");
  });

  it("fails when the file is gone", async () => {
    stubFetch({ query: { pages: [] } });
    await expect(
      downloadCommons({
        title: "File:Gone.jpg",
        thumbnail: "",
        width: 1,
        height: 1,
        credit: {
          title: "",
          author: "",
          license: "",
          sourceUrl: "",
          attributionRequired: true,
        },
      }),
    ).rejects.toThrow("not found");
  });
});

describe("formatCredit", () => {
  it("writes a TASL-style line", () => {
    expect(
      formatCredit({
        title: "Cat",
        author: "Jo",
        license: "CC BY 4.0",
        sourceUrl: "https://commons.wikimedia.org/wiki/File:Cat.jpg",
        attributionRequired: true,
      }),
    ).toBe(
      "“Cat” by Jo, CC BY 4.0, via Wikimedia Commons (https://commons.wikimedia.org/wiki/File:Cat.jpg)",
    );
  });
});

import { describe, expect, it } from "vitest";
import {
  artboardBeside,
  indexKey,
  insertAfter,
  reorderArtboards,
  withoutArtboard,
  withThumbnail,
} from "./library";

const boards = (...ids: string[]) =>
  ids.map((id) => ({ id, backgroundId: "" }));
const idsOf = (artboards: { id: string }[]) => artboards.map((a) => a.id);

describe("library", () => {
  it("inserts a duplicate right after its original", () => {
    expect(idsOf(insertAfter(boards("a", "b"), "a", boards("c")[0]))).toEqual([
      "a",
      "c",
      "b",
    ]);
  });

  it("switches artboards around the ends", () => {
    expect(artboardBeside(boards("a", "b", "c"), "c", 1)).toBe("a");
    expect(artboardBeside(boards("a", "b", "c"), "a", -1)).toBe("c");
    expect(artboardBeside(boards("a"), "a", 1)).toBeNull();
  });

  it("opens the next artboard after a delete, or the last one at the end", () => {
    expect(withoutArtboard(boards("a", "b", "c"), "b").nextId).toBe("c");
    expect(withoutArtboard(boards("a", "b", "c"), "c").nextId).toBe("b");
    expect(withoutArtboard(boards("a"), "a")).toEqual({
      remaining: [],
      nextId: null,
    });
  });

  it("reorders by id, dropping unknown ones", () => {
    expect(idsOf(reorderArtboards(boards("a", "b"), ["b", "x", "a"]))).toEqual([
      "b",
      "a",
    ]);
  });

  it("stores a thumbnail on its artboard only", () => {
    const thumbnail = new Blob();
    const [a, b] = withThumbnail(boards("a", "b"), "b", thumbnail);
    expect([a.thumbnail, b.thumbnail]).toEqual([undefined, thumbnail]);
  });

  it("keys the index on order and the open artboard", () => {
    expect(indexKey(boards("a", "b"), "b")).toBe("a,b|b");
  });
});

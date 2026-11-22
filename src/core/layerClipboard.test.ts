import { describe, expect, it } from "vitest";
import { PASTE_OFFSET, pastePosition } from "./layerClipboard";

const size = (width: number, height: number) => ({ width, height });

describe("pastePosition", () => {
  it("keeps the spot when it's free, as after a cut", () => {
    expect(
      pastePosition({ x: 100, y: 50 }, size(1000, 500), size(1000, 500), []),
    ).toEqual({ x: 100, y: 50 });
  });

  it("steps off the original, and off earlier pastes", () => {
    const from = { x: 100, y: 50 };
    const existing = [from, { x: 100 + PASTE_OFFSET, y: 50 + PASTE_OFFSET }];
    expect(
      pastePosition(from, size(1000, 500), size(1000, 500), existing),
    ).toEqual({ x: 100 + 2 * PASTE_OFFSET, y: 50 + 2 * PASTE_OFFSET });
  });

  it("keeps the offset from the center on an artboard of another size", () => {
    expect(
      pastePosition({ x: 600, y: 300 }, size(1200, 630), size(1080, 1080), []),
    ).toEqual({ x: 540, y: 525 });
  });
});

import { describe, expect, it } from "vitest";
import { encodePalettePng } from "./png";

const BLACK = [0, 0, 0, 255];
const WHITE = [255, 255, 255, 255];
const CLEAR = [255, 255, 255, 0];

function image(width: number, pixels: number[][]) {
  return {
    data: new Uint8ClampedArray(pixels.flat()),
    width,
    height: pixels.length / width,
  };
}

/** The chunks of a PNG, by type. */
async function chunks(blob: Blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const view = new DataView(bytes.buffer);
  const found = new Map<string, Uint8Array>();
  for (let offset = 8; offset < bytes.length; ) {
    const length = view.getUint32(offset);
    const type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8));
    found.set(type, bytes.subarray(offset + 8, offset + 8 + length));
    offset += length + 12;
  }
  return found;
}

async function inflate(data: Uint8Array) {
  const stream = new Blob([data.slice()])
    .stream()
    .pipeThrough(new DecompressionStream("deflate"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

describe("encodePalettePng", () => {
  it("packs two opaque colors at one bit a pixel, with no transparency", async () => {
    const blob = await encodePalettePng(image(3, [BLACK, WHITE, BLACK]));
    const found = await chunks(blob as Blob);
    expect(found.get("IHDR")?.subarray(8, 10)).toEqual(new Uint8Array([1, 3]));
    expect(found.get("PLTE")).toEqual(new Uint8Array([0, 0, 0, 255, 255, 255]));
    expect(found.has("tRNS")).toBe(false);
    // Filter byte, then indices 0 1 0 in the top three bits.
    expect(await inflate(found.get("IDAT") as Uint8Array)).toEqual(
      new Uint8Array([0, 0b010_00000]),
    );
  });

  it("keeps transparency, treating every clear pixel as one color", async () => {
    const pixels = [BLACK, WHITE, CLEAR, [0, 0, 0, 0]];
    const found = await chunks(
      (await encodePalettePng(image(2, pixels))) as Blob,
    );
    expect(found.get("IHDR")?.[8]).toBe(2);
    expect(found.get("tRNS")).toEqual(new Uint8Array([255, 255, 0]));
    expect(await inflate(found.get("IDAT") as Uint8Array)).toEqual(
      new Uint8Array([0, 0b0001_0000, 0, 0b1010_0000]),
    );
  });

  it("gives up past 16 colors", async () => {
    const pixels = Array.from({ length: 17 }, (_, i) => [i, 0, 0, 255]);
    expect(await encodePalettePng(image(17, pixels))).toBeNull();
  });
});

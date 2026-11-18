import { describe, expect, it } from "vitest";
import {
  blur,
  contentBounds,
  DEFAULT_SETTINGS,
  type Pixels,
  photocopy,
} from "./photocopy";

function gradient(width: number, height: number, alpha = 255): Pixels {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const offset = (y * width + x) * 4;
      const value = Math.round((x / (width - 1)) * 255);
      data.set([value, value, value, alpha], offset);
    }
  }
  return { data, width, height };
}

function blackShare({ data }: Pixels) {
  let black = 0;
  for (let offset = 0; offset < data.length; offset += 4) {
    if (data[offset] === 0) black++;
  }
  return black / (data.length / 4);
}

describe("photocopy", () => {
  it("outputs only pure black or white with fully opaque or clear alpha", () => {
    const input = gradient(64, 64, 200);
    input.data[3] = 40;
    const { data } = photocopy(input, DEFAULT_SETTINGS);
    for (let offset = 0; offset < data.length; offset += 4) {
      expect([0, 255]).toContain(data[offset]);
      expect(data[offset + 1]).toBe(data[offset]);
      expect(data[offset + 2]).toBe(data[offset]);
      expect([0, 255]).toContain(data[offset + 3]);
    }
    expect(data[3]).toBe(0);
  });

  it("gives the same output for the same seed", () => {
    const input = gradient(48, 48);
    const first = photocopy(input, DEFAULT_SETTINGS);
    const second = photocopy(input, DEFAULT_SETTINGS);
    expect(second.data).toEqual(first.data);
  });

  it("gives different grain for a different seed", () => {
    const input = gradient(48, 48);
    const first = photocopy(input, DEFAULT_SETTINGS);
    const second = photocopy(input, { ...DEFAULT_SETTINGS, seed: 2 });
    expect(second.data).not.toEqual(first.data);
  });

  it("prints more black as darkness goes up", () => {
    const input = gradient(64, 64);
    const light = photocopy(input, { ...DEFAULT_SETTINGS, darkness: 5 });
    const dark = photocopy(input, { ...DEFAULT_SETTINGS, darkness: 40 });
    expect(blackShare(dark)).toBeGreaterThan(blackShare(light));
  });

  it("treats transparent areas as white paper", () => {
    const input = gradient(16, 16, 0);
    const { data } = photocopy(input, { ...DEFAULT_SETTINGS, grain: 0 });
    expect(data[0]).toBe(255);
  });
});

describe("blur", () => {
  it("leaves pixels untouched when sigma is 0", () => {
    const values = Float32Array.from([0, 255, 0, 255, 0, 255, 0, 255, 0]);
    const copy = values.slice();
    blur(values, 3, 3, 0);
    expect(values).toEqual(copy);
  });

  it("softens a hard edge", () => {
    const values = Float32Array.from({ length: 20 }, (_, index) =>
      index < 10 ? 0 : 255,
    );
    blur(values, 20, 1, 3);
    expect(values[9]).toBeGreaterThan(0);
    expect(values[10]).toBeLessThan(255);
  });
});

describe("contentBounds", () => {
  it("finds the box around visible pixels", () => {
    const pixels = gradient(10, 10, 0);
    pixels.data[(3 * 10 + 2) * 4 + 3] = 255;
    pixels.data[(6 * 10 + 7) * 4 + 3] = 255;
    expect(contentBounds(pixels)).toEqual({ x: 2, y: 3, width: 6, height: 4 });
  });

  it("ignores pixels fainter than the given alpha", () => {
    const pixels = gradient(10, 10, 0);
    pixels.data[(1 * 10 + 1) * 4 + 3] = 60;
    pixels.data[(5 * 10 + 5) * 4 + 3] = 200;
    expect(contentBounds(pixels, 128)).toEqual({
      x: 5,
      y: 5,
      width: 1,
      height: 1,
    });
  });

  it("returns null for an empty image", () => {
    expect(contentBounds(gradient(4, 4, 0))).toBeNull();
  });
});

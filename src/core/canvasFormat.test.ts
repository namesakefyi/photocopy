import { describe, expect, it } from "vitest";
import {
  CANVAS_PRESETS,
  canvasSize,
  type FitMemory,
  fitLayersToCanvas,
  MAX_CANVAS_SIZE,
} from "./canvasFormat";

type Placed = { id: string; x: number; y: number; scale: number };

const size = (id: string) => {
  const preset = CANVAS_PRESETS.find((option) => option.id === id);
  if (!preset) throw new Error(id);
  return { width: preset.width, height: preset.height };
};

/** Switches through canvas sizes in order, as the app does. */
function switchThrough(layers: Placed[], sizes: string[]) {
  let memory: FitMemory = {};
  let current = layers;
  for (let index = 1; index < sizes.length; index++) {
    const result = fitLayersToCanvas(
      current,
      size(sizes[index - 1]),
      size(sizes[index]),
      memory,
    );
    current = result.layers;
    memory = result.memory;
  }
  return { layers: current, memory };
}

describe("fitLayersToCanvas", () => {
  it("returns photos to their starting size and spot after a round trip", () => {
    const start = [{ id: "a", x: 400, y: 300, scale: 0.5 }];
    const { layers } = switchThrough(start, [
      "square",
      "video",
      "story",
      "social",
      "square",
    ]);
    expect(layers[0]).toEqual(start[0]);
  });

  it("keeps photos in the same relative spot", () => {
    const square = size("square");
    const video = size("video");
    const { layers } = fitLayersToCanvas(
      [{ id: "a", x: square.width / 2, y: square.height / 2, scale: 1 }],
      square,
      video,
    );
    expect(layers[0].x).toBe(video.width / 2);
    expect(layers[0].y).toBe(video.height / 2);
    expect(layers[0].scale).toBeCloseTo(video.height / square.height);
  });

  it("never makes a photo wider than the canvas allows", () => {
    // Nearly as wide as Social, so it must stay within each later canvas too.
    const social = size("social");
    const photoWidth = social.width - 20;
    const start = [
      { id: "a", x: social.width / 2, y: social.height / 2, scale: 1 },
    ];
    const { layers } = switchThrough(start, ["social", "video", "story"]);
    expect(photoWidth * layers[0].scale).toBeLessThanOrEqual(
      size("story").width,
    );
    const toVideo = fitLayersToCanvas(start, social, size("video"));
    expect(photoWidth * toVideo.layers[0].scale).toBeLessThanOrEqual(
      size("video").width,
    );
  });

  it("starts over from a photo's new spot once it's been moved", () => {
    const square = size("square");
    const video = size("video");
    const first = fitLayersToCanvas(
      [{ id: "a", x: 500, y: 500, scale: 1 }],
      square,
      video,
    );
    const moved = [{ ...first.layers[0], x: 100 }];
    const back = fitLayersToCanvas(moved, video, square, first.memory);
    // Fitted from the moved spot on Video, not from the original on Square.
    const ratio = Math.min(
      square.width / video.width,
      square.height / video.height,
    );
    expect(back.layers[0].x).toBeCloseTo(100 * (square.width / video.width));
    expect(back.layers[0].scale).toBeCloseTo(first.layers[0].scale * ratio);
  });
});

describe("canvasSize", () => {
  it("keeps every preset within the limit", () => {
    for (const preset of CANVAS_PRESETS) {
      expect(Math.max(preset.width, preset.height)).toBeLessThanOrEqual(
        MAX_CANVAS_SIZE,
      );
    }
  });

  it("ignores the custom size unless the preset is custom", () => {
    expect(
      canvasSize({ preset: "square", customWidth: 123, customHeight: 456 }),
    ).toEqual({ width: 1080, height: 1080 });
  });

  it("uses the custom size for a custom canvas", () => {
    expect(
      canvasSize({ preset: "custom", customWidth: 123, customHeight: 456 }),
    ).toEqual({ width: 123, height: 456 });
  });
});

describe("fitLayersToCanvas memory", () => {
  it("forgets photos that are gone", () => {
    const first = fitLayersToCanvas(
      [
        { id: "a", x: 10, y: 10, scale: 1 },
        { id: "b", x: 20, y: 20, scale: 1 },
      ],
      { width: 100, height: 100 },
      { width: 200, height: 200 },
    );
    const second = fitLayersToCanvas(
      first.layers.filter((layer) => layer.id === "a"),
      { width: 200, height: 200 },
      { width: 100, height: 100 },
      first.memory,
    );
    expect(Object.keys(second.memory)).toEqual(["a"]);
  });
});

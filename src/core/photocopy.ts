export interface PhotocopySettings {
  /** 0–100. Moves the black/white cut point; higher prints more black. */
  darkness: number;
  /** 0–100. Strength of the grain speckle. */
  grain: number;
  /** 0–100. How strongly local edges and texture are pulled out. */
  contrast: number;
  seed: number;
}

export const DEFAULT_SETTINGS: PhotocopySettings = {
  darkness: 50,
  grain: 58,
  contrast: 44,
  seed: 1,
};

export type PhotocopyLook = Omit<PhotocopySettings, "seed">;

export interface PhotocopyPreset {
  id: string;
  title: string;
  look: PhotocopyLook;
}

const { seed: _seed, ...DEFAULT_LOOK } = DEFAULT_SETTINGS;

export const PRESETS: PhotocopyPreset[] = [
  {
    id: "default",
    title: "Default",
    look: DEFAULT_LOOK,
  },
  {
    id: "clean",
    title: "Clean",
    look: { darkness: 50, grain: 22, contrast: 30 },
  },
  {
    id: "heavy",
    title: "Heavy grain",
    look: { darkness: 46, grain: 100, contrast: 44 },
  },
  {
    id: "bold",
    title: "Bold",
    look: { darkness: 72, grain: 36, contrast: 90 },
  },
  {
    id: "faded",
    title: "Faded",
    look: { darkness: 20, grain: 66, contrast: 28 },
  },
];

export function matchingPreset(settings: PhotocopySettings) {
  return PRESETS.find(({ look }) =>
    (Object.keys(look) as (keyof PhotocopyLook)[]).every(
      (key) => look[key] === settings[key],
    ),
  );
}

export interface Pixels {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

const BLACK = 0;
const WHITE = 255;
const EDGE_RADIUS = 4;
/** Slight softening before printing, matching Stamp's Smoothness of 1. */
const SOFTEN_SIGMA = 0.8;
/** In artboard pixels: the finest grain that still reads as specks, not noise. */
const GRAIN_SIGMA = 0.6;

/** Small, fast seeded PRNG so the same seed always gives the same grain. */
export function mulberry32(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Blends partial transparency over white, so soft cutout edges don't get dark halos. */
export function toLuminance({ data, width, height }: Pixels): Float32Array {
  const luminance = new Float32Array(width * height);
  for (let pixel = 0, offset = 0; pixel < luminance.length; pixel++) {
    const red = data[offset++];
    const green = data[offset++];
    const blue = data[offset++];
    const alpha = data[offset++] / 255;
    const value = 0.299 * red + 0.587 * green + 0.114 * blue;
    luminance[pixel] = value * alpha + WHITE * (1 - alpha);
  }
  return luminance;
}

function boxBlurPass(
  source: Float32Array,
  target: Float32Array,
  width: number,
  height: number,
  radius: number,
  horizontal: boolean,
) {
  const lineCount = horizontal ? height : width;
  const lineLength = horizontal ? width : height;
  const step = horizontal ? 1 : width;
  const windowSize = radius * 2 + 1;

  for (let line = 0; line < lineCount; line++) {
    const start = horizontal ? line * width : line;
    const at = (index: number) =>
      source[start + Math.min(lineLength - 1, Math.max(0, index)) * step];

    let sum = 0;
    for (let index = -radius; index <= radius; index++) sum += at(index);

    for (let index = 0; index < lineLength; index++) {
      target[start + index * step] = sum / windowSize;
      sum += at(index + radius + 1) - at(index - radius);
    }
  }
}

/** Three box-blur passes approximate a Gaussian blur of the given sigma. */
export function blur(
  values: Float32Array,
  width: number,
  height: number,
  sigma: number,
) {
  const boxWidth = Math.sqrt((12 * sigma * sigma) / 3 + 1);
  const radius = Math.round((boxWidth - 1) / 2);
  if (radius < 1) return;
  const scratch = new Float32Array(values.length);
  for (let pass = 0; pass < 3; pass++) {
    boxBlurPass(values, scratch, width, height, radius, true);
    boxBlurPass(scratch, values, width, height, radius, false);
  }
}

/** Unsharp mask: pushes each pixel away from its neighborhood average. */
export function enhanceEdges(
  luminance: Float32Array,
  width: number,
  height: number,
  amount: number,
  radius: number,
) {
  if (amount <= 0) return;
  const neighborhood = luminance.slice();
  blur(neighborhood, width, height, radius);
  for (let pixel = 0; pixel < luminance.length; pixel++) {
    luminance[pixel] += amount * (luminance[pixel] - neighborhood[pixel]);
  }
}

/** Uniform noise softened into specks, rescaled so `strength` is its standard deviation. */
export function grainField(
  width: number,
  height: number,
  strength: number,
  speckSigma: number,
  seed: number,
) {
  const random = mulberry32(seed);
  const field = new Float32Array(width * height);
  for (let pixel = 0; pixel < field.length; pixel++) {
    field[pixel] = random() * 2 - 1;
  }
  blur(field, width, height, speckSigma);

  let sumOfSquares = 0;
  for (let pixel = 0; pixel < field.length; pixel++) {
    sumOfSquares += field[pixel] * field[pixel];
  }
  const deviation = Math.sqrt(sumOfSquares / field.length) || 1;
  const scale = strength / deviation;
  for (let pixel = 0; pixel < field.length; pixel++) field[pixel] *= scale;
  return field;
}

export function threshold(darkness: number) {
  return 118 + (darkness - 50) * 2.4;
}

/**
 * Returns pure black or white pixels, fully opaque or transparent. `pixelScale`
 * is output pixels per artboard pixel, so previews match full-size output.
 */
export function photocopy(
  pixels: Pixels,
  settings: PhotocopySettings,
  pixelScale = 1,
): Pixels {
  const { width, height, data } = pixels;
  const luminance = toLuminance(pixels);

  blur(luminance, width, height, SOFTEN_SIGMA * pixelScale);
  enhanceEdges(
    luminance,
    width,
    height,
    settings.contrast / 11,
    EDGE_RADIUS * pixelScale,
  );
  const grain = grainField(
    width,
    height,
    settings.grain * 0.72,
    GRAIN_SIGMA * pixelScale,
    settings.seed,
  );

  const cutoff = threshold(settings.darkness);
  const output = new Uint8ClampedArray(data.length);
  for (let pixel = 0, offset = 0; pixel < luminance.length; pixel++) {
    const value = luminance[pixel] + grain[pixel] < cutoff ? BLACK : WHITE;
    output[offset++] = value;
    output[offset++] = value;
    output[offset++] = value;
    output[offset] = data[offset] >= 128 ? 255 : 0;
    offset++;
  }
  return { data: output, width, height };
}

/** Bounds of every pixel at least `minAlpha` opaque, or null if there are none. */
export function contentBounds({ data, width, height }: Pixels, minAlpha = 1) {
  let top = height;
  let left = width;
  let bottom = -1;
  let right = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] < minAlpha) continue;
      if (y < top) top = y;
      if (y > bottom) bottom = y;
      if (x < left) left = x;
      if (x > right) right = x;
    }
  }
  if (bottom < 0) return null;
  return { x: left, y: top, width: right - left + 1, height: bottom - top + 1 };
}

const SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];
const MAX_COLORS = 16;

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let bit = 0; bit < 8; bit++)
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(bytes: Uint8Array) {
  let crc = ~0;
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return ~crc >>> 0;
}

function chunk(type: string, data: Uint8Array) {
  const bytes = new Uint8Array(data.length + 12);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) bytes[4 + i] = type.charCodeAt(i);
  bytes.set(data, 8);
  view.setUint32(data.length + 8, crc32(bytes.subarray(4, data.length + 8)));
  return bytes;
}

async function deflate(data: Uint8Array<ArrayBuffer>) {
  const stream = new Blob([data])
    .stream()
    .pipeThrough(new CompressionStream("deflate"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/**
 * A PNG that stores each pixel as an index into a palette: a photocopy's two
 * or three colors take 1 or 2 bits a pixel instead of 32. Null past 16 colors.
 */
export async function encodePalettePng({
  data,
  width,
  height,
}: {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}): Promise<Blob | null> {
  const colors: number[] = [];
  const indexOf = new Map<number, number>();
  const indices = new Uint8Array(width * height);
  let lastRgba = -1;
  let index = 0;
  for (let pixel = 0; pixel < indices.length; pixel++) {
    const o = pixel * 4;
    // Every fully transparent pixel is the same color, whatever its RGB.
    const rgba = data[o + 3]
      ? ((data[o] << 24) |
          (data[o + 1] << 16) |
          (data[o + 2] << 8) |
          data[o + 3]) >>>
        0
      : 0;
    // Neighbors are nearly always the same color, so skip the lookup for runs.
    if (rgba !== lastRgba) {
      const known = indexOf.get(rgba);
      if (known === undefined && colors.length === MAX_COLORS) return null;
      index = known ?? colors.push(rgba) - 1;
      indexOf.set(rgba, index);
      lastRgba = rgba;
    }
    indices[pixel] = index;
  }

  const depth = colors.length <= 2 ? 1 : colors.length <= 4 ? 2 : 4;
  const perByte = 8 / depth;
  const rowBytes = Math.ceil(width / perByte) + 1; // Each row starts with filter 0.
  const rows = new Uint8Array(rowBytes * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const shift = 8 - depth * ((x % perByte) + 1);
      rows[y * rowBytes + 1 + Math.floor(x / perByte)] |=
        indices[y * width + x] << shift;
    }
  }

  const header = new Uint8Array(13);
  const view = new DataView(header.buffer);
  view.setUint32(0, width);
  view.setUint32(4, height);
  header[8] = depth;
  header[9] = 3; // Indexed color.
  const palette = new Uint8Array(colors.length * 3);
  const alphas = new Uint8Array(colors.length);
  colors.forEach((rgba, index) => {
    palette.set(
      [rgba >>> 24, (rgba >>> 16) & 255, (rgba >>> 8) & 255],
      index * 3,
    );
    alphas[index] = rgba & 255;
  });

  return new Blob(
    [
      new Uint8Array(SIGNATURE),
      chunk("IHDR", header),
      chunk("PLTE", palette),
      ...(alphas.some((alpha) => alpha < 255) ? [chunk("tRNS", alphas)] : []),
      chunk("IDAT", await deflate(rows)),
      chunk("IEND", new Uint8Array(0)),
    ],
    { type: "image/png" },
  );
}

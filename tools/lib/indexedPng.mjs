// CSA-A (2026-09-27): AN RGBA PICTURE OF AT MOST 256 COLOURS AS AN INDEXED PNG
// (colour type 3, PLTE and tRNS) - pngjs writes truecolour only, and a
// mod's palette-painted frames (Come Sail Away's waves: 57 RGBA values over
// 32 frames of 640x640) are a fifth of the size this way.
//
// The palette is the picture's own colours in ascending RGBA order, so the
// file is a function of the pixels alone; rows are unfiltered and deflated
// at level 9. Any PNG reader (a browser, pngjs) hands back the same RGBA.

import zlib from 'node:zlib';

const crc32 = (b) => zlib.crc32(b) >>> 0;

function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'latin1');
  Buffer.from(data.buffer, data.byteOffset, data.length).copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

/** The picture's RGBA values, ascending. @returns {number[]} packed RGBA, unsigned */
export function pictureColours({ width, height, data }) {
  const set = new Set();
  for (let i = 0; i < width * height * 4; i += 4)
    set.add(((data[i] << 24) | (data[i + 1] << 16) | (data[i + 2] << 8) | data[i + 3]) >>> 0);
  return [...set].sort((a, b) => a - b);
}

/**
 * Encode `{ width, height, data }` (RGBA, top row first) as an indexed PNG.
 * Throws if the picture has more than 256 colours.
 * @param {number[]} [palette] the colours to use, as pictureColours gives them (e.g. shared by a set of frames)
 */
export function encodeIndexedPng(pic, palette = pictureColours(pic)) {
  const { width, height, data } = pic;
  if (palette.length > 256) throw new Error(`indexed PNG: ${palette.length} colours (at most 256)`);
  const index = new Map(palette.map((c, i) => [c, i]));
  const raw = Buffer.alloc((width + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width + 1)] = 0; // filter: none
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const c = ((data[i] << 24) | (data[i + 1] << 16) | (data[i + 2] << 8) | data[i + 3]) >>> 0;
      const k = index.get(c);
      if (k === undefined)
        throw new Error(
          `indexed PNG: the colour ${c.toString(16).padStart(8, '0')} at ${x},${y} is not in the palette`,
        );
      raw[y * (width + 1) + 1 + x] = k;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 3;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const plte = Buffer.alloc(palette.length * 3);
  const trns = Buffer.alloc(palette.length);
  palette.forEach((c, i) => {
    plte[i * 3] = c >>> 24;
    plte[i * 3 + 1] = (c >>> 16) & 255;
    plte[i * 3 + 2] = (c >>> 8) & 255;
    trns[i] = c & 255;
  });
  let lastOpaque = trns.length;
  while (lastOpaque > 0 && trns[lastOpaque - 1] === 255) lastOpaque--; // tRNS may stop at the last entry that is not opaque
  const parts = [
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('PLTE', plte),
  ];
  if (lastOpaque > 0) parts.push(chunk('tRNS', trns.subarray(0, lastOpaque)));
  parts.push(chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0)));
  return Buffer.concat(parts);
}

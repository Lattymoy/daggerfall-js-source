// PNG in and out, in Node, with no dependencies.
//
// The sprite tools need to read 8-bit RGBA PNGs and write them back;
// this container has no image library and pulling one in for two
// functions that are mostly zlib would be a dependency to keep in step
// forever. Handles what the art actually is - 8-bit, colour type 6
// (RGBA) or 2 (RGB) - and says so loudly for anything else rather than
// quietly producing garbage.

import { inflateSync, deflateSync } from 'node:zlib';

const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

const paeth = (a, b, c) => {
  const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
};

/** @returns {{ width: number, height: number, data: Uint8ClampedArray }} RGBA */
export function readPng(bytes) {
  const b = Buffer.from(bytes);
  if (b.readUInt32BE(0) !== 0x89504E47) throw new Error('not a PNG');
  let w = 0, h = 0, depth = 0, type = 0;
  const idat = [];
  for (let p = 8; p + 8 <= b.length;) {
    const len = b.readUInt32BE(p);
    const tag = b.toString('latin1', p + 4, p + 8);
    const body = b.subarray(p + 8, p + 8 + len);
    if (tag === 'IHDR') {
      w = body.readUInt32BE(0); h = body.readUInt32BE(4);
      depth = body[8]; type = body[9];
      if (body[12] !== 0) throw new Error('interlaced PNGs are not supported');
    } else if (tag === 'IDAT') idat.push(body);
    else if (tag === 'IEND') break;
    p += 12 + len;
  }
  if (depth !== 8 || (type !== 6 && type !== 2)) throw new Error(`unsupported PNG: depth ${depth}, colour type ${type}`);
  const ch = type === 6 ? 4 : 3;
  const raw = inflateSync(Buffer.concat(idat));
  const stride = w * ch;
  const out = new Uint8ClampedArray(w * h * 4);
  const prev = new Uint8Array(stride);
  const line = new Uint8Array(stride);
  let o = 0;
  for (let y = 0; y < h; y++) {
    const filter = raw[o++];
    raw.copy(line, 0, o, o + stride); o += stride;
    for (let i = 0; i < stride; i++) {
      const a = i >= ch ? line[i - ch] : 0, up = prev[i], ul = i >= ch ? prev[i - ch] : 0;
      if (filter === 1) line[i] = (line[i] + a) & 0xFF;
      else if (filter === 2) line[i] = (line[i] + up) & 0xFF;
      else if (filter === 3) line[i] = (line[i] + ((a + up) >> 1)) & 0xFF;
      else if (filter === 4) line[i] = (line[i] + paeth(a, up, ul)) & 0xFF;
      else if (filter !== 0) throw new Error(`bad row filter ${filter}`);
    }
    prev.set(line);
    for (let x = 0; x < w; x++) {
      const s = x * ch, d = (y * w + x) * 4;
      out[d] = line[s]; out[d + 1] = line[s + 1]; out[d + 2] = line[s + 2];
      out[d + 3] = ch === 4 ? line[s + 3] : 255;
    }
  }
  return { width: w, height: h, data: out };
}

export function writePng({ width, height, data }) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;   // filter: none - these are small, and it keeps the bytes reproducible
    Buffer.from(data.buffer, data.byteOffset + y * stride, stride).copy(raw, y * (stride + 1) + 1);
  }
  const chunk = (tag, body) => {
    const out = Buffer.alloc(12 + body.length);
    out.writeUInt32BE(body.length, 0);
    out.write(tag, 4, 'latin1');
    body.copy(out, 8);
    out.writeUInt32BE(crc32(out.subarray(4, 8 + body.length)), 8 + body.length);
    return out;
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

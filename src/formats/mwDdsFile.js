// DDS texture decoder for the Morrowind data path. Decodes the formats that
// actually occur in Bethesda's Textures/ set - DXT1 (BC1), DXT3 (BC2),
// DXT5 (BC3) and uncompressed masked RGB(A) - to flat RGBA8. Original
// implementation against the DDS/S3TC specs (MS DDS programming guide);
// strict on anything else so retail oddities surface loudly instead of
// rendering garbage.
//
// Layout:
//   uint32 magic 'DDS ' (0x20534444)
//   124-byte DDS_HEADER: uint32 size(124), flags, height, width,
//     pitchOrLinearSize, depth, mipMapCount, reserved[11],
//     DDS_PIXELFORMAT (32 bytes: size(32), flags, fourCC, rgbBitCount,
//     rMask, gMask, bMask, aMask), caps[4], reserved2. Little-endian.
//   Then mip 0 data, mip 1, ... for each mip level.

const DDS_MAGIC = 0x20534444; // 'DDS '
const DDPF_FOURCC = 0x4;
const DDPF_RGB = 0x40;
const DDPF_ALPHAPIXELS = 0x1;
const FOURCC_DXT1 = 0x31545844;
const FOURCC_DXT3 = 0x33545844;
const FOURCC_DXT5 = 0x35545844;

/** Expand a 5.6.5 color to [r,g,b] 0..255 (bit-replicated like GPUs do). */
function unpack565(c) {
  const r = (c >> 11) & 0x1f;
  const g = (c >> 5) & 0x3f;
  const b = c & 0x1f;
  return [(r << 3) | (r >> 2), (g << 2) | (g >> 4), (b << 3) | (b >> 2)];
}

/**
 * Decode one 4x4 BC1/2/3 block into out (RGBA8, row stride = width*4).
 * @param {DataView} view @param {number} off - block start
 * @param {number} fourCC @param {Uint8Array} out
 * @param {number} bx @param {number} by @param {number} width @param {number} height
 */
function decodeBlock(view, off, fourCC, out, bx, by, width, height) {
  let colorOff = off;
  if (fourCC !== FOURCC_DXT1) colorOff = off + 8; // alpha block first for DXT3/5

  const c0 = view.getUint16(colorOff, true);
  const c1 = view.getUint16(colorOff + 2, true);
  const bits = view.getUint32(colorOff + 4, true);
  const [r0, g0, b0] = unpack565(c0);
  const [r1, g1, b1] = unpack565(c1);
  // Palette: DXT1 with c0<=c1 uses the 3-color + transparent mode; DXT3/5
  // always interpolate 4 colors regardless of ordering.
  const pal = [
    [r0, g0, b0, 255],
    [r1, g1, b1, 255],
  ];
  if (fourCC === FOURCC_DXT1 && c0 <= c1) {
    pal.push([(r0 + r1) >> 1, (g0 + g1) >> 1, (b0 + b1) >> 1, 255], [0, 0, 0, 0]);
  } else {
    pal.push(
      [(2 * r0 + r1 + 1) / 3 | 0, (2 * g0 + g1 + 1) / 3 | 0, (2 * b0 + b1 + 1) / 3 | 0, 255],
      [(r0 + 2 * r1 + 1) / 3 | 0, (g0 + 2 * g1 + 1) / 3 | 0, (b0 + 2 * b1 + 1) / 3 | 0, 255],
    );
  }

  // DXT5 interpolated alpha setup.
  let a0 = 0, a1 = 0, aPal = null, aBitsLo = 0, aBitsHi = 0;
  if (fourCC === FOURCC_DXT5) {
    a0 = view.getUint8(off);
    a1 = view.getUint8(off + 1);
    aBitsLo = view.getUint8(off + 2) | (view.getUint8(off + 3) << 8) | (view.getUint8(off + 4) << 16);
    aBitsHi = view.getUint8(off + 5) | (view.getUint8(off + 6) << 8) | (view.getUint8(off + 7) << 16);
    aPal = [a0, a1];
    if (a0 > a1) {
      for (let i = 1; i <= 6; i++) aPal.push(((7 - i) * a0 + i * a1 + 3) / 7 | 0);
    } else {
      for (let i = 1; i <= 4; i++) aPal.push(((5 - i) * a0 + i * a1 + 2) / 5 | 0);
      aPal.push(0, 255);
    }
  }

  for (let py = 0; py < 4; py++) {
    const y = by * 4 + py;
    if (y >= height) break;
    for (let px = 0; px < 4; px++) {
      const x = bx * 4 + px;
      if (x >= width) continue;
      const idx = (bits >> ((py * 4 + px) * 2)) & 0x3;
      const [r, g, b, a] = pal[idx];
      let alpha = a;
      const texel = py * 4 + px;
      if (fourCC === FOURCC_DXT3) {
        const nib = (view.getUint16(off + py * 2, true) >> (px * 4)) & 0xf;
        alpha = (nib << 4) | nib;
      } else if (fourCC === FOURCC_DXT5) {
        const t3 = texel * 3;
        const aIdx = texel < 8 ? (aBitsLo >> t3) & 0x7 : (aBitsHi >> (t3 - 24)) & 0x7;
        alpha = aPal[aIdx];
      }
      const o = (y * width + x) * 4;
      out[o] = r;
      out[o + 1] = g;
      out[o + 2] = b;
      out[o + 3] = alpha;
    }
  }
}

/** Rightmost set-bit shift and width of a channel mask. */
function maskShift(mask) {
  if (mask === 0) return { shift: 0, bits: 0 };
  let shift = 0;
  let m = mask >>> 0;
  while ((m & 1) === 0) {
    m >>>= 1;
    shift++;
  }
  let bits = 0;
  while (m & 1) {
    m >>>= 1;
    bits++;
  }
  return { shift, bits };
}

/**
 * Decode a DDS file to RGBA8 mip levels.
 * @param {Uint8Array} bytes
 * @returns {{width:number, height:number,
 *   mips:{width:number, height:number, rgba:Uint8Array}[]}}
 */
export function decodeDds(bytes) {
  if (!(bytes instanceof Uint8Array)) throw new TypeError('decodeDds expects a Uint8Array');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.byteLength < 128 || view.getUint32(0, true) !== DDS_MAGIC) {
    throw new Error('decodeDds: not a DDS file');
  }
  if (view.getUint32(4, true) !== 124) throw new Error('decodeDds: bad header size');
  const height = view.getUint32(12, true);
  const width = view.getUint32(16, true);
  const mipMapCount = Math.max(1, view.getUint32(28, true));
  const pfFlags = view.getUint32(80, true);
  const fourCC = view.getUint32(84, true);
  const rgbBitCount = view.getUint32(88, true);
  const rMask = view.getUint32(92, true);
  const gMask = view.getUint32(96, true);
  const bMask = view.getUint32(100, true);
  const aMask = view.getUint32(104, true);

  const mips = [];
  let off = 128;
  let w = width;
  let h = height;

  for (let level = 0; level < mipMapCount; level++) {
    const rgba = new Uint8Array(w * h * 4);
    if (pfFlags & DDPF_FOURCC) {
      if (fourCC !== FOURCC_DXT1 && fourCC !== FOURCC_DXT3 && fourCC !== FOURCC_DXT5) {
        throw new Error(`decodeDds: unsupported fourCC 0x${fourCC.toString(16)}`);
      }
      const blockSize = fourCC === FOURCC_DXT1 ? 8 : 16;
      const bw = Math.max(1, (w + 3) >> 2);
      const bh = Math.max(1, (h + 3) >> 2);
      for (let by = 0; by < bh; by++) {
        for (let bx = 0; bx < bw; bx++) {
          decodeBlock(view, off + (by * bw + bx) * blockSize, fourCC, rgba, bx, by, w, h);
        }
      }
      off += bw * bh * blockSize;
    } else if (pfFlags & DDPF_RGB) {
      const bytesPer = rgbBitCount >> 3;
      if (bytesPer < 1 || bytesPer > 4) throw new Error(`decodeDds: bad bit count ${rgbBitCount}`);
      const r = maskShift(rMask);
      const g = maskShift(gMask);
      const b = maskShift(bMask);
      const a = maskShift(aMask);
      const hasAlpha = (pfFlags & DDPF_ALPHAPIXELS) !== 0 && aMask !== 0;
      for (let i = 0; i < w * h; i++) {
        let px = 0;
        for (let k = 0; k < bytesPer; k++) px |= bytes[off + i * bytesPer + k] << (8 * k);
        const o = i * 4;
        rgba[o] = r.bits ? (((px & rMask) >>> r.shift) * 255) / ((1 << r.bits) - 1) : 0;
        rgba[o + 1] = g.bits ? (((px & gMask) >>> g.shift) * 255) / ((1 << g.bits) - 1) : 0;
        rgba[o + 2] = b.bits ? (((px & bMask) >>> b.shift) * 255) / ((1 << b.bits) - 1) : 0;
        rgba[o + 3] = hasAlpha ? (((px & aMask) >>> a.shift) * 255) / ((1 << a.bits) - 1) : 255;
      }
      off += w * h * bytesPer;
    } else {
      throw new Error('decodeDds: unsupported pixel format');
    }
    mips.push({ width: w, height: h, rgba });
    w = Math.max(1, w >> 1);
    h = Math.max(1, h >> 1);
  }
  return { width, height, mips };
}

// BC7 (BPTC, Unity TextureFormat 25) block decoding to RGBA8.
//
// DREAM's paperdoll bundles store almost every sprite as BC7 - the
// format Unity picks for a "High Quality" compressed RGBA import - and
// the bundle reader (unityBundle.js) decoded only DXT1/5 and the raw
// formats until the player-attached mod door (systems/dfmodTextures.js)
// met them. Written from the format as the D3D11 / KHR_texture_BPTC
// specs lay it out (8 modes, 1-3 subsets, 64-entry partition tables,
// the 2/3/4-bit index weights) and validated texel for texel against
// the texture2ddecoder reference (bcdec / detex lineage) on the mod's
// own blocks. Like dxt.js it is a plain decoder: rows come out in block
// order (Unity's bottom-up); the bundle reader flips.

const WEIGHTS2 = [0, 21, 43, 64];
const WEIGHTS3 = [0, 9, 18, 27, 37, 46, 55, 64];
const WEIGHTS4 = [0, 4, 9, 13, 17, 21, 26, 30, 34, 38, 43, 47, 51, 55, 60, 64];

// Partition tables: one hex digit per texel (row-major 4x4).
const P2 = [
  '0011001100110011',
  '0001000100010001',
  '0111011101110111',
  '0001001100110111',
  '0000000100010011',
  '0011011101111111',
  '0001001101111111',
  '0000000100110111',
  '0000000000010011',
  '0011011111111111',
  '0000000101111111',
  '0000000000010111',
  '0001011111111111',
  '0000000011111111',
  '0000111111111111',
  '0000000000001111',
  '0000100011101111',
  '0111000100000000',
  '0000000010001110',
  '0111001100010000',
  '0011000100000000',
  '0000100011001110',
  '0000000010001100',
  '0111001100110001',
  '0011000100010000',
  '0000100010001100',
  '0110011001100110',
  '0011011001101100',
  '0001011111101000',
  '0000111111110000',
  '0111000110001110',
  '0011100110011100',
  '0101010101010101',
  '0000111100001111',
  '0101101001011010',
  '0011001111001100',
  '0011110000111100',
  '0101010110101010',
  '0110100101101001',
  '0101101010100101',
  '0111001111001110',
  '0001001111001000',
  '0011001001001100',
  '0011101111011100',
  '0110100110010110',
  '0011110011000011',
  '0110011010011001',
  '0000011001100000',
  '0100111001000000',
  '0010011100100000',
  '0000001001110010',
  '0000010011100100',
  '0110110010010011',
  '0011011011001001',
  '0110001110011100',
  '0011100111000110',
  '0110110011001001',
  '0110001100111001',
  '0111111010000001',
  '0001100011100111',
  '0000111100110011',
  '0011001111110000',
  '0010001011101110',
  '0100010001110111',
].map((s) => Uint8Array.from(s, Number));

const P3 = [
  '0011001102212222',
  '0001001122112221',
  '0000200122112211',
  '0222002200110111',
  '0000000011221122',
  '0011001100220022',
  '0022002211111111',
  '0011001122112211',
  '0000000011112222',
  '0000111111112222',
  '0000111122222222',
  '0012001200120012',
  '0112011201120112',
  '0122012201220122',
  '0011011211221222',
  '0011200122002220',
  '0001001101121122',
  '0111001120012200',
  '0000112211221122',
  '0022002200221111',
  '0111011102220222',
  '0001000122212221',
  '0000001101220122',
  '0000110022102210',
  '0122012200110000',
  '0012001211222222',
  '0110122112210110',
  '0000011012211221',
  '0022110211020022',
  '0110011020022222',
  '0011012201220011',
  '0000200022112221',
  '0000000211221222',
  '0222002200120011',
  '0011001200220222',
  '0120012001200120',
  '0000111122220000',
  '0120120120120120',
  '0120201212010120',
  '0011220011220011',
  '0011112222000011',
  '0101010122222222',
  '0000000021212121',
  '0022112200221122',
  '0022001100220011',
  '0220122102201221',
  '0101222222220101',
  '0000212121212121',
  '0101010101012222',
  '0222011102220111',
  '0002111200021112',
  '0000211221122112',
  '0222011101110222',
  '0002111211120002',
  '0110011001102222',
  '0000000021122112',
  '0110011022222222',
  '0022001100110022',
  '0022112211220022',
  '0000000000002112',
  '0002000100020001',
  '0222122202221222',
  '0101222222222222',
  '0111201122012220',
].map((s) => Uint8Array.from(s, Number));

// Anchor (fix-up) indices.
const A2 = [
  15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 2, 8, 2, 2, 8, 8, 15, 2, 8, 2, 2, 8, 8, 2, 2, 15,
  15, 6, 8, 2, 8, 15, 15, 2, 8, 2, 2, 2, 15, 15, 6, 6, 2, 6, 8, 15, 15, 2, 2, 15, 15, 15, 15, 15, 2, 2, 15,
];
const A3a = [
  3, 3, 15, 15, 8, 3, 15, 15, 8, 8, 6, 6, 6, 5, 3, 3, 3, 3, 8, 15, 3, 3, 6, 10, 5, 8, 8, 6, 8, 5, 15, 15, 8, 15, 3, 5,
  6, 10, 8, 15, 15, 3, 15, 5, 15, 15, 15, 15, 3, 15, 5, 5, 5, 8, 5, 10, 5, 10, 8, 13, 15, 12, 3, 3,
];
const A3b = [
  15, 8, 8, 3, 15, 15, 3, 8, 15, 15, 15, 15, 15, 15, 15, 8, 15, 8, 15, 3, 15, 8, 15, 8, 3, 15, 6, 10, 15, 15, 10, 8, 15,
  3, 15, 10, 10, 8, 9, 10, 6, 15, 8, 15, 3, 6, 6, 8, 15, 3, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 3, 15, 15, 8,
];

// mode: [subsets, partitionBits, rotationBits, idxSelBit, colorBits, alphaBits, endpointPBits, sharedPBits, indexBits, index2Bits]
const MODES = [
  [3, 4, 0, 0, 4, 0, 1, 0, 3, 0],
  [2, 6, 0, 0, 6, 0, 0, 1, 3, 0],
  [3, 6, 0, 0, 5, 0, 0, 0, 2, 0],
  [2, 6, 0, 0, 7, 0, 1, 0, 2, 0],
  [1, 0, 2, 1, 5, 6, 0, 0, 2, 3],
  [1, 0, 2, 0, 7, 8, 0, 0, 2, 2],
  [1, 0, 0, 0, 7, 7, 1, 0, 4, 0],
  [2, 6, 0, 0, 5, 5, 1, 0, 2, 0],
];

class Bits {
  constructor(src, off) {
    this.src = src;
    this.off = off;
    this.pos = 0;
  }
  get(n) {
    let v = 0;
    for (let i = 0; i < n; i++) {
      const p = this.pos + i;
      v |= ((this.src[this.off + (p >>> 3)] >>> (p & 7)) & 1) << i;
    }
    this.pos += n;
    return v;
  }
}

const interp = (e0, e1, w) => ((64 - w) * e0 + w * e1 + 32) >> 6;
const weightsFor = (bits) => (bits === 2 ? WEIGHTS2 : bits === 3 ? WEIGHTS3 : WEIGHTS4);

/** Decode one 16-byte block into `px` (16 RGBA texels, row-major). */
export function decodeBc7Block(src, off, px) {
  let mode = 0;
  while (mode < 8 && !((src[off] >>> mode) & 1)) mode++;
  if (mode === 8) {
    px.fill(0);
    return;
  } // reserved: transparent black, as the spec says
  const [ns, pb, rb, isb, cb, ab, epb, spb, ib, ib2] = MODES[mode];
  const r = new Bits(src, off);
  r.get(mode + 1);
  const partition = r.get(pb);
  const rotation = r.get(rb);
  const idxSel = r.get(isb);
  const nEnd = ns * 2;
  const ep = Array.from({ length: nEnd }, () => [0, 0, 0, 255]);
  for (let c = 0; c < 3; c++) for (let e = 0; e < nEnd; e++) ep[e][c] = r.get(cb);
  if (ab) for (let e = 0; e < nEnd; e++) ep[e][3] = r.get(ab);
  // P-bits, then expand to 8 bits.
  let cBits = cb,
    aBits = ab;
  if (epb) {
    for (let e = 0; e < nEnd; e++) {
      const p = r.get(1);
      for (let c = 0; c < 3; c++) ep[e][c] = (ep[e][c] << 1) | p;
      if (ab) ep[e][3] = (ep[e][3] << 1) | p;
    }
    cBits++;
    if (ab) aBits++;
  } else if (spb) {
    for (let s = 0; s < ns; s++) {
      const p = r.get(1);
      for (const e of [s * 2, s * 2 + 1]) for (let c = 0; c < 3; c++) ep[e][c] = (ep[e][c] << 1) | p;
    }
    cBits++;
  }
  for (let e = 0; e < nEnd; e++) {
    for (let c = 0; c < 3; c++) {
      const v = ep[e][c] << (8 - cBits);
      ep[e][c] = v | (v >>> cBits);
    }
    if (ab) {
      const v = ep[e][3] << (8 - aBits);
      ep[e][3] = v | (v >>> aBits);
    }
  }
  const part = ns === 1 ? null : ns === 2 ? P2[partition] : P3[partition];
  const isAnchor = (i) => {
    if (i === 0) return true;
    if (ns === 2) return i === A2[partition];
    if (ns === 3) return i === A3a[partition] || i === A3b[partition];
    return false;
  };
  const idx = new Uint8Array(16);
  for (let i = 0; i < 16; i++) idx[i] = r.get(isAnchor(i) ? ib - 1 : ib);
  let idx2 = null;
  if (ib2) {
    idx2 = new Uint8Array(16);
    for (let i = 0; i < 16; i++) idx2[i] = r.get(i === 0 ? ib2 - 1 : ib2);
  }
  const w1 = weightsFor(ib);
  const w2 = ib2 ? weightsFor(ib2) : null;
  for (let i = 0; i < 16; i++) {
    const s = part ? part[i] : 0;
    const e0 = ep[s * 2],
      e1 = ep[s * 2 + 1];
    let cw, aw;
    if (idx2) {
      if (idxSel) {
        cw = w2[idx2[i]];
        aw = w1[idx[i]];
      } else {
        cw = w1[idx[i]];
        aw = w2[idx2[i]];
      }
    } else {
      cw = aw = w1[idx[i]];
    }
    let R = interp(e0[0], e1[0], cw),
      G = interp(e0[1], e1[1], cw),
      B = interp(e0[2], e1[2], cw);
    let A = interp(e0[3], e1[3], aw);
    if (rotation === 1) [A, R] = [R, A];
    else if (rotation === 2) [A, G] = [G, A];
    else if (rotation === 3) [A, B] = [B, A];
    const o = i * 4;
    px[o] = R;
    px[o + 1] = G;
    px[o + 2] = B;
    px[o + 3] = A;
  }
}

/** Decode a BC7 mip-0 run to RGBA8, block order (bottom-up for Unity). */
export function bc7Decode(src, width, height) {
  const bw = Math.ceil(width / 4),
    bh = Math.ceil(height / 4);
  if (src.length < bw * bh * 16)
    throw new Error(`bc7: ${src.length} bytes for ${width}x${height} (needs ${bw * bh * 16})`);
  const out = new Uint8Array(width * height * 4);
  const px = new Uint8Array(64);
  for (let by = 0; by < bh; by++) {
    for (let bx = 0; bx < bw; bx++) {
      decodeBc7Block(src, (by * bw + bx) * 16, px);
      for (let y = 0; y < 4; y++) {
        const ty = by * 4 + y;
        if (ty >= height) break;
        for (let x = 0; x < 4; x++) {
          const tx = bx * 4 + x;
          if (tx >= width) break;
          const s = (y * 4 + x) * 4,
            d = (ty * width + tx) * 4;
          out[d] = px[s];
          out[d + 1] = px[s + 1];
          out[d + 2] = px[s + 2];
          out[d + 3] = px[s + 3];
        }
      }
    }
  }
  return out;
}

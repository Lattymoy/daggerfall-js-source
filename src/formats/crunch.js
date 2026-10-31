// Unity Crunch - TextureFormat 28 (DXT1Crunched) and 29 (DXT5Crunched) - back to plain DXT1/DXT5 blocks.
//
// Diverse Weapons HD ships every handheld frame (9,400+ of them) crunched: Unity's fork of Rich Geldreich's crnlib
// (the "unity" crunch, Unity 2017.3+), a static-Huffman stream of palette indices over four small palettes (color
// endpoints, color selectors, alpha endpoints, alpha selectors). The bundle reader (unityBundle.js) decoded only the
// plain formats, so the mod was refused. This is the DECODER half of crnd_decode (crn_decomp.h's crn_unpacker: the
// header, the canonical-Huffman symbol codec, decode_palettes, unpack_dxt1/unpack_dxt5), written from that source and
// validated block for block against the texture2ddecoder reference (unpack_unity_crunch) on the mod's own textures.
// Only what DFU mods use is here: the DXT1 and DXT5 families; the ETC/DXN variants throw.
//
// Out: the level's DXT blocks, row-major, ready for dxt.js.

const FMT_DXT1 = 0,
  FMT_DXT5 = 2,
  FMT_DXT5_CCxY = 3,
  FMT_DXT5_xGxR = 4,
  FMT_DXT5_xGBR = 5,
  FMT_DXT5_AGBR = 6;
const DXT5_FAMILY = new Set([FMT_DXT5, FMT_DXT5_CCxY, FMT_DXT5_xGxR, FMT_DXT5_xGBR, FMT_DXT5_AGBR]);
const MAX_SUPPORTED_SYMS = 8192;
const TOTAL_BITS_MAX_SYMS = 14; // math::total_bits(8192)
const MOST_PROBABLE_CODELENGTH_CODES = [17, 18, 19, 20, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15, 16];
const DXT5_FROM_LINEAR = [0, 2, 3, 4, 5, 6, 7, 1];

/** Big-endian packed unsigned (crn_packed_uint<N>). */
const be = (b, o, n) => {
  let v = 0;
  for (let i = 0; i < n; i++) v = v * 256 + b[o + i];
  return v;
};

/** The crn header (crn_defs.h crn_header). */
function readHeader(b) {
  if (b.length < 62 || be(b, 0, 2) !== ((0x48 << 8) | 0x78)) throw new Error('crunch: not a CRN stream');
  const pal = (o) => ({ ofs: be(b, o, 3), size: be(b, o + 3, 3), num: be(b, o + 6, 2) });
  const h = {
    headerSize: be(b, 2, 2),
    dataSize: be(b, 6, 4),
    width: be(b, 12, 2),
    height: be(b, 14, 2),
    levels: b[16],
    faces: b[17],
    format: b[18],
    colorEndpoints: pal(33),
    colorSelectors: pal(41),
    alphaEndpoints: pal(49),
    alphaSelectors: pal(57),
    tablesSize: be(b, 65, 2),
    tablesOfs: be(b, 67, 3),
    levelOfs: [],
  };
  for (let i = 0; i < h.levels; i++) h.levelOfs.push(be(b, 70 + i * 4, 4));
  return h;
}

/** A canonical Huffman model from code sizes (crnlib's decoder_tables: codes by length, then by symbol). */
function makeModel(sizes) {
  const counts = new Uint32Array(17);
  for (const s of sizes) if (s) counts[s]++;
  const first = new Int32Array(17),
    offset = new Int32Array(17);
  let code = 0,
    used = 0;
  for (let len = 1; len <= 16; len++) {
    first[len] = code;
    offset[len] = used;
    code = (code + counts[len]) << 1;
    used += counts[len];
  }
  const cursor = offset.slice();
  const sorted = new Uint16Array(used);
  for (let sym = 0; sym < sizes.length; sym++) if (sizes[sym]) sorted[cursor[sizes[sym]]++] = sym;
  // a fast table for codes up to 10 bits: peek 10 bits -> (sym, len)
  const FAST = 10;
  const fast = new Int32Array(1 << FAST).fill(-1);
  for (let len = 1; len <= FAST; len++) {
    for (let i = 0; i < counts[len]; i++) {
      const c = first[len] + i;
      const sym = sorted[offset[len] + i];
      const shift = FAST - len;
      for (let k = 0; k < 1 << shift; k++) fast[(c << shift) | k] = (len << 16) | sym;
    }
  }
  return { counts, first, offset, sorted, fast, FAST, empty: used === 0 };
}

/** The symbol codec (crnd symbol_codec): MSB-first bits, bytes past the end read as zero. */
class Codec {
  constructor(buf, ofs, size) {
    this.b = buf;
    this.p = ofs;
    this.end = ofs + size;
    this.bits = 0;
    this.n = 0;
  }
  fill(k) {
    while (this.n < k) {
      const c = this.p < this.end ? this.b[this.p] : 0;
      this.p++;
      this.bits = (this.bits * 256 + c) % 4294967296; // keep 32 bits; `n` never passes 32
      this.n += 8;
    }
  }
  peek(k) {
    this.fill(k);
    return Math.floor(this.bits / 2 ** (this.n - k)) % 2 ** k;
  }
  skip(k) {
    this.n -= k;
    this.bits %= 2 ** this.n;
  }
  getBits(k) {
    if (!k) return 0;
    if (k > 16) {
      const a = this.getBits(k - 16);
      return a * 65536 + this.getBits(16);
    }
    const v = this.peek(k);
    this.skip(k);
    return v;
  }
  decode(m) {
    const t = m.fast[this.peek(m.FAST)];
    if (t >= 0) {
      this.skip(t >>> 16);
      return t & 0xffff;
    }
    let code = 0;
    for (let len = 1; len <= 16; len++) {
      code = (code << 1) | this.getBits(1);
      const i = code - m.first[len];
      if (i >= 0 && i < m.counts[len]) return m.sorted[m.offset[len] + i];
    }
    throw new Error('crunch: bad Huffman code');
  }
  receiveModel() {
    const totalUsed = this.getBits(TOTAL_BITS_MAX_SYMS);
    if (!totalUsed) return makeModel(new Uint8Array(0));
    if (totalUsed > MAX_SUPPORTED_SYMS) throw new Error('crunch: too many symbols');
    const sizes = new Uint8Array(totalUsed);
    const nCodes = this.getBits(5);
    if (nCodes < 1 || nCodes > 21) throw new Error('crunch: bad code-length table');
    const clSizes = new Uint8Array(21);
    for (let i = 0; i < nCodes; i++) clSizes[MOST_PROBABLE_CODELENGTH_CODES[i]] = this.getBits(3);
    const dm = makeModel(clSizes);
    let ofs = 0;
    while (ofs < totalUsed) {
      const left = totalUsed - ofs;
      const code = this.decode(dm);
      if (code <= 16) sizes[ofs++] = code;
      else if (code === 17) {
        const len = this.getBits(3) + 3;
        if (len > left) throw new Error('crunch: run');
        ofs += len;
      } else if (code === 18) {
        const len = this.getBits(7) + 11;
        if (len > left) throw new Error('crunch: run');
        ofs += len;
      } else {
        const len = code === 19 ? this.getBits(2) + 3 : this.getBits(6) + 7;
        if (!ofs || len > left) throw new Error('crunch: repeat');
        const prev = sizes[ofs - 1];
        if (!prev) throw new Error('crunch: repeat of zero');
        for (let e = ofs + len; ofs < e;) sizes[ofs++] = prev;
      }
    }
    return makeModel(sizes);
  }
}

/**
 * Unpack one mip level of a Unity crunch stream to DXT blocks.
 * @returns {{ format: 'DXT1'|'DXT5', width: number, height: number, blocks: Uint8Array }}
 */
export function unpackUnityCrunch(bytes, level = 0) {
  const b = bytes;
  const h = readHeader(b);
  const isDxt1 = h.format === FMT_DXT1;
  if (!isDxt1 && !DXT5_FAMILY.has(h.format))
    throw new Error(`crunch: format ${h.format} is not a DXT1/DXT5 family this reader decodes`);
  if (level >= h.levels) throw new Error('crunch: no such level');

  // tables
  const t = new Codec(b, h.tablesOfs, h.tablesSize);
  const refModel = t.receiveModel();
  const endpointDelta = [null, null],
    selectorDelta = [null, null];
  if (h.colorEndpoints.num) {
    endpointDelta[0] = t.receiveModel();
    selectorDelta[0] = t.receiveModel();
  }
  if (h.alphaEndpoints.num) {
    endpointDelta[1] = t.receiveModel();
    selectorDelta[1] = t.receiveModel();
  }

  // palettes
  let colorEndpoints = new Uint32Array(0),
    colorSelectors = new Uint32Array(0),
    alphaEndpoints = new Uint16Array(0),
    alphaSelectors = new Uint16Array(0);
  if (h.colorEndpoints.num) {
    const c = new Codec(b, h.colorEndpoints.ofs, h.colorEndpoints.size);
    const dm0 = c.receiveModel(),
      dm1 = c.receiveModel();
    colorEndpoints = new Uint32Array(h.colorEndpoints.num);
    let A = 0,
      B = 0,
      C = 0,
      D = 0,
      E = 0,
      F = 0;
    for (let i = 0; i < colorEndpoints.length; i++) {
      A = (A + c.decode(dm0)) & 31;
      B = (B + c.decode(dm1)) & 63;
      C = (C + c.decode(dm0)) & 31;
      D = (D + c.decode(dm0)) & 31;
      E = (E + c.decode(dm1)) & 63;
      F = (F + c.decode(dm0)) & 31;
      colorEndpoints[i] = (C | (B << 5) | (A << 11) | (F << 16) | (E << 21) | (D << 27)) >>> 0;
    }
    const s = new Codec(b, h.colorSelectors.ofs, h.colorSelectors.size);
    const dm = s.receiveModel();
    colorSelectors = new Uint32Array(h.colorSelectors.num);
    let x = 0;
    for (let i = 0; i < colorSelectors.length; i++) {
      for (let j = 0; j < 32; j += 4) x = (x ^ (s.decode(dm) << j)) >>> 0;
      colorSelectors[i] = (((x ^ (x << 1)) & 0xaaaaaaaa) | ((x >>> 1) & 0x55555555)) >>> 0;
    }
  }
  if (h.alphaEndpoints.num) {
    const c = new Codec(b, h.alphaEndpoints.ofs, h.alphaEndpoints.size);
    const dm = c.receiveModel();
    alphaEndpoints = new Uint16Array(h.alphaEndpoints.num);
    let A = 0,
      B = 0;
    for (let i = 0; i < alphaEndpoints.length; i++) {
      A = (A + c.decode(dm)) & 255;
      B = (B + c.decode(dm)) & 255;
      alphaEndpoints[i] = A | (B << 8);
    }
    const s = new Codec(b, h.alphaSelectors.ofs, h.alphaSelectors.size);
    const sdm = s.receiveModel();
    alphaSelectors = new Uint16Array(h.alphaSelectors.num * 3);
    const fromLinear = new Uint8Array(64);
    for (let i = 0; i < 64; i++) fromLinear[i] = DXT5_FROM_LINEAR[i & 7] | (DXT5_FROM_LINEAR[i >> 3] << 3);
    // s0/s1 are 24-bit linear selector words; JS numbers hold them exactly
    let s0l = 0,
      s1l = 0;
    for (let i = 0; i < alphaSelectors.length;) {
      let s0 = 0,
        s1 = 0;
      for (let j = 0; j < 24; j += 6) {
        s0l = (s0l ^ (s.decode(sdm) << j)) & 0xffffff;
        s0 |= fromLinear[(s0l >>> j) & 0x3f] << j;
      }
      for (let j = 0; j < 24; j += 6) {
        s1l = (s1l ^ (s.decode(sdm) << j)) & 0xffffff;
        s1 |= fromLinear[(s1l >>> j) & 0x3f] << j;
      }
      alphaSelectors[i++] = s0 & 0xffff;
      alphaSelectors[i++] = ((s0 >>> 16) | (s1 << 8)) & 0xffff;
      alphaSelectors[i++] = (s1 >>> 8) & 0xffff;
    }
  }

  // the level
  const width = Math.max(1, h.width >> level),
    height = Math.max(1, h.height >> level);
  const bx = (width + 3) >> 2,
    by = (height + 3) >> 2;
  const blockBytes = isDxt1 ? 8 : 16;
  const out = new Uint8Array(bx * by * blockBytes);
  const dv = new DataView(out.buffer);
  const start = h.levelOfs[level];
  const end = level + 1 < h.levels ? h.levelOfs[level + 1] : b.length;
  const c = new Codec(b, start, end - start);
  const W = (bx + 1) & ~1,
    H = (by + 1) & ~1;
  const bufRef = new Uint8Array(W),
    bufColor = new Uint32Array(W),
    bufAlpha = new Uint32Array(W);
  let colorIdx = 0,
    alphaIdx = 0,
    group = 0;
  const nColor = colorEndpoints.length,
    nAlpha = alphaEndpoints.length;
  for (let f = 0; f < h.faces; f++) {
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const visible = y < by && x < bx;
        if (!(y & 1) && !(x & 1)) group = c.decode(refModel);
        let ref;
        if (y & 1) ref = bufRef[x];
        else {
          ref = group & 3;
          group >>= 2;
          bufRef[x] = group & 3;
          group >>= 2;
        }
        if (ref === 0) {
          colorIdx += c.decode(endpointDelta[0]);
          if (colorIdx >= nColor) colorIdx -= nColor;
          bufColor[x] = colorIdx;
          if (!isDxt1) {
            alphaIdx += c.decode(endpointDelta[1]);
            if (alphaIdx >= nAlpha) alphaIdx -= nAlpha;
            bufAlpha[x] = alphaIdx;
          }
        } else if (ref === 1) {
          bufColor[x] = colorIdx;
          if (!isDxt1) bufAlpha[x] = alphaIdx;
        } else {
          colorIdx = bufColor[x];
          if (!isDxt1) alphaIdx = bufAlpha[x];
        }
        const cs = c.decode(selectorDelta[0]);
        const as = isDxt1 ? 0 : c.decode(selectorDelta[1]);
        if (!visible || f) continue; // one face: a 2D texture
        const o = (y * bx + x) * blockBytes;
        if (isDxt1) {
          dv.setUint32(o, colorEndpoints[colorIdx], true);
          dv.setUint32(o + 4, colorSelectors[cs], true);
        } else {
          const a = as * 3;
          dv.setUint32(o, (alphaEndpoints[alphaIdx] | (alphaSelectors[a] << 16)) >>> 0, true);
          dv.setUint32(o + 4, (alphaSelectors[a + 1] | (alphaSelectors[a + 2] << 16)) >>> 0, true);
          dv.setUint32(o + 8, colorEndpoints[colorIdx], true);
          dv.setUint32(o + 12, colorSelectors[cs], true);
        }
      }
    }
  }
  return { format: isDxt1 ? 'DXT1' : 'DXT5', width, height, blocks: out };
}

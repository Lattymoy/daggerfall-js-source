// SNOWFALL1 (2026-10-08): RAW DEFLATE (RFC 1951), both ways and in step - what .NET's DeflateStream reads and writes
// with no zlib or gzip wrapper. Snowfall keeps its persistent tracks in its save record as deflated, base64 bytes
// (PersistentTrackField.WriteSaveData / RestoreSaveData), and a save is written in step (systems/modSaveData.js
// GetSaveData), so the platform's CompressionStream - which answers later - cannot pack it.
//
// THE WRITER is LZ77 over a 32 KiB window (a hash of three bytes, chains of 32) coded with the fixed Huffman tables, in
// one final block: any inflater reads it, and the same bytes always pack the same way. .NET's own writer picks its
// own blocks, so a record packs to different bytes than DFU's - a departure no reader sees (Port-Ledger A, SNOWFALL1).
// THE READER is the whole format: stored, fixed and dynamic blocks; it throws on a stream that is not deflate.

const LEN_BASE = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258];
const LEN_EXTRA = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0];
const DIST_BASE = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073,
  4097, 6145, 8193, 12289, 16385, 24577];
const DIST_EXTRA = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13];
const CL_ORDER = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];

const WINDOW = 32768, MIN_MATCH = 3, MAX_MATCH = 258, CHAIN = 32, HASH_BITS = 15;

/** A code's bits reversed, the order deflate puts a Huffman code on the wire. */
function reverse(code, len) {
  let r = 0;
  for (let i = 0; i < len; i++) { r = (r << 1) | (code & 1); code >>>= 1; }
  return r;
}

/** The fixed literal/length code of `sym` as `[bits, length]` - RFC 1951 3.2.6. */
function fixedLit(sym) {
  if (sym < 144) return [reverse(0x30 + sym, 8), 8];
  if (sym < 256) return [reverse(0x190 + sym - 144, 9), 9];
  if (sym < 280) return [reverse(sym - 256, 7), 7];
  return [reverse(0xc0 + sym - 280, 8), 8];
}
const FIXED_LIT = Array.from({ length: 288 }, (_, s) => fixedLit(s));
const FIXED_DIST = Array.from({ length: 30 }, (_, d) => [reverse(d, 5), 5]);

/** The length code for a match of `len` (3..258): `[symbol, extra bits, extra value]`. */
function lengthCode(len) {
  let i = LEN_BASE.length - 1;
  while (LEN_BASE[i] > len) i--;
  return [257 + i, LEN_EXTRA[i], len - LEN_BASE[i]];
}
/** The distance code for `dist` (1..32768): `[code, extra bits, extra value]`. */
function distCode(dist) {
  let i = DIST_BASE.length - 1;
  while (DIST_BASE[i] > dist) i--;
  return [i, DIST_EXTRA[i], dist - DIST_BASE[i]];
}

/**
 * Raw deflate of `input` (a Uint8Array): one final fixed-Huffman block.
 * @param {Uint8Array} input
 * @returns {Uint8Array}
 */
export function deflateRaw(input) {
  const out = [];
  let acc = 0, nbits = 0;
  const put = (bits, len) => {
    acc |= bits << nbits; nbits += len;
    while (nbits >= 8) { out.push(acc & 255); acc >>>= 8; nbits -= 8; }
  };
  put(1, 1); put(1, 2);   // BFINAL, BTYPE = 01 (fixed Huffman)
  const n = input.length;
  const head = new Int32Array(1 << HASH_BITS).fill(-1);
  const prev = new Int32Array(WINDOW).fill(-1);
  const hash = (i) => (((input[i] << 10) ^ (input[i + 1] << 5) ^ input[i + 2]) & ((1 << HASH_BITS) - 1));
  const insert = (i) => { if (i + 2 < n) { const h = hash(i); prev[i & (WINDOW - 1)] = head[h]; head[h] = i; } };
  let i = 0;
  while (i < n) {
    let bestLen = 0, bestDist = 0;
    if (i + MIN_MATCH <= n) {
      let cand = head[hash(i)], chain = CHAIN;
      const max = Math.min(MAX_MATCH, n - i);
      while (cand >= 0 && i - cand <= WINDOW && chain-- > 0) {
        let l = 0;
        while (l < max && input[cand + l] === input[i + l]) l++;
        if (l > bestLen) { bestLen = l; bestDist = i - cand; if (l === max) break; }
        cand = prev[cand & (WINDOW - 1)];
      }
    }
    if (bestLen >= MIN_MATCH) {
      const [sym, eb, ev] = lengthCode(bestLen);
      put(...FIXED_LIT[sym]); if (eb) put(ev, eb);
      const [dc, db, dv] = distCode(bestDist);
      put(...FIXED_DIST[dc]); if (db) put(dv, db);
      for (let k = 0; k < bestLen; k++) insert(i + k);
      i += bestLen;
    } else {
      put(...FIXED_LIT[input[i]]);
      insert(i);
      i++;
    }
  }
  put(...FIXED_LIT[256]);   // end of block
  if (nbits > 0) out.push(acc & 255);
  return Uint8Array.from(out);
}

/** A canonical Huffman decoding table from code lengths: `{ counts, symbols }` (RFC 1951 3.2.2). */
function huffman(lengths) {
  const counts = new Uint16Array(16), offs = new Uint16Array(16);
  for (const l of lengths) counts[l]++;
  counts[0] = 0;
  for (let l = 1; l < 16; l++) offs[l] = offs[l - 1] + counts[l - 1];
  const symbols = new Uint16Array(lengths.length);
  for (let s = 0; s < lengths.length; s++) if (lengths[s]) symbols[offs[lengths[s]]++] = s;
  return { counts, symbols };
}

/**
 * Inflate a raw deflate stream, to the end of its final block.
 * @param {Uint8Array} input
 * @returns {Uint8Array}
 */
export function inflateRaw(input) {
  let pos = 0, bitBuf = 0, bitCnt = 0;
  const bits = (need) => {
    while (bitCnt < need) {
      if (pos >= input.length) throw new Error('inflateRaw: the stream ends early');
      bitBuf |= input[pos++] << bitCnt; bitCnt += 8;
    }
    const v = bitBuf & ((1 << need) - 1);
    bitBuf >>>= need; bitCnt -= need;
    return v;
  };
  const decode = (h) => {
    let code = 0, first = 0, index = 0;
    for (let len = 1; len < 16; len++) {
      code |= bits(1);
      const count = h.counts[len];
      if (code - count < first) return h.symbols[index + (code - first)];
      index += count; first += count; first <<= 1; code <<= 1;
    }
    throw new Error('inflateRaw: a bad Huffman code');
  };
  let out = new Uint8Array(Math.max(64, input.length * 4)), n = 0;
  const grow = (need) => { if (n + need > out.length) { const o = new Uint8Array(Math.max(out.length * 2, n + need)); o.set(out.subarray(0, n)); out = o; } };
  const fixedLitLens = new Uint8Array(288).fill(8, 0, 144).fill(9, 144, 256).fill(7, 256, 280).fill(8, 280, 288);
  const FIXED_LIT_H = huffman(fixedLitLens), FIXED_DIST_H = huffman(new Uint8Array(30).fill(5));
  let last = 0;
  while (!last) {
    last = bits(1);
    const type = bits(2);
    if (type === 0) {
      bitBuf = 0; bitCnt = 0;   // to the byte
      if (pos + 4 > input.length) throw new Error('inflateRaw: a stored block ends early');
      const len = input[pos] | (input[pos + 1] << 8), nlen = input[pos + 2] | (input[pos + 3] << 8);
      if ((len ^ 0xffff) !== nlen) throw new Error('inflateRaw: a stored block with a bad length');
      pos += 4;
      if (pos + len > input.length) throw new Error('inflateRaw: a stored block ends early');
      grow(len); out.set(input.subarray(pos, pos + len), n); n += len; pos += len;
      continue;
    }
    let lit, dist;
    if (type === 1) { lit = FIXED_LIT_H; dist = FIXED_DIST_H; }
    else if (type === 2) {
      const hlit = bits(5) + 257, hdist = bits(5) + 1, hclen = bits(4) + 4;
      const clLens = new Uint8Array(19);
      for (let k = 0; k < hclen; k++) clLens[CL_ORDER[k]] = bits(3);
      const cl = huffman(clLens);
      const lens = new Uint8Array(hlit + hdist);
      for (let k = 0; k < hlit + hdist;) {
        const sym = decode(cl);
        if (sym < 16) { lens[k++] = sym; continue; }
        let rep = 0, val = 0;
        if (sym === 16) { if (k === 0) throw new Error('inflateRaw: a repeat with nothing before it'); val = lens[k - 1]; rep = 3 + bits(2); }
        else if (sym === 17) rep = 3 + bits(3);
        else rep = 11 + bits(7);
        if (k + rep > hlit + hdist) throw new Error('inflateRaw: too many code lengths');
        lens.fill(val, k, k + rep); k += rep;
      }
      lit = huffman(lens.subarray(0, hlit)); dist = huffman(lens.subarray(hlit));
    } else throw new Error('inflateRaw: a reserved block type');
    for (;;) {
      const sym = decode(lit);
      if (sym < 256) { grow(1); out[n++] = sym; continue; }
      if (sym === 256) break;
      const li = sym - 257;
      if (li >= 29) throw new Error('inflateRaw: a bad length code');
      const len = LEN_BASE[li] + bits(LEN_EXTRA[li]);
      const di = decode(dist);
      if (di >= 30) throw new Error('inflateRaw: a bad distance code');
      const d = DIST_BASE[di] + bits(DIST_EXTRA[di]);
      if (d > n) throw new Error('inflateRaw: a distance before the start');
      grow(len);
      for (let k = 0; k < len; k++) { out[n] = out[n - d]; n++; }
    }
  }
  return out.slice(0, n);
}

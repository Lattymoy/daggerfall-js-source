// LZ4 BLOCK decompression (the raw block format, no frame): what a
// UnityFS AssetBundle wraps its blocks-info and its data blocks in when
// it was built with ChunkBasedCompression (LZ4, or LZ4HC, which is the
// same block format written by a slower compressor - the decoder does
// not know the difference). Written from the format's own description
// (lz4_Block_format.md, Yann Collet): a sequence of
//   token | literal length (+ 255-continuations) | literals |
//   match offset (u16 LE) | match length (+ continuations, + 4)
// with the last sequence carrying literals only. Match copies may
// OVERLAP their destination (offset < length), which is the byte-by-byte
// copy below, not a memcpy.
//
// Pure: bytes in, bytes out, no I/O. `readUnityBundle` is its one
// caller; the pins drive it with hand-built blocks.

const MIN_MATCH = 4;

/**
 * Decompress one LZ4 block into a buffer of exactly `outSize` bytes.
 * Throws on malformed input (a literal or match that would run past
 * either buffer, or a block that ends before filling the output), so a
 * corrupt bundle is an error and never a silently short texture.
 * @param {Uint8Array} src
 * @param {number} outSize
 * @returns {Uint8Array}
 */
export function lz4BlockDecompress(src, outSize) {
  const out = new Uint8Array(outSize);
  let ip = 0;
  let op = 0;
  const n = src.length;
  while (ip < n) {
    const token = src[ip++];
    let litLen = token >>> 4;
    if (litLen === 15) {
      let s;
      do {
        if (ip >= n) throw new Error('lz4: literal length runs past the block');
        s = src[ip++];
        litLen += s;
      } while (s === 255);
    }
    if (ip + litLen > n || op + litLen > outSize) throw new Error('lz4: literals run past a buffer');
    for (let i = 0; i < litLen; i++) out[op++] = src[ip++];
    if (ip >= n) break;   // the last sequence carries literals only
    if (ip + 2 > n) throw new Error('lz4: truncated match offset');
    const offset = src[ip] | (src[ip + 1] << 8);
    ip += 2;
    if (offset === 0 || offset > op) throw new Error('lz4: match offset outside the output written so far');
    let matchLen = token & 15;
    if (matchLen === 15) {
      let s;
      do {
        if (ip >= n) throw new Error('lz4: match length runs past the block');
        s = src[ip++];
        matchLen += s;
      } while (s === 255);
    }
    matchLen += MIN_MATCH;
    if (op + matchLen > outSize) throw new Error('lz4: match runs past the output');
    let ref = op - offset;
    for (let i = 0; i < matchLen; i++) out[op++] = out[ref++];
  }
  if (op !== outSize) throw new Error(`lz4: block filled ${op} of ${outSize} bytes`);
  return out;
}

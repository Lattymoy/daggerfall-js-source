// @ts-check
// ═══════════════════════════════════════════════════════════════════
// POI-1 (2026-10-14) - A POI'S TEXTURE, KNOWN BY ITS OWN HEADER.
//
// A texture is stored as the image the editor imported (a glTF's PNG, JPEG or WebP - poi/gltfImport.js), by its sha256,
// and decoded by the browser that draws it (createImageBitmap). The account service never decodes pixels; it reads the
// header the format itself writes and refuses what is not one of the three, or is larger than a texture may be - so a
// stored texture is always an image the game can open, of a size it can hold.
// ═══════════════════════════════════════════════════════════════════

export const POI_IMAGE_LIMITS = Object.freeze({ side: 4096, bytes: 16 * 1024 * 1024 });
export const POI_IMAGE_TYPES = Object.freeze({ png: 'image/png', jpeg: 'image/jpeg', webp: 'image/webp' });

/**
 * The image these bytes hold - `{ format, w, h, type }` - or `{ error }`. PNG by its signature and IHDR; JPEG by its SOI
 * and the first start-of-frame marker; WebP by its RIFF container's VP8, VP8L or VP8X chunk. Never throws.
 * @param {ArrayBuffer | Uint8Array} input
 * @returns {{ format: 'png' | 'jpeg' | 'webp', w: number, h: number, type: string } | { error: string }}
 */
export function poiImageMetaOf(input) {
  const b = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (b.byteLength > POI_IMAGE_LIMITS.bytes) return { error: 'too-many-bytes' };
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const at = (/** @type {number} */ i, /** @type {number[]} */ sig) => sig.every((v, k) => b[i + k] === v);
  /** @type {{ format: 'png' | 'jpeg' | 'webp', w: number, h: number } | null} */
  let got = null;
  if (b.byteLength >= 33 && at(0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) && at(12, [0x49, 0x48, 0x44, 0x52])) {
    got = { format: 'png', w: dv.getUint32(16), h: dv.getUint32(20) };
  } else if (b.byteLength >= 4 && b[0] === 0xff && b[1] === 0xd8) {
    // walk the markers to the first SOFn (C0-CF, but C4 DHT, C8 JPG and CC DAC are not frames)
    let i = 2;
    while (i + 9 < b.byteLength) {
      if (b[i] !== 0xff) return { error: 'jpeg' };
      const m = b[i + 1];
      if (m === 0xff) { i++; continue; }
      if (m === 0xd8 || m === 0x01 || (m >= 0xd0 && m <= 0xd7)) { i += 2; continue; }
      const len = dv.getUint16(i + 2);
      if (len < 2) return { error: 'jpeg' };
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) { got = { format: 'jpeg', w: dv.getUint16(i + 7), h: dv.getUint16(i + 5) }; break; }
      if (m === 0xda || m === 0xd9) return { error: 'jpeg' };   // scan data or the end before any frame
      i += 2 + len;
    }
    if (!got) return { error: 'jpeg' };
  } else if (b.byteLength >= 30 && at(0, [0x52, 0x49, 0x46, 0x46]) && at(8, [0x57, 0x45, 0x42, 0x50])) {
    const chunk = String.fromCharCode(b[12], b[13], b[14], b[15]);
    if (chunk === 'VP8 ') {
      if (!at(23, [0x9d, 0x01, 0x2a])) return { error: 'webp' };
      got = { format: 'webp', w: dv.getUint16(26, true) & 0x3fff, h: dv.getUint16(28, true) & 0x3fff };
    } else if (chunk === 'VP8L') {
      if (b[20] !== 0x2f) return { error: 'webp' };
      const bits = dv.getUint32(21, true);
      got = { format: 'webp', w: (bits & 0x3fff) + 1, h: ((bits >>> 14) & 0x3fff) + 1 };
    } else if (chunk === 'VP8X') {
      const w = (b[24] | (b[25] << 8) | (b[26] << 16)) + 1, h = (b[27] | (b[28] << 8) | (b[29] << 16)) + 1;
      got = { format: 'webp', w, h };
    } else return { error: 'webp' };
  } else return { error: 'not-an-image' };
  if (!(got.w > 0 && got.h > 0)) return { error: 'size' };
  if (got.w > POI_IMAGE_LIMITS.side || got.h > POI_IMAGE_LIMITS.side) return { error: 'too-large' };
  return { ...got, type: POI_IMAGE_TYPES[got.format] };
}

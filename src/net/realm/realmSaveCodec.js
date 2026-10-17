// @ts-check
// ═══════════════════════════════════════════════════════════════════
// REALM-GZIP (2026-09-30, the field: Thoryn's tile said "This
// character's save is too big for the realm to take"): A REALM SAVE
// RIDES GZIPPED. The law both ends read - the playing tab packs its
// checkpoint with it (systems/realmSaves.js realmPut) and opens what a
// join reads; the service opens a record it must read (server-account/
// src/realm.js realmSaveTextOf: a first save, a gold act, a trade).
//
// The save is the snapshot's JSON, and a long life's grew past the
// 4 MiB the service takes in one request (REALM_MAX_BYTES) - refused
// for good, the session ended, and every checkpoint after it the same.
// JSON packs five to ten times over, so the request's bound stands and
// the text's is REALM_TEXT_MAX_BYTES.
//
// THE BYTES SAY WHICH THEY ARE. gzip opens with 0x1f 0x8b (RFC 1952)
// and no JSON text can - JSON's whitespace is space, tab, LF and CR -
// so a stored object needs no header or metadata to be read, and the
// saves stored before this read exactly as they did.
//
// OLDER ENDS KEEP WORKING. A service that does not name `gzip` on its
// join, create and customs answers is sent the text as before; a tab
// that does not ask a read gzipped (`?enc=gzip`) is answered the text,
// the service opening a packed save for it.
// ═══════════════════════════════════════════════════════════════════

/** The largest save TEXT the realm keeps: what a packed checkpoint may open to, and what a record the service writes (a
 *  trade, a gold act) may reach. The request's own bound is the service's REALM_MAX_BYTES; this is the text's. */
export const REALM_TEXT_MAX_BYTES = 16 * 1024 * 1024;

/** gzip's smallest whole: a ten-byte header, an empty deflate block and the eight-byte trailer. */
const GZIP_MIN_BYTES = 20;

/** Is this gzip? Its two magic bytes, which no JSON text begins with. */
export const isGzip = (/** @type {Uint8Array} */ bytes) => bytes.byteLength >= GZIP_MIN_BYTES && bytes[0] === 0x1f && bytes[1] === 0x8b;

/** The length a gzip SAYS it opens to - its trailer's ISIZE (RFC 1952: the input's length mod 2^32, little-endian). An
 *  honest packer says true; one made to lie is caught by the bound every opening keeps (gunzipText). */
export const gzipSizeOf = (/** @type {Uint8Array} */ bytes) => new DataView(bytes.buffer, bytes.byteOffset + bytes.byteLength - 4, 4).getUint32(0, true);

/** Can this runtime pack, and open? (Every browser the game runs in, Node and workerd; the answer is asked, not assumed.) */
export const canGzip = () => typeof CompressionStream === 'function';
export const canGunzip = () => typeof DecompressionStream === 'function';

/** The text, gzipped. */
export async function gzipText(/** @type {string} */ text) {
  const packed = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'));
  return new Uint8Array(await new Response(packed).arrayBuffer());
}

/** A gzip opened to its text - or null: not whole, not gzip, or opening past `max` bytes (read as it opens, so a small
 *  body that opens to gigabytes costs the bound and no more). */
export async function gunzipText(/** @type {Uint8Array} */ bytes, max = REALM_TEXT_MAX_BYTES) {
  const reader = new Blob([/** @type {BlobPart} */ (bytes)]).stream().pipeThrough(new DecompressionStream('gzip')).getReader();
  /** @type {Uint8Array[]} */
  const parts = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > max) { reader.cancel().catch(() => {}); return null; }
      parts.push(value);
    }
  } catch {
    return null;
  }
  const out = new Uint8Array(size);
  let at = 0;
  for (const p of parts) { out.set(p, at); at += p.byteLength; }
  return new TextDecoder().decode(out);
}

/** A save's bytes as its text - opened when packed, read as they stand when not - or null past `max` or unopenable. */
export async function saveTextOf(/** @type {Uint8Array} */ bytes, max = REALM_TEXT_MAX_BYTES) {
  if (isGzip(bytes)) return gunzipText(bytes, max);
  return bytes.byteLength > max ? null : new TextDecoder().decode(bytes);
}

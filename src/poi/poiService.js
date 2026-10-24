// @ts-check
// ═══════════════════════════════════════════════════════════════════
// POI-3 (2026-10-14) - THE EDITOR'S DOOR TO THE POI STORE (server-account/src/poi.js; bible/06-Systems/POI-Editor-Arc.md).
//
// Every route the editor asks, by name, so no screen spells a path (net/accountClient.js's ladder's rule). The reads and
// the acts - who am I, the list, a POI's history, the approver's queue, the library's shelf; submit, withdraw, retire,
// review, roll back, take off the shelf - go
// through the account client's one door (`call`: the bearer, the busy gate, a network failure answered as `offline`).
// The three that carry a BODY no JSON ladder takes - a draft (to 96 KiB of document), a shelf entry (the same) and an
// asset (a mesh or a picture, to megabytes) - are PUTs of their own here, as the saves' blobs are (systems/cloudSaves.js), answered in the door's
// own shape: `{ ok: true, data, status }` or `{ ok: false, error, status }`.
//
// An asset is named by its sha256 (the store refuses bytes that are not what they name), so an upload hashes first, and
// one the store already has comes back `existed` - an import uploads only what is new.
//
// Not a DFU member. Ledger A (POI).
// ═══════════════════════════════════════════════════════════════════

import { call } from '../net/accountClient.js';

/** @typedef {{ fetch: (url: string, init?: any) => Promise<any>, base: string, secret: string | null }} PoiIo */

const hex = (/** @type {ArrayBuffer} */ buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
/** An asset's name: the sha256 of its bytes, in hex. @param {Uint8Array} bytes */
export async function poiSha256(bytes, subtle = globalThis.crypto.subtle) {
  return hex(await subtle.digest('SHA-256', /** @type {BufferSource} */ (/** @type {unknown} */ (bytes))));
}

/** A PUT this door makes itself - its body JSON or bytes - answered as `call` answers. @param {PoiIo} io */
async function put(io, path, body, contentType) {
  const headers = { accept: 'application/json', 'content-type': contentType };
  if (io.secret) headers.authorization = `Bearer ${io.secret}`;
  let res;
  try {
    res = await io.fetch(`${io.base}${path}`, { method: 'PUT', headers, body });
  } catch {
    return { ok: false, error: 'offline' };
  }
  let data = null;
  try { data = await res.json(); } catch { data = null; }
  if (!res.ok) {
    return { ok: false, error: typeof data?.error === 'string' ? data.error : 'server', ...(typeof data?.why === 'string' ? { why: data.why } : {}),
      ...(Array.isArray(data?.problems) ? { problems: data.problems } : {}), status: res.status };   // the law's own word on a refusal
  }
  if (!data) return { ok: false, error: 'offline', unknown: true, status: res.status };
  return { ok: true, data, status: res.status };
}

/** Who the store takes this account for: `{ handle, builder, approver }`. @param {PoiIo} io */
export const poiMe = (io) => call(io, '/v1/poi/me');
/** Every POI a builder may see: `{ pois: [{ id, liveRev, liveAt, newestRev, revs: [...] }] }`. @param {PoiIo} io */
export const poiList = (io) => call(io, '/v1/poi/list');
/** The approver's queue: the oldest submitted revisions, each with the live document it would replace and its own
 *  document's name (`docSha`) - `{ queue, more }`, `more` when others wait (AUDIT POI S1, S10). @param {PoiIo} io */
export const poiQueue = (io) => call(io, '/v1/poi/queue');
/** One POI's every revision, documents and words. @param {PoiIo} io @param {string} id */
export const poiHistory = (io, id) => call(io, `/v1/poi/doc/${id}`);

/** Save a draft: `{ id, rev, state: 'draft' }` - a builder's one open draft of a POI, made or saved over. `base` the live
 *  revision it was made from (null for a POI never approved). @param {PoiIo} io @param {any} doc @param {number | null} base */
export const poiSaveDraft = (io, doc, base = null) => put(io, '/v1/poi/draft', JSON.stringify({ doc, base }), 'application/json');
/** A draft sent for the approver's word. @param {PoiIo} io */
export const poiSubmit = (io, id, rev) => call(io, '/v1/poi/submit', { id, rev });
/** A submission taken back to a draft. @param {PoiIo} io */
export const poiWithdraw = (io, id, rev) => call(io, '/v1/poi/withdraw', { id, rev });
/** Ask that a live POI come out of the world (the approver decides, as for any revision). @param {PoiIo} io */
export const poiRetire = (io, id) => call(io, '/v1/poi/retire', { id });
/** The approver's word on a submission: `verdict` 'approve' or 'reject', with a note. AUDIT POI S1: `docSha` the name of
 *  the document the approver looked at (the queue item's) - an approval of a document names it, and the store refuses
 *  `poi-changed` a revision whose document is no longer that one. @param {PoiIo} io */
export const poiReview = (io, id, rev, verdict, note = null, docSha = null) => call(io, '/v1/poi/review', { id, rev, verdict, note, ...(typeof docSha === 'string' ? { docSha } : {}) });
/** The approver puts an earlier approved revision back in the world. @param {PoiIo} io */
export const poiRollback = (io, id, rev) => call(io, '/v1/poi/rollback', { id, rev });

// POI-4b: THE LIBRARY'S SHELF - the models builders keep to stand again
/** Every entry on the shelf, newest change first, without its parts: `{ items: [{ id, name, tags, thumb, parts,
 *  triangles, by, byId, at, updatedAt, updatedBy }] }`. @param {PoiIo} io */
export const poiShelf = (io) => call(io, '/v1/poi/shelf');
/** One entry, its parts and lights: `{ id, item, by, byId, at, updatedAt }`. @param {PoiIo} io @param {string} id */
export const poiShelfEntry = (io, id) => call(io, `/v1/poi/shelf/${id}`);
/** Put an entry on the shelf, or change one of the builder's own (an approver's, any): `{ id, at }`. A PUT of its own -
 *  an entry is a POI's parts, past the ladder's bound. @param {PoiIo} io @param {any} item */
export const poiShelve = (io, item) => put(io, '/v1/poi/shelf', JSON.stringify({ item }), 'application/json');
/** Take an entry off the shelf (its author or an approver). @param {PoiIo} io @param {string} id */
export const poiUnshelve = (io, id) => call(io, '/v1/poi/unshelve', { id });

/**
 * Upload an asset: hashed, then put under its name - `{ ok, data: { sha, kind, meta, existed } }`.
 * @param {PoiIo} io @param {Uint8Array} bytes @param {'mesh' | 'texture'} kind
 */
export async function poiPutAsset(io, bytes, kind, subtle = globalThis.crypto.subtle) {
  const sha = await poiSha256(bytes, subtle);
  const r = await put(io, `/v1/poi/asset/${sha}?kind=${kind}`, bytes, 'application/octet-stream');
  return r.ok ? r : { ...r, sha };
}

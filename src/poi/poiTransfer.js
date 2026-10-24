// @ts-check
// ═══════════════════════════════════════════════════════════════════
// POI-6 (2026-10-14) - POIS AND MODELS OUT OF THE EDITOR AND BACK IN: A .glb, AND A PACK.
//
// Mac: "a tool my developers can use without having to access the codebase" (bible/06-Systems/POI-Editor-Arc.md POI-6).
// The editor's panel (ui/poi/poiEditorPanel.js) and the library (ui/poi/poiLibraryPanel.js) hand this module what they hold;
// it fetches what they name, writes the file, or reads one back into the store:
//
//   - `exportModel(model, fetchAsset)`: a POI's or a library entry's parts and lights as one .glb (poi/gltfExport.js) -
//     every mesh fetched and read, every picture fetched and known by its header.
//   - `exportPack({ pois, shelf }, fetchAsset)`: documents and entries with every asset they name, as a pack
//     (poi/poiPack.js writePack) - held to the pack's law before anything is fetched.
//   - `importPack(pack, io)`: a pack read and checked (poiPack.js readPack) into the store - every asset uploaded by its
//     name (one the store has comes back `existed`), every library entry put where the store has none under its id,
//     left as it is where the store has it as the pack does, and put under an id of its own where the store has another
//     (never over it), and every POI handed back to be OPENED: as a change to the store's live revision where the store
//     knows the POI (the before and after the approver will read), else as new.
//
// A fetch that fails stops the export and says which; nothing half-written leaves the editor. Not a DFU member. Ledger A
// (POI).
// ═══════════════════════════════════════════════════════════════════

import { writeGlb } from './gltfExport.js';
import { writePack, packRefusal } from './poiPack.js';
import { poiAssetsOf, mintShelfId } from './poiLaw.js';
import { decodePoiMesh } from './poiMesh.js';
import { poiImageMetaOf } from './poiImage.js';
import { poiSha256 } from './poiService.js';

/** A name a file may carry: letters, digits, spaces, dashes and underscores, never empty. @param {string} name */
export const fileNameOf = (name, ext, fallback = 'poi') => `${String(name ?? '').replace(/[^\p{L}\p{N} _-]+/gu, '').trim().replace(/\s+/g, '-').slice(0, 64) || fallback}.${ext}`;

/**
 * A model as a .glb: `{ ok: true, bytes }` or `{ ok: false, code: 'export-fetch', sha }`.
 * @param {{ name: string, parts: any[], lights?: any[] }} model @param {(sha: string) => Promise<Uint8Array>} fetchAsset
 */
export async function exportModel({ name, parts, lights = [] }, fetchAsset) {
  const pieces = [], pictures = new Map();
  for (const p of parts) {
    let bytes;
    try { bytes = await fetchAsset(p.mesh); } catch { return { ok: false, code: 'export-fetch', sha: p.mesh }; }
    const d = decodePoiMesh(bytes);
    if ('error' in d) return { ok: false, code: 'export-fetch', sha: p.mesh };
    pieces.push({ ...p, mesh: d.mesh });
    for (const m of p.materials) {
      for (const sha of [m.texture, m.emissive]) {
        if (!sha || pictures.has(sha)) continue;
        let pic;
        try { pic = await fetchAsset(sha); } catch { return { ok: false, code: 'export-fetch', sha }; }
        const im = poiImageMetaOf(pic);
        if ('error' in im) return { ok: false, code: 'export-fetch', sha };
        pictures.set(sha, { bytes: pic, format: im.format });
      }
    }
  }
  return { ok: true, bytes: writeGlb({ name, parts: pieces, lights, pictures }) };
}

/**
 * Documents and entries as a pack, every asset they name fetched: `{ ok: true, bytes }` or `{ ok: false, code, ...args }`
 * - a pack's refusal (poiPack.js, said by poiText.js packErrorText) or `export-fetch` with the asset's `sha`.
 * @param {{ pois?: any[], shelf?: any[] }} what @param {(sha: string) => Promise<Uint8Array>} fetchAsset
 */
export async function exportPack({ pois = [], shelf = [] }, fetchAsset) {
  // AUDIT POI P2: the law and the pack's bounds asked before anything is fetched - every POI open was packed, one just
  // made with no part among them, the panel said "Packed 2 POIs", and the pack would not open again (writePack asks
  // what they wear once the bytes are here)
  const refused = packRefusal({ pois, shelf });
  if (refused) return { ok: false, ...refused };
  const assets = new Map();
  for (const d of [...pois, ...shelf]) {
    const { meshes, textures } = poiAssetsOf(d);
    for (const sha of [...meshes, ...textures]) {
      if (assets.has(sha)) continue;
      try { assets.set(sha, await fetchAsset(sha)); } catch { return { ok: false, code: 'export-fetch', sha }; }
    }
  }
  return writePack({ pois, shelf, assets });
}

/** An entry's content as one text: every object's keys in order, its id left out - two entries alike, one text. */
const contentOf = (entry) => JSON.stringify(inOrder({ ...entry, id: null }));
const inOrder = (v) => (Array.isArray(v) ? v.map(inOrder)
  : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, inOrder(v[k])])) : v);
/** The ids a copy of an entry is offered, in turn, before one is minted afresh. */
export const POI_COPY_IDS = 8;
/** The id the k-th copy of an entry is offered: `lib-` and twelve hex of the sha256 of its source's id, k and its
 *  content - the same copy the same id at every import, by every builder (poiLaw.js POI_SHELF_ID_RE). */
export const copyIdOf = async (entry, k, content = contentOf(entry)) => `lib-${(await poiSha256(new TextEncoder().encode(`${entry.id}\n${k}\n${content}`))).slice(0, 12)}`;

/**
 * One entry of a pack onto the shelf, never over another: AUDIT POI P4 - it was put over whatever the store kept under
 * its id, and only where the store refused that was it put again under a fresh id, so an approver's import (or an
 * author's old pack) put an older copy over a builder's current entry unasked, and another builder's import made a new
 * copy every time it ran. Now the store is asked first. Its id free: put there. The store has it as the pack does: left
 * as it is. The store has another: put under a copy's id (copyIdOf), asked the same way - so an import run again finds
 * what the first one put. Answers `{ ok: true, id, copied, already }` or the store's refusal.
 */
async function shelveOne(entry, { shelfEntry, shelve, rand }) {
  const content = contentOf(entry);
  for (let k = -1; k <= POI_COPY_IDS; k++) {
    const id = k < 0 ? entry.id : k < POI_COPY_IDS ? await copyIdOf(entry, k, content) : mintShelfId(rand);
    const had = await shelfEntry(id);
    if (had.ok) { if (contentOf(had.data.item) === content) return { ok: true, id, copied: k >= 0, already: true }; continue; }
    // taken off the shelf: its id stays its own, never put over (AUDIT POI U13, lane A: the store says 'poi-gone') - the next
    if (had.error === 'poi-gone') continue;
    if (had.error !== 'not-found') return had;
    const r = await shelve(k < 0 ? entry : { ...entry, id });
    if (r.ok) return { ok: true, id, copied: k >= 0, already: false };
    // taken off the shelf since it was asked (kept, never put over - 'poi-gone'), or put there by another: the next id
    if (r.error !== 'poi-not-author' && r.error !== 'poi-gone') return r;
  }
  return { ok: false, error: 'poi-not-author' };
}

/**
 * A checked pack into the store. `io`: `putAsset(bytes, kind)`, `history(id)` (poiHistory's answer), `shelfEntry(id)`
 * (poiShelfEntry's), `shelve(item)` - each answered as poi/poiService.js answers - `rand` for an entry id when every copy's
 * is taken, and `progress(done, of)`. Answers `{ ok: true, open: [{ id, doc, saved, base, state }], shelved, copied,
 * already, uploaded, existed }` - `shelved` every entry now on the shelf as the pack has it, `copied` those under an id
 * of their own, `already` those the store had - or the store's refusal `{ ok: false, error, at, problems? }` (`at` the
 * asset's sha or the entry's or POI's name; `problems` the law's, when the store gave them).
 * @param {{ pois: any[], shelf: any[], assets: Map<string, { kind: string, bytes: Uint8Array }> }} pack
 * @param {{ putAsset: (bytes: Uint8Array, kind: any) => Promise<any>, history: (id: string) => Promise<any>,
 *   shelfEntry: (id: string) => Promise<any>, shelve: (item: any) => Promise<any>, rand: (b: Uint8Array) => Uint8Array,
 *   progress?: (done: number, of: number) => void }} io
 */
export async function importPack(pack, { putAsset, history, shelfEntry, shelve, rand, progress = () => {} }) {
  const total = pack.assets.size + pack.shelf.length + pack.pois.length;
  let done = 0, uploaded = 0, existed = 0, shelved = 0, copied = 0, already = 0;
  const refusal = (r, at) => ({ ok: false, error: r.error, at, ...(r.problems ? { problems: r.problems } : {}) });
  for (const [sha, a] of pack.assets) {
    const r = await putAsset(a.bytes, a.kind);
    if (!r.ok) return refusal(r, sha);
    if (r.data.existed) existed++; else uploaded++;
    progress(++done, total);
  }
  for (const entry of pack.shelf) {
    const r = await shelveOne(entry, { shelfEntry, shelve, rand });
    if (!r.ok) return refusal(r, entry.name);
    shelved++;
    if (r.copied) copied++;
    if (r.already) already++;
    progress(++done, total);
  }
  const open = [];
  for (const doc of pack.pois) {
    const h = await history(doc.id);
    if (h.ok) {
      const live = h.data.revs?.find((x) => x.rev === h.data.liveRev)?.doc ?? null;
      open.push({ id: doc.id, doc, saved: live, base: h.data.liveRev ?? null, state: h.data.liveRev ? 'live' : 'draft' });
    } else if (h.error === 'not-found') {
      open.push({ id: doc.id, doc, saved: null, base: null, state: 'new' });
    } else return refusal(h, doc.name);
    progress(++done, total);
  }
  return { ok: true, open, shelved, copied, already, uploaded, existed };
}

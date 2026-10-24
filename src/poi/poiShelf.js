// @ts-check
// ═══════════════════════════════════════════════════════════════════
// POI-4b (2026-10-14) - THE LIBRARY'S SHELF: AN ENTRY MADE, ITS PICTURE DRAWN, AND IT KEPT.
//
// Mac: "Allowing not just the creation of POI's using models, but also the ability to import models ... a tool my
// developers can use without having to access the codebase" (bible/06-Systems/POI-Editor-Arc.md POI-4b). A model a
// builder imported or made is kept on the library's shelf, shared with every builder, to stand again anywhere without
// its file: an ENTRY is its parts (each the law's own - its mesh and materials by their hashes, its offset, turn and size
// from the model's origin, its solidity and shadow) and its lights, a name, tags, words, and a picture of it.
//
//   - `shelfEntryOf(...)`: an entry from parts as an import or a POI holds them - each part made the law's (poiEdit.js
//     newPart: keyed, its materials whole), the name and tags as the law takes them.
//   - `shelfThumb(entry, ...)`: its picture - its parts drawn (poi/poiThumb.js) from their meshes and pictures, a PNG.
//   - `putOnShelf(entry, ...)`: the law asked first (a refusal is the editor's sentence before it is the store's), the
//     picture drawn and uploaded as a texture by its name, then the entry put. A picture that will not draw leaves the
//     entry without one - it is still kept, and the library says it by its name.
//
// The store's side: server-account/src/poi.js listShelf / shelfEntry / shelve / unshelve. Pure but for what it is
// handed. Not a DFU member. Ledger A (POI).
// ═══════════════════════════════════════════════════════════════════

import { poiShelfProblems, POI_DOC_VERSION, POI_LIMITS } from './poiLaw.js';
import { newPart, lawName } from './poiEdit.js';
import { renderThumb, encodePng } from './poiThumb.js';

/**
 * An entry from parts as an import (poi/poiImport.js uploadImport's `asset.parts`) or a POI holds them.
 * @param {{ id: string, name: string, about?: string, tags?: string[], parts: any[], lights?: any[] }} o
 */
export function shelfEntryOf({ id, name, about = '', tags = [], parts, lights = [] }) {
  const scratch = { parts: [] };
  for (const p of parts) {
    const part = newPart(scratch, { mesh: p.mesh, submeshes: p.submeshes ?? p.materials?.length ?? 1, name: p.name ?? '', materials: p.materials ?? null, t: p.t ?? [0, 0, 0], r: p.r, s: p.s });
    if (p.collide) part.collide = p.collide;
    if (typeof p.shadow === 'boolean') part.shadow = p.shadow;
    scratch.parts.push(part);
  }
  const words = String(about ?? '').trim();
  const tagList = [...new Set(tags.map((tg) => lawName(tg, POI_LIMITS.tag)).filter(Boolean))].slice(0, POI_LIMITS.tags);
  return {
    v: POI_DOC_VERSION, id, name: lawName(name), ...(words ? { about: words.slice(0, POI_LIMITS.about) } : {}), ...(tagList.length ? { tags: tagList } : {}),
    parts: scratch.parts, lights: lights.map((l) => structuredClone(l)), thumb: null,
  };
}

/**
 * The entry's picture as PNG bytes. `meshOf(sha)` a part's mesh, decoded (null: the part is left out of the picture);
 * `pictureOf(sha)` a picture decoded to RGBA (a failure: the material drawn as its colour alone).
 * @param {any} entry @param {{ meshOf: (sha: string) => Promise<any>, pictureOf: (sha: string) => Promise<any> }} io
 */
export async function shelfThumb(entry, { meshOf, pictureOf }) {
  const pieces = [];
  const pictures = new Map();
  const picture = (sha) => { if (!pictures.has(sha)) pictures.set(sha, Promise.resolve().then(() => pictureOf(sha)).catch(() => null)); return pictures.get(sha); };
  for (const p of entry.parts) {
    const mesh = await meshOf(p.mesh);
    if (!mesh) continue;
    const materials = [];
    for (const m of p.materials) materials.push({ ...m, picture: m.texture ? await picture(m.texture) : null });
    pieces.push({ mesh, t: p.t, r: p.r, s: p.s, materials });
  }
  return encodePng(renderThumb(pieces));
}

/**
 * Keep an entry on the shelf: the law first, its picture drawn and uploaded, then the entry put. `{ ok: true, id, item }`
 * or `{ ok: false, error, problems? }` - the store's word, or the law's problems.
 * @param {any} entry
 * @param {{ meshOf: (sha: string) => Promise<any>, pictureOf: (sha: string) => Promise<any>,
 *   putAsset: (bytes: Uint8Array, kind: 'texture') => Promise<any>, shelve: (item: any) => Promise<any> }} io
 */
export async function putOnShelf(entry, { meshOf, pictureOf, putAsset, shelve }) {
  const item = { ...entry, thumb: null };
  const own = poiShelfProblems(item);
  if (own.length) return { ok: false, error: 'poi-doc', problems: own };
  let png = null;
  try { png = await shelfThumb(item, { meshOf, pictureOf }); } catch { png = null; }
  if (png) {
    const r = await putAsset(png, 'texture');
    if (!r.ok) return { ok: false, error: r.error };
    item.thumb = r.data.sha;
  }
  const s = await shelve(item);
  if (!s.ok) return { ok: false, error: s.error, ...(s.problems ? { problems: s.problems } : {}) };
  return { ok: true, id: s.data.id, item };
}

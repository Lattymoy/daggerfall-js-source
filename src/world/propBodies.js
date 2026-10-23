// @ts-check
// PROP-BODIES (2026-10-19, the owner: "Implement collision for all props", after "walking through trees and objects is
// very immersion breaking"). DFU's flats are billboards with no collider (DaggerfallBillboard: a quad and a material),
// so a player walked through every tree, rock, barrel and statue. Here a SOLID flat stands a BODY - an upright cylinder
// at its foot - and the player, on foot or mounted, is kept out of it (player/bodyClamp.js, after the collider's move).
//
// A body rides the cover index (ai/cover.js, a proxy marked `body`): the same sets, frames and lifecycle as a flat's
// cover, so a pixel, a building or a dungeon that leaves takes its bodies with it, a recentre moves them, and a felled
// tree's body is gone with its tree (FELLED). Never the collider: the collider is shared, and a column there would stop
// arrows, foes, the camera and every activation ray - and a 0.3 m trunk in its triangle soup is walked through anyway
// (opposing pushes cancel on thin geometry). Foes, peers and the navmesh are as they were.
//
// WHICH FLATS (the owner's "all props" - the solid ones; the flora a body walks through, as one walks through ferns):
//   - a TREE its trunk, never its crown: a Tree record of its climate (terrainNature.js TREE_RECORDS) or a record
//     Windfall sways Full (systems/windfall.js RESPONSE.full - the mod's own tier for the trees and the tall, stemmed
//     plants: the rainforest's twisted 500.3, the temperate 504.11 the tree table does not name) the trunk a tree's cover
//     stands (COVER_TRUNK_R, to where its crown begins); a jungle tree its own measured girth (JUNGLE_MEASURES);
//   - a STILL nature record - a rock, a stump, a fallen log, a bare tree: Windfall's table's 0, the records it never
//     sways - and every flat that is not nature - a barrel, a crate, a statue, a well, a cart, a signpost - its FOOT
//     MEASURED off its own picture (footShare): a flat's drawn width is its widest reach - a bare tree's roots and
//     branches, a signpost's board - never what a body walks into;
//   - at least a step tall (the motor's STEP_OFFSET: what the feet step over is no wall), and never a person, a town
//     animal, a light, the editor's markers or treasure (cover's own NOT_COVER_ARCHIVES), nor the flora Windfall sways
//     Low or Medium (grass, flowers, ferns, bushes - a jungle of solid ferns could not be walked).
// bible/03-World/Player-Arc.md (PROP-BODIES), bible/12-Enhanced-AI/Tactics-Arc.md (the index it rides).
import { NOT_COVER_ARCHIVES, COVER_RADIUS_FRAC, COVER_HEIGHT_FRAC, COVER_TRUNK_R, COVER_CROWN_FROM } from '../ai/cover.js';
import { responseByte, RESPONSE } from '../systems/windfall.js';
import { JUNGLE_MEASURES } from './jungle/jungleModels.js';
import { isNatureArchive } from './rmbFlats.js';
import { STEP_OFFSET, CAPSULE_HEIGHT } from '../player/motor.js';

/** A flat's body - or none: `t` its texture file (the record's picture, for its foot), `size` its drawn { w, h };
 *  `tree` a Tree record of its climate (terrainNature.js isTreeRecord - the host's word, as its cover's). Flora by its
 *  archive (rmbFlats.js isNatureArchive, DFU's own range: the jungle's archive 500 in a mountain pixel too). Its foot by
 *  reference (`c`), as its cover's. */
export function flatBody(c, t, archive, record, size, { tree = false } = {}) {
  if (NOT_COVER_ARCHIVES.has(archive) || c?.noCover) return null;
  const w = size?.w ?? 0, h = size?.h ?? 0;
  const sway = isNatureArchive(archive) ? responseByte(archive, record) : 0;
  if (tree || sway === RESPONSE.full) return body(c, Math.min(w * COVER_RADIUS_FRAC, COVER_TRUNK_R), h * COVER_CROWN_FROM);
  if (sway !== 0) return null;   // the flora, Low and Medium
  return body(c, (footShare(t, record, size) * w) / 2, h * COVER_HEIGHT_FRAC);
}
const body = (c, r, h) => (r > 0 && h >= STEP_OFFSET ? { c, r, h, lift: 0, body: true } : null);

/** A group's bodies (flatBody for each foot), for a host's cover list. */
export function flatBodies(t, archive, record, size, centers, opts = {}) {
  const out = [];
  for (const c of centers) { const b = flatBody(c, t, archive, record, size, opts); if (b) out.push(b); }
  return out;
}

const _feet = new WeakMap();
/**
 * THE FOOT, MEASURED: how wide a record's classic picture stands - a share of its drawn width - where a body meets it:
 * the median over its rows between a step over its base and a capsule's height (or its top) of how much of each row is
 * picture, not air (its own cutout, index 0 - DaggerfallBillboard's). A bare tree its trunk, not its roots' reach; a
 * rock its own girth; a signpost its post. Read once a texture file and record (and height, for a flat a site scales); a record with no
 * picture to read keeps cover's share of its drawn width (COVER_RADIUS_FRAC, a side).
 * @param {any} t the record's TextureFile @param {number} record @param {{ w: number, h: number }} size
 */
export function footShare(t, record, size) {
  if (!t?.getDFBitmap || !(size?.h > 0)) return 2 * COVER_RADIUS_FRAC;
  let known = _feet.get(t);
  if (!known) _feet.set(t, (known = new Map()));
  const key = `${record}:${size.h.toFixed(3)}`;
  if (known.has(key)) return known.get(key);
  const bmp = t.getDFBitmap(record, 0);
  let share = 2 * COVER_RADIUS_FRAC;
  // a classic record's own cutout (index 0), or - a painted stand-in's, which has no index (systems/textureReplacement.js
  // vendorTextureFile: `data` null beside its `rgba`, top-down as `data` is) - its own alpha (AUDIT WITCH1 D7: a festival
  // ward-staff, a 2 px post, stood a body as wide as its whole picture's cover)
  const solid = bmp?.data ? (/** @type {number} */ i) => bmp.data[i] !== 0 : bmp?.rgba?.length >= bmp?.width * bmp?.height * 4 ? (/** @type {number} */ i) => bmp.rgba[i * 4 + 3] !== 0 : null;
  if (solid && bmp.width > 0 && bmp.height > 0) {
    const perRow = size.h / bmp.height, spans = [];
    const lo = Math.max(0, bmp.height - Math.round(Math.min(size.h, CAPSULE_HEIGHT) / perRow)), hi = bmp.height - 1 - Math.round(STEP_OFFSET / perRow);
    for (let y = lo; y <= hi; y++) {
      let n = 0;
      for (let x = 0; x < bmp.width; x++) if (solid(y * bmp.width + x)) n++;
      spans.push(n / bmp.width);
    }
    if (spans.length) { spans.sort((p, q) => p - q); share = spans[spans.length >> 1]; }
  }
  known.set(key, share);
  return share;
}

/** A jungle tree's body: its trunk's measured girth to where its crown begins, at its own scale (jungleModels.js
 *  jungleCover's trunk - the measures a table, so a client whose files did not load stands the same bodies). */
export function jungleBody(c, species, scale) {
  const m = JUNGLE_MEASURES[species];
  return { c, r: m.trunk * scale, h: m.crownFrom * scale, lift: 0, body: true };
}

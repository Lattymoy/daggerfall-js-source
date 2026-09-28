// @ts-check
// ═══════════════════════════════════════════════════════════════════
// BASE-HIDE (2026-09-26) — THE ROOM'S OWN FURNITURE, ONE PIECE AT A TIME.
//
// Mac: "Remove bought houses decor - the base game decor isnt easy to
// decorate around when u want more in depth house". What Daggerfall
// furnished a room with is its interior's prop models and flats, which a
// room is built from in one merge (one static batch, one collider
// bucket, the flats grouped by picture - scenes/interiorContext.js). A
// room its owner may furnish is built PIECE BY PIECE instead - each prop
// model its own draw and its own collider bucket (`base:<key>`), each
// flat its own batch and its own light - and handed in here, so the
// owner can take a piece out of the room and put it back while standing
// in it, and every visit and every visitor stands the room the same way
// (the list of what is out: the save's, or the account service's).
//
// A piece is named by the layout (net/decorLaw.js DECOR_BASE_KEY_RE):
// `m<placement>:<model>`, `f<flat>:<archive>.<record>`. Taking one out
// takes all of it - its draw, its collider (nothing to walk into), its
// light, and, a cupboard, a shelf or a bed, its place among the room's
// targets (the host's own lists are keyed by index, so the entry stays
// and says `hidden`). A piece that HOLDS anything is never taken out:
// what it holds would go with it, out of reach.
// ═══════════════════════════════════════════════════════════════════

import { DECOR_BASE_KEY_RE, DECOR_HIDDEN_CAP, decorHiddenOf } from '../net/decorLaw.js';

/** A built-in model's collider bucket - its own, so a piece taken out is nothing to walk into. */
export const baseBucketOf = (key) => `base:${key}`;

/**
 * THE ROOM'S OWN PIECES. `drawList` - the room's draw list; `batches()`, `lights()` - its billboard batches and its
 * lights (the host draws and lights from all three every frame; the last two are built after the models, so they are
 * read when asked); `collider` - the room's collider (addMesh / removeBucket).
 * @param {{ drawList: any[], batches: () => any[], lights: () => any[], collider: any }} deps
 */
export function createBaseRoom({ drawList, batches, lights, collider }) {
  /** @type {Map<string, any>} */
  const pieces = new Map();
  /** names the room was told to keep out that it does not have (a layout its data set lays otherwise): kept, unread */
  /** @type {Set<string>} */
  const stray = new Set();
  const drop = (list, x) => { const i = list.indexOf(x); if (i >= 0) list.splice(i, 1); };
  const holds = (p) => !!(p?.furniture && Array.isArray(p.furniture.items) && p.furniture.items.length);

  function hide(key) {
    const p = pieces.get(key);
    if (!p || p.hidden || holds(p)) return false;
    p.hidden = true;
    if (p.draw) { drop(drawList, p.draw); collider?.removeBucket?.(baseBucketOf(key)); }
    if (p.furniture) p.furniture.hidden = true;
    if (p.batch) drop(batches(), p.batch);
    if (p.light) drop(lights(), p.light);
    return true;
  }
  function show(key) {
    const p = pieces.get(key);
    if (!p || !p.hidden) return false;
    p.hidden = false;
    if (p.draw) {
      drawList.push(p.draw);
      if (p.cpu?.positions && p.cpu?.indices) collider?.addMesh?.(baseBucketOf(key), p.cpu.positions, p.cpu.indices, p.matrix);
    }
    if (p.furniture) p.furniture.hidden = false;
    if (p.batch) batches().push(p.batch);
    if (p.light) lights().push(p.light);
    return true;
  }

  return {
    /** A prop model as the build stood it: its draw entry (never the merge), its geometry, where it stands. */
    addModel(key, { model, draw, cpu, matrix, at }) {
      pieces.set(key, { key, model, flat: null, at, hidden: false, draw, cpu, matrix, furniture: null, batch: null, light: null });
    },
    /** A flat as the build stood it: its own batch, and the light it gives (null: none). */
    addFlat(key, { flat, batch, light = null, at }) {
      pieces.set(key, { key, model: null, flat, at, hidden: false, draw: null, cpu: null, matrix: null, furniture: null, batch, light });
    },
    /** The cupboard, the shelf or the bed a model is - the entry in the host's index-keyed list. */
    furnish(key, entry) { const p = pieces.get(key); if (p && entry) p.furniture = entry; },
    /** Every piece, in the layout's order: its name, what it is, where it stands, whether it is out, whether it holds. */
    list() {
      return [...pieces.values()].map((p) => ({ key: p.key, model: p.model, flat: p.flat, at: p.at, hidden: p.hidden, holds: holds(p) }));
    },
    hide,
    show,
    /** The list the room keeps taken out - every piece out, and the names it was told to keep that it does not have. */
    hidden() {
      const out = new Set(stray);
      for (const p of pieces.values()) if (p.hidden) out.add(p.key);
      return [...out].sort();
    },
    /** The room as the save or the account service keeps it: every named piece out, every other back - a name the law
     *  does not take is no name, and no more than the cap is kept. Anything but a list changes nothing. */
    setHidden(keys) {
      if (!Array.isArray(keys)) return false;
      const named = [...new Set(keys.filter((k) => typeof k === 'string' && DECOR_BASE_KEY_RE.test(k)))].slice(0, DECOR_HIDDEN_CAP);
      const want = decorHiddenOf(named) ?? [];
      const set = new Set(want);
      stray.clear();
      for (const k of set) if (!pieces.has(k)) stray.add(k);
      for (const p of pieces.values()) { if (set.has(p.key)) hide(p.key); else show(p.key); }
      return true;
    },
    /** The batches of the flats taken out - out of the room's list, so its teardown does not see them. */
    outBatches() { return [...pieces.values()].filter((p) => p.hidden && p.batch).map((p) => p.batch); },
  };
}

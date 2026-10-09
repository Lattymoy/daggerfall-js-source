// @ts-check
// ═══════════════════════════════════════════════════════════════════
// LOOT11 (2026-10-01) — A LINE OF LIGHT OVER EVERY FIND.
//
// The Loot arc (bible/06-Systems/Loot-Arc.md section 13; Mac: "Do you
// wanna turn this into an arc and do all of the above?" - "tier beams on
// Rare+ drops"). A body or a pile holding a Rare or better stands a thin
// line of its BEST tier's colour - WBX3's form (a line out of the find's
// own top, never a beam beside it), through the gate spoils' own renderer
// (render/spoilsGlow.js: additive, fogged, no light, no new program), a
// Legendary's and better pulsing. The nearest LOOT_LINES_MAX within
// LOOT_LINES_REACH of the eye, in the dungeon, the street and a building;
// gone the moment its best is taken below Rare (the pick reads the list
// every frame). A peer's body in the street shows none - its list lives
// on its owner's side (scenes/exteriorFoes.js lootFinds says so). OFF IS
// DFU EXACTLY: with the loot-rarity row off, nothing draws.
//
// A find is `{ root, items }`: the crown of its sprite (a billboard is
// bottom-anchored - render/bounds.js - so its crown is its feet and its
// height) and the list it holds, read live.
//
// PI1 (Physical Items, scenes/physicalItemsLayer.js): an item standing in
// the world as itself is its own find (`own`), its line out of its own
// picture - the world boss's spoils' form - and the body or pile it lies
// for no longer counts it toward its own line.
// ═══════════════════════════════════════════════════════════════════

import { SpoilsGlowRenderer } from '../render/spoilsGlow.js';
import { bestRarity, RARITIES, lootRarityOn } from '../systems/lootRarity.js';
import { isPresented } from '../systems/physicalItems.js';   // PI1: the items that stand as themselves

/** The most lines a frame stands, and how far from the eye a find may be (metres). */
export const LOOT_LINES_MAX = 8;
export const LOOT_LINES_REACH = 40;
/** A sprite whose height is not known yet stands its line this high. */
export const LOOT_LINE_CROWN = 0.6;

/** A find's crown: its feet and its sprite's height. */
export const lootCrown = (pos, size) => (Array.isArray(pos) && pos.length >= 3 ? [pos[0], pos[1] + (Number.isFinite(size?.h) ? size.h : LOOT_LINE_CROWN), pos[2]] : null);

/** THE PICK: the finds whose best is Rare or better, the nearest `max` within `reach` of the eye, nearest first -
 *  `[{ root, tier, alpha }]` as the renderer takes them. None with the row off. */
export function pickLootLines(finds, eye, { max = LOOT_LINES_MAX, reach = LOOT_LINES_REACH } = {}) {
  if (!Array.isArray(finds) || (!Array.isArray(eye) && !(eye instanceof Float32Array))) return [];
  const rarity = lootRarityOn();
  const out = [];
  for (const f of finds) {
    const root = f?.root;
    if (!Array.isArray(root) || root.length !== 3 || !root.every(Number.isFinite) || !Array.isArray(f.items) || !f.items.length) continue;
    // WILD1: a find with a `mark` of its own (my remains in the open zone - net/wildRemains.js) stands its own line, in
    // its own colour and height, with the rarity row on or off: it says where my things are, not what they are worth
    if (f.mark) {
      const d = Math.hypot(root[0] - eye[0], root[1] - eye[1], root[2] - eye[2]);
      if (d <= (f.mark.reach ?? reach)) out.push({ root, tier: 'common', alpha: 1, d, colour: f.mark.colour, h: f.mark.h, pulse: !!f.mark.pulse });
      continue;
    }
    if (!rarity) continue;   // OFF IS DFU EXACTLY: with the loot-rarity row off, no find's own line
    const tier = bestRarity(f.own ? f.items : f.items.filter((it) => !isPresented(it)));   // PI1: a standing item's line is its own
    if (!tier || (RARITIES[tier]?.rank ?? 0) < RARITIES.rare.rank) continue;
    const d = Math.hypot(root[0] - eye[0], root[1] - eye[1], root[2] - eye[2]);
    if (!(d <= reach)) continue;
    out.push({ root, tier, alpha: 1, d });
  }
  out.sort((a, b) => a.d - b.d);
  return out.slice(0, max).map(({ root, tier, alpha, colour, h, pulse }) => (colour ? { root, tier, alpha, colour, h, pulse } : { root, tier, alpha }));
}

/** WILD1: whether a MARKED find stands in the scene (my remains in the open zone - net/wildRemains.js hasMine). With the
 *  rarity row off the pass gathers the finds only then: off stays DFU exactly everywhere else. */
let _marksLive = false;
export const setLootMarksLive = (on) => { _marksLive = !!on; };

/** THE HOST'S PASS - one renderer a GL context, built once (a context that will not build it draws nothing). `draw`
 *  answers whether it lit a line (the host marks its foreign pass when it did). */
export function createLootLines(gl) {
  let glow = null;
  try { glow = gl ? new SpoilsGlowRenderer(gl) : null; } catch (e) { console.warn('[loot] the lines would not build', /** @type {any} */ (e)?.message ?? e); glow = null; }
  return {
    /** `finds` the list, or a function answering it - asked only while the row is on, so an off frame gathers nothing. */
    draw(finds, proj, view, eye, seconds, fog = null) {
      if (!glow || (!lootRarityOn() && !_marksLive)) return false;   // WILD1: a marked find stands its line with the rarity row off too (pickLootLines)
      const lines = pickLootLines(typeof finds === 'function' ? finds() : finds, eye);
      if (!lines.length) return false;
      glow.draw(lines, proj, view, eye, seconds, fog);
      return glow.drawn > 0;
    },
  };
}

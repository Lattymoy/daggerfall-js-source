// @ts-check
// BOUNTY1 (Mac, 2026-09-28: "board quests can be a green circle", then "make the circles black green area already
// players on the map"): A HELD BOUNTY'S PIXEL, ON BOTH MAPS - in black, since green is the party's.
//
// The host hands the maps a FUNCTION (`bounties: () => marks[]`, beside WB1's `gate`) and neither map learns what a
// bounty is: a mark is a circle in map pixels - `{cx, cy, r, label}` from scenes/bountyHost.js mapMarks() - read on
// each window's own poll. The held map draws it in ink (ui/inkMap.js paintBountyRing); the classic region page
// writes its edge into the page's texels (gateRingTexels' own law), on the open province's pixels only.
//
// Not a DFU member. Ledger A (BOUNTY1).
import { gateRingTexels } from './gateMapMark.js';

/** The circle's ink, the wash under it and the classic page's texel - BLACK: green is the party's on both maps, and
 *  a hunt's pixel must never be read as a friend. A near-black, so the classic page's buffer never mistakes it for
 *  an empty texel; its label rides the map's own pale halo, so it reads on the dark sea too. */
export const BOUNTY_RING_CSS = '#0b0b0b';
export const BOUNTY_FILL_CSS = 'rgba(0, 0, 0, 0.16)';
export const BOUNTY_DOT_RGB = Object.freeze([12, 12, 12]);
/** The legend's swatch rim - a black dot on a dark legend needs a pale edge to be seen. */
export const BOUNTY_LEGEND_RIM_CSS = '#e6dccb';
export const BOUNTY_LEGEND_TEXT = 'Bounty';
/** The circle's radius, map pixels: the target pixel inside it with a ring of its neighbours as the band. */
export const BOUNTY_RING_R = 1.5;
/** RVN7c (bible/12-Enhanced-AI/Feud-Arc.md 18.3): A REVENANT'S LAIR the player has heard of - the same circle, in blood
 *  red, with its name; `revenants: () => marks[]` beside `bounties` in the host's map deps (systems/revenant.js
 *  revenantMapMarks), read by the same reader. */
export const REVENANT_RING_CSS = '#7a0a0a';
export const REVENANT_FILL_CSS = 'rgba(122, 10, 10, 0.16)';
export const REVENANT_DOT_RGB = Object.freeze([122, 10, 10]);
export const REVENANT_LEGEND_TEXT = 'Revenant lair';
/** The most circles a map draws (a hunter holds four; the room is for a later party view). */
export const BOUNTY_MARKS_MAX = 8;

/**
 * The host's marks, read and checked - an empty list for none, a throw, or anything a map could not place.
 * @param {(() => any) | undefined} fn
 * @param {{width:number, height:number}} size the map, in pixels
 * @returns {Array<{cx:number, cy:number, r:number, label:string}>}
 */
export function readBountyMarks(fn, size, fallbackLabel = BOUNTY_LEGEND_TEXT) {
  let list = null;
  try { list = typeof fn === 'function' ? fn() : null; } catch { return []; }
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const m of list) {
    if (!m || typeof m !== 'object') continue;
    const { cx, cy, r } = m;
    if (![cx, cy, r].every(Number.isFinite) || !(r > 0)) continue;
    if (cx + r < 0 || cy + r < 0 || cx - r > size.width || cy - r > size.height) continue;
    out.push({ cx, cy, r, label: String(m.label ?? fallbackLabel).slice(0, 40) });
    if (out.length >= BOUNTY_MARKS_MAX) break;
  }
  return out;
}

/** What a map repaints on: the circles and their words. */
export const bountyMarksKey = (marks) => (marks ?? []).map((m) => `${m.cx.toFixed(2)}|${m.cy.toFixed(2)}|${m.r}|${m.label}`).join(';');

/** The classic page's texels for every circle - the ring's band, and the target pixel itself filled. */
export function bountyRingTexels(marks, originX, originY, width, height) {
  const out = [];
  for (const m of marks ?? []) {
    out.push(...gateRingTexels(m, originX, originY, width, height));
    const x = Math.floor(m.cx) - originX, y = Math.floor(m.cy) - originY;
    if (x >= 0 && y >= 0 && x < width && y < height) out.push([x, y]);
  }
  return out;
}

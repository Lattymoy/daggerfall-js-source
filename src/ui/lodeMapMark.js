// @ts-check
// MINE-PERKS (bible/06-Systems/Professions-Arc.md 43, the players' "Mining perks need buff" thread: "Motherlode sense -
// Make it mark the motherlode spots with a waypoint on the travel map or something, an extra 20 minutes of heads up
// doesn't do anything considering its damn near impossible to find these anyway"): A MOTHERLODE SENSE'S MAP MARKS - the
// day's Motherlodes, each a circle on its pixel from the day's start until it is spent or gone, its ore and, while it
// is still to rise, when it rises beside it, on both maps (and on the Overworld, scenes/travelViewMarks.js - HOST-SPLIT 1 moved it out of world.js).
//
// The host hands the maps a FUNCTION (`lodes: () => marks[]`, beside BOUNTY1's `bounties` and RVN7c's `revenants`) and
// neither map learns what a Motherlode is: a mark is the bounty's circle in map pixels - `{cx, cy, r, label}` - read by
// the bounty's own reader (ui/bounty/bountyMapMark.js readBountyMarks) and painted by its own painter (ui/ink/inkMap.js
// paintBountyRing; the classic page's bountyRingTexels).
//
// Not a DFU member. Ledger A (MINE-PERKS).
import { MOTHERLODE_MARK_CSS } from './nodeMarks.js';
import { BOUNTY_RING_R } from './bounty/bountyMapMark.js';
import { t } from '../systems/textManager.js';   // L10N4: the words through the text core (tools/l10n/ROUTE-BRIEF.md)

/** The held map's ink - a deep teal, the compass's aqua (LODE-MARK, MOTHERLODE_MARK_CSS) darkened to be read: the
 *  circle's label rides the parchment's halo in the ring's ink, and the aqua stood 1.2 : 1 on it (AUDIT MINE-PERKS; the
 *  bounty's black 14.8, the lair's red 8.4) and beside the serpent's sea-green ring. This one is 4.8 : 1. */
export const LODE_RING_CSS = '#0e6b5e';
export const LODE_FILL_CSS = 'rgba(14, 107, 94, 0.16)';
/** The classic region page's texel - the compass's own aqua, bright over its land (that page draws no words). */
export const LODE_DOT_RGB = Object.freeze([0, 229, 200]);
export const LODE_COMPASS_CSS = MOTHERLODE_MARK_CSS;
/** The legend's word and the reader's fallback label - the English identity; shown through lodeLegendText. */
export const LODE_LEGEND_TEXT = 'Motherlode';
export const lodeLegendText = () => t('prof.lode.legend', LODE_LEGEND_TEXT);
/** A Motherlode's name on a map, "Ebony Motherlode"; while it is still to rise, "Ebony Motherlode, Tue 13:00". */
export const lodeNameText = (ore) => t('prof.lode.name', '{ore} Motherlode', { ore });
export const lodeRisesText = (ore, when) => t('prof.lode.rises', '{ore} Motherlode, {when}', { ore, when });

/**
 * The marks for the day's Motherlodes - each `{ x, y, material, opensAt }` (net/motherlodeBook.js sensedAll: today's,
 * not gone, not spent, the account's find not made) - as the maps' circles: centred on its pixel, its ore's name, and
 * while it is still to rise when it rises (`clock(epochS)` the reader's own words for that moment - the host's
 * localWhenText on this machine's clock, its weekday where it is not today; none, no hour).
 * @param {ReadonlyArray<any>} lodes @param {number} nowS the shared clock's seconds
 * @param {{ oreName: (material: string) => string, clock?: ((epochS: number) => (string|null))|null }} words
 * @returns {Array<{cx:number, cy:number, r:number, label:string}>}
 */
export function lodeMapMarks(lodes, nowS, { oreName, clock = null }) {
  const out = [];
  for (const l of lodes ?? []) {
    if (!l || !Number.isSafeInteger(l.x) || !Number.isSafeInteger(l.y)) continue;
    out.push({ cx: l.x + 0.5, cy: l.y + 0.5, r: BOUNTY_RING_R, label: lodeLabel(l, nowS, { oreName, clock }) });
  }
  return out;
}
/** One Motherlode's words - its name, and its hour while it is still to rise (the maps' and the Overworld's). */
export function lodeLabel(l, nowS, { oreName, clock = null }) {
  const ore = oreName(l.material);
  const at = clock && Number.isFinite(l.opensAt) && nowS < l.opensAt ? clock(l.opensAt) : null;
  return at ? lodeRisesText(ore, at) : lodeNameText(ore);
}

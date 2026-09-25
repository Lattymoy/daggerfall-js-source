// @ts-check
// ═══════════════════════════════════════════════════════════════════
// RENOWN4 (2026-09-25) - MY OWN RENOWN, ON MY OWN HUD.
//
// Mac: "Also why is there no way to view my renown ingame?" - and "Plus
// XP bar". RENOWN1 put the level in the box beside every name, on the
// main menu, the profile and Inspect, and the account card's row said
// how far the track had come; the one face that never showed it was the
// player's own while playing. This is that readout: the box every name
// wears, then a bar to the next level, under the three vitals
// (ui/enhancedHud.js draws it; the online lane IS the enhanced lane,
// systems/onlineLane.js, so the classic HUD never needs one).
//
// WHAT IT READS. The page (scenes/world.js) hands a getter here, read
// each frame:
//   - the LEVEL the page knows (`renownNow` - the token's word at each
//     mint, the service's after each report, only ever upward);
//   - the track's TOTAL as the service last said it: the mint's answer
//     carries it beside the token (acct11), and every report's answer
//     carries it (`xp`);
//   - what was EARNED and not yet answered (the tracker's `pending`).
// Offline none of it exists, and there is no row.
//
// ═══ THE BAR IS THE SERVICE'S; THE GHOST IS MINE ═══════════════════
//
// The fill is what the service has credited - the truth, as everywhere
// in Renown. A report goes once a minute, so a bar of the credited
// total alone sat still through a fight and jumped a minute later. So
// what this page has earned and not yet been answered for is drawn AFTER
// the fill, faint: the kill shows at once, and the report turns it
// solid. It never pushes the fill, so a report the hour's bound cut
// short takes the ghost back and never the bar - and in an hour the
// bound has spent (the page was told so), the ghost is not drawn at
// all, since nothing earned then will count.
// ═══════════════════════════════════════════════════════════════════
import { RENOWN_MAX, renownForXp, renownProgress } from '../net/renown.js';

/** @typedef {{ level: number|null, xp: number|null, pending?: number }} RenownHudSource */

/** @type {(() => RenownHudSource|null)|null} */
let _source = null;

/** The page's hand: a getter answering `{ level, xp, pending }` (null offline) - null to take it away. */
export function setHudRenown(fn) { _source = typeof fn === 'function' ? fn : null; }

const grouped = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

/**
 * What the row draws, or null for no row. `level` the page's Renown, `xp` the track's total (null until the service
 * has said it), `pending` the XP earned and not yet answered (0 in an hour the bound has spent). Answers:
 *   `level`  the number in the box;
 *   `bar`    whether the bar draws - only for a total that IS that level's (a total a level behind the level is one
 *            the service has since moved on from, and a bar drawn from it would say the level's start);
 *   `frac`   the level's share credited, 0..1 (1 at the cap);
 *   `ghost`  the share earned and not yet answered, drawn after the fill - never past the level's end;
 *   `text`   "1,234 / 5,510 XP" into the level, "Highest" at the cap, '' with no bar.
 * @param {number|null} level
 * @param {number|null} xp
 * @param {number} [pending]
 */
export function renownHudView(level, xp, pending = 0) {
  if (!Number.isSafeInteger(level) || level < 1 || level > RENOWN_MAX) return null;
  if (!Number.isSafeInteger(xp) || xp < 0 || renownForXp(xp) !== level) return { level, bar: false, frac: 0, ghost: 0, text: '' };
  const p = renownProgress(xp);
  if (p.need <= 0) return { level, bar: true, frac: 1, ghost: 0, text: 'Highest' };
  const more = Number.isFinite(pending) && pending > 0 ? Math.trunc(pending) : 0;
  return { level, bar: true, frac: p.frac, ghost: Math.min(1 - p.frac, more / p.need), text: `${grouped(p.into)} / ${grouped(p.need)} XP` };
}

/** This frame's row, from the page's getter - null with none, offline, or when the getter throws (a readout that
 *  breaks costs its row, never the frame). */
export function hudRenown() {
  if (!_source) return null;
  try {
    const s = _source();
    return s ? renownHudView(s.level, s.xp, s.pending ?? 0) : null;
  } catch { return null; }
}

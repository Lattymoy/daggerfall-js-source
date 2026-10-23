// @ts-check
// STAR6 (2026-10-20): THE MASTER'S BAR - the gate's boss bar (ui/gate/gateBossBar.js) in the star's colours (its
// `star` theme): the master's name, *Master of the Fallen Star* (the Heart-Star's: *Heart of the Web*), its health, its
// circle's calls as the bar's two marks (net/starfall/starfallLaw.js STAR_CIRCLE_AT), *Warded* and how many of its circle
// stand while they do, the defenders at the star, and *Felled* - its words its own, through the text core (AUDIT STAR U3).
// Design: bible/11-Multiplayer/Starfall.md section 8.
//
// Pure: a model the bar draws. Not a DFU member. Ledger A (STARFALL).
import { STAR_CIRCLE_AT } from '../../net/starfall/starfallLaw.js';
import { STAR_CARD_TEXT } from '../../systems/starfall/starWords.js';
import { STAR_VIOLET_CSS } from './starMapMark.js';

/** A fallen master's bar stands this long, then fades over this long. */
export const STAR_BAR_FELL_HOLD_MS = 2500;
export const STAR_BAR_FELL_FADE_MS = 800;

/**
 * THE BAR'S MODEL for a master `b` - `{ name, heart, hp, max, circle, her, defenders, fellAt }` (`fellAt` relay ms, or
 * null while it stands) - at `now`; null for none.
 */
export function starBarModel(b, now) {
  if (!b) return null;
  const fell = Number.isFinite(b.fellAt);
  const frac = fell ? 0 : b.max > 0 ? Math.max(0, Math.min(1, b.hp / b.max)) : 1;
  const since = fell ? Math.max(0, now - b.fellAt) : 0;
  const alpha = fell ? Math.max(0, Math.min(1, 1 - (since - STAR_BAR_FELL_HOLD_MS) / STAR_BAR_FELL_FADE_MS)) : 1;
  const circle = fell ? 0 : Math.max(0, b.circle | 0);
  return {
    theme: 'star', ringCss: STAR_VIOLET_CSS,
    name: b.name, title: STAR_CARD_TEXT.master(!!b.heart), epithet: '', epithetColor: null, marksView: null, trials: '',
    frac, marks: [...STAR_CIRCLE_AT], spent: STAR_CIRCLE_AT.map((at) => frac < at),
    warded: circle > 0, fallen: fell, callout: null,
    wardedText: STAR_CARD_TEXT.warded(), fallenText: STAR_CARD_TEXT.felled(),   // AUDIT STAR U3: the bar's words in the player's language
    wrath: null, wrathNear: false,
    fighters: b.defenders | 0, fightersLine: STAR_CARD_TEXT.defenders(b.defenders | 0),
    host: circle > 0 ? STAR_CARD_TEXT.circle(circle, !!b.her) : null,
    reckonIn: null,
    alpha: Math.round(alpha * 20) / 20, now, low: !fell && frac > 0 && frac < 0.2,
  };
}

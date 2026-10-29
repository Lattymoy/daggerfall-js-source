// @ts-check
// STOREFRONT (2026-10-29; bible/06-Systems/Battle-Pass.md section 6): A BRASS FISSURE'S INK - the brass its mark on the held
// map is drawn in (ui/ink/inkMap.js paintFissureMark) and the aetherium's blue of its crack, apart from the gate's red,
// the star's violet and the Abyss Dungeon's gold; and the reader of the host's marks (scenes/seasonHost.js mapMarks),
// the raids' own (ui/eventMapMarks.js readRaidMarksIn) with the Heart Fissure told apart. Its own leaf.
// Not a DFU member. Ledger A (STOREFRONT).
import { readRaidMarksIn } from '../eventMapMarks.js';
import { FISSURE_TEXT } from '../../systems/pass/seasonWords.js';

/** The fissure's brass, and its crack's blue. */
export const FISSURE_BRASS_CSS = '#d9a441';
export const FISSURE_AETHER_CSS = '#6cc8ff';
/** What the legend calls it. */
export const fissureLegendText = () => FISSURE_TEXT.legend();

/** The host's fissures over a BOX of map pixels, read and checked as the raids are - each `{ key, px, py, x, y, label,
 *  tip }`, a Heart Fissure's with `heart`. [] for none or a throw. @param {(() => any) | undefined} fn
 *  @param {{x0:number, y0:number, w:number, h:number}} box */
export function readFissureMarksIn(fn, box) {
  let list = null;
  try { list = typeof fn === 'function' ? fn() : null; } catch { return []; }
  if (!Array.isArray(list)) return [];
  const hearts = new Set(list.filter((m) => m?.heart === true).map((m) => String(m.key)));
  return readRaidMarksIn(() => list, box).map((m) => (hearts.has(m.key) ? Object.freeze({ ...m, heart: true }) : m));
}

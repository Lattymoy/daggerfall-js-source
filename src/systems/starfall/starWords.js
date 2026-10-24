// @ts-check
// STAR6 (2026-10-20): EVERY WORD THE STARFALL SAYS - to the region, at the star, on its tracker, its bar and its map
// card. Design: bible/11-Multiplayer/Starfall.md section 8. WB13b's rules hold every line (World-Bosses.md section 20):
// the event, then what to do, and stop; no "X, not Y"; no dash asides; numbers as numerals; at most one exclamation.
// test/systems/starfall/star6_words.test.js reads them all.
//
// Every line goes through the text core (`t`, Port_Strings - L10N4), its names as arguments: a town and a coven's
// witches are the game's own (MAPS.BSA, FACTION.TXT), shown as the player's language has them. Not a DFU member.
// Ledger A (STARFALL).
import { t } from '../textManager.js';

/** Who held a star, as a line says it: the first few by name, and how many more. */
export function heldBy(top, c) {
  const names = (Array.isArray(top) ? top : []).filter((x) => typeof x === 'string' && x);
  const more = Math.max(0, (c | 0) - names.length);
  if (!names.length) return more ? t('starfall.by.many', '{n, plural, one {1 defender} other {# defenders}}', { n: more }) : '';
  if (more) return t('starfall.by.more', '{names} and {n, plural, one {1 other} other {# others}}', { names: names.join(', '), n: more });
  if (names.length === 1) return names[0];
  return t('starfall.by.list', '{names} and {last}', { names: names.slice(0, -1).join(', '), last: names[names.length - 1] });
}

/** THE REGION'S WORDS: said to everyone online in the coven's region, and the hold to everyone online. */
export const STAR_REGION_TEXT = Object.freeze({
  /** The omen: a new star over the region. */
  omen: (town, witches) => t('starfall.region.omen', 'A star is falling toward {town}. {witches} are at their rite.', { town, witches }),
  /** The Witches' Night's last star. */
  omenHeart: (town, witches) => t('starfall.region.omenHeart', 'The Heart-Star is falling toward {town}. {witches} are at their rite.', { town, witches }),
  /** The landing. */
  fell: (town) => t('starfall.region.fell', 'A star has fallen near {town}.', { town }),
  /** Held, with who held it. */
  held: (town, top, c) => {
    const by = heldBy(top, c);
    return by ? t('starfall.region.heldBy', 'The star near {town} is held by {by}.', { town, by }) : t('starfall.region.held', 'The star near {town} is held.', { town });
  },
});

/** The four waves' calls, the first's to the last's. */
const WAVE_CALLS = Object.freeze([
  () => t('starfall.wave.1', 'The coven comes for the star!'),
  () => t('starfall.wave.2', 'What the coven called comes out of the dark.'),
  () => t('starfall.wave.3', 'What the coven made comes for the star.'),
  () => t('starfall.wave.4', 'Mephala\'s own join the fight.'),
]);

/** THE WORDS AT THE STAR: said to the players standing at it as its ledger moves. */
export const STAR_AT_TEXT = Object.freeze({
  /** A wave's call, `w` 1..4. */
  wave: (w) => (WAVE_CALLS[Math.max(1, Math.min(WAVE_CALLS.length, w | 0)) - 1])(),
  breath: () => t('starfall.at.breath', 'The star\'s light steadies.'),
  low: () => t('starfall.at.low', 'The star is going dark!'),
  /** The master's call and its circle's are its own lines (systems/starfall/starCoven.js STAR_MASTERS `call`, `circle`). */
  circleBroken: (her) => t('starfall.at.circleBroken', '{her, select, yes {Her} other {Its}} circle is broken.', { her: her ? 'yes' : 'no' }),
  held: () => t('starfall.at.held', 'The star is held. Its thread burns away.'),
  heldHeart: () => t('starfall.at.heldHeart', 'The Heart-Star is held. Its thread burns away.'),
  lost: () => t('starfall.at.lost', 'The coven has taken the star.'),
  dawn: () => t('starfall.at.dawn', 'Dawn. The coven pulls the last light home.'),
});

/** THE TRACKER, THE BAR AND THE MAP CARD: a star's name, where, and how it stands. */
export const STAR_CARD_TEXT = Object.freeze({
  name: (heart) => (heart ? t('starfall.card.heart', 'Heart-Star') : t('starfall.card.name', 'Fallen Star')),
  near: (town) => t('starfall.card.near', 'Near {town}', { town }),
  wave: (w, n) => t('starfall.card.wave', 'Wave {w} of {n}', { w, n }),
  waits: () => t('starfall.card.waits', 'The coven waits'),
  gathers: () => t('starfall.card.gathers', 'The coven gathers'),
  breath: () => t('starfall.card.breath', 'The coven draws breath'),
  held: () => t('starfall.card.held', 'Held'),
  heldBy: (top, c) => { const by = heldBy(top, c); return by ? t('starfall.card.heldBy', 'Held by {by}', { by }) : t('starfall.card.held', 'Held'); },
  lost: () => t('starfall.card.lost', 'Lost'),
  light: () => t('starfall.card.light', 'Light'),
  left: (time) => t('starfall.card.left', '{time} left', { time }),
  falls: (time) => t('starfall.card.falls', 'Falls at {time}', { time }),
  falling: () => t('starfall.card.falling', 'Falling'),
  /** The master's bar: its title under its name. */
  master: (heart) => (heart ? t('starfall.bar.heart', 'Heart of the Web') : t('starfall.bar.master', 'Master of the Fallen Star')),
  /** While the ward holds: how many of the circle stand. */
  circle: (n, her) => t('starfall.bar.circle', '{n} of {her, select, yes {her} other {its}} circle {n, plural, one {stands} other {stand}}', { n, her: her ? 'yes' : 'no' }),
  /** The bar's word while the circle wards it, and at its fall (AUDIT STAR U3: the gate's own words were English alone) -
   *  the ward the gate's half's own key. */
  warded: () => t('gate.bar.halfWarded', 'Warded'),
  felled: () => t('starfall.bar.felled', 'Felled'),
  /** The defenders at the star, on the master's bar. */
  defenders: (n) => t('starfall.bar.defenders', '{n, plural, one {1 defender} other {# defenders}}', { n }),
  /** The map's legend. */
  legend: () => t('starfall.card.legend', 'Fallen star'),
  /** The Timers window: a star's deadline, the next fall and the night's coven. */
  takes: () => t('starfall.timer.takes', 'The coven takes it when this runs out'),
  comes: (heart) => (heart ? t('starfall.timer.heart', 'The Heart-Star falls') : t('starfall.timer.falls', 'A star falls')),
  rite: (witches) => t('starfall.timer.rite', '{witches} are at their rite', { witches }),
});

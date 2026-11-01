// @ts-check
// GLOW-SET (2026-10-30; bible/05-Combat/Weapon-Glow.md law
// 9): THE STAFF'S /glow. It writes a glow word on the weapon or Hand Wraps in my hands (systems/weaponGlow.js
// GLOW_SET_FIELD), which every hand and my look to peers then wear. Only the wire's thirteen words, so no relay change.
import { EQUIP_SLOTS, equipTableOf } from './equip.js';
import { GLOW_SET_FIELD } from './weaponGlow.js';

/** The colours /glow takes, by the look each one is. `crimson` is the Gilded rung's. */
export const GLOW_SET_COLOURS = Object.freeze({
  fire: 'fire',
  frost: 'frost',
  shock: 'shock',
  arcane: 'arcane',
  crimson: 'gilded',
  brand: 'brand',
  edge: 'edge',
});
/** The looks with three strengths; the rest have one, 2. */
const BANDED = ['fire', 'frost', 'shock'];

/** The `/staff` line. */
export const GLOW_HELP_LINE =
  '/glow <fire|frost|shock|arcane|crimson|brand|edge> [1-3] | off - set the glow of the weapon or wraps in your hands';
const USAGE = 'Usage: /glow <fire|frost|shock|arcane|crimson|brand|edge> [1-3], or /glow off.';

/**
 * What a /glow line IS: `{ cmd: 'glow', word }` (`word` null for off), `{ error }`, or null for another line. A banded
 * colour is 3 unless a strength is given.
 * @param {string} text
 */
export function parseGlowCommand(text) {
  const m = /^\/glow(?:\s+([\s\S]*))?$/i.exec(String(text ?? '').trim());
  if (!m) return null;
  const words = (m[1] ?? '').toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 1 && (words[0] === 'off' || words[0] === 'none')) return { cmd: 'glow', word: null };
  const look =
    words.length >= 1 && words.length <= 2 && Object.hasOwn(GLOW_SET_COLOURS, words[0])
      ? GLOW_SET_COLOURS[/** @type {keyof typeof GLOW_SET_COLOURS} */ (words[0])]
      : null;
  if (!look) return { error: USAGE };
  const banded = BANDED.includes(look);
  if (words[1] !== undefined && !banded) return { error: `${words[0]} has one strength.` };
  const level = words[1] === undefined ? (banded ? 3 : 2) : Number(words[1]);
  if (![1, 2, 3].includes(level)) return { error: USAGE };
  return { cmd: 'glow', word: `${look}${level}` };
}

/** The weapons and wraps in an entity's hands: the right hand's, then the left's. */
export function heldGlowItems(/** @type {any} */ entity) {
  const table = equipTableOf(entity);
  if (!Array.isArray(table)) return [];
  return [table[EQUIP_SLOTS.RightHand], table[EQUIP_SLOTS.LeftHand]].filter((it) => it && it.group === 'Weapons');
}

/**
 * Runs a parsed /glow on `entity`'s hands: the word written on (or taken off) each weapon there. The answer is the line
 * to show. `changed` is asked once when a piece changed, so the save goes.
 * @param {any} entity @param {{ word: string | null }} c @param {() => void} [changed]
 */
export function runGlowCommand(entity, c, changed = () => {}) {
  const items = heldGlowItems(entity);
  if (!items.length) return 'Hold a weapon or wear Hand Wraps first.';
  for (const it of items) {
    if (c.word) it[GLOW_SET_FIELD] = c.word;
    else delete it[GLOW_SET_FIELD];
  }
  changed();
  const names = items.map((it) => it.shortName ?? it.name ?? 'weapon').join(' and ');
  return c.word ? `${names}: glow set.` : `${names}: set glow removed.`;
}

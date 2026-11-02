// @ts-check
// MASTER-ART (2026-10-27, bible/06-Systems/Professions-Arc.md section 57): A MASTER'S WORK. A Master in a craft makes a
// Legendary piece of its kinds: the crafter chooses its three lines, the service rolls their values in the Legendary
// band (never past its top - POWER-CEILING), for catalysts from three pursuits besides the recipe's goods, one a
// character a UTC day. No Legendary power, no enchantment: the build you want, not a higher number (a player: "Add more
// horizontal progression please!"). Pure: the service decides by it (server-account/src/masterWork.js); the mint, the
// item law, the judge and the stations read it. Not a DFU member - Port-Ledger A, MASTER-ART.
import { PROF_RANK_MAX, HEARTWOOD, PEARL, ARCANE_ESSENCE, trackOf } from './professionLaw.js';
import { rollsQuality } from './recipeLaw.js';
import { utcDay } from './marksLaw.js';
import { AFFIX_IDS, AFFIX_KINDS, AFFIX_RANGES, kindParams } from '../systems/loot/lootRarity.js';
import { wearableItem } from '../systems/equip.js';
import { seededRng } from '../systems/wind/wind.js';

/** The rank a Master's work asks of the recipe's craft: Master. */
export const MASTER_RANK = PROF_RANK_MAX;
/** The lines a Master's work carries: a Legendary's - 34 of the 39 records carry three (lootRarity.js allLegendaries). */
export const MASTER_LINES = 3;
/** Lines that do something (LOOT4's procs) a Master's work may carry: one, as a loot door's last pass gives at most. */
export const MASTER_PROCS_MAX = 1;
/** The recipes' kinds whose piece wears a tier (smithItems.js mintPiece): the smith's weapons and armour, the workbench's
 *  staves and bows, the loom's leather and garments, the jeweller's pieces. */
export const MASTER_KINDS = Object.freeze([
  'weapon',
  'staff',
  'bow',
  'plate',
  'shield',
  'chain',
  'leather',
  'garment',
  'jewel',
]);

/**
 * THE CATALYSTS, ONE TABLE: what a Master's work spends besides its recipe's goods, each from a pursuit of its own - the
 * rarest find of the gathering (Logging's Heartwood, 2% a Clean Cut), the sea's own find (a Pearl, a net hauled at sea
 * on witnessed ground) and Enchanting's Essence. A later material is one row; its name is the material registry's.
 * Spent from what the service counted (own or bought, never loose - bagLaw.js WRIT_ORIGINS).
 */
export const MASTER_CATALYSTS = Object.freeze([
  Object.freeze({ key: HEARTWOOD.key, n: 2, pursuit: 'gathering' }),
  Object.freeze({ key: PEARL.key, n: 3, pursuit: 'sea' }),
  Object.freeze({ key: ARCANE_ESSENCE.key, n: 10, pursuit: 'enchanting' }),
]);

/** The UTC day a Master's work is counted on - one a character a day. @param {number} nowS */
export const masterDayOf = (nowS) => utcDay(nowS);

/** The group a recipe's piece is minted in. @param {any} r */
export const masterGroupOf = (r) =>
  r?.kind === 'weapon' || r?.kind === 'staff' || r?.kind === 'bow'
    ? 'Weapons'
    : r?.kind === 'jewel'
      ? 'Jewellery'
      : r?.kind === 'garment'
        ? r.group
        : 'Armor';
/** The piece as the law reads it: its group and template. @param {any} r */
const shapeOf = (r) => ({ group: masterGroupOf(r), templateIndex: r.templateIndex });

/** Whether a recipe takes a Master's work: a kind that wears a tier, of a template a slot takes (never the Wand). @param {any} r */
export const masterRecipe = (r) => !!r && MASTER_KINDS.includes(r.kind) && rollsQuality(r) && wearableItem(shapeOf(r));
/** The craft track a recipe's Master's work asks Master of (CRAFT3: a Ring's Smithing). @param {any} r */
export const masterTrackOf = (r) => trackOf(r?.profession);

/** @typedef {{ id: string, param?: any, key: string, proc: boolean }} MasterOption */
const _options = new Map();
/**
 * THE LINES A MASTER MAY CHOOSE for a recipe's piece, in the ladder's order: every number its group carries, then every
 * line that does something - each param the kind names on this piece (lootRarity.js kindParams: a garment's attribute
 * Personality alone). Never a technique (its own door's pass). `key` is the wire's form: the kind, or kind:param.
 * @param {any} r @returns {readonly MasterOption[]}
 */
export function masterOptions(r) {
  if (!masterRecipe(r)) return [];
  const item = shapeOf(r);
  const k = `${item.group}:${item.templateIndex}`;
  if (_options.has(k)) return _options.get(k);
  /** @type {MasterOption[]} */
  const out = [];
  const kinds = AFFIX_IDS.filter((id) => AFFIX_KINDS[id].groups.includes(item.group));
  for (const proc of [false, true]) {
    for (const id of kinds.filter((x) => !!AFFIX_KINDS[x].proc === proc)) {
      const params = kindParams(id, item);
      if (!params) out.push(Object.freeze({ id, key: id, proc }));
      else for (const p of params) out.push(Object.freeze({ id, param: p, key: `${id}:${p}`, proc }));
    }
  }
  const frozen = Object.freeze(out);
  _options.set(k, frozen);
  return frozen;
}
/** A chosen line's wire key read back, or null for one the piece may not carry. @param {any} r @param {unknown} key */
export const masterLineOf = (r, key) =>
  typeof key === 'string' ? (masterOptions(r).find((o) => o.key === key) ?? null) : null;

/**
 * WHY A CHOICE IS REFUSED, or null: 'recipe' (no Master's work makes its piece), 'count' (not MASTER_LINES lines),
 * 'line' (a line the piece may not carry), 'twice' (a line chosen twice), 'procs' (more than one that does something).
 * @param {any} r @param {unknown} keys
 */
export function masterChoiceRefusal(r, keys) {
  if (!masterRecipe(r)) return 'recipe';
  if (!Array.isArray(keys) || keys.length !== MASTER_LINES) return 'count';
  const lines = keys.map((k) => masterLineOf(r, k));
  if (lines.some((l) => !l)) return 'line';
  if (new Set(keys).size !== keys.length) return 'twice';
  if (lines.filter((l) => l?.proc).length > MASTER_PROCS_MAX) return 'procs';
  return null;
}

/** A line's Legendary band, [lo, hi] - the top no Master's line passes. @param {string} id */
export const masterBand = (id) => AFFIX_RANGES[id]?.legendary ?? null;

/**
 * THE ROLL: each chosen line's value in the Legendary band, off the service's seed, in the order chosen - lo to hi, the
 * ladder's own draw (lootRarity.js rangeInt), so no value passes the band's top. Null for a choice the law refuses.
 * The service's alone, once: the record signs what it rolled (masterRecordLines - AUDIT HORIZONTAL B1).
 * @param {any} r @param {unknown} keys @param {number} seed
 * @returns {{ id: string, param?: any, value: number }[] | null}
 */
export function rollMasterLines(r, keys, seed) {
  if (masterChoiceRefusal(r, keys) || !Number.isSafeInteger(seed)) return null;
  const rolls = seededRng(seed >>> 0);
  return /** @type {string[]} */ (keys).map((k) => {
    const o = /** @type {MasterOption} */ (masterLineOf(r, k));
    const [lo, hi] = /** @type {number[]} */ (masterBand(o.id));
    const value = lo + Math.floor(rolls() * (hi + 1 - lo));
    return o.param === undefined ? { id: o.id, value } : { id: o.id, param: o.param, value };
  });
}

/** AUDIT HORIZONTAL B1: a line's wire key, as the station chose it - `kind` or `kind:param`. @param {{ id: string, param?: any }} a */
export const masterKeyOf = (a) => (a.param === undefined ? a.id : `${a.id}:${a.param}`);
/** AUDIT HORIZONTAL B1: THE LINES AS THE RECORD SIGNS THEM (`l`) - the service's roll, each `[kind, value]` or `[kind,
 *  value, param]`. Every reader takes the values from here, never a roll of today's tables: a band moved, or a line gone
 *  from a group's pool, leaves a made piece the piece its record names. @param {{ id: string, param?: any, value: number }[]} lines */
export const masterRecordLines = (lines) =>
  lines.map((a) => (a.param === undefined ? [a.id, a.value] : [a.id, a.value, a.param]));
const LINE_WORD_RE = /^[a-z][A-Za-z]{0,23}$/;
/** Whether a record's `l` is a Master's lines in shape: MASTER_LINES of them, each a kind's word, a whole value and a param
 *  (a word or a whole number) or none, no line twice. The shape alone - the law of the day it was made was the service's. @param {unknown} l */
export function masterRecordLinesValid(l) {
  if (!Array.isArray(l) || l.length !== MASTER_LINES) return false;
  const seen = new Set();
  for (const x of l) {
    if (
      !Array.isArray(x) ||
      x.length < 2 ||
      x.length > 3 ||
      typeof x[0] !== 'string' ||
      !LINE_WORD_RE.test(x[0]) ||
      !Number.isSafeInteger(x[1])
    )
      return false;
    if (
      x.length === 3 &&
      !(typeof x[2] === 'string' ? LINE_WORD_RE.test(x[2]) : Number.isSafeInteger(x[2]) && x[2] >= 0)
    )
      return false;
    seen.add(x.length === 3 ? `${x[0]}:${x[2]}` : x[0]);
  }
  return seen.size === l.length;
}
/** A record's `l` as the piece carries its lines (`{ id, param?, value }`, lootRarity's affix), or null for one of no shape.
 *  @param {unknown} l @returns {{ id: string, param?: any, value: number }[] | null} */
export function masterLinesOfRecord(l) {
  if (!masterRecordLinesValid(l)) return null;
  return /** @type {any[][]} */ (l).map(([id, value, ...p]) => (p.length ? { id, param: p[0], value } : { id, value }));
}

/** Whether a piece is a Master's work: a Legendary of no record, made (its provenance the service's). @param {any} item */
export const isMasterWork = (item) =>
  item?.rarity === 'legendary' && !item.legendary && typeof item.provenance === 'string';
/** A Master's work's lines as one string - the judge holds a piece's to its record's. @param {any[]} lines */
export const masterSignature = (lines) =>
  Array.isArray(lines) ? lines.map((a) => `${a?.id}:${a?.param ?? ''}:${a?.value}`).join('|') : '';

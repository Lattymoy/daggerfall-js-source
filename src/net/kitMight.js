// @ts-check
// EG-MIGHT (2026-10-31, bible/11-Multiplayer/Elite-Gates.md section 21.1): A KIT'S MIGHT AS THE JUDGE READS IT, off a
// realm character's judged save - each part a blow registry's room (systems/powerCeiling.js BLOW_TOPS) its lawful pack can
// reach, read at the most it can be: an upper bound of an honest blow over the gate's reference, never an estimate of
// one. Its signed form and bounds are net/mightLaw.js. The account Worker's alone (server-account/src/judge.js): it
// imports only what the item law already bundles there.
import { BLOW_TOPS } from '../systems/powerCeiling.js';
import { validAffix, readLines } from '../systems/loot/lootRarity.js';
import { sigilHasBlow } from '../systems/sigil/sigil.js';
import { setIdOf } from '../systems/sigil/sigilSets.js';
import { isMasterWork } from './masterLaw.js';
import { SKILLS } from '../systems/skills.js';
import { effectiveSkill, SKILL_SOFT_CAP } from '../systems/skillSoftcap.js';
import { mightOf } from './mightLaw.js';

/** The strongest blow power one piece carries today (Silent Death's and the Hour Tolls' 100%): the loot part's per piece.
 *  POWER-CEILING keeps every new power at or under it; test/net/eliteGates/egmight.test.js holds it to the records. */
export const KIT_POWER_PCT = 100;
/** A set's pieces at its whole (2, 4 and 6 its stages - bible/11-Multiplayer/Sigil-Sets.md). */
export const KIT_SET_PIECES = 6;
/** WEAPON-GEAR's and MARTIAL2's numbers (systems/weaponMastery.js, pinned equal - that file is the client's): a gear point
 *  on a weapon skill 0.44%, to 320%; a point of the climb past 100 1%, an axe's or a hammer's 2%. */
export const KIT_GEAR_PER_POINT = 0.44;
export const KIT_GEAR_PCT_MOST = 320;
export const KIT_CLIMB_PCT = 1;
export const KIT_CLIMB_HALF_PCT = 2;

const WEAPON_SKILLS = Object.freeze([SKILLS.ShortBlade, SKILLS.LongBlade, SKILLS.Axe, SKILLS.BluntWeapon, SKILLS.Archery]);
const HALF_SKILLS = new Set(/** @type {number[]} */ ([SKILLS.Axe, SKILLS.BluntWeapon]));

/** A piece's lines of kind `id`, as the card reads them (a gem's share held - lootRarity.js readLines). */
const linesOf = (/** @type {any} */ it, /** @type {string} */ id) => readLines(it).filter((a) => validAffix(a) && a.id === id);
const sumOf = (/** @type {any[]} */ lines) => lines.reduce((s, a) => s + a.value, 0);
/** A piece's own blow power, by what it is: a Legendary's record (each once), a Gilded's, a Master's work's; else null. */
const powerKey = (/** @type {any} */ it) => (it?.rarity === 'legendary' && typeof it.legendary === 'string' ? `l:${it.legendary}`
  : it?.rarity === 'gilded' ? `g:${it.gilded ?? it.templateIndex}` : isMasterWork(it) ? `m:${it.provenance}` : null);

/**
 * THE PARTS of a kit's might, each a per cent onto a blow, off `items` (the save's pack - INT7's DECIDED: every piece it can
 * take up without a trip elsewhere, worn or carried) and `skills` (its values), each piece taken only where `lawful` (the
 * item law's word): `roll` the best weapon's own damage lines; `loot` its slayer lines and its pieces' own powers; `sets`
 * the most pieces of one set; `sigil` a weapon's sigil that carries a blow; `mastery` a weapon skill's climb past 100 and its gear lines;
 * `martial` a martial path held. Each at most its registry's top.
 * @param {unknown} items @param {unknown} skills @param {(it: any) => boolean} lawful @param {{ martial?: boolean }} [o]
 */
export function kitMightParts(items, skills, lawful, { martial = false } = {}) {
  const pack = (Array.isArray(items) ? items : []).filter((it) => it && typeof it === 'object' && lawful(it));
  const weapons = pack.filter((it) => it.group === 'Weapons');
  const powers = new Set(pack.map(powerKey).filter(Boolean));
  const sets = new Map();
  for (const it of pack) { const id = setIdOf(it); if (id) sets.set(id, (sets.get(id) ?? 0) + 1); }
  const most = Math.min(KIT_SET_PIECES, Math.max(0, ...sets.values()));
  const sk = Array.isArray(skills) ? skills : [];
  let mastery = 0;
  for (const s of WEAPON_SKILLS) {
    const v = Number(sk[s]);
    const climb = Number.isFinite(v) ? Math.max(0, effectiveSkill(v) - SKILL_SOFT_CAP) : 0;
    const gear = sumOf(pack.flatMap((it) => linesOf(it, 'skill').filter((a) => a.param === s)));
    mastery = Math.max(mastery, climb * (HALF_SKILLS.has(s) ? KIT_CLIMB_HALF_PCT : KIT_CLIMB_PCT) + Math.min(KIT_GEAR_PCT_MOST, gear * KIT_GEAR_PER_POINT));
  }
  return {
    roll: Math.max(0, ...weapons.map((it) => sumOf(linesOf(it, 'damage')))),
    loot: Math.min(BLOW_TOPS.loot, sumOf(pack.flatMap((it) => linesOf(it, 'slayer'))) + KIT_POWER_PCT * powers.size),
    sets: most >= 2 ? (BLOW_TOPS.sets * most) / KIT_SET_PIECES : 0,
    sigil: weapons.some((it) => sigilHasBlow(it.sigil)) ? BLOW_TOPS.sigil : 0,
    mastery: Math.min(BLOW_TOPS.mastery, mastery),
    martial: martial ? BLOW_TOPS.martial : 0,
  };
}

/** A KIT'S MIGHT off a judged save (`items`, `skills`, `martialPath`), its parts composed (net/mightLaw.js mightOf). Pure. */
export function kitMightOf(/** @type {any} */ save, /** @type {(it: any) => boolean} */ lawful) {
  const p = kitMightParts(save?.items, save?.skills, lawful, { martial: typeof save?.martialPath === 'string' && save.martialPath !== '' });
  return mightOf([p.roll, p.loot, p.sets, p.sigil, p.mastery, p.martial]);
}

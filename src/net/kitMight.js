// @ts-check
// EG-MIGHT (2026-10-31, bible/11-Multiplayer/Elite-Gates.md section 21.1): A KIT'S MIGHT AS THE JUDGE READS IT, off a
// realm character's judged save and its sky - how much harder its lawful kit can make one blow or one spell than the
// gate's reference, read at the most it can be. AUDIT POTION-MIGHT A1-A5: what can be WORN AT ONCE (one piece a place,
// one weapon in hand), each power by what it adds to a blow, never the pack summed. Its signed form and bounds are
// net/mightLaw.js. The account Worker's alone (server-account/src/judge.js); it imports only what the Worker bundles.
import { BLOW_TOPS } from '../systems/powerCeiling.js';
import {
  POWER_BLOW, SET_TIER_BLOW, WEAPON_POTENCY_PER_POINT, WEAPON_HALF_PER_POINT, WEAPON_GEAR_PER_POINT, WEAPON_GEAR_PCT_MOST,
  POTENCY_CAP, SPELL_POWER_MOST,
} from '../systems/powerBlows.js';
import { validAffix, readLines, powerOf, powerIdsOf } from '../systems/loot/lootRarity.js';
import { sigilPercent, sigilRank } from '../systems/sigil/sigil.js';
import { setIdOf, setPieceKind, setById, tierValues, SET_BODY_SLOTS } from '../systems/sigil/sigilSets.js';
import { getEquipSlot, equipTableOf, getItemHands, ITEM_HANDS } from '../systems/equip.js';
import { EQUIP_SLOTS } from '../characters/paperdoll/paperdoll.js';
import { isHandWraps } from '../characters/handWrapsIds.js';
import { ENCHANTMENT_TYPES, ENHANCE_SKILL_MOD } from '../systems/enchantments.js';
import { isHeirloom, HEIRLOOM_DAMAGE_PER_GEN, HEIRLOOM_GEN_MAX, BLESSING_POINTS, BLESSING_SKILL_MAX } from '../systems/legacy/heirloom.js';
import { ledgerKeyOf } from '../systems/item/itemIds.js';
import { SKILLS, MAGIC_SKILLS, SKILL_KEYS } from '../systems/skills.js';
import { effectiveSkill, SKILL_SOFT_CAP } from '../systems/skillSoftcap.js';
import { SCHOOL_POTENCY_PER_POINT, SPELL_POWER_FLOOR } from '../systems/spell/spellPower.js';
import { MARTIAL_BY_ID } from '../systems/martialPaths.js';
import { PATH_BY_ID, PATH_SPELL_MOST } from '../systems/arcanePaths.js';
import { blowPct, statDef, pctOf } from './firmament/firmamentLaw.js';
import { mightOf } from './mightLaw.js';

/** The places a set fills at once (sigilSets.js SET_PLACES: seven body pieces, the left hand, the right). */
export const KIT_SET_PLACES = SET_BODY_SLOTS.length + 2;
/** A Renown past every stage: a piece's own rank alone - the judge knows no Renown, and reads the most. */
const ANY_RENOWN = Number.MAX_SAFE_INTEGER;
const WEAPON_SKILLS = Object.freeze([SKILLS.ShortBlade, SKILLS.LongBlade, SKILLS.Axe, SKILLS.BluntWeapon, SKILLS.Archery]);
/** MARTIAL2's climb by skill (weaponMastery.js climbPastPct): a sword's and a bow's a point, an axe's and a hammer's twice
 *  that on their half, a short blade's its pace and none of its blow. */
const CLIMB_PER_POINT = Object.freeze({ [SKILLS.LongBlade]: WEAPON_POTENCY_PER_POINT, [SKILLS.Archery]: WEAPON_POTENCY_PER_POINT,
  [SKILLS.Axe]: WEAPON_HALF_PER_POINT, [SKILLS.BluntWeapon]: WEAPON_HALF_PER_POINT });
/** A set tier that adds a weapon skill (sigilSets.js), by its value's name. */
const TIER_SKILL = Object.freeze({ 'keen-eyed': ['archery', SKILLS.Archery], 'thick-skinned': ['blunt', SKILLS.BluntWeapon] });
const FOE_GROUPS = Object.freeze(['undead', 'daedra', 'animal', 'humanoid', null]);

const sumOf = (/** @type {number[]} */ xs) => xs.reduce((s, x) => s + x, 0);
/** A piece's valid lines of kind `id`, as the card reads them (a gem's share held - lootRarity.js readLines). */
const linesOf = (/** @type {any} */ it, /** @type {string} */ id) => readLines(it).filter((a) => validAffix(a) && a.id === id);
const isWeapon = (/** @type {any} */ it) => it?.group === 'Weapons' || isHandWraps(it);
/** The power ids a piece carries, each a record's. */
const idsOf = (/** @type {any} */ it) => powerIdsOf(it).filter((id) => typeof id === 'string' && powerOf(id));
/** What a power adds to one blow at `moment` ('fresh' or 'struck'), per cent - 0 for a power that adds none. */
const blowOf = (/** @type {string} */ id, /** @type {string} */ moment) => {
  const p = powerOf(id), b = p ? /** @type {any} */ (POWER_BLOW)[p.kind] : null;
  return b && (b.moment === 'any' || b.moment === moment) ? b.pct(p) : 0;
};

/** The places a piece is worn in - none, one, or a pair's two (rings, bracers) - as the equip table chooses them. */
function placesOf(/** @type {any} */ it) {
  const e = {};
  const a = getEquipSlot(e, it);
  if (!Number.isInteger(a) || a === EQUIP_SLOTS.None) return [];
  equipTableOf(e)[a] = it;
  const b = getEquipSlot(e, it);
  return Number.isInteger(b) && b !== EQUIP_SLOTS.None && b !== a ? [a, b] : [a];
}
/** THE MOST `valueOf` SUMS TO OVER PIECES WORN AT ONCE: in each place's class (a pair's two), its best pieces - a Legendary
 *  once (lootRarity.js countedPieces). Each class apart, so a bound, never under what one kit wears. */
function wornBest(/** @type {any[]} */ pieces, /** @type {(it: any) => number} */ valueOf) {
  /** @type {Map<string, { cap: number, v: [number, any][] }>} */
  const byClass = new Map();
  for (const it of pieces) {
    const places = placesOf(it), v = valueOf(it);
    if (!places.length || !(v > 0)) continue;
    const k = places.join(',');
    if (!byClass.has(k)) byClass.set(k, { cap: places.length, v: [] });
    /** @type {any} */ (byClass.get(k)).v.push([v, it]);
  }
  let total = 0;
  for (const { cap, v } of byClass.values()) {
    const seen = new Set();
    let n = 0;
    for (const [x, it] of v.sort((a, b) => b[0] - a[0])) {
      const id = it?.rarity === 'legendary' ? it.legendary : null;
      if (n >= cap || (id && seen.has(id))) continue;
      if (id) seen.add(id);
      total += x; n++;
    }
  }
  return total;
}

/** THE PACK THE JUDGE READS: its lawful pieces, a ledger key's copies once (AUDIT POTION-MIGHT A1). */
function packOf(/** @type {unknown} */ items, /** @type {(it: any) => boolean} */ lawful) {
  const seen = new Set();
  return (Array.isArray(items) ? items : []).filter((it) => {
    if (!it || typeof it !== 'object' || !lawful(it)) return false;
    const k = ledgerKeyOf(it);
    if (k == null) return true;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** The worn pieces' powers onto one blow at `moment`, `but` the held weapon's ids - each power once, each place's best. */
function wornPowers(/** @type {any[]} */ worn, /** @type {string} */ moment, /** @type {Set<string>} */ but) {
  const own = (/** @type {any} */ it) => sumOf(idsOf(it).filter((id) => !but.has(id)).map((id) => blowOf(id, moment)));
  const byId = new Map();
  for (const it of worn) for (const id of idsOf(it)) if (!but.has(id)) byId.set(id, blowOf(id, moment));
  return Math.min(wornBest(worn, own), sumOf([...byId.values()]));
}

/** THE SETS' MOST onto one blow: each set at the places its pieces fill, the most of its tiers at the stage of the pieces
 *  that fill them, the sets together in the nine places (AUDIT POTION-MIGHT A5: every set worn, not the largest alone). */
function setsPart(/** @type {any[]} */ pack) {
  /** @type {Map<string, Map<string, number>>} */
  const ranks = new Map();
  for (const it of pack) {
    const id = setIdOf(it), kind = setPieceKind(it);
    if (!id || !kind) continue;
    const place = kind === 'armor' ? String(placesOf(it).find((s) => SET_BODY_SLOTS.includes(s)) ?? '') : kind;
    if (!place) continue;
    if (!ranks.has(id)) ranks.set(id, new Map());
    const m = /** @type {Map<string, number>} */ (ranks.get(id));
    m.set(place, Math.max(m.get(place) ?? 0, sigilRank(it.sigil)));
  }
  const options = [...ranks].map(([id, m]) => {
    const set = setById(id), r = [...m.values()].sort((a, b) => b - a);
    /** @type {[number, number, number][]} */
    const out = [[0, 0, 0]];
    for (const n of [2, 4, 6]) {
      if (!set || r.length < n) continue;
      const stage = r[n - 1], tiers = set.tiers.filter((/** @type {any} */ t) => n >= t.at);
      const blow = sumOf(tiers.map((/** @type {any} */ t) => /** @type {any} */ (SET_TIER_BLOW)[t.key]?.(tierValues(t, stage)) ?? 0));
      out.push([n, blow, stage]);
    }
    return { id, set, out };
  });
  let best = new Array(KIT_SET_PLACES + 1).fill(0);
  for (const { out } of options) {
    const next = [...best];
    for (let c = 0; c <= KIT_SET_PLACES; c++) for (const [n, blow] of out) if (n <= c) next[c] = Math.max(next[c], best[c - n] + blow);
    best = next;
  }
  /** @type {Record<number, number>} a set tier's weapon skill, at its best stage */
  const skills = {};
  for (const { set, out } of options) {
    for (const t of set?.tiers ?? []) {
      const ts = /** @type {any} */ (TIER_SKILL)[t.key];
      const at = out.filter(([n]) => n >= t.at).map(([, , st]) => st);
      if (ts && at.length) skills[ts[1]] = (skills[ts[1]] ?? 0) + (tierValues(t, Math.max(...at))?.[ts[0]] ?? 0);
    }
  }
  return { blow: Math.min(BLOW_TOPS.sets, best[KIT_SET_PLACES]), skills };
}

/** A piece's points on weapon skill `s`: its skill lines and its Enhances Skill enchantments (enchantments.js's +15 each). */
const skillPoints = (/** @type {any} */ it, /** @type {number} */ s) => sumOf(linesOf(it, 'skill').filter((a) => a.param === s).map((a) => a.value))
  + ENHANCE_SKILL_MOD * (Array.isArray(it?.enchantments) ? it.enchantments.filter((e) => e?.type === ENCHANTMENT_TYPES.EnhancesSkill && e.param === s).length : 0);
/** The sky's capped points on skill `s` (firmamentPowers.js firmamentFold), off the save's own value. */
function firmSkill(/** @type {Record<string, number>} */ firm, /** @type {number} */ s, /** @type {any[]} */ sk) {
  const n = SKILL_KEYS[s];
  if (!n) return 0;
  const raw = (firm[`skill.${n}`] ?? 0) + pctOf(Number(sk[s]) || 0, firm[`skillPct.${n}`] ?? 0);
  const d = statDef(`skill.${n}`);
  return Math.max(0, d ? Math.min(d.max, raw) : raw);
}
/** The climb past 100 a mastered skill pays (0 to 40 points) - none for a skill the save never mastered (masterSkills.js
 *  masterCappedSkill holds it at 100). */
const climbOf = (/** @type {any[]} */ sk, /** @type {number[]} */ mastered, /** @type {number} */ s) => {
  const v = Number(sk[s]);
  return mastered.includes(s) && Number.isFinite(v) ? Math.max(0, effectiveSkill(v) - SKILL_SOFT_CAP) : 0;
};

/**
 * THE PARTS of a kit's might, per cents onto a blow, off the save (its items where `lawful`, skills, masteries, paths and
 * blessings) and the sky's capped stats (`firm`, firmamentLaw.js treeStats; none where it is shut): the held weapon's
 * `roll`, `heirloom`, `loot` (with every worn power) and `sigil`; the kit's `sets`, `mastery`, `martial`, `firmament`.
 * `spell` a damage spell's whole multiplier. Each at most its registry's top.
 * @param {any} save @param {(it: any) => boolean} lawful @param {{ firm?: Record<string, number> }} [o]
 */
export function kitMightParts(save, lawful, { firm = {} } = {}) {
  const pack = packOf(save?.items, lawful);
  const worn = pack.filter((it) => !isWeapon(it));
  const sk = Array.isArray(save?.skills) ? save.skills : [];
  const mastered = (Array.isArray(save?.masteredSkills) ? save.masteredSkills : []).filter((s) => Number.isInteger(s));
  const sets = setsPart(pack);
  // THE HELD WEAPON: the one of the pack (or the bare hand) its own parts grow most
  let held = { roll: 0, heirloom: 0, loot: 0, sigil: 0 }, heldX = 0;
  for (const w of [null, ...pack.filter(isWeapon)]) {
    const own = new Set(w ? idsOf(w) : []);
    const groups = new Map();
    for (const a of w ? linesOf(w, 'slayer') : []) groups.set(a.param, (groups.get(a.param) ?? 0) + a.value);
    const slayer = Math.max(0, ...groups.values());
    const mark = w && getItemHands(w) !== ITEM_HANDS.Both
      ? Math.max(0, ...pack.filter((x) => isWeapon(x) && x !== w).flatMap((x) => idsOf(x).map((id) => (powerOf(id)?.kind === 'broadside' ? blowOf(id, 'struck') : 0)))) : 0;
    // a held piece's own Broadside is the OTHER hand's mark (lootPowers.js lootBlow: never its own shot's)
    const ownBlow = (/** @type {string} */ m) => sumOf([...own].map((id) => (powerOf(id)?.kind === 'broadside' ? 0 : blowOf(id, m))));
    const loot = Math.max(...['fresh', 'struck'].map((m) => slayer + ownBlow(m) + wornPowers(worn, m, own) + (m === 'struck' ? mark : 0)));
    const p = {
      roll: w ? sumOf(linesOf(w, 'damage').map((a) => a.value)) : 0,
      heirloom: w && isHeirloom(w) ? HEIRLOOM_DAMAGE_PER_GEN * Math.min(HEIRLOOM_GEN_MAX, w.heirloom.gen | 0) : 0,
      loot: Math.min(BLOW_TOPS.loot, loot),
      sigil: w ? Math.min(BLOW_TOPS.sigil, sigilPercent(w.sigil, ANY_RENOWN)) : 0,
    };
    const x = (1 + p.roll / 100) * (1 + p.heirloom / 100) * (1 + p.loot / 100) * (1 + p.sigil / 100);
    if (x > heldX) { held = p; heldX = x; }
  }
  // MASTERY: a weapon skill's climb and its gear's points (worn pieces, the line's blessings, a set's tier, the sky)
  const blessings = Array.isArray(save?.legacyBlessings) ? save.legacyBlessings : [];
  let mastery = 0;
  for (const s of WEAPON_SKILLS) {
    const blessed = Math.min(BLESSING_SKILL_MAX, sumOf(blessings.filter((b) => (b?.skill | 0) === s).map((b) => Math.max(0, Math.min(BLESSING_POINTS, b.value | 0)))));
    const points = wornBest(worn, (it) => skillPoints(it, s)) + blessed + (sets.skills[s] ?? 0) + firmSkill(firm, s, sk);
    const climb = climbOf(sk, mastered, s) * (/** @type {any} */ (CLIMB_PER_POINT)[s] ?? 0) * 100;
    mastery = Math.max(mastery, climb + Math.min(WEAPON_GEAR_PCT_MOST, points * WEAPON_GEAR_PER_POINT));
  }
  const path = typeof save?.martialPath === 'string' ? MARTIAL_BY_ID[save.martialPath] : null;
  const skyBlow = Math.max(0, ...['LongBlade', 'ShortBlade', 'Axe', 'BluntWeapon', 'Archery', 'HandToHand']
    .flatMap((skill) => FOE_GROUPS.map((group) => blowPct(firm, { skill, group, unaware: true, wounded: true }))));
  // THE SPELL (spellPower.js spellPowerMult): the school past 100, then the loot's potency and Surge, the sky, the path
  const school = Math.max(1, ...MAGIC_SKILLS.map((s) => 1 + climbOf(sk, mastered, s) * SCHOOL_POTENCY_PER_POINT));
  const surge = Math.max(0, ...worn.flatMap((it) => idsOf(it).map((id) => (powerOf(id)?.kind === 'surge' ? powerOf(id).pct : 0))));
  const loot = Math.min(SPELL_POWER_MOST, Math.min(POTENCY_CAP, wornBest(worn, (it) => sumOf(linesOf(it, 'potency').map((a) => a.value)))) + surge);
  const arcane = typeof save?.arcanePath === 'string' && PATH_BY_ID[save.arcanePath] ? /** @type {any} */ (PATH_SPELL_MOST)[save.arcanePath] ?? 0 : 0;
  return {
    ...held,
    sets: sets.blow,
    mastery: Math.min(BLOW_TOPS.mastery, mastery),
    martial: path && path.skills.every((/** @type {number} */ s) => mastered.includes(s)) ? BLOW_TOPS.martial : 0,   // AUDIT POTION-MIGHT A3: a path held, both its skills mastered
    firmament: Math.min(BLOW_TOPS.firmament, skyBlow),
    spell: school * Math.max(SPELL_POWER_FLOOR, 1 + (loot + (firm.spellPower ?? 0) + arcane) / 100),
  };
}

/** A KIT'S MIGHT off a judged save and its sky: a blow's parts composed, or a spell's whole, whichever is more
 *  (net/mightLaw.js mightOf bounds it). Pure. @param {any} save @param {(it: any) => boolean} lawful
 *  @param {{ firm?: Record<string, number> }} [o] */
export function kitMightOf(save, lawful, o = {}) {
  const p = kitMightParts(save, lawful, o);
  const blow = mightOf([p.roll, p.heirloom, p.loot, p.sets, p.sigil, p.mastery, p.martial, p.firmament]);
  return Math.max(blow, mightOf([(p.spell - 1) * 100]));
}

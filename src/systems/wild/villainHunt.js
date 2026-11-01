// @ts-check
// PVP-GUARDS (the PvP rework, 2026-10-29; bible/11-Multiplayer/PvP-Rework.md): THE WATCH HUNTS A VILLAIN. A red villain
// (villainLaw.js isVillain) in a settlement's streets of the open zone has no peace there, and the watch comes for it:
// two guards at first, one more each 30 s while it stays, six at most. Each is the villain's mirror ("like my self coming
// for me"): its level, and its skills turned to what helps a guard. A hunter takes 5% of every hit. Pure.
// A departure from PlayerEntity.SpawnCityGuards (PlayerEntity.cs:625-694): DFU sends 2-5 once for a crime, at the
// player's level plus Range(3, 7), every skill SetEnemyCareer's flat level*5+30, and the watch resists nothing.
import { SKILLS, skillValue } from '../skills.js';
import { liveStat } from '../statMods.js';

/** The hunt's numbers: guards at first, one more each `stepMs`, `max` standing; a hunter keeps `taken` of a hit. */
export const VILLAIN_HUNT = Object.freeze({ first: 2, stepMs: 30_000, max: 6, taken: 0.05 });

/** A villain's attack skills: any weapon, Hand-to-Hand, Archery or Destruction - the best is the guard's weapon skill. */
export const HUNT_ATTACK_SKILLS = Object.freeze([
  SKILLS.ShortBlade,
  SKILLS.LongBlade,
  SKILLS.Axe,
  SKILLS.BluntWeapon,
  SKILLS.HandToHand,
  SKILLS.Archery,
  SKILLS.Destruction,
]);
/** The skills a guard's own weapon reads (its kit is its own, so every one of them). */
export const HUNT_WEAPON_SKILLS = Object.freeze([
  SKILLS.ShortBlade,
  SKILLS.LongBlade,
  SKILLS.Axe,
  SKILLS.BluntWeapon,
  SKILLS.HandToHand,
  SKILLS.Archery,
]);
/** A villain's defensive skills. A guard casts nothing, so its one defence a skill moves is Dodging. */
export const HUNT_DEFENCE_SKILLS = Object.freeze([SKILLS.Dodging, SKILLS.Restoration, SKILLS.Alteration]);
/** DFU has no Block skill: a shield's block reads these six attributes (pcaao.js ShieldBlockChanceCalculation). */
export const HUNT_BLOCK_STATS = Object.freeze(['agility', 'speed', 'strength', 'endurance', 'willpower', 'luck']);

/**
 * How many guards to send now. `startAt` the hunt's first poll, `sent` the arrivals already counted (the answer's own
 * `sent`), `standing` the hunters alive. An arrival the cap refuses is spent, so a slain hunter waits for the next step.
 * @param {number} startAt @param {number} now @param {number} sent @param {number} standing
 * @returns {{ send: number, sent: number }}
 */
export function huntDue(startAt, now, sent, standing) {
  const due = VILLAIN_HUNT.first + Math.max(0, Math.floor((now - startAt) / VILLAIN_HUNT.stepMs));
  return { send: Math.max(0, Math.min(due - sent, VILLAIN_HUNT.max - standing)), sent: Math.max(sent, due) };
}

/**
 * The villain turned into a guard's numbers: its level; every weapon skill its best attack skill; its Critical Strike;
 * Dodging the best of its defensive skills; and the six attributes its block reads, each where it beats the guard's own.
 * The values are what the villain's formulas read (skillValue, liveStat), and a guard's override is read as it stands.
 * @param {any} villain @param {{ skill?: (entity: any, id: number) => number, stat?: (entity: any, k: string) => number }} [o]
 */
export function villainMirror(villain, { skill = skillValue, stat = liveStat } = {}) {
  const best = (ids) => Math.max(0, ...ids.map((id) => Number(skill(villain, id)) || 0));
  const weapon = best(HUNT_ATTACK_SKILLS);
  /** @type {Record<number, number>} */
  const skillOverrides = {};
  for (const id of HUNT_WEAPON_SKILLS) skillOverrides[id] = weapon;
  skillOverrides[SKILLS.CriticalStrike] = best([SKILLS.CriticalStrike]);
  skillOverrides[SKILLS.Dodging] = best(HUNT_DEFENCE_SKILLS);
  /** @type {Record<string, number>} */
  const stats = {};
  for (const k of HUNT_BLOCK_STATS) stats[k] = Math.trunc(Number(stat(villain, k)) || 0);
  return { level: Math.max(1, Math.trunc(Number(villain?.level) || 1)), skillOverrides, stats };
}

/** Put a mirror on a guard's entity: its skills, the attributes it gains, and the hunter's mark the damage door reads. */
export function mirrorOnto(entity, mirror) {
  entity.skillOverrides = { ...(entity.skillOverrides ?? {}), ...mirror.skillOverrides };
  entity.stats = { ...(entity.stats ?? {}) };
  for (const [k, v] of Object.entries(mirror.stats)) if (v > (entity.stats[k] ?? 0)) entity.stats[k] = v;
  entity.villainHunter = true;
  return entity;
}

/** What a hit leaves of itself on `entity`: a hunter keeps VILLAIN_HUNT.taken of it, at least 1 of a hit that lands. */
export const hunterTaken = (/** @type {any} */ entity, /** @type {number} */ damage) =>
  entity?.villainHunter && damage > 0 ? Math.max(1, Math.round(damage * VILLAIN_HUNT.taken)) : damage;

/** Is the villain hunted here: red on its meter, in a settlement's streets of the open zone, outdoors and alive. */
export const villainHunted = (
  /** @type {{ meterRed: boolean, zone: boolean, outdoors: boolean, settled: boolean, alive: boolean }} */ o,
) => !!(o.meterRed && o.zone && o.outdoors && o.settled && o.alive);

/** ZONE-SAFE with the villain's exception: is a point at peace - in a settlement's streets, and not a red villain's. */
export const peaceFor = (/** @type {boolean} */ settled, /** @type {boolean} */ red) => !!settled && !red;

/** PVP-SAFE-HIT: may I strike from where I stand - out of a
 *  settlement's safe streets (`streets`, zoneSafe's word), anyone fair; in them, a red villain alone. */
export const streetsStrike = (/** @type {boolean} */ streets, /** @type {boolean} */ red) => !streets || !!red;

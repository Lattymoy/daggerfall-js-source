// @ts-check
// FIXED-PVE stage 3 (bible/05-Combat/Fixed-PvE.md section 4): THE REFERENCE BUILDS - the six kinds the spec names, at
// six tiers of skill and gear, each a stated player the simulator fights. A blow is a hit on an unarmoured target;
// the top tier holds the hits the live formulas give a fully geared build, and health at 45 is END 100's. The tempos
// are the game's own clocks: the swing law, the bow's cooldown, the cast clock. The reference player
// (pveCategories.js) is these builds' middle. Stated, not measured in a live fight. Ledger A (FIXED-PVE).

import { LEVEL_MIN, LEVEL_MAX } from './pveCategories.js';
import { swingFrameSeconds, swingHandling, swingHeft, SWING_FRAME_MIN, SWING_PACE_MOST, MELEE_NUM_FRAMES,
  getBowCooldownTime, BOW_NUM_FRAMES, HIT_FRAME_BOW, CLASSIC_UPDATE_INTERVAL } from '../../characters/weaponStates.js';
import { castReleaseS, CAST_RECOVER_S } from '../../combat/fpsSpellCasting.js';
import { speedCastRate, validCastRate } from '../castSpeed.js';

/** Skill and gear by level: health, trained skill, what gear adds, Speed and Strength, swing pace (weapon mastery and
 *  martial powers, to SWING_PACE_MOST), cast speed from loot, hit chance, and the guards plate brings. */
export const TIERS = Object.freeze([
  Object.freeze({ key: 'early', level: 1, health: 45, skill: 30, gearSkill: 0, speed: 50, strength: 55, pace: 0, cast: 0, hit: 0.7, taken: 1, evade: 0, regen: 0, vigil: false }),
  Object.freeze({ key: 'intermediate', level: 10, health: 140, skill: 60, gearSkill: 10, speed: 58, strength: 65, pace: 0, cast: 0.03, hit: 0.8, taken: 1, evade: 0, regen: 0.001, vigil: false }),
  Object.freeze({ key: 'advanced', level: 20, health: 330, skill: 100, gearSkill: 40, speed: 67, strength: 80, pace: 10, cast: 0.08, hit: 0.88, taken: 0.85, evade: 0.03, regen: 0.002, vigil: false }),
  Object.freeze({ key: 'mastered', level: 30, health: 650, skill: 140, gearSkill: 150, speed: 76, strength: 90, pace: 20, cast: 0.15, hit: 0.95, taken: 0.8, evade: 0.05, regen: 0.004, vigil: false }),
  Object.freeze({ key: 'enhanced', level: 40, health: 1000, skill: 140, gearSkill: 450, speed: 85, strength: 100, pace: 35, cast: 0.25, hit: 0.97, taken: 0.7, evade: 0.1, regen: 0.006, vigil: true }),
  Object.freeze({ key: 'top', level: 45, health: 1265, skill: 140, gearSkill: 730, speed: 100, strength: 100, pace: SWING_PACE_MOST, cast: 0.45, hit: 0.97, taken: 0.6, evade: 0.15, regen: 0.008, vigil: true }),
]);

/** @typedef {{ key: string, name: string, family: 'melee'|'bow'|'spell', range: number, blow: number[], health: number,
 *  weapon?: { type: number, twoHanded?: boolean, kg: number }, block?: number, spellShare?: number, element?: string,
 *  blade?: boolean, cloth?: boolean, control: number, note?: string }} BuildKind */

/** The kinds. `blow` is the hit at each tier; `health` a share of the tier's. */
export const BUILD_KINDS = Object.freeze({
  melee: Object.freeze({ key: 'melee', name: 'Melee Fighter', family: 'melee', range: 0, blade: true, weapon: Object.freeze({ type: 0, twoHanded: true, kg: 7.5 }),
    blow: Object.freeze([7, 22, 69, 234, 720, 1550]), health: 1, control: 0.5, note: 'Dai-Katana, weapon gear at 0.44% a point (systems/weaponMastery.js)' }),
  archer: Object.freeze({ key: 'archer', name: 'Archer', family: 'bow', range: 1, blade: true,
    blow: Object.freeze([6, 20, 66, 234, 720, 1550]), health: 0.95, control: 0.5, note: 'Daedric long bow at full draw' }),
  mage: Object.freeze({ key: 'mage', name: 'Destruction Mage', family: 'spell', range: 1, element: 'fire', cloth: true,
    blow: Object.freeze([5, 20, 66, 234, 675, 1375]), health: 0.6, control: 2, note: 'the mages\' rework: base to Destruction x0.15, spell crit, x1.1 on PvE foes - not built' }),
  defender: Object.freeze({ key: 'defender', name: 'Defensive Fighter', family: 'melee', range: 0, blade: true, weapon: Object.freeze({ type: 0, kg: 3 }), block: 0.25,
    blow: Object.freeze([5, 17, 54, 180, 540, 1215]), health: 1.15, control: 1, note: 'longsword and shield' }),
  battlemage: Object.freeze({ key: 'battlemage', name: 'Hybrid Battlemage', family: 'melee', range: 0, blade: true, weapon: Object.freeze({ type: 0, kg: 3 }), spellShare: 0.3, element: 'shock',
    blow: Object.freeze([5, 19, 60, 207, 608, 1200]), health: 0.85, control: 1.5, note: 'a spell in every third action' }),
  monk: Object.freeze({ key: 'monk', name: 'Hand-to-Hand Fighter', family: 'melee', range: 0, weapon: Object.freeze({ type: 15, kg: 0 }),
    blow: Object.freeze([5, 18, 60, 216, 630, 1310]), health: 1, control: 0.5, note: 'fist at Hand-to-Hand 872 and Critical Strike 860 (combat/pcaao.js)' }),
});
export const BUILD_KIND_KEYS = Object.freeze(Object.keys(BUILD_KINDS));

const clamp = (l) => Math.max(LEVEL_MIN, Math.min(LEVEL_MAX, Math.round(Number(l) || LEVEL_MIN)));
const lerp = (a, b, t) => a + (b - a) * t;

/** The tier pair `level` falls between and how far along. */
function tierAt(level) {
  const L = clamp(level);
  let i = 0; while (i < TIERS.length - 2 && TIERS[i + 1].level < L) i++;
  return { a: TIERS[i], b: TIERS[i + 1], i, t: (L - TIERS[i].level) / (TIERS[i + 1].level - TIERS[i].level) };
}

/** Seconds between a build's actions at a tier's Speed, Strength, pace and cast speed. */
export function actionSeconds(kind, speed, strength, pace, cast) {
  if (kind.family === 'bow') return getBowCooldownTime(speed) + (BOW_NUM_FRAMES.StrikeUp + HIT_FRAME_BOW) * CLASSIC_UPDATE_INTERVAL;
  const rate = validCastRate(speedCastRate(speed) + cast);
  const spellS = castReleaseS(rate) + CAST_RECOVER_S / rate;
  if (kind.family === 'spell') return spellS;
  const w = /** @type {NonNullable<BuildKind['weapon']>} */ (kind.weapon);
  const frame = swingFrameSeconds(speed, { heft: swingHeft(w.kg, strength), handling: swingHandling(w.type, !!w.twoHanded) });
  const swingS = MELEE_NUM_FRAMES.StrikeDown * Math.max(SWING_FRAME_MIN, frame / (1 + pace / 100));
  return kind.spellShare ? lerp(swingS, spellS, kind.spellShare) : swingS;
}

/**
 * A stated player of `kindKey` at `level`, every number between tiers on a line (the blow on a geometric one). Pure.
 * @param {string} kindKey @param {number} level
 */
export function buildAt(kindKey, level) {
  const kind = BUILD_KINDS[kindKey];
  if (!kind) throw new Error(`unknown build kind ${kindKey}`);
  const L = clamp(level), { a, b, i, t } = tierAt(L);
  const speed = lerp(a.speed, b.speed, t), strength = lerp(a.strength, b.strength, t);
  const taken = lerp(a.taken, b.taken, t) * (kind.cloth ? 1.15 : 1);
  return Object.freeze({ kind: kind.key, name: kind.name, level: L, tier: t < 0.5 ? a.key : b.key, family: kind.family, range: kind.range,
    blow: kind.blow[i] * (kind.blow[i + 1] / kind.blow[i]) ** t, hit: lerp(a.hit, b.hit, t), actionS: actionSeconds(kind, speed, strength, lerp(a.pace, b.pace, t), lerp(a.cast, b.cast, t)),
    health: lerp(a.health, b.health, t) * kind.health, taken, evade: lerp(a.evade, b.evade, t), block: kind.block ?? 0,
    regen: lerp(a.regen, b.regen, t), vigil: t < 0.5 ? a.vigil : b.vigil, hitCap: (t < 0.5 ? a.vigil : b.vigil) ? 0.25 : null,
    control: kind.control, element: kind.element ?? null, blade: !!kind.blade, spellShare: kind.family === 'spell' ? 1 : (kind.spellShare ?? 0) });
}

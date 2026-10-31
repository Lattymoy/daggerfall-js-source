// @ts-check
// FIXED-PVE (bible/05-Combat/Fixed-PvE.md): A FOE'S STRENGTH IS ITS LEVEL AND ITS CATEGORY, NEVER THE PLAYER'S.
// The reference player is a planning line, not a reader of anyone: what a player of each level is expected to bring
// in that level's band of gear. A Normal foe of a level falls to that player in NORMAL_BLOWS, and
// takes the edge more blows to fell them (10-30%, the middle by default). The categories stand on it.
// The two sides swing at their own tempos (stage 3): the reference player a longsword's swing at its Speed, a foe the
// tactics brain's blow and recovery, so a foe's blow carries the gap. Starting values. Ledger A (FIXED-PVE).

import { swingFrameSeconds, MELEE_NUM_FRAMES } from '../../characters/weaponStates.js';
import { TACT } from '../../ai/tactics.js';

/** [level, what a swing lands, health it can lose] of the reference player: the middle of the six reference builds
 *  (pveBuilds.js - the test holds the two together), its damage a second times its own swing, health over its guards. */
export const REFERENCE_PLAYER = Object.freeze([
  Object.freeze([1, 18, 45]), Object.freeze([10, 29.8, 140]), Object.freeze([20, 68.5, 400]),
  Object.freeze([30, 859, 855]), Object.freeze([40, 1792, 1587]), Object.freeze([45, 2291, 2480]),
]);
export const LEVEL_MIN = 1;
export const LEVEL_MAX = 45;
/** Blows the reference player needs on a Normal foe of its level. */
export const NORMAL_BLOWS = 5;
/** The player's edge over a Normal foe of its level: the foe needs this much more blows to fell them. */
export const PLAYER_EDGE = Object.freeze({ min: 0.1, mid: 0.2, max: 0.3 });
/** A blow lands within this share either side of its middle. */
export const DAMAGE_SPREAD = 0.4;
/** [level, Speed] of the reference player, on a straight line between. */
export const REFERENCE_SPEED = Object.freeze([Object.freeze([1, 50]), Object.freeze([45, 90])]);
/** Seconds between a foe's blows: its swing and the mean of its recovery (ai/tactics.js), the walk back in not counted. */
export const FOE_BLOW_S = TACT.SWING + (TACT.RECOVER_MIN + TACT.RECOVER_MAX) / 2;

/** Who a category is made for (`party` reference players), how long they take (`swings` each), and the margin
 *  they keep - their time to fall over its time to fall. Health and blow over a Normal foe follow: health is the
 *  party's swings; the blow fells them one by one, and the party loses a swinger at each fall, so what it deals by
 *  the last fall is a share (party + 1) / 2 of its full rate. */
const LAW = /** @type {Record<string, [number, number, number, string]>} */ (Object.freeze({
  normal: [1, NORMAL_BLOWS, 1 + PLAYER_EDGE.mid, 'Normal'], strong: [1, 7.5, 0.9, 'Strong'], elite: [2, 20, 1.2, 'Elite'],
  champion: [3, 40, 1.2, 'Champion'], boss: [5, 175, 1.15, 'Boss'], raidBoss: [10, 400, 1.15, 'Raid Boss'],
}));
export const PVE_CATEGORIES = Object.freeze(Object.fromEntries(Object.entries(LAW).map(([k, [party, swings, margin, label]]) =>
  [k, Object.freeze({ party, swings, margin, label, health: (party * swings) / NORMAL_BLOWS,
    damage: ((party + 1) * NORMAL_BLOWS * (1 + PLAYER_EDGE.mid)) / (2 * swings * margin) })])));
export const CATEGORY_KEYS = Object.freeze(Object.keys(PVE_CATEGORIES));

const clampLevel = (l) => Math.max(LEVEL_MIN, Math.min(LEVEL_MAX, Math.round(Number(l) || LEVEL_MIN)));

/** The reference player at `level`: the blow between anchors on a geometric line (gear compounds), health on a straight one. */
export function referencePlayer(level) {
  const L = clampLevel(level);
  let i = 0; while (i < REFERENCE_PLAYER.length - 2 && REFERENCE_PLAYER[i + 1][0] < L) i++;
  const [l0, b0, h0] = REFERENCE_PLAYER[i], [l1, b1, h1] = REFERENCE_PLAYER[i + 1];
  const t = (L - l0) / (l1 - l0);
  const [[s0l, s0], [s1l, s1]] = REFERENCE_SPEED;
  const speed = s0 + ((s1 - s0) * (L - s0l)) / (s1l - s0l);
  return { level: L, blow: b0 * (b1 / b0) ** t, health: h0 + (h1 - h0) * t, speed,
    swingS: MELEE_NUM_FRAMES.StrikeDown * swingFrameSeconds(speed) };
}

/**
 * A foe's numbers at `level` in `category`, before its roles: whole health, a blow's [min, max]. Pure.
 * @param {number} level @param {string} [category] @param {number} [edge]
 */
export function categoryStats(level, category = 'normal', edge = PLAYER_EDGE.mid) {
  const c = PVE_CATEGORIES[category] ?? PVE_CATEGORIES.normal;
  const ref = referencePlayer(level);
  const health = Math.max(1, Math.round(ref.blow * NORMAL_BLOWS * c.health));
  const mean = (ref.health / (NORMAL_BLOWS * (1 + edge))) * (FOE_BLOW_S / ref.swingS) * c.damage;   // a Normal's, times the law's
  return { level: ref.level, category: PVE_CATEGORIES[category] ? category : 'normal', health,
    damage: [Math.max(1, Math.round(mean * (1 - DAMAGE_SPREAD))), Math.max(1, Math.round(mean * (1 + DAMAGE_SPREAD)))] };
}

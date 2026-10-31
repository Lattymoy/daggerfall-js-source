// @ts-check
// ATTACK-WARM (2026-10-31, the owner: "Walking shouldnt cancel attack animations"): A LAYERED BODY'S CLIPS COMPOSED
// BEFORE THEY PLAY. Each outfit and each pair of hands is its own set of composed frames (layeredArmor.js
// decodeLayered), and the body draws a frame only once it is composed: until then the last one stays
// (eotbBody.js draw). `preload` composes every table when the body attaches, but a weapon or a piece changed later
// left its swing to be composed as it played - the walk's frame held through the blow, most where the walk turns the
// view. When the look changes, its clips are queued here and composed a few a frame (eotbBody.js warmLayered).
import { isBowCode } from './layeredWeapon.js';

/** How many of a look's clip frames are asked for a frame (the horse's rate, eotbBody.js HORSE_PRELOAD_A_FRAME). */
export const LAYERED_WARM_A_FRAME = 4;

/** What a layered look's clip frames are keyed by - the body, the outfit and the hands - or null for no layered body.
 *  @param {any} lk @returns {string|null} */
export function warmSigOf(lk) {
  if (!lk?.wornArmour || !lk.outfit) return null;
  return [lk.gender ?? '', lk.outfit, lk.weapon ?? '', lk.offhand ?? '', lk.cast ?? '', lk.spellHand ? 1 : 0].join('|');
}

/**
 * The frames the look's hands can play next, drawn (a sheathed weapon's swing is the one it plays once out): the swing,
 * each hand's for a pair; the loose for a bow; the cast where a spell is readied. Every view.
 * @param {any} lk @param {(table: string) => number} frameCount @param {number} views
 * @returns {Array<[string, number, number, any]>}  [table, view, frame, look]
 */
export function warmFramesOf(lk, frameCount, views) {
  if (!warmSigOf(lk)) return [];
  const { sheathed: _sheathed, strike: _strike, ...drawn } = lk;
  /** @type {Array<[string, any]>} */
  const clips = isBowCode(lk.weapon) ? [['AttackRanged', drawn]]
    : lk.offhand ? [['AttackMelee', { ...drawn, strike: 'R' }], ['AttackMelee', { ...drawn, strike: 'L' }]]
      : [['AttackMelee', drawn]];
  if (Number.isInteger(lk.cast)) clips.push(['AttackSpell', drawn]);
  const out = [];
  for (const [table, look] of clips) {
    for (let f = 0; f < frameCount(table); f++) for (let o = 0; o < views; o++) out.push(/** @type {[string, number, number, any]} */ ([table, o, f, look]));
  }
  return out;
}

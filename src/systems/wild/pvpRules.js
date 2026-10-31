// @ts-check
// PVP-RULES (the PvP rework, 2026-10-29 - as the owner asked): A FIGHTER'S LIMITS UNDER THE FLAG in the open zone. While my flag is up there
// (aggro is a flag up, its skull gold): no Levitate, and the fall it ends costs no health; the PvE buffs end as the flag
// goes up and are not cast on myself again; no rest; the pace on foot and the jump held to an unbuffed best. Pure but for
// the one source of "limited" the host registers (scenes/pvpRulesHost.js) and the one fall it spares. A departure: DFU
// has no PvP.
import { t } from '../textManager.js';

/** The caps: an unbuffed best - Speed 100 and Running 100 run ((100 + 150) / 39.5 x (1.35 + 100 / 200), player/motor.js
 *  runSpeed), and Jumping 100 with Athleticism (1 + 0.5 + 0.1, systems/skills.js jumpSpeedMultiplier), no Jump spell. */
export const PVP_LIMITS = Object.freeze({ mps: 11.71, jump: 1.6 });

/** The live effects the flag ends as it goes up: the PvE buffs, a worn item's too. A curse's and a foe's harm stay. */
export const PVP_DISPEL_KINDS = Object.freeze([
  'fortifyAttribute',
  'shield',
  'elementalResistance',
  'spellResistance',
  'spellAbsorption',
  'spellReflection',
  'regenerate',
  'invisNormal',
  'invisTrue',
  'chameleonNormal',
  'chameleonTrue',
  'shadeNormal',
  'shadeTrue',
  'jumping',
  'climbing',
  'slowfall',
  'freeAction',
  'waterWalking',
  'levitate',
]);
/** The classic effect types not cast on myself while flagged (Shield, 35, is the fight's own - PVP-TRIANGLE reads it):
 *  Resist 8, Fortify 9, Invisibility 13, Regenerate 18, Absorb, Reflect and Resist Spell 20-22, Chameleon 23, Shadow 24,
 *  Slowfall 25, Free Action 26, Jumping 27, Climbing 28, Water Walking 31. Levitate (14) is refused at any range. */
export const PVP_SELF_BARRED = Object.freeze([8, 9, 13, 18, 20, 21, 22, 23, 24, 25, 26, 27, 28, 31]);
export const PVP_LEVITATE = 14;
const DISPEL = new Set(PVP_DISPEL_KINDS);
const SELF_KINDS = new Set(PVP_DISPEL_KINDS.filter((k) => k !== 'shield'));

let _limited = /** @type {(() => boolean) | null} */ (null);
let _warded = false,
  _spare = false,
  _heldTaken = false;
/** The host's word on whether my flag is up in the open zone (null: never). */
export function setPvpLimitedSource(fn) {
  _limited = typeof fn === 'function' ? fn : null;
  _warded = false;
  _spare = false;
  _heldTaken = false;
}
/** Am I held to the flag's limits now? A source that throws holds nothing. */
export const pvpLimited = () => {
  try {
    return !!_limited?.();
  } catch {
    return false;
  }
};

/** The ward on a running Levitate (characters/playerEntity.js levitateWarded): the first time it holds one, the fall that
 *  follows is spared. Asked only while a Levitate runs. */
export function pvpLevitateBarred() {
  if (!pvpLimited()) {
    _warded = false;
    return false;
  }
  if (!_warded) {
    _warded = true;
    _spare = true;
  }
  return true;
}
/** The host's poll: on the ground the spare is spent; off the flag the ward's first hold is owed again. */
export function notePvpGround(grounded, limited) {
  if (grounded) _spare = false;
  if (!limited) _warded = false;
}
/** Is the landing now the fall a ward began (no health lost)? */
export const pvpFallSpared = () => _spare;
/** The landing's own read: spared once, then spent. */
export const takePvpFallSpare = () => {
  const s = _spare;
  _spare = false;
  return s;
};

/** Why this spell is not cast now, or null: Levitate at any range, a PvE buff on myself (rangeType 0, CasterOnly). */
export function pvpSpellRefusal(sp, limited = pvpLimited()) {
  if (!limited || sp?.pvpKit != null) return null; // PVP-KIT: the PvP bar's spells are the flag's own
  const fx = Array.isArray(sp?.effects) ? sp.effects : [];
  if (fx.some((e) => e?.type === PVP_LEVITATE)) return t('pvp.rules.levitate', 'You cannot levitate with PvP on.');
  if (sp?.rangeType === 0 && fx.some((e) => PVP_SELF_BARRED.includes(e?.type)))
    return t('pvp.rules.buff', 'You cannot cast that on yourself with PvP on.');
  return null;
}
/** The rest window's refusal while flagged (systems/rest/restSession.js registerPreventRestCondition). */
export const pvpRestText = () => t('pvp.rules.rest', 'You cannot rest or wait with PvP on.');

/** May this entry stay? `edge` the flag just went up: every PvE buff goes (a potion's too); after it, my own casts and
 *  a party mate's gifts but Shield, and any Levitate. A worn item's buff goes each poll (as the owner asked) and
 *  comes back when the flag drops (scenes/pvpRulesHost.js). A curse's, a duel's and the PvP bar's entry stay. */
const dispelled = (a, edge) =>
  !a.permanent &&
  !a.bundleDuel &&
  !a.bundleKit &&
  (a.heldItem
    ? DISPEL.has(a.kind)
    : a.kind === 'levitate' ||
      (edge ? DISPEL.has(a.kind) : SELF_KINDS.has(a.kind) && (a.bundleSelfCast || a.bundleAlly)));
/** End the PvE buffs on `entity` (`edge`: the flag just went up); answers how many entries went. */
export function stripPvpBuffs(entity, edge) {
  const list = entity?.activeEffects;
  if (!Array.isArray(list) || !list.length) return 0;
  const kept = list.filter((a) => !a || !dispelled(a, edge));
  const n = list.length - kept.length;
  if (n && list.some((a) => a?.kind === 'levitate' && !kept.includes(a))) {
    _warded = true;
    _spare = true;
  } // the fall it ends is spared too
  if (list.some((a) => a?.heldItem && !kept.includes(a))) _heldTaken = true;
  if (n) entity.activeEffects = kept;
  return n;
}
/** Did the flag take a worn item's buff since the last ask? The host recasts the worn set once the flag drops. */
export const takePvpHeldTaken = () => {
  const h = _heldTaken;
  _heldTaken = false;
  return h;
};
/** PVP-RULES (as the owner asked): no saddle or cart under the flag in the open zone. */
export const pvpRideText = () => t('pvp.rules.ride', 'You cannot ride with PvP on.');
/** The line said when the flag going up takes buffs. */
export const pvpDispelText = () => t('pvp.rules.dispel', 'Your buffs end while PvP is on.');

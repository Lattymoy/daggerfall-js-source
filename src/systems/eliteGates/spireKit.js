// @ts-check
// EG-FULL (2026-10-11, the Elite Gates arc; bible/11-Multiplayer/Elite-Gates.md section 17.4, THE POTION LAW): "No
// natural regeneration" is what makes one life matter, and the port has no potion cooldown anywhere - with fifty potions
// there is no attrition. So in an Elite Breach a member drinks at most two RESTORING potions a hall (a Healing, a Heal
// True, a Purification - the recipes that heal health), refilled at each wake and at the rest; every other potion, and
// every spell, is untouched. Client-enforced like the Burning Court's no-regeneration rule: systems/useItem.js's potion
// arm asks first (the bottle is kept on a refusal) and tells after. The count is the breach client's (scenes/eliteGates/egClient.js
// potionAllowed / potionUsed), registered by the world host. A departure from DFU: Ledger A (ELITE-GATES).
import { POTION_RECIPES, potionRecipeKey } from '../potionRecipes.js';
import { madeRuleHere } from '../madeLevel.js';   // EG-H2 (Elite-Gates.md section 24): THE POTION LAW is a made level's rule - the Spire's ('counted')

/** The classic Heal-Health effect key (HealHealth.cs - group 10, subgroup 8). */
export const SPIRE_RESTORING_EFFECT = '10,8';
/** The refusal's words. */
export const SPIRE_POTION_TEXT = 'You can drink 2 restoring potions a hall. They refill when the next hall wakes or at a Redoubt.';

/** The restoring recipes' keys (the effect or a secondary heals health). */
const RESTORING_KEYS = new Set(/** @type {any[]} */ (POTION_RECIPES).filter((r) => r.effect === SPIRE_RESTORING_EFFECT || (r.secondary ?? []).includes(SPIRE_RESTORING_EFFECT)).map((r) => potionRecipeKey(r.ingredients)));
/** Is this potion a restoring one? Pure. */
export const isRestoringPotion = (item) => RESTORING_KEYS.has(item?.potionRecipeKey ?? 0);

/** @type {{ allowed: () => boolean, used: () => void } | null} */
let _law = null;
/** The breach's count, registered by the world host (null removes it). */
export function registerSpirePotionLaw(law) { _law = law && typeof law.allowed === 'function' ? law : null; }
/** The refusal of this potion now, or null - asked only where the made level's law counts restoring potions (the Spire). */
export function spirePotionRefusal(item) {
  if (madeRuleHere('potions') !== 'counted' || !_law || !isRestoringPotion(item)) return null;
  try { return _law.allowed() ? null : SPIRE_POTION_TEXT; } catch { return null; }
}
/** A potion drunk: a restoring one counted (where the law counts them). */
export function spirePotionDrunk(item) {
  if (madeRuleHere('potions') !== 'counted' || !_law || !isRestoringPotion(item)) return;
  try { _law.used(); } catch { /* the count is not the bottle's problem */ }
}

/** EG-FULL LAYER TWO: Iron Footing's share off a push on this screen (net/eliteGates/egVestige.js - by: 'client'), registered by the
 *  world host from the breach's client, read by the spans (scenes/eliteGates/egSpan.js - the Gust's push, the Pendulum's touch). */
let _footing = null;
export function registerSpireFooting(fn) { _footing = typeof fn === 'function' ? fn : null; }
export function spireFooting() {
  try { const v = Number(_footing?.() ?? 0); return Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0; } catch { return 0; }
}

/** EG-FULL LAYER TWO: the breach's hall now and its wake on the relay's clock (`{ h, hw }`, ms - 0 before it wakes),
 *  registered by the world host from the breach's client, read by the spans (scenes/eliteGates/egSpan.js - a Falling Wall falls from
 *  its wake). EG-PERFECT (2026-10-18; Elite-Gates.md section 11.3): and `tm`, when the company reached a routed hall's Collapsing
 *  Tube (relay ms, 0 not yet - the stage's word, net/eliteGates/egLink.js stageOf): its fall runs from there (net/eliteGates/egFair.js
 *  egTubeEdgeIn). */
let _wake = null;
export function registerSpireWake(fn) { _wake = typeof fn === 'function' ? fn : null; }
export function spireWake() {
  try {
    const w = _wake?.();
    return w && Number.isFinite(w.h) && Number.isFinite(w.hw) ? { h: w.h, hw: w.hw, tm: Number.isFinite(w.tm) && w.tm > 0 ? w.tm : 0 } : { h: 0, hw: 0, tm: 0 };
  } catch { return { h: 0, hw: 0, tm: 0 }; }
}

// EG-FULL LAYER THREE (section 11 - the fragments): what the spans stand from the relay's fight, and the hands a span's
// activation reaches. Both registered by the world host (scenes/world.js), off the breach client (scenes/eliteGates/egClient.js).
/** @type {(() => { h: number, objs: { t: string, i: number, x: number, z: number, st: number, stAt: number, pt: number }[], lit?: { s: any[], from: number, until: number }[], br?: { g: number, from: number, until: number }[], orr?: number[] | null }) | null} */
let _objs = null;
/** The fight's errand objects of the hall now (its number `h`; Grath's islands with their state, the false walls standing;
 *  EG-ZC: `lit`, the Moon-Mirror's havens over the branches it lights; AUDIT EG III: `br`, the Spirebridges the room raised -
 *  each its gap, its raising and its end, relay ms; FIELD BUGS 2026-10-17e, ORRERY-SIGHT: `orr`, an Athenaeum's stones' hours
 *  as the room last said them, the handle's plaque reads them). */
export function registerSpireObjs(fn) { _objs = typeof fn === 'function' ? fn : null; }
export function spireObjs() {
  if (!_objs) return { h: 0, objs: [] };
  try { const r = _objs(); return r && Array.isArray(r.objs) ? r : { h: 0, objs: [] }; } catch { return { h: 0, objs: [] }; }
}
/** @type {((key: string) => boolean) | null} */
let _act = null;
/** A press on a span's own target (an Orrery stone's handle, an engine) - `egstone:<h>:<i>:<f|b>`, `egengine:<h>:<i>`. */
export function registerSpireAct(fn) { _act = typeof fn === 'function' ? fn : null; }
export function spireAct(key) {
  if (!_act) return false;
  try { return !!_act(key); } catch { return false; }
}

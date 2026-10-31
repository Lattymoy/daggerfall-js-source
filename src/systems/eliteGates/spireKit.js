// @ts-check
// POTION-CLOCK (2026-10-31, the owner: "Allow potions in Elite Breach"; asked, "Cooldown per kind"; bible/11-Multiplayer/
// Elite-Gates.md section 17.4): in an Elite Breach every potion is drunk, and each kind (health, magicka, other) waits 15 s
// after the last of its kind - the PvP fight's own clock (combat/pvpPotions.js), run here by the made level's law
// (`potions: 'timed'`). It replaced EG-FULL's count of two restoring potions a hall. The bag is the attrition now, and the
// relay's count believes a mend only out of its line (net/bossBody.js). A departure from DFU: Ledger A (ELITE-GATES).
import { madeRuleHere, madeLevelHere, madeLevelRule, madeLevelSays } from '../madeLevel.js';   // EG-H2 (Elite-Gates.md section 24): the made level's law says where potions are timed
import { registerPotionClockHere } from '../../combat/pvpPotions.js';
import { potionBundle } from '../potions.js';   // AUDIT POTION-MIGHT C7: a bottle's effects
import { BUFF_KINDS } from '../effects.js';

/** Where the made level under the player times potions (the Spire's row). */
export const spirePotionsTimed = () => madeRuleHere('potions') === 'timed';
/** AUDIT POTION-MIGHT C2: who tells the breach's room a bottle drunk - its kinds - registered by the breach's client
 *  (scenes/eliteGates/egClient.js): the room believes a health potion's heal on its own clock, outside the member's budget. */
let _told = null;
export function registerSpirePotionTold(fn) { _told = typeof fn === 'function' ? fn : null; }
registerPotionClockHere(spirePotionsTimed, (kinds) => _told?.(kinds));
/** AUDIT POTION-MIGHT C7: a bottle the place's flight ban would drink for nothing - its every effect a Levitate or a Slow
 *  Falling the made level bans (effects.js BUFF_KINDS) - is kept, refused in the level's words for a flight; '' for none. */
export function flightBottleRefusal(/** @type {any} */ item) {
  const level = madeLevelHere(), says = level ? madeLevelSays(level, 'techFlight') : '';
  const effects = says ? potionBundle(item?.potionRecipeKey ?? 0)?.effects ?? [] : [];
  const banned = (/** @type {any} */ e) => { const k = BUFF_KINDS[`${e?.type},${e?.subType}`]; return (k === 'levitate' || k === 'slowfall') && madeLevelRule(level, k) === 'banned'; };
  return effects.length && effects.every(banned) ? says : '';
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

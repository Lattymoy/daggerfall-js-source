// @ts-check
// STOREFRONT (2026-10-29; bible/06-Systems/Storefront.md section 10): A PEER'S WORN EFFECTS, for a face that holds only
// its id - a peer's spared revenant rising through its portal, a peer's Portal Stone gate. The kit is the one its newest
// hello carried (net/online.js effectsOf, the relay's from the signed token), bound by the host that holds the client
// (scenes/auraHost.js). None bound, or a peer with no kit: none worn, and the portal is the violet vortex. And the
// viewer's "Others' effects" choice, which every peer's kill effect and mount look is drawn by (othersEffectShown).
import { effectWorn } from '../effectLaw.js';
import { getPref } from '../../systems/uiPrefs.js';   // the "Others' effects" choice
import { playerDoor } from '../../systems/playerDoor.js';   // the running host's eye, which near is measured from

/** @type {((id: string) => unknown) | null} */
let _kitOf = null;
/** The host's door to each peer's kit, or null to unbind. */
export const bindPeerEffects = (/** @type {((id: string) => unknown) | null} */ fn) => { _kitOf = typeof fn === 'function' ? fn : null; };
/** The effect a peer wears in a slot, or null. */
export function peerEffectWorn(/** @type {unknown} */ id, /** @type {string} */ slot) {
  if (typeof id !== 'string' || !id || !_kitOf) return null;
  try { return effectWorn(_kitOf(id), slot); } catch { return null; }
}

/** The "Others' effects" choice (systems/features.js 'killfx-others') - every peer's kill effects and mount looks, those
 *  within this many metres of my eye, or none. One's own always show. */
export const KILL_FX_NEAR_M = 20;
export const killFxOthersOf = (/** @type {unknown} */ v) => (v === 'near' || v === 'none' ? v : 'all');
/** Whether a peer's kill effect or mount look standing at `at` (the scene's) is shown by that choice. Near needs the
 *  place and the eye: one it cannot measure is not near. */
export function othersEffectShown(/** @type {ArrayLike<number>|null|undefined} */ at) {
  const mode = killFxOthersOf(getPref('killFxOthers'));
  if (mode !== 'near') return mode === 'all';
  const eye = playerDoor()?.eye?.() ?? null;
  return !!eye && !!at && Math.hypot(at[0] - eye[0], at[1] - eye[1], at[2] - eye[2]) <= KILL_FX_NEAR_M;
}

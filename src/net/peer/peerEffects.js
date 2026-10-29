// @ts-check
// STOREFRONT (2026-10-29; bible/06-Systems/Storefront.md section 10): A PEER'S WORN EFFECTS, for a face that holds only
// its id - a peer's spared revenant rising through its portal, a peer's Portal Stone gate. The kit is the one its newest
// hello carried (net/online.js effectsOf, the relay's from the signed token), bound by the host that holds the client
// (scenes/auraHost.js). None bound, or a peer with no kit: none worn, and the portal is the violet vortex.
import { effectWorn } from '../effectLaw.js';

/** @type {((id: string) => unknown) | null} */
let _kitOf = null;
/** The host's door to each peer's kit, or null to unbind. */
export const bindPeerEffects = (/** @type {((id: string) => unknown) | null} */ fn) => { _kitOf = typeof fn === 'function' ? fn : null; };
/** The effect a peer wears in a slot, or null. */
export function peerEffectWorn(/** @type {unknown} */ id, /** @type {string} */ slot) {
  if (typeof id !== 'string' || !id || !_kitOf) return null;
  try { return effectWorn(_kitOf(id), slot); } catch { return null; }
}

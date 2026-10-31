// @ts-check
// STOREFRONT (2026-10-29; bible/06-Systems/Storefront.md section 7): THE MOUNT LOOK ON A HORSE'S CODE. A look is the
// account's, so it is laid on where a horse is drawn, never carried in the horse's own code on the wire: mine off my
// token's kit (systems/ownGlyphs.js ownEffects), a peer's off the kit its hello carried (net/peer/peerEffects.js). The
// dye is horseCoats.js's (MOUNT_DYES' `mountInto`), so every horse - the riding sprite, Eye Of The Beholder's riders,
// the 3D horse and a standing team's - wears it as it wears a coat.
import { withMountLook } from './horseCoats.js';
import { effectWorn } from '../../net/effectLaw.js';
import { ownEffects } from '../ownGlyphs.js';
import { peerEffectWorn, othersEffectShown } from '../../net/peer/peerEffects.js';

/** My horse's code with the mount look I wear laid over it. */
export const ownMountLook = (/** @type {unknown} */ code) => withMountLook(code, effectWorn(ownEffects(), 'mount'));
/** A peer's horse's code with the mount look its token says laid over it, where the horse stands (`at`, the scene's) is
 *  shown by the "Others' effects" choice - else its coat alone. */
export const peerMountLook = (/** @type {unknown} */ id, /** @type {unknown} */ code, /** @type {ArrayLike<number>|null|undefined} */ at) => withMountLook(code, othersEffectShown(at) ? peerEffectWorn(id, 'mount') : null);

// @ts-check
// STOREFRONT (2026-10-29; bible/06-Systems/Storefront.md section 4): MY KILL EFFECT, PLAYED. A foe my own blow killed
// (systems/playerKills.js - every pool's door, with where its body falls) plays the effect my account wears, through the
// running host's magic engine (systems/playerDoor.js `killFx`, scenes/hostMagic.js): the burst, and the body it stood in
// burnt away over the corpse. The others see it where my pose says (net/peer/peerFx.js noteMyKill). A leaf but for the
// account's stored word. Not a DFU member.
import { registerPlayerKillListener } from './playerKills.js';
import { playerDoor } from './playerDoor.js';
import { ownEffects } from './ownGlyphs.js';
import { effectWorn } from '../net/effectLaw.js';
import { noteMyKill } from '../net/peer/peerFx.js';

/** The kill listener's name. */
export const KILL_FX_LISTENER = 'kill-fx';

/** A flat as the effect's ghost copies it - what it showed this frame, where - or null for none. Pure. */
export function ghostOf(/** @type {any} */ b) {
  if (!b || !b.origin || !b.size || typeof b.archive === 'undefined') return null;
  return { archive: b.archive, record: b.record, frame: b.frame ?? null, size: { w: b.size.w, h: b.size.h }, origin: [b.origin[0], b.origin[1], b.origin[2]], dye: b.dye, tint: b.tint };
}

/** Play `look` for a body falling where `fx` says (playerKills.js killFxOf). Answers whether a host played it. */
export function playKillFx(/** @type {string|null} */ look, /** @type {any} */ fx) {
  if (!look || !fx?.at) return false;
  const door = playerDoor();
  return !!door?.killFx?.(look, fx.at, { h: fx.h, w: fx.w, ghost: ghostOf(fx.batch) });
}

// The wire audit: the others are told by the wire's own reach (noteMyKill's, from my feet), never by whether my screen
// drew it - my camera stands off my feet, and a host may draw none.
registerPlayerKillListener(KILL_FX_LISTENER, (/** @type {any} */ _entity, /** @type {any} */ info) => {
  const look = effectWorn(ownEffects(), 'kill');
  if (!look || !info?.fx?.at) return;
  playKillFx(look, info.fx);
  noteMyKill(info.fx.at, info.fx.h, playerDoor()?.feet?.());
});

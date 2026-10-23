// A PAIR OF GUNS - two Dwarven Pistolets, one in each hand, as the sprite lane steps them (PISTOLET, 2026-10-21; the owner:
// "a dwarven flintlock style pistol" that "can also be duel wielded"; bible/05-Combat/Dwarven-Pistolet.md).
//
// One gun is the rig's own single path (combat/weapon/weaponRig.js: its widget rig, its spring, its reload dip and its
// draw through gunFrameRect). A pair is that, TWICE, on one clock - each hand's own state lives here, and the rig wires
// it (HOST-SPLIT: new behaviour in a module the host wires, never grown into the host). The pistol lab settled each
// piece (pistol-proto.html, bible/05-Combat/Pistol-Lab.md), and this runs the same laws it ran:
//
//   - ONE WIDGET RIG PER HAND, the left one stepped FLIPPED - Two-Hands' two sway rules for free (Bob goes outward, the
//     mod's flipped sprite taking it mirrored; Inertia keeps the screen's direction, inertiaStep pre-signing it);
//   - ONE RECOIL SPRING PER HAND, punched by that hand's shot;
//   - THE GUARD (combat/twoHands/handsLaw.js): while one pistol fires and the other does not, the resting one lowers
//     GUARD.LOWER of its own drawn height, straight down;
//   - EACH HAND'S OWN RELOAD (combat/playerWeapon.js gunPair): the hand that fired dips on the Offset module's easing while
//     it reloads, with its own two clacks, and the other stays up and loaded.
//
// The machine is the player weapon's one machine; the striking hand plays its frames, the other rests on its idle.

import { createGunRig, gunRigStep, gunMotion } from './gunViewmodel.js';
import { createRecoil, RELOAD_CLOSE_LEAD } from './gunFeel.js';
import { guardStep, guardOffset, handOnLeft } from '../twoHands/handsLaw.js';

/** The two hands, R then L. */
export const PAIR_HANDS = Object.freeze(['R', 'L']);

/** The reload's second clack lands this long before the hand is ready - the single gun's own (gunFeel.js). */
export const PAIR_CLOSE_LEAD = RELOAD_CLOSE_LEAD;

export function createGunPair() {
  const hand = () => ({ rig: createGunRig(), recoil: createRecoil(), kick: { x: 0, y: 0 }, guard: 0, opened: false, closed: false, drawn: null });
  const hands = { R: hand(), L: hand() };
  /** The hand a strike in flight belongs to, or null. */
  const striking = (pw) => (pw.machine.state !== 'Idle' ? pw.strike?.hand ?? null : null);
  const pair = {
    hands,
    /** Is a hand drawn on the screen's left (a left-handed player's pair is the mirror - handsLaw.js handOnLeft). */
    flipOf: (h, leftHanded = false) => handOnLeft(h, leftHanded),
    /** A shot from `h`: its own spring, at the gun's kick. */
    punch(h, feel) {
      const r = hands[h].recoil;
      r.kick = feel.kick; r.back = feel.back;
      r.punch();
    },
    /** The frame a hand shows: the striking hand plays the machine's frame of the fire cycle, the other rests. */
    frameOf(h, pw) {
      return striking(pw) === h ? { record: 1, frame: pw.machine.frame } : { record: 0, frame: 0 };
    },
    /**
     * One frame of both hands - the springs, the guard, and each hand's widget rig on the gun's own settings, the reload
     * dip on the hand's own reload (`pw.handReloadUntil`). `f` is the rig's frame: the screen, the motion, the look.
     */
    step(dt, pw, { feel, settings, frame = null, leftHanded = false, sheathed = false, liveSpeed = 50, cursorActive = false, swingHeld = false } = {}) {
      const now = pw.machine.now, hit = striking(pw);
      for (const h of PAIR_HANDS) {
        const s = hands[h];
        s.recoil.stiff = feel.stiff; s.recoil.damp = feel.damp; s.recoil.back = feel.back;
        s.kick = s.recoil.step(dt);
        s.guard = guardStep(s.guard, !!hit && hit !== h, dt);
        const reloading = now < pw.handReloadUntil(h);
        gunRigStep(s.rig, settings, dt, {
          screenRect: { width: frame?.width ?? 320, height: frame?.height ?? 200 },
          motion: frame?.motion ?? gunMotion({}), look: frame?.look ?? [0, 0],
          flip: pair.flipOf(h, leftHanded), idle: hit !== h,
          shown: !reloading && !sheathed,
          hiddenTarget: sheathed ? feel.sheathTarget : feel.hiddenTarget,
          liveSpeed, cursorActive, swingHeld,
        });
      }
    },
    /** The kick a hand is drawn with this frame: its spring, and its guard's lowering in design pixels (`heightPx` its
     *  drawn height there) - gunFrameRect adds both after the mod's floor, as it adds the single gun's kick. */
    kickOf(h, heightPx, leftHanded = false) {
      const s = hands[h];
      const [, gy] = guardOffset(s.guard, pair.flipOf(h, leftHanded) ? 'left' : 'right', { height: heightPx });
      return { x: s.kick.x, y: s.kick.y + gy };
    },
    /** The reload's two clacks, hand by hand: the open as a hand starts its reload, the close as it comes back up. */
    voice(pw, play) {
      const now = pw.machine.now;
      for (const h of PAIR_HANDS) {
        const s = hands[h], until = pw.handReloadUntil(h);
        if (now >= until) { s.opened = false; s.closed = false; continue; }
        if (!s.opened) { s.opened = true; play('open'); }
        if (!s.closed && now >= until - PAIR_CLOSE_LEAD) { s.closed = true; play('close'); }
      }
    },
    /** Is either pistol still on screen while the pair is put away - the Offset module easing it off the bottom (the
     *  single gun's thunderlockSliding, for two). */
    sliding(feel) {
      return PAIR_HANDS.some((h) => Math.abs(hands[h].rig.offsetCurrent[1]) < Math.abs(feel.sheathTarget[1]) - 1e-3);
    },
    /** The order the hands are drawn in: the striking hand over the other (Two-Hands). */
    order(pw) {
      const hit = striking(pw) ?? pw.leadHand ?? 'R';
      return hit === 'R' ? ['L', 'R'] : ['R', 'L'];
    },
  };
  return pair;
}

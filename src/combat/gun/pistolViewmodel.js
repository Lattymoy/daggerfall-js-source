// THE PISTOL LAB'S FRAME, MOVED - the Dwarven Pistolet's first-person frame, one pistol or a pair (PISTOL-PORT,
// 2026-10-22; the owner: "the integrated sprite pistol doesnt match the prototype 1:1 ... Haven't you learned anything
// from the thunderlock?", then "I want the prototype itself implemented just like we did with thunderlock";
// bible/05-Combat/Dwarven-Pistolet.md "PISTOL-PORT").
//
// FIELD-GUN12's lesson, one gun along: "A prototype is not a specification to copy. It is code to move." The pistol lab
// (pistol-proto.html) composed its frame in its own page - each hand's spring, its guard, its picture, its widget rig, its
// rect, its reload's two clacks - and the game composed one of its own in combat/gun/gunPair.js and weaponRig.js. They
// agreed at rest and parted the moment the pistols moved: run on one script on both, the game kept a reloading pistol
// bobbing that the lab holds still (51 px apart on a 1280x800 screen, a shot while walking), put the lead hand back over
// the hand that fired last, and drew one pistol through the Thunderlock's path. So this is the page's frame - its lines,
// in its order - and the page and the game both run it, on the page's own machines (combat/gun/pistolPair.js).
//
// What the lab has no use for and the game must say, each a declared input and never a second composition: `away` (the
// holster - the lab has no sheath), `flipOf` (the handedness - the lab is right-handed) and the player's own Offset and
// Bob switches (`pistolWidgetSettings` - a mod's switches are the player's, every magnitude the lab's).

import { createGunRig, gunRigStep, gunFrameRect, gunWidgetSettings } from './gunViewmodel.js';
import { createRecoil, PISTOLET_FEEL, RELOAD_CLOSE_LEAD } from './gunFeel.js';
import { guardStep, guardOffset, otherHand } from '../twoHands/handsLaw.js';
import { ALIGN } from '../weapon/weaponAlign.js';

/** The two hands, R then L - the order the page steps them in. */
export const PISTOL_HANDS = Object.freeze(['R', 'L']);

/** Each hand's own state - the page's `rigs`, `recoils`, `guards` and `reloadSfx`, a hand apiece - with the picture and
 *  kick it is drawn with this frame. */
export function createPistolHands() {
  const hand = () => ({
    rig: createGunRig(), recoil: createRecoil(), guard: 0, kick: { x: 0, y: 0 }, frame: 0, firing: false,
    opened: false, closed: false,
  });
  return { R: hand(), L: hand() };
}

/** A shot from hand `h`: its own spring, at the gun's `kick` - the page's `shot`. */
export function pistolHandFired(hands, h, kick) {
  hands[h].recoil.punch(kick);
}

/**
 * ONE FRAME OF THE HANDS - the page's frame(), from its machines to its rigs.
 *
 * `machines` the page's pair (pistolPair.js createPair): each hand's machine as `machines.R` and `machines.L`
 * (`{ state: 'Idle' | 'Firing' | 'Cooling', frame }` - Firing while its six frames play, Cooling while it reloads).
 * `drawn` the hands on screen (`machines.hands()`: one pistol, the lead alone; a pair, both). `spring` the recoil's
 * stiffness, damping and back; `hiddenTarget` the reload lower's target.
 *
 * Per hand, in the page's order: the spring's terms, then THE GUARD (handsLaw - while the other pistol fires and this one
 * does not, a pair only, and never in a volley; or while `lowered(h)` - the game's word that the OTHER hand strikes with
 * no pistol in it: a mixed pair's blade, a spell hand's cast), the spring's step and the picture (the machine's frame while it fires,
 * `restFrame` otherwise). Then each hand's widget rig: Bob and Inertia ONLY while its machine is Idle - a pistol firing or
 * reloading holds still - and the reload lower while it is Cooling. `away` is the game's holster: the same lower, to
 * `awayTarget`.
 */
export function pistolHandsStep(hands, dt, {
  machines, drawn, guard = true, spring, restFrame = 0,
  settings, screenRect, motion, look = [0, 0], liveSpeed = 50, cursorActive = false,
  hiddenTarget, away = false, awayTarget = hiddenTarget, flipOf = (h) => h === 'L', lowered = () => false,
}) {
  const dual = drawn.length === 2;
  for (const h of PISTOL_HANDS) {
    const s = hands[h], m = machines[h], other = machines[otherHand(h)];
    const rc = s.recoil;
    rc.stiff = spring.stiff; rc.damp = spring.damp; rc.back = spring.back;
    s.guard = guardStep(s.guard, (dual && guard && other.state === 'Firing' && m.state !== 'Firing') || (m.state !== 'Firing' && !!lowered(h)), dt);
    s.kick = rc.step(dt);
    s.firing = m.state === 'Firing';
    s.frame = s.firing ? m.frame : restFrame;
  }
  for (const h of PISTOL_HANDS) {
    gunRigStep(hands[h].rig, settings, dt, {
      screenRect, motion, look,
      flip: flipOf(h), idle: machines[h].state === 'Idle',
      shown: machines[h].state !== 'Cooling' && !away, hiddenTarget: away ? awayTarget : hiddenTarget, liveSpeed,
      cursorActive,
    });
  }
  return hands;
}

/**
 * THE RELOAD'S TWO ENDS, hand by hand - the page's: the open as a hand starts its reload, the close RELOAD_CLOSE_LEAD
 * (420 ms) before it is loaded. `play(kind, gain)` with kind 'open' (gain 0.9) or 'close' (0.95).
 */
export function pistolReloadVoice(hands, machines, cooldownMs, play) {
  for (const h of PISTOL_HANDS) {
    const s = hands[h], m = machines[h];
    if (m.state === 'Cooling' && !s.opened) { s.opened = true; play('open', 0.9); }
    if (m.state === 'Cooling' && !s.closed && m.cooledMs >= Math.max(0, (m.cooldownMs ?? cooldownMs) - RELOAD_CLOSE_LEAD * 1000)) { s.closed = true; play('close', 0.95); }   // MIXED-PAIR: the machine's own reload (a gun beside a blade loads one-handed)
    if (m.state !== 'Cooling') { s.opened = false; s.closed = false; }
  }
}

/**
 * WHERE A HAND IS DRAWN - the page's draw block: the guard's lowering, a share of the pistol's own drawn height
 * (`heightPx`, design pixels), added to the hand's kick after the mod's floor, through the game's one gun frame
 * (gunViewmodel.js gunFrameRect) at the art's pose, right-aligned, the left hand in the mirror.
 */
export function pistolHandRect(hands, h, { canvasW, canvasH, anchor, union, widthPct, offset, raise, heightPx, flip = h === 'L' }) {
  const s = hands[h];
  const [, guardY] = guardOffset(s.guard, flip ? 'left' : 'right', { height: heightPx });
  return gunFrameRect({
    canvasW, canvasH, anchor, union, rig: s.rig, kick: { x: s.kick.x, y: s.kick.y + guardY }, flip,
    widthPct, align: ALIGN.Right, offset, raise,
  });
}

/** The order the drawn hands are painted in - the pair's own (`order`, the hand that fired last, last). */
export const pistolDrawOrder = (order, drawn) => order.filter((h) => drawn.includes(h));

/** THE PANEL THE PAGE OPENS ON, as Weapon Widget settings: its three modules on and the owner's Bob and Inertia
 *  (gunFeel.js PISTOLET_FEEL.widget, PISTOL-LAB 2). */
export const PISTOL_PANEL = Object.freeze({
  'Modules.Offset': true, 'Modules.Bob': true, 'Modules.Inertia': true, ...PISTOLET_FEEL.widget,
});

/**
 * THE MODULES' SETTINGS, as the page reads its panel: the mod's declared defaults with the panel over them, past Diverse
 * Weapons' preset (AUDIT PISTOLET B2). `switches` - the game's: the player's own Offset and Bob switches (readWidgetSettings),
 * every magnitude still the panel's; Inertia stays on, the gun's one module departure (gunViewmodel.js).
 */
export function pistolWidgetSettings(panel = PISTOL_PANEL, switches = null) {
  const s = gunWidgetSettings(panel, null, { preset: false });
  return switches ? { ...s, offset: !!switches.offset, bob: !!switches.bob } : s;
}

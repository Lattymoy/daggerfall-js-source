// THE GAME'S PISTOLS ON THE PAGE'S FRAME - one Dwarven Pistolet or a pair, as the rig wires them (PISTOL-PORT, 2026-10-22;
// the owner: "I want the prototype itself implemented just like we did with thunderlock"; bible/05-Combat/Dwarven-Pistolet.md
// "PISTOL-PORT"). It replaces combat/gun/gunPair.js, which composed a pair's frame of its own.
//
// The pistols' machines are the player weapon's (combat/playerWeapon.js `pistols` - the pistol lab's own pair, one
// machine a pistol); each hand's frame is pistol-proto.html's, moved (combat/gun/pistolViewmodel.js). This holds each
// hand's frame state for the rig and says what the game holds where the page has a panel - the player's speed, motion,
// look and cursor, the holster, the handedness, the player's own Offset and Bob switches (HOST-SPLIT: the module the rig
// wires, never grown into the rig).

import {
  PISTOL_HANDS, PISTOL_PANEL, createPistolHands, pistolHandFired, pistolHandsStep, pistolReloadVoice, pistolHandRect,
  pistolDrawOrder, pistolWidgetSettings,
} from './pistolViewmodel.js';
import { muzzleGlow } from './gunFeel.js';
import { gunMotion } from './gunViewmodel.js';
import { handOnLeft } from '../twoHands/handsLaw.js';

/** Is hand `h` drawn on the screen's left: a pair's left hand (a left-handed player's pair is the mirror - handsLaw.js
 *  handOnLeft); one pistol, where DFU draws the one weapon in use - the Handedness setting's side, whichever hand holds it.
 *  MIXED-PAIR: a blade-and-gun pair's one pistol is a hand of a pair (`inPair`, combat/playerWeapon.js _pistolsFor) - drawn
 *  on its own hand's side, the blade on the other. */
const flipFor = (pistols, h, leftHanded) => (pistols.hands().length === 2 || pistols.inPair ? handOnLeft(h, leftHanded) : leftHanded);
/** A pistol's muzzle flash this frame - its machine's, the picture it is drawn with. */
const glowOf = (pistols, h) => muzzleGlow(pistols[h].state === 'Firing', pistols[h].frame);

export function createPistolLane() {
  const hands = createPistolHands();
  let of = null;
  const shots = { R: 0, L: 0 };
  const lane = {
    hands,
    /** Is hand `h` of these pistols drawn on the screen's left (flipFor, above). */
    flipOf: (pistols, h, leftHanded = false) => flipFor(pistols, h, leftHanded),
    /** The pistols that fired since the last frame - each machine's own count of its shots - each punched at the gun's
     *  kick: the page's `shot`. */
    fired(pistols, feel) {
      if (of !== pistols) { of = pistols; shots.R = 0; shots.L = 0; }   // a new pair's machines start at no shots - one pulled before its first frame still sounds
      const out = [];
      for (const h of PISTOL_HANDS) {
        if (pistols[h].shots === shots[h]) continue;
        shots[h] = pistols[h].shots;
        pistolHandFired(hands, h, feel.kick);
        out.push(h);
      }
      return out;
    },
    /** One frame of the hands, the page's (pistolHandsStep) - `frame` the rig's screen, motion and look. */
    step(dt, pistols, { feel, switches = null, frame = null, leftHanded = false, sheathed = false, liveSpeed = 50, cursorActive = false, lowered = () => false }) {
      pistolHandsStep(hands, dt, {
        lowered,   // MIXED-PAIR / SPELL-HAND: the other hand strikes - a blade's blow, a spell's cast - so this pistol lowers (its guard)
        machines: pistols, drawn: pistols.hands(), spring: feel,
        settings: pistolWidgetSettings(PISTOL_PANEL, switches),
        screenRect: { width: frame?.width ?? 320, height: frame?.height ?? 200 }, motion: frame?.motion ?? gunMotion({}), look: frame?.look ?? [0, 0],
        liveSpeed, cursorActive, hiddenTarget: feel.hiddenTarget, away: sheathed, awayTarget: feel.sheathTarget,
        flipOf: (h) => flipFor(pistols, h, leftHanded),
      });
    },
    /** Each pistol's reload, its two clacks - the page's (pistolReloadVoice). */
    voice(pistols, feel, play) { pistolReloadVoice(hands, pistols, feel.reloadMs, play); },
    /** Where hand `h` is drawn - the page's draw block (pistolHandRect), at the art's pose. */
    rect(pistols, h, art, canvas, leftHanded = false) {
      return pistolHandRect(hands, h, {
        canvasW: canvas.width, canvasH: canvas.height, anchor: art.anchor, union: art.unionBox,
        widthPct: art.pose.widthPct, offset: art.pose.offset ?? 0, raise: art.pose.raise, heightPx: art.anchor.h,
        flip: flipFor(pistols, h, leftHanded),
      });
    },
    /** The hands drawn, in the pair's order: the hand that fired last over the other. */
    order: (pistols) => pistolDrawOrder(pistols.order, pistols.hands()),
    /** The room's flash: the brightest drawn pistol's - the page's `glow`. AUDIT PISTOL-PORT B4: read off the machines,
     *  which the frame has already stepped, as the page reads it after its step - the hands' pictures are last frame's
     *  until the lane steps, and the light ran a frame behind the sprite's flame. */
    glow: (pistols) => Math.max(0, ...pistols.hands().map((h) => glowOf(pistols, h))),
    /** AUDIT PISTOL-PORT B4: the hand the room's light is thrown from - the brightest drawn pistol's flash, the last to
     *  fire on a tie (a flurry's second shot lit the room from its side while the first's flame was the bright one). */
    brightest: (pistols) => pistols.hands().reduce((best, h) => (glowOf(pistols, h) > glowOf(pistols, best) ? h : best), pistols.last ?? pistols.lead),
    /** Is a drawn pistol still on screen while they are put away - the Offset module easing it off the bottom. */
    sliding: (pistols, feel) => pistols.hands().some((h) => Math.abs(hands[h].rig.offsetCurrent[1]) < Math.abs(feel.sheathTarget[1]) - 1e-3),
  };
  return lane;
}

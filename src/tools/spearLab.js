// THE SPEAR LAB (the owner, 2026-10-27): the next weapon, a spear, with "left, right and thrust attacks" made "as
// detailed as possible" - judged on its own page before a line of the game changes, the way the guns were
// (Gun-Lab.md, Pistol-Lab.md). Design and record: bible/05-Combat/Spear-Lab.md.
//
// NOTHING HERE TOUCHES THE GAME. No module the game runs imports this file (test/combat/weapon/spearLab.test.js fails
// if one does). The page RUNS the game's own laws, never a copy: the melee machine (weaponStates.js), the swing law
// (SWING-LAW: Speed, the heft by Strength, the handling), the drag's direction (gestureDirection, DIRECTION_TO_STRIKE)
// and the weapon frame with Weapon Widget's Offset, Bob and Inertia (gun/gunViewmodel.js, the guns' own).

import { SPEAR_STRIKES, SPEAR_STRIKE_OF, SPEAR_STAGE, SPEAR_REST_AT } from '../combat/spearStrikes.js';
import {
  createWeaponMachine, machineAttack, machineStep, gestureDirection, MAX_GESTURE_SECONDS, MELEE_NUM_FRAMES,
  swingFrameSeconds, swingHeft, swingHandling,
} from '../characters/weaponStates.js';
import { DIRECTION_TO_STRIKE } from '../characters/anims.js';
import { gunFrameRect } from '../combat/gun/gunViewmodel.js';

export { SPEAR_STRIP, SPEAR_POSE, SPEAR_BLEED, spearFrameSet } from '../combat/spearStrip.js';
export {
  SPEAR_STRIKES, SPEAR_STRIKE_OF, SPEAR_STAGE, SPEAR_REST_AT, SPEAR_AIM, SPEAR_IDLE, SMEAR_GHOSTS, drawSpearFrames,
} from '../combat/spearStrikes.js';
export { CLICK_ATTACK_DIRECTIONS } from '../characters/weaponStates.js';
export { DIRECTION_TO_STRIKE };
export { createGunRig, gunRigStep, gunMotion, gunWidgetSettings } from '../combat/gun/gunViewmodel.js';
export { createSfxPlayer } from './gunLab.js';

/** The swing's voice until the item has DFU's own: the gather lab's synthesised tool swing (public/sfx, ours), the two
 *  takes in turn, at the blow's release - its first smeared frame (spearReleaseFrame). */
export const SPEAR_SWING_SFX = Object.freeze(['gather-swing-1', 'gather-swing-2']);
export const spearReleaseFrame = (key) => SPEAR_STRIKES[key].frames.findIndex((f) => f.smear);

/** The owner's numbers (asked 2026-10-27): 2-15 damage, 4 kg, 60 gold, the Axe skill, two hands on the haft. The lab
 *  swings with the weight and the hands; the rest waits for the item. */
export const SPEAR_ITEM = Object.freeze({ minDamage: 2, maxDamage: 15, weightKg: 4, price: 60, skill: 'Axe', twoHanded: true });
/** The handling it swings with until it has a weapon type of its own: the Staff's (DFU WeaponTypes 2), the other
 *  wooden haft held in two hands. */
export const SPEAR_HANDLING_OF = 2;

/** Each strike state's frame count: the spear's own strike for that state, Idle one. */
export const SPEAR_NUM_FRAMES = Object.freeze(Object.fromEntries(Object.keys(MELEE_NUM_FRAMES).map((s) => [
  s, s === 'Idle' ? 1 : SPEAR_STRIKES[SPEAR_STRIKE_OF[s]].frames.length,
])));

/**
 * A FRAME'S SECONDS. The game's swing law answers one classic frame for a 4 kg two-hander at this Speed and Strength;
 * DFU's strike is five of them. The spear's strike takes exactly that long and is cut finer: its N frames share the
 * five's time, so its hit lands at the same share of the blow (a departure of kind, named in Spear-Lab.md).
 */
export function spearFrameSeconds(state, { speed = 50, strength = 50 } = {}) {
  const classic = swingFrameSeconds(speed, {
    heft: swingHeft(SPEAR_ITEM.weightKg, strength), handling: swingHandling(SPEAR_HANDLING_OF, SPEAR_ITEM.twoHanded),
  });
  return classic * MELEE_NUM_FRAMES.StrikeDown / SPEAR_NUM_FRAMES[state];
}

/** The game's melee machine, its strikes the spear's frames long. */
export function createSpearMachine() {
  const m = createWeaponMachine(false, false);
  m.frames = SPEAR_NUM_FRAMES;
  return m;
}

/** Start a strike (`state` one of the six) as the machine allows - one at a time - with that strike's hit frame. */
export function spearAttack(m, state) {
  if (!SPEAR_STRIKE_OF[state] || !machineAttack(m, state)) return false;
  m.hitFrame = SPEAR_STRIKES[SPEAR_STRIKE_OF[state]].hit;
  return true;
}

/** One step of the machine on the spear's clock. Answers the machine's events ('hit', 'done'). */
export function spearStep(m, dt, { speed = 50, strength = 50 } = {}) {
  if (m.state !== 'Idle') m.tick = spearFrameSeconds(m.state, { speed, strength });
  return machineStep(m, dt, speed);
}

/** Frame `k` of strike `key` ('left', 'right', 'thrust') as drawn: smeared where it has one and `smear`. */
export function spearScrubFrame(drawn, key, k, smear = true) {
  const f = drawn[key][Math.max(0, Math.min(k, drawn[key].length - 1))];
  return { ...f, img: smear && f.smeared ? f.smeared : f.img };
}

/** The drawn frame for the machine's state: the idle, or its strike's frame. */
export const spearFrameOf = (drawn, m, smear = true) => (m.state === 'Idle' ? drawn.idle : spearScrubFrame(drawn, SPEAR_STRIKE_OF[m.state], m.frame, smear));

/** A point of the 320x200 surface (a frame's `tip`) on the screen, inside the stage's drawn rect. */
export const spearScreenPoint = (rect, [x, y], stage = SPEAR_STAGE) => [rect.x + (x + stage.x) * rect.w / stage.w, rect.y + (y + stage.y) * rect.h / stage.h];

/**
 * THE DRAG, as the game reads it (combat/playerWeapon.js gesture, swing mode 0): the trail's travel over the last
 * MAX_GESTURE_SECONDS against the threshold of the longest screen side, the summed motion's angle through
 * gestureDirection and DIRECTION_TO_STRIKE. PlayerWeapon keeps its trail on a class the page cannot carry; this is
 * that trail, and the pin drives both with the same drags.
 */
export function createSpearGesture() { return { now: 0, points: [], x: 0, y: 0, travel: 0, tracking: false }; }
export function spearGestureStep(g, dx, dy, dt, held, longestDim, threshold = 0.005) {
  const clear = () => { g.points.length = 0; g.x = 0; g.y = 0; g.travel = 0; };
  if (!held) { g.tracking = false; clear(); return null; }
  if (!g.tracking) { g.tracking = true; clear(); }
  g.now += dt;
  while (g.points.length && g.now - g.points[0].t > MAX_GESTURE_SECONDS) {
    const p = g.points.shift();
    g.x -= p.dx; g.y -= p.dy; g.travel -= p.mag;
  }
  const mag = Math.hypot(dx, dy);
  g.points.push({ t: g.now, dx, dy, mag });
  g.x += dx; g.y += dy; g.travel += mag;
  if (g.travel / longestDim < threshold) return null;
  const strike = DIRECTION_TO_STRIKE[gestureDirection(Math.atan2(-g.y, g.x) * 180 / Math.PI)];
  clear();
  return strike ?? null;
}

/** The rest frame's own box on the stage - what FPSWeapon's rect seats (the spear where the owner drew it). */
export const stageAnchor = (set, stage = SPEAR_STAGE) => ({
  x: stage.x + SPEAR_REST_AT[0] + set.anchor.x, y: stage.y + SPEAR_REST_AT[1] + set.anchor.y, w: set.anchor.w, h: set.anchor.h,
});

/** Where the page draws the stage: the guns' frame (gunFrameRect - FPSWeapon's rect over the anchor at native size times
 *  `scale`, Weapon Widget's channels over it) with the whole stage as the union. */
export function spearPageRect(rig, set, canvas, { scale = 1, offset = 0, raise = 0 } = {}) {
  const anchor = stageAnchor(set);
  return gunFrameRect({
    canvasW: canvas.width, canvasH: canvas.height, anchor, union: { x: 0, y: 0, w: SPEAR_STAGE.w, h: SPEAR_STAGE.h },
    rig, widthPct: (anchor.w / 320) * scale, offset, raise,
  });
}

/** The panel the page opens on. */
export function spearPageState() {
  return {
    strike: 'left', loop: false, slow: 1, smear: true, trail: false, grid: false,
    scale: 1, offset: 0, raise: 0, speed: 50, strength: 50,
    modBob: true, modInertia: true, walk: false, strafe: 0, run: false, crouch: false,
    room: 0.62,
  };
}

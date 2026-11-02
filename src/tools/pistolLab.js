// THE PISTOL LAB (the owner, 2026-10-21): a NEW WEAPON TYPE - a dwarven
// flintlock pistol that can be dual wielded - prototyped before a line
// of the game changes, the way the Dwarven Thunderlock was ("use the
// same prototype testing we did for the thunderlock").
//
// NOTHING HERE TOUCHES THE GAME. The page is its own (pistol-proto.html),
// over its own art (public/art/pistol-frames.png); no module the game
// runs imports this file, and test/combat/weapon/pistolLab.test.js fails
// if one ever does. Design and record: bible/05-Combat/Pistol-Lab.md.
//
// WHAT IT RUNS rather than restates - the gun lab's lesson (FIELD-GUN12:
// two copies of a frame do not converge by being corrected):
//
//   - the GAME's gun frame, combat/gun/gunViewmodel.js gunFrameRect:
//     FPSWeapon's 320x200 rect (FPSWeapon.cs:378-388) over the anchor
//     box, Weapon Widget's Offset/Bob/Inertia over that, the kick after
//     the mod's floor, the union expansion;
//   - the gun's feel, combat/gun/gunFeel.js: the recoil spring, the
//     trauma shake, the muzzle light's curve;
//   - the gun lab's own machine and sound player (src/tools/gunLab.js),
//     which the Thunderlock was judged on;
//   - and for the PAIR, the game's Two-Hands law
//     (combat/twoHands/handsLaw.js): which hand fires (strikeHandOf, the
//     flurry), the resting hand's guard (guardStep/guardOffset), the
//     mirror - the left hand a right hand in the glass.
//
// What is its OWN is below, and each piece says why a borrowed one would
// not do.

export {
  createGunMachine, muzzleLight, createRecoil, createScreenShake, createWidgetRig, widgetRigStep,
  labWidgetSettings, labMotion, gunFrameRect, ALIGN, SFX_CANDIDATES, createSfxPlayer, contentBox, unionBox,
} from './gunLab.js';
export {
  HANDS_MODE, FLURRY_WINDOW, GUARD, strikeHandOf, guardStep, guardOffset, otherHand,
} from '../combat/twoHands/handsLaw.js';

// THE STRIP AND ITS CUT ARE THE GAME'S NOW (PISTOLET, 2026-10-21). They were written here while this page was the only
// thing that had them; combat/gun/pistolStrip.js is their home since the Dwarven Pistolet became a weapon, and the lab
// reads them from there - gunSheet.js's one-way arrow for the Thunderlock's sheet, one weapon along.
export { PISTOL_STRIP, stripCellRect, hardenAlpha, pistolFrameSet, cropImage, PISTOL_BLEED } from '../combat/gun/pistolStrip.js';   // the leaf combat/gun/pistoletArt.js reads too; PISTOL-EDGE: the frame set both draw
import { PISTOLET_FEEL } from '../combat/gun/gunFeel.js';

/**
 * NATIVE SIZE. The Thunderlock's art was a 1790px painting and had to
 * take its size from a slider (`widthPct`, the gun lab's declared
 * departure). These frames are drawn at Daggerfall's own scale - 88x113,
 * a WEAPON*.CIF record's size - so the classic law applies whole: one
 * art pixel is one pixel of the 320-wide design surface, and `scale` 1
 * is FPSWeapon's own rect. The slider stays, as a multiple of native.
 */
export const nativeWidthPct = (anchorW, scale = 1) => (anchorW / 320) * scale;

/**
 * THE OWNER'S NUMBERS (PISTOL-LAB 2, 2026-10-21), off the lab's panel - "Must be these values/sounds exactly", over two
 * screenshots of it. They are the GAME'S row now (combat/gun/gunFeel.js PISTOLET_FEEL - the Thunderlock's FIELD-GUN6
 * rule: the lab settled them and the game reads them; tuning here is tuning there), and this is the lab's reading of it in
 * the panel's own names, so the page, the probe and the pins still open on one weapon.
 */
export const PISTOL_OPENING = Object.freeze({
  scale: PISTOLET_FEEL.scale, raise: PISTOLET_FEEL.raise, offset: PISTOLET_FEEL.offset,
  fps: PISTOLET_FEEL.fps, reloadMs: PISTOLET_FEEL.reloadMs, hitFrame: PISTOLET_FEEL.hitFrame,
  kick: PISTOLET_FEEL.kick, back: PISTOLET_FEEL.back, stiff: PISTOLET_FEEL.stiff, damp: PISTOLET_FEEL.damp,
  shake: PISTOLET_FEEL.shake, shakeRot: PISTOLET_FEEL.shakeRot, shakeFreq: PISTOLET_FEEL.shakeFreq, shakeDecay: PISTOLET_FEEL.shakeDecay,
  drop: PISTOLET_FEEL.hiddenTarget[1], alphaCut: PISTOLET_FEEL.alphaCut,
  sfxFire: PISTOLET_FEEL.sfx.fire, sfxOpen: PISTOLET_FEEL.sfx.open, sfxClose: PISTOLET_FEEL.sfx.close,
  sfxVol: PISTOLET_FEEL.sfxVolume, sfxVary: PISTOLET_FEEL.sfxVary,
  widget: PISTOLET_FEEL.widget,
  light: PISTOLET_FEEL.flashLight,   // AUDIT PISTOLET B5: the muzzle light's opening, the feel's own
});

// PISTOL-PORT: THE FRAME IS THE GAME'S NOW (combat/gun/pistolViewmodel.js) - each hand's spring, guard, picture, rig, rect
// and reload clacks, the draw order and the panel's settings - FIELD-GUN12's arrow: the page runs it, never restates it.
export {
  PISTOL_HANDS, PISTOL_PANEL, createPistolHands, pistolHandFired, pistolHandsStep, pistolReloadVoice, pistolHandRect,
  pistolDrawOrder, pistolWidgetSettings,
} from '../combat/gun/pistolViewmodel.js';
// PISTOL-PORT: THE PAIR IS THE GAME'S NOW (combat/gun/pistolPair.js) - the Dwarven Pistolet fires on it - and the page
// reads it back from there.
export { PAIR_TRIGGER, createPair } from '../combat/gun/pistolPair.js';

// AUDIT PISTOL-PORT D7: THE PAGE'S WIRING, IN A MODULE. The page composes no frame, but it does say what its panel feeds
// the game's: and while that lived in the page's own <script>, nothing the suite runs could see it - the port's pins ran
// a transcription of it, and a page that stopped guarding, clacked the wrong clip or dipped to the wrong depth passed.
// So the page's opening state and the three calls it makes from its panel are here, and the page and the port's pins
// both run them.
import { SFX_CANDIDATES } from './gunLab.js';
import { gunMotion } from '../combat/gun/gunViewmodel.js';
import { pistolHandsStep, pistolReloadVoice, pistolHandRect, pistolWidgetSettings } from '../combat/gun/pistolViewmodel.js';
import { PAIR_TRIGGER } from '../combat/gun/pistolPair.js';
import { JUMP_SPEED, GRAVITY } from '../player/motor.js';

/** The panel the page opens on, as its `state`: every number the opening row's (PISTOL_OPENING), each sound pick proven
 *  among the candidates. */
export function pistolPageState() {
  const O = PISTOL_OPENING, W = O.widget;
  const pickOf = (slot, name) => {
    if (!SFX_CANDIDATES[slot].some(([n]) => n === name)) throw new Error(`no ${slot} clip ${name}`);
    return name;
  };
  return {
    trigger: PAIR_TRIGGER.Alternate, lead: 'R', guard: true,
    scale: O.scale, offset: O.offset, raise: O.raise,
    fps: O.fps, cool: O.reloadMs, hit: O.hitFrame, auto: false,
    kick: O.kick, back: O.back, stiff: O.stiff, damp: O.damp,
    shake: O.shake, shakeRot: O.shakeRot, shakeFreq: O.shakeFreq, shakeDecay: O.shakeDecay,
    sfxFire: pickOf('fire', O.sfxFire), sfxOpen: pickOf('reload-open', O.sfxOpen), sfxClose: pickOf('reload-close', O.sfxClose),
    sfxVol: O.sfxVol, sfxVary: O.sfxVary, sfxOn: true,
    drop: O.drop, offsetSpeed: W['Offset.Speed'], modOffset: true,
    modBob: true, bobLength: W['Bob.Length'], bobSizeX: W['Bob.SizeX'], bobSizeY: W['Bob.SizeY'],
    bobSpeedMove: W['Bob.SpeedMove'], bobSpeedState: W['Bob.SpeedState'], bobShape: W['Bob.Shape'], bobIdle: W['Bob.BobWhileIdle'],
    modInertia: true, inScale: W['Inertia.Scale'], inSpeed: W['Inertia.Speed'], inFwd: W['Inertia.ForwardDepth'], inFwdSpeed: W['Inertia.ForwardSpeed'],
    walk: false, strafe: 0, run: false, crouch: false, spd: 50,
    alphaCut: O.alphaCut, light: O.light, room: 0.62, grid: false,
  };
}

/** The panel's Weapon Widget settings - past Diverse Weapons' preset, as the game lays the Pistolet's own (AUDIT
 *  PISTOLET B2; pistolViewmodel.js pistolWidgetSettings). */
export const pistolPageSettings = (state) => pistolWidgetSettings({
  'Modules.Offset': state.modOffset, 'Modules.Bob': state.modBob, 'Modules.Inertia': state.modInertia,
  'Offset.Speed': state.offsetSpeed,
  'Bob.Length': state.bobLength, 'Bob.SizeX': state.bobSizeX, 'Bob.SizeY': state.bobSizeY,
  'Bob.SpeedMove': state.bobSpeedMove, 'Bob.SpeedState': state.bobSpeedState,
  'Bob.Shape': state.bobShape, 'Bob.BobWhileIdle': state.bobIdle,
  'Inertia.Scale': state.inScale, 'Inertia.Speed': state.inSpeed,
  'Inertia.ForwardDepth': state.inFwd, 'Inertia.ForwardSpeed': state.inFwdSpeed,
});

/** AUDIT PISTOL-PORT B1: a jump as the game's motor makes one - the eye's climb `t` seconds in (JUMP_SPEED up, GRAVITY
 *  down), null once it has landed. */
export const pistolJumpClimb = (t) => (t >= 0 && t < 2 * JUMP_SPEED / GRAVITY ? JUMP_SPEED - GRAVITY * t : null);

/** ONE FRAME OF THE PAGE'S HANDS: each hand's reload clacks, then the game's frame (pistolHandsStep), fed from the panel -
 *  `play(clip, gain)` the page's player. Answers the motion, which the page's room sways on too. */
export function pistolPageStep(hands, pair, state, dt, { drawn, scrub = -1, look = [0, 0], cursorActive = false, screen, vertical = null, play = () => {} }) {
  pistolReloadVoice(hands, pair, state.cool, (kind, gain) => play(kind === 'open' ? state.sfxOpen : state.sfxClose, gain));
  const motion = gunMotion({ walking: state.walk, strafe: Number(state.strafe), running: state.run, crouching: state.crouch, liveSpeed: state.spd, vertical });
  pistolHandsStep(hands, dt, {
    machines: pair, drawn, guard: state.guard, spring: { stiff: state.stiff, damp: state.damp, back: state.back },
    restFrame: scrub >= 0 ? scrub : 0, settings: pistolPageSettings(state), screenRect: screen,
    motion, look, liveSpeed: state.spd, cursorActive, hiddenTarget: [0, state.drop],
  });
  return motion;
}

/** Where the page draws hand `h`: the game's rect (pistolHandRect) at the panel's pose, the art at native size times the
 *  panel's scale, the left hand in the mirror. */
export const pistolPageRect = (hands, h, state, art, canvas) => pistolHandRect(hands, h, {
  canvasW: canvas.width, canvasH: canvas.height, anchor: art.anchor, union: art.union,
  widthPct: nativeWidthPct(art.anchor.w, state.scale), offset: state.offset, raise: state.raise,
  heightPx: art.anchor.h * state.scale, flip: h === 'L',
});

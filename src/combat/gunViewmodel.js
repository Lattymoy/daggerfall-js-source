// THE DWARVEN THUNDERLOCK'S VIEWMODEL FRAME - the prototype's own,
// moved rather than reconciled.
//
// FIELD-GUN12 (2026-09-19, Mac, the sixth time: "Port the god damn
// prototype verbatim").
//
// HE IS RIGHT, AND THE FIVE ROUNDS BEFORE THIS ONE ARE THE ARGUMENT.
// The lab composed its frame one way and the game composed it another,
// and every round was me making the two AGREE about one more thing:
// the size, the raise, the frame clock, the cooldown, the hit frame,
// the volume, the pitch, a module's switch, the units of an offset,
// which box the transform is applied to. Each fix was correct. The
// approach was not. Two implementations of one thing do not converge
// by being corrected; they converge by becoming one implementation.
//
// So this is `gun-proto.html`'s draw block, lifted whole, and BOTH
// sides call it. The lab is no longer a thing the game resembles - it
// is a thing the game runs. There is no longer a list of numbers that
// have to match, because there are no longer two places for them to
// differ.
//
// WHAT THIS DELIBERATELY BYPASSES, and why that is not a regression:
// for THIS WEAPON the rig stops going through `drawFpsWeapon` and
// through Weapon Widget's clone, and calls this instead. Both of
// those are 1:1 ports of DFU and of RedRoryOTheGlen's mod, written
// for weapons those two things have - and this weapon is neither's.
// It still RUNS the mod's three modules (Offset, Bob, Inertia are
// imported below, not imitated), on the mod's own settings, which is
// what the lab always did. What it does not do is hand a gun to a
// rect-builder written for a CIF record and then spend five rounds
// making the answer come back right.
//
// Every classic weapon is untouched: nothing here is reachable except
// through the Thunderlock's own arm in weaponRig.js.

import { placeSprite } from './gunPlacement.js';
import { unionDrawRect } from './gunSheet.js';
import {
  readWidgetSettings, offsetStep, bobStep, inertiaStep, widgetTransformRect,
} from './weaponWidgetMotion.js';
import { MOD_SETTINGS } from '../systems/modSettings.js';
import { WEAPON_WIDGET_VENDOR } from './weaponWidgetMotion.js';
import { GUN_FEEL } from './gunFeel.js';
import { ALIGN } from './weaponAlign.js';
import { walkSpeed, runSpeed } from '../player/motor.js';

/** FPSWeaponClone's .ctor fields, the ones the three modules carry
 *  between frames. The lab's `createWidgetRig`, verbatim. */
export function createGunRig() {
  return {
    time: 0,
    position: [0, 0], scale: [1, 1], offset: [0, 0],
    offsetCurrent: [0, 0], offsetTarget: [0, 0],
    moveSmooth: 0, bobSmooth: [0, 0],
    inertiaCurrent: [0, 0], inertiaTarget: [0, 0], inertiaSpeedMod: 1,
    inertiaForwardCurrent: [0, 0], inertiaForwardTarget: [0, 0],
  };
}

/** The mod's DECLARED defaults, as its store would answer them. */
export function widgetDefaults() {
  const keys = MOD_SETTINGS[WEAPON_WIDGET_VENDOR].keys;
  const out = {};
  for (const k of Object.keys(keys)) out[k] = keys[k].default;
  return out;
}

/**
 * The settings the gun's modules run on.
 *
 * TWO CALLERS, ONE FUNCTION, and the difference between them is
 * honest rather than accidental:
 *   - the GAME passes nothing and gets the PLAYER's own settings,
 *     because a mod's switches are theirs;
 *   - the LAB passes its panel, and gets the mod's declared defaults
 *     with those on top, because a lab has no player to ask.
 *
 * Both take INERTIA ON, which is the gun's one declared module
 * departure: the mod ships it off ("requires double-scaled weapon
 * textures") and this art is exactly the case that warning names.
 * Everything rides `readWidgetSettings`, the mod's own reader, so
 * every multiplier it applies is applied here too.
 *
 * DISC14-B: and the inertia the gun turns on runs at the mod's own
 * shipped scale (GUN_INERTIA_SCALE). The port's default Inertia.Scale
 * is 0 now (Mac's defaults for Diverse Weapons, with the module off),
 * and a scale set for a module the player left off is not a word
 * about the gun. A player who turns the module ON gets their own.
 */
export const GUN_INERTIA_SCALE = 1.0;   // vendor/weapon-widget/modsettings.json, Inertia.Scale's shipped Value
export function gunWidgetSettings(overrides = null) {
  if (overrides) return readWidgetSettings(() => ({ ...widgetDefaults(), 'Modules.Inertia': true, 'Inertia.Scale': GUN_INERTIA_SCALE, ...overrides }));
  const s = readWidgetSettings();
  return s.inertia ? s : { ...s, inertia: true, inertiaScale: readWidgetSettings(() => ({ 'Inertia.Scale': GUN_INERTIA_SCALE })).inertiaScale };
}

/**
 * One frame of the three modules, in the component's own order -
 * Offset, then Bob, then Inertia - writing the same three channels
 * the clone publishes. The lab's `widgetRigStep`, verbatim.
 *
 * `idle` is the machine's Idle, which is what the mod gates Bob and
 * Inertia on; `shown` false is the reload lower.
 */
export function gunRigStep(rig, s, dt, {
  screenRect, motion, look = [0, 0], flip = false, idle = true,
  shown = true, hiddenTarget = GUN_FEEL.hiddenTarget, liveSpeed = 50,
  cursorActive = false, swingHeld = false,
}) {
  rig.time += dt;
  rig.position = [0, 0]; rig.scale = [1, 1]; rig.offset = [0, 0];
  if (s.offset) {
    const o = offsetStep({
      offsetCurrent: rig.offsetCurrent, offsetTarget: rig.offsetTarget,
      animating: false, shown, equipCountdown: 0, hiddenTarget,
    }, dt, liveSpeed / 100 * s.offsetSpeed);   // get_offsetSpeedLive
    rig.offsetCurrent = o.offsetCurrent; rig.offsetTarget = o.offsetTarget;
    rig.offset = [rig.offset[0] + o.delta[0], rig.offset[1] + o.delta[1]];
  }
  if (s.bob && idle) {
    const b = bobStep({ moveSmooth: rig.moveSmooth, bobSmooth: rig.bobSmooth, time: rig.time, screenRect }, s, motion, dt);
    rig.moveSmooth = b.moveSmooth; rig.bobSmooth = b.bobSmooth;
    rig.position = [rig.position[0] + b.delta[0], rig.position[1] + b.delta[1]];
  }
  if (s.inertia && idle) {
    const i = inertiaStep({
      inertiaCurrent: rig.inertiaCurrent, inertiaTarget: rig.inertiaTarget,
      inertiaForwardCurrent: rig.inertiaForwardCurrent, inertiaForwardTarget: rig.inertiaForwardTarget,
      screenRect, flip, look, cursorActive, swingHeld,
    }, s, motion, dt);
    rig.inertiaCurrent = i.inertiaCurrent; rig.inertiaTarget = i.inertiaTarget; rig.inertiaSpeedMod = i.inertiaSpeedMod;
    rig.inertiaForwardCurrent = i.inertiaForwardCurrent; rig.inertiaForwardTarget = i.inertiaForwardTarget;
    rig.scale = [rig.scale[0] + i.scale[0], rig.scale[1] + i.scale[1]];
    rig.position = [rig.position[0] + i.delta[0], rig.position[1] + i.delta[1]];
  }
  return rig;
}

/**
 * THE MOTOR'S FRAME, as the rig assembles it for the clone -
 * baseSpeed from GetBaseSpeed's walk arm, speedRatio the live speed
 * over it, and localVel the eye's motion in the body's frame (right,
 * up, forward). The lab's `labMotion`, kept so the LAB can still
 * drive this without a motor; the game passes its real one.
 */
export function gunMotion({ walking = false, running = false, crouching = false, liveSpeed = 50, strafe = 0 } = {}) {
  const base = walkSpeed(liveSpeed);
  const speed = walking ? (running ? runSpeed(liveSpeed, 50, crouching) : base) : 0;
  return {
    grounded: true, crouching, riding: false, standing: !walking,
    speedRatio: base > 0 ? speed / base : 1,
    baseSpeed: base,
    localVel: [strafe * speed, 0, walking ? speed : 0],
  };
}

/**
 * THE FRAME'S RECT - gun-proto.html's draw block, verbatim.
 *
 * FPSWeapon's rect over the ANCHOR box, then the mod's three channels
 * over that, then the gun's own kick - which has to come AFTER,
 * because the mod's transform ends in a floor the rect may never rise
 * above and a gun's kick rises. Then the union expansion, so the gun
 * lands where it was aligned and the flash overflows around it.
 *
 * Answers both rects: `rect` is what the full image is drawn at,
 * `anchorRect` is the gun's own box inside it (what a caller wants
 * if it is placing something ON the weapon).
 */
export function gunFrameRect({
  canvasW, canvasH, anchor, union, rig, kick = { x: 0, y: 0 }, flip = false,
  widthPct = GUN_FEEL.widthPct, align = ALIGN.Right, offset = 0, raise = GUN_FEEL.raise,
}) {
  // Under the mirror the whole composite flips, so the gun's box flips
  // with it inside the union box - otherwise the flash would swap
  // sides and drag the weapon off its alignment.
  const anc = flip
    ? { ...anchor, x: 2 * union.x + union.w - anchor.x - anchor.w }
    : anchor;
  const offsetHeight = raise * (canvasH / 200);
  const base = placeSprite({
    canvasW, canvasH, frameW: anchor.w, frameH: anchor.h,
    widthPct, align, offset, flip, offsetHeight,
  });
  const anchorRect = widgetTransformRect(base, {
    position: rig.position, scale: rig.scale, offset: rig.offset,
    flip, screenHeight: canvasH, weaponOffsetHeight: offsetHeight,
  });
  const sx = canvasW / 320, sy = canvasH / 200;
  anchorRect.x += kick.x * sx * (flip ? -1 : 1);
  anchorRect.y += kick.y * sy;
  return { rect: unionDrawRect(anchorRect, anc, union), anchorRect };
}

// FPSWeaponClone WITHOUT UNITY: the mod's settings, its three movement
// modules and the transform they feed - the parts of Weapon Widget 1.6
// that are arithmetic rather than component.
//
// WW-LAB (2026-09-19). They were inline in combat/weaponWidget.js and
// the arithmetic is UNTOUCHED - every line here is the line that was
// there, in the order it was in; the component imports them back and
// calls them where it used to do the work itself.
//
// TWO reasons they are their own file rather than four more exports on
// a 900-line component:
//
//   - THE GUN LAB RUNS THEM. src/tools/gunLab.js prototypes a weapon
//     this game does not have, and "the idle and bob our weapon mods
//     give us" is a thing a prototype has to SHOW. A second copy of a
//     bob pinned to an IL offset would be a second copy to drift.
//   - THE COMPONENT IS EXPENSIVE TO IMPORT. weaponWidget.js reaches
//     the inventory, the equip tables and the texture bundles, and
//     through them a vendored mod's mesh folder - four megabytes of
//     .nif the lab has no use for. These four functions need one
//     import between them.
//
// Nothing here knows about the lab; the arrow points one way.

import { modSettingsOf } from '../systems/modSettings.js';
import { withDiverseWeaponsPreset } from './diverseWeapons.js';   // DW1

export const WEAPON_WIDGET_VENDOR = 'weapon-widget';

/** The modsettings' choices, by index. */
export const WINDUP = Object.freeze({ Hide: 0, Idle: 1, FirstFrame: 2 });
export const RECOVERY = Object.freeze({ Hide: 0, LastFrame: 1 });
export const BOB_SHAPE = Object.freeze({ U: 0, Sideways8: 1, InvertedU: 2 });
export const STEP_CONDITION = Object.freeze({ SheatheAttackOnly: 0, AllTransforms: 1 });
export const RECOIL_CONDITION = Object.freeze({ HitsOnly: 0, HitsAndParries: 1, ParriesOnly: 2, ParriesAndMisses: 3, MissesOnly: 4, AllAttacks: 5 });
export const MISS_VFX_AT = Object.freeze({ Target: 0, Crosshair: 1 });

// ---- LoadSettings (IL 0x724-0xb7f): the fields, with the mod's own multipliers ----
/** The clone's settings fields from the store, exactly as LoadSettings
 *  derives them (Offset.Speed x10, Bob.Length /100, SizeX/Y x2,
 *  SpeedMove x4, SpeedState x500, Shape x0.5, Inertia.Scale/Speed x500,
 *  ForwardDepth/ForwardSpeed x0.2, Recoil.Chance /100). */
export function readWidgetSettings(read = () => modSettingsOf(WEAPON_WIDGET_VENDOR)) {
  const s = withDiverseWeaponsPreset(read());   // DW1: the mod's preset over the player's values while its switch is on
  return {
    enabled: !!s.Enabled,
    swing: !!s['Modules.Swings'], ambidexterity: !!s['Modules.Ambidexterity'], bob: !!s['Modules.Bob'], offset: !!s['Modules.Offset'],
    stepTransforms: !!s['Modules.Step'], inertia: !!s['Modules.Inertia'], doubleScale: !!s['Modules.DoubleScaleTextures'],
    trueSize: !!s['Modules.TrueTextureSize'], recoil: !!s['Modules.Recoil'],
    swingWindup: s['Swings.Windup'] | 0, swingRecovery: s['Swings.Recovery'] | 0, swingSpeed: Number(s['Swings.Speed']),
    swingAlignmentOverride: !!s['Swings.VanillaAlignmentOverride'], swingRecoveryOverride: !!s['Swings.VanillaRecoveryOverride'],
    swingNoDaggerRight: !!s['Swings.NoDaggerMirroredStrikes'],
    offsetSpeed: Number(s['Offset.Speed']) * 10,
    bobLength: (s['Bob.Length'] | 0) / 100, bobOffset: Number(s['Bob.Offset']),
    bobSizeXMod: Number(s['Bob.SizeX']) * 2, bobSizeYMod: Number(s['Bob.SizeY']) * 2,
    moveSmoothSpeed: Number(s['Bob.SpeedMove']) * 4, bobSmoothSpeed: Number(s['Bob.SpeedState']) * 500,
    bobShape: (s['Bob.Shape'] | 0) * 0.5, bobWhileIdle: !!s['Bob.BobWhileIdle'],
    inertiaScale: Number(s['Inertia.Scale']) * 500, inertiaSpeed: Number(s['Inertia.Speed']) * 500,
    inertiaForwardScale: Number(s['Inertia.ForwardDepth']) * 0.2, inertiaForwardSpeed: Number(s['Inertia.ForwardSpeed']) * 0.2,
    stepLength: s['Step.Length'] | 0, stepCondition: s['Step.Condition'] | 0,
    recoilChance: (s['Recoil.Chance'] | 0) / 100, recoilCondition: s['Recoil.Condition'] | 0,
    recoilEnvironment: !!s['Recoil.DetectEnvironment'], playMissVFXEntity: !!s['Recoil.PlayEntityMissEffects'],
    playMissVFXEnvironment: !!s['Recoil.PlayEnvironmentMissEffects'], playMissVFXPos: s['Recoil.MissEffectPlacement'] | 0,
    mirrorBows: !!s['Miscellaneous.MirrorBows'], mirrorTwoHandedSwords: !!s['Miscellaneous.MirrorTwoHandedSwords'],
    mirrorTwoHandedAxes: !!s['Miscellaneous.MirrorTwoHandedAxes'], mirrorTwoHandedBlunts: !!s['Miscellaneous.MirrorTwoHandedBlunts'],
    textureScaleFactor: Math.max(1, s['TrueTextureSize.TextureScaleFactor'] | 0),
  };
}

// ---- Unity's arithmetic, the pieces the mod calls ----
export const moveTowards = (a, b, maxDelta) => (Math.abs(b - a) <= maxDelta ? b : a + Math.sign(b - a) * maxDelta);
export function moveTowards2(a, b, maxDelta) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const d = Math.hypot(dx, dy);
  if (d <= maxDelta || d === 0) return [b[0], b[1]];
  return [a[0] + dx / d * maxDelta, a[1] + dy / d * maxDelta];
}
/** Mathf.Round: half to even. */
export const roundHalfEven = (v) => { const f = Math.floor(v); const r = v - f; if (r > 0.5) return f + 1; if (r < 0.5) return f; return f % 2 === 0 ? f : f + 1; };
/** Snapping.Snap(value, interval): Round(value / interval) * interval. */
export const snap = (v, interval) => (interval > 0 ? roundHalfEven(v / interval) * interval : v);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// ---- THE THREE MOVEMENT MODULES, AND THE RECT THEY MOVE ----
//
// WW-LAB (2026-09-19): Offset, Bob and Inertia, and GetWeaponRect's
// transform, lifted OUT of lateUpdate as pure functions. The
// arithmetic is untouched - every line below is the line that was
// inline, in the order it was in - and the component calls these where
// it used to do the work itself.
//
// The reason they are exported rather than merely tidier: the gun lab
// (src/tools/gunLab.js) prototypes a weapon this game does not have,
// and "the idle and bob the mod gives our weapons" is a thing a
// prototype has to SHOW, not approximate. A second copy of a bob
// pinned to an IL offset would be a second copy to drift; the lab runs
// THESE. Nothing about the component's behaviour changes, and the lab
// is still a one-way reader - no module the game runs imports it.

/** Offset (IL 0x1cd9-0x1dc5): off screen while hidden or equipping,
 *  back when shown, eased by the live speed. `offsetSpeedLive` is
 *  get_offsetSpeedLive's answer (LiveSpeed / 100 * Offset.Speed).
 *  Answers the next current/target and the offset delta - the channel
 *  is in units of the sprite's own rect, so [0, 2] is two sprite
 *  heights DOWN, which is how the mod takes a sheathed weapon off the
 *  bottom of the screen. */
export function offsetStep({
  offsetCurrent, offsetTarget, animating = false, shown = true, equipCountdown = 0,
  // The mod's own hidden target is [2, 2] and the component never passes
  // anything else. It is a parameter so a CALLER can slide the sprite
  // somewhere else through this same easing - the gun lab lowers the
  // weapon straight down for a reload it has no animation for.
  hiddenTarget = [2, 2],
}, dt, offsetSpeedLive) {
  let target = offsetTarget, current = offsetCurrent;
  if (!animating) {
    target = shown ? [0, 0] : hiddenTarget;
    if (equipCountdown > 0) { target = [...hiddenTarget]; current = [...hiddenTarget]; }
  }
  current = moveTowards2(current, target, dt * offsetSpeedLive);
  return { offsetCurrent: current, offsetTarget: target, delta: current };
}

/** Bob (IL 0x1dca-0x1fbb): the sprite sways as you walk. `m` is the
 *  motor's frame (grounded, crouching, riding, standing, speedRatio,
 *  baseSpeed), `screenRect` the canvas, `time` the component's clock.
 *  `doubleScaleIdle` is the mod's `doubleScale && state == Idle` arm,
 *  which moves the bob's rest corner. Answers the next moveSmooth and
 *  bobSmooth, and the position delta (screen pixels). */
export function bobStep({ moveSmooth, bobSmooth, time, screenRect, doubleScaleIdle = false }, s, m, dt) {
  const shape = s.bobShape;
  const moveMul = m.grounded === false ? 0 : 1;
  const nextMove = moveTowards(moveSmooth, moveMul, dt * s.moveSmoothSpeed);
  let sp = Number.isFinite(m.speedRatio) ? m.speedRatio : 1;
  if (m.crouching) sp *= 0.5;
  if (m.riding) sp *= 0.5;
  if (m.standing) sp = s.bobWhileIdle ? 0.1 : 0;
  const baseSpeed = Number.isFinite(m.baseSpeed) ? m.baseSpeed : 1;
  const rate = baseSpeed * 1.25 * sp * s.bobLength;
  const rate2 = rate * 2;
  const amp = 0.01;
  const size = [screenRect.width * amp * sp * s.bobSizeXMod, screenRect.height * amp * sp * s.bobSizeYMod];
  let xMin = -1, yMax = 1;
  if (doubleScaleIdle) { xMin = 0; yMax = 0; }
  const target = [
    (xMin + Math.sin(s.bobOffset + time * rate)) * -size[0],
    (yMax - Math.sin(s.bobOffset + shape + time * rate2)) * size[1],
  ];
  const eased = moveTowards2(bobSmooth, target, dt * s.bobSmoothSpeed);
  const next = [eased[0] * nextMove, eased[1] * nextMove];
  return { moveSmooth: nextMove, bobSmooth: next, delta: next };
}

/** Inertia (IL 0x1fc0-0x2243): the look and the body's motion lag the
 *  sprite, and forward motion scales it. Answers both pairs, the speed
 *  modifier the pins read, the position delta (screen pixels) and the
 *  scale delta. */
export function inertiaStep({
  inertiaCurrent, inertiaTarget, inertiaForwardCurrent, inertiaForwardTarget,
  screenRect, flip = false, look = [0, 0], cursorActive = false, swingHeld = false,
}, s, m, dt) {
  const lv = m.localVel ?? [0, 0, 0];
  const mx = clamp(lv[0] / 10, -1, 1);
  const my = m.grounded === false ? clamp(lv[1] / 10, -1, 1) : 0;
  const mz = clamp(lv[2] / 10, -1, 1);
  const sign = flip ? -1 : 1;
  let target;
  if (!cursorActive && swingHeld) target = [-mx * 0.5 * s.inertiaScale, 0];
  else target = [(look[0] + mx) * sign * 0.5 * -s.inertiaScale, (look[1] + my) * 0.5 * s.inertiaScale];
  const speedMod = s.inertiaScale > 0 ? Math.hypot(inertiaCurrent[0] - target[0], inertiaCurrent[1] - target[1]) / s.inertiaScale : 0;
  let speedMul = (target[0] !== 0 || target[1] !== 0) ? 3 : 1;
  const current = moveTowards2(inertiaCurrent, target, dt * s.inertiaSpeed * speedMod * speedMul);
  speedMul = (inertiaForwardTarget[0] !== 0 || inertiaForwardTarget[1] !== 0) ? 3 : 1;
  const fwdTarget = [mz * s.inertiaForwardScale, mz * s.inertiaForwardScale];
  const fwdCurrent = moveTowards2(inertiaForwardCurrent, fwdTarget, dt * s.inertiaForwardSpeed * speedMul);
  const k = screenRect.width * 0.25;
  return {
    inertiaCurrent: current, inertiaTarget: target, inertiaSpeedMod: speedMod,
    inertiaForwardCurrent: fwdCurrent, inertiaForwardTarget: fwdTarget,
    delta: [current[0] - fwdCurrent[0] * k, current[1] - fwdCurrent[1] * k],
    scale: fwdCurrent,
  };
}

/** GetWeaponRect (IL 0x1590), over any base rect: Position (mirrored
 *  for a flipped sprite), Scale (not for the werecreature), Offset in
 *  the rect's own size, the Step snap on the 320x200 grid's eighths,
 *  and the floor - the rect never rises above its resting place. */
export function widgetTransformRect(base, {
  position = [0, 0], scale = [1, 1], offset = [0, 0],
  flip = false, scaleIt = true, withOffset = true,
  stepInterval = 0, screenHeight, weaponOffsetHeight: offH = 0,
} = {}) {
  const r = { x: base.x, y: base.y, w: base.w, h: base.h };
  if (flip) r.x -= position[0]; else r.x += position[0];
  r.y += position[1];
  if (scaleIt) { r.w *= scale[0]; r.h *= scale[1]; }
  if (withOffset) {
    if (flip) r.x -= r.w * offset[0]; else r.x += r.w * offset[0];
    r.y += r.h * offset[1];
  }
  if (stepInterval > 0) {
    r.x = snap(r.x, stepInterval);
    r.y = snap(r.y, stepInterval);
  }
  r.y = clamp(r.y, screenHeight - r.h - offH, screenHeight);
  return r;
}


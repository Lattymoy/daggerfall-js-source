// DISC16 (2026-09-24, Mac). bible/01-Overview/Field-Bugs-2026-09-23.md, DISC16.
//
// ── DISC16-A: "I notice my character is sunken into the ground on hills" ──
// DFU's body is Unity's CharacterController, a capsule, and a capsule on a slope rests on its rounded bottom: the
// sphere's centre stands r / cos(grade) over the ground beneath it, so its lowest point - the feet, where the
// third-person body is placed - stands r (1 / cos - 1) over that ground. The collider's terrain floor took the ground
// beneath the centre as the feet, so on a hill every body stood lower than DFU's (5 cm at 30 degrees, 15 at 45, 35 at
// 60) and the body's uphill foot went into the slope.
//
// ── DISC16-B: "Weapon widget preset needs to be defaulted on with diverse weapons and the changes we made to the
// values for the weapon widget reverted", then "I just want it how it was before diverse weapons" ──
// The weapons move as they did before the mod: its preset off by default, as at DW1, and Weapon Widget at the mod's own
// shipped defaults (DISC14-B's two departures reverted). The mod itself stays on (MO1: every mod ships on) - it picks
// the sprite, never the motion. A player may still turn the preset on.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { PlayerMotor, CAPSULE_RADIUS } from '../src/player/motor.js';
import { Collider } from '../src/player/collider.js';
import { modSettingsOf, setModSetting, _resetModSettings } from '../src/systems/modSettings.js';
import { readWidgetSettings, WEAPON_WIDGET_VENDOR } from '../src/combat/weaponWidget.js';
import { diverseWeaponsPresetOn, moddedWeaponHUDAnimsEnabled } from '../src/combat/diverseWeapons.js';
import { gunWidgetSettings } from '../src/combat/gunViewmodel.js';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const rad = (deg) => deg * Math.PI / 180;
const stand = { forward: 0, strafe: 0, run: false, jump: false, up: false, down: false };
const walk = { ...stand, forward: 1 };

/** A body stood on a plane of `deg` grade (rising along +z) by the real motor and collider, then walked. */
function onSlope(deg, input = stand, steps = 120) {
  const g = Math.tan(rad(deg));
  const ground = (x, z) => g * z;
  const m = new PlayerMotor(new Collider(ground));
  m.pos = [0, 0, 0]; m.grounded = true;
  for (let i = 0; i < steps; i++) m.update(1 / 60, input, 0);
  return { m, lift: m.pos[1] - ground(m.pos[0], m.pos[2]) };
}

test('DISC16-A: on a slope the capsule rests on its rounded bottom, as DFU\'s CharacterController does - its feet r(1/cos - 1) over the ground beneath its centre; flat ground unchanged (mutants: the floor back to the point beneath the centre; the grade taken as its sine)', () => {
  for (const deg of [0, 20, 30, 45, 60]) {
    const want = CAPSULE_RADIUS * (1 / Math.cos(rad(deg)) - 1);
    const standing = onSlope(deg);
    assert.ok(Math.abs(standing.lift - want) < 1e-6, `${deg} degrees standing: the feet ${standing.lift.toFixed(4)} over the ground, DFU's capsule ${want.toFixed(4)}`);
    const walking = onSlope(deg, walk, 240);
    assert.ok(Math.abs(walking.lift - want) < 1e-6, `${deg} degrees walking up: ${walking.lift.toFixed(4)}, not below ${want.toFixed(4)}`);
  }
  assert.ok(CAPSULE_RADIUS * (1 / Math.cos(rad(45)) - 1) > 0.14, 'fifteen centimetres at 45 degrees - the body the report saw sunk');
  // a hill that falls across both axes: the grade is the whole gradient's, not one axis of it
  const g = Math.tan(rad(40)) / Math.SQRT2;
  const ground = (x, z) => g * x + g * z;
  const m = new PlayerMotor(new Collider(ground));
  m.pos = [0, 0, 0]; m.grounded = true;
  for (let i = 0; i < 120; i++) m.update(1 / 60, stand, 0);
  const want = CAPSULE_RADIUS * (1 / Math.cos(rad(40)) - 1);
  assert.ok(Math.abs(m.pos[1] - ground(m.pos[0], m.pos[2]) - want) < 1e-6, `a 40-degree grade along the diagonal: ${(m.pos[1] - ground(m.pos[0], m.pos[2])).toFixed(4)} vs ${want.toFixed(4)}`);
});

test('DISC16-A: the rest is the floor\'s own - the snap onto it and the clamp under it read the same height, so a downhill walk still never leaves the ground; at a floor\'s edge the point floor stands', () => {
  // downhill at 30 degrees: no step airborne, no landing, the eye never climbs (MAC3's law on the new floor)
  const g = Math.tan(rad(30));
  const m = new PlayerMotor(new Collider((x, z) => -g * z));
  m.pos = [0, CAPSULE_RADIUS * (1 / Math.cos(rad(30)) - 1), 0]; m.grounded = true;   // settled, at its rest
  for (let i = 0; i < 2; i++) m.update(1 / 60, { forward: 0, strafe: 0, run: false, jump: false, up: false, down: false }, 0);   // ...settled there by the motor itself
  let airborne = 0, landings = 0, rises = 0, prev = m.eyeAt()[1];
  for (let i = 0; i < 600; i++) {
    m.update(1 / 60, walk, 0);
    if (m.falling || !m.grounded) airborne++;
    if (m.landedFallDistance > 0) landings++;
    const e = m.eyeAt()[1]; if (e - prev > 1e-9) rises++; prev = e;
  }
  assert.deepEqual([airborne, landings, rises], [0, 0, 0]);
  // no ground to one side (a built pixel's edge, -Infinity past it): no grade to read, the point floor
  const edge = new Collider((x, z) => (x < 0 ? -Infinity : 0.5 * z));
  assert.equal(edge.restFloor(0.1, 2), 1, 'no ground to the west: the ground beneath the centre');
  assert.ok(edge.restFloor(3, 2) > 1, 'inside the pixel, the capsule\'s rest');
  const src = rd('src/player/collider.js');
  assert.match(src, /const floor = this\.restFloor\(feet\[0\], feet\[2\]\);/, 'the snap and the clamp read the rest');
  assert.equal((src.match(/this\.heightAt\(feet\[0\], feet\[2\]\)/g) || []).length, 0, 'and nothing in move() reads the point floor');
});

test('DISC16-B: the weapons move as they did before Diverse Weapons - the mod on (MO1) with its preset off (DW1), Weapon Widget at its shipped defaults, and what draws is Weapon Widget\'s own store (mutants: the preset left on; either store value at DISC14-B\'s)', () => {
  _resetModSettings();
  assert.equal(moddedWeaponHUDAnimsEnabled(), true, 'Diverse Weapons on: its sprites (MO1 - every mod ships on)');
  assert.equal(diverseWeaponsPresetOn(), false, 'and no preset laid over Weapon Widget');
  const shipped = {};
  for (const sec of JSON.parse(rd('vendor/weapon-widget/modsettings.json')).Sections) for (const k of sec.Keys) shipped[`${sec.Name}.${k.Name}`] = k.Value;
  const store = modSettingsOf(WEAPON_WIDGET_VENDOR);
  const on = (v) => v === true || v === 'True';   // the vendored file's booleans
  assert.equal(store['Modules.DoubleScaleTextures'], on(shipped['Modules.DoubleScaleTextures']), 'DoubleScaleTextures: the mod\'s own');
  assert.equal(store['Inertia.Scale'], Number(shipped['Inertia.Scale']), 'Inertia.Scale: the mod\'s own');
  // what draws is the store, module for module, as the mod ships it
  const s = readWidgetSettings();
  const mod = (k) => on(shipped[`Modules.${k}`]);
  assert.deepEqual([s.swing, s.ambidexterity, s.offset, s.bob, s.inertia, s.stepTransforms, s.doubleScale, s.trueSize, s.recoil],
    ['Swings', 'Ambidexterity', 'Offset', 'Bob', 'Inertia', 'Step', 'DoubleScaleTextures', 'TrueTextureSize', 'Recoil'].map(mod));
  assert.equal(s.bobLength, Number(shipped['Bob.Length']) / 100, 'the mod\'s bob, not the preset\'s 142');
  // the Thunderlock's own departure stands: its inertia on, at the player's scale (the shipped 1.0, x500)
  assert.deepEqual([gunWidgetSettings().inertia, gunWidgetSettings().inertiaScale], [true, 500]);
  assert.doesNotMatch(rd('src/combat/gunViewmodel.js'), /GUN_INERTIA_SCALE/);
  // the mod decides WHICH sprite, never how it moves: with it off, the same motion
  setModSetting('diverse-weapons', 'Enabled', false);
  const without = readWidgetSettings();
  assert.deepEqual([without.inertia, without.stepTransforms, without.trueSize, without.bobLength], [s.inertia, s.stepTransforms, s.trueSize, s.bobLength]);
  _resetModSettings();
});

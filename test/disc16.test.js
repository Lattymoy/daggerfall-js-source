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
// values for the weapon widget reverted. Its no longer smooth like how it was before diverse weapons" ──
// DISC14-B, reverted: Diverse Weapons' preset defaults on again (DW-CLIP), and Weapon Widget ships its own defaults.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { PlayerMotor, CAPSULE_RADIUS } from '../src/player/motor.js';
import { Collider } from '../src/player/collider.js';
import { modSettingsOf, _resetModSettings } from '../src/systems/modSettings.js';
import { readWidgetSettings, WEAPON_WIDGET_VENDOR } from '../src/combat/weaponWidget.js';
import { diverseWeaponsPresetOn, moddedWeaponHUDAnimsEnabled, diverseWeaponsWidgetPreset } from '../src/combat/diverseWeapons.js';
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

test('DISC16-B: Diverse Weapons\' preset is on by default again, over Weapon Widget\'s own shipped defaults - DoubleScaleTextures off and Inertia.Scale 1 in the store, the preset\'s inertia, step, recoil and true size in what draws (mutants: the preset left off; either store value left at DISC14-B\'s)', () => {
  _resetModSettings();
  assert.equal(moddedWeaponHUDAnimsEnabled(), true, 'Diverse Weapons is on');
  assert.equal(diverseWeaponsPresetOn(), true, 'and its preset with it (DW-CLIP, again)');
  const shipped = {};
  for (const sec of JSON.parse(rd('vendor/weapon-widget/modsettings.json')).Sections) for (const k of sec.Keys) shipped[`${sec.Name}.${k.Name}`] = k.Value;
  const store = modSettingsOf(WEAPON_WIDGET_VENDOR);
  assert.equal(store['Modules.DoubleScaleTextures'], shipped['Modules.DoubleScaleTextures'] === 'True', 'DoubleScaleTextures: the mod\'s own');
  assert.equal(store['Inertia.Scale'], Number(shipped['Inertia.Scale']), 'Inertia.Scale: the mod\'s own');
  // what draws is the preset over them
  const s = readWidgetSettings();
  const p = diverseWeaponsWidgetPreset();
  assert.deepEqual([s.inertia, s.stepTransforms, s.recoil, s.trueSize, s.doubleScale], [p['Modules.Inertia'], p['Modules.Step'], p['Modules.Recoil'], p['Modules.TrueTextureSize'], p['Modules.DoubleScaleTextures']]);
  assert.deepEqual([s.inertia, s.inertiaScale, s.bobLength], [true, 500, 1.42], 'the inertia on at the mod\'s scale, the preset\'s 142 bob');
  // the Thunderlock's inertia is the player's own again - no scale of its own (DISC14-B's GUN_INERTIA_SCALE is gone)
  assert.equal(gunWidgetSettings().inertiaScale, s.inertiaScale);
  assert.doesNotMatch(rd('src/combat/gunViewmodel.js'), /GUN_INERTIA_SCALE/);
});

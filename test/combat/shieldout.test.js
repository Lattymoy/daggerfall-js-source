// SHIELD-OUT (2026-09-27, SlipperyPeasant on Discord: "My shield is fully repaired and looks as such inside, but once
// I'm out in the open world it visually appears as if its broken"). Every host builds its own weapon rig, and each rig
// its own Shield Widget; only the host on screen steps its rig. The street's widget sat out the whole visit to the
// smith and resumed on the battered sprite it last read - its template key had not moved, and only a DOWNWARD crossing
// (hitShield) repoints the sheet. The mod has ONE component, which sees the shield come off for the repair and re-reads
// it when it goes back on. A widget that missed any of the widgets' shared steps re-reads its shield now.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createShieldWidget, readShieldWidgetSettings, shieldTextureIndex, SHIELD_TEMPLATES } from '../../src/combat/shieldWidget.js';

// sw1_shield_widget.test.js's harness: the mod's defaults, the Recoil module OFF (no hitShield repoint)
const RAW = {
  Enabled: true, 'Shield.OffsetHorizontal': 0.5, 'Shield.OffsetVertical': 0.5, 'Shield.Scale': 1,
  'Shield.Speed': 1, 'Shield.WhenSheathed': 1, 'Shield.WhenAttacking': 1, 'Shield.WhenCasting': 1,
  'Shield.LockAspectRatio': true, 'Shield.ConditionThresholdUpper': 75, 'Shield.ConditionThresholdLower': 25,
  'Modules.Bob': true, 'Modules.Inertia': false, 'Modules.Animation': false, 'Modules.Step': false, 'Modules.Recoil': false,
  'Bob.Length': 100, 'Bob.Offset': 0, 'Bob.SizeX': 1, 'Bob.SizeY': 1, 'Bob.SpeedMove': 1, 'Bob.SpeedState': 1,
  'Bob.Shape': 0, 'Bob.BobWhileIdle': true,
  'Inertia.Scale': 1, 'Inertia.Speed': 1, 'Inertia.ForwardDepth': 1, 'Inertia.ForwardSpeed': 1,
  'Animation.Speed': 1, 'Animation.Direction': 0, 'Step.Length': 1, 'Step.Condition': 0,
  'Recoil.Scale': 1, 'Recoil.Offset': false, 'Recoil.Speed': 1, 'Recoil.Condition': 2,
  'Compatibility.TextureScaleFactor': 1,
};
const widget = () => createShieldWidget({
  settings: () => readShieldWidgetSettings(() => RAW),
  textures: { size: () => ({ width: 100, height: 100 }) },
  audio: { playOneShot() {} }, rolls: () => 0.5, handedness: () => false,
});
const shieldAt = (conditionPercentage) => ({ templateIndex: SHIELD_TEMPLATES.Kite, nativeMaterialValue: 513, conditionPercentage, isShield: true });
const frame = (item) => ({
  dt: 1 / 60, time: 0, screenRect: { x: 0, y: 0, width: 640, height: 400 }, largeHudHeight: 0,
  item, attacking: false, sheathed: false, castingAnim: false, hasReadySpell: false,
  equipCountdownLeftHand: 0, isClimbing: false, isPaused: false, loadInProgress: false,
  entity: { stats: { speed: 50 } },
  motor: { speed: 0, baseSpeed: 3, isGrounded: true, isCrouching: false, isRiding: false, isStandingStill: true, moveDirectionLocal: [0, 0, 0] },
  look: { x: 0, y: 0, cursorActive: false, swingAction: false },
});
const steps = (w, item, n = 5) => { for (let i = 0; i < n; i++) w.lateUpdate(frame(item)); };
const index = (c) => shieldTextureIndex(shieldAt(c), 75, 25);

test('SHIELD-OUT: repaired indoors is repaired outdoors - the street\'s widget re-reads the shield it sat out', () => {
  const street = widget(), building = widget();
  steps(street, shieldAt(20));
  assert.equal(street.indexCurrent, index(20), 'battered in the street');
  // the smith's: the shield comes off for the repair and goes back on whole - the building's rig steps it all
  steps(building, null);
  steps(building, shieldAt(100));
  assert.equal(building.indexCurrent, index(100), 'whole inside');
  steps(street, shieldAt(100), 1);
  assert.equal(street.indexCurrent, index(100), 'and whole outside, on the first frame back');
});

test('SHIELD-OUT: the mirror - battered indoors is battered outdoors', () => {
  const street = widget(), building = widget();
  steps(street, shieldAt(100));
  steps(building, shieldAt(100));
  steps(building, shieldAt(10));   // worn down inside with the Recoil module off: the building's own sprite waits for a re-equip, as the mod's does
  steps(street, shieldAt(10), 1);
  assert.equal(street.indexCurrent, index(10), 'the street reads the shield as it is now');
});

test('SHIELD-OUT: a widget that never looked away keeps the mod\'s law - its key, or a downward crossing through hitShield, and nothing else', () => {
  const alone = widget();
  steps(alone, shieldAt(100));
  steps(alone, shieldAt(10));
  assert.equal(alone.indexCurrent, index(100), 'no re-read while this widget saw every frame (Recoil off: the mod waits for a re-equip)');
  steps(alone, null, 1);
  steps(alone, shieldAt(10), 1);
  assert.equal(alone.indexCurrent, index(10), 'the re-equip re-reads it, as the mod does');
});

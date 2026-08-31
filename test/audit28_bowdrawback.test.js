import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { PlayerWeapon } from '../src/combat/playerWeapon.js';
import { BOW_DRAWN_HOLD_FRAME, MAX_BOW_HELD_DRAWN_SECONDS } from '../src/characters/weaponStates.js';
import { setValue, resetToDefaults, LIVE } from '../src/systems/settings.js';

// AUDIT 28 - W12: BOW DRAWBACK (WeaponManager.cs:341, :353-360). The
// machine's draw-and-hold half (StrikeUp to frame 3, the 10 s undraw,
// the StrikeUp -> StrikeDown release) had been in place since FX1 with
// its comment saying it becomes live "the moment the drawback path
// does". This is that path: with Controls/BowDrawback a press DRAWS,
// letting go looses the arrow, ActivateCenterObject held un-draws.

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');
const DIM = 1200;
const bow = () => { const w = new PlayerWeapon({ weapon: { name: 'Short Bow', templateIndex: 129, material: 0 }, liveSpeed: 50 }); w.sheathed = false; w.update(0); return w; };
const on = { bowDrawback: true };
const drawTo = (w, frame = BOW_DRAWN_HOLD_FRAME) => { let n = 0; while (w.machine.frame < frame && n++ < 200) { w.update(1 / 60); w.gesture(0, 0, true, 1 / 60, DIM, on); } };

test('AUDIT 28 W12: off (the shipped default) - the press shoots at once, StrikeDown, as before', () => {
  resetToDefaults();
  const w = bow();
  assert.equal(w.gesture(0, 0, true, 1 / 60, DIM), 'StrikeDown');
});

test('AUDIT 28 W12: on - the press DRAWS (StrikeUp), the machine walks to the hold frame and waits there while the button is held', () => {
  const w = bow();
  assert.equal(w.gesture(0, 0, true, 1 / 60, DIM, on), 'StrikeUp', 'the press draws (:341 Up)');
  drawTo(w);
  assert.equal(w.machine.state, 'StrikeUp');
  assert.equal(w.machine.frame, BOW_DRAWN_HOLD_FRAME);
  for (let i = 0; i < 60; i++) { w.update(1 / 60); assert.equal(w.gesture(0, 0, true, 1 / 60, DIM, on), null, 'holding: nothing fires'); }
  assert.equal(w.machine.state, 'StrikeUp'); assert.equal(w.machine.frame, BOW_DRAWN_HOLD_FRAME, 'still drawn');
});

test('AUDIT 28 W12: letting the button go at the hold frame RELEASES the arrow (StrikeDown, :359-361)', () => {
  const w = bow();
  w.gesture(0, 0, true, 1 / 60, DIM, on); drawTo(w);
  assert.equal(w.gesture(0, 0, false, 1 / 60, DIM, on), 'StrikeDown');
  assert.equal(w.machine.state, 'StrikeDown');
  // Releasing BEFORE the hold frame does nothing (the frame == 3 gate).
  const early = bow();
  early.gesture(0, 0, true, 1 / 60, DIM, on);
  assert.ok(early.machine.frame < BOW_DRAWN_HOLD_FRAME);
  assert.equal(early.gesture(0, 0, false, 1 / 60, DIM, on), null, 'not yet drawn: no release');
  assert.equal(early.machine.state, 'StrikeUp', 'and the draw continues');
});

test('AUDIT 28 W12: ActivateCenterObject held at the hold frame UN-draws without an arrow and charges the full cooldown (:355-358)', () => {
  const w = bow();
  w.gesture(0, 0, true, 1 / 60, DIM, on); drawTo(w);
  assert.equal(w.gesture(0, 0, true, 1 / 60, DIM, { ...on, cancelHeld: true }), null);
  assert.equal(w.machine.state, 'Idle');
  assert.ok(w.machine.cooldownUntil > w.machine.now, 'a cancelled draw costs what a loosed arrow costs');
  // A new press before the cooldown clears does nothing; after it, draws again.
  assert.equal(w.gesture(0, 0, false, 1 / 60, DIM, on), null);
  assert.equal(w.gesture(0, 0, true, 1 / 60, DIM, on), null, 'in cooldown');
  for (let i = 0; i < 120; i++) w.update(1 / 60);
  w.gesture(0, 0, false, 1 / 60, DIM, on);
  assert.equal(w.gesture(0, 0, true, 1 / 60, DIM, on), 'StrikeUp', 'draws again');
});

test('AUDIT 28 W12: held past MaxBowHeldDrawnSeconds the machine un-draws by itself; the setting is live and LIVE; every rig has the activate seam', () => {
  assert.equal(MAX_BOW_HELD_DRAWN_SECONDS, 10);
  const w = bow();
  w.gesture(0, 0, true, 1 / 60, DIM, on); drawTo(w);
  let undrew = false;
  for (let i = 0; i < 12 * 60 && !undrew; i++) { const ev = w.update(1 / 60); if (ev.includes('undraw')) undrew = true; w.gesture(0, 0, true, 1 / 60, DIM, on); }
  assert.ok(undrew, 'the 10 s timeout');
  assert.equal(w.machine.state, 'Idle');
  resetToDefaults();
  setValue('Controls', 'BowDrawback', true);
  assert.equal(bow().gesture(0, 0, true, 1 / 60, DIM), 'StrikeUp', 'read live');
  resetToDefaults();
  assert.equal(LIVE['Controls/BowDrawback'], 'src/combat/playerWeapon.js');
  assert.match(read('src/combat/weaponRig.js'), /\{ cancelHeld: activateHeld\(\) \}/, 'the rig hands the key to the gesture');
  for (const host of ['src/scenes/world.js', 'src/scenes/exterior.js', 'src/scenes/worldModes.js', 'src/scenes/dungeon.js']) {
    assert.match(read(host), /activateHeld: \(\) => held\(keys, 'ActivateCenterObject'\)/, `${host}: the activate key reaches a rig`);
  }
  assert.match(read('src/scenes/dungeonContext.js'), /activateHeld: \(\) => !!opts\.activateHeld\?\.\(\),/, 'the dungeon ctx threads its host\'s');
});

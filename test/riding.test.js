// Platform riding (Ledger C row -> shipped 2026-08-14) + the
// ClickToAttack seam - the two live-play fixes, pinned mechanically.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Collider } from '../src/player/collider.js';
import { PlayerWeapon } from '../src/combat/playerWeapon.js';
import { STRIKES } from '../src/characters/anims.js';

const seq = (...v) => { let i = 0; return () => v[Math.min(i++, v.length - 1)]; };

// A quad (two tris) at height y spanning [-s, s]^2
const quad = (y, s = 4) => ({
  positions: new Float32Array([-s, y, -s, s, y, -s, s, y, s, -s, y, s]),
  indices: new Uint16Array([0, 1, 2, 0, 2, 3]),
});
const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
const at = (y) => new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, y, 0, 1]);

test('riding: groundKey identifies the mover; the delta carries the capsule up', () => {
  const c = new Collider();
  const floor = quad(0, 20);
  c.addMesh('dungeon', floor.positions, floor.indices, I);
  const plat = quad(0, 2);
  c.addMesh('act:lift', plat.positions, plat.indices, at(0.5));   // platform top at 0.5, over the floor

  const feet = [0, 0.5, 0];
  let r = c.move(feet, 0, -0.05, 0);   // settle onto the platform
  assert.equal(r.grounded, true);
  assert.equal(r.groundKey, 'act:lift');   // the mover WINS over the static floor beneath

  // The mover advances one frame (+0.2): collider mesh re-registers,
  // the scene applies the SAME delta through the resolver.
  c.removeBucket('act:lift');
  c.addMesh('act:lift', plat.positions, plat.indices, at(0.7));
  r = c.move(feet, 0, 0.2, 0);          // the ride delta (the eject may add transiently)
  for (let i = 0; i < 3; i++) r = c.move(feet, 0, -0.1, 0);   // gravity frames seat onto the top
  assert.ok(Math.abs(feet[1] - 0.7) < 0.06, `rides to the new top (feet ${feet[1]})`);
  assert.equal(r.groundKey, 'act:lift');
  assert.ok(feet[0] === 0 && feet[2] === 0, 'no lateral ejection');

  // Step off: the static floor grounds and the key says so.
  const off = [10, 0.2, 10];
  const r2 = c.move(off, 0, -0.5, 0);
  assert.equal(r2.grounded, true);
  assert.equal(r2.groundKey, 'dungeon');
});

test('clickAttack: the DFU Range(UpRight, DownRight+1) directions, machine enters a Strike', () => {
  const w = new PlayerWeapon({});
  // rolls 0 -> UpRight -> StrikeUp; the machine leaves Idle
  const s1 = w.clickAttack(seq(0));
  assert.equal(s1, 'StrikeUp');
  assert.ok(STRIKES.includes(w.machine.state));
  // busy machine refuses a second click (returns null)
  assert.equal(w.clickAttack(seq(0)), null);
  // fresh machine, rolls .999 -> DownRight
  const w2 = new PlayerWeapon({});
  assert.equal(w2.clickAttack(seq(0.999)), 'StrikeDownRight');
  // the six-direction table: Left at index 1
  const w3 = new PlayerWeapon({});
  assert.equal(w3.clickAttack(seq(1 / 6 + 0.001)), 'StrikeLeft');
});

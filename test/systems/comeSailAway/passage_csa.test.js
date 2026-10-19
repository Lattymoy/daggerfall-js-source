// PASSAGE (2026-10-19; bible/03-World/Passage.md) - A BOOKED SHIP IN COME SAIL AWAY'S RUNTIME (the port's own two lines
// in systems/comeSailAway/comeSailAway.js): her voyage rides the save with her and comes back on her at a load, and she
// is never packed into parts in my pack - her master's, not mine. Over the vendored hulls (test/csaScene.mjs).

import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scene } from '../../csaScene.mjs';

const VOYAGE = { to: { name: 'Sentinel', px: 130, py: 100 }, ship: 'The Fair Silk', captain: 'Ana Rhea', fare: 50 };

test('PASSAGE csa: a booked ship\'s voyage is saved with her and read back onto her at a load - a copy, never the live record; a boat of mine saves none (mutants: the voyage unsaved; saved live, not a copy; unread at the load)', () => {
  const s = scene();
  const mine = s.place(1, 0, [100, 34, 200]);
  const booked = s.place(2, 0, [160, 34, 200]);
  booked.uid = 9001;
  booked.charter = VOYAGE;
  s.helm(booked);
  s.frame();
  const rec = JSON.parse(JSON.stringify(s.rt.getSaveData()));
  const saved = rec.placedBoats.find((b) => b.UID === 9001);
  assert.deepEqual(saved.Charter, VOYAGE);
  assert.notEqual(s.rt.getSaveData().placedBoats.find((b) => b.UID === 9001).Charter, VOYAGE, 'a copy');
  assert.equal('Charter' in rec.placedBoats.find((b) => b !== saved), false, 'mine carries none');
  assert.ok(mine);
  const t = scene();
  t.rt.restoreSaveData(rec);
  t.rt.OnLoad();
  const back = t.rt.AllBoats.find((b) => b.uid === 9001);
  assert.deepEqual(back.charter, VOYAGE, 'her voyage on her again');
  assert.equal(t.rt.state.CurrentBoat, back, 'at her helm, as saved');
  assert.equal(t.rt.AllBoats.find((b) => b !== back).charter, null, 'mine carries none back');
});

test('PASSAGE csa: a booked ship is never packed into parts - her master\'s, not mine; a boat of mine packs as ever (mutants: the guard dropped)', () => {
  const s = scene();
  const packed = [];
  s.deps.items = { create: (templateIndex) => ({ group: 'UselessItems2', templateIndex, name: 'Parts of', message: 0, UID: 900 + packed.length }), addToPlayer: (item) => packed.push(item) };
  s.deps.cargoWeight = () => 0;
  const booked = s.place(1, 0, [100, 34, 200]);
  booked.charter = VOYAGE;
  assert.equal(s.rt.PackBoat(booked, true), false);
  assert.ok(s.rt.AllBoats.includes(booked), 'she stands');
  assert.equal(packed.length, 0, 'nothing in the pack');
  const mine = s.place(1, 0, [140, 34, 200]);
  assert.equal(s.rt.PackBoat(mine, true), true, 'mine packs');
  assert.equal(packed.length, 1);
});

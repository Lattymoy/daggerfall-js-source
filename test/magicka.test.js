// S4a: SPELLS.STD verbatim parse, the magicka formulas, DrainMagicka.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readSpellsStd, SPELL_RECORD_SIZE } from '../src/formats/spellsStd.js';
import { spellPointMultiplier, spellPoints, SPELL_POINT_MULTIPLIERS } from '../src/systems/chargen.js';
import { ActionSystem } from '../src/world/actionSystem.js';
import { ACTION_FLAGS } from '../src/world/rdbLayout.js';

function craftSpell({ name = 'Fireball', types = [4, -1, -1], cost = 60, index = 7 } = {}) {
  const b = new Uint8Array(SPELL_RECORD_SIZE);
  const v = new DataView(b.buffer);
  for (let i = 0; i < 3; i++) { v.setInt8(i * 2, types[i]); v.setInt8(i * 2 + 1, i === 0 ? 2 : -1); }
  b[6] = 3;                       // element
  b[7] = 2;                       // rangeType
  v.setUint16(8, cost, true);
  b[14] = 5; b[15] = 1; b[16] = 2;   // effect0 duration base/mod/perLevel
  b[23] = 25;                     // effect0 chanceBase
  b[32] = 10; b[33] = 25;         // effect0 magnitude low/high
  for (let i = 0; i < name.length; i++) b[47 + i] = name.charCodeAt(i);
  b[72] = 11;                     // icon
  b[73] = index;
  return b;
}

test('spellsStd: verbatim 89-byte walk (subType ALWAYS read - the dead 0xFF branch), gate, fields', () => {
  assert.equal(SPELL_RECORD_SIZE, 0x59);
  const invalid = craftSpell({ types: [-1, -1, -1] });   // all -1: gated out
  const buf = new Uint8Array(SPELL_RECORD_SIZE * 2);
  buf.set(invalid, 0);
  buf.set(craftSpell({}), SPELL_RECORD_SIZE);
  const spells = readSpellsStd(buf);
  assert.equal(spells.length, 1);                        // the invalid record skipped
  const s = spells[0];
  assert.equal(s.name, 'Fireball');
  assert.equal(s.cost, 60);
  assert.equal(s.index, 7);
  assert.equal(s.icon, 11);
  assert.equal(s.element, 3);
  assert.equal(s.rangeType, 2);
  assert.deepEqual([s.effects[0].type, s.effects[0].subType], [4, 2]);
  assert.equal(s.effects[1].type, -1);                   // sbyte read
  assert.equal(s.effects[0].durationBase, 5);
  assert.equal(s.effects[0].chanceBase, 25);
  assert.equal(s.effects[0].magnitudeBaseHigh, 25);
});

test('magicka: the multiplier bitfield decode + SpellPoints floor', () => {
  assert.deepEqual(SPELL_POINT_MULTIPLIERS, { 0: 3.0, 4: 2.0, 8: 1.75, 12: 1.5, 16: 1.0, 20: 0.5 });
  assert.equal(spellPointMultiplier(0x0000), 3.0);       // bits 00
  assert.equal(spellPointMultiplier(0x0400), 2.0);
  assert.equal(spellPointMultiplier(0x0800), 1.75);
  assert.equal(spellPointMultiplier(0x1000), 1.0);
  assert.equal(spellPointMultiplier(0x1400), 0.5);
  assert.equal(spellPoints(45, 1.75), 78);               // floor(78.75)
  assert.equal(spellPoints(50, 0.5), 25);
});

test('DrainMagicka: verbatim max(1, flat?mag:axis), floors at 0', () => {
  let magicka = 10;
  const sys = new ActionSystem({ addMesh() {}, removeMesh() {}, removeBucket() {} }, {
    drainMagicka: (n) => { magicka = Math.max(0, magicka - n); },
  });
  const flat = sys.addEffect(1, { actionFlag: ACTION_FLAGS.DrainMagicka, isFlat: true, magnitude: 4, index: 0, axisRaw: 9, nextObject: -1 });
  sys.receive(flat);
  assert.equal(magicka, 6);
  const model = sys.addEffect(2, { actionFlag: ACTION_FLAGS.DrainMagicka, isFlat: false, magnitude: 4, index: 0, axisRaw: 0, nextObject: -1 });
  sys.receive(model); // axisRaw 0 -> max(1, 0) = 1
  assert.equal(magicka, 5);
  for (let i = 0; i < 9; i++) sys.receive(flat);
  assert.equal(magicka, 0);                              // floored
});

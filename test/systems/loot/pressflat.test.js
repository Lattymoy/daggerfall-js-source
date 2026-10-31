// PRESS-FLAT (2026-10-28; as the owner asked): the
// Mages Guild's Imbue and the Reforge (the guild's and the Essence's) draw a line with no lean - no skill to the weapon's
// own or its strike kin, no damage as the first line, no armour family's weight. A found or made piece keeps LOOT1's lean.

import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyRarity, reforgeAffix } from '../../../src/systems/loot/lootRarity.js';
import { imbuePiece } from '../../../src/systems/reforge.js';
import { welkyndShards } from '../../../src/systems/gate/gateSpoils.js';
import { createWeapon } from '../../../src/combat/enemyEquipment.js';
import { createRandomArmor, createRandomJewellery, createRandomClothing } from '../../../src/systems/loot/loot.js';
import { setPref } from '../../../src/systems/uiPrefs.js';
import { seededRng } from '../../../src/systems/wind/wind.js';
import { SKILLS } from '../../../src/systems/skills.js';

setPref('lootRarity', true);
const katana = () => createWeapon(120, 1);   // a Long Blade
const skillShare = (pieces, skill) => {
  const lines = pieces.flatMap((it) => it.affixes.filter((a) => a.id === 'skill'));
  return lines.filter((a) => a.param === skill).length / lines.length;
};

test('PRESS-FLAT: a found Rare blade leans (LOOT1) - its own skill on most skill lines, damage first half the time', () => {
  const found = Array.from({ length: 2000 }, (_, i) => applyRarity(katana(), 'rare', seededRng(1000 + i)));
  assert.ok(skillShare(found, SKILLS.LongBlade) > 0.3);
  assert.ok(found.filter((it) => it.affixes[0].id === 'damage').length / found.length > 0.45);
});

test('PRESS-FLAT: an Imbued Rare blade leans nowhere - Long Blade and Critical Strike no likelier than any skill, damage first rarely', () => {
  const imbued = [];
  for (let i = 0; i < 1500; i++) {
    const it = katana();
    const p = { level: 20, items: [welkyndShards(100), it], goldPieces: 1e9 };
    const r = seededRng(5000 + i);
    assert.equal(imbuePiece(it, p, r).ok, true);
    assert.equal(imbuePiece(it, p, r).ok, true);
    imbued.push(it);
  }
  assert.ok(skillShare(imbued, SKILLS.LongBlade) < 0.06, 'one skill of 35, give or take');
  assert.ok(skillShare(imbued, SKILLS.CriticalStrike) < 0.06);
  assert.ok(imbued.filter((it) => it.affixes[0].id === 'damage').length / imbued.length < 0.2);
});

test('PRESS-FLAT: a reforged skill line leans nowhere', () => {
  const lines = [];
  for (let i = 0; i < 3000 && lines.length < 400; i++) {
    const it = Object.assign(applyRarity(katana(), 'rare', seededRng(9000 + i)), { isIdentified: true });
    const at = it.affixes.findIndex((a) => a.id !== 'skill');   // the Reforge draws another kind than the line's own
    if (at < 0) continue;
    const line = reforgeAffix(it, at, seededRng(i));
    if (line?.id === 'skill') lines.push(line);
  }
  assert.ok(lines.length >= 100, `${lines.length} skill lines`);
  assert.ok(lines.filter((a) => a.param === SKILLS.LongBlade).length / lines.length < 0.08);
});

test('PRESS-FLAT: the Imbue leans nowhere on armour, jewellery or clothing either - no kin skill, no family\'s attribute, no first line of its own', () => {
  const imbue = (make, seed) => {
    const out = [];
    for (let i = 0; i < 800; i++) {
      const it = make();
      const p = { level: 20, items: [welkyndShards(100), it], goldPieces: 1e9 };
      const r = seededRng(seed + i);
      if (imbuePiece(it, p, r).ok && imbuePiece(it, p, r).ok) out.push(it);
    }
    assert.ok(out.length > 600, `${out.length} imbued`);
    return out;
  };
  const leather = imbue(() => createRandomArmor(20), 20_000);
  assert.ok(leather.filter((it) => it.affixes[0].id === 'armor').length / leather.length < 0.3, 'armour first rarely');
  const rings = imbue(() => createRandomJewellery(), 30_000);
  assert.ok(skillShare(rings, SKILLS.CriticalStrike) < 0.07 && skillShare(rings, SKILLS.Destruction) < 0.07, 'no jewel kin');
  const cloaks = imbue(() => createRandomClothing('male'), 40_000);
  assert.ok(skillShare(cloaks, SKILLS.Streetwise) < 0.07, 'no street kin');
});

// FIXED-PVE TEMPLATE-DROPS (bible/05-Combat/Fixed-PvE.md section 20; the owner, 2026-10-31: "jewelery armor weapons",
// "that need fixed"): a template foe's drop reads its own level and rank, and every kind of foe may carry gear.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { templateDropSource, templateGearKinds, DROP_JEWEL, DROP_CREATURE_GEAR, DROP_RANK_PIECES, OVER_GEAR_LEVELS, DROP_CLOTH } from '../../../src/systems/pve/pveDrops.js';
import { addTemplateGear, stripOverGear } from '../../../src/systems/pve/pveDropGear.js';
import { readFileSync } from 'node:fs';
import { corpseSource } from '../../../src/systems/loot/lootRarity.js';
import { plainFoeLootRule } from '../../../src/systems/foeLootCap.js';
import { ENEMY_BASICS } from '../../../src/characters/enemy/enemyBasics.js';
import { MOBILE_TYPES as M } from '../../../src/characters/mobile/mobileTypes.js';

const tpl = (mobileType, category = 'normal', over = {}) => ({ mobileType, level: 30, pveTemplate: 'probe', pveCategory: category, ...over });
const seq = (...xs) => { let i = 0; return () => xs[i++ % xs.length]; };

test('TEMPLATE-DROPS source: a template foe rolls at its own level and its rank; any other foe as before', () => {
  const rat = corpseSource(ENEMY_BASICS[M.Rat], 30, M.Rat);
  assert.deepEqual([rat.tier, rat.boss], [1, false], "Daggerfall's: the rat's own level");
  assert.deepEqual([templateDropSource(tpl(M.Rat), rat).tier, templateDropSource(tpl(M.Rat), rat).boss], [30, false]);
  const vamp = corpseSource(ENEMY_BASICS[M.Vampire], 30, M.Vampire);
  assert.equal(vamp.boss, true, "Daggerfall's: level 18 and up is a boss");
  assert.equal(templateDropSource(tpl(M.Vampire), vamp).boss, false, 'a Normal template vampire is plain');
  for (const c of ['strong', 'elite', 'boss', 'raidBoss']) assert.equal(templateDropSource(tpl(M.Rat, c), rat).boss, true, c);
  assert.equal(templateDropSource({ mobileType: M.Rat, level: 30 }, rat), rat);
  assert.equal(plainFoeLootRule(tpl(M.Vampire), ENEMY_BASICS[M.Vampire])?.cap, 3, 'a Normal template vampire is capped');
  assert.equal(plainFoeLootRule(tpl(M.Rat, 'strong'), ENEMY_BASICS[M.Rat]), null, 'a Strong one is not');
});

test('TEMPLATE-DROPS gear: a caster carries jewellery most often, a creature may carry a weapon or armour, a rank carries more', () => {
  assert.deepEqual([DROP_JEWEL.caster, DROP_JEWEL.other, DROP_CREATURE_GEAR], [0.5, 0.15, 0.3]);
  assert.deepEqual(templateGearKinds(tpl(M.Mage), seq(0.49, 0.99)), ['jewel'], 'a caster under a half');
  assert.deepEqual(templateGearKinds(tpl(M.Knight), seq(0.49, 0.99)), [], 'a fighter over 0.15');
  assert.deepEqual(templateGearKinds(tpl(M.Knight), seq(0.1)), ['jewel', 'cloak'], 'a class body takes no creature gear, but clothing');
  assert.deepEqual(templateGearKinds(tpl(M.Knight), seq(0.9, 0.29, 0.25)), ['cloth'], 'CLOTH-DROPS: a person under 0.3, a cloak under 0.25');
  assert.deepEqual(templateGearKinds(tpl(M.Knight), seq(0.9, 0.3)), []);
  assert.deepEqual(templateGearKinds(tpl(M.Rat, 'strong'), seq(0.9, 0.9, 0.8, 0.1)), ['cloak'], 'a rank piece may be clothing');
  assert.deepEqual(templateGearKinds(tpl(M.Rat), seq(0.9, 0.29, 0.4)), ['weapon']);
  assert.deepEqual(templateGearKinds(tpl(M.Rat), seq(0.9, 0.29, 0.6)), ['armor']);
  assert.deepEqual(templateGearKinds(tpl(M.Rat), seq(0.9, 0.3)), []);
  for (const [c, n] of Object.entries(DROP_RANK_PIECES)) assert.equal(templateGearKinds(tpl(M.Rat, c), seq(0.99)).length, n, c);
  assert.equal(templateGearKinds(tpl(M.Rat, 'normal', { eliteFoe: true }), seq(0.99)).length, DROP_RANK_PIECES.elite, 'a promoted Normal');
  assert.deepEqual(templateGearKinds({ mobileType: M.Rat, level: 30 }, seq(0)), [], 'no template, no gear');
});

test('TEMPLATE-DROPS mint: the kinds become real pieces on the body', () => {
  const e = tpl(M.Rat, 'raidBoss', { items: [] });
  const out = addTemplateGear(e, () => 0.1);
  assert.equal(out.length, 2 + DROP_RANK_PIECES.raidBoss, 'a jewel, a weapon and its rank');
  assert.ok(out.every((it) => ['Weapons', 'Armor', 'Jewellery'].includes(it.group) && it.name), out.map((x) => x.group).join());
  assert.equal(e.items.length, out.length);
  assert.deepEqual(DROP_CLOTH, { people: 0.3, cloak: 0.25 });
  const k = tpl(M.Knight, 'normal', { items: [], gender: 'male' });
  const cloak = addTemplateGear(k, seq(0.9, 0.1, 0.1, 0.5, 0.5, 0.9, 0.1));
  assert.ok(cloak.some((it) => [154, 155].includes(it.templateIndex) && it.group === 'MensClothing' && it.name), JSON.stringify(cloak.map((x) => [x.group, x.templateIndex])));
});

test('OVER-GEAR: a template foe 10 or more levels under its roller keeps its gold and supplies, never its gear', () => {
  assert.equal(OVER_GEAR_LEVELS, 10);
  const body = () => tpl(M.Rat, 'normal', { level: 20, items: [{ group: 'Weapons', templateIndex: 113 }, { group: 'Jewellery' }, { group: 'MensClothing' },
    { group: 'Currency' }, { group: 'UselessItems2' }, { group: 'Weapons', templateIndex: 131 }] });
  const near = body();
  assert.equal(stripOverGear(near, 29), 0);
  const far = body();
  assert.equal(stripOverGear(far, 30), 3);
  assert.deepEqual(far.items.map((x) => x.group), ['Currency', 'UselessItems2', 'Weapons'], 'the arrows stay');
  const plain = { mobileType: M.Rat, level: 1, items: [{ group: 'Armor' }] };
  assert.equal(stripOverGear(plain, 45), 0, 'no template, the old law');
  assert.match(readFileSync(new URL('../../../src/scenes/hostCombat.js', import.meta.url), 'utf8'), /stripOverGear\(entity, lootGateLevel\(player\)\);/);
});

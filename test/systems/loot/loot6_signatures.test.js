// LOOT6 - SIGNATURE DROPS (2026-10-01; bible/06-Systems/Loot-Arc.md section 8, Mac: "Do you wanna turn this into an
// arc and do all of the above?" - "Signature drops. Weight specific Legendaries to specific foes ... That lets players
// farm for an item while the source still sets the odds"). The laws pinned here:
//   - THE FAMILIES: every foe of the table in one family but the horse; every dungeon kind its family or none.
//   - EVERY RECORD FOUND SOMEWHERE: thirty records, eight families, two or more each.
//   - THE PICK: one roll; a source with no family picks exactly as before; a family's own weigh five to one.
//   - THE DOORS: a corpse's family is its foe's, a dungeon pile's its kind's; WHETHER is still the tier's alone.

import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { setPref, _resetForTests } from '../../../src/systems/uiPrefs.js';
import * as LR from '../../../src/systems/loot/lootRarity.js';
import { ENEMY_BASICS } from '../../../src/characters/enemy/enemyBasics.js';
import { createWeapon } from '../../../src/combat/enemyEquipment.js';

const read = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const on = () => { _resetForTests(); setPref('lootRarity', true); };
const lcg = (seed) => () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return (seed >>> 8) / 0x800000; };

test('LOOT6: the families - every foe in one but the horse; a vampire undead, an atronach a daedra, a dragonling a dragon; the class foes by their own', () => {
  const ids = Object.keys(ENEMY_BASICS).map(Number);
  for (const id of ids) {
    const fams = LR.FAMILY_IDS.filter((f) => LR.FOE_FAMILIES[f].includes(id));
    if (id === 39) { assert.equal(fams.length, 0, 'the horse is no one\'s'); continue; }
    assert.equal(fams.length, 1, `foe ${id} in exactly one family (${fams.join(', ')})`);
  }
  for (const f of LR.FAMILY_IDS) for (const id of LR.FOE_FAMILIES[f]) assert.ok(ids.includes(id), `${f}: ${id} is a foe of the table`);
  assert.deepEqual([28, 30, 33].map(LR.foeFamily), ['undead', 'undead', 'undead']);
  assert.deepEqual([35, 1, 31].map(LR.foeFamily), ['daedra', 'daedra', 'daedra']);
  assert.deepEqual([34, 40].map(LR.foeFamily), ['dragon', 'dragon']);
  assert.deepEqual([7, 16].map(LR.foeFamily), ['brute', 'brute']);
  assert.deepEqual([0, 9, 41].map(LR.foeFamily), ['beast', 'beast', 'beast']);
  assert.deepEqual([128, 133, 138, 145, 146].map(LR.foeFamily), ['caster', 'caster', 'rogue', 'warrior', 'warrior']);
  assert.equal(LR.foeFamily(39), null);
  assert.equal(LR.foeFamily(undefined), null);
  assert.equal(LR.DUNGEON_FAMILY.length, 19, 'DFRegion\'s nineteen dungeon kinds');
  for (const f of LR.DUNGEON_FAMILY) assert.ok(f === null || LR.FAMILY_IDS.includes(f));
  assert.deepEqual([0, 8, 14, 7, 18].map(LR.dungeonFamily), ['undead', 'undead', 'dragon', 'caster', 'undead'], 'a Crypt, a Vampire Haunt, a Dragon\'s Den, a Coven, a Cemetery');
});

test('LOOT6: every record found somewhere - thirty, eight families, two or more each', () => {
  const count = Object.fromEntries(LR.FAMILY_IDS.map((f) => [f, 0]));
  for (const r of LR.LEGENDARIES) {
    const f = LR.foundAmong(r.id);
    assert.ok(LR.FAMILY_IDS.includes(f), `${r.id} is found among ${f}`);
    count[f]++;
  }
  for (const [f, n] of Object.entries(count)) assert.ok(n >= 2, `${f}: ${n}`);
  assert.equal(Object.keys(LR.LEGENDARY_FOUND).length, 30);
  LR.registerLegendary({ id: 'loot6-test-own', name: 'A Test', group: 'Jewellery', affixes: [], enchantment: { type: 9, param: -1 }, lore: 'x', found: 'beast' });
  assert.equal(LR.foundAmong('loot6-test-own'), 'beast', 'a mod\'s record carries its own');
});

test('LOOT6: the pick - one roll; no family is exactly the even pick; a family\'s own weigh five to one', () => {
  const pool = LR.legendariesFor({ group: 'Weapons', templateIndex: 113 });   // a dagger: Wyrmbane, Nightwhisper, Worm's Tooth
  assert.deepEqual(pool.map((r) => r.id), ['wyrmbane', 'nightwhisper', 'worms-tooth']);
  for (let i = 0; i < 300; i++) {
    const r = i / 300;
    assert.equal(LR.pickLegendary(pool, null, () => r), pool[Math.floor(r * pool.length)], `no family at ${r}: the even pick`);
  }
  let n = 0;
  LR.pickLegendary(pool, 'rogue', () => { n++; return 0.5; });
  assert.equal(n, 1, 'one roll');
  const tally = new Map();
  for (let i = 0; i < 7000; i++) { const rec = LR.pickLegendary(pool, 'rogue', () => i / 7000); tally.set(rec.id, (tally.get(rec.id) ?? 0) + 1); }
  assert.ok(Math.abs(tally.get('nightwhisper') / 7000 - 5 / 7) < 0.002, 'the rogue\'s own: five in seven');
  assert.ok(Math.abs(tally.get('wyrmbane') / 7000 - 1 / 7) < 0.002, 'the rest: one each');
  assert.equal(LR.SIGNATURE_WEIGHT, 5);
});

test('LOOT6: the doors - a corpse\'s family its foe\'s, a dungeon pile\'s its kind\'s, the tier\'s odds untouched', () => {
  on();
  assert.equal(LR.corpseSource({ level: 19 }, 19, 28).family, 'undead', 'a vampire\'s corpse');
  assert.equal(LR.corpseSource({ level: 5 }, 5).family, null, 'no type, no family');
  const odds = LR.rarityChances({ kind: 'corpse', tier: 19, boss: true, family: 'undead' });
  assert.deepEqual(odds, LR.rarityChances({ kind: 'corpse', tier: 19, boss: true }), 'whether is the tier\'s alone');
  // over a foe's own list, every Legendary off a vampire leans to the undead's own
  let ownUndead = 0, legs = 0;
  for (let seed = 1; seed < 3000; seed++) {
    const foe = { items: [createWeapon(113, 1), createWeapon(127, 1)], level: 19, mobileType: 28 };
    LR.rollCorpseLoot(foe, { level: 19, affinity: 'Darkness' }, { rolls: lcg(seed), luck: 100 });
    for (const it of foe.items) if (it.rarity === 'legendary') { legs++; if (LR.foundAmong(it.legendary) === 'undead') ownUndead++; }
  }
  assert.ok(legs > 50, `enough Legendaries (${legs})`);
  // a battle axe's pool (Wyrmbane, Graveward, Gortwog's Cleaver) gives the undead's own 5 in 7; a dagger's has none of theirs
  assert.ok(ownUndead / legs > 0.25, `the undead's own lean in (${ownUndead} of ${legs})`);
  const d = read('src/scenes/dungeonContext.js');
  assert.match(d, /family: dungeonFamily\(dfLocation\.mapTableData\.dungeonType\) \}/, 'a dungeon pile names its kind\'s family');
  assert.match(read('src/systems/loot/lootRarity.js'), /const source = corpseSource\(basics, entity\.level, entity\.mobileType\);/, 'the corpse door its foe\'s type');
});

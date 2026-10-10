// LOOT21 - THE AYLEID STONES (2026-10-07; bible/06-Systems/Loot-II-Arc.md section 13; Mac: "what could we do to make it
// even more amazing, while also balancing everyrhing?", then "Lets go all in").
//
// Two things DFU's roll cannot make, found at the deepest sources through the Thunderlock's registry as LATE finds - the
// door's last draws, so no seed's earlier draw moves (the arc's law 9): the Welkynd Stone from a source of tier 6 (used,
// your magicka is full) and the Varla Stone from tier 10 (used, every enchanted piece you wear is whole again - a DFU
// magic item's charges among them). A stone that would do nothing is not spent.
//
// Pinned by execution: their rows; their finds (late, from their tiers, never in rollUniqueFinds' place, the door's last
// draws); their uses through useItem's own registered arm (full, whole, spent one at a time; nothing spent for nothing);
// the Test Room's and the registration's wire.

import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { setPref, _resetForTests } from '../src/systems/uiPrefs.js';
import * as LR from '../src/systems/lootRarity.js';
import {
  WELKYND_STONE_TEMPLATE, VARLA_STONE_TEMPLATE, WELKYND_STONE_TIER, VARLA_STONE_TIER, AYLEID_STONE_TEMPLATES, STONE_TEXT,
  isWelkyndStone, isVarlaStone, welkyndStone, varlaStone, varlaMends,
} from '../src/systems/ayleidStones.js';
import { templateByIndex, ITEM_TEMPLATES } from '../src/systems/itemTemplates.js';
import { useItem, usableItem } from '../src/systems/useItem.js';
import { createWeapon } from '../src/combat/enemyEquipment.js';
import { mintCondition } from '../src/systems/itemTemplates.js';
import { equipItem } from '../src/systems/equip.js';
import { validLootItem } from '../src/systems/loot.js';
import { seedTestLoot } from '../src/systems/testRoom.js';
import { rollGemFind } from '../src/systems/gems.js';   // GEM2: the gem find, held off and put back

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const on = () => { _resetForTests(); setPref('lootRarity', true); };
const lcg = (seed) => () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return (seed >>> 8) / 0x800000; };
const player = (items = []) => ({ isPlayer: true, items, stats: { strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 }, skills: new Array(35).fill(30), level: 5, career: {}, activeEffects: [], health: 100, maxHealth: 100, magicka: 10, maxMagicka: 80 });

test('LOOT21: the two stones\' rows - the port\'s own beside the shard and the Portal Stone, miscellany on DFU\'s gem art; minted and carried as any piece', () => {
  on();
  assert.deepEqual([WELKYND_STONE_TEMPLATE, VARLA_STONE_TEMPLATE], [573, 574]);
  assert.ok(ITEM_TEMPLATES.length <= 573, 'past DFU\'s table');
  assert.deepEqual(AYLEID_STONE_TEMPLATES.map((t) => [t.name, t.worldTextureArchive, t.worldTextureRecord]), [['Welkynd Stone', 254, 5], ['Varla Stone', 254, 7]]);
  assert.equal(templateByIndex(573).name, 'Welkynd Stone');
  assert.equal(templateByIndex(574).name, 'Varla Stone');
  const w = welkyndStone(), v = varlaStone();
  assert.deepEqual([w.group, w.name, isWelkyndStone(w), isVarlaStone(w)], ['UselessItems2', 'Welkynd Stone', true, false], 'miscellany - a Gems piece is a crystal a slot takes');
  assert.deepEqual([v.group, v.name, isVarlaStone(v)], ['UselessItems2', 'Varla Stone', true]);
  assert.ok(v.value > w.value && w.value > 0);
  assert.ok(validLootItem(JSON.parse(JSON.stringify(w))) && validLootItem(JSON.parse(JSON.stringify(v))), 'the wire carries them');
  assert.ok(usableItem(w) && usableItem(v), 'the card offers Use');
  assert.equal(LR.rarityEligible(w), false, 'never laddered');
});

test('LOOT21: the finds - late, from tier 6 and tier 10, never in rollUniqueFinds\' place; the door\'s very last draws, its earlier pieces untouched', () => {
  on();
  const finds = LR.uniqueFinds();
  const wf = finds.find((f) => f.id === 'welkynd-stone'), vf = finds.find((f) => f.id === 'varla-stone');
  assert.deepEqual([wf.late, wf.minTier, vf.late, vf.minTier], [true, WELKYND_STONE_TIER, true, VARLA_STONE_TIER]);
  assert.deepEqual([WELKYND_STONE_TIER, VARLA_STONE_TIER], [6, 10]);
  assert.equal(LR.uniqueFindChance(wf, { kind: 'corpse', tier: 5 }), 0);
  assert.ok(LR.uniqueFindChance(wf, { kind: 'corpse', tier: 6 }) > 0);
  assert.equal(LR.uniqueFindChance(vf, { kind: 'pile', tier: 9 }), 0);
  assert.ok(LR.uniqueFindChance(vf, { kind: 'pile', tier: 10 }) > 0);
  // rollUniqueFinds never rolls them: at tier 21 it draws once for each find that is not late (none found - a found
  // Thunderlock's mint draws its own), and with every draw a find, still no stone
  let drawn = 0;
  LR.rollUniqueFinds({ kind: 'corpse', tier: 21, boss: true, luck: 50 }, () => { drawn++; return 0.999; });
  assert.equal(drawn, finds.filter((f) => !f.late).length);
  assert.ok(!LR.rollUniqueFinds({ kind: 'corpse', tier: 21, boss: true, luck: 50 }, () => 0).some((it) => isWelkyndStone(it) || isVarlaStone(it)));
  // rollLateFinds rolls them alone, the Welkynd first
  drawn = 0;
  const late = LR.rollLateFinds({ kind: 'corpse', tier: 21, boss: true, luck: 50 }, () => { drawn++; return 0; });
  assert.equal(drawn, 2);
  assert.deepEqual(late.map((it) => it.name), ['Welkynd Stone', 'Varla Stone']);
  assert.deepEqual(LR.rollLateFinds({ kind: 'corpse', tier: 8, luck: 50 }, () => 0).map((it) => it.name), ['Welkynd Stone'], 'tier 8: the Welkynd alone');
  drawn = 0;
  LR.rollLateFinds({ kind: 'corpse', tier: 8, luck: 50 }, () => { drawn++; return 0.999; });
  assert.equal(drawn, 1, 'a find under its tier costs a seed no draw');
  // the door: the stones are its last two draws - each seed's draws recorded, then replayed with the last two found and
  // not found: everything before them the seed's own. GEM1/GEM2 (bible/06-Systems/Gem-Sockets.md, PIN MOVED): the gem
  // arc's draws come after the stones (law 9) - the weapons' sockets and the gem find - so they are held off here, and
  // test/gem1_sockets.test.js pins that they follow
  LR._setWeaponSocketsForTests({ first: 0, more: 0 });
  LR.registerGemFind(null);
  const src = { kind: 'corpse', tier: 21, boss: true, family: null };
  try {
    for (let seed = 1; seed < 30; seed++) {
      const base = lcg(seed);
      const rec = [];
      LR.rollLootRarity([createWeapon(120, 1)], src, { rolls: () => { const v = base(); rec.push(v); return v; } });
      const head = rec.slice(0, -2);
      const replay = (tail) => { let k = 0; return () => (k < head.length ? head[k++] : tail[(k++) - head.length] ?? 0.5); };
      const a = [createWeapon(120, 1)];
      LR.rollLootRarity(a, src, { rolls: replay([0, 0]) });
      const b = [createWeapon(120, 1)];
      LR.rollLootRarity(b, src, { rolls: replay([0.999, 0.999]) });
      assert.deepEqual(a.slice(-2).map((it) => it.name), ['Welkynd Stone', 'Varla Stone'], `seed ${seed}: last`);
      assert.ok(!b.some((it) => isWelkyndStone(it) || isVarlaStone(it)));
      assert.deepEqual(JSON.stringify(a.slice(0, b.length)), JSON.stringify(b), `seed ${seed}: the rest the seed's own`);
    }
  } finally {
    LR._setWeaponSocketsForTests(null);
    LR.registerGemFind(rollGemFind);
  }
  // off: nothing
  _resetForTests();
  setPref('lootRarity', false);
  const offList = [createWeapon(120, 1)];
  LR.rollLootRarity(offList, src, { rolls: () => 0 });
  assert.equal(offList.length, 1);
  _resetForTests();
});

test('LOOT21: the uses through useItem\'s registered arm - the Welkynd fills the magicka, the Varla makes every enchanted piece worn whole; one off a stack; nothing spent for nothing', () => {
  on();
  // the Welkynd Stone
  const w = Object.assign(welkyndStone(), { stackCount: 2 });
  const e = player([w]);
  const r = useItem(w, e.items, { entity: e });
  assert.deepEqual([r.kind, r.text], ['text', STONE_TEXT.welkynd]);
  assert.equal(e.magicka, 80, 'full');
  assert.equal(w.stackCount, 1, 'one off the stack');
  const again = useItem(w, e.items, { entity: e });
  assert.equal(again.text, STONE_TEXT.welkyndFull, 'full already: said');
  assert.deepEqual([w.stackCount, e.items.includes(w)], [1, true], 'and not spent');
  e.magicka = 0;
  useItem(w, e.items, { entity: e });
  assert.equal(e.items.includes(w), false, 'the last one gone');
  assert.equal(useItem(welkyndStone(), [], { entity: null }).text, STONE_TEXT.nobody);
  // the Varla Stone
  const rare = LR.applyRarity(createWeapon(120, 1), 'rare', lcg(3));   // its flavour enchants it
  const dfuMagic = Object.assign(mintCondition({ group: 'Jewellery', templateIndex: 135, name: 'Ring', flags: 0 }), { enchantments: [{ type: 0, param: 5 }] });
  const plain = mintCondition({ group: 'Armor', templateIndex: 102, material: 0x0201, name: 'Cuirass', flags: 0 });
  const carried = LR.applyRarity(createWeapon(113, 1), 'rare', lcg(4));
  const v = varlaStone();
  const p = player([rare, dfuMagic, plain, carried, v]);
  for (const it of [rare, dfuMagic, plain]) equipItem(p, it);
  for (const it of [rare, dfuMagic, plain, carried]) it.currentCondition = 1;
  assert.deepEqual(new Set(varlaMends(p)), new Set([rare, dfuMagic]), 'the worn enchanted - never the plain cuirass or the carried blade');
  const out = useItem(v, p.items, { entity: p });
  assert.equal(out.text, STONE_TEXT.varla(2));
  assert.deepEqual([rare.currentCondition, dfuMagic.currentCondition], [rare.maxCondition, dfuMagic.maxCondition], 'whole - a DFU magic item\'s charges among them');
  assert.deepEqual([plain.currentCondition, carried.currentCondition], [1, 1], 'a plain piece and an unworn one untouched');
  assert.equal(p.items.includes(v), false, 'spent');
  const v2 = varlaStone();
  p.items.push(v2);
  assert.equal(useItem(v2, p.items, { entity: p }).text, STONE_TEXT.varlaWhole, 'all whole: said');
  assert.ok(p.items.includes(v2), 'and not spent');
  assert.equal(STONE_TEXT.varla(1), 'The Varla Stone flares and is spent. An enchanted piece you wear is whole again.');
});

test('LOOT21: the Test Room lays one of each; the registration rides the Thunderlock\'s wire', () => {
  on();
  const added = seedTestLoot({ items: [] }, lcg(1));
  assert.equal(added.filter(isWelkyndStone).length, 1);
  assert.equal(added.filter(isVarlaStone).length, 1);
  assert.match(read('src/systems/worldTick.js'), /import '\.\/ayleidStones\.js';   \/\/ LOOT21/, 'registered at the import, as the Thunderlock is');
  _resetForTests();
});

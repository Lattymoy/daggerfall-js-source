// LR1-LR3 - LOOT RARITY (2026-09-14, Mac: "building on unleveled loot.
// My goal is to transform things into a diablo style system with
// rarity ... Make this the most detailed and best that it can be").
//
// The port's own item ladder over Daggerfall's loot
// (src/systems/lootRarity.js): Common, Magic, Rare, Legendary, with
// DFU's artifacts as the ceiling. An ENHANCED row, off by default and
// forced on online. The laws pinned here:
//   - OFF IS DFU EXACTLY: no field written, no read moved, no tint.
//   - ONE LADDER: every enchanted item derives Magic, an artifact is
//     the top, a rolled item wears its own tier.
//   - THE SOURCE SETS THE ODDS, never the player's level: the roll
//     reads the corpse's level / the dungeon's kind, luck, and boss.
//   - AFFIXES ARE NUMBERS: six kinds, banded per tier, folded onto the
//     wearer at the equip seam and read at DFU's own read sites.
//   - IDENTIFY IS DFU'S OWN: a Rare or Legendary carries a real DFU
//     enchantment and so drops unidentified under tradeModes'
//     itemIsIdentified; a Magic with numbers only reads at once.
//   - FOUR HOSTS: every list the hosts mint rolls at its source.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setPref, _resetForTests, PREF_DEFAULTS } from '../src/systems/uiPrefs.js';
import { ONLINE_FORCED_PREFS } from '../src/systems/onlineLane.js';
import { FEATURES, checkFeatures } from '../src/systems/features.js';
import * as LR from '../src/systems/lootRarity.js';
import { createRandomWeapon, createRandomArmor, LOOT_ARRAY_FIELDS, validLootItem } from '../src/systems/loot.js';
import { createWeapon } from '../src/combat/enemyEquipment.js';
import { mintCondition, itemBaseValue } from '../src/systems/itemTemplates.js';
import { GROUP_TEMPLATE_INDICES } from '../src/systems/itemTemplatesData.js';
import { itemLongName, resolveItemName } from '../src/systems/itemInfo.js';
import { itemIsIdentified } from '../src/systems/tradeModes.js';
import { enchantmentCost } from '../src/systems/enchantmentCatalogue.js';
import { ENCHANTMENT_TYPES } from '../src/formats/magicDef.js';
import { equipItem, unequipItem, equipTableOf, armorBodyParts } from '../src/systems/equip.js';
import { computeEntityMods, entityModsOf, entityArmorMod, entityResistMod, entityWeightMult, weaponDamageMods, entityFoldNames } from '../src/systems/entityMods.js';   // RF1: the fold is read through the entity's channels
import { BODY_PARTS } from '../src/systems/armorMaterials.js';
import { liveStat } from '../src/systems/statMods.js';
import { skillValue, SKILLS } from '../src/systems/skills.js';
import { entityMaxEncumbrance, maxEncumbrance } from '../src/combat/formulas.js';
import { savingThrow, EFFECT_FLAGS } from '../src/systems/spellcast.js';
import { itemBackgroundColour, scrollerToolTipText } from '../src/ui/itemScroller.js';
import { hoverLines } from '../src/ui/lootHover.js';
import { playRareDrop } from '../src/scenes/corpseMarker.js';
import { TEST_LOOT, testEntryById, seedTestLoot, TEST_LOOT_BASES } from '../src/systems/testRoom.js';
import { snapshotPlayer, restorePlayer } from '../src/systems/save.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

const on = () => { _resetForTests(); setPref('lootRarity', true); };
const off = () => { _resetForTests(); };
const lcg = (seed) => () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return (seed >>> 8) / 0x800000; };   // [0, 1) - LR4: /0x7fffff could answer exactly 1
const sword = () => createWeapon(120, 1);   // a steel longsword
const cuirass = () => mintCondition({ group: 'Armor', templateIndex: 102, material: 0x0200 + 1, name: 'Cuirass', flags: 0 });
const ring = () => mintCondition({ group: 'Jewellery', templateIndex: 135, name: 'Ring', flags: 0 });
const typeKey = (t) => Object.keys(ENCHANTMENT_TYPES).find((k) => ENCHANTMENT_TYPES[k] === t);
const entityOf = () => ({ isPlayer: true, items: [], stats: { strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 }, skills: new Array(35).fill(30), level: 5, career: {} });

test('LR1: the switch - off by default (DFU\'s loot is the 1:1 law), forced on online, one Enhanced row on the home', () => {
  assert.equal(PREF_DEFAULTS.lootRarity, false, 'off by default, as enhancedAI is: it changes the rules of what drops');
  assert.equal(ONLINE_FORCED_PREFS.lootRarity, true, 'the enhanced lane, whole (OL1)');
  const row = FEATURES.find((f) => f.id === 'loot-rarity');
  assert.ok(row, 'the row is on the home');
  assert.deepEqual(row.kinds, ['enhanced']);
  assert.deepEqual(row.control, { store: 'prefs', key: 'lootRarity' });
  assert.match(row.note, /Magic .*Rare .*Legendary/s, 'the note names the ladder');
  assert.match(row.note, /never your level/, 'and the source law');
  assert.match(row.note, /unidentified/, 'and the identify loop');
  assert.deepEqual(checkFeatures(FEATURES), []);
  off();
  assert.equal(LR.lootRarityOn(), false);
  on();
  assert.equal(LR.lootRarityOn(), true);
});

test('LR1: one ladder - a rolled tier is the item\'s own, an enchanted item derives Magic, an artifact is the ceiling', () => {
  assert.deepEqual(LR.RARITY_ORDER, ['common', 'magic', 'rare', 'legendary', 'artifact']);
  assert.deepEqual(LR.RARITY_ORDER.map((t) => LR.RARITIES[t].rank), [0, 1, 2, 3, 4]);
  assert.equal(LR.rarityOf(sword()), 'common');
  assert.equal(LR.rarityOf({ ...sword(), enchantments: [{ type: 0, param: 5 }] }), 'magic', 'a MAGIC.DEF item is Magic');
  assert.equal(LR.rarityOf({ ...sword(), customEnchantments: [{ type: 10, param: 1 }] }), 'magic', 'a made item is Magic');
  assert.equal(LR.rarityOf({ ...sword(), rarity: 'rare' }), 'rare');
  assert.equal(LR.rarityOf({ ...sword(), rarity: 'artifact' }), 'common', 'the field cannot forge an artifact');
  assert.equal(LR.rarityOf({ ...sword(), magic: true, enchantments: [] }), 'magic', 'LR4: a MAGIC.DEF row whose effects all filtered out is still DFU\'s magic item');
  assert.equal(LR.rarityOf({ ...sword(), rarity: 'rare', artifact: true }), 'artifact', 'an artifact outranks any field');
  assert.equal(LR.rarityOf(null), 'common');
  // eligibility: weapons but arrows, armour, jewellery; never a quest item, an artifact, or an enchanted item
  assert.ok(LR.rarityEligible(sword()) && LR.rarityEligible(cuirass()) && LR.rarityEligible(ring()));
  assert.ok(!LR.rarityEligible(createWeapon(131, 0)), 'an arrow');
  assert.ok(!LR.rarityEligible({ ...sword(), questItem: true }));
  assert.ok(!LR.rarityEligible({ ...sword(), artifact: true }));
  assert.ok(!LR.rarityEligible({ ...sword(), magic: true, enchantments: [{ type: 0, param: 5 }] }), 'DFU\'s magic item keeps DFU\'s name');
  assert.ok(!LR.rarityEligible({ group: 'MensClothing', templateIndex: 163 }));
  assert.ok(!LR.rarityEligible({ ...sword(), equipSlot: 5 }), 'a worn item');
  assert.ok(!LR.rarityEligible({ ...sword(), rarity: 'magic', affixes: [{ id: 'damage', value: 5 }] }), 'LR4: one roll per item, ever - a Magic never rolls again');
});

test('LR1: the odds follow the SOURCE - monotone in tier, luck and boss, capped, per mille, and every dungeon kind graded', () => {
  assert.equal(LR.DUNGEON_RARITY_TIER.length, 19, 'DFRegion.DungeonTypes, all nineteen');
  for (const t of LR.DUNGEON_RARITY_TIER) assert.ok(Number.isInteger(t) && t >= 0 && t <= 21);
  assert.equal(LR.dungeonRarityTier(16), 18, 'Volcanic Caves at the top');
  assert.equal(LR.dungeonRarityTier(18), 3, 'a Cemetery at the bottom');
  assert.equal(LR.dungeonRarityTier(99), 0, 'an unknown kind rolls at the floor');
  const low = LR.rarityChances({ kind: 'corpse', tier: 1 });
  const high = LR.rarityChances({ kind: 'corpse', tier: 15 });
  const lucky = LR.rarityChances({ kind: 'corpse', tier: 15, luck: 90 });
  const unlucky = LR.rarityChances({ kind: 'corpse', tier: 15, luck: 10 });
  const pile = LR.rarityChances({ kind: 'pile', tier: 15 });
  const boss = LR.rarityChances({ kind: 'corpse', tier: 15, boss: true });
  for (const k of ['magic', 'rare', 'legendary']) {
    assert.ok(low[k] < high[k], `${k} rises with the tier`);
    assert.ok(unlucky[k] < high[k] && high[k] < lucky[k], `${k} follows luck`);
    assert.ok(high[k] < pile[k] && pile[k] < boss[k], `${k}: a pile pays more than a corpse, a boss most`);
  }
  const top = LR.rarityChances({ kind: 'pile', tier: 21, boss: true, luck: 100 });
  assert.deepEqual(top, { magic: LR.RARITY_WEIGHTS.magic.cap, rare: LR.RARITY_WEIGHTS.rare.cap, legendary: LR.RARITY_WEIGHTS.legendary.cap }, 'the caps hold at the ceiling');
  assert.ok(top.legendary <= top.rare && top.rare <= top.magic, 'the ladder never inverts');
  assert.deepEqual(LR.rarityChances({ kind: 'corpse', tier: 0, luck: 0 }), { magic: 0, rare: 0, legendary: 0 }, 'luck 0 at tier 0 finds nothing');
  // the roll: one draw in [0, 1000), highest tier first
  const c = LR.rarityChances({ kind: 'corpse', tier: 10 });
  assert.equal(LR.rollRarity({ kind: 'corpse', tier: 10 }, () => (c.legendary - 0.5) / 1000), 'legendary');
  assert.equal(LR.rollRarity({ kind: 'corpse', tier: 10 }, () => (c.rare - 0.5) / 1000), 'rare');
  assert.equal(LR.rollRarity({ kind: 'corpse', tier: 10 }, () => (c.magic - 0.5) / 1000), 'magic');
  assert.equal(LR.rollRarity({ kind: 'corpse', tier: 10 }, () => 0.999), 'common');
  // the sources
  assert.deepEqual(LR.corpseSource({ level: 7, affinity: 'Animal' }, 3), { kind: 'corpse', tier: 7, boss: false });
  assert.deepEqual(LR.corpseSource({ level: 3, affinity: 'Daedra' }, 3), { kind: 'corpse', tier: 3, boss: true }, 'any Daedra is a boss');
  assert.deepEqual(LR.corpseSource({ level: LR.BOSS_LEVEL }, 1), { kind: 'corpse', tier: LR.BOSS_LEVEL, boss: true });
  assert.deepEqual(LR.corpseSource({}, 9), { kind: 'corpse', tier: 9, boss: false }, 'a class enemy has no level in ENEMY_BASICS - its entity level stands in');
  assert.deepEqual(LR.pileSource(12), { kind: 'pile', tier: 12, boss: false });
});

test('LR2: the affix kinds - six, each banded per tier, each with a word for the name and a line for the tooltip', () => {
  assert.deepEqual(LR.AFFIX_IDS, ['damage', 'armor', 'weight', 'stat', 'resist', 'skill']);
  for (const id of LR.AFFIX_IDS) {
    const k = LR.AFFIX_KINDS[id];
    assert.ok(['prefix', 'suffix'].includes(k.slot));
    for (const tier of ['magic', 'rare', 'legendary']) {
      const [lo, hi] = LR.AFFIX_RANGES[id][tier];
      assert.ok(lo > 0 && lo <= hi, `${id} ${tier} range`);
    }
    assert.ok(LR.AFFIX_RANGES[id].magic[1] <= LR.AFFIX_RANGES[id].rare[1] && LR.AFFIX_RANGES[id].rare[1] <= LR.AFFIX_RANGES[id].legendary[1], `${id} bands rise`);
    assert.ok(LR.AFFIX_WORTH[id] > 0);
    const params = k.params ?? [null];
    for (const p of params) for (const band of [0, 1, 2]) assert.ok(k.word(band, p), `${id}/${p} has a word at band ${band}`);
  }
  assert.equal(LR.affixLabel({ id: 'damage', value: 12 }), '+12% damage');
  assert.equal(LR.affixLabel({ id: 'stat', param: 'strength', value: 5 }), '+5 Strength');
  assert.equal(LR.affixLabel({ id: 'resist', param: 'fire', value: 20 }), '+20% Fire resistance');
  assert.equal(LR.affixLabel({ id: 'skill', param: SKILLS.Stealth, value: 10 }), '+10 Stealth');
  assert.equal(LR.affixLabel({ id: 'weight', value: 25 }), '+25% carrying capacity');
  assert.equal(LR.affixLabel({ id: 'armor', value: 6 }), '+6 armor');
  assert.equal(LR.affixWord({ id: 'stat', param: 'strength', value: 3 }, 'magic'), 'of the Ox');
  assert.equal(LR.affixWord({ id: 'stat', param: 'strength', value: 12 }, 'legendary'), 'of the Titan');
  assert.equal(LR.affixWord({ id: 'stat', param: 'strength' }, 'magic'), '', 'LR4: a record with no value is malformed and names nothing');
});

test('LR2: rollAffixes - the count per tier, no kind or param repeated, only the group\'s kinds, a Rare with both name parts', () => {
  const rolls = lcg(11);
  for (let i = 0; i < 200; i++) {
    for (const [make, group] of [[sword, 'Weapons'], [cuirass, 'Armor'], [ring, 'Jewellery']]) {
      for (const tier of ['magic', 'rare']) {
        const item = make();
        const out = LR.rollAffixes(item, tier, rolls);
        const [min, max] = LR.AFFIX_COUNTS[tier];
        assert.ok(out.length >= min && out.length <= max, `${group} ${tier}: ${out.length} affixes`);
        const sigs = out.map((a) => `${a.id}:${a.param ?? ''}`);
        assert.equal(new Set(sigs).size, sigs.length, 'no repeat');
        for (const a of out) {
          assert.ok(LR.AFFIX_KINDS[a.id].groups.includes(group), `${a.id} may land on ${group}`);
          const [lo, hi] = LR.AFFIX_RANGES[a.id][tier];
          assert.ok(a.value >= lo && a.value <= hi, `${a.id} in band`);
          if (LR.AFFIX_KINDS[a.id].params) assert.ok(LR.AFFIX_KINDS[a.id].params.includes(a.param));
          else assert.equal(a.param, undefined);
        }
        if (tier === 'rare') {
          assert.ok(out.some((a) => LR.AFFIX_KINDS[a.id].slot === 'prefix') && out.some((a) => LR.AFFIX_KINDS[a.id].slot === 'suffix'), 'a Rare names both parts');
        }
      }
    }
  }
});

test('LR2: applyRarity - the field, the affixes, the name, the value; a Rare\'s DFU flavour; a Legendary\'s record; Common untouched', () => {
  on();
  const rolls = lcg(3);
  const plain = sword();
  const before = JSON.stringify(plain);
  assert.equal(LR.applyRarity(plain, 'common', rolls), plain);
  assert.equal(JSON.stringify(plain), before, 'Common writes nothing');
  const m = LR.applyRarity(sword(), 'magic', rolls);
  assert.equal(m.rarity, 'magic');
  assert.ok(m.affixes.length >= 1 && m.affixes.length <= 2);
  assert.equal(m.enchantments, undefined, 'a Magic carries no DFU enchantment');
  assert.ok(m.name.includes('Longsword') && m.name !== 'Longsword', `named: ${m.name}`);
  assert.equal(m.value, itemBaseValue(m) + LR.affixesWorth(m.affixes), 'the base plus the affixes');
  const r = LR.applyRarity(cuirass(), 'rare', rolls);
  assert.equal(r.rarity, 'rare');
  assert.ok(r.affixes.length >= 3 && r.affixes.length <= 4);
  assert.equal(r.enchantments.length, 1, 'one flavour');
  assert.ok(LR.RARE_FLAVOURS.Armor.some((f) => f.type === r.enchantments[0].type && f.param === r.enchantments[0].param), 'from the armour pool');
  assert.match(r.name, /^\S+ Cuirass of /, `a two-part name: ${r.name}`);
  assert.equal(r.value, itemBaseValue(r) + LR.affixesWorth(r.affixes) + LR.RARE_ENCHANT_WORTH);
  const l = LR.applyRarity(sword(), 'legendary', rolls);
  assert.equal(l.rarity, 'legendary');
  const rec = LR.legendaryById(l.legendary);
  assert.ok(rec && rec.group === 'Weapons' && (!rec.templates || rec.templates.includes(120)), 'a record that fits a longsword');
  assert.equal(l.name, rec.name);
  assert.deepEqual(l.affixes, rec.affixes);
  assert.deepEqual(l.enchantments, [rec.enchantment]);
  // a chosen record through the same door (the Test Room's way)
  const chosen = LR.applyRarity(ring(), 'legendary', rolls, [LR.legendaryById('foxglove')]);
  assert.equal(chosen.name, 'Foxglove');
  // no record fits: the tier below
  const bracer = mintCondition({ group: 'Armor', templateIndex: 103, material: 0x0200, name: 'Gauntlets', flags: 0 });
  const fits = LR.legendariesFor(bracer).length;
  const fell = LR.applyRarity(mintCondition({ group: 'Armor', templateIndex: 103, material: 0x0200, name: 'Gauntlets', flags: 0 }), 'legendary', rolls);
  assert.equal(fell.rarity, fits ? 'legendary' : 'rare');
});

test('LR2: every flavour and every Legendary is priced by DFU\'s own catalogue and fits its group', () => {
  for (const [group, list] of Object.entries(LR.RARE_FLAVOURS)) {
    assert.ok(['Weapons', 'Armor', 'Jewellery'].includes(group));
    for (const f of list) {
      const key = typeKey(f.type);
      assert.ok(key, `${group}: type ${f.type} is a catalogue type`);
      const cost = enchantmentCost(key, f.param);
      assert.ok(cost !== null && cost > 0, `${group}: ${key}/${f.param} is a priced POWER (${cost})`);
    }
  }
  const ids = LR.LEGENDARIES.map((l) => l.id);
  assert.equal(new Set(ids).size, ids.length, 'ids unique');
  assert.ok(LR.LEGENDARIES.length >= 10);
  for (const rec of LR.LEGENDARIES) {
    assert.ok(rec.name && rec.lore, rec.id);
    assert.ok(['Weapons', 'Armor', 'Jewellery'].includes(rec.group));
    for (const t of rec.templates ?? []) assert.ok(GROUP_TEMPLATE_INDICES[rec.group].includes(t), `${rec.id}: template ${t} is of its group`);
    assert.ok(rec.affixes.length >= 3, `${rec.id}: a signature of three or more`);
    for (const a of rec.affixes) {
      const k = LR.AFFIX_KINDS[a.id];
      assert.ok(k && k.groups.includes(rec.group), `${rec.id}: ${a.id} may land on ${rec.group}`);
      if (k.params) assert.ok(k.params.includes(a.param), `${rec.id}: ${a.id} param ${a.param}`);
      const [lo, hi] = LR.AFFIX_RANGES[a.id].legendary;
      assert.ok(a.value >= lo && a.value <= hi, `${rec.id}: ${a.id} ${a.value} in the legendary band`);
      assert.ok(LR.affixLabel(a));
    }
    const key = typeKey(rec.enchantment.type);
    const cost = enchantmentCost(key, rec.enchantment.param);
    assert.ok(cost !== null && cost > 0, `${rec.id}: ${key}/${rec.enchantment.param} priced (${cost})`);
    // every record can be reached by a roll on some base
    const bases = [...Array(18).keys()].map((i) => ({ group: 'Weapons', templateIndex: 113 + i })).concat([...Array(11).keys()].map((i) => ({ group: 'Armor', templateIndex: 102 + i })), [133, 135].map((t) => ({ group: 'Jewellery', templateIndex: t })));
    assert.ok(bases.some((b) => LR.legendariesFor(b).includes(rec)), `${rec.id} lands on some base`);
  }
});

test('LR3: identify is Daggerfall\'s own - a Rare drops unidentified and reads as its template, a Magic reads at once, a Legendary is named like an artifact', () => {
  on();
  const rolls = lcg(5);
  const m = LR.applyRarity(sword(), 'magic', rolls);
  assert.equal(itemIsIdentified(m), true, 'numbers only: no enchantment, so identified');
  assert.equal(itemLongName(m), `Steel ${m.name}`, 'the material prefix, then the rolled name');
  const r = LR.applyRarity(sword(), 'rare', rolls);
  assert.equal(itemIsIdentified(r), false, 'a real DFU enchantment: unidentified until read');
  assert.equal(resolveItemName(r), 'Longsword', 'ResolveItemName\'s early return');
  assert.equal(itemLongName(r), 'Longsword', 'no material, no name - ResolveItemLongName\'s early return');
  assert.deepEqual(LR.rarityLines(r), ['Rare', 'Unidentified'], 'the tooltip says the tier and no more');
  r.isIdentified = true;   // the Identify spell / the Mages Guild
  assert.equal(itemLongName(r), `Steel ${r.name}`);
  const lines = LR.rarityLines(r);
  assert.equal(lines[0], 'Rare');
  assert.equal(lines.length, 1 + r.affixes.length + 1, 'the tier, every affix, the enchantment');
  assert.match(lines[lines.length - 1], /^[A-Z][a-z]+( [A-Z][a-z]+)*(: .+)?$/, `the catalogue name: ${lines[lines.length - 1]}`);
  const l = LR.applyRarity(sword(), 'legendary', rolls);
  assert.equal(itemIsIdentified(l), false);
  assert.equal(itemLongName(l), 'Longsword');
  l.isIdentified = true;
  assert.equal(itemLongName(l), l.name, 'a Legendary reads by its own name, no material - as an artifact does');
  assert.equal(LR.rarityLines(l).at(-1), LR.legendaryById(l.legendary).lore, 'its lore is the last line');
  // off: no lines, whatever the item
  off();
  assert.deepEqual(LR.rarityLines(r), []);
  assert.deepEqual(LR.rarityLines(l), []);
});

test('LR2: the fold - worn affixes land on liveStat, skillValue, the armour term, the resistance, the carrying capacity; off is zero; the equip listener keeps it current', () => {
  on();
  const e = entityOf();
  const base = { str: liveStat(e, 'strength'), stealth: skillValue(e, SKILLS.Stealth), carry: entityMaxEncumbrance(e) };
  assert.equal(base.carry, maxEncumbrance(50));
  const r = ring();
  r.rarity = 'rare';
  r.affixes = [{ id: 'stat', param: 'strength', value: 8 }, { id: 'skill', param: SKILLS.Stealth, value: 15 }, { id: 'resist', param: 'fire', value: 30 }, { id: 'weight', value: 20 }];
  const c = cuirass();
  c.rarity = 'magic';
  c.affixes = [{ id: 'armor', value: 6 }, { id: 'resist', param: 'fire', value: 10 }];
  e.items.push(r, c);
  equipItem(e, r);
  equipItem(e, c);
  assert.equal(liveStat(e, 'strength'), base.str + 8);
  assert.equal(skillValue(e, SKILLS.Stealth), base.stealth + 15);
  assert.equal(entityArmorMod(e, BODY_PARTS.Chest), -6, 'LR4: on the cuirass\'s own part (RF1: read through the entity\'s channel, points OFF the blow)');
  for (const p of [BODY_PARTS.Head, BODY_PARTS.Legs, BODY_PARTS.Feet, BODY_PARTS.Hands]) assert.equal(entityArmorMod(e, p), 0, 'and no other');
  assert.deepEqual(armorBodyParts(c), [BODY_PARTS.Chest]);
  assert.deepEqual(armorBodyParts({ group: 'Armor', templateIndex: 112 }), [BODY_PARTS.Head, BODY_PARTS.LeftArm, BODY_PARTS.Hands, BODY_PARTS.Legs], 'a tower shield covers its SHIELD_PARTS');
  assert.deepEqual(armorBodyParts(r), [], 'a ring covers nothing');
  assert.equal(entityResistMod(e, ['fire']), 40, 'two pieces sum');
  assert.equal(entityResistMod(e, ['frost']), 0);
  assert.equal(entityResistMod(e, ['fire', 'frost']), 40);
  assert.equal(entityWeightMult(e), 0.2);
  assert.equal(entityMaxEncumbrance(e), maxEncumbrance(58) + Math.trunc(maxEncumbrance(58) * 0.2), 'the multiplier the enchantment fold\'s own read applies');
  // the saving throw: a Fire spell meets +40 in the biography slot; a resisted spell answers 0
  const rolls = () => 0.5;
  const save = savingThrow(0, EFFECT_FLAGS.Fire, e, 0, rolls);   // no elemental-resistance effect, so the roll runs
  e._mods = null;
  const bare = savingThrow(0, EFFECT_FLAGS.Fire, e, 0, rolls);
  computeEntityMods(e);
  assert.notEqual(save, bare, 'the resistance affix moved the saving throw');
  // unequip: the listener refolds
  unequipItem(e, c);
  assert.equal(entityArmorMod(e, BODY_PARTS.Chest), 0);
  assert.equal(entityResistMod(e, ['fire']), 30);
  // off: the fold empties on the next refold and every read is 0
  off();
  computeEntityMods(e);
  assert.equal(liveStat(e, 'strength'), base.str);
  assert.equal(skillValue(e, SKILLS.Stealth), base.stealth);
  assert.equal(entityResistMod(e, ['fire']), 0);
  assert.equal(entityMaxEncumbrance(e), base.carry);
  // the weapon's own damage affix, over its roll
  on();
  const w = sword();
  w.affixes = [{ id: 'damage', value: 50 }];
  assert.equal(LR.affixWeaponDamage(w, 10), 15);
  assert.equal(weaponDamageMods(w, 10), 15, 'RF1: through the registered weapon modifier');
  assert.equal(LR.affixWeaponDamage(sword(), 10), 10);
  off();
  assert.equal(LR.affixWeaponDamage(w, 10), 10, 'off: the roll stands');
  assert.equal(weaponDamageMods(w, 10), 10);
  assert.ok(entityFoldNames().includes(LR.LOOT_RARITY_FOLD), 'the fold is registered with the entity');
});

test('LR1: rollLootRarity - off or sourceless returns the DFU list untouched; on, only eligible items roll, at the source', () => {
  const rolls = lcg(9);
  const mint = () => { const out = []; for (let i = 0; i < 30; i++) out.push(i % 2 ? createRandomWeapon(5, rolls) : createRandomArmor(5, rolls)); out.push({ group: 'PlantIngredients1', templateIndex: 0, name: 'Twigs' }); return out; };
  off();
  const a = mint(); const beforeA = JSON.stringify(a);
  assert.equal(LR.rollLootRarity(a, { kind: 'pile', tier: 21, boss: true }, { rolls, luck: 100 }), a);
  assert.equal(JSON.stringify(a), beforeA, 'off: not one field');
  on();
  const b = mint(); const beforeB = JSON.stringify(b);
  LR.rollLootRarity(b, null, { rolls });
  assert.equal(JSON.stringify(b), beforeB, 'no source: nothing rolls');
  const c = mint();
  LR.rollLootRarity(c, { kind: 'pile', tier: 21, boss: true }, { rolls, luck: 100 });
  const rolled = c.filter((it) => it.rarity);
  assert.ok(rolled.length >= 10, `at the ceiling most roll: ${rolled.length} of 30`);
  assert.ok(rolled.every((it) => it.group !== 'PlantIngredients1' && it.templateIndex !== 131));
  assert.ok(rolled.every((it) => Array.isArray(it.affixes) && it.affixes.length && it.name));
  assert.equal(LR.bestRarity(c) !== 'common', true);
  const d = mint();
  LR.rollLootRarity(d, { kind: 'corpse', tier: 0 }, { rolls: () => 0.999, luck: 50 });
  assert.ok(d.every((it) => !it.rarity), 'a floor source with a high draw rolls nothing');
  assert.equal(LR.bestRarity([]), null);
  assert.equal(LR.bestRarity(d), 'common');
});

test('LR1: four hosts - every list a host mints rolls at its source, and the pile\'s tier is the dungeon\'s', () => {
  const dc = read('src/scenes/dungeonContext.js');
  assert.equal((dc.match(/spawnEnemyLoot\(entity, e\.mobileType, basics, D\.playerEntity\)/g) ?? []).length, 2, 'both dungeon spawn arms, through the one seam (RF2), whose corpse door is LR4\'s');
  assert.match(dc, /rollLootRarity\(items, pileSource\(dungeonRarityTier\(dfLocation\.mapTableData\.dungeonType\)\), \{ luck: liveStat\(playerEntity, 'luck'\) \}\)/, 'the treasure piles at the dungeon\'s tier');
  assert.match(read('src/scenes/exteriorFoes.js'), /spawnEnemyLoot\(entity, mobileType, basics, playerEntity, \{ rolls \}\)/, 'the exterior foes, off the same stream');
  assert.match(read('src/scenes/cityGuards.js'), /spawnEnemyLoot\(entity, GUARD_MOBILE_TYPE, basics, playerEntity, \{ rolls: rand \}\)/, 'the watch');
  assert.match(read('src/scenes/hostCombat.js'), /rollCorpseLoot\(entity, basics, \{ rolls, luck: liveStat\(player, 'luck'\) \}\);/, 'the corpse door, in the one seam (RF2)');
  assert.match(read('src/scenes/interiorContext.js'), /rollLootRarity\(addPileLootExtras\(generateLootItems\(lootKey, \{ level, gender \}\), lootKey\), pileSource\(INTERIOR_RARITY_TIER\), \{ luck \}\)/, 'a tavern\'s pile');
  assert.match(read('src/scenes/worldModes.js'), /luck: liveStat\(playerEntity, 'luck'\),   \/\/ LR1/, 'the interior host hands its luck in');
  // the reads, at DFU's own read sites
  const f = read('src/combat/formulas.js');
  // RF1: the reads are the entity's channels' - test/rf1_entitymods.test.js pins each site; here, that the fold is registered there
  assert.match(read('src/systems/lootRarity.js'), /registerEntityFold\(LOOT_RARITY_FOLD, affixFold\);\nregisterWeaponDamageMod\(LOOT_RARITY_FOLD, affixWeaponDamage\);/, 'the fold and the weapon modifier, registered with the entity');
  assert.match(read('src/systems/equip.js'), /function fireEquipChange\(entity\) \{\n  _hooks\.onEquipChange\?\.\(entity\);\n  for \(const fn of _equipListeners\) fn\(entity\);\n\}/, 'the listener door beside the enchantment hook');
});

test('LR1: the wire and the save carry the two fields - affixes is an array field, a string there is refused', () => {
  assert.ok(LOOT_ARRAY_FIELDS.includes('affixes'));
  on();
  const r = LR.applyRarity(sword(), 'rare', lcg(2));
  const back = validLootItem(JSON.parse(JSON.stringify(r)));
  assert.ok(back && back.rarity === 'rare' && Array.isArray(back.affixes) && back.affixes.length === r.affixes.length);
  assert.equal(validLootItem({ ...r, affixes: '!' }), null, 'a forged affix list is refused (AUDIT WORLD4 B1\'s law)');
  // the save: the item rides whole, and the restore's equip rebuild refolds
  const e = entityOf();
  e.items.push(r);
  equipItem(e, r);
  const snap = snapshotPlayer(e);
  const fresh = entityOf();
  restorePlayer(fresh, snap);
  const worn = fresh.items.find((it) => it.rarity === 'rare');
  assert.ok(worn && worn.equipSlot != null && worn.affixes.length === r.affixes.length && worn.name === r.name);
  assert.deepEqual(entityModsOf(fresh).stats, computeEntityMods(e).stats, 'the same fold on both');
});

test('LR1: the skins - the native cell tints and the tooltip lists, the enhanced rows wear the tier, the plaque too; the CSS hexes are the table\'s', () => {
  on();
  const r = LR.applyRarity(sword(), 'rare', lcg(4));
  r.isIdentified = true;
  assert.deepEqual(itemBackgroundColour(r, {}), LR.RARITIES.rare.tint, 'the cell tint, after DFU\'s three');
  assert.deepEqual(itemBackgroundColour({ ...r, questItem: true }, {}), [0, 0.25, 0, 0.5], 'a quest item keeps DFU\'s green');
  assert.equal(itemBackgroundColour(sword(), {}), null, 'Common: no tint');
  const tip = scrollerToolTipText(r);
  assert.equal(tip.split('\r')[0], itemLongName(r));
  assert.deepEqual(tip.split('\r').slice(1), LR.rarityLines(r), 'one row per line');
  assert.equal(scrollerToolTipText(sword()), itemLongName(sword()), 'Common: the long name alone');
  assert.deepEqual(hoverLines([r]).shown[0], { name: itemLongName(r) === r.name ? r.name : resolveItemName(r), stack: 0, rarity: 'rare' });
  const u = LR.applyRarity(sword(), 'rare', lcg(6));
  assert.equal(hoverLines([u]).shown[0].name, 'Longsword', 'unidentified on the plaque too');
  assert.equal(LR.rarityAttr(r), 'rare');
  assert.equal(LR.rarityColour(r), LR.RARITIES.rare.colour);
  assert.equal(LR.rarityAttr(sword()), null);
  off();
  assert.equal(itemBackgroundColour(r, {}), null, 'off: no tint');
  assert.equal(scrollerToolTipText(r), itemLongName(r), 'off: no lines');
  assert.equal(hoverLines([r]).shown[0].rarity, null);
  assert.equal(LR.rarityColour(r), null);
  const css = read('src/ui/enhancedStyle.js');
  for (const t of ['magic', 'rare', 'legendary', 'artifact']) {
    assert.match(css, new RegExp(`\\.itemrow\\[data-rarity="${t}"\\] \\.itemname > span:first-child, \\.packdetail \\.card\\[data-rarity="${t}"\\] h3, \\.loothover-row\\[data-rarity="${t}"\\] > span:first-child \\{ color: ${LR.RARITIES[t].colour}; \\}`), `${t}'s rule carries the table's colour`);
  }
  const inv = read('src/ui/enhancedInventory.js');
  assert.match(inv, /name: resolveItemName\(item\) \|\| t\?\.name \|\| 'Unknown',/, 'the enhanced pack names through ResolveItemName now');
  assert.match(inv, /const r = rarityAttr\(item\); if \(r\) row\.dataset\.rarity = r;/, 'a row wears its tier');
  assert.match(inv, /const lines = rarityLines\(picked\); if \(lines\.length\)/, 'the card lists the lines');
  assert.match(read('src/ui/lootHover.js'), /if \(r\.rarity\) row\.dataset\.rarity = r\.rarity;/);
  assert.match(read('src/ui/nativeInventory.js'), /armorLabelValue\(av\[i\] \?\? 100, entityArmorDisplayMod\(this\.hooks\.entity, i\)\)/, 'the doll\'s numbers, per part (RF1)');
  assert.match(read('src/ui/enhancedInventory.js'), /&& itemIsIdentified\(item\) \? materialName\(item\) : null/, 'LR4: the enhanced row names no material until identified');
});

test('LR3: the drop chime rings at the body for a Rare or better, never for Magic, never off; the three corpse sites ring it', () => {
  const played = [];
  const audio = { play3d: (id, pos, vol, opts) => played.push({ id, pos: [...pos], opts }) };
  on();
  const rare = LR.applyRarity(sword(), 'rare', lcg(8));
  assert.equal(playRareDrop(audio, [1, 2, 3], [sword(), rare]), 'rare');
  assert.deepEqual(played, [{ id: 364, pos: [1, 2, 3], opts: { maxDistance: 20 } }], 'SoundClips.MakeItem at the corpse');
  assert.equal(playRareDrop(audio, [1, 2, 3], [LR.applyRarity(sword(), 'magic', lcg(8))]), null, 'Magic is quiet');
  assert.equal(playRareDrop(audio, [1, 2, 3], []), null);
  assert.equal(playRareDrop(audio, null, [rare]), null);
  off();
  assert.equal(playRareDrop(audio, [1, 2, 3], [rare]), null, 'off: silent');
  assert.equal(played.length, 1);
  assert.match(read('src/scenes/dungeonContext.js'), /spawnCorpse\(foe\);\n\s*playRareDrop\(audio, foe\.ai\.feet, foe\.entity\.items\);/);
  assert.match(read('src/scenes/exteriorFoes.js'), /playBodyFall\(audio, c\.pos\);\n\s*playRareDrop\(audio, c\.pos, f\.entity\.items\);/);
  assert.match(read('src/scenes/cityGuards.js'), /playBodyFall\(audio, c\.pos\);\n\s*playRareDrop\(audio, c\.pos, g\.entity\.items\);/);
});

test('LR3: the Test Room\'s loot ladder - one door, thirty items (a Magic and a Rare of ten bases, every Legendary), the switch turned on', () => {
  off();
  assert.deepEqual(testEntryById('loot'), { preset: testEntryById('nord-warrior').preset, ride: false, loot: true });
  assert.equal(TEST_LOOT.id, 'loot');
  assert.equal(TEST_LOOT_BASES.length, 10);
  const e = { items: [] };
  const added = seedTestLoot(e, lcg(1));
  assert.equal(LR.lootRarityOn(), true, 'the door turns the ladder on');
  assert.equal(added.length, 20 + LR.LEGENDARIES.length);
  assert.equal(added.filter((i) => i.rarity === 'magic').length, 10);
  assert.equal(added.filter((i) => i.rarity === 'rare').length, 10);
  const legs = added.filter((i) => i.rarity === 'legendary');
  assert.deepEqual(legs.map((i) => i.legendary).sort(), LR.LEGENDARIES.map((l) => l.id).sort(), 'every record once');
  for (const it of legs) { const rec = LR.legendaryById(it.legendary); assert.ok(!rec.templates || rec.templates.includes(it.templateIndex), `${rec.id} on a fitting base`); }
  assert.equal(e.items.length, added.length);
  assert.match(read('src/ui/enhancedMenu.js'), /TEST_LOOT\.label[\s\S]*?onAction\(`test:\$\{TEST_LOOT\.id\}`\)/, 'the pane\'s card');
  assert.match(read('src/scenes/world.js'), /if \(testEntry\.loot\) console\.log\(`\[testroom\] loot ladder: \$\{seedTestLoot\(playerEntity\)\.length\} rolled items in the pack`\);/, 'the boot seeds it');
  _resetForTests();
});

test('LR4: the audit - the corpse door rolls the loot and never the worn kit, a forged affix is refused, no flavour is an item-maker-only payload', () => {
  on();
  // (1) THE CORPSE DOOR. equipEnemy pushes the worn kit into the list AND onto the table, writing no equipSlot;
  // the roll runs over what is NOT on the table.
  const foe = { items: [], level: 21, equip: undefined };
  const wornSword = sword(); const wornCuirass = cuirass();
  foe.items.push(wornSword, wornCuirass);
  equipTableOf(foe)[5] = wornSword; equipTableOf(foe)[9] = wornCuirass;   // as equipEnemy's EquipItem lands them
  delete wornSword.equipSlot; delete wornCuirass.equipSlot;
  const loot = [sword(), cuirass(), ring()];
  foe.items.push(...loot);
  const out = LR.rollCorpseLoot(foe, { level: 21, affinity: 'Daedra' }, { rolls: () => 0.0001, luck: 100 });
  assert.equal(out, foe.items);
  assert.ok(!wornSword.rarity && !wornSword.affixes && !wornCuirass.rarity, 'the sword it swings stays DFU\'s');
  assert.ok(loot.every((it) => it.rarity === 'legendary' || it.rarity === 'rare'), 'the loot it carries rolled at the boss\'s tier');
  off();
  const foe2 = { items: [sword()], level: 3 };
  assert.equal(LR.rollCorpseLoot(foe2, { level: 3 }, { rolls: () => 0 }), foe2.items);
  assert.ok(!foe2.items[0].rarity, 'off: nothing');
  on();
  // (2) THE WIRE. A forged affix is not an item; a malformed record folds and prints nothing.
  const good = LR.applyRarity(sword(), 'magic', lcg(12));
  assert.ok(validLootItem(JSON.parse(JSON.stringify(good))));
  for (const bad of [[{ id: 'armor', value: 1e9 }], [{ id: 'stat', value: 3 }], [{ id: 'stat', param: 'strength' }], [null], [{ id: 'nope', value: 1 }], [{ id: 'damage', param: 'x', value: 5 }], [{ id: 'resist', param: 'fire', value: 0 }], [{ id: 'skill', param: 99, value: 5 }], [{ id: 'weight', value: 2.5 }]]) {
    assert.equal(validLootItem({ ...JSON.parse(JSON.stringify(good)), affixes: bad }), null, `refused: ${JSON.stringify(bad)}`);
    assert.equal(LR.validAffixList(bad), false);
    assert.equal(LR.affixLabel(bad[0]), '');
    assert.equal(LR.affixWord(bad[0], 'rare'), '');
  }
  assert.ok(LR.validAffixList(good.affixes));
  const e = entityOf();
  const forged = { ...ring(), affixes: [{ id: 'armor', value: 1e9 }, { id: 'stat', value: 3 }, null, { id: 'stat', param: 'luck', value: 5 }] };
  e.items.push(forged); equipItem(e, forged);
  assert.equal(liveStat(e, 'luck'), 55, 'the one sound record folds; the three malformed fold nothing and throw nothing');
  assert.deepEqual(LR.rarityLines({ ...forged, rarity: 'magic' }).filter(Boolean), ['Magic', '+5 Luck']);
  // (3) THE FLAVOURS: every one fires on a worn or wielded drop - never an Enchanted-only payload (FeatherWeight, ExtraWeight fire at the item maker alone).
  for (const list of Object.values(LR.RARE_FLAVOURS)) for (const f of list) assert.ok(![ENCHANTMENT_TYPES.FeatherWeight, ENCHANTMENT_TYPES.ExtraWeight].includes(f.type), `${typeKey(f.type)} is a dead line on a drop`);
  for (const rec of LR.LEGENDARIES) assert.ok(![ENCHANTMENT_TYPES.FeatherWeight, ENCHANTMENT_TYPES.ExtraWeight].includes(rec.enchantment.type));
  _resetForTests();
});

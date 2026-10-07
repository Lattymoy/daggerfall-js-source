// LOOT14 - THE WARDROBE (2026-10-07; bible/06-Systems/Loot-II-Arc.md section 6; Mac: "I notice that clothing doesn't have
// a lot of rarity options with.our loot system? Amy ideas?", then "Lets go all in").
//
// A garment was locked out of the ladder whole: rarityEligible took a weapon, armour or jewellery and nothing else, no
// affix kind named a clothing group, and a crafted garment took neither roll its quality promises. Now every one of
// DFU's 76 clothing templates rolls - on a POOL OF ITS OWN (its four slots are worn under armour; the combat pool would
// have added four lines of fight to every character): standing with a social group (DRESS1's channel), warmth (Climates
// & Calories' clothing warmth), weatherproofing (the weather's soaking), the street's skills and Personality alone.
//
// Pinned by execution: the pool over hundreds of seeded mints, the leans, every reader through the real fold (DRESS1's
// standing, the felt temperature's warmth, the weather's soaking), survival Off said on the card, the price at half,
// the cap's order, both doors' draw order and marks, a crafted garment's roll at last, and the wire.

import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setPref, _resetForTests } from '../src/systems/uiPrefs.js';
import * as LR from '../src/systems/lootRarity.js';
import { GROUP_TEMPLATE_INDICES } from '../src/systems/itemTemplatesData.js';
import { mintCondition, itemBaseValue } from '../src/systems/itemTemplates.js';
import { createWeapon } from '../src/combat/enemyEquipment.js';
import { equipItem, equipTableOf } from '../src/systems/equip.js';
import { computeEntityMods } from '../src/systems/entityMods.js';
import { dressStanding, GEAR_STANDING_CAP, DRESS_CAP, DRESS_GROUP } from '../src/systems/clothingStanding.js';
import { clothingWarmth, feltTemperature, wardrobeCtx, GEAR_DRY_MOST, CLOTHES_BREATHE_ABOVE } from '../src/systems/survival/temperature.js';
import { survivalMinute, survivalOf } from '../src/systems/survival/needs.js';
import { STAT_KEYS_ORDER } from '../src/systems/statMods.js';
import { SKILLS } from '../src/systems/skills.js';
import { ENCHANTMENT_TYPES } from '../src/formats/magicDef.js';
import { capLootList, rollCorpseKit, plainFoeRarityWeights } from '../src/systems/foeLootCap.js';
import { ENEMY_BASICS } from '../src/characters/enemyBasics.js';
import { POTION_TEMPLATE_INDEX, validLootItem } from '../src/systems/loot.js';
import { goldStack, isGoldPieces } from '../src/systems/inventory.js';
import { mintPiece } from '../src/systems/smithItems.js';

const on = () => { _resetForTests(); setPref('lootRarity', true); };
const off = () => { _resetForTests(); setPref('lootRarity', false); };
const lcg = (seed) => () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return (seed >>> 8) / 0x800000; };
const garment = (templateIndex, extra = {}) => ({
  ...mintCondition({ group: templateIndex >= 182 ? 'WomensClothing' : 'MensClothing', templateIndex, name: 'garment', flags: 0 }), ...extra,
});
const entityOf = () => ({ isPlayer: true, items: [], stats: { strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 }, skills: new Array(35).fill(30), level: 5, career: {}, activeEffects: [], reactionMods: [0, 0, 0, 0, 0] });
const wear = (e, ...pieces) => { for (const p of pieces) { e.items.push(p); equipItem(e, p); } return e; };
const ALL_GARMENTS = [...GROUP_TEMPLATE_INDICES.MensClothing, ...GROUP_TEMPLATE_INDICES.WomensClothing];
const POOL = ['standing', 'warmth', 'dry', 'skill', 'stat'];

test('LOOT14: every garment rolls, on the wardrobe\'s pool alone - standing, warmth, weatherproofing, the street\'s skills and Personality; never a line of fight, capacity, resistance, Luck or one that does something; a Rare names both parts', () => {
  on();
  assert.equal(ALL_GARMENTS.length, 76, 'DFU\'s men\'s and women\'s clothing, every template');
  for (const t of ALL_GARMENTS) assert.ok(LR.rarityEligible(garment(t)), `template ${t} is eligible`);
  assert.ok(!LR.rarityEligible(garment(155, { questItem: true })) && !LR.rarityEligible(garment(155, { magic: true, enchantments: [{ type: 0, param: 1 }] })) && !LR.rarityEligible(garment(155, { rarity: 'magic' })), 'the old nevers hold for a garment');
  assert.deepEqual(LR.kindParams('stat', garment(159)), ['personality'], 'a garment\'s attribute is Personality alone');
  assert.equal(LR.kindParams('stat', createWeapon(120, 1)), LR.AFFIX_KINDS.stat.params, 'every other piece the kind\'s whole list - the same array, so no other piece\'s draw moves');
  assert.deepEqual(LR.CLOTHING_GROUPS, ['MensClothing', 'WomensClothing']);
  for (const id of ['standing', 'warmth', 'dry']) {
    assert.deepEqual([...LR.AFFIX_KINDS[id].groups], LR.CLOTHING_GROUPS, `${id} lands on a garment and nothing else`);
    for (const g of ['Weapons', 'Armor', 'Jewellery']) assert.ok(!LR.AFFIX_KINDS[id].groups.includes(g));
  }
  const rolls = lcg(14);
  const seen = new Set();
  for (let n = 0; n < 300; n++) {
    for (const t of [155, 195, 150, 163, 151, 201, 190]) {
      for (const tier of ['magic', 'rare']) {
        const it = LR.applyRarity(garment(t), tier, rolls);
        assert.equal(it.rarity, tier);
        const [min, max] = LR.AFFIX_COUNTS[tier];
        assert.ok(it.affixes.length >= min && it.affixes.length <= max, `${tier}: ${it.affixes.length} lines`);
        for (const a of it.affixes) {
          assert.ok(POOL.includes(a.id), `${a.id} is the wardrobe's`);
          assert.ok(LR.validAffix(a));
          const [lo, hi] = LR.AFFIX_RANGES[a.id][tier];
          assert.ok(a.value >= lo && a.value <= hi, `${a.id} in its band`);
          if (a.id === 'stat') assert.equal(a.param, 'personality', 'Personality alone');
          seen.add(a.id);
        }
        const sigs = it.affixes.map((a) => `${a.id}:${a.param ?? ''}`);
        assert.equal(new Set(sigs).size, sigs.length, 'no line repeats');
        if (tier === 'rare') {
          assert.ok(it.affixes.some((a) => LR.AFFIX_KINDS[a.id].slot === 'prefix') && it.affixes.some((a) => LR.AFFIX_KINDS[a.id].slot === 'suffix'), 'a Rare names both parts');
          assert.equal(it.enchantments?.length, 1, 'a Rare carries one DFU flavour');
        }
      }
    }
  }
  assert.deepEqual([...seen].sort(), [...POOL].sort(), 'every kind of the pool is reached');
  // and the old groups never meet the wardrobe's kinds
  for (let n = 0; n < 200; n++) {
    for (const make of [() => createWeapon(120, 1), () => mintCondition({ group: 'Armor', templateIndex: 102, material: 0x0201, name: 'c', flags: 0 }), () => mintCondition({ group: 'Jewellery', templateIndex: 135, name: 'r', flags: 0 })]) {
      for (const a of LR.applyRarity(make(), 'rare', rolls).affixes) assert.ok(!['standing', 'warmth', 'dry'].includes(a.id));
    }
  }
});

test('LOOT14: the leans - a garment\'s first line is its standing half the time; a standing line leans to its dress (fine wear the Nobility or the Merchants, common wear the Commoners, a priest\'s robes the Scholars); a skill to the street\'s seven, a shoe\'s to the feet\'s five', () => {
  on();
  const rolls = lcg(7);
  const N = 1500;
  const lean = (t) => {
    const out = { first: 0, groups: {}, skills: {} };
    for (let n = 0; n < N; n++) {
      const it = LR.applyRarity(garment(t), 'rare', rolls);
      if (it.affixes[0].id === 'standing') out.first++;
      for (const a of it.affixes) {
        if (a.id === 'standing') out.groups[a.param] = (out.groups[a.param] ?? 0) + 1;
        if (a.id === 'skill') out.skills[a.param] = (out.skills[a.param] ?? 0) + 1;
      }
    }
    return out;
  };
  const share = (map, keys) => keys.reduce((n, k) => n + (map[k] ?? 0), 0) / Object.values(map).reduce((a, b) => a + b, 0);
  const fine = lean(195);   // Evening Gown - fine wear
  assert.ok(fine.first / N > 0.5, `the first line is the standing over half the time (${(fine.first / N).toFixed(2)})`);
  assert.ok(share(fine.groups, ['nobility', 'merchants']) > 0.6, `fine wear leans to the Nobility and the Merchants (${share(fine.groups, ['nobility', 'merchants']).toFixed(2)})`);
  const plain = lean(163);  // Plain Robes - common wear
  assert.ok(share(plain.groups, ['commoners']) > 0.45, `common wear leans to the Commoners (${share(plain.groups, ['commoners']).toFixed(2)})`);
  const priest = lean(164); // Priest Robes - religious
  assert.ok(share(priest.groups, ['scholars']) > 0.45, `a priest's robes lean to the Scholars (${share(priest.groups, ['scholars']).toFixed(2)})`);
  const S = SKILLS;
  const street = [S.Etiquette, S.Streetwise, S.Mercantile, S.Stealth, S.Pickpocket, S.Lockpicking, S.Medical];
  const feet = [S.Running, S.Jumping, S.Climbing, S.Swimming, S.Stealth];
  assert.ok(share(fine.skills, street) > 0.8, `a gown's skills lean to the street (${share(fine.skills, street).toFixed(2)})`);
  const shoe = lean(147);   // Shoes - on the feet
  assert.ok(LR.garmentOnFeet(garment(147)) && LR.garmentOnFeet(garment(189)) && !LR.garmentOnFeet(garment(155)));
  assert.ok(share(shoe.skills, feet) > 0.8, `a shoe's lean to the feet (${share(shoe.skills, feet).toFixed(2)})`);
  // GOLDEN: three seeded garments mint exactly this - a draw more or less (a second roll for a standing line, a lean
  // lost) moves every line after it
  const goldens = [
    [195, 'rare', 42, 'Oiled Evening Gown of Skill', [{ id: 'dry', value: 31 }, { id: 'warmth', value: 6 }, { id: 'skill', param: 1, value: 11 }, { id: 'stat', param: 'personality', value: 6 }], 932],
    [163, 'magic', 7, 'Lined Plain Robes of the Alley', [{ id: 'standing', param: 'underworld', value: 3 }, { id: 'warmth', value: 3 }], 139],
    [147, 'rare', 11, 'Quilted Shoes of the Market', [{ id: 'standing', param: 'merchants', value: 5 }, { id: 'skill', param: 16, value: 17 }, { id: 'warmth', value: 4 }, { id: 'standing', param: 'scholars', value: 5 }], 877],
  ];
  for (const [t, tier, seed, name, affixes, value] of goldens) {
    const it = LR.applyRarity(garment(t), tier, lcg(seed));
    assert.deepEqual([it.name, it.affixes, it.value], [name, affixes, value], `golden: template ${t} ${tier} seed ${seed}`);
  }
  // the draw is one roll, as pick's: a lean's own group and the rest share [0, 1) with nothing left over
  const one = [];
  LR._pickStandingForTests(garment(195), LR.STANDING_GROUPS, () => { one.push(1); return 0.99; });
  assert.equal(one.length, 1, 'one roll a standing line');
});

test('LOOT14: the readers, through the real fold - DRESS1\'s standing (the gear\'s own cap beside the dress\'s), Climates & Calories\' warmth (with the cloth, halved in the heat) and weatherproofing (the weather\'s soaking, at most 75%, a river still soaks); off, nothing', () => {
  on();
  const cloak = garment(155, { rarity: 'rare', affixes: [{ id: 'standing', param: 'nobility', value: 5 }, { id: 'warmth', value: 6 }, { id: 'dry', value: 30 }] });
  const gown = garment(159, { rarity: 'magic', affixes: [{ id: 'standing', param: 'nobility', value: 3 }, { id: 'standing', param: 'merchants', value: 3 }] });   // Formal Tunic - fine wear
  const e = wear(entityOf(), cloak, gown);
  const m = e._mods;
  assert.equal(m.standing[DRESS_GROUP.Nobility], 8);
  assert.equal(m.standing[DRESS_GROUP.Merchants], 3);
  assert.equal(m.warmth, 6);
  assert.equal(m.dry, 30);
  // DRESS1: the Formal Cloak and the Formal Tunic are fine wear (+3 Nobility each, +1 Merchants, -1 Commoners) -
  // and the gear's own lines beside, held to their own cap
  const d = dressStanding(e);
  assert.equal(d.groups[DRESS_GROUP.Nobility], 6 + 8, 'the dress\'s six and the gear\'s eight');
  assert.equal(d.groups[DRESS_GROUP.Merchants], 2 + 3);
  const lots = garment(191, { rarity: 'rare', affixes: [{ id: 'standing', param: 'nobility', value: 8 }] });
  wear(e, lots);
  assert.equal(e._mods.standing[DRESS_GROUP.Nobility], 16);
  // the Casual Cloak is common wear (-3 Nobility): the dress says 3 + 3 - 3; the gear's sixteen is held to its own ten
  assert.equal(dressStanding(e).groups[DRESS_GROUP.Nobility], 3 + GEAR_STANDING_CAP, 'the gear held to its own cap of ten, beside the dress\'s');
  // Climates & Calories: the warmth with the cloth's own
  const worn = equipTableOf(e);
  const bare = clothingWarmth(worn, { natural: -20 });
  const geared = clothingWarmth(worn, { natural: -20, gear: m.warmth });
  assert.equal(geared.warmth - bare.warmth, 6, 'the lining counts in the cold');
  const hot = clothingWarmth(worn, { natural: CLOTHES_BREATHE_ABOVE + 5, gear: 6 });
  const hotBare = clothingWarmth(worn, { natural: CLOTHES_BREATHE_ABOVE + 5 });
  assert.equal(hot.warmth - hotBare.warmth, 3, 'and is halved in the heat, as the cloth is');
  // the weather's soaking: a cloak and 30% off; a river is a river
  const ctx = wardrobeCtx({}, e._mods);
  assert.deepEqual([ctx.gearWarmth, ctx.gearDry], [6, 30]);
  const rain = (c) => feltTemperature({ weather: 'thunder', climateIndex: 0, month: 0, hour: 12 }, worn, c).wetGain;
  const without = rain({}), withIt = rain(ctx);
  assert.ok(without > 0 && Math.abs(withIt - without * 0.7) < 1e-9, `the storm soaks 30% less (${without} -> ${withIt})`);
  const flood = feltTemperature({ weather: 'thunder', submerged: true }, worn, ctx).wetGain - withIt;
  assert.equal(flood, feltTemperature({ weather: 'thunder', submerged: true }, worn, {}).wetGain - without, 'under water you are soaked whatever you wear');
  const allDry = feltTemperature({ weather: 'thunder' }, worn, { gearDry: 200 }).wetGain;
  assert.equal(GEAR_DRY_MOST, 75);
  assert.ok(Math.abs(allDry - without * 0.25) < 1e-9, 'at most 75% turned aside');
  const COLD = { climateIndex: 0, month: 0, hour: 2, weather: 'snow', insideBuilding: false };
  assert.equal(feltTemperature(COLD, worn, { gearWarmth: 6 }).clothes - feltTemperature(COLD, worn, {}).clothes, 6, 'the felt reading carries the lining');
  // the degrees ride the host's own resistances (LOOT15's powers write them)
  assert.deepEqual(wardrobeCtx({ frostResist: 10 }, { coldDegrees: 20, heatDegrees: 5 }), { gearWarmth: 0, gearDry: 0, frostResist: 30, fireResist: 5 });
  assert.deepEqual(wardrobeCtx({}, null), {}, 'nothing folded, nothing laid');
  // ...and the minute of the needs reads it off the wearer (survival/needs.js survivalMinute lays the wardrobe's context)
  const STORM = { climateIndex: 0, month: 6, hour: 12, weather: 'thunder', insideBuilding: false, insideDungeon: false, inSunlight: false };
  const QUIET = { drainFatigue() {}, restoreFatigue() {}, hurt() {}, say() {} };
  const minute = (who) => { survivalOf(who, 3000).wet = 0; survivalMinute(who, 3001, STORM, { worn: equipTableOf(who), sinks: QUIET }); return who.survival.wet; };
  const plainBody = wear(entityOf(), garment(155), garment(191));   // the same two cloaks, no lines
  const soaked = minute(plainBody), proofed = minute(e);
  assert.ok(soaked > 0 && Math.abs(proofed - soaked * (1 - 30 / 100)) < 1e-9, `a minute of the storm: ${soaked} bare, ${proofed} weatherproofed (the cloak's 30 and none else)`);
  off();
  computeEntityMods(e);
  assert.deepEqual([e._mods.standing.every((v) => v === 0), e._mods.warmth, e._mods.dry], [true, 0, 0], 'off: the fold answers nothing');
  assert.equal(dressStanding(e).groups[DRESS_GROUP.Nobility], 3, 'and DRESS1 reads the dress alone');
  assert.ok(3 <= DRESS_CAP);
});

test('LOOT14: no dead lines - with survival Off the warmth and weatherproof lines say so on the card; standing and the skills never do', () => {
  on();
  const it = garment(155, { rarity: 'magic', affixes: [{ id: 'warmth', value: 3 }, { id: 'standing', param: 'commoners', value: 2 }] });
  const lines = () => LR.rarityLines(it);
  assert.ok(lines().some((l) => /^\+3 warmth \[2-4\]$/.test(l)), 'survival on: the line plain');
  setPref('survival', false);
  assert.ok(lines().some((l) => l === `+3 warmth [2-4]${LR.SURVIVAL_OFF_NOTE}`), 'survival Off: the line says its reader is off');
  assert.ok(lines().some((l) => l === '+2 standing with Commoners [2-3]'), 'standing is DRESS1\'s and never sleeps');
  assert.equal(LR.asleepNote({ id: 'dry', value: 20 }), LR.SURVIVAL_OFF_NOTE);
  setPref('survival', 'casual');
  assert.equal(LR.asleepNote({ id: 'dry', value: 20 }), '');
});

test('LOOT14: the price and the flavours - a garment\'s lines at half, its Rare enchantment 300, never a held spell, capacity or a dead payload; the cap keeps a supply over a Magic garment and a Magic garment over a plain piece', () => {
  on();
  const rolls = lcg(3);
  for (let n = 0; n < 100; n++) {
    const it = LR.applyRarity(garment(195), 'rare', rolls);
    const lines = it.affixes.reduce((s, a) => s + LR.AFFIX_WORTH[a.id] * a.value, 0);
    assert.equal(it.value, itemBaseValue(it) + Math.round(lines * LR.GARMENT_WORTH_SHARE) + 300, 'half the lines, and 300 for the flavour');
  }
  assert.equal(LR.rareEnchantWorth(garment(195)), 300);
  assert.equal(LR.exaltedWorth(garment(195)), LR.EXALTED_WORTH / 2, 'an Exalted garment\'s worth is half too');
  assert.equal(LR.exaltedWorth(createWeapon(120, 1)), LR.EXALTED_WORTH);
  assert.equal(LR.rareEnchantWorth(createWeapon(120, 1)), LR.RARE_ENCHANT_WORTH, 'a weapon\'s is the 600 it was');
  const T = ENCHANTMENT_TYPES;
  for (const g of LR.CLOTHING_GROUPS) {
    assert.equal(LR.RARE_FLAVOURS[g], LR.RARE_FLAVOURS.MensClothing, 'both cuts hold the same street');
    for (const f of LR.RARE_FLAVOURS[g]) assert.ok(![T.CastWhenHeld, T.IncreasedWeightAllowance, T.FeatherWeight, T.CastWhenStrikes].includes(f.type), `no held spell, capacity or dead payload (${f.type})`);
  }
  // the cap: gold, then a supply, then a Magic garment, then the plain steel
  const potion = { name: 'potion', group: 'UselessItems1', templateIndex: POTION_TEMPLATE_INDEX, potionRecipeKey: 4975678, value: 50 };
  const shirt = { ...garment(165), name: 'shirt', rarity: 'magic', value: 900 };
  const steel = { name: 'steel', group: 'Weapons', templateIndex: 120, material: 1, value: 360 };
  const list = [steel, shirt, goldStack(5), potion];
  capLootList(list, 3);
  assert.deepEqual(list.map((i) => (isGoldPieces(i) ? 'gold' : i.name)), ['shirt', 'gold', 'potion'], 'the supply kept before the dearer Magic shirt, the shirt before the steel');
  const one = [shirt, potion, goldStack(5)];
  capLootList(one, 2);
  assert.deepEqual(one.map((i) => (isGoldPieces(i) ? 'gold' : i.name)), ['potion', 'gold'], 'room for one: the supply, over the dearer Magic shirt');
  const two = [steel, shirt, goldStack(5)];
  capLootList(two, 2);
  assert.deepEqual(two.map((i) => (isGoldPieces(i) ? 'gold' : i.name)), ['shirt', 'gold'], 'a Magic garment over a plain piece');
  const legendaryShirt = { ...garment(165), name: 'robe', rarity: 'legendary', value: 10 };
  const three = [potion, legendaryShirt, goldStack(5)];
  capLootList(three, 2);
  assert.deepEqual(three.map((i) => (isGoldPieces(i) ? 'gold' : i.name)), ['robe', 'gold'], 'a Legendary garment is a Legendary');
});

test('LOOT14: the doors - the host door rolls its garments after every draw it made before (a seeded list\'s other pieces mint what they did) and marks them; the kit\'s garments roll at death, a copy; off, nothing', () => {
  on();
  const src = { kind: 'corpse', tier: 12, boss: false, family: null };
  const pieces = () => [createWeapon(120, 1), mintCondition({ group: 'Armor', templateIndex: 102, material: 0x0201, name: 'c', flags: 0 })];
  for (let seed = 1; seed < 40; seed++) {
    const alone = pieces();
    LR.rollLootRarity(alone, src, { rolls: lcg(seed) });
    const dressed = [...pieces(), garment(155), garment(195)];
    LR.rollLootRarity(dressed, src, { rolls: lcg(seed) });
    assert.deepEqual(dressed.slice(0, 2).map((it) => [it.rarity ?? null, it.name, JSON.stringify(it.affixes ?? null)]),
      alone.map((it) => [it.rarity ?? null, it.name, JSON.stringify(it.affixes ?? null)]), `seed ${seed}: the other pieces are their seed's`);
    for (const g of dressed.slice(2)) assert.equal(g.untaken, true, 'a garment the door rolled is marked for the drought');
  }
  // a garment the door rolled is a garment of its tier: over enough seeds, the colours come
  const tiers = new Set();
  for (let seed = 1; seed < 400; seed++) { const l = [garment(155)]; LR.rollLootRarity(l, { kind: 'pile', tier: 18, boss: true, family: null }, { rolls: lcg(seed) }); tiers.add(l[0].rarity ?? 'common'); }
  assert.ok(tiers.has('magic') && tiers.has('rare'), `a pile's garments come Magic and Rare (${[...tiers].join(', ')})`);
  // the kit: a garment the foe wore, unmarked, rolls at its death - as a copy, the table's piece left as minted
  const worn = garment(165);
  const body = { items: [worn], mobileType: 141, level: 10, equip: null };
  let laddered = 0;
  for (let seed = 1; seed < 200 && !laddered; seed++) {
    const b = { ...body, items: [garment(165)] };
    const out = rollCorpseKit(b, { rolls: lcg(seed) });
    assert.equal(b.items[0].untaken, true, 'the kit\'s garment marked');
    if (out.length) { laddered++; assert.ok(LR.ROLLED_TIERS.includes(b.items[0].rarity)); }
  }
  assert.ok(laddered, 'a worn garment can come off a body coloured');
  // ...on the kit's own ladder - the plain one at the foe's tier, never a boss's: tier 10's plain Magic is 100 per mille,
  // the whole ladder's 250 (a boss's more); a roll of 0.2 between them leaves the garment plain
  const at = (v) => () => v;
  // a Fire Daedra is a BOSS source by the ladder's own law; its kit rolls the plain ladder as a plain foe's would
  const daedraSrc = LR.corpseSource(ENEMY_BASICS[26], 10, 26);
  assert.equal(daedraSrc.boss, true);
  const plainMagic = LR.rarityChances({ ...daedraSrc, boss: false, weights: plainFoeRarityWeights() }).magic;
  const bossMagic = LR.rarityChances({ ...daedraSrc, weights: plainFoeRarityWeights() }).magic;
  assert.ok(plainMagic < bossMagic);
  const daedra = { items: [garment(165)], mobileType: 26, level: 10, equip: null };
  rollCorpseKit(daedra, { rolls: at((plainMagic + bossMagic) / 2000) });
  assert.equal(daedra.items[0].rarity, undefined, 'never a boss\'s multiplied ladder: a roll between the two is plain');
  const thug = { items: [garment(165)], mobileType: 141, level: 10, equip: null };
  rollCorpseKit(thug, { rolls: at(0.09) });
  assert.equal(thug.items[0].rarity, 'magic', 'and under the plain Magic, blue');
  // the kit's own draws first: a seeded body's sword and cuirass roll what they did, a shirt beside them or not
  const kitOf = (withShirt) => ({ mobileType: 141, level: 12, equip: null, items: [createWeapon(120, 1), ...(withShirt ? [garment(165)] : []), mintCondition({ group: 'Armor', templateIndex: 102, material: 0x0201, name: 'c', flags: 0 })] });
  for (let seed = 1; seed < 40; seed++) {
    const bare = kitOf(false), dressedKit = kitOf(true);
    rollCorpseKit(bare, { rolls: lcg(seed) });
    rollCorpseKit(dressedKit, { rolls: lcg(seed) });
    const sum = (b) => b.items.filter((it) => !LR.isGarment(it)).map((it) => [it.rarity ?? null, JSON.stringify(it.affixes ?? null)]);
    assert.deepEqual(sum(dressedKit), sum(bare), `seed ${seed}: the kit's pieces are their seed's`);
  }
  const once = { ...body, items: [worn] };
  rollCorpseKit(once, { rolls: lcg(5) });
  assert.notEqual(once.items[0], worn, 'a copy in the body');
  assert.equal(worn.untaken, undefined, 'the piece the foe wore is as it was minted');
  // a garment the door has already marked - a unique find, laddered by the find's own roll - is passed by: the
  // wardrobe's pass never rolls a piece twice (tier 0: no registered find rolls at all, so every roll here is the pass's)
  const marked = garment(156, { untaken: true });
  LR.rollLootRarity([marked], { kind: 'pile', tier: 0, boss: false, family: null }, { rolls: () => 0 });
  assert.equal(marked.rarity, undefined, 'a marked garment is not rolled again, whatever the roll');
  off();
  const l = [garment(155)];
  LR.rollLootRarity(l, src, { rolls: () => 0 });
  assert.deepEqual([l[0].rarity, l[0].untaken], [undefined, undefined], 'off: DFU\'s list untouched');
  assert.deepEqual(rollCorpseKit({ ...body, items: [garment(165)] }, { rolls: () => 0 }), []);
});

test('LOOT14: a crafted garment takes its quality\'s roll at last - a Superior Magic, a Masterwork Rare, known, the maker\'s mark; the wire carries a garment\'s lines whole and refuses a forged one', () => {
  on();
  const PROV = '0123456789abcdef';
  const superior = mintPiece({ recipe: 'garment-195:silk', quality: 3, seed: 5, dye: 4 }, PROV);
  const master = mintPiece({ recipe: 'garment-155:wool', quality: 4, seed: 5, maker: 'Silverthorn' }, PROV);
  assert.equal(superior.rarity, 'magic', 'Professions 9.2: a Superior garment\'s Magic roll');
  assert.equal(master.rarity, 'rare', 'and a Masterwork\'s Rare');
  for (const it of [superior, master]) {
    assert.ok(it.affixes.length && it.affixes.every((a) => POOL.includes(a.id)), 'the wardrobe\'s lines');
    assert.equal(it.isIdentified, true, 'known - the maker knows what she made');
  }
  assert.equal(master.maker, 'Silverthorn');
  assert.equal(mintPiece({ recipe: 'garment-195:silk', quality: 1, seed: 5, dye: 4 }, PROV).rarity, undefined, 'a Standard garment is DFU\'s own');
  // the wire: a Rare garment whole, a forged standing refused
  const rare = LR.applyRarity(garment(155), 'rare', lcg(9));
  const back = validLootItem(JSON.parse(JSON.stringify(rare)));
  assert.deepEqual([back.rarity, back.name, back.affixes], [rare.rarity, rare.name, rare.affixes]);
  assert.equal(validLootItem({ ...rare, affixes: [{ id: 'standing', param: 'kings', value: 5 }] }), null, 'a group no table names');
  assert.equal(validLootItem({ ...rare, affixes: [{ id: 'warmth', value: 99 }] }), null, 'past the Legendary ceiling');
  assert.equal(validLootItem({ ...rare, affixes: [{ id: 'dry', param: 'rain', value: 20 }] }), null, 'a param where its kind takes none');
});

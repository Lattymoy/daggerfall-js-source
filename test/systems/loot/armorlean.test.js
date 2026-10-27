// ARMOR-LEAN (2026-10-26, a player: "can we make differences regarding stat distribution for all types when stats are
// rolled on them") and DAEDRIC-SALE (the same player: "tune down daedric selling price by 50%"). DRIVEN: real rolls over
// real seeds, counted - the families' differences measured, never read off the table they come from.
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { rollAffixes, applyRarity, armorLean, reforgeAffix, gemWorthOf, _pickWeightedForTests as pickWeighted } from '../../../src/systems/loot/lootRarity.js';
import { ARMOR_MATERIAL } from '../../../src/systems/armorMaterials.js';
import { seededRng } from '../../../src/systems/wind/wind.js';
import { SKILLS } from '../../../src/systems/skills.js';
import { counterValueOf, isDaedricGear, buyItemPrice, DAEDRIC_SALE_SHARE } from '../../../src/systems/tradeModes.js';
import { itemBaseValue } from '../../../src/systems/item/itemTemplates.js';
import { mintPiece } from '../../../src/systems/smithItems.js';
import { MINT_V_ARMOR_LEAN, MINT_V_LINES } from '../../../src/net/productRecord.js';

const piece = (material, templateIndex = 102) => ({ name: 'Cuirass', group: 'Armor', templateIndex, material, maxCondition: 100, currentCondition: 100 });
const FAMILIES = { Leather: ARMOR_MATERIAL.Leather, Chain: ARMOR_MATERIAL.Chain, Plate: ARMOR_MATERIAL.Steel };
const N = 3000;

/** Every line N Rare cuirasses of a family roll, and how often the first was the armour. */
function census(material) {
  const lines = []; let armourFirst = 0;
  for (let i = 0; i < N; i++) {
    const out = rollAffixes(piece(material), 'rare', seededRng(1000 + i));
    if (out[0]?.id === 'armor') armourFirst++;
    lines.push(...out);
  }
  const share = (f) => lines.filter(f).length / lines.length;
  const stats = lines.filter((a) => a.id === 'stat');
  const statShare = (keys) => stats.filter((a) => keys.includes(a.param)).length / stats.length;
  return {
    armourFirst: armourFirst / N,
    resist: share((a) => a.id === 'resist'),
    weight: share((a) => a.id === 'weight'),
    nimble: statShare(['agility', 'speed']),
    mighty: statShare(['strength', 'endurance']),
  };
}

test('ARMOR-LEAN: each family rolls its own lines - plate its armour and might, leather its speed, chain its wards', () => {
  const c = Object.fromEntries(Object.entries(FAMILIES).map(([k, m]) => [k, census(m)]));
  // the first line's armour: leather a third, chain a half, plate two in three - and the later draws on top
  assert.ok(c.Plate.armourFirst > c.Chain.armourFirst && c.Chain.armourFirst > c.Leather.armourFirst, JSON.stringify(c));
  assert.ok(c.Plate.armourFirst > 0.6 && c.Leather.armourFirst < 0.45, JSON.stringify(c));
  // attributes: leather's lean to Agility and Speed, plate's to Strength and Endurance
  assert.ok(c.Leather.nimble > 2 * c.Plate.nimble, JSON.stringify(c));
  assert.ok(c.Plate.mighty > 2 * c.Leather.mighty, JSON.stringify(c));
  // resistances: chain's the most
  assert.ok(c.Chain.resist > c.Leather.resist && c.Chain.resist > c.Plate.resist, JSON.stringify(c));
  // carrying capacity: leather and plate over chain
  assert.ok(c.Leather.weight > c.Chain.weight && c.Plate.weight > c.Chain.weight, JSON.stringify(c));
});

test('ARMOR-LEAN: skills are every family\'s alike - which skill a skill line names does not lean (plate gets no more weapon skills)', () => {
  // "plate shouldnt have weapon skills more often keep that for every type"
  const WEAPON_SKILLS = ['ShortBlade', 'LongBlade', 'HandToHand', 'Axe', 'BluntWeapon', 'Archery', 'CriticalStrike'].map((k) => SKILLS[k]);
  const weaponShare = (m) => {
    let skills = 0, weapon = 0;
    for (let i = 0; i < N; i++) for (const a of rollAffixes(piece(m), 'rare', seededRng(30_000 + i))) {
      if (a.id !== 'skill') continue;
      skills++; if (WEAPON_SKILLS.includes(a.param)) weapon++;
    }
    return weapon / skills;
  };
  const even = (() => { let skills = 0, weapon = 0; for (let i = 0; i < N; i++) for (const a of rollAffixes(piece(ARMOR_MATERIAL.Steel), 'rare', seededRng(30_000 + i), { lean: false })) { if (a.id !== 'skill') continue; skills++; if (WEAPON_SKILLS.includes(a.param)) weapon++; } return weapon / skills; })();
  for (const [k, m] of Object.entries(FAMILIES)) assert.ok(Math.abs(weaponShare(m) - even) < 0.03, `${k}: weapon skills ${weaponShare(m).toFixed(3)} of its skill lines, the even law ${even.toFixed(3)}`);
  for (const m of Object.values(FAMILIES)) assert.equal(armorLean(piece(m)).kinds.skill, undefined, 'no family weighs the skill kind');
});

test('ARMOR-LEAN: a weighting, never a fence - every family still rolls every kind and every attribute', () => {
  for (const m of Object.values(FAMILIES)) {
    const seen = new Set();
    for (let i = 0; i < N; i++) for (const a of rollAffixes(piece(m), 'rare', seededRng(50_000 + i))) seen.add(a.param === undefined ? a.id : `${a.id}:${a.param}`);
    for (const k of ['armor', 'weight', 'stat:strength', 'stat:agility', 'stat:speed', 'stat:endurance', 'resist:shock', 'resist:poison']) assert.ok(seen.has(k), `${m} ${k}`);
  }
});

test('ARMOR-LEAN: the lean moves WHICH lines, never how many - the count is the seed\'s, as it was', () => {
  for (let i = 0; i < 400; i++) {
    for (const m of Object.values(FAMILIES)) {
      for (const tier of ['magic', 'rare']) {
        const leaned = rollAffixes(piece(m), tier, seededRng(7_000 + i));
        const even = rollAffixes(piece(m), tier, seededRng(7_000 + i), { lean: false });
        assert.equal(leaned.length, even.length, `seed ${7_000 + i}, material ${m}, ${tier}`);
      }
    }
  }
});

test('ARMOR-LEAN: off, the even law - a piece of armour with no family, and only armour leans', () => {
  for (let i = 0; i < 200; i++) {
    const off = rollAffixes(piece(ARMOR_MATERIAL.Daedric), 'rare', seededRng(i), { lean: false });
    const none = rollAffixes(piece(ARMOR_MATERIAL.None), 'rare', seededRng(i));
    assert.deepEqual(off, none, `seed ${i}`);
  }
  assert.equal(armorLean({ group: 'Weapons', templateIndex: 113, material: 9 }), null);
  assert.equal(armorLean({ group: 'Jewellery', templateIndex: 133 }), null);
  assert.ok(armorLean(piece(ARMOR_MATERIAL.Chain2)) === armorLean(piece(ARMOR_MATERIAL.Chain)));
  assert.ok(armorLean(piece(ARMOR_MATERIAL.Ebony, 112)), 'a shield leans by its family too');
});

test('ARMOR-LEAN: the Reforge re-rolls a line on the family\'s lean - a leather piece\'s new attribute leans to Agility and Speed', () => {
  let nimble = 0, mighty = 0, n = 0;
  for (let i = 0; i < 3000; i++) {
    const it = applyRarity(piece(ARMOR_MATERIAL.Leather), 'rare', seededRng(90_000 + i));
    if (it.affixes.some((a) => a.id === 'stat')) continue;   // the Reforge never re-rolls a line into its own kind
    const at = it.affixes.findIndex((a) => !!a);
    if (at < 0) continue;
    const line = reforgeAffix(it, at, seededRng(i));
    if (line?.id !== 'stat') continue;
    n++; if (['agility', 'speed'].includes(line.param)) nimble++; if (['strength', 'endurance'].includes(line.param)) mighty++;
  }
  assert.ok(n > 50 && nimble > 2 * mighty, `${nimble} nimble, ${mighty} mighty of ${n}`);
});

test('ARMOR-LEAN: the weighted pick takes one roll and spreads it over the weights', () => {
  let calls = 0; const at = (x) => () => { calls++; return x; };
  assert.equal(pickWeighted(['a', 'b', 'c'], (k) => ({ a: 1, b: 2, c: 1 })[k], at(0.3)), 'b');
  assert.equal(pickWeighted(['a', 'b', 'c'], (k) => ({ a: 1, b: 2, c: 1 })[k], at(0.1)), 'a');
  assert.equal(pickWeighted(['a', 'b', 'c'], (k) => ({ a: 1, b: 2, c: 1 })[k], at(0.9)), 'c');
  assert.equal(pickWeighted(['a', 'b'], () => 0, at(0.6)), 'b', 'no weight at all: the even pick of the same roll');
  assert.equal(calls, 4);
});

test('ARMOR-LEAN: a crafted piece leans from MINT_V_ARMOR_LEAN on; a record before mints the piece it always minted', () => {
  assert.ok(MINT_V_ARMOR_LEAN > MINT_V_LINES);
  // a Masterwork steel cuirass (quality 4 rolls a Rare) at the old version and with the lean switched off by hand agree
  let differed = 0;
  for (let seed = 1; seed <= 60; seed++) {
    const rec = { recipe: 'cuirass:steel', quality: 4, maker: null, seed, version: MINT_V_LINES };
    const old = mintPiece(rec, '0123456789abcdef');
    const leaned = mintPiece({ ...rec, version: MINT_V_ARMOR_LEAN }, '0123456789abcdef');
    if (!old || !leaned) continue;
    assert.deepEqual(mintPiece(rec, '0123456789abcdef'), old, 'the old record, the same piece every time');
    if (JSON.stringify(old.affixes) !== JSON.stringify(leaned.affixes)) differed++;
  }
  assert.ok(differed > 0, 'the new version does lean');
});

test('DAEDRIC-SALE: a counter pays half for Daedric gear - weapons, plate and shields - and nothing else moves', () => {
  const daedricMail = { ...piece(ARMOR_MATERIAL.Daedric), value: undefined };
  const ebonyMail = piece(ARMOR_MATERIAL.Ebony);
  const blade = { name: 'Katana', group: 'Weapons', templateIndex: 121, material: 9, maxCondition: 100, currentCondition: 100 };
  assert.equal(DAEDRIC_SALE_SHARE, 0.5);
  assert.ok(isDaedricGear(daedricMail) && isDaedricGear(blade) && isDaedricGear(piece(ARMOR_MATERIAL.Daedric, 112)));
  assert.ok(!isDaedricGear(ebonyMail) && !isDaedricGear({ ...blade, material: 8 }) && !isDaedricGear(piece(ARMOR_MATERIAL.Leather)));
  assert.equal(counterValueOf(daedricMail), Math.round(itemBaseValue(daedricMail) / 2));
  assert.equal(counterValueOf(blade), Math.round(itemBaseValue(blade) / 2));
  assert.equal(counterValueOf(ebonyMail), itemBaseValue(ebonyMail), 'Ebony sells as it did');
  // a rolled piece's whole value halves - its lines' worth with it
  const rare = applyRarity(piece(ARMOR_MATERIAL.Daedric), 'rare', seededRng(3));
  assert.equal(counterValueOf(rare), Math.round(rare.value / 2));
  // only the selling side: a shop asks what it asked
  const asIf = { ...daedricMail, material: ARMOR_MATERIAL.Daedric };
  assert.equal(buyItemPrice(asIf, { quality: 10, online: false }), buyItemPrice({ ...asIf }, { quality: 10, online: false }));
});

test('DAEDRIC-SALE: a gem set in a Daedric piece sells at its whole worth', () => {
  const it = { ...piece(ARMOR_MATERIAL.Daedric), value: 100_000, sockets: ['ruby', 'empty'] };
  const bare = { ...piece(ARMOR_MATERIAL.Daedric), value: 100_000 - gemWorthOf('ruby') };
  assert.equal(counterValueOf(it) - counterValueOf(bare), gemWorthOf('ruby'));
});

// LOOT2 - THE ROLL SEEN, AND THE EXALTED (2026-10-01; bible/06-Systems/Loot-Arc.md section 4, Mac: "Do you wanna turn
// this into an arc and do all of the above?" - "Roll quality and 'Exalted'": show where each affix rolled in its range,
// and a rare Exalted Legendary with an extra affix at the top of its range). The laws pinned here:
//   - THE BAND ON THE LINE: a line the ladder ROLLED reads with its band, `+18% damage [10-25]`; a Legendary's record
//     lines and an Aetheric's carry none (fixed); an Exalted's extra line carries the Legendary band.
//   - PERFECT: a Rare (never a Magic) whose every line stands at its band's top is a "Perfect Rare" - once its numbers
//     are read.
//   - THE EXALTED: a Legendary minted at a source is Exalted one time in ten - one line more, a kind its record does
//     not carry when one is left (else a param its lines leave free), from the top half of the Legendary band; never
//     twice; its name its record's; worth 1,000 and its line's points more.
//   - LAST: the roll is taken after every draw a door already makes - the gate's and a town's earlier spoils stay their
//     seed's; the Sigil Broker's stock is never Exalted.
//   - THE WIRE, THE PIPS, THE TEST ROOM.

import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setPref, _resetForTests } from '../src/systems/uiPrefs.js';
import * as LR from '../src/systems/lootRarity.js';
import { createWeapon } from '../src/combat/enemyEquipment.js';
import { mintCondition } from '../src/systems/itemTemplates.js';
import { validLootItem } from '../src/systems/loot.js';
import { rollSpoils } from '../src/systems/gateSpoils.js';
import { rollRaidSpoils } from '../src/systems/raidSpoils.js';
import { brokerStock } from '../src/systems/sigilBroker.js';
import { AETHERIC_RECORDS, mintAetheric } from '../src/systems/aetheric.js';
import { rarityVarsCss, EXALTED_PIPS } from '../src/ui/enhancedPlusStyle.js';
import { seedTestLoot } from '../src/systems/testRoom.js';

const on = () => { _resetForTests(); setPref('lootRarity', true); };
const off = () => { _resetForTests(); setPref('lootRarity', false); };
const lcg = (seed) => () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return (seed >>> 8) / 0x800000; };
const sword = () => createWeapon(120, 1);
const ring = () => mintCondition({ group: 'Jewellery', templateIndex: 135, name: 'Ring', flags: 0 });
const legendary = (id, base) => LR.applyRarity(base, 'legendary', lcg(1), [LR.legendaryById(id)]);

test('LOOT2: the band on the line - a rolled line says its band, a record\'s line none', () => {
  on();
  const m = LR.applyRarity(sword(), 'magic', lcg(4));
  m.affixes.forEach((a, i) => {
    assert.deepEqual(LR.affixBand(m, i), LR.AFFIX_RANGES[a.id].magic);
    assert.equal(LR.affixLine(m, i), `${LR.affixLabel(a)} [${LR.AFFIX_RANGES[a.id].magic[0]}-${LR.AFFIX_RANGES[a.id].magic[1]}]`);
  });
  const r = LR.applyRarity(sword(), 'rare', lcg(5));
  r.isIdentified = true;
  assert.deepEqual(LR.rarityLines(r).slice(1, 1 + r.affixes.length), r.affixes.map((a) => `${LR.affixLabel(a)} [${LR.AFFIX_RANGES[a.id].rare.join('-')}]`), 'the card\'s lines, each with its band');
  const w = legendary('wyrmbane', sword());
  w.affixes.forEach((a, i) => { assert.equal(LR.affixBand(w, i), null, 'a record\'s line is its signature'); assert.equal(LR.affixLine(w, i), LR.affixLabel(a)); });
  const regalia = mintAetheric(AETHERIC_RECORDS[0]);
  regalia.affixes.forEach((_, i) => assert.equal(LR.affixBand(regalia, i), null, 'an Aetheric line is its record\'s'));
  assert.equal(LR.affixBand({ rarity: 'rare', affixes: [{ id: 'nope', value: 3 }] }, 0), null, 'a forged line has none');
  assert.equal(LR.affixLine({ rarity: 'rare', affixes: [null] }, 0), '');
});

test('LOOT2: Perfect - a Rare whose every line is at its band\'s top, once it is read; never a Magic', () => {
  on();
  const top = (it) => { it.affixes = it.affixes.map((a) => ({ ...a, value: LR.AFFIX_RANGES[a.id][it.rarity][1] })); return it; };
  const r = top(LR.applyRarity(sword(), 'rare', lcg(6)));
  assert.equal(LR.isPerfect(r), true);
  assert.equal(LR.tierLabel(r), 'Rare', 'unread: its numbers are not known yet');
  r.isIdentified = true;
  assert.equal(LR.tierLabel(r), 'Perfect Rare');
  assert.equal(LR.rarityLines(r)[0], 'Perfect Rare');
  const short = { ...r, affixes: r.affixes.map((a, i) => (i === 0 ? { ...a, value: a.value - 1 } : a)) };
  assert.equal(LR.isPerfect(short), false, 'one line under its top');
  const m = top(LR.applyRarity(sword(), 'magic', lcg(7)));
  assert.equal(LR.isPerfect(m), false, 'a Magic is never Perfect');
  assert.equal(LR.tierLabel(m), 'Magic');
  // how rare: over 20,000 seeded Rares, a few at most
  const rolls = lcg(99);
  let n = 0;
  for (let i = 0; i < 20000; i++) { const it = LR.applyRarity(sword(), 'rare', rolls); if (LR.isPerfect(it)) n++; }
  assert.ok(n < 40, `one Rare in a few thousand or rarer (${n} of 20,000)`);
});

test('LOOT2: exalting a Legendary - one line more, a kind its record does not carry, the top half of the band, once', () => {
  on();
  const fox = legendary('foxglove', ring());
  const name = fox.name, before = fox.value, recLines = fox.affixes.length;
  assert.equal(LR.exaltLegendary(fox, lcg(3)), true);
  assert.equal(fox.exalted, true);
  assert.equal(fox.affixes.length, recLines + 1);
  const extra = fox.affixes.at(-1);
  assert.ok(LR.validAffix(extra));
  assert.ok(!LR.legendaryById('foxglove').affixes.some((a) => a.id === extra.id), `a kind the record does not carry (${extra.id})`);
  const [lo, hi] = LR.AFFIX_RANGES[extra.id].legendary;
  assert.ok(extra.value >= Math.ceil((lo + hi) / 2) && extra.value <= hi, `the top half of the band (${extra.value} of ${lo}-${hi})`);
  assert.equal(fox.name, name, 'its name is its record\'s');
  assert.equal(fox.value, before + LR.EXALTED_WORTH + LR.affixesWorth([extra]));
  assert.deepEqual(LR.affixBand(fox, recLines), LR.AFFIX_RANGES[extra.id].legendary, 'its extra line carries the Legendary band');
  assert.equal(LR.affixBand(fox, 0), null, 'its record\'s lines none');
  assert.equal(LR.tierLabel(fox), 'Exalted Legendary');
  assert.equal(LR.exaltLegendary(fox, lcg(4)), false, 'never twice');
  assert.equal(LR.exaltLegendary(LR.applyRarity(sword(), 'rare', lcg(2)), lcg(2)), false, 'never a piece that is not a Legendary');
  // a record carrying every kind its group may: a kind with a param, a param left free
  for (let s = 1; s < 60; s++) {
    const w = legendary('wyrmbane', sword());
    if (!LR.exaltLegendary(w, lcg(s))) continue;
    const x = w.affixes.at(-1);
    const kinds = LR.AFFIX_IDS.filter((id) => LR.AFFIX_KINDS[id].groups.includes('Weapons'));
    const carried = new Set(LR.legendaryById('wyrmbane').affixes.map((a) => a.id));
    if (kinds.some((id) => !carried.has(id))) assert.ok(!carried.has(x.id), 'a free kind first');
    else assert.ok(!LR.legendaryById('wyrmbane').affixes.some((a) => a.id === x.id && a.param === x.param), 'else a free param');
    assert.ok(LR.validAffix(x));
  }
});

test('LOOT2: the one-in-ten - at the host door, after the piece\'s own draws; never with the switch off', () => {
  on();
  assert.equal(LR.EXALTED_PER_MILLE, 100);
  let exalted = 0, legendaries = 0;
  const rolls = lcg(17);
  for (let i = 0; i < 4000; i++) {
    const it = legendary('foxglove', ring());
    legendaries++;
    if (LR.rollExalted(it, rolls)) exalted++;
  }
  assert.ok(Math.abs(exalted / legendaries - 0.1) < 0.02, `one in ten (${exalted} of ${legendaries})`);
  // the door: a Legendary rolled there may be Exalted - every roll at 0 lands under every threshold
  const items = [sword()];
  LR.rollLootRarity(items, { kind: 'pile', tier: 21, boss: true }, { rolls: () => 0, luck: 100 });
  assert.equal(items[0].rarity, 'legendary');
  assert.equal(items[0].exalted, true, 'the door rolled it, after the piece\'s own draws');
  // AFTER EVERY DRAW the door makes: a list's later pieces are the same whether the first was Exalted or not
  const seq = (first, rest) => { let i = 0; return () => (i++ === 0 ? first : rest()); };
  const list = (perMille) => {
    LR._setExaltedForTests(perMille);
    const two = [sword(), ring()];
    LR.rollLootRarity(two, { kind: 'pile', tier: 21, boss: true }, { rolls: seq(0, lcg(23)), luck: 100 });
    LR._setExaltedForTests(null);
    return two;
  };
  const [ex1, ex2] = list(1000), [pl1, pl2] = list(0);
  assert.equal(ex1.rarity, 'legendary');
  assert.equal(ex1.exalted, true, 'the first Exalted');
  assert.equal(pl1.exalted, undefined);
  assert.deepEqual(JSON.parse(JSON.stringify(ex2)), JSON.parse(JSON.stringify(pl2)), 'the second piece its stream\'s either way - the Exalted rolled in the last pass');
  off();
  const quiet = legendary('foxglove', ring());
  assert.equal(LR.rollExalted(quiet, () => 0), false, 'off: never');
  assert.equal(quiet.exalted, undefined);
  on();
  LR._setExaltedForTests(0);
  const none = [sword()];
  LR.rollLootRarity(none, { kind: 'pile', tier: 21, boss: true }, { rolls: () => 0, luck: 100 });
  assert.equal(none[0].exalted, undefined, 'the chance is the table\'s');
  LR._setExaltedForTests(null);
  assert.equal(LR.rollExalted({ rarity: 'rare', affixes: [] }, () => 0), false);
});

test('LOOT2: last - the gate\'s and a town\'s Legendaries Exalted one in ten, every earlier draw their seed\'s; the Broker never', () => {
  on();
  let gate = 0, gateEx = 0;
  for (let seed = 1; seed <= 4000; seed++) {
    const s = rollSpoils(seed, 14);
    LR._setExaltedForTests(0);
    const plain = rollSpoils(seed, 14);
    LR._setExaltedForTests(null);
    assert.equal(s.gold, plain.gold);
    assert.equal(s.pieces.length, plain.pieces.length, `seed ${seed}: the Regalia's roll is before it`);
    s.pieces.forEach((p, i) => {
      const q = plain.pieces[i].item;
      assert.equal(p.item.name, q.name, `seed ${seed}: piece ${i}`);
      // PIN MOVED (TECH1, bible/05-Combat/Weapon-Techniques.md): a weapon's technique is the door's very last draw, so where
      // an Exalted drew before it the two runs' techniques differ - set aside on both sides; the Exalted's line is the last
      // line before it
      const own = (it) => (it.affixes ?? []).filter((a) => !LR.isTechniqueAffix(a));
      assert.deepEqual(p.item.exalted ? own(p.item).slice(0, -1) : own(p.item), own(q), `seed ${seed}: its record's lines`);
      if (p.item.rarity === 'legendary') { gate++; if (p.item.exalted) gateEx++; }
    });
  }
  assert.ok(gate > 300 && Math.abs(gateEx / gate - 0.1) < 0.04, `the gate's Legendaries, one in ten Exalted (${gateEx} of ${gate})`);
  let town = 0, townEx = 0;
  for (let seed = 1; seed <= 6000; seed++) {
    const s = rollRaidSpoils(seed, 14, seed % 3);
    LR._setExaltedForTests(0);
    const plain = rollRaidSpoils(seed, 14, seed % 3);
    LR._setExaltedForTests(null);
    assert.equal(s.pieces.length, plain.pieces.length, `seed ${seed}: the set piece's roll is before it`);
    assert.equal(s.pieces.at(-1).item.name, plain.pieces.at(-1).item.name);
    if (s.pieces[0].item.rarity === 'legendary') { town++; if (s.pieces[0].item.exalted) townEx++; }
  }
  assert.ok(town > 100 && townEx > 0 && Math.abs(townEx / town - 0.1) < 0.05, `a town's Legendaries, one in ten Exalted (${townEx} of ${town})`);
  for (let day = 0; day < 400; day++) for (const o of brokerStock(day)) assert.ok(!o.item.exalted, `day ${day}: the Broker's stock is the day's fixed tables`);
});

test('LOOT2: the wire keeps the mark and refuses a forged one; the pips; the Test Room shows one', () => {
  on();
  const fox = legendary('foxglove', ring());
  LR.exaltLegendary(fox, lcg(8));
  const back = validLootItem(JSON.parse(JSON.stringify(fox)));
  assert.equal(back.exalted, true);
  assert.deepEqual(back.affixes, fox.affixes);
  assert.equal(validLootItem({ ...JSON.parse(JSON.stringify(fox)), exalted: 'yes' }), null, 'a mark that is not a flag is not an item');
  assert.ok(rarityVarsCss().includes(`[data-rarity="legendary"][data-exalted] { ${EXALTED_PIPS} }`), 'the Exalted\'s pips, after the tiers');
  assert.ok(rarityVarsCss().indexOf('[data-exalted]') > rarityVarsCss().indexOf('[data-rarity="legendary"] {'), 'laid after the Legendary\'s, so it outranks it');
  assert.match(EXALTED_PIPS, /\\25c6\\25c6\\25c6\\2605/);
  const entity = { isPlayer: true, items: [], stats: {}, skills: new Array(35).fill(30), level: 5, career: {} };
  const added = seedTestLoot(entity, lcg(2));
  const ex = added.filter((i) => i.exalted);
  assert.equal(ex.length, 1, 'one Exalted in the room');
  assert.equal(ex[0].isIdentified, true, 'known, so its lines read');
  assert.equal(LR.rarityLines(ex[0])[0], 'Exalted Legendary');
  _resetForTests();
});

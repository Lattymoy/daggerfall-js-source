// LOOT4 - FIVE AFFIX KINDS THAT DO THINGS (2026-10-01; bible/06-Systems/Loot-Arc.md section 6, Mac: "Do you wanna turn
// this into an arc and do all of the above?" - "Proc affixes. Add on-hit fire or frost damage, life leech, thorns,
// spell-cost reduction ... Most of these already have a set-ability hook they can reuse"). The laws pinned here:
//   - THE KINDS: elemental (fire, frost, shock) and slayer (undead, daedra, humanoid, animal) and leech on a weapon,
//     thorns on armour, focus on jewellery - each banded by tier, each a word, never naming a piece.
//   - THE ROLL: never the ladder's own draw; a door's LAST PASS gives a Magic one in five and a Rare a bit over one in
//     three, one a piece, its tier's band - the procs before the Exalted, so neither moves the other's roll.
//   - THE KIT (systems/lootPowers.js), MY entity's alone, offline and online, never at a player: the sear and the
//     slayer's edge on the blow of the weapon in hand (none on an immune foe, half on one that resists; its own kind of
//     foe alone), the leech off the blow that landed, the thorns back to a foe whose blow took my health (through the
//     sets' own law of a blow, under the cap), the focus off my spells (under the cap).
//   - THE WIRE carries a line and refuses a forged one.

import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { setPref, _resetForTests } from '../src/systems/uiPrefs.js';
import * as LR from '../src/systems/lootRarity.js';
import * as LP from '../src/systems/lootPowers.js';
import { setStruck, _resetSetPowersForTests, pendingPlayerBlow } from '../src/systems/sigilSetPowers.js';
import { weaponBlowMods } from '../src/systems/entityMods.js';
import { hurtPlayer } from '../src/characters/playerEntity.js';
import { calculateCastCost } from '../src/systems/spellcost.js';
import { setPlayerDoor } from '../src/systems/playerDoor.js';
import { equipItem } from '../src/systems/equip.js';
import { mintCondition } from '../src/systems/itemTemplates.js';
import { createWeapon } from '../src/combat/enemyEquipment.js';
import { ARMOR_MATERIAL } from '../src/systems/armorMaterials.js';
import { EFFECT_FLAGS } from '../src/systems/spellcast.js';
import { validLootItem } from '../src/systems/loot.js';
import { rollSpoils } from '../src/systems/gateSpoils.js';
import { rollRaidSpoils } from '../src/systems/raidSpoils.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
const on = () => { _resetForTests(); setPref('lootRarity', true); LP._resetLootPowersForTests(); _resetSetPowersForTests(); setPlayerDoor(null); };
const off = () => { _resetForTests(); setPref('lootRarity', false); };
const lcg = (seed) => () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return (seed >>> 8) / 0x800000; };
const stats = () => ({ strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 });
const player = () => ({ isPlayer: true, items: [], stats: stats(), skills: new Array(35).fill(30), level: 5, career: {}, activeEffects: [], health: 100, maxHealth: 100, magicka: 0, maxMagicka: 1000 });
const sword = (affixes = []) => Object.assign(createWeapon(120, 0, () => 0.5), { rarity: 'rare', affixes });
const plate = (t, affixes) => Object.assign(mintCondition({ group: 'Armor', templateIndex: t, material: ARMOR_MATERIAL.Steel, flags: 0 }), { rarity: 'rare', affixes });
const ring = (affixes) => Object.assign(mintCondition({ group: 'Jewellery', templateIndex: 135, name: 'Ring', flags: 0 }), { rarity: 'rare', affixes });
const wear = (e, it) => { e.items.push(it); equipItem(e, it); return it; };
const foeOf = (careerIndex, career = {}) => ({ name: `foe${careerIndex}`, careerIndex, career, health: 50, maxHealth: 50 });
function door(foes = [], me = null) {
  const d = { hurts: [] };
  setPlayerDoor({ foes: () => foes.filter((f) => !f.dead), feet: () => [0, 0, 0], hurtFoe: (f, n) => d.hurts.push([f.name, n]), castOnPlayer: () => {}, player: () => me });
  return d;
}
const PROCS = ['elemental', 'leech', 'thorns', 'focus', 'slayer', 'castSpeed'];   // CAST-SPEED: appended

test('LOOT4: the kinds - five that do things, banded, worded, valid; never in the ladder\'s own draw, never a name', () => {
  on();
  assert.deepEqual(LR.AFFIX_IDS.filter((id) => LR.AFFIX_KINDS[id].proc), PROCS);
  assert.deepEqual(LR.AFFIX_KINDS.elemental.groups, ['Weapons']);
  assert.deepEqual(LR.AFFIX_KINDS.slayer.groups, ['Weapons']);
  assert.deepEqual(LR.AFFIX_KINDS.leech.groups, ['Weapons']);
  assert.deepEqual(LR.AFFIX_KINDS.thorns.groups, ['Armor']);
  assert.deepEqual(LR.AFFIX_KINDS.focus.groups, ['Jewellery']);
  assert.deepEqual(LR.PROC_ELEMENTS, ['fire', 'frost', 'shock']);
  assert.deepEqual(LR.SLAYER_FOES, ['undead', 'daedra', 'humanoid', 'animal']);
  for (const id of PROCS) {
    const r = LR.AFFIX_RANGES[id];
    assert.ok(r.magic[1] <= r.rare[1] && r.rare[1] <= r.legendary[1], `${id}: the bands rise`);
    assert.ok(LR.AFFIX_WORTH[id] > 0, `${id}: a worth`);
    const param = LR.AFFIX_KINDS[id].params?.[0];
    const a = param === undefined ? { id, value: r.rare[0] } : { id, param, value: r.rare[0] };
    assert.ok(LR.validAffix(a), `${id}: in band`);
    assert.equal(LR.validAffix({ ...a, value: r.legendary[1] + 1 }), false, `${id}: past its ceiling`);
    assert.ok(LR.affixLabel(a) && LR.affixWord(a, 'rare'), `${id}: a label and a word`);
  }
  assert.equal(LR.validAffix({ id: 'elemental', param: 'acid', value: 3 }), false, 'an element it does not know');
  assert.equal(LR.validAffix({ id: 'slayer', param: 'dragon', value: 12 }), false, 'a kind of foe it does not know');
  assert.equal(LR.validAffix({ id: 'leech', param: 'fire', value: 3 }), false, 'a param a kind without one');
  assert.equal(LR.affixLabel({ id: 'elemental', param: 'fire', value: 5 }), '+5 Fire damage');
  assert.equal(LR.affixLabel({ id: 'slayer', param: 'undead', value: 15 }), '+15% damage vs the undead');
  assert.equal(LR.affixLabel({ id: 'leech', value: 5 }), '5% life leech');
  assert.equal(LR.affixLabel({ id: 'thorns', value: 4 }), '4 thorns');
  assert.equal(LR.affixLabel({ id: 'focus', value: 6 }), '-6% spell cost');
  // never in the ladder's own draw
  const rolls = lcg(4);
  for (const make of [() => createWeapon(120, 1), () => mintCondition({ group: 'Armor', templateIndex: 102, material: 0x201, flags: 0 }), () => mintCondition({ group: 'Jewellery', templateIndex: 133, flags: 0 })]) {
    for (let i = 0; i < 600; i++) for (const tier of ['magic', 'rare']) assert.ok(!LR.rollAffixes(make(), tier, rolls).some(LR.isProcAffix), 'the numbers alone');
  }
  // never a name: a Magic named by its suffix keeps one word with a prefix that does something beside it
  const m = LR.applyRarity(createWeapon(120, 1), 'magic', () => 0.99);
  const name = m.name;
  m.affixes = [...m.affixes, { id: 'elemental', param: 'fire', value: 2 }];
  assert.equal(LR.rarityName(m, 'magic', m.affixes), name, 'its name is its numbers\'');
});

test('LOOT4: the roll - a door\'s last pass, a Magic one in five, a Rare a bit over one in three, one a piece, its tier\'s band', () => {
  on();
  const count = (tier, make, n, seed) => {
    const rolls = lcg(seed);
    let hit = 0;
    for (let i = 0; i < n; i++) {
      const it = LR.applyRarity(make(), tier, rolls);
      const line = LR.rollProcLine(it, rolls);
      if (!line) continue;
      hit++;
      assert.ok(LR.AFFIX_KINDS[line.id].proc && LR.AFFIX_KINDS[line.id].groups.includes(it.group), `${line.id} may land on ${it.group}`);
      const [lo, hi] = LR.AFFIX_RANGES[line.id][tier];
      assert.ok(line.value >= lo && line.value <= hi, 'its tier\'s band');
      assert.equal(it.affixes.at(-1), line, 'appended, after its numbers');
      assert.equal(LR.rollProcLine(it, () => 0), null, 'one a piece');
      assert.deepEqual(LR.affixBand(it, it.affixes.length - 1), [lo, hi], 'its band read on the card');
    }
    return hit / n;
  };
  const mw = count('magic', () => createWeapon(120, 1), 3000, 5);
  const rw = count('rare', () => createWeapon(120, 1), 3000, 6);
  const ra = count('rare', () => mintCondition({ group: 'Armor', templateIndex: 104, material: 0x201, flags: 0 }), 2000, 7);
  const rj = count('rare', () => mintCondition({ group: 'Jewellery', templateIndex: 133, flags: 0 }), 2000, 8);
  assert.ok(Math.abs(mw - 0.2) < 0.03, `a Magic one in five (${mw.toFixed(3)})`);
  for (const r of [rw, ra, rj]) assert.ok(Math.abs(r - 0.35) < 0.04, `a Rare 35 in a hundred (${r.toFixed(3)})`);
  assert.equal(LR.rollProcLine(LR.applyRarity(createWeapon(120, 1), 'legendary', lcg(1)), () => 0), null, 'never a Legendary (its power is its own)');
  off();
  assert.equal(LR.rollProcLine(Object.assign(createWeapon(120, 1), { rarity: 'rare', affixes: [] }), () => 0), null, 'off: never');
  on();
  // the host door's last pass: the procs before the Exalted - a Rare's line the same whether a Legendary beside it was Exalted
  const seq = (first, rest) => { let i = 0; return () => (i++ === 0 ? first : rest()); };
  const pass = (perMille) => {
    LR._setExaltedForTests(perMille); LR._setProcForTests({ magic: 1000, rare: 1000 });
    const two = [createWeapon(120, 1), createWeapon(116, 1)];
    LR.rollLootRarity(two, { kind: 'pile', tier: 21, boss: true }, { rolls: seq(0, lcg(31)), luck: 100 });
    LR._setExaltedForTests(null); LR._setProcForTests(null);
    return two;
  };
  const [a1, a2] = pass(1000), [b1, b2] = pass(0);
  assert.equal(a1.rarity, 'legendary');
  assert.ok(a1.exalted && !b1.exalted);
  if (a2.rarity === 'magic' || a2.rarity === 'rare') assert.deepEqual(a2.affixes, b2.affixes, 'the proc drawn before the Exalted');
  // and the pass itself, a Legendary listed BEFORE a Rare: the Rare's line the same whether the Legendary was Exalted
  const passOf = (perMille) => {
    const leg = LR.applyRarity(createWeapon(120, 1), 'legendary', lcg(2));
    const rare = LR.applyRarity(createWeapon(116, 1), 'rare', lcg(3));
    LR._setExaltedForTests(perMille); LR._setProcForTests({ magic: 1000, rare: 1000 });
    LR.lastPass([leg, rare], lcg(41));
    LR._setExaltedForTests(null); LR._setProcForTests(null);
    return { leg, rare };
  };
  const x = passOf(1000), y = passOf(0);
  assert.ok(x.leg.exalted && !y.leg.exalted);
  assert.deepEqual(x.rare.affixes, y.rare.affixes, 'every proc before any Exalted, whatever the list\'s order');
  assert.ok(x.rare.affixes.some(LR.isProcAffix));
});

test('LOOT4: the seeded doors keep their earlier draws - the gate\'s and a town\'s pieces their seed\'s, the lines that do something appended', () => {
  on();
  // PIN MOVED (TECH1, bible/05-Combat/Weapon-Techniques.md): a weapon's technique is the door's very last draw - where a
  // proc or an Exalted drew before it the two runs' techniques differ, so it is set aside on both sides (an Exalted's line
  // is the last line before it)
  const noTech = (it) => (it.affixes ?? []).filter((a) => !LR.isTechniqueAffix(a));
  const strip2 = (it) => { const own = noTech(it); return own.filter((a) => !LR.isProcAffix(a) && !(it.exalted && own.indexOf(a) === own.length - 1)); };
  let procs = 0;
  for (let seed = 1; seed <= 1500; seed++) {
    const s = rollSpoils(seed, 12);
    LR._setProcForTests({ magic: 0, rare: 0 }); LR._setExaltedForTests(0);
    const p = rollSpoils(seed, 12);
    LR._setProcForTests(null); LR._setExaltedForTests(null);
    assert.equal(s.gold, p.gold);
    assert.equal(s.pieces.length, p.pieces.length, `seed ${seed}: the Regalia's roll is before the last pass`);
    s.pieces.forEach((x, i) => {
      assert.equal(x.item.name, p.pieces[i].item.name);
      assert.deepEqual(strip2(x.item), noTech(p.pieces[i].item), `seed ${seed}: piece ${i}'s numbers`);
      if ((x.item.affixes ?? []).some(LR.isProcAffix)) procs++;
    });
  }
  assert.ok(procs > 300, `the gate's Magic and Rares take lines that do something (${procs})`);
  for (let seed = 1; seed <= 1500; seed++) {
    const s = rollRaidSpoils(seed, 12, seed % 3);
    LR._setProcForTests({ magic: 0, rare: 0 }); LR._setExaltedForTests(0);
    const p = rollRaidSpoils(seed, 12, seed % 3);
    LR._setProcForTests(null); LR._setExaltedForTests(null);
    assert.equal(s.pieces.length, p.pieces.length);
    assert.equal(s.pieces[0].item.name, p.pieces[0].item.name);
  }
});

test('LOOT4: the sear and the slayer\'s edge - the weapon in hand\'s, at a foe, its own kind, none on the immune, half on the resisting', () => {
  on();
  const me = player();
  const w = sword([{ id: 'elemental', param: 'fire', value: 5 }, { id: 'slayer', param: 'undead', value: 20 }]);
  const zombie = foeOf(17), orc = foeOf(7), fireDaedra = foeOf(26, { immunityFlags: EFFECT_FLAGS.Fire }), resists = foeOf(15, { resistanceFlags: EFFECT_FLAGS.Fire });
  assert.equal(LP.foeGroup(zombie), 'undead');
  assert.equal(LP.foeGroup(orc), 'humanoid');
  assert.equal(LP.foeGroup({ affinity: 'Human', careerIndex: 0 }), 'humanoid', 'a class foe by its affinity, never its career index');
  assert.equal(LP.foeGroup(foeOf(28)), 'undead', 'a vampire');
  assert.equal(LP.foeGroup(foeOf(34)), 'animal', 'a dragonling, DFU\'s own grouping');
  assert.equal(LP.foeGroup(foeOf(35)), null, 'an atronach is none');
  assert.equal(LP.lootBlow(w, 10, me, zombie, {}), 10 + 2 + 5, 'the undead: 20% and the fire');
  assert.equal(LP.lootBlow(w, 10, me, orc, {}), 15, 'an orc: the fire alone');
  assert.equal(LP.lootBlow(w, 10, me, fireDaedra, {}), 10, 'fire-proof: none of it');
  assert.equal(LP.lootBlow(w, 10, me, resists, {}), 10 + 2 + 2, 'a resisting skeleton: half the fire, floored');
  assert.equal(weaponBlowMods(w, 10, me, zombie, { unaware: false }), 17, 'registered: the blow modifier reads it');
  // the fraction carried: four blows of 3 at +20% land 12 whole and 2 more
  LP._resetLootPowersForTests();
  const w2 = sword([{ id: 'slayer', param: 'animal', value: 20 }]);
  let total = 0;
  for (let i = 0; i < 5; i++) total += LP.lootBlow(w2, 3, me, foeOf(0), {});
  assert.equal(total, 15 + 3, 'a fifth of every 3, carried: three whole points over five blows');
  // never: a player, a peer, a foe's blow, the ward, a miss, off
  assert.equal(LP.lootBlow(w, 10, me, { isPlayer: true }, {}), 10, 'a duel');
  assert.equal(LP.lootBlow(w, 10, { ...me, peer: true }, zombie, {}), 10, 'a peer\'s blow resolved here');
  assert.equal(LP.lootBlow(w, 10, foeOf(7), me, {}), 10, 'a foe\'s blow');
  assert.equal(LP.lootBlow(w, 10, me, { ...zombie, warded: true }, {}), 10, 'the Warden\'s ward');
  assert.equal(LP.lootBlow(w, 0, me, zombie, {}), 0, 'a miss');
  assert.equal(LP.lootBlow(sword(), 10, me, zombie, {}), 10, 'a weapon with none');
  off();
  assert.equal(LP.lootBlow(w, 10, me, zombie, {}), 10, 'off: DFU exactly');
});

test('LOOT4: the leech - its share of the blow that landed heals me, the fraction carried, never past my maximum, never a body', () => {
  on();
  const me = player();
  me.health = 50;
  const w = sword([{ id: 'leech', value: 5 }]);
  LP.lootStrike(me, foeOf(7), 30, w);
  assert.equal(me.health, 51, '5% of 30 is 1.5 - one whole');
  LP.lootStrike(me, foeOf(7), 10, w);
  assert.equal(me.health, 52, 'the half carried, and the next half makes one');
  me.health = 100;
  LP.lootStrike(me, foeOf(7), 200, w);
  assert.equal(me.health, 100, 'never past the maximum');
  const dead = { ...player(), health: 0 };
  LP.lootStrike(dead, foeOf(7), 200, w);
  assert.equal(dead.health, 0, 'never a body');
  me.health = 40;
  LP.lootStrike(me, { isPlayer: true }, 200, w);
  LP.lootStrike(me, foeOf(7), 200, sword());
  assert.equal(me.health, 40, 'never at a player; never a weapon without');
});

test('LOOT4: the thorns - back to the foe whose blow took my health, through the sets\' law of a blow, under the cap', () => {
  on();
  const me = player();
  wear(me, plate(102, [{ id: 'thorns', value: 4 }]));
  wear(me, plate(107, [{ id: 'thorns', value: 3 }]));
  assert.equal(LP.wornSum(me, 'thorns'), 7);
  const orc = foeOf(7);
  const d = door([{ name: 'orc', entity: orc, dead: false }], me);
  setStruck(orc, me, 6);
  assert.deepEqual(pendingPlayerBlow(), null, 'the mark waits for the door');
  hurtPlayer(me, 6);
  assert.deepEqual(d.hurts, [['orc', 7]], 'the struck foe takes the thorns I wear');
  hurtPlayer(me, 3);
  assert.equal(d.hurts.length, 1, 'a fall, a poison - no blow, no thorns');
  // the cap
  for (const t of [104, 105, 106, 108, 103]) wear(me, plate(t, [{ id: 'thorns', value: 10 }]));
  setStruck(orc, me, 5); hurtPlayer(me, 5);
  assert.deepEqual(d.hurts.at(-1), ['orc', LP.THORNS_CAP], 'never past the cap');
  // a blow that took nothing answers nothing
  const before = d.hurts.length;
  setStruck(orc, me, 5); hurtPlayer(me, 0);
  assert.equal(d.hurts.length, before);
  off();
  setStruck(orc, me, 5); hurtPlayer(me, 5);
  assert.equal(d.hurts.length, before, 'off: none');
  // the registration, in the sigil sets' own hurt: one law of a landed blow
  assert.match(strip(read('src/systems/sigilSetPowers.js')), /if \(before - after > 0\) for \(const fn of _landed\.values\(\)\)/);
});

test('LOOT4: the focus - my spells cost less, all I wear under the cap; registered at every seam under one name', () => {
  on();
  const me = player();
  wear(me, ring([{ id: 'focus', value: 6 }]));
  wear(me, Object.assign(mintCondition({ group: 'Jewellery', templateIndex: 133, name: 'Amulet', flags: 0 }), { rarity: 'rare', affixes: [{ id: 'focus', value: 4 }] }));
  assert.equal(LP.lootCastCost(me, 100), 90, 'ten in a hundred off');
  assert.equal(LP.lootCastCost({ ...me, peer: true }, 100), 100, 'a peer\'s cast is its own');
  const spell = { effects: [{ type: 4, subType: 0, durationBase: 0, durationMod: 0, durationPerLevel: 1, chanceBase: 0, chanceMod: 0, chancePerLevel: 1, magnitudeBaseLow: 10, magnitudeBaseHigh: 20, magnitudeLevelBase: 1, magnitudeLevelHigh: 2, magnitudePerLevel: 1 }], rangeType: 2, element: 0 };
  const priced = calculateCastCost(spell, me).sp;
  off();
  const plain = calculateCastCost(spell, me).sp;
  on();
  assert.ok(plain > 10, `a real price (${plain})`);
  assert.equal(priced, Math.max(1, Math.round((plain * 90) / 100)), 'the registered modifier takes its ten in a hundred off the real price');
  for (const t of [133, 135, 136, 137, 138, 134]) wear(me, Object.assign(mintCondition({ group: 'Jewellery', templateIndex: t, flags: 0 }), { rarity: 'rare', affixes: [{ id: 'focus', value: 10 }] }));
  assert.equal(LP.lootCastCost(me, 100), 100 - LP.FOCUS_CAP, 'never past the cap');
  const src = strip(read('src/systems/lootPowers.js'));
  for (const [seam, fn] of [['registerWeaponBlowMod', 'lootBlow'], ['registerPlayerStrikeListener', 'lootStrike'], ['registerPlayerBlowLanded', 'lootLanded'], ['registerSpellCostMod', 'lootCastCost']]) {
    assert.match(src, new RegExp(`\\n${seam}\\(LOOT_POWERS, ${fn}\\);`), `${seam} -> ${fn}`);
  }
  assert.match(read('src/scenes/world.js'), /from '\.\.\/systems\/lootPowers\.js'; import \{ setSetPowersVoice/, 'the game imports it beside the sets');
});

test('LOOT4: the wire carries a line that does something and refuses a forged one', () => {
  on();
  const it = LR.applyRarity(createWeapon(120, 1), 'rare', lcg(3));
  LR.addProcLine(it, lcg(9));
  const back = validLootItem(JSON.parse(JSON.stringify(it)));
  assert.deepEqual(back.affixes, it.affixes);
  for (const bad of [{ id: 'elemental', param: 'acid', value: 3 }, { id: 'thorns', value: 99 }, { id: 'slayer', value: 10 }]) {
    assert.equal(validLootItem({ ...JSON.parse(JSON.stringify(it)), affixes: [...it.affixes, bad] }), null, JSON.stringify(bad));
  }
});

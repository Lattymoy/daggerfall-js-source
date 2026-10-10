// TECH1 (bible/05-Combat/Weapon-Techniques.md): THE TECHNIQUES AS LINES - the roster's one table (combat/techniqueRoster.js),
// the line on the weapon (systems/lootRarity.js AFFIX_KINDS.technique), its draw at a door's END (Loot-II law 9), the
// Reforge, the hone and the card, and the item law that judges it (systems/itemLaw.js - the account service's too).
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setPref, _resetForTests } from '../src/systems/uiPrefs.js';
import * as LR from '../src/systems/lootRarity.js';
import * as RO from '../src/combat/techniqueRoster.js';
import { itemFindings, ITEM_LAW_VERSION } from '../src/systems/itemLaw.js';
import { createWeapon } from '../src/combat/enemyEquipment.js';
import { mintCondition, setItemFields } from '../src/systems/itemTemplates.js';
import { rollSpoils } from '../src/systems/gateSpoils.js';
import { rollSdSpoils } from '../src/systems/sdSpoils.js';
import { rollSerpentSpoils } from '../src/systems/serpentSpoils.js';
import { rollRaidSpoils } from '../src/systems/raidSpoils.js';
import { rollCorpseKit } from '../src/systems/foeLootCap.js';
import { seedTestLoot, TECHNIQUE_TEST_BASES } from '../src/systems/testRoom.js';
import { THUNDERLOCK_TEMPLATE, PELLET_TEMPLATE } from '../src/characters/thunderlockIds.js';
import { validLootItem } from '../src/systems/loot.js';

const lcg = (seed) => { let s = (seed >>> 0) || 1; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; };
const on = () => { _resetForTests(); setPref('lootRarity', true); LR._setTechniqueForTests(null); };
const gauntlets = (material = 0x0201) => mintCondition(setItemFields({ group: 'Armor', templateIndex: RO.GAUNTLETS_TEMPLATE, material }));
const cuirass = () => mintCondition(setItemFields({ group: 'Armor', templateIndex: 102, material: 0x0201 }));
const ring = () => mintCondition({ group: 'Jewellery', templateIndex: 135, name: 'Ring', flags: 0 });
/** A Rare of `make` with a chosen technique line at `value`. */
const withTech = (make, id, value = 20, tier = 'rare') => {
  const it = LR.applyRarity(make(), tier, lcg(7));
  LR.addTechniqueLine(it, () => 0.5, { id });
  if (value != null) { const a = LR.techniqueLineOf(it); a.value = value; }
  return it;
};

test('TECH1 THE ROSTER: twelve techniques, two to each family that swings (a gun one), every DFU weapon in exactly its skill\'s family, the Gauntlets the bare hand\'s, an arrow and a cuirass none (mutants: a technique in a second family; a template in the wrong family; ammunition with a family)', () => {
  assert.deepEqual(RO.TECHNIQUE_IDS, ['volley', 'pierce', 'leap', 'whirlwind', 'shadowstep', 'lunge', 'cleave', 'execute', 'slam', 'crush', 'kick', 'haymaker']);
  assert.deepEqual(Object.fromEntries(RO.TECHNIQUE_IDS.map((id) => [id, [...RO.TECHNIQUES[id].families]])), {
    volley: ['archery'], pierce: ['archery', 'thunderlock'], leap: ['longBlade'], whirlwind: ['longBlade'],
    shadowstep: ['shortBlade'], lunge: ['shortBlade'], cleave: ['axe'], execute: ['axe'], slam: ['blunt'], crush: ['blunt'],
    kick: ['handToHand'], haymaker: ['handToHand'],
  });
  const fam = (t) => RO.techniqueFamily({ group: 'Weapons', templateIndex: t });
  assert.deepEqual([113, 114, 116, 117].map(fam), Array(4).fill('shortBlade'), 'dagger, tanto, shortsword, wakazashi');
  assert.deepEqual([118, 119, 120, 121, 122, 123].map(fam), Array(6).fill('longBlade'), 'broadsword .. dai-katana');
  assert.deepEqual([115, 124, 125, 126].map(fam), Array(4).fill('blunt'), 'staff, mace, flail, warhammer');
  assert.deepEqual([127, 128].map(fam), ['axe', 'axe']);
  assert.deepEqual([129, 130].map(fam), ['archery', 'archery']);
  assert.equal(fam(THUNDERLOCK_TEMPLATE), 'thunderlock', 'the gun, its own family - no volley of pellets');
  assert.equal(fam(131), null, 'an arrow is no weapon that swings');
  assert.equal(fam(PELLET_TEMPLATE), null, 'nor a Dwemer Pellet');
  assert.equal(RO.techniqueFamily(gauntlets()), 'handToHand');
  assert.equal(RO.techniqueFamily(cuirass()), null);
  assert.equal(RO.techniqueFamily(ring()), null);
  assert.deepEqual(RO.techniquesFor({ group: 'Weapons', templateIndex: THUNDERLOCK_TEMPLATE }), ['pierce']);
  assert.deepEqual(RO.techniquesFor(gauntlets()), ['kick', 'haymaker']);
  for (const t of Object.values(RO.TECHNIQUES)) {
    assert.ok(t.fatigue > 0 && t.cooldown > 0 && t.base > 0, `${t.name}: a price and a weight`);
    if (t.mech === 'swing' || t.mech === 'leap' || t.mech === 'dash') assert.ok(['StrikeDown', 'StrikeLeft', 'StrikeRight'].includes(t.strike), `${t.name}: the machine's own strike`);
  }
});

test('TECH1 THE NUMBERS: one power band for every technique, the per-mille at a door, the multiplier and the card\'s words (mutants: a band moved; a chance moved; the multiplier off the value)', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(RO.TECHNIQUE_BANDS)), { magic: [5, 15], rare: [15, 30], legendary: [30, 50] });
  assert.deepEqual({ ...RO.TECHNIQUE_PER_MILLE }, { magic: 120, rare: 300, legendary: 450 });
  assert.equal(RO.techniqueMult(1.4, 0), 1.4);
  assert.ok(Math.abs(RO.techniqueMult(1.4, 25) - 1.75) < 1e-12);
  assert.ok(Math.abs(RO.techniqueMult(0.5, 50) - 0.75) < 1e-12);
  assert.equal(RO.TECHNIQUE_MAX_SPEED, 16, 'under the relay\'s 18 m/s step (net/siegeRef.js)');
  assert.equal(RO.techniqueBrief('volley', 22), 'Aim: 6 arrows rain on 3.5 m, 61% each. 6 fatigue, 16s');
  assert.equal(RO.techniqueBrief('execute', 0), 'Strike for 120%, to 220% on the wounded. 5 fatigue, 11s');
  assert.equal(RO.techniqueBrief('leap', 50), 'Aim: leap 9 m, strike all in 2.5 m, 210%. 5 fatigue, 12s');
  assert.equal(RO.techniqueBrief('nonesuch', 10), '');
});

test('TECH1 THE LINE: a kind of its own, appended last, a weapon\'s or the Gauntlets\' - its params the piece\'s family\'s, its label the technique\'s name and power, a name it never gives (mutants: a technique in the numbers\' pool, the proc pool, the Exalted\'s or the curse\'s; another family\'s param)', () => {
  on();
  const k = LR.AFFIX_KINDS.technique;
  assert.equal(Object.keys(LR.AFFIX_KINDS).at(-1), 'technique', 'appended after every kind');
  assert.equal(LR.AFFIX_IDS.includes('technique'), false, 'in no pool: AFFIX_IDS are the draws\' kinds');
  assert.equal(LR.AFFIX_IDS.at(-1), 'castSpeed', 'so every pool is the pool it was');
  assert.equal(k.technique, true);
  assert.equal(k.slot, null, 'no slot: it never names a piece');
  assert.equal(k.proc, undefined, 'no proc - one line of its own beside the proc slot');
  assert.deepEqual([...k.groups], ['Weapons', 'Armor']);
  assert.equal(k.params, RO.TECHNIQUE_IDS);
  assert.equal(LR.AFFIX_RANGES.technique, RO.TECHNIQUE_BANDS);
  assert.equal(LR.AFFIX_WORTH.technique, 30);
  assert.equal(LR.affixLabel({ id: 'technique', param: 'volley', value: 22 }), 'Volley +22%');
  assert.equal(LR.affixLabel({ id: 'technique', param: 'nonesuch', value: 22 }), '', 'an unknown technique is no line');
  assert.equal(LR.validAffix({ id: 'technique', param: 'leap', value: 50 }), true);
  assert.equal(LR.validAffix({ id: 'technique', param: 'leap', value: 51 }), false, 'past the Legendary ceiling');
  assert.deepEqual(LR.kindParams('technique', createWeapon(129, 1)), ['volley', 'pierce']);
  assert.deepEqual(LR.kindParams('technique', cuirass()), [], 'a cuirass has no hand');
  // never drawn by another line's pool: the numbers', the proc line's, an Exalted's, a curse's
  for (let seed = 1; seed < 300; seed++) {
    const w = LR.applyRarity(createWeapon(120, 1), seed % 2 ? 'rare' : 'magic', lcg(seed));
    assert.ok(!w.affixes.some(LR.isTechniqueAffix), 'the numbers\' pass');
    LR.addProcLine(w, lcg(seed ^ 3));
    assert.ok(!w.affixes.some(LR.isTechniqueAffix), 'the proc line');
    const leg = LR.applyRarity(createWeapon(120, 1), 'legendary', lcg(seed));
    LR.exaltLegendary(leg, lcg(seed ^ 5));
    const cur = LR.applyRarity(createWeapon(120, 1), 'rare', lcg(seed));
    LR.cursePiece(cur, lcg(seed ^ 7));
    for (const it of [leg, cur]) assert.ok(!it.affixes.some(LR.isTechniqueAffix), 'an Exalted\'s line or a curse\'s');
  }
  // it never names a piece: the name before the line is the name after it
  const named = LR.applyRarity(createWeapon(120, 1), 'rare', lcg(3));
  const before = named.name;
  LR.addTechniqueLine(named, lcg(4));
  assert.equal(named.name, before);
});

test('TECH1 ADD: a technique of the piece\'s family, its band, its worth, set before a gem\'s line - one at most, none on a piece no family takes, a chosen one of another family refused (mutants: the band; the gem\'s place; a second line)', () => {
  on();
  const bow = LR.applyRarity(createWeapon(130, 1), 'rare', lcg(9));
  const worth = bow.value;
  const line = LR.addTechniqueLine(bow, lcg(10));
  assert.ok(['volley', 'pierce'].includes(line.param));
  assert.ok(line.value >= 15 && line.value <= 30);
  assert.equal(bow.value, worth + 30 * line.value);
  assert.equal(LR.addTechniqueLine(bow, lcg(11)), null, 'one at most');
  assert.equal(LR.techniqueLineOf(bow), line);
  assert.equal(LR.addTechniqueLine(LR.applyRarity(cuirass(), 'rare', lcg(1)), lcg(2)), null, 'no family');
  assert.equal(LR.addTechniqueLine(createWeapon(130, 1), lcg(2)), null, 'a plain piece takes no line');
  assert.equal(LR.addTechniqueLine(LR.applyRarity(createWeapon(120, 1), 'rare', lcg(1)), lcg(2), { id: 'volley' }), null, 'a sword never volleys');
  const leg = LR.applyRarity(createWeapon(120, 1), 'legendary', lcg(4));
  const lt = LR.addTechniqueLine(leg, lcg(5), { id: 'whirlwind' });
  assert.ok(lt.value >= 30 && lt.value <= 50, 'a Legendary\'s in the Legendary band');
  // a gem's line stays last
  const g = LR.applyRarity(createWeapon(120, 1), 'rare', lcg(6));
  g.socket = LR.SOCKET_EMPTY;
  LR.setGem(g, 'ruby');
  const gemLine = g.affixes.at(-1);
  LR.addTechniqueLine(g, lcg(7));
  assert.equal(g.affixes.at(-1), gemLine);
  assert.ok(LR.isTechniqueAffix(g.affixes.at(-2)));
});

test('TECH1 THE DOOR: one roll a piece at its tier\'s chance, the door\'s LAST draw - every earlier draw is what it was, and a tier with no chance draws nothing (mutants: the chance; the roll before the late finds; a draw at no chance)', () => {
  on();
  // the chance: Magic about one in eight, Rare three in ten, Legendary nine in twenty, over the real roll
  const hit = { magic: 0, rare: 0, legendary: 0 }, n = { magic: 0, rare: 0, legendary: 0 };
  const rolls = lcg(42);
  for (let i = 0; i < 6000; i++) {
    const tier = ['magic', 'rare', 'legendary'][i % 3];
    const it = LR.applyRarity(createWeapon(113 + (i % 18), 1), tier, rolls);
    if (it.rarity !== tier) continue;
    n[tier]++;
    if (LR.rollTechniqueLine(it, rolls)) hit[tier]++;
  }
  for (const [tier, pm] of Object.entries(RO.TECHNIQUE_PER_MILLE)) assert.ok(Math.abs(hit[tier] / n[tier] - pm / 1000) < 0.035, `${tier}: ${hit[tier]} of ${n[tier]}`);
  // no chance, no draw (the socket pass's rule)
  LR._setTechniqueForTests({});
  let drawn = 0;
  LR.rollTechniqueLine(LR.applyRarity(createWeapon(120, 1), 'rare', lcg(2)), () => { drawn++; return 0; });
  assert.equal(drawn, 0);
  LR._setTechniqueForTests(null);
  // THE DOOR'S LAST DRAW: a door run with the pass off is the door run with it on, line for line, but the technique
  const src = { kind: 'corpse', tier: 21, boss: true, family: null };
  const noTech = (it) => { const t = LR.techniqueLineOf(it); return t ? { ...it, affixes: it.affixes.filter((a) => a !== t), value: it.value - LR.affixesWorth([t], it) } : it; };
  let tech = 0;
  for (let seed = 1; seed < 60; seed++) {
    const make = () => [createWeapon(120, 1), createWeapon(130, 1), gauntlets(), cuirass()];
    const a = make(); LR.rollLootRarity(a, src, { rolls: lcg(seed) });
    LR._setTechniqueForTests({});
    const b = make(); LR.rollLootRarity(b, src, { rolls: lcg(seed) });
    LR._setTechniqueForTests(null);
    assert.equal(a.length, b.length, `seed ${seed}: the same finds`);
    a.forEach((it, i) => { if (LR.techniqueLineOf(it)) tech++; assert.deepEqual(noTech(it), b[i], `seed ${seed}: piece ${i} its seed's but the technique`); });
  }
  assert.ok(tech > 10, `the corpse door minted techniques (${tech})`);
  // the seeded doors: the gate's, the Abyss's, the serpent's, a town's thanks - and a body's kit
  for (let seed = 1; seed < 80; seed++) {
    const doors = [() => rollSpoils(seed, 14), () => rollSdSpoils(seed, 20), () => rollSerpentSpoils(seed, 14, 'dealt'), () => rollRaidSpoils(seed, 14, 2)];
    for (const door of doors) {
      const s = door();
      LR._setTechniqueForTests({});
      const p = door();
      LR._setTechniqueForTests(null);
      assert.equal(s.gold, p.gold);
      assert.deepEqual(s.pieces.map((x) => noTech(x.item)), p.pieces.map((x) => x.item), `seed ${seed}: the spoils before it are their seed's`);
      assert.deepEqual(s.card ?? null, p.card ?? null, 'the card before it');
    }
  }
  let kitTech = 0;
  for (let seed = 1; seed < 300 && !kitTech; seed++) {
    const body = { mobileType: 141, level: 18, equip: null, items: [createWeapon(120, 1), createWeapon(129, 1)] };
    for (const it of rollCorpseKit(body, { rolls: lcg(seed) })) if (LR.techniqueLineOf(it)) kitTech++;
  }
  assert.ok(kitTech, 'a body\'s kit can come off it with a technique');
  // off: nothing
  setPref('lootRarity', false);
  const offList = [createWeapon(120, 1)];
  LR.rollLootRarity(offList, src, { rolls: () => 0 });
  assert.equal(LR.techniqueLineOf(offList[0]), null);
  assert.equal(LR.rollTechniqueLine(withTech(() => createWeapon(120, 1), null, null), () => 0), null, 'the switch off: no roll');
  _resetForTests();
});

test('TECH1 THE REFORGE AND THE HONE: a technique stays a technique of its family and nothing else becomes one; its value hones to its band\'s top; a Legendary\'s is the find\'s - an Exalted\'s own line stays the Reforge\'s (mutants: the reforge\'s kind guard; the Exalted\'s index)', () => {
  on();
  for (let seed = 1; seed < 200; seed++) {
    const sword = withTech(() => createWeapon(120, 1), seed % 2 ? 'leap' : 'whirlwind', 18);
    const t = sword.affixes.findIndex(LR.isTechniqueAffix);
    const line = LR.reforgeAffix(sword, t, lcg(seed));
    assert.equal(line.id, 'technique');
    assert.ok(['leap', 'whirlwind'].includes(line.param), 'its family\'s');
    assert.ok(line.value >= 15 && line.value <= 30);
    const other = withTech(() => createWeapon(120, 1), 'leap', 18);
    const n = LR.reforgeAffix(other, 0, lcg(seed ^ 9));
    assert.ok(n && !LR.isTechniqueAffix(n), 'a number never becomes a technique');
  }
  const honed = withTech(() => createWeapon(127, 1), 'cleave', 16);
  const ti = honed.affixes.findIndex(LR.isTechniqueAffix);
  assert.ok(LR.honeableLines(honed).includes(ti));
  for (let i = 0; i < 40 && LR.honeableLines(honed).includes(ti); i++) LR.honeAffix(honed, ti, lcg(i + 1));
  assert.equal(honed.affixes[ti].value, 30, 'up to the Rare band\'s top');
  // an Exalted Legendary with a technique: the Reforge takes the Exalted's line, never the technique's
  const leg = withTech(() => createWeapon(120, 1), 'leap', 40, 'legendary');
  assert.equal(LR.exaltLegendary(leg, lcg(3)), true);
  const tl = leg.affixes.findIndex(LR.isTechniqueAffix);
  assert.equal(tl, leg.affixes.length - 1, 'the Exalted\'s line set before it');
  assert.deepEqual(LR.reforgeableLines(leg), [tl - 1]);
  assert.deepEqual(LR.affixBand(leg, tl), [30, 50]);
});

test('TECH1 THE CARD: the line with its band, then what a press does with its numbers; nothing with the switch off (mutants: the detail line dropped; its numbers off the value)', () => {
  on();
  const bow = withTech(() => createWeapon(130, 1), 'volley', 22);
  assert.deepEqual(LR.rarityLines(bow), ['Rare', 'Unidentified'], 'a Rare is read once it is known (DFU\'s IsIdentified) - its technique works all the same');
  bow.isIdentified = true;
  const lines = LR.rarityLines(bow);
  const i = lines.indexOf('Volley +22% [15-30]');
  assert.ok(i > 0, lines.join(' | '));
  assert.equal(lines[i + 1], 'Aim: 6 arrows rain on 3.5 m, 61% each. 6 fatigue, 16s');
  assert.equal(LR.techniqueDetail({ id: 'damage', value: 5 }), '');
  // a Legendary's technique line - rolled at the find, Exalted or not - reads the Legendary band (its record's lines none)
  const leg = withTech(() => createWeapon(120, 1), 'leap', 41, 'legendary');
  leg.isIdentified = true;
  assert.equal(leg.exalted, undefined);
  const at = leg.affixes.findIndex(LR.isTechniqueAffix);
  assert.equal(LR.affixLine(leg, at), 'Leap Strike +41% [30-50]');
  assert.deepEqual(LR.affixBand(leg, at), [30, 50]);
  setPref('lootRarity', false);
  assert.deepEqual(LR.rarityLines(bow), []);
  _resetForTests();
});

test('TECH1 THE LAW: a technique of the piece\'s family, one, last of its own lines, in its tier\'s band - every honest shape lawful, each forgery named; the law moved to 2 (mutants: the count; the place; the family; the band)', () => {
  on();
  assert.equal(ITEM_LAW_VERSION, 2);
  const lawful = [
    withTech(() => createWeapon(130, 1), 'pierce', 20), withTech(() => createWeapon(116, 1), 'lunge', 10, 'magic'),
    withTech(gauntlets, 'kick', 25), withTech(() => createWeapon(126, 1), 'slam', 45, 'legendary'),
  ];
  for (const it of lawful) assert.deepEqual(itemFindings(it), [], it.name);
  const ex = withTech(() => createWeapon(120, 1), 'leap', 40, 'legendary');
  LR.exaltLegendary(ex, lcg(3));
  assert.deepEqual(itemFindings(ex), [], 'an Exalted after the technique: its line before it');
  const cu = withTech(() => createWeapon(120, 1), 'leap', 20);
  LR.cursePiece(cu, lcg(4));
  assert.deepEqual(itemFindings(cu), [], 'a curse after it, the same');
  const forged = (fn) => { const it = withTech(() => createWeapon(120, 1), 'leap', 20); fn(it); return itemFindings(it); };
  assert.ok(forged((it) => { it.affixes.at(-1).param = 'volley'; }).includes('affixes'), 'a sword\'s volley');
  assert.ok(forged((it) => { it.affixes.push({ id: 'technique', param: 'whirlwind', value: 20 }); }).includes('affixes'), 'two techniques');
  assert.ok(forged((it) => { const t = it.affixes.pop(); it.affixes.unshift(t); }).includes('affixes'), 'not its last line');
  assert.ok(forged((it) => { it.affixes.at(-1).value = 31; }).includes('affixes'), 'past the Rare band');
  const cuirassTech = LR.applyRarity(cuirass(), 'rare', lcg(2));
  cuirassTech.affixes.push({ id: 'technique', param: 'kick', value: 20 });
  assert.ok(itemFindings(cuirassTech).includes('affixes'), 'a cuirass has no hand');
  const ringTech = LR.applyRarity(ring(), 'rare', lcg(2));
  ringTech.affixes.push({ id: 'technique', param: 'kick', value: 20 });
  assert.ok(itemFindings(ringTech).includes('affixes'), 'a jewel is not of the group');
  const legLow = withTech(() => createWeapon(120, 1), 'leap', 20, 'legendary');
  assert.ok(itemFindings(legLow).includes('affixes'), 'a Legendary\'s under its band');
  // the wire's own door takes an honest piece
  assert.ok(validLootItem(JSON.parse(JSON.stringify(lawful[0]))));
});

test('TECH1 THE TEST ROOM: one Rare a technique, each on a piece of its family at the band\'s middle, known and lawful (mutants: a technique left out; another family\'s base)', () => {
  on();
  const entity = { isPlayer: true, items: [], stats: {}, skills: new Array(35).fill(30), level: 5, career: {} };
  const added = seedTestLoot(entity, lcg(2));
  const techs = added.filter((it) => LR.techniqueLineOf(it));
  assert.deepEqual(techs.map((it) => LR.techniqueLineOf(it).param), RO.TECHNIQUE_IDS);
  for (const it of techs) {
    const a = LR.techniqueLineOf(it);
    assert.equal(it.rarity, 'rare');
    assert.equal(it.isIdentified, true);
    assert.equal(a.value, 23, 'the band\'s middle');
    assert.ok(RO.TECHNIQUES[a.param].families.includes(RO.techniqueFamily(it)));
    assert.deepEqual(itemFindings(it), [], it.name);
  }
  assert.deepEqual(Object.keys(TECHNIQUE_TEST_BASES).sort(), ['archery', 'axe', 'blunt', 'handToHand', 'longBlade', 'shortBlade']);
  _resetForTests();
});

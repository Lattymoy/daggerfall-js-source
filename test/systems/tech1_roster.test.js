// TECH1 (bible/05-Combat/Weapon-Techniques.md): THE TECHNIQUES AS LINES - the roster's one table (combat/technique/techniqueRoster.js),
// the line on the weapon (systems/loot/lootRarity.js AFFIX_KINDS.technique), its draw at a door's END (Loot-II law 9), the
// Reforge, the hone and the card, and the item law that judges it (systems/item/itemLaw.js - the account service's too).
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setPref, _resetForTests } from '../../src/systems/uiPrefs.js';
import * as LR from '../../src/systems/loot/lootRarity.js';
import * as RO from '../../src/combat/technique/techniqueRoster.js';
import { itemFindings, ITEM_LAW_VERSION } from '../../src/systems/item/itemLaw.js';
import { createWeapon } from '../../src/combat/enemyEquipment.js';
import { mintCondition, setItemFields } from '../../src/systems/item/itemTemplates.js';
import { rollSpoils } from '../../src/systems/gate/gateSpoils.js';
import { rollSdSpoils } from '../../src/systems/superDungeon/sdSpoils.js';
import { rollSerpentSpoils } from '../../src/systems/serpent/serpentSpoils.js';
import { rollRaidSpoils } from '../../src/systems/raidSpoils.js';
import { rollCorpseKit } from '../../src/systems/foeLootCap.js';
import { seedTestLoot, TECHNIQUE_TEST_BASES } from '../../src/systems/testRoom.js';
import { THUNDERLOCK_TEMPLATE, PELLET_TEMPLATE } from '../../src/characters/thunderlockIds.js';
import { validLootItem } from '../../src/systems/loot/loot.js';
import { ACCOUNT_VERSION } from '../../server-account/src/service.js';
import { ARENA_SPEED_MAX, ARENA_HIT_HZ_MAX } from '../../src/net/arena/arenaLaw.js';
import { SIEGE_SPEED } from '../../src/net/siege/siegeRef.js';

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
  // AUDIT TECH1: a Roleplay & Realism weapon keeps its family with its mod's switch off (this suite runs with the mods off)
  assert.deepEqual([fam(513), fam(514)], ['axe', 'blunt'], 'the Archer\'s Axe and the Light Flail - their class, whatever the switch');
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
  // AUDIT TECH1: under EVERY referee's step - the arena's 12.5 m/s (16 had a Lunge's poses refused there and its landing
  // measured from a stale one), the siege's and the open zone's 18
  assert.equal(RO.TECHNIQUE_MAX_SPEED, 12);
  assert.ok(RO.TECHNIQUE_MAX_SPEED < ARENA_SPEED_MAX && RO.TECHNIQUE_MAX_SPEED < SIEGE_SPEED.mps);
  // AUDIT TECH1: a Volley's shafts a frame wider apart than the arena's four a second - none of the six refused there
  const v = RO.TECHNIQUES.volley;
  assert.ok(v.spread / (v.arrows - 1) >= 1 / ARENA_HIT_HZ_MAX + 1 / 60, `${v.spread / (v.arrows - 1)} s a shaft`);
  assert.equal(RO.techniqueBrief('volley', 22), 'Aim: 6 arrows rain down within 3.5 m, 61% each. 6 fatigue, 16s');
  assert.equal(RO.techniqueBrief('execute', 0), 'Strike for 120%, to 220% on the wounded. 5 fatigue, 11s');
  assert.equal(RO.techniqueBrief('leap', 50), 'Aim: leap 9 m, strike all in 2.5 m, 210%. 5 fatigue, 12s');
  assert.equal(RO.techniqueBrief('nonesuch', 10), '');
  // AUDIT TECH1: no blow is 'sure' (law 1), and the Gauntlets' two say they are the bare hand's
  assert.equal(RO.techniqueBrief('crush', 0), 'One heavy blow, 160%, +30 to hit. 5 fatigue, 10s');
  assert.equal(RO.techniqueBrief('haymaker', 0), 'Bare-handed: one heavy blow, 180%, +30 to hit. 4 fatigue, 9s');
  assert.equal(RO.techniqueBrief('kick', 0), 'Bare-handed, aim: leap 6 m, strike all in 2 m, 130%. 4 fatigue, 10s');
});

test('TECH1 THE LINE: a kind of its own, appended last, a weapon\'s or the Gauntlets\' - its params the piece\'s family\'s, its label the technique\'s name and power, a name it never gives (mutants: a technique in the numbers\' pool, the proc pool, the Exalted\'s or the curse\'s; another family\'s param)', () => {
  on();
  const k = LR.AFFIX_KINDS.technique;
  assert.equal(Object.keys(LR.AFFIX_KINDS).at(-1), 'technique', 'appended after every kind');
  assert.equal(LR.AFFIX_IDS.includes('technique'), false, 'in no pool: AFFIX_IDS are the draws\' kinds');
  assert.equal(LR.AFFIX_IDS.at(-1), 'wellspring', 'so every pool is the pool it was');   // PIN MOVED (BAL9c): the caster's two after castSpeed
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

test('TECH1 THE DOOR: one roll a piece at its tier\'s chance, the door\'s LAST draw - every earlier draw is what it was, and a tier with no chance draws nothing (mutants: the chance; the roll before the damning; a draw at no chance)', () => {
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
  // THE DOOR'S LAST DRAW: a door run with the pass off is the door run with it on, line for line, but the technique.
  // PIN MOVED (PELLETS-SCARCE, 2026-10-24): the Dwemer Pellet's find is a FINAL find - drawn after the technique
  // (lootRarity.js rollFinalFinds), so the technique's draws move it, as every pass above moves the ones after it (law 9);
  // it is held off here, and pelletsscarce.test.js pins that it is the door's very last draw
  LR._holdFinalFindsForTests(true);
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
  // TRUE-CURSE's damning draws before it (merged from main): every cursed piece's damning roll is its seed's - the curse
  // forced on, so a door's Legendary weapons are cursed and the damning draws for each
  LR._setCurseForTests(1);
  let damned = 0;
  try {
    for (let seed = 1; seed < 400; seed++) {
      const make = () => [createWeapon(120, 1), createWeapon(130, 1), createWeapon(118, 1), createWeapon(126, 1)];
      const a = make(); LR.rollLootRarity(a, src, { rolls: lcg(seed) });
      LR._setTechniqueForTests({});
      const b = make(); LR.rollLootRarity(b, src, { rolls: lcg(seed) });
      LR._setTechniqueForTests(null);
      a.forEach((it, i) => { if (LR.isDamned(it)) damned++; assert.deepEqual(noTech(it), b[i], `seed ${seed}: piece ${i}, damned or not, its seed's`); });
    }
  } finally { LR._setCurseForTests(null); LR._holdFinalFindsForTests(false); }
  assert.ok(damned > 10, `the damning drew and damned (${damned})`);
  // the seeded doors: the gate's, the Abyss's, the serpent's, a town's thanks - and a body's kit
  for (let seed = 1; seed < 80; seed++) {
    const doors = [() => rollSpoils(seed, 14), () => rollSdSpoils(seed, 20), () => rollSerpentSpoils(seed, 14, 'dealt'), () => rollRaidSpoils(seed, 14, 2)];
    for (const door of doors) {
      const s = door();
      LR._setTechniqueForTests({});
      const p = door();
      LR._setTechniqueForTests(null);
      assert.equal(s.gold, p.gold);
      // PIN MOVED (GILDED2, bible/06-Systems/Gilded.md section 7): the gate's Oath and the serpent's Sovereign are the doors'
      // very last draw, AFTER the technique's - set aside on both sides
      const unGilded = (list) => list.filter((x) => x.tier !== 'gilded' || x.item.gilded === 'the-hourlock');
      assert.deepEqual(unGilded(s.pieces).map((x) => noTech(x.item)), unGilded(p.pieces).map((x) => x.item), `seed ${seed}: the spoils before it are their seed's`);
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

test('TECH1 THE REFORGE AND THE HONE: REFORGE-REPLACE - a technique\'s line is never reforged (only a technique may stand there, and the Reforge never gives a line its own kind back) and nothing else becomes one; its value hones to its band\'s top; a Legendary\'s is the find\'s - an Exalted\'s own line stays the Reforge\'s (mutants: the reforge\'s kind guard; the Exalted\'s index)', () => {
  on();
  for (let seed = 1; seed < 200; seed++) {
    const sword = withTech(() => createWeapon(120, 1), seed % 2 ? 'leap' : 'whirlwind', 18);
    const t = sword.affixes.findIndex(LR.isTechniqueAffix);
    // PIN MOVED (REFORGE-REPLACE, 2026-10-25, the owner: "Replace, price rises"): a technique was rolled again among its
    // family's; a reforge always puts ANOTHER kind in a line's place, and nothing but a technique may stand in a
    // technique's (the item law: one, the piece's last own line) - so the line is not offered, and the hone raises it
    const was = JSON.stringify(sword);
    assert.ok(!LR.reforgeableLines(sword).includes(t), 'a technique\'s line is not offered');
    assert.equal(LR.reforgeAffix(sword, t, lcg(seed)), null);
    assert.equal(JSON.stringify(sword), was, 'nothing changed');
    assert.ok(LR.reforgeableLines(sword).length > 0 && LR.honeableLines(sword).includes(t), 'its number lines are reforged, and the technique honed');
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
  assert.equal(lines[i + 1], 'Aim: 6 arrows rain down within 3.5 m, 61% each. 6 fatigue, 16s');
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
  assert.equal(ITEM_LAW_VERSION, 14);   // PIN MOVED (AFFIX-LINES and REFORGE-REPLACE): law 14 - the Reforge's count a mark of the tiers it takes alone; PIN MOVED (KETCH): law 13 - the Gilded rung's Ketch pair (Volendrung's Echo, the Ketchmaster's Word) lawful; PIN MOVED (GUNS-UNFOUND): law 12 - the Hourlock lawful as a gilded Dwarven Long Bow and as the Thunderlock minted before, the Sunken Sovereign as the Ebony Saber again and as the Pistolet minted between; PIN MOVED (SEA-SET): law 11 - the Eltheric Tidemail's nine records lawful (law 10 on its branch, renumbered past PISTOLET's at the merge); PIN MOVED (PISTOLET, AUDIT PISTOLET): law 10 - the Pistolet known, the Sunken Sovereign lawful as a gilded Pistolet and as the saber minted before; PIN MOVED (SOUL-LAW, FIELD BUGS 2026-10-20h): law 9 - a soul of Daggerfall Enemy Expansion's fifty is lawful in a Soul Gem or Azura's Star; PIN MOVED (WITCH1): law 8 - the Soul Cake and the Hearth Offering known to the service's law; PIN MOVED (KEY-LAW): law 7 - the Weir Key known to the service's law; PIN MOVED (MAKER-KEPT): law 6 - a maker-era Aetheric piece keeps its maker's rows; PIN MOVED (GILDED2): law 5 - the Gilded rung's two new records are lawful; PIN MOVED (HACKED-GOLD): law 4 - a letter of credit's worth and a coin pile's count past one DFU int are findings (law 3 on its branch, renumbered past BAL9c at the merge); PIN MOVED (BAL9c): the caster's two lines and the arcane three are lawful from law 3 on
  // AUDIT TECH1: THE LAW MOVES THE SERVICE. The account Worker's judge IS this law (judge.js JUDGE_VERSION), and a site
  // deploy waits only on ACCOUNT_VERSION (.github/workflows/deploy.yml) - a law moved without it ships the site before the
  // judge that knows it, and an honest piece reads as a forgery (a hold and a strike) in the gap. Each law version names
  // the first service that carries it; a law with no entry here, or a service older than its entry, fails.
  const LAW_SERVICE = { 1: 0, 2: 108, 3: 121, 4: 123, 5: 137, 6: 148, 7: 151, 8: 165, 9: 166, 10: 168, 11: 172, 12: 178, 13: 180, 14: 187 };   // PIN MOVED (AFFIX-LINES and REFORGE-REPLACE): law 14 is acct187's (acct182 on its branch, renumbered at the merge); PIN MOVED (KETCH): law 13 is acct180's; PIN MOVED (GUNS-UNFOUND): law 12 is acct178's (acct177 on its branch, renumbered past ACCOUNT-HOMES at the merge); PIN MOVED (SEA-SET): law 11 is acct172's (law 10 and acct168, then acct169, on its branch, renumbered past PISTOLET at the merges); PIN MOVED (PISTOLET, AUDIT PISTOLET): law 10 is acct168's;   // PIN MOVED (SOUL-LAW, FIELD BUGS 2026-10-20h): law 9 is acct166's; PIN MOVED (WITCH1): law 8 is acct165's (acct162 then acct164 on its branch, renumbered at the merges); PIN MOVED (KEY-LAW): law 7 is acct151's (acct150 on its branch, renumbered past WIKIMAID at the merge); PIN MOVED (MAKER-KEPT): law 6 is acct148's (acct146 on its branch, renumbered past main's acct146 and acct147 at the merge); PIN MOVED (GILDED2): law 5 is acct137's (acct135 on its branch, renumbered past main's acct135 and acct136 at the merge); PIN MOVED (HACKED-GOLD): law 4 is acct123's (law 3 and acct121 on its branch, renumbered past BAL9c at the merge; then acct122, renumbered past NAME-AS - which carries law 3 - at the next)   // BAL9c: law 3 is acct121's   // PIN MOVED (TECH1 at the #749 merge): law 2 is acct108's - main's acct107 is LW15's, which never carried it; PIN MOVED (TECH1 at the #755 merge): law 2 was acct107's - main's acct106 is SCALE4d's, which never carried it; PIN MOVED (TECH1 at the #745 merge): law 2 was acct106's - main's acct105 is THE INTEGRITY ARC lane 3's, which never carried it
  assert.ok(Number.isInteger(LAW_SERVICE[ITEM_LAW_VERSION]), `item law ${ITEM_LAW_VERSION} names no account service - bump ACCOUNT_VERSION with it and record it here`);
  assert.ok(Number(/^acct(\d+)$/.exec(ACCOUNT_VERSION)?.[1]) >= LAW_SERVICE[ITEM_LAW_VERSION], `${ACCOUNT_VERSION} predates item law ${ITEM_LAW_VERSION}`);
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
  // TECH1 at the TRUE-CURSE merge: a door damns a cursed Legendary weapon (damnPass) and then rolls its technique - the
  // damned curse's line stays its own line, the technique after it, and the law and the damning both stand
  const rec = LR.LEGENDARIES.find((l) => l.group === 'Weapons' && (!l.templates || l.templates.includes(120)));
  const dm = LR.applyRarity(createWeapon(120, 1), 'legendary', () => 0, [rec]);
  LR.cursePiece(dm, () => 0.9, { damned: true });
  LR._setTechniqueForTests({ legendary: 1000 });
  try { LR.techniquePass([dm], () => 0.5); } finally { LR._setTechniqueForTests(null); }
  assert.ok(LR.isDamned(dm) && LR.isTechniqueAffix(dm.affixes.at(-1)), 'damned, and a technique its last line');
  assert.deepEqual(itemFindings(dm), [], 'a damned Legendary weapon with a technique after its damning: lawful');
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

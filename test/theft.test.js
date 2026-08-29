// PT1 - STEALING HAD NO CONSEQUENCE.
//
// Two flags stood in worldModes' interior arm, both routed to "the
// crime arc". Every dependency they named had shipped - CG2's
// TallyCrimeGuildRequirements, G1's SpawnCityGuards, the crime table
// and its SuppressCrime setter, TallySkill - so what was left was the
// two laws themselves.
//
// AND THEY ARE NOT ONE LAW, which is what the shop-shelf flag got
// wrong: it promised "the shoplifting ROLL and its crime tally", and
// DFU's shop-shelf arm has no roll at all. Read side by side
// (DaggerfallInventoryWindow.cs):
//
//   SHOP SHELF (:681-687) - at the window's teardown, a COUNT
//     comparison against what the shelf held when it opened, and a
//     Thieves Guild tally if it shrank. No chance, no guards, no crime.
//   PRIVATE PROPERTY (:2277-2281 -> :1848-1863) - the tally FIRST and
//     unconditionally, then CalculateShopliftingChance, then either
//     Theft + SpawnCityGuards(true) or a Pickpocket tally.
//
// A correct claim generalised past its member, which is DE1's lesson
// arriving in a different arc.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { theftBasket, shopliftingLoad, privatePropertyTheft, shopShelfTheft } from '../src/systems/theft.js';
import { calculateShopliftingChance, dice100 } from '../src/combat/formulas.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

// Real templates, because itemWeight reads the template table -
// a fixture with a `weight` field of its own weighs nothing, which is
// how the first draft of the truncation pin proved nothing.
const LIGHT = 103;   // 1.25 kg
const HEAVY = 102;   // 12.5 kg
const item = (name, templateIndex = 0) => ({ name, templateIndex });

test('PT1: CalculateShopliftingChance is the chance of being SEEN', () => {
  // 100 - live Pickpocket, + shopQuality + weightAndNumItems, clamp 5..95
  assert.equal(calculateShopliftingChance(40, 10, 6), 76);
  assert.equal(calculateShopliftingChance(0, 0, 0), 95, 'clamped at the top');
  assert.equal(calculateShopliftingChance(100, 0, 0), 5, 'and at the bottom');
  // a better thief lowers it; a finer shop and a heavier armful raise it
  assert.ok(calculateShopliftingChance(80, 10, 6) < calculateShopliftingChance(40, 10, 6));
  assert.ok(calculateShopliftingChance(40, 20, 6) > calculateShopliftingChance(40, 10, 6));
  assert.ok(calculateShopliftingChance(40, 10, 30) > calculateShopliftingChance(40, 10, 6));
});

test('PT1: the theft basket is what LEFT the container', () => {
  const a = item('a'); const b = item('b'); const mine = item('mine');
  assert.deepEqual(theftBasket([a, b], [b]), [a], 'one taken');
  assert.deepEqual(theftBasket([a, b], [a, b]), [], 'nothing taken');
  assert.deepEqual(theftBasket([a, b], [a, b, mine]), [],
    'putting one of your OWN items in is not a theft of it');
  assert.deepEqual(theftBasket([a, b], []), [a, b]);
  assert.deepEqual(theftBasket(null, null), []);
});

test('PT1: the load TRUNCATES the weight and adds the count', () => {
  // (int)basket.GetWeight() + basket.Count (:1852) - the truncation is
  // the law: three trinkets weighing 0.3 each contribute 0 + 3.
  // three at 1.25 kg = 3.75 -> trunc 3, plus a count of 3
  assert.equal(shopliftingLoad([item('a', LIGHT), item('b', LIGHT), item('c', LIGHT)]), 6);
  // and the truncation is real: 12.5 -> 12, not 13
  assert.equal(shopliftingLoad([item('plate', HEAVY)]), 13);
  assert.equal(shopliftingLoad([item('trinket', 0)]), 1, 'a 0.25 kg trinket contributes its COUNT alone');
  assert.equal(shopliftingLoad([]), 0);
});

test('PT1: an empty basket is no theft at all', () => {
  // the window's own gate (:2277, `theftBasket.Count != 0`) - opening a
  // stranger's drawer and taking nothing must not tally
  assert.equal(privatePropertyTheft({ basket: [] }), null);
  assert.equal(privatePropertyTheft({}), null);
});

test('PT1: detection is !Dice100.FailedRoll - the roll UNDER the chance is the bad one', () => {
  const basket = [item('gem', 0)];   // 0.25 kg -> trunc 0, + count 1 = 1
  const skill = 40, quality = 10;
  const chance = calculateShopliftingChance(skill, quality, 1);   // 71
  const at = (r) => privatePropertyTheft({ basket, pickpocketSkill: skill, shopQuality: quality, rolls: () => r });
  assert.equal(at(0.10).chance, chance);
  assert.equal(at(0.10).detected, true, 'a low roll is UNDER the chance of being seen');
  assert.equal(at(0.99).detected, false, 'a high roll gets away with it');
  // the exact boundary: floor(r*100) < chance detects
  assert.equal(at((chance - 1) / 100).detected, true);
  assert.equal(at(chance / 100).detected, false);
  // and it IS dice100, not a restatement of it
  assert.equal(at(0.10).detected, dice100(chance, 0.10));
});

test('PT1: the tally does not wait for the roll', () => {
  const basket = [item('gem')];
  const caught = privatePropertyTheft({ basket, pickpocketSkill: 0, shopQuality: 90, rolls: () => 0 });
  const clean = privatePropertyTheft({ basket, pickpocketSkill: 95, shopQuality: 0, rolls: () => 0.99 });
  assert.equal(caught.detected, true);
  assert.equal(clean.detected, false);
  assert.equal(caught.tally, true);
  assert.equal(clean.tally, true, 'the member tallies on its FIRST line, before it rolls anything');
});

test('PT1: the shop shelf is a COUNT comparison and nothing else', () => {
  assert.equal(shopShelfTheft(5, 4), true);
  assert.equal(shopShelfTheft(5, 5), false);
  assert.equal(shopShelfTheft(5, 6), false, 'adding to the shelf is not stealing from it');
  // and the masking quirk is DFU's: put one of yours down, take two
  assert.equal(shopShelfTheft(5, 5), false);
});

test('PT1: the shelf arm tallies and does NOT roll, spawn or record a crime', () => {
  const wm = read('src/scenes/worldModes.js');
  const shelf = wm.slice(wm.indexOf('function openShelf'), wm.indexOf('function openMerchantSell'));
  assert.match(shelf, /const shelfBefore = shelf\.items\.length;/);
  assert.match(shelf, /if \(shopShelfTheft\(shelfBefore, shelf\.items\.length\)\) tallyCrimeGuildRequirements\(playerEntity, true, 1\);/);
  assert.doesNotMatch(shelf, /privatePropertyTheft|setCrimeCommitted|spawnCityGuards/,
    'DFU rolls no dice and calls no guards for a shelf');
});

test('PT1: the private-property arm runs the member in DFU\'s order', () => {
  const wm = read('src/scenes/worldModes.js');
  const arm = wm.slice(wm.indexOf('const openLoot = (privateProperty = false) => {'));
  const body = arm.slice(0, arm.indexOf('if (win) interiorOverlay = win;'));
  assert.match(body, /const before = privateProperty \? \[\.\.\.\(c\.items \?\? \[\]\)\] : null;/,
    'the basket is the container as it stood when the window opened');
  assert.match(body, /if \(!privateProperty\) return;/, 'your own furniture is never a theft');
  const tally = body.indexOf('tallyCrimeGuildRequirements(playerEntity, true, 1);');
  const detect = body.indexOf('if (out.detected) {');
  assert.ok(tally > 0 && detect > tally, 'the tally lands BEFORE the detection fork, as the member does');
  assert.match(body, /setCrimeCommitted\(playerEntity, CRIMES\.Theft\);/, 'through the ONE crime write (V4)');
  assert.match(body, /host\.spawnCityGuards\?\.\(true\);/, 'SpawnCityGuards(true) - immediate');
  assert.match(body, /tallySkill\(playerEntity, SKILLS\.Pickpocket, 1\);/, 'and the clean getaway trains the skill');
  // the shop QUALITY is the building's, as BuildingDiscoveryData is
  assert.match(body, /shopQuality: b\?\.quality \?\? 0,/);
});

test('PT1: Dice100 has ONE home and the tree stopped writing it out', () => {
  // The slice set out to fix three inline copies and nearly shipped a
  // fourth export before noticing formulas.js has had `dice100` since
  // T3a. The three sites route through it now, and nothing re-declares
  // the comparison.
  // IN1's lesson, one arc over: theft.js's own header QUOTES the
  // expression it retired, and a raw sweep read the quotation as a
  // fourth copy. The comment bodies come out before the code is read.
  const codeOnly = (src) => src.split('\n').map((l) => l.replace(/\/\/.*$/, '')).join('\n');
  for (const p of ['src/characters/enemyMotor.js', 'src/world/actionSystem.js', 'src/systems/theft.js']) {
    const s = codeOnly(read(p));
    assert.doesNotMatch(s, /Math\.floor\(\s*(rolls|this\._rolls)\(\)\s*\*\s*100\s*\)\s*>=/,
      `${p} still writes Dice100.FailedRoll out by hand`);
    assert.match(s, /from '\.\.\/combat\/formulas\.js'/);
  }
  // and the strip is not vacuous - it must leave the code it is judging
  assert.match(codeOnly(read('src/systems/theft.js')), /export function privatePropertyTheft/);
  assert.equal(read('src/combat/formulas.js').includes('dice100FailedRoll'), false,
    'and no second export was left behind');
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  HUNT_CLIMATE, HUNT_EVENTS, HUNT_ODDS, HUNT_COOLDOWN, HUNT_MINUTES, HUNT_WAIT_PER_HOUR, huntRealSeconds, BITE_POISON_RANGE, FOUL_WATER_DISEASES,
  POOL_KG, FALL_HURT, BOAR_FATIGUE, SKILL, BEAST_BY_CLIMATE, beastFor, huntRoll, HUNT_PROMPT, huntPrompt, HUNT_BUSY, HUNT_TEXT, huntOutcome, applyHuntOutcome,
} from '../src/systems/survival/hunting.js';
import { TEMPLATE, FOUL_MEAL_DISEASES, WATERSKIN_CAPACITY_KG } from '../src/systems/survival/food.js';
import { createSurvivalItem, SURVIVAL_USE_TEXT } from '../src/systems/survival/items.js';
import { newSurvival } from '../src/systems/survival/needs.js';
import { MOBILE_TYPES } from '../src/characters/mobileTypes.js';
import { REST_WAIT_PER_HOUR } from '../src/systems/restSession.js';
import { SKILLS } from '../src/systems/skills.js';
import { HuntWindow, HUNT_PHASE } from '../src/ui/huntWindow.js';
import { createHunting } from '../src/scenes/hunting.js';
import { setPref, _resetForTests } from '../src/systems/uiPrefs.js';

// ═══ SURV6 (2026-09-18): HUNTING, FORAGING AND THE WATER SEARCH ═════
//
// Climates & Calories' Hunting class restated (the five climate rolls,
// the Yes/No box, the checks by bow or bare hands, the finds and the
// harms, SpawnBeast) with the port's own turn: the event runs in REAL
// TIME on a busy page instead of skipping the clock behind a box, and
// the beast stands when the box closes.

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');
/** A roll sequence: each value once, the last forever. */
const seq = (...v) => { let i = 0; return () => v[Math.min(i++, v.length - 1)]; };
const player = () => ({ isPlayer: true, level: 5, health: 30, maxHealth: 40, fatigue: 20 * 64, items: [], survival: newSurvival(1000), stats: { luck: 50 }, career: {} });
const WILD = { minute: 10 * 60, luck: 50, winter: false, outdoors: true, inLocationRect: false, night: false, enemiesNear: false, resting: false, climateIndex: 232 };

test('SURV6: the roll - the wilderness by day with no foe near, the luck odds against 200 (300 in winter) and the 70, the cooldown on the record, the climate\'s two events', () => {
  const s = newSurvival(0);
  // the gates - nothing rolled, nothing spent
  const never = () => { throw new Error('rolled'); };
  assert.equal(huntRoll(s, { ...WILD, climateIndex: 233 }, never), null, 'a climate the mod never hunted');
  assert.equal(huntRoll(s, { ...WILD, outdoors: false }, never), null);
  assert.equal(huntRoll(s, { ...WILD, inLocationRect: true }, never), null);
  assert.equal(huntRoll(s, { ...WILD, night: true }, never), null);
  assert.equal(huntRoll(s, { ...WILD, enemiesNear: true }, never), null);
  assert.equal(huntRoll(s, { ...WILD, resting: true }, never), null);
  s.huntAt = 2000;
  assert.equal(huntRoll(s, { ...WILD, minute: 1999 }, never), null, 'the cooldown');
  s.huntAt = 0;
  // the odds: luck 50 -> (1 + 5) / 200 = 0.03
  assert.equal(HUNT_ODDS.summer, 200); assert.equal(HUNT_ODDS.winter, 300); assert.equal(HUNT_ODDS.event, 70);
  assert.equal(huntRoll(s, WILD, seq(0.03)), null, 'at the chance is out');
  assert.equal(huntRoll(s, WILD, seq(0.029, 0.70)), null, 'the 70 refused');
  assert.equal(s.huntAt, 0, 'a refusal spends no cooldown');
  const ev = huntRoll(s, WILD, seq(0.029, 0.69, 0.5, 0.2));
  assert.deepEqual(ev, { climate: 'woods', kind: 'birds' });
  assert.equal(s.huntAt, WILD.minute + HUNT_COOLDOWN[0] + Math.floor(0.5 * (HUNT_COOLDOWN[1] - HUNT_COOLDOWN[0] + 1)), 'the cooldown rides the record');
  assert.equal(huntRoll(s, WILD, never), null, 'and holds');
  s.huntAt = 0;
  assert.equal(huntRoll(s, { ...WILD, winter: true }, seq(0.025)), null, 'winter asks 300: 0.025 >= 6/300');
  assert.equal(huntRoll(s, { ...WILD, winter: false }, seq(0.025, 0, 0, 0.9)).kind, 'tracks', 'the same roll lands in summer, the coin\'s other half');
  s.huntAt = 0;
  assert.equal(huntRoll(s, { ...WILD, luck: 100 }, seq(0.054, 0, 0, 0)).kind, 'birds', 'luck 100 -> 11/200');
  // the climates
  assert.deepEqual(HUNT_CLIMATE, { 224: 'desert', 225: 'desert', 229: 'subtropical', 228: 'swamp', 227: 'swamp', 231: 'woods', 232: 'woods', 226: 'mountain', 230: 'mountain' });
  assert.deepEqual(HUNT_EVENTS.desert, ['water', 'rocks']); assert.deepEqual(HUNT_EVENTS.subtropical, ['water', 'fruit']);
  assert.deepEqual(HUNT_EVENTS.swamp, ['birds', 'lizard']); assert.deepEqual(HUNT_EVENTS.mountain, ['birds', 'tracks']);
  for (const ci of [224, 229, 228, 226]) { s.huntAt = 0; assert.equal(huntRoll(s, { ...WILD, climateIndex: ci }, seq(0, 0, 0, 0)).kind, HUNT_EVENTS[HUNT_CLIMATE[ci]][0]); }
  // the prompts
  assert.equal(huntPrompt({ climate: 'woods', kind: 'birds' }, { winter: true }), HUNT_PROMPT.birdsWinter);
  assert.equal(huntPrompt({ climate: 'mountain', kind: 'birds' }, { winter: true }), HUNT_PROMPT.birdsMountain);
  assert.equal(huntPrompt({ climate: 'desert', kind: 'water' }), HUNT_PROMPT.water);
  assert.match(HUNT_PROMPT.tracks[0], /animal tracks/); assert.match(HUNT_PROMPT.lizard[0], /slither/);
  for (const k of ['water', 'rocks', 'fruit', 'birds', 'lizard', 'tracks']) assert.equal(typeof HUNT_BUSY[k], 'string');
  // the pace: the search's minutes at real seconds an hour, far slower than the rest window's skip
  assert.deepEqual(HUNT_MINUTES, [30, 60]);
  assert.equal(huntRealSeconds(60), HUNT_WAIT_PER_HOUR); assert.equal(huntRealSeconds(30), HUNT_WAIT_PER_HOUR / 2);
  assert.ok(HUNT_WAIT_PER_HOUR >= 8 * REST_WAIT_PER_HOUR, 'a hunt is a happening, a rest a skip');
});

test('SURV6: the outcomes - water by the pool, the rocks\' snake by bow or hand and its bite, the trees\' fruit and the strange one, the birds, the lizard, the tracks; the hunted', () => {
  const skills = { archery: 100, stealth: 100, criticalStrike: 100, climbing: 100 };
  const none = { archery: 0, stealth: 0, criticalStrike: 0, climbing: 0 };
  const d = (n) => (n - 1) / 100;   // the first roll: Random(1, 101) = n
  // water
  let o = huntOutcome({ climate: 'desert', kind: 'water' }, { rolls: seq(d(40)) });
  assert.equal(o.key, 'pool'); assert.equal(o.waterKg, POOL_KG.pool); assert.equal(o.disease, false);
  assert.equal(huntOutcome({ climate: 'desert', kind: 'water' }, { rolls: seq(d(41)) }).waterKg, POOL_KG.smallPool);
  assert.equal(huntOutcome({ climate: 'desert', kind: 'water' }, { rolls: seq(d(66)) }).key, 'unsafe');
  o = huntOutcome({ climate: 'subtropical', kind: 'water' }, { rolls: seq(d(81)) });
  assert.equal(o.key, 'foul'); assert.equal(o.waterKg, POOL_KG.foul); assert.equal(o.disease, true);
  assert.equal(huntOutcome({ climate: 'desert', kind: 'water' }, { rolls: seq(d(93)) }).key, 'dust');
  // rocks: the bow's shot (Archery + luck mod - 5 against 1..100), the bite after
  o = huntOutcome({ climate: 'desert', kind: 'rocks' }, { hasBow: true, skills, rolls: seq(d(1), 0.99, 0.15) });
  assert.equal(o.key, 'snakeShot'); assert.equal(o.meat, 1); assert.equal(o.poison, false); assert.deepEqual(o.skills, [SKILL.Archery, SKILL.Stealth]);
  o = huntOutcome({ climate: 'desert', kind: 'rocks' }, { hasBow: true, skills, rolls: seq(d(1), 0.99, 0.14) });
  assert.equal(o.key, 'snakeShotBite'); assert.equal(o.meat, 1); assert.equal(o.poison, true);
  o = huntOutcome({ climate: 'desert', kind: 'rocks' }, { hasBow: true, skills: none, rolls: seq(d(1), 0.5, 0.29) });
  assert.equal(o.key, 'snakeMissBite'); assert.equal(o.meat, 0); assert.equal(o.poison, true);
  assert.equal(huntOutcome({ climate: 'desert', kind: 'rocks' }, { hasBow: true, skills: none, rolls: seq(d(1), 0.5, 0.30) }).key, 'snakeMiss');
  o = huntOutcome({ climate: 'desert', kind: 'rocks' }, { hasBow: false, skills, rolls: seq(d(1), 0.99, 0.30) });
  assert.equal(o.key, 'snakeGrab'); assert.equal(o.meat, 1); assert.deepEqual(o.skills, [SKILL.Stealth, SKILL.CriticalStrike]);
  assert.equal(huntOutcome({ climate: 'desert', kind: 'rocks' }, { hasBow: false, skills, rolls: seq(d(1), 0.99, 0.29) }).key, 'snakeGrabBite');
  assert.equal(huntOutcome({ climate: 'desert', kind: 'rocks' }, { hasBow: false, skills: none, rolls: seq(d(1), 0.5, 0.49) }).key, 'snakeBite');
  assert.equal(huntOutcome({ climate: 'desert', kind: 'rocks' }, { hasBow: false, skills: none, rolls: seq(d(1), 0.5, 0.5) }).key, 'snakeGone');
  o = huntOutcome({ climate: 'desert', kind: 'rocks' }, { rolls: seq(d(96), 0) });
  assert.equal(o.key, 'hunted'); assert.deepEqual(o.beast, { mobileType: MOBILE_TYPES.GiantScorpion, count: 3 });
  // the luck mod: skill 50, luck 50 -> 50 against Random(1, 100): 50 lands, 51 misses
  assert.equal(huntOutcome({ climate: 'desert', kind: 'rocks' }, { hasBow: true, skills: { archery: 50 }, luck: 50, rolls: seq(d(1), 0.49, 0.99) }).key, 'snakeShot');
  assert.equal(huntOutcome({ climate: 'desert', kind: 'rocks' }, { hasBow: true, skills: { archery: 50 }, luck: 50, rolls: seq(d(1), 0.50, 0.99) }).key, 'snakeMiss');
  assert.equal(huntOutcome({ climate: 'desert', kind: 'rocks' }, { hasBow: true, skills: { archery: 50 }, luck: 100, rolls: seq(d(1), 0.54, 0.99) }).key, 'snakeShot', 'luck 100 adds five');
  // fruit
  o = huntOutcome({ climate: 'subtropical', kind: 'fruit' }, { rolls: seq(d(50), 0.99) });
  assert.equal(o.key, 'fruitEasy'); assert.equal(o.fruit, 1);   // MOD: HUNT_LOOT_SCALE halves the yield (3 raw -> 1 scaled)
  o = huntOutcome({ climate: 'subtropical', kind: 'fruit' }, { skills, rolls: seq(d(51), 0.5, 0) });
  assert.equal(o.key, 'fruitClimb'); assert.equal(o.fruit, 1); assert.deepEqual(o.skills, [SKILL.Climbing]);   // MOD: halved (2 raw -> 1 scaled)
  assert.equal(huntOutcome({ climate: 'subtropical', kind: 'fruit' }, { skills: none, rolls: seq(d(75), 0.5) }).key, 'fruitFall');
  o = huntOutcome({ climate: 'subtropical', kind: 'fruit' }, { rolls: seq(d(76)) });
  assert.equal(o.key, 'fruitStrange'); assert.equal(o.poison, true); assert.equal(o.fruit, 0);
  assert.equal(huntOutcome({ climate: 'subtropical', kind: 'fruit' }, { rolls: seq(d(89)) }).key, 'fruitNone');
  // birds: the sneak and the shot, the volley on a second shot
  o = huntOutcome({ climate: 'woods', kind: 'birds' }, { hasBow: true, skills, rolls: seq(d(1), 0.5, 0.5, 0.5, 0.99) });
  assert.equal(o.key, 'birdsVolley'); assert.equal(o.meat, 1); assert.match(o.lines[2], /the 3 dead birds/);   // MOD: the flavour line still names the raw catch (3); o.meat is the halved yield actually minted
  o = huntOutcome({ climate: 'woods', kind: 'birds' }, { hasBow: true, skills: { ...skills, archery: 50 }, rolls: seq(d(1), 0.5, 0.1, 0.9) });
  assert.equal(o.key, 'birdsShot'); assert.equal(o.meat, 0);   // MOD: halved (1 raw -> 0 scaled, this roll)
  assert.equal(huntOutcome({ climate: 'woods', kind: 'birds' }, { hasBow: true, skills: { ...skills, stealth: 0 }, rolls: seq(d(1), 0.5) }).key, 'birdsSpooked');
  o = huntOutcome({ climate: 'swamp', kind: 'birds' }, { hasBow: false, skills, rolls: seq(d(1), 0.5, 0.5) });
  assert.equal(o.key, 'birdsStrike'); assert.equal(o.meat, 0);   // MOD: halved (1 raw -> 0 scaled, this roll)
  o = huntOutcome({ climate: 'swamp', kind: 'birds' }, { rolls: seq(d(91), 0.2) });
  assert.equal(o.key, 'birdsRoar'); assert.deepEqual(o.beast, { mobileType: MOBILE_TYPES.Spider, count: 2 });
  // the lizard
  assert.equal(huntOutcome({ climate: 'swamp', kind: 'lizard' }, { hasBow: true, skills, rolls: seq(d(1), 0.5) }).meat, 1);   // MOD: halved (2 raw -> 1 scaled)
  assert.equal(huntOutcome({ climate: 'swamp', kind: 'lizard' }, { hasBow: true, skills: none, rolls: seq(d(1), 0.5) }).key, 'lizardMiss');
  assert.equal(huntOutcome({ climate: 'swamp', kind: 'lizard' }, { hasBow: false, skills, rolls: seq(d(1), 0.5) }).key, 'lizardStrike');
  assert.equal(huntOutcome({ climate: 'swamp', kind: 'lizard' }, { hasBow: false, skills: none, rolls: seq(d(1), 0.5, 0.49) }).poison, true);
  assert.equal(huntOutcome({ climate: 'swamp', kind: 'lizard' }, { hasBow: false, skills: none, rolls: seq(d(1), 0.5, 0.5) }).key, 'lizardGone');
  assert.equal(huntOutcome({ climate: 'swamp', kind: 'lizard' }, { rolls: seq(d(91), 0.5) }).key, 'lizardHunted');
  // the tracks: deer in the woods, a goat on the mountain, the rabbit, the boar and the fall
  o = huntOutcome({ climate: 'woods', kind: 'tracks' }, { hasBow: true, skills, rolls: seq(d(1), 0.49, 0.5, 0.99) });
  assert.equal(o.key, 'deerShot'); assert.equal(o.meat, 3);   // MOD: halved (6 raw -> 3 scaled)
  assert.equal(huntOutcome({ climate: 'mountain', kind: 'tracks' }, { hasBow: true, skills, rolls: seq(d(1), 0.49, 0.5, 0) }).key, 'goatShot');
  assert.equal(huntOutcome({ climate: 'mountain', kind: 'tracks' }, { hasBow: true, skills: none, rolls: seq(d(1), 0.49, 0.5) }).key, 'goatMiss');
  assert.equal(huntOutcome({ climate: 'woods', kind: 'tracks' }, { hasBow: true, skills, rolls: seq(d(1), 0.5, 0.5) }).key, 'rabbitShot');
  assert.equal(huntOutcome({ climate: 'woods', kind: 'tracks' }, { hasBow: true, skills: none, rolls: seq(d(1), 0.5, 0.5) }).key, 'rabbitMiss');
  assert.equal(huntOutcome({ climate: 'woods', kind: 'tracks' }, { hasBow: false, skills, rolls: seq(d(1), 0.5) }).key, 'rabbitStrike');
  o = huntOutcome({ climate: 'woods', kind: 'tracks' }, { hasBow: false, skills: none, rolls: seq(d(1), 0.5, 0.09) });
  assert.equal(o.key, 'boar'); assert.equal(o.tired, true); assert.equal(o.hurt, 0);
  o = huntOutcome({ climate: 'mountain', kind: 'tracks' }, { hasBow: false, skills: none, rolls: seq(d(1), 0.5, 0.09, 0.99) });
  assert.equal(o.key, 'fall'); assert.equal(o.hurt, FALL_HURT[1]); assert.equal(o.tired, false);
  assert.equal(huntOutcome({ climate: 'woods', kind: 'tracks' }, { hasBow: false, skills: none, rolls: seq(d(1), 0.5, 0.10) }).key, 'rabbitGone');
  o = huntOutcome({ climate: 'mountain', kind: 'tracks' }, { rolls: seq(d(91), 0.9) });
  assert.equal(o.key, 'roar'); assert.deepEqual(o.beast, { mobileType: MOBILE_TYPES.Dragonling_Alternate, count: 1 });
  // SpawnBeast's table
  assert.deepEqual(beastFor('woods', seq(0)), { mobileType: MOBILE_TYPES.GrizzlyBear, count: 3 });
  assert.deepEqual(beastFor('woods', seq(2 / 11)), { mobileType: MOBILE_TYPES.GrizzlyBear, count: 2 });
  assert.deepEqual(beastFor('woods', seq(4 / 11)), { mobileType: MOBILE_TYPES.Spriggan, count: 1 });
  assert.deepEqual(beastFor('mountain', seq(8 / 11)), { mobileType: MOBILE_TYPES.SabertoothTiger, count: 1 });
  assert.deepEqual(beastFor('desert', seq(9 / 11)), { mobileType: MOBILE_TYPES.Dragonling_Alternate, count: 1 });
  assert.deepEqual(BEAST_BY_CLIMATE.subtropical, BEAST_BY_CLIMATE.desert);
  assert.equal(HUNT_TEXT.roar[1], 'You are not the hunter, but the hunted!');
});

test('SURV6: the finds into the pack and the harm onto the body - meat and fruit minted, the skins filled, the bite\'s poison and the foul pool\'s disease through the handlers, the fall and the boar', () => {
  const p = player();
  let rows = applyHuntOutcome(p, p.items, huntOutcome({ climate: 'woods', kind: 'tracks' }, { hasBow: true, skills: { archery: 100 }, rolls: seq(0, 0.49, 0.5, 0) }), { rolls: seq(0.9) });
  assert.equal(p.items.filter((i) => i.templateIndex === TEMPLATE.RawMeat).length, 2);   // MOD: halved (4 raw -> 2 scaled)
  assert.equal(rows.at(-1), 'You gain 2 Raw Meat.'); assert.equal(rows[0], HUNT_TEXT.deerShot[0]);
  // fruit: the coin picks apples or oranges
  p.items.length = 0;
  rows = applyHuntOutcome(p, p.items, { lines: ['x'], fruit: 2 }, { rolls: seq(0.2) });
  assert.equal(p.items.filter((i) => i.templateIndex === TEMPLATE.Apple).length, 2); assert.equal(rows.at(-1), 'You gain 2 Apples.');
  p.items.length = 0;
  rows = applyHuntOutcome(p, p.items, { lines: ['x'], fruit: 1 }, { rolls: seq(0.7) });
  assert.equal(p.items[0].templateIndex, TEMPLATE.Orange); assert.equal(rows.at(-1), 'You gain 1 Orange.');
  // water: no skins, a full skin, an empty one
  p.items.length = 0;
  rows = applyHuntOutcome(p, p.items, { lines: ['x'], waterKg: 5 }, {});
  assert.equal(rows.at(-1), SURVIVAL_USE_TEXT.noSkins);
  const skin = createSurvivalItem(TEMPLATE.Waterskin, { water: 0 }); p.items.push(skin);
  rows = applyHuntOutcome(p, p.items, { lines: ['x'], waterKg: POOL_KG.foul }, {});
  assert.equal(skin.water, POOL_KG.foul); assert.equal(rows.at(-1), HUNT_TEXT.skinsFilled);
  skin.water = WATERSKIN_CAPACITY_KG;
  rows = applyHuntOutcome(p, p.items, { lines: ['x'], waterKg: 5 }, {});
  assert.equal(rows.at(-1), SURVIVAL_USE_TEXT.fullSkin);
  // the handlers
  const poisons = [], diseases = [];
  applyHuntOutcome(p, p.items, { lines: [], poison: true }, { now: 777, rolls: seq(0.99), inflictPoison: (t, type, bypass, o) => poisons.push([t, type, bypass, o.currentMinute]) });
  assert.deepEqual(poisons, [[p, BITE_POISON_RANGE[1], false, 777]]);
  applyHuntOutcome(p, p.items, { lines: [], poison: true }, { rolls: seq(0), inflictPoison: (t, type) => poisons.push(type) });
  assert.equal(poisons[1], BITE_POISON_RANGE[0]); assert.equal(BITE_POISON_RANGE[0], 128); assert.equal(BITE_POISON_RANGE[1], 139);
  applyHuntOutcome(p, p.items, { lines: [], disease: true }, { now: 3 * 1440 + 5, currentDay: 3, inflictDisease: (t, list, o) => diseases.push([list, o.currentDay]) });
  assert.deepEqual(diseases, [[FOUL_WATER_DISEASES, 3]]); assert.deepEqual([...FOUL_WATER_DISEASES], [...FOUL_MEAL_DISEASES]);
  assert.doesNotThrow(() => applyHuntOutcome(p, p.items, { lines: [], poison: true, disease: true }, {}), 'no handler, no harm');
  // the body
  p.health = 3;
  applyHuntOutcome(p, p.items, { lines: [], hurt: 4 }, {});
  assert.equal(p.health, 1, 'a fall never kills');
  p.fatigue = 5 * 64;
  applyHuntOutcome(p, p.items, { lines: [], tired: true }, {});
  assert.equal(p.fatigue, 0); assert.equal(BOAR_FATIGUE, 10 * 64);
  assert.deepEqual(applyHuntOutcome(p, p.items, null, {}), []);
});

test('SURV6: the window - the Yes/No box, No closes; Yes commits to the busy page (no input taken) which turns to the result at the wait\'s end, once; the result box closes on a click', () => {
  let closed = [], searched = 0;
  let w = new HuntWindow({ prompt: ['A?', 'B?'], busy: 'You search...', seconds: 2, onSearched: () => { searched++; return ['Found.']; }, onClosed: (s) => closed.push(s) });
  assert.equal(w.phase, HUNT_PHASE.Ask); assert.equal(w.isChoiceWindow, true); assert.equal(w.done, false);
  w.input('KeyN');
  assert.equal(w.done, true); assert.deepEqual(closed, [false]); assert.equal(searched, 0);
  closed = [];
  w = new HuntWindow({ prompt: ['A?'], busy: 'You search...', seconds: 2, onSearched: () => { searched++; return ['Found.']; }, onClosed: (s) => closed.push(s) });
  w.input('Escape');
  assert.deepEqual(closed, [false], 'Escape is No');
  closed = [];
  w = new HuntWindow({ prompt: ['A?'], busy: 'You search...', seconds: 2, onSearched: () => { searched++; return ['Found.']; }, onClosed: (s) => closed.push(s) });
  w.input('KeyY');
  assert.equal(w.phase, HUNT_PHASE.Busy); assert.equal(w.done, false); assert.equal(w.progress, 0);
  w.input('KeyN'); w.input('KeyY'); assert.equal(w.click(0, 0), true);
  assert.equal(w.phase, HUNT_PHASE.Busy, 'committed - no key or click leaves the busy page (AUDIT SURV C: Escape alone walks away)');
  w.tick(0.5); assert.equal(w.progress, 0.25); assert.equal(w.phase, HUNT_PHASE.Busy); assert.equal(searched, 0);
  w.tick(1.5);
  assert.equal(w.phase, HUNT_PHASE.Result); assert.equal(searched, 1); assert.deepEqual(w.rows, ['Found.']); assert.equal(w.done, false);
  w.tick(5); assert.equal(searched, 1, 'the search ran once');
  w.click(0, 0);
  assert.equal(w.done, true); assert.deepEqual(closed, [true]);
  w = new HuntWindow({ prompt: ['A?'], seconds: 1, onSearched: () => [], onClosed: null });
  w.input('KeyY'); w.tick(1); assert.deepEqual(w.rows, ['Nothing came of it.']);
  w.input('Enter'); assert.equal(w.done, true, 'a key closes the result box');
});

test('SURV6: composed - once a game minute the roll; the window in the slot, none under one; Yes and the wait apply the outcome, tally the skills, pass the minutes; the beast stands at the close; off with the switch', () => {
  _resetForTests();
  const p = player();
  const shown = [], spawned = [], tallied = [], advanced = [];
  const e = { ...WILD, hasBow: true, skills: { archery: 100, stealth: 100, criticalStrike: 100, climbing: 100 } };
  let active = false;
  // the roll's four then the outcome's: d = 96 -> the hunted, beast roll 0 -> three
  const rolls = seq(0.029, 0.69, 0.5, 0.2, 0.5, 0.95, 0);
  const h = createHunting({
    entity: p, env: () => e, rolls, showOverlay: (w) => shown.push(w), overlayActive: () => active,
    advanceMinutes: (n) => advanced.push(n), spawnBeast: (b) => spawned.push(b), tally: (id) => tallied.push(id),
  });
  active = true;
  assert.equal(h.tick(), null, 'under a window');
  active = false;
  assert.equal(h.tick(), null, 'the same minute asks nothing twice');
  e.minute += 1;
  const w = h.tick();
  assert.ok(w instanceof HuntWindow); assert.equal(shown[0], w); assert.equal(h.window, w);
  assert.equal(p.survival.huntAt > e.minute, true, 'the cooldown on the record');
  e.minute += 1;
  assert.equal(h.tick(), null, 'one window at a time');
  w.input('KeyY');
  w.tick(100);
  assert.equal(w.phase, HUNT_PHASE.Result);
  assert.deepEqual(advanced.length, 1); assert.ok(advanced[0] >= HUNT_MINUTES[0] && advanced[0] <= HUNT_MINUTES[1], 'the search\'s minutes passed');
  assert.equal(spawned.length, 0, 'not under the box');
  assert.deepEqual(tallied, [], 'the hunted tallies nothing');
  w.click(0, 0);
  assert.deepEqual(spawned, [{ mobileType: MOBILE_TYPES.GrizzlyBear, count: 3 }]); assert.equal(h.window, null);
  // a find: meat in the pack, the skills tallied
  const p2 = player(); const tallied2 = [];
  const h2 = createHunting({ entity: p2, env: () => ({ ...e, minute: 5000 }), rolls: seq(0, 0, 0.5, 0.2, 0.5, 0, 0.5, 0.5, 0.5, 0.99), tally: (id) => tallied2.push(id) });
  const w2 = h2.tick();
  w2.input('KeyY'); w2.tick(100);
  assert.equal(p2.items.filter((i) => i.templateIndex === TEMPLATE.RawMeat).length, 1, 'the volley\'s three birds, halved by HUNT_LOOT_SCALE');   // MOD: -50%
  assert.deepEqual(tallied2, [SKILLS.Archery, SKILLS.Stealth]);
  // the switch
  setPref('survival', false);
  const h3 = createHunting({ entity: player(), env: () => ({ ...e, minute: 9000 }), rolls: seq(0) });
  assert.equal(h3.tick(), null);
  _resetForTests();
});

test('SURV6: by source - the overworld host alone rolls, opens in the slot, passes the minutes, stands the beast on the wilderness arm; the leaf is pure; every overlay ticks', () => {
  const world = read('src/scenes/world.js'), ext = read('src/scenes/exterior.js'), leaf = read('src/systems/survival/hunting.js');
  assert.match(world, /const hunting = createHunting\(\{/);
  assert.match(world, /minute: Math\.floor\(worldMinutes\(\)\), climateIndex: maps\.getClimateIndex\(playerTravelPixel\(\)\.x, playerTravelPixel\(\)\.y\),/);
  assert.match(world, /luck: liveStat\(playerEntity, 'luck'\), winter: seasonValue\(dateFromClassicMinutes\(worldMinutes\(\)\)\) === SEASONS\.Winter,/);
  assert.match(world, /outdoors: _mode\(\) === 'exterior' && !\(walkMode && playerSpawned && player\.isPlayerSwimming\), inLocationRect: _musicInLocationRect\(\), night: isNight\(minuteNow\(\)\),/);
  assert.match(world, /enemiesNear: areEnemiesNearby\(exteriorFoePool\(\)\), resting: !!playerEntity\.isResting \|\| !!playerEntity\.preventEnemySpawns,/);
  assert.match(world, /hasBow: weaponTypeForItem\(weaponRig\.playerWeapon\.weapon\) === WEAPON_TYPES\.Bow,/);
  assert.match(world, /skills: \{ archery: skillValue\(playerEntity, SKILLS\.Archery\), stealth: skillValue\(playerEntity, SKILLS\.Stealth\), criticalStrike: skillValue\(playerEntity, SKILLS\.CriticalStrike\), climbing: skillValue\(playerEntity, SKILLS\.Climbing\) \},/);
  assert.match(world, /showOverlay: \(w\) => townTalk\.showOverlay\(w\), overlayActive: \(\) => townTalk\.overlayActive,\n\s+advanceMinutes: \(n\) => playerTicker\.advance\(n\),/);
  assert.match(world, /for \(let i = 0; i < count; i\+\+\) _standEncounterFoe\(\{ mobileType, \.\.\.SPAWNER_ARMS\.wilderness \}, feet\);/);
  assert.match(world, /inflictPoison, inflictDisease, tally: \(id\) => tallySkill\(playerEntity, id, 1\),/);
  // TO-FIELD3 (Mac, 2026-09-18: "hunting rolls fire during travel
  // again"). TO-FIELD had held the roll while an accelerated journey
  // ran; the gate is gone, and the roll is the overworld host's mode
  // and nothing else.
  assert.match(world, /if \(_mode\(\) === 'exterior'\) hunting\.tick\(\);/);
  assert.doesNotMatch(world, /worldTimeScale\(\) <= 1\) hunting\.tick\(\)/, 'and no clock gates it');
  assert.doesNotMatch(ext, /createHunting/, 'the town host lives inside the rect');
  assert.doesNotMatch(leaf, /from '\.\.\/\.\.\/scenes\/|from '\.\.\/\.\.\/ui\/|from '\.\.\/\.\.\/combat\/|from '\.\.\/spellcast|from '\.\.\/diseases|from '\.\.\/poisons|from '\.\.\/effects|document\.|window\./);
  assert.match(read('src/scenes/townTalk.js'), /overlay\?\.tick\?\.\(dt\);/, 'the busy page\'s clock');
  assert.match(read('src/scenes/hunting.js'), /if \(searched && outcome\?\.beast\) spawnBeast\?\.\(outcome\.beast\);/);
});

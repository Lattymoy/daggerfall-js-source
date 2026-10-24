import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { SURVIVAL_RULES, SURVIVAL_TIER_IDS, SURVIVAL_STORED, SURVIVAL_DEFAULT, rulesForTier, tierOfStored, isStoredTier } from '../../../src/systems/survival/difficulty.js';
import { SURVIVAL_PREF, survivalTier, survivalOn, survivalRules } from '../../../src/systems/survival/switch.js';
import {
  NEED, BOON, BOON_IDS, SAID_BOONS, HEARTH_FATIGUE, WELL_RESTED_PER_SLEEP_MINUTE, WELL_RESTED_MAX_MINUTES, SURVIVAL_TEXT,
  newSurvival, survivalMinute, runSurvivalMinutes, survivalBoons, survivalStatMods, paySleep, pauseSurvival, alignSurvival, boonNotes, drinkWater,
} from '../../../src/systems/survival/needs.js';
import { sunlit } from '../../../src/systems/survival/temperature.js';   // AUDIT C&C R2: the sun the hosts read
import { HUD_BOON_WORDS, STATUS_TEXT, survivalHudChips, survivalStatusLines, temperatureReadout, boonEffect, restedLeft } from '../../../src/systems/survival/status.js';
import { restCost } from '../../../src/systems/survival/rest.js';
import { survivalFeed, survivalGateOn } from '../../../src/systems/survival/env.js';
import { TEMPLATE, eatLaw } from '../../../src/systems/survival/food.js';
import { createSurvivalItem } from '../../../src/systems/survival/items.js';
import { tavernOrder, TAVERN_MENU_TEXT } from '../../../src/systems/survival/tavernMenu.js';
import { sleepShortRest, NIGHT_MINUTES } from '../../../src/systems/rest/restAct.js';
import { statusTiles, needGlyph, STATUS_GLYPHS } from '../../../src/ui/hud/hudStatus.js';
import { boonStatRows } from '../../../src/ui/temperatureCard.js';
import { liveStat, maxFatigue } from '../../../src/systems/statMods.js';
import { snapshotPlayer, restorePlayer } from '../../../src/systems/save/save.js';
import { FEATURES } from '../../../src/systems/features.js';
import { TUTORIALS } from '../../../src/systems/tutorialCatalogue.js';
import { onlineForcedPref } from '../../../src/systems/online/onlineLane.js';
import { setPref, _resetForTests } from '../../../src/systems/uiPrefs.js';
import { CLIMATES } from '../../../src/formats/mapsFile.js';
import { RACES } from '../../../src/systems/races.js';

// ═══ SURV-BOONS (2026-10-12): THE FOURTH TIER ═════════════════════════
//
// The owner: "I want to force a new version of Climates and Calories, but a
// completely different version. Instead of punishing players for not
// tending, we instead provides boons to those who unkeep. Much like
// [Valheim]. Players would still be able to switch between CAC versions."
//
// Boons is a tier on the one key (survival/difficulty.js), between Off and
// Casual. These pins hold its rules: the same world; NOTHING IS EVER TAKEN
// (no stamina - not even the fatigue above a pool that has just shrunk - no
// attribute, health, condition, disease or roll against the player; the
// house's two refusals stay, because they guard the coin); A BODY KEPT
// EARNS (Well fed, Quenched, Well rested - banked only by a bed or a fire
// and earned only while the sleep debt is paid - Thriving for all three,
// and the hearth's stamina in a minute lived awake by a fire); and NO RED
// on the strip but the drink's, because nothing else costs. The numbers are
// pinned as LITERALS (A PIN MUST FAIL - AUDIT SURV-BOONS D3: a pin that
// reads the law's own constant back survives that constant's mutation).
//
// AUDIT SURV-BOONS (the same day, the owner: "I want to ensure it's
// perfection and highly detailed ... Audit everything we have also"): five
// cold lenses - the law, the consumers, what the player sees, the records
// and pins, the temperature - and every finding reproduced before it was
// fixed; the pins from "THE OVER-CEILING POOL" on are theirs.

const read = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const BOONS = SURVIVAL_RULES.boons;
const CASUAL = SURVIVAL_RULES.casual;
const HARD = SURVIVAL_RULES.hard;
const STATS = Object.freeze({ strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 });
/** A player whose pool is (50 + 50) x 64 = 6400 fatigue units. */
const body = (extra = {}) => ({ stats: { ...STATS }, raceId: RACES.Breton, items: [], activeEffects: [], health: 40, maxHealth: 40, fatigue: 6400, ...extra });
/** Sinks as a host's (scenes/shared.js createPlayerTicker): a drain floors at nought, a refill stops at the live pool. */
const sinksFor = (e, log = []) => ({
  drainFatigue: (n) => { log.push(['fatigue', n]); e.fatigue = Math.max(0, e.fatigue - n); },
  restoreFatigue: (n) => { log.push(['restore', n]); e.fatigue = Math.min(maxFatigue(e), e.fatigue + n); },
  hurt: (n) => { log.push(['hurt', n]); e.health = Math.max(0, e.health - n); },
  say: (t) => log.push(['say', t]),
});
const deps = (e, log, rules, extra = {}) => ({ sinks: sinksFor(e, log), autoDrink: false, autoEat: false, rules, rolls: () => 0.01, ctx: { raceId: RACES.Breton }, ...extra });
/** Indoors in the woods in midsummer: a naked Breton feels a comfortable 5. */
const INDOORS = Object.freeze({ climateIndex: CLIMATES.Woodlands, month: 6, hour: 12, weather: 'sunny', insideBuilding: true });
const BLIZZARD = Object.freeze({ climateIndex: CLIMATES.Mountain, month: 0, hour: 2, weather: 'snow' });
const DESERT_NOON = Object.freeze({ climateIndex: CLIMATES.Desert2, month: 6, hour: 12, weather: 'sunny', inSunlight: true });
const BED = Object.freeze({ ...INDOORS, resting: true, sleeping: 'bed' });
const entry = (e) => e.activeEffects.find((a) => a?.kind === 'survival')?.statMods ?? {};
const said = (log) => log.filter((l) => l[0] === 'say').map((l) => l[1]);
const drains = (log) => log.filter((l) => l[0] === 'fatigue' || l[0] === 'hurt');
const run = (e, from, to, env, rules, log = []) => { for (let m = from; m <= to; m++) survivalMinute(e, m, env, deps(e, log, rules)); return log; };
/** A night in a bed (a fresh record pays no debt: it banks), then breakfast and a drink - eaten and drunk through the real
 *  laws (the food's eatLaw, the minute law's own drink) - so the sleeper wakes fed, watered and well rested at 480. */
const restedBody = (extra = {}) => {
  const e = body({ survival: newSurvival(0), ...extra });
  run(e, 1, 480, BED, BOONS);
  const meal = eatLaw(createSurvivalItem(TEMPLATE.CookedFish), { lastAte: e.survival.lastAte, now: 480, rules: BOONS });
  e.survival.lastAte = meal.lastAte;
  e.items.push(createSurvivalItem(TEMPLATE.Waterskin, { water: 2 }));
  while (e.survival.thirst >= NEED.THIRSTY) assert.ok(drinkWater(e, 480), 'a drink from the skin');
  survivalMinute(e, 480, INDOORS, deps(e, [], BOONS));
  return e;
};
const plate = () => ({ templateIndex: 104, group: 'Armor', material: 0x0200, maxCondition: 100, currentCondition: 100, name: 'Plate Cuirass' });

afterEach(() => { _resetForTests(); });

test('SURV-BOONS: the fourth tier - on the one key, stored by name between Off and Casual; the switch reads it, the shelf keeps it, the feed hands its rules, the gate stays down, and it is the player\'s online; the default since BOONS-DEFAULT; and the table is the four rules, written out to the value', () => {
  assert.deepEqual([...SURVIVAL_TIER_IDS], ['off', 'boons', 'casual', 'hard']);
  assert.equal(SURVIVAL_STORED.boons, 'boons');
  assert.equal(isStoredTier('boons'), true); assert.equal(tierOfStored('boons'), 'boons'); assert.equal(rulesForTier('boons'), BOONS);
  assert.equal(SURVIVAL_DEFAULT, 'boons', 'BOONS-DEFAULT (2026-10-13, Mac: "make boons the default")');   // PIN MOVED: SURV-BOONS had it a choice, not the default
  const row = FEATURES.find((f) => f.id === 'mod-climates-calories');
  assert.deepEqual(row.control.tiers[1], ['boons', 'Boons'], 'the bar\'s second segment');
  assert.match(row.note, /On Boons neglect costs nothing, and staying fed, watered and rested in a bed or by a fire gives bonuses/);
  setPref(SURVIVAL_PREF, 'boons');
  assert.equal(survivalTier(), 'boons'); assert.equal(survivalOn(), true); assert.equal(survivalRules(), BOONS);
  assert.equal(survivalFeed(body(), INDOORS).deps.rules, BOONS, 'the feed hands the minute law the Boons rules');
  assert.equal(survivalGateOn(), false, 'nothing refuses a Boons sleep');
  assert.equal(onlineForcedPref(SURVIVAL_PREF, '?online=1'), undefined, 'the room forces no tier');
  // AUDIT SURV-BOONS D2: THE TABLE, TO THE VALUE - the shape pin compared field NAMES, so a Boons that wasted a meal
  // (wastedMeal true), floored a rough night at tired or lent and charged at rest still passed
  assert.deepEqual(BOONS, {
    id: 'boons',
    stamina: { floor: 1, hotFrom: 51, coldFrom: -31, bareFeet: false, duringRest: false, repaid: true, fireWarms: true },
    attributes: false, health: false, rust: false, sickness: false,
    roughRest: { recovery: 1, encounters: 1, stiffHours: 0 }, roughSleepFloor: null,
    restGate: false, blackout: false, wastedMeal: false, boons: true,
  });
  assert.equal(CASUAL.boons, false); assert.equal(HARD.boons, false);
});

test('SURV-BOONS: NOTHING IS EVER TAKEN - the worst day (starving, dehydrated, exhausted, soaked, half naked, barefoot in a blizzard in wet plate) takes no stamina, no health, no attribute and no condition; nor anything over every climate, in January and July, at two in the morning and two in the afternoon, sunny, raining, snowing and in a storm; the rough rest is DFU\'s, the meal rolls nothing, and the house\'s two refusals stand - they guard the coin', () => {
  const armour = plate();
  const worn = []; worn[18] = armour;
  const e = body({ survival: { ...newSurvival(0), lastAte: -5000, thirst: 140, sleepDebt: 20, wet: 250 } });
  const log = run(e, 1, 600, BLIZZARD, BOONS, []);
  for (let m = 601; m <= 1200; m++) survivalMinute(e, m, BLIZZARD, deps(e, log, BOONS, { worn }));
  assert.deepEqual(drains(log), [], 'no drain and no wound');
  assert.equal(e.fatigue, 6400); assert.equal(e.health, 40);
  assert.equal(armour.currentCondition, 100, 'no rust, on a 1% roll a minute');
  assert.deepEqual(entry(e), {}, 'no attribute taken - and none earned: every need is unmet');
  assert.deepEqual(e.survival.boons, []);
  assert.equal('borrowed' in e.survival, false, 'nothing lent');
  let minutes = 0, sunned = 0;
  // AUDIT C&C R2: and under the sun the hosts read (temperature.js sunlit) - the sweep stood every body in the shade, so
  // the sun on bare skin's wound could lose its tier's gate under it; and Casual, which wounds nothing either, beside it
  for (const climateIndex of Object.values(CLIMATES)) for (const month of [0, 6]) for (const hour of [2, 14]) for (const weather of ['sunny', 'rain', 'snow', 'thunder']) {
    const env = { climateIndex, month, hour, weather, inSunlight: sunlit({ hour, weather }) };
    const b = body({ survival: { ...newSurvival(0), lastAte: -5000, thirst: 140, sleepDebt: 20, wet: 250 } });
    const l = run(b, 1, 30, env, BOONS, []);
    minutes += 30;
    if (env.inSunlight) sunned++;
    assert.deepEqual(drains(l), [], `${climateIndex}/${month}/${hour}/${weather}`);
    const c = body({ survival: { ...newSurvival(0), lastAte: -5000, thirst: 140, sleepDebt: 20, wet: 250 } });
    assert.deepEqual(run(c, 1, 30, env, CASUAL, []).filter((x) => x[0] === 'hurt'), [], `casual wounds nothing: ${climateIndex}/${month}/${hour}/${weather}`);
  }
  assert.equal(minutes, Object.values(CLIMATES).length * 16 * 30);
  assert.equal(sunned, Object.values(CLIMATES).length * 2, 'the sunny afternoons stood in the sun');
  assert.deepEqual(restCost('rough', BOONS), { recovery: 1, encounters: 1, stiffHours: 0 }, 'the rest window is DFU\'s whole hour, one ask, no morning');
  const raw = createSurvivalItem(TEMPLATE.RawFish);
  assert.equal(eatLaw(raw, { lastAte: 0, now: 5000, luck: 10, rolls: () => 0.99, rules: BOONS }).sick, null, 'no sickness roll');
  assert.deepEqual(tavernOrder({ ...newSurvival(0), drunk: 45 }, 0, { kind: 'drink', strength: 35, price: 1 }, { endurance: 50, rules: BOONS }), { ok: false, text: TAVERN_MENU_TEXT.cutOff }, 'the barkeep stops pouring before a blackout');
  const meal = { kind: 'food', worth: 200, price: 5 };
  // PIN MOVED (AUDIT C&C I3): the hunger at the meal's end, its half hour passed first - 170 now is 200 then
  assert.deepEqual(tavernOrder({ ...newSurvival(0), lastAte: 1000 - 169 }, 1000, meal, { rules: BOONS }), { ok: false, text: TAVERN_MENU_TEXT.fullForMeal }, 'AUDIT SURV-BOONS D2: the kitchen will not waste a meal - and so takes no coin for one');
  assert.deepEqual(tavernOrder({ ...newSurvival(0), lastAte: 1000 - 170 }, 1000, meal, { rules: BOONS }), { ok: true }, 'a meal\'s worth of hunger buys it');
});

test('SURV-BOONS: THE OVER-CEILING POOL (AUDIT SURV-BOONS D1/A4) - Well fed fills a pool that Peckish then shrinks, and a Fortify ends under a full one: the fatigue above the new ceiling is never drained by a need', () => {
  const e = body({ survival: { ...newSurvival(0), lastAte: 1 - 200 } });
  run(e, 1, 2, DESERT_NOON, BOONS);
  e.fatigue = maxFatigue(e);
  assert.equal(e.fatigue, 7040, 'Well fed\'s strength and endurance: a pool of (55 + 55) x 64');
  const log = run(e, 3, 120, DESERT_NOON, BOONS, []);
  assert.equal(maxFatigue(e), 6400, 'Peckish: the pool back to its own');
  assert.deepEqual(log.filter((l) => l[0] === 'fatigue'), [], 'and nothing drained from above it, scorching and parched as it is');
  const f = body({ survival: { ...newSurvival(0), lastAte: -300, thirst: 90 }, activeEffects: [{ kind: 'fortifyAttribute', stat: 'endurance', magnitude: 30 }] });
  f.fatigue = maxFatigue(f); f.activeEffects.length = 0;
  assert.deepEqual(run(f, 1, 60, BLIZZARD, BOONS, []).filter((l) => l[0] === 'fatigue'), [], 'a Fortify\'s end: the same');
});

test('SURV-BOONS: Well fed and Quenched - earned while the hunger and the thirst stand at their first stage, the entry carrying their points, and lapsing the minute Peckish and Thirsty arrive (both edges of both); a better meal is a longer Well fed', () => {
  const e = body({ survival: newSurvival(0) });
  survivalMinute(e, 1, INDOORS, deps(e, [], BOONS));
  assert.deepEqual(e.survival.boons, ['fed', 'quenched']);
  assert.deepEqual(entry(e), { strength: 5, endurance: 5, agility: 5, speed: 5 });
  assert.deepEqual(BOON, { fed: { strength: 5, endurance: 5 }, quenched: { agility: 5, speed: 5 }, rested: { intelligence: 5, willpower: 5 }, thriving: { luck: 5 } });
  assert.equal(liveStat(e, 'strength'), 55); assert.equal(liveStat(e, 'speed'), 55);
  assert.equal(maxFatigue(e), 7040, 'Well fed\'s strength and endurance are a bigger pool - Valheim\'s food');
  const at = (m, s) => { Object.assign(e.survival, s); survivalMinute(e, m, INDOORS, deps(e, [], BOONS)); return e.survival.boons; };
  assert.ok(at(3, { lastAte: 3 - (NEED.PECKISH_AT - 1) }).includes('fed'), 'a minute short of Peckish is fed');
  assert.equal(at(4, { lastAte: 4 - NEED.PECKISH_AT }).includes('fed'), false, 'Peckish ends Well fed');
  assert.ok(at(5, { lastAte: 5, thirst: NEED.THIRSTY - 1 }).includes('quenched'), 'a sip under Thirsty is quenched');
  assert.equal(at(6, { thirst: NEED.THIRSTY }).includes('quenched'), false, 'Thirsty ends Quenched');
  assert.deepEqual(entry(e), { strength: 5, endurance: 5 });
  const fed = (t) => eatLaw(createSurvivalItem(t), { lastAte: 0, now: 1000, rules: BOONS }).lastAte;
  assert.equal(fed(TEMPLATE.CookedFish) - fed(TEMPLATE.RawFish), 110, 'cooked fish banks 110 minutes more Well fed than raw (200 against 90)');
});

test('SURV-BOONS: Well rested - banked an hour and a half an hour asleep in a bed or by a fire (the minute law\'s night and REST-SLEEP1\'s short rest alike), to twelve hours; never by a rough rest or another tier; earned only while the sleep debt is paid (AUDIT SURV-BOONS A1); spent a waking minute at a time - a loiter is one - and gone when spent', () => {
  for (const kind of ['bed', 'camp']) {
    const s = newSurvival(0);
    paySleep(s, kind, 60, 60, BOONS);
    assert.equal(s.wellRested, 90, `${kind}: an hour asleep banks an hour and a half`);
    paySleep(s, kind, 24 * 60, 2000, BOONS);
    assert.equal(s.wellRested, 720, `${kind}: the bank's ceiling, twelve hours`);
  }
  assert.deepEqual([WELL_RESTED_PER_SLEEP_MINUTE, WELL_RESTED_MAX_MINUTES], [1.5, 720]);
  const rough = newSurvival(0); paySleep(rough, 'rough', 480, 480, BOONS);
  assert.equal('wellRested' in rough, false, 'a rough rest banks nothing');
  for (const rules of [CASUAL, HARD]) { const s = newSurvival(0); paySleep(s, 'bed', 480, 480, rules); assert.equal('wellRested' in s, false, `${rules.id} banks nothing`); }
  const sr = body({ survival: newSurvival(0) });
  assert.equal(sleepShortRest(sr, 'camp', BOONS, 9000), true);
  assert.equal(sr.survival.wellRested, 720, `the short rest's ${NIGHT_MINUTES} minutes bank the full twelve hours`);
  const e = body({ survival: newSurvival(0) });
  run(e, 1, 480, BED, BOONS);
  assert.equal(e.survival.wellRested, 720, 'eight hours in a bed: the full twelve');
  assert.ok(e.survival.boons.includes('rested'));
  assert.deepEqual([entry(e).intelligence, entry(e).willpower], [5, 5]);
  run(e, 481, 490, INDOORS, BOONS);
  assert.equal(e.survival.wellRested, 710, 'spent a waking minute at a time');
  run(e, 491, 495, { ...INDOORS, byFire: true, resting: true, sleeping: null }, BOONS);
  assert.equal(e.survival.wellRested, 705, 'a loiter is waking minutes: the bank is spent (AUDIT SURV-BOONS D6)');
  e.survival.wellRested = 1;
  run(e, 496, 496, INDOORS, BOONS);
  assert.equal('wellRested' in e.survival, false, 'spent, and gone from the record');
  assert.equal(e.survival.boons.includes('rested'), false);
  // A1: a short night from Exhausted banks, and earns nothing until the debt is paid
  const x = body({ survival: { ...newSurvival(0), sleepDebt: 22 } });
  run(x, 1, 240, BED, BOONS);
  run(x, 241, 241, INDOORS, BOONS);
  assert.ok(x.survival.wellRested > 0 && x.survival.sleepDebt >= NEED.SLEEP_EXHAUSTED, 'banked, still exhausted');
  assert.equal(x.survival.boons.includes('rested'), false, 'no Well rested beside an Exhausted chip');
  assert.equal(x.survival.boons.includes('thriving'), false, 'and so no Thriving');
  assert.ok(survivalBoons({ ...newSurvival(0), wellRested: 30, sleepDebt: NEED.SLEEP_TIRED - 0.01 }, 0).includes('rested'), 'a debt under Tired is rest paid');
  assert.equal(survivalBoons({ ...newSurvival(0), wellRested: 30, sleepDebt: NEED.SLEEP_TIRED }, 0).includes('rested'), false, 'at Tired it is not');
  assert.equal(survivalBoons({ ...newSurvival(0), wellRested: 0 }, 0).includes('rested'), false, 'an empty bank is none');
});

test('SURV-BOONS: Thriving - fed, quenched and rested at once earn luck too, and any one lapsing takes it', () => {
  const e = restedBody();
  run(e, 481, 481, INDOORS, BOONS);
  assert.deepEqual(e.survival.boons, ['fed', 'quenched', 'rested', 'thriving']);
  assert.deepEqual(entry(e), { strength: 5, intelligence: 5, willpower: 5, agility: 5, endurance: 5, speed: 5, luck: 5 });
  assert.equal(liveStat(e, 'luck'), 55);
  e.survival.thirst = NEED.THIRSTY;
  run(e, 482, 482, INDOORS, BOONS);
  assert.deepEqual(e.survival.boons, ['fed', 'rested']);
  assert.equal(liveStat(e, 'luck'), 50, 'the luck goes with the third');
  assert.deepEqual(survivalBoons({ ...newSurvival(0), wellRested: 5 }, 0), ['fed', 'quenched', 'rested', 'thriving'], 'the pure read agrees');
  assert.deepEqual(survivalBoons({ ...newSurvival(0), wellRested: 5, thirst: NEED.THIRSTY }, 0), ['fed', 'rested'], 'two of three is no Thriving');
});

test('SURV-BOONS: the hearth - a minute lived awake beside a lit fire gives a point of stamina back, up to the pool, in silence (its tile says it - AUDIT SURV-BOONS C4); a rest by the fire, a loiter, a minute away from it, a jump\'s replayed minutes (A3) and Casual or Hard give nothing', () => {
  assert.equal(HEARTH_FATIGUE, 64);
  const e = body({ fatigue: 1000, survival: newSurvival(0) });
  const log = run(e, 1, 10, { ...INDOORS, byFire: true }, BOONS, []);
  assert.equal(e.fatigue, 1640);
  assert.ok(e.survival.boons.includes('hearth'));
  assert.deepEqual(said(log).filter((t) => /fire|warmth restores/i.test(t)), [], 'no line for the fire');
  assert.deepEqual(said(log).filter((t) => SAID_BOONS.some((id) => t === SURVIVAL_TEXT.boon[id])), ['You feel well fed.', 'Your thirst is quenched.']);
  const full = body({ survival: { ...newSurvival(0), lastAte: -NEED.PECKISH_AT, thirst: NEED.THIRSTY } });   // no attribute boon to grow the pool under it
  full.fatigue = maxFatigue(full) - 10;
  assert.deepEqual(run(full, 1, 3, { ...INDOORS, byFire: true }, BOONS, []).filter((x) => x[0] === 'restore'), [['restore', 10]], 'never past the pool');
  assert.equal(full.fatigue, 6400);
  for (const [why, env] of [['resting by it (the camp\'s own whole rest)', { ...INDOORS, byFire: true, resting: true, sleeping: 'camp' }], ['loitering by it', { ...INDOORS, byFire: true, resting: true, sleeping: null }], ['away from it', INDOORS]]) {
    const b = body({ fatigue: 1000, survival: newSurvival(0) });
    assert.deepEqual(run(b, 1, 10, env, BOONS, []).filter((x) => x[0] === 'restore'), [], why);
    assert.equal(b.survival.boons.includes('hearth'), false, why);
  }
  // A3: a jump by a fire (training, a wait) pays its landing minute alone - three hours' training cost nothing before
  const jump = (byFire) => { const j = body({ fatigue: 1000, survival: newSurvival(0) }); runSurvivalMinutes(j, 0, 180, { ...INDOORS, byFire }, deps(j, [], BOONS)); return j.fatigue; };
  assert.equal(jump(true) - jump(false), 64, 'the minute stood in, alone (the fed hour\'s own refund is the world\'s, beside the fire or not)');
  for (const rules of [CASUAL, HARD]) {
    const c = body({ fatigue: 1000, survival: newSurvival(0) });
    assert.deepEqual(run(c, 1, 10, { ...INDOORS, byFire: true }, rules, []).filter((x) => x[0] === 'restore'), [], `${rules.id}: no hearth`);
  }
});

test('SURV-BOONS: a vampire has no need for food, drink or sleep, so earns none of their boons - the hearth is anyone\'s', () => {
  const e = body({ survival: newSurvival(0) });
  survivalMinute(e, 1, { ...INDOORS, byFire: true }, deps(e, [], BOONS, { ctx: { raceId: RACES.Breton, vampire: true } }));
  assert.deepEqual(e.survival.boons, ['hearth']);
  assert.deepEqual(entry(e), {});
  assert.deepEqual(survivalBoons({ ...newSurvival(0), wellRested: 100 }, 0, { vampire: true }), []);
  assert.deepEqual(survivalStatusLines(e, 1, { vampire: true }).slice(-1), ['The fire\'s warmth restores your stamina.'], 'and the page says the hearth (AUDIT SURV-BOONS C12)');
});

test('SURV-BOONS: only Boons rewards - Casual and Hard earn nothing and keep no bank; turning from Boons takes the bank, the grant and the points at the next minute, a bank with no grant too, and Off takes them as it pauses (A9); a boon that lapses is said again when it comes back (D5), and a return to Boons says them again', () => {
  for (const rules of [CASUAL, HARD]) {
    const e = body({ survival: newSurvival(0) });
    run(e, 1, 480, BED, rules);
    run(e, 481, 482, INDOORS, rules);
    assert.equal('boons' in e.survival, false, `${rules.id}: no boons on the record`);
    assert.equal('wellRested' in e.survival, false, `${rules.id}: no bank`);
    assert.ok(Object.values(entry(e)).every((n) => n <= 0), `${rules.id}: no points earned (Hard's own costs aside)`);
    assert.deepEqual(survivalStatMods({ ...newSurvival(0), boons: ['fed', 'thriving'] }, null, 0, { rules }), {}, `${rules.id}: a stale grant pays nothing`);
  }
  const log = [];
  const e = restedBody();
  run(e, 481, 481, INDOORS, BOONS, log);
  assert.ok(e.survival.boons.length && e.survival.wellRested > 0 && Object.keys(entry(e)).length);
  run(e, 482, 482, INDOORS, CASUAL);
  assert.equal('boons' in e.survival, false); assert.equal('wellRested' in e.survival, false);
  assert.deepEqual(entry(e), {}, 'the points go with the tier');
  const back = run(e, 483, 483, INDOORS, BOONS, []);
  assert.deepEqual(said(back), ['You feel well fed.', 'Your thirst is quenched.'], 'earned again, said again - and no Thriving: Well rested\'s bank went with the tier');
  // D5: a lapse inside Boons, and the boon back
  const lap = run(e, 484, 490, INDOORS, BOONS, []);
  assert.deepEqual(said(lap), [], 'said once while it lasts');
  e.survival.thirst = NEED.THIRSTY; run(e, 491, 491, INDOORS, BOONS);
  e.survival.thirst = 0;
  assert.deepEqual(said(run(e, 492, 492, INDOORS, BOONS, [])), ['Your thirst is quenched.'], 'lapsed, and back: said again');
  // a bank with no grant yet turning to Casual (the clause on `wellRested` alone)
  const b = body({ survival: { ...newSurvival(0), wellRested: 300 } });
  run(b, 1, 1, INDOORS, CASUAL);
  assert.equal('wellRested' in b.survival, false);
  // A9: Off
  const o = restedBody();
  run(o, 481, 481, INDOORS, BOONS);
  assert.equal(pauseSurvival(o, 481, 600), true);
  assert.deepEqual(['boons' in o.survival, 'wellRested' in o.survival], [false, false], 'Off carries neither');
});

test('SURV-BOONS: a loan Casual made is repaid in Boons as its need is met - turning to the tier where nothing is taken had thrown it away (AUDIT SURV-BOONS B2/A2); Boons itself lends nothing', () => {
  const c = body({ survival: { ...newSurvival(0), lastAte: -2000 } });
  run(c, 1, 600, BLIZZARD, CASUAL);
  const loan = { ...c.survival.borrowed };
  assert.ok(loan.hunger > 0 && loan.temp > 0, 'Casual lent the hunger and the cold');
  const atMeal = c.fatigue;
  c.survival.lastAte = 600;
  run(c, 601, 602, INDOORS, BOONS);
  assert.ok(c.fatigue > atMeal + loan.hunger, 'fed and warm in Boons: the hunger\'s and the cold\'s shares back');
  assert.equal('borrowed' in c.survival && (c.survival.borrowed.hunger || c.survival.borrowed.temp), false, 'and owed no more');
  const b = body({ survival: { ...newSurvival(0), lastAte: -5000, thirst: 140 } });
  run(b, 1, 120, BLIZZARD, BOONS);
  assert.equal('borrowed' in b.survival, false, 'Boons lends nothing');
});

test('SURV-BOONS: a jump says what the minute it lands in has - boons gained and lost inside it are not said (AUDIT SURV-BOONS C1/A5); a night kept to the landing says each once', () => {
  const e = body({ survival: { ...newSurvival(0), lastAte: -200, thirst: 30 } });
  const log = [];
  runSurvivalMinutes(e, 0, 900, INDOORS, deps(e, log, BOONS));
  assert.deepEqual(e.survival.boons, []);
  assert.equal(said(log).some((t) => SAID_BOONS.some((id) => t === SURVIVAL_TEXT.boon[id])), false, 'no boon the body no longer has is announced');
  const n = body({ survival: newSurvival(0) });
  const nl = [];
  runSurvivalMinutes(n, 0, 120, BED, deps(n, nl, BOONS));
  assert.deepEqual(said(nl).filter((t) => t.startsWith('You feel') || t.startsWith('Your thirst') || t.startsWith('You are in')), ['You feel well fed.', 'Your thirst is quenched.', 'You feel well rested.', 'You are in fine form.']);
  assert.deepEqual(SURVIVAL_TEXT.boon, { fed: 'You feel well fed.', quenched: 'Your thirst is quenched.', rested: 'You feel well rested.', thriving: 'You are in fine form.' });
});

test('SURV-BOONS: a load says nothing new (AUDIT SURV-BOONS C3) - the save drops the notes but the boons it carries are said already; a fresh start (WORLD5) keeps them said', () => {
  const player = () => ({ isPlayer: true, level: 3, health: 30, maxHealth: 40, magicka: 10, maxMagicka: 20, fatigue: 20 * 64, raceId: RACES.Breton, stats: { ...STATS }, skills: 20, career: {}, skillUses: [], activeEffects: [], items: [], equip: { slots: new Array(27).fill(null) } });
  const e = player();
  e.survival = newSurvival(0);
  run(e, 1, 480, BED, BOONS);
  e.survival.lastAte = 480; e.survival.thirst = 0;
  run(e, 481, 481, INDOORS, BOONS);
  assert.deepEqual(e.survival.boons, ['fed', 'quenched', 'rested', 'thriving']);
  const back = player();
  restorePlayer(back, JSON.parse(JSON.stringify(snapshotPlayer(e, { classicMinutes: 481 }))));
  assert.deepEqual(back.survival.notes, { 'boon:fed': 'on', 'boon:quenched': 'on', 'boon:rested': 'on', 'boon:thriving': 'on' });
  assert.deepEqual(said(run(back, 482, 484, INDOORS, BOONS, [])), [], 'the first minutes after the load say no boon again');
  assert.deepEqual(boonNotes({ boons: ['fed', 'hearth', 'nonsense'] }), { 'boon:fed': 'on' }, 'only the boons a line is said for');
  assert.equal(alignSurvival(back, 100000, null), true);
  assert.deepEqual(back.survival.notes, { 'boon:fed': 'on', 'boon:quenched': 'on', 'boon:rested': 'on', 'boon:thriving': 'on' }, 'the fresh start keeps them said');
});

test('SURV-BOONS: the strip and the page - the boons are green tiles on their own glyphs (a flame for the hearth, apart from REST1\'s campfire - C7; a sparkle for Thriving), Well rested alone footed with its whole hours; the drink before the boons (C6) and the only red; the page says each in words read off BOON, the attributes as the sheet names them, the hours singular at one (C10, C11); "not tired" with no bank (C5); and the live tier read where it is handed in (C14)', () => {
  const e = restedBody();
  run(e, 481, 481, { ...INDOORS, byFire: true }, BOONS);
  e.survival.drunk = 45;
  const chips = survivalHudChips(e, 481, { endurance: 50 });
  assert.deepEqual(chips.map((c) => `${c.key}:${c.text}:${c.level}:${c.foot ?? ''}`), [
    'drunk:Very drunk:danger:', 'boon:fed:Well fed:boon:', 'boon:quenched:Quenched:boon:', 'boon:rested:Well rested:boon:12h', 'boon:thriving:Thriving:boon:', 'boon:hearth:Hearth:boon:',
  ]);
  assert.deepEqual(chips.filter((c) => c.level === 'boon').map((c) => needGlyph(c)), ['hunger', 'thirst', 'sleep', 'thriving', 'hearth']);
  for (const c of chips) if (c.glyph) assert.ok(Object.hasOwn(STATUS_GLYPHS, c.glyph), `${c.text} draws`);
  const tiles = statusTiles({ needs: chips });
  assert.deepEqual(tiles.map((t) => t.kind), ['danger', 'buff', 'buff', 'buff', 'buff', 'buff']);
  assert.equal(tiles.find((t) => t.key === 'need:boon:rested').foot, '12h');
  assert.deepEqual(Object.keys(HUD_BOON_WORDS), [...BOON_IDS]);
  // the hours, whole, rounded up, singular at one
  for (const [bank, foot, left] of [[720, '12h', '12 hours'], [61, '2h', '2 hours'], [60, '1h', '1 hour'], [1, '1h', '1 hour']]) {
    const s = { ...newSurvival(0), boons: ['rested'], wellRested: bank };
    assert.equal(survivalHudChips({ survival: s }, 0).find((c) => c.key === 'boon:rested').foot, foot, `${bank} minutes`);
    assert.equal(restedLeft(s), left);
    assert.equal(STATUS_TEXT.boon('rested', s), 'Well rested: +5 Intelligence, +5 Willpower.');   // PIN MOVED (AUDIT C&C, lens S): the bank's hours a line of their own
    assert.equal(STATUS_TEXT.restedFor(s), `Rested for another ${left}.`);
  }
  // NO RED but the drink
  const worst = body({ survival: { ...newSurvival(0), lastAte: -5000, thirst: 140, sleepDebt: 20, wet: 250, drunk: 60 } });
  survivalMinute(worst, 1, BLIZZARD, deps(worst, [], BOONS));
  assert.deepEqual(survivalHudChips(worst, 1).filter((c) => c.level === 'danger').map((c) => c.key), ['drunk'], 'only the drink, chosen at a bar, is red');
  const hard = body({ survival: { ...newSurvival(0), lastAte: -5000, thirst: 140, sleepDebt: 20, wet: 250, drunk: 60 } });
  survivalMinute(hard, 1, BLIZZARD, deps(hard, [], HARD));
  assert.deepEqual(survivalHudChips(hard, 1, { rules: HARD }).filter((c) => c.level === 'danger').map((c) => c.key), ['hunger', 'thirst', 'sleep', 'temp', 'drunk'], 'Hard keeps its red');   // PIN MOVED (AUDIT C&C S5, D2): the tier handed in, and Drenched amber in every tier - its cost is the temperature's
  // C14: the live tier, handed in, beats the record's last minute both ways
  assert.equal(survivalHudChips(worst, 1, { rules: HARD }).filter((c) => c.level === 'danger').length, 5, 'turned to Hard: red at once');   // PIN MOVED (AUDIT C&C S5): the rules handed in; no red Drenched
  assert.equal(survivalHudChips(hard, 1, { rules: BOONS }).filter((c) => c.level === 'danger').map((c) => c.key).join(), 'drunk', 'turned to Boons: no red at once');
  assert.equal(survivalHudChips(e, 481, { rules: CASUAL }).some((c) => c.level === 'boon'), false, 'and no green');
  assert.equal(temperatureReadout(worst, undefined, { rules: HARD }).level, 'danger');
  // the page, in words
  assert.deepEqual(survivalStatusLines(e, 481, { endurance: 50 }).slice(-7), [
    'You are very drunk.',
    'Well fed: +5 Strength, +5 Endurance.',
    'Quenched: +5 Agility, +5 Speed.',
    'Well rested: +5 Intelligence, +5 Willpower.',
    'Rested for another 12 hours.',   // PIN MOVED (AUDIT C&C, lens S): the classic box wraps nothing - the bank's hours a line of their own
    'Thriving: +5 Luck.',
    'The fire\'s warmth restores your stamina.',
  ]);
  assert.ok(survivalStatusLines(e, 481, { endurance: 50 }).every((l) => /^[\x20-\x7e]*$/.test(l)), 'plain characters - the classic faces draw this box');
  assert.equal(boonEffect('hearth'), 'regain stamina beside a lit fire');
  assert.equal(survivalStatusLines(hard, 1).some((l) => /^(Well|Quenched|Thriving)/.test(l)), false);
  const unbanked = { survival: { ...newSurvival(0), boons: ['fed', 'quenched'] } };
  assert.ok(survivalStatusLines(unbanked, 0).includes(STATUS_TEXT.notTired), 'Boons with no bank: not tired - "well rested" is the boon\'s word');
  assert.equal(STATUS_TEXT.notTired, 'You are not tired.');
  assert.ok(survivalStatusLines({ survival: newSurvival(0) }, 0).includes('You are well rested.'), 'Casual keeps its word');
  // a lit fire answers the cold in Boons too (`fireWarms`, Casual's): the body is warm, and the page says the fire
  const camper = body({ survival: newSurvival(0) });
  survivalMinute(camper, 1, { ...BLIZZARD, byFire: true }, deps(camper, [], BOONS));
  assert.equal(camper.survival.warmed, true);
  assert.ok(survivalStatusLines(camper, 1).includes(STATUS_TEXT.warmedByFire), 'by the fire in a blizzard: "The fire keeps the cold at bay."');
});

test('SURV-BOONS: the sheet explains the points - the Stats side\'s Boons rows in Boons alone (AUDIT SURV-BOONS C13); the first-need tutorial waits for a need, not a boon, and its page and the credits name the tier (C2, C9)', () => {
  const e = restedBody();
  run(e, 481, 481, INDOORS, BOONS);
  setPref(SURVIVAL_PREF, 'boons');
  assert.deepEqual(boonStatRows(e), [
    ['Well fed', '+5 Strength, +5 Endurance'], ['Quenched', '+5 Agility, +5 Speed'], ['Well rested', '+5 Intelligence, +5 Willpower (12 hours left)'], ['Thriving', '+5 Luck'],
  ]);
  setPref(SURVIVAL_PREF, 'casual');
  assert.deepEqual(boonStatRows(e), [], 'another tier: none');
  assert.match(read('src/ui/statsCard.js'), /const boonRows = boonStatRows\(entity\);\n {2}if \(boonRows\.length\) \{\n {4}const bn = section\('Boons', 14\);/);
  assert.match(read('src/ui/enhanced/enhancedHud.js'), /if \(needs\.some\(\(c\) => c\.level !== 'boon'\)\) noteFirstUse\('survival'\);/, 'a boon is no felt need');
  const page = TUTORIALS.find((t) => t.id === 'survival');
  assert.deepEqual(page.body, [
    'You need food, water, warmth and sleep. Signs at the left edge of the screen show what you lack, and on Boons what you have earned.',   // PIN MOVED (AUDIT C&C S13): where the tiles stand; VOICE1: plain words
    'Survival can be Off, Boons (the default), Casual or Hard, set under Settings > Features. On Boons, needs that are met give bonuses. On Hard, neglected needs hurt you and can make you ill.',   // PIN MOVED (BOONS-DEFAULT; VOICE1)
  ]);
  assert.match(read('src/ui/credits.js'), /There are four tiers in Settings: Off, Boons \(the default: neglect costs nothing, and staying fed, watered and rested gives bonuses\), Casual/);   // PIN MOVED (AUDIT C&C S8): the drink's swing is taken in Boons too
});

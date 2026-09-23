import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  SURVIVAL_RULES, SURVIVAL_TIER_IDS, SURVIVAL_DEFAULT, SURVIVAL_OFF, SURVIVAL_STORED, HARD_RULES, rulesForTier, tierOfStored, isStoredTier,
} from '../src/systems/survival/difficulty.js';
import { SURVIVAL_PREF, survivalTier, survivalOn, survivalRules } from '../src/systems/survival/switch.js';
import {
  NEED, DRAIN, WELL_FED_MINUTES, HEALTH_FLOOR, newSurvival, survivalOf, survivalMinute, runSurvivalMinutes, survivalStatMods, applySurvivalMods, SURVIVAL_TEXT,
} from '../src/systems/survival/needs.js';
import { temperatureWord, hourTemperature, WEATHER_TEMP } from '../src/systems/survival/temperature.js';
import { HUD_NEED_WORDS, survivalHudChips } from '../src/systems/survival/status.js';
import { REST_COST, REST_TEXT_SURVIVAL, STIFF_HOURS, restCost, restHour, stiffen } from '../src/systems/survival/rest.js';
import { survivalFeed, installSurvivalGate, survivalGateOn } from '../src/systems/survival/env.js';
import { TEMPLATE, FOOD, FOOD_STAGE, eatLaw } from '../src/systems/survival/food.js';
import { createSurvivalItem, useSurvivalItem } from '../src/systems/survival/items.js';
import { huntOutcome, HUNT_EVENTS, HUNT_SAFE_TWIN, HUNT_TEXT } from '../src/systems/survival/hunting.js';
import { tavernMenu, tavernOrder, tavernPour, tavernEat, tavernDrink, TAVERN_MENU_TEXT, DRINK_MINUTES, MEAL_MINUTES } from '../src/systems/survival/tavernMenu.js';
import { intermittentEnemySpawn } from '../src/systems/encounters.js';
import { liveStat } from '../src/systems/statMods.js';
import { useItem } from '../src/systems/useItem.js';
import { NOT_ENOUGH_GOLD_ID } from '../src/systems/tavern.js';
import { TavernWindow } from '../src/ui/tavernWindow.js';
import { mountEnhancedTavern } from '../src/ui/enhancedTavern.js';
import { createHunting } from '../src/scenes/hunting.js';
import { FEATURES, FEATURE_PREF_DEFAULTS } from '../src/systems/features.js';
import { onlineForcedPref, ONLINE_PLAYERS_OWN_PREFS } from '../src/systems/onlineLane.js';
import { setPref, loadPrefs, _resetForTests } from '../src/systems/uiPrefs.js';
import { createRestDeps, createPlayerTicker, restVitals } from '../src/scenes/shared.js';
import { registerPreventRestCondition, getPreventedRestMessage, clearPreventRestConditions } from '../src/systems/restSession.js';
import { setWorldMinutes } from '../src/systems/worldTick.js';
import { SKILLS } from '../src/systems/skills.js';
import { CLIMATES } from '../src/formats/mapsFile.js';
import { EQUIP_SLOTS } from '../src/characters/paperdoll.js';
import { RACES } from '../src/systems/races.js';
import { withDom } from './invdrag.mjs';

// ═══ SURV-TIERS (2026-09-23): OFF, CASUAL, HARD ══════════════════════
//
// Mac: "adding a new tab to climates and calories thats on by default.
// Something that introduces mechanics, leaves some out and is overall
// not a punished experience for players", then "Off, Casual, Hard" and
// "I want this to be a smart and thorough difficulty design. No band
// aids". The survival switch is three tiers on one key, and every law
// that charges the player reads its tier's rules (survival/
// difficulty.js). These pins hold the design, not the numbers alone:
// Hard is the arc as it stood; Casual is the same world with five rules
// on what it costs - stamina only, red stages only, borrowed down to half
// the pool at most and repaid when the need is met, nothing refused,
// nothing rolled against you, nothing wasted. The per-law files (surv1-7,
// auditsurv) still pin Hard, because a law handed no rules runs it.
//
// AUDIT SURV-TIERS (the same day, Mac: "Lets first do a comprehensive
// audit and ensure this is perfect"): four lenses over the slice, every
// finding reproduced before it was fixed - the pins that came of it are
// the loan, the rest in the cold, the kitchen, the enhanced tavern
// DRIVEN, the stored Off, and the tests from "THE LAWS HARD SHARES" on.
// The second pass ("One more audit before we merge") added the tests
// marked "the second pass" and replaced the first pass's Off-gap shift
// with the pause (bible/06-Systems/Climates-Calories.md, AUDIT
// SURV-TIERS, both passes). SURV-OFFSIGHT (Mac: "really only being able
// to see other people's campfires makes sense") added the last.

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');
const S = EQUIP_SLOTS;
const CASUAL = SURVIVAL_RULES.casual;
const HARD = SURVIVAL_RULES.hard;
const STATS = Object.freeze({ strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 });
/** A player whose pool is (50 + 50) x 64 = 6400 fatigue units, so Casual's floor is 3200. */
const body = (extra = {}) => ({ stats: { ...STATS }, raceId: RACES.Breton, items: [], activeEffects: [], health: 40, maxHealth: 40, fatigue: 6400, ...extra });
/** Sinks that write the entity, as a host's do, and log what they were asked. */
const sinksFor = (e, log = []) => ({
  drainFatigue: (n) => { log.push(['fatigue', n]); e.fatigue = Math.max(0, e.fatigue - n); },
  restoreFatigue: (n) => { log.push(['restore', n]); e.fatigue = Math.min(6400, e.fatigue + n); },
  hurt: (n) => { log.push(['hurt', n]); e.health = Math.max(0, e.health - n); },
  say: (t) => log.push(['say', t]),
});
const worn = (map) => { const w = []; for (const [k, v] of Object.entries(map)) w[Number(k)] = v; return w; };
const plate = () => ({ templateIndex: 104, group: 'Armor', material: 0x0200, maxCondition: 100, currentCondition: 100, name: 'Plate Cuirass' });
/** A mountain night in winter, in the snow: felt far past deadly cold for anyone. */
const BLIZZARD = Object.freeze({ climateIndex: CLIMATES.Mountain, month: 0, hour: 2, weather: 'snow' });
/** Indoors in the woods in midsummer: a naked Breton feels exactly 5 - comfortable, no temperature cost in any tier. */
const INDOORS = Object.freeze({ climateIndex: CLIMATES.Woodlands, month: 6, hour: 12, weather: 'sunny', insideBuilding: true });
const drains = (log) => log.filter((l) => l[0] === 'fatigue').reduce((a, l) => a + l[1], 0);
const restores = (log) => log.filter((l) => l[0] === 'restore');
const minuteDeps = (e, log, rules, extra = {}) => ({ sinks: sinksFor(e, log), autoDrink: false, autoEat: false, rules, rolls: () => 0.5, ctx: { raceId: RACES.Breton }, ...extra });
/** mulberry32 - a seeded stream, so both tiers can walk the SAME rolls. */
const seeded = (a) => () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const sleeper = () => ({ isPlayer: true, level: 1, health: 10, maxHealth: 40, magicka: 0, maxMagicka: 20, fatigue: 0, stats: { ...STATS }, skills: 20, career: {}, skillUses: { [SKILLS.Medical]: 0 }, activeEffects: [] });
const TAVERN_NOW = 1440 * 10 + 23 * 60;
const guest = (extra = {}) => ({ name: 'Mac', goldPieces: 100, health: 20, maxHealth: 40, stats: { endurance: 50 }, rentedRooms: [], items: [], activeEffects: [], lastTimePlayerAteOrDrankAtTavern: 0, survival: { ...newSurvival(TAVERN_NOW), drunk: 45 }, ...extra });
const tavernHooks = (passed, now = TAVERN_NOW) => ({
  rows: (id) => [{ text: `r${id}`, center: true }], now: () => now, mapId: () => 1, buildingKey: () => 2, buildingName: () => 'The Lamp',
  quality: () => 10, bedCount: () => 2, freeRooms: () => false, skills: () => ({ mercantile: 50, personality: 50 }),
  heal: () => {}, rolls: () => 0.5, climateIndex: () => 232, advanceMinutes: (n) => passed.push(n), endurance: () => 50,
});
// AUDIT SURV-TIERS (the second pass): these tests set the tier, the world's clock and the rest gate; a failing assert
// used to leave them set for every test after it. Reset after each, whatever happened.
afterEach(() => { _resetForTests(); setWorldMinutes(0); clearPreventRestConditions(); });
/** The first meal on the menu both windows show at TAVERN_NOW (23:00, the tier's list - quality 10). */
const TAVERN_MEAL = tavernMenu({ climateIndex: 232, quality: 10, hour: 23 }).rows.findIndex((r) => r.kind === 'food');

test('SURV-TIERS: one key, three tiers - the row, the table and the shelf agree; Casual is the default and every tier, Off included, is the player\'s online', () => {
  const row = FEATURES.find((f) => f.id === 'mod-climates-calories');
  const c = row.control;
  assert.equal(c.key, SURVIVAL_PREF);
  // AUDIT SURV-TIERS: each segment writes its tier's STORED value (Off the old switch's own false), in the table's order
  assert.deepEqual(c.tiers.map(([v]) => v), SURVIVAL_TIER_IDS.map((t) => SURVIVAL_STORED[t]), 'the bar\'s segments write the table\'s stored values');
  assert.deepEqual(c.tiers.map(([v]) => tierOfStored(v)), [...SURVIVAL_TIER_IDS], '...which read back as the tiers, in order');
  assert.deepEqual(c.tiers.map(([, label]) => label), ['Off', 'Casual', 'Hard']);
  // AUDIT SURV-TIERS: the note is two sentences, as FT15's title asks (FT15 itself counts only characters)
  assert.equal(row.note.split(/(?<=[.!?])\s+(?=[A-Z\u2018\u201c"'(])/).length, 2, `the note is two sentences: ${row.note}`);
  assert.equal(c.tiers[0][0], false, 'Off is stored as the switch always stored it');
  assert.equal(new Set(c.tiers.map(([v]) => String(v))).size, 3, 'the bar matches a stored value by its string - three distinct strings');
  assert.equal(c.initial, SURVIVAL_STORED[SURVIVAL_DEFAULT]); assert.equal(SURVIVAL_DEFAULT, 'casual');
  assert.equal(FEATURE_PREF_DEFAULTS.survival, 'casual', 'the shelf takes its default from the row (RF4)');
  assert.deepEqual(Object.keys(SURVIVAL_RULES), SURVIVAL_TIER_IDS.filter((t) => t !== SURVIVAL_OFF), 'every tier but Off has rules');
  // online: the player's, by name - "still let it be able to be turned off for online"
  assert.equal(c.online, 'player');
  assert.equal(onlineForcedPref(SURVIVAL_PREF, '?online=1'), undefined, 'the room forces no tier');
  assert.ok(ONLINE_PLAYERS_OWN_PREFS.includes(SURVIVAL_PREF));
  // a tier is a whole answer: both carry the same fields, frozen through
  const shape = (o) => Object.entries(o).map(([k, v]) => (v && typeof v === 'object' ? `${k}{${shape(v)}}` : k)).sort().join(',');
  assert.equal(shape(CASUAL), shape(HARD), 'no field one tier forgot');
  assert.ok(Object.isFrozen(CASUAL) && Object.isFrozen(CASUAL.stamina) && Object.isFrozen(HARD.roughRest) && Object.isFrozen(SURVIVAL_STORED), 'frozen through');
  // the reads
  assert.equal(rulesForTier('off'), null); assert.equal(rulesForTier('nonsense'), null); assert.equal(rulesForTier(false), null);
  assert.equal(rulesForTier('casual'), CASUAL); assert.equal(rulesForTier('hard'), HARD);
  for (const t of SURVIVAL_TIER_IDS) { assert.equal(isStoredTier(SURVIVAL_STORED[t]), true, t); assert.equal(tierOfStored(SURVIVAL_STORED[t]), t); }
  for (const v of [true, undefined, null, 0, '', 3, 'off', 'false', 'Casual', {}]) {
    assert.equal(isStoredTier(v), false, `${JSON.stringify(v)} is stored by no tier`);
    assert.equal(tierOfStored(v), SURVIVAL_DEFAULT, `${JSON.stringify(v)} reads as the default`);
  }
  // and the leaf is a leaf
  assert.doesNotMatch(read('src/systems/survival/difficulty.js'), /^import /m, 'the table imports nothing - every law may read it without a cycle');
});

test('SURV-TIERS: the switch - on is anything but Off; the live rules are the tier\'s; a stored value that is no tier reads as the default, the rule the Features bar draws it by', () => {
  _resetForTests();
  assert.equal(survivalTier(), 'casual'); assert.equal(survivalOn(), true); assert.equal(survivalRules(), CASUAL);
  setPref(SURVIVAL_PREF, 'hard'); assert.equal(survivalTier(), 'hard'); assert.equal(survivalRules(), HARD); assert.equal(survivalOn(), true);
  setPref(SURVIVAL_PREF, false); assert.equal(survivalTier(), 'off'); assert.equal(survivalOn(), false); assert.equal(survivalRules(), null);
  // BLOOD AUDIT 5's rule (ui/enhancedMenu.js tileStates): a value that is no tier shows as the default - so the laws
  // read it the same way, and the bar and the game can never disagree about which tier is live
  for (const junk of [true, 'off', 'Hard', 2]) {
    setPref(SURVIVAL_PREF, junk); assert.equal(survivalTier(), 'casual', `${JSON.stringify(junk)} names no tier`);
  }
  const menu = read('src/ui/enhancedMenu.js');
  assert.match(menu, /const fallback = Math\.max\(0, c\.tiers\.findIndex\(\(\[v\]\) => String\(v\) === String\(c\.default \?\? c\.initial\)\)\);/, 'the bar\'s own fallback is the row\'s default');
  _resetForTests();
});

test('SURV-TIERS: the shelf - Off is the old switch\'s own false, so a shelf written before the tiers needs nothing and an older build still reads it; a value that names no tier is dropped at the load', () => {
  const KEY = 'dagger.ui.v1';
  let store = new Map();
  const had = Object.hasOwn(globalThis, 'localStorage'), saved = globalThis.localStorage;
  globalThis.localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
  const withShelf = (blob) => { store = new Map([[KEY, JSON.stringify(blob)]]); _resetForTests(); loadPrefs(); };
  const shelf = () => JSON.parse(store.get(KEY) ?? '{}');
  try {
    withShelf({ survival: false });
    assert.equal(survivalTier(), 'off', 'the only survival value PREF1\'s shelf could have written was a player\'s Off');
    setPref('showFps', true);   // any write saves the shelf
    assert.equal(shelf().survival, false, 'kept as the very value it was - a build from before the tiers reading this shelf still reads Off');
    withShelf(shelf());
    assert.equal(survivalTier(), 'off', 'and it stays Off across every reload after');
    withShelf({});
    assert.equal(survivalTier(), 'casual', 'a player who never touched the switch stored nothing, and moves to Casual with the default');
    withShelf({ survival: 'hard' });
    assert.equal(survivalTier(), 'hard', 'a chosen tier is kept');
    setPref(SURVIVAL_PREF, 'casual');
    assert.equal(shelf().survival, undefined, 'choosing the default back stores nothing (PREF1: the default is not a choice)');
    // AUDIT SURV-TIERS: the bar matches a stored value by its STRING, so a hand-edited 'false' drew Off while the laws
    // ran the default - the load drops every value that names no tier, and the two read one answer
    for (const junk of [true, 'false', 'off', 'Hard', 7]) {
      withShelf({ survival: junk });
      assert.equal(survivalTier(), 'casual', `${JSON.stringify(junk)} names no tier - the default`);
      setPref('showFps', true);
      assert.equal(Object.hasOwn(shelf(), 'survival'), false, `${JSON.stringify(junk)} was dropped at the load`);
    }
  } finally {
    if (had) globalThis.localStorage = saved; else delete globalThis.localStorage;
    _resetForTests();
  }
  assert.match(read('src/systems/uiPrefs.js'), /if \(p\.survival !== undefined && !isStoredTier\(p\.survival\)\) _prefs\.survival = PREF_DEFAULTS\.survival;/);
});

test('SURV-TIERS: Hard is the arc as it stood - the rough rest, the drains, the band, no floor, no loan, every cost on; a law handed no rules runs it', () => {
  assert.equal(HARD_RULES, HARD);
  assert.deepEqual({ ...HARD.roughRest }, { recovery: 0.5, encounters: 2, stiffHours: STIFF_HOURS });
  assert.equal(REST_COST.rough, HARD.roughRest, 'rest.js prices the rough kind off the table - one source');
  assert.deepEqual({ ...HARD.stamina }, { floor: 0, hotFrom: 20, coldFrom: -20, bareFeet: true, duringRest: true, repaid: false, fireWarms: false }, 'twenty either way - `abs >= 20`, as it was; a rest pays the band, as it did; a fire is its fifteen degrees');
  for (const k of ['attributes', 'health', 'rust', 'sickness', 'huntHarms', 'restGate', 'blackout', 'wastedMeal']) assert.equal(HARD[k], true, k);
  assert.equal(HARD.roughSleepFloor, 'tired');
  assert.deepEqual({ ...DRAIN }, { heatPer20: 6, starving: 4, parched: 6, dehydrated: 12, exhausted: 8, wellFed: 64, bareFeet: 4 }, 'the body\'s rates, unchanged');
  // the defaults
  assert.equal(restCost('rough'), HARD.roughRest); assert.equal(restCost('rough', null), HARD.roughRest, 'null is no rules too');
  assert.equal(restCost('bed', CASUAL), REST_COST.bed); assert.equal(restCost('camp', CASUAL), REST_COST.camp, 'a bed and a camp cost the same in every tier');
  const needs = read('src/systems/survival/needs.js');
  assert.match(needs, /const rules = deps\.rules \?\? HARD_RULES;/);
  assert.match(needs, /export function survivalStatMods\(s, temp, now, \{ endurance = 50, rules = HARD_RULES, vampire = false \} = \{\}\)/);
});

test('SURV-TIERS: Casual is five rules written out - stamina only, red stages only, borrowed down to half the pool and repaid, nothing refused, rolled against you or wasted', () => {
  assert.deepEqual({ ...CASUAL.stamina }, { floor: 0.5, hotFrom: 51, coldFrom: -31, bareFeet: false, duringRest: false, repaid: true, fireWarms: true });
  for (const k of ['attributes', 'health', 'rust', 'sickness', 'huntHarms', 'restGate', 'blackout', 'wastedMeal']) assert.equal(CASUAL[k], false, k);
  assert.deepEqual({ ...CASUAL.roughRest }, { recovery: 1, encounters: 1, stiffHours: 0 }, 'a Casual rough night is DFU\'s own hour');
  assert.equal(CASUAL.roughSleepFloor, null);
});

test('SURV-TIERS: RED MEANS IT COSTS - Casual charges each need at exactly the stages the HUD paints red, at Hard\'s rate, and nowhere else', () => {
  // the temperature: the band's edges ARE the red words' edges, every degree from -150 to 150
  for (let felt = -150; felt <= 150; felt++) {
    const word = temperatureWord(felt);
    const red = HUD_NEED_WORDS.temp[word]?.[1] === 'danger';
    assert.equal(felt >= CASUAL.stamina.hotFrom || felt <= CASUAL.stamina.coldFrom, red, `felt ${felt} (${word})`);
  }
  // hunger, thirst, sleep: one comfortable minute at each stage - the charge is there iff the chip is red
  const stages = [
    ['hunger', 'peckish', (s, now) => { s.lastAte = now - 300; }, null],
    ['hunger', 'hungry', (s, now) => { s.lastAte = now - 800; }, null],
    ['hunger', 'starving', (s, now) => { s.lastAte = now - 1500; }, DRAIN.starving],
    ['thirst', 'thirsty', (s) => { s.thirst = 60; }, null],
    ['thirst', 'parched', (s) => { s.thirst = 85; }, DRAIN.parched],
    ['thirst', 'dehydrated', (s) => { s.thirst = 110; }, DRAIN.dehydrated],
    ['sleep', 'tired', (s) => { s.sleepDebt = 5; }, null],
    ['sleep', 'drowsy', (s) => { s.sleepDebt = 9; }, null],
    ['sleep', 'exhausted', (s) => { s.sleepDebt = 13; }, DRAIN.exhausted],
  ];
  const now = 20001;   // not a harm tick
  for (const [need, stage, set, rate] of stages) {
    const red = HUD_NEED_WORDS[need][stage][1] === 'danger';
    assert.equal(rate != null, red, `${need}:${stage} - the table above says what the HUD says`);
    const e = body(); const log = [];
    set(survivalOf(e, now), now);
    const temp = survivalMinute(e, now, INDOORS, minuteDeps(e, log, CASUAL));
    assert.equal(temperatureWord(temp.felt), 'comfortable', 'the room charges nothing');
    assert.equal(drains(log), rate ?? 0, `${need}:${stage} charges ${rate ?? 'nothing'} in Casual`);
    assert.equal(log.some((l) => l[0] === 'hurt'), false);
    assert.equal(e.activeEffects.some((a) => a.kind === 'survival'), false, `${need}:${stage} touches no attribute in Casual`);
  }
  // the temperature through the law, over EVERY climate, month, hour and weather the world has: a dressed body is
  // charged exactly when the felt word is red, by Hard's own formula - and Hard charges from twenty either way.
  // Barefoot, Hard adds its barefoot tax past half the endurance; Casual never does (the feet are no need, and have
  // no chip). A failure is built into words only when it happens - this is ninety thousand minutes.
  const clothes = { [S.ChestClothes]: { templateIndex: 158, group: 'MensClothing' }, [S.LegsClothes]: { templateIndex: 151, group: 'MensClothing' } };
  const shod = worn({ ...clothes, [S.Feet]: { templateIndex: 149, group: 'MensClothing' } }), barefoot = worn(clothes);
  let seenRed = 0, seenQuiet = 0, seenFeet = 0, walked = 0;
  for (const climateIndex of Object.values(CLIMATES)) for (let month = 0; month < 12; month++) for (let hour = 0; hour < 24; hour++) for (const weather of Object.keys(WEATHER_TEMP)) for (const feet of [shod, barefoot]) {
    for (const [rules, costs] of [[CASUAL, (f) => f >= 51 || f <= -31], [HARD, (f) => Math.abs(f) >= 20]]) {
      const e = body(); const log = [];
      survivalOf(e, now);
      const temp = survivalMinute(e, now, { climateIndex, month, hour, weather }, minuteDeps(e, log, rules, { worn: feet }));
      const tax = feet === barefoot && rules === HARD && temp.abs > STATS.endurance / 2 ? DRAIN.bareFeet : 0;
      const want = (costs(temp.felt) ? DRAIN.heatPer20 * Math.trunc(temp.abs / 20) : 0) + tax;
      if (drains(log) !== want) assert.fail(`${rules.id}: felt ${temp.felt} (${temperatureWord(temp.felt)}) at climate ${climateIndex}/${month}/${hour}/${weather}${feet === barefoot ? ', barefoot' : ''} charged ${drains(log)}, not ${want}`);
      walked++;
      if (rules === CASUAL) { if (want) seenRed++; else seenQuiet++; }
      if (tax) seenFeet++;
    }
  }
  assert.equal(walked, Object.values(CLIMATES).length * 12 * 24 * Object.keys(WEATHER_TEMP).length * 2 * 2);
  assert.ok(seenRed > 0 && seenQuiet > 0 && seenFeet > 0, `the sweep saw both sides of the band and the bare feet (${seenRed} red, ${seenQuiet} quiet, ${seenFeet} barefoot taxes)`);
});

test('SURV-TIERS: THE WORST DAY - starving, dehydrated, exhausted, half naked, barefoot in a mountain blizzard in wet plate: Casual lends half the stamina and nothing else; Hard is what it always was', () => {
  const day = (rules) => {
    const e = body(); const log = [];
    e.items = [];   // no water, no rations
    const s = survivalOf(e, 0);
    Object.assign(s, { lastAte: -3000, thirst: NEED.THIRST_MAX, sleepDebt: 20, awakeSince: -2000, lastMinute: 0 });
    const cuirass = plate();
    runSurvivalMinutes(e, 0, 1440, BLIZZARD, { ...minuteDeps(e, log, rules), worn: worn({ [S.ChestArmor]: cuirass }), rolls: () => 0.01 });
    return { e, log, cuirass, said: log.filter((l) => l[0] === 'say').map((l) => l[1]) };
  };
  const c = day(CASUAL);
  assert.equal(c.e.health, 40, 'Casual: not a point of health');
  assert.equal(c.log.some((l) => l[0] === 'hurt'), false, 'no wound was even asked for');
  assert.equal(c.e.activeEffects.some((a) => a.kind === 'survival'), false, 'no attribute moved');
  assert.equal(c.e.fatigue, 3200, 'the stamina came down to half the pool - and stopped there');
  assert.equal(drains(c.log), 3200, 'exactly half was charged');
  assert.equal(Object.values(c.e.survival.borrowed).reduce((a, b) => a + b, 0), 3200, 'and every point of it is on loan, owed back when the needs are met');
  assert.equal(c.cuirass.currentCondition, 100, 'the wet plate did not rust');
  for (const t of [SURVIVAL_TEXT.starving, SURVIVAL_TEXT.dehydrated, SURVIVAL_TEXT.exhausted, SURVIVAL_TEXT.deadly, SURVIVAL_TEXT.nakedCold, SURVIVAL_TEXT.bareFeetCold]) {
    assert.ok(c.said.includes(t), `Casual still says it: "${t}" - the world is the same world`);
  }
  const h = day(HARD);
  assert.ok(h.e.health < 40, 'Hard wounds');
  assert.ok(h.e.activeEffects.some((a) => a.kind === 'survival'), 'Hard drains the attributes');
  assert.ok(h.e.fatigue < 3200, 'Hard takes the stamina past half');
  assert.equal(h.e.survival.borrowed, undefined, 'and takes it: Hard lends nothing');
  assert.ok(h.cuirass.currentCondition < 100, 'Hard rusts');
  assert.deepEqual(h.said.filter((t) => c.said.includes(t)).length > 0, true);
});

test('SURV-TIERS: SAME WORLD - two players on the two tiers, the same night: every counter on the record is identical; only the bodies (and Casual\'s loan, which is the body\'s) differ', () => {
  const run = (rules) => {
    const e = body();
    Object.assign(survivalOf(e, 0), { lastAte: -2000, thirst: 90, sleepDebt: 10, awakeSince: -1500, lastMinute: 0 });
    runSurvivalMinutes(e, 0, 720, { ...BLIZZARD, weather: 'rain', climateIndex: CLIMATES.Woodlands }, { ...minuteDeps(e, [], rules), worn: null, rolls: seeded(7) });
    return e;
  };
  const c = run(CASUAL), h = run(HARD);
  const { borrowed, loanPool, ...world } = c.survival;   // AUDIT SURV-TIERS (the third pass): the loan and the pool it last left - both the body's
  assert.deepEqual(world, h.survival, 'hunger, thirst, wet, sleep, exposure, the felt reading, the notes said - one world');
  assert.ok(borrowed && Object.values(borrowed).every((v) => v > 0), 'the loan is what Casual\'s body is owed');
  assert.notEqual(c.health, h.health, 'what it cost is the tier\'s');
});

test('SURV-TIERS: the floor is ONE budget a minute, read after the fed hour\'s refund - two needs share it whatever the sink does; below it nothing is charged; Hard has none', () => {
  const now = 20001;
  const minute = (rules, fatigue, sinkWrites) => {
    const e = body({ fatigue }); const log = [];
    const s = survivalOf(e, now); s.lastAte = now - 1500; s.thirst = 110;   // starving (4) and dehydrated (12) in one minute
    const sinks = sinkWrites ? sinksFor(e, log) : { drainFatigue: (n) => log.push(['fatigue', n]), restoreFatigue: () => {}, hurt: () => {}, say: () => {} };
    survivalMinute(e, now, INDOORS, { ...minuteDeps(e, log, rules), sinks });
    return log.filter((l) => l[0] === 'fatigue').map((l) => l[1]);
  };
  assert.deepEqual(minute(CASUAL, 3210, true), [4, 6], 'ten above the floor: the first need takes four, the second the six that are left');
  assert.deepEqual(minute(CASUAL, 3210, false), [4, 6], '...and the same with a sink that writes nothing back - the budget is the law\'s own');
  assert.deepEqual(minute(CASUAL, 3200, true), [], 'at the floor: nothing');
  assert.deepEqual(minute(CASUAL, 1000, true), [], 'below it (a sprint put it there): survival does not push it further');
  assert.deepEqual(minute(CASUAL, 6400, true), [4, 12], 'far above it: the whole charge');
  assert.deepEqual(minute(HARD, 10, true), [4, 12], 'Hard has no floor - the collapse is its cost (AUDIT-DEATH1)');
  // AUDIT SURV-TIERS: AFTER THE REFUND, as the law's own comment says - at the floor, the minute the fed hour pays its
  // sixty-four, a thirst may take twelve of them and no more
  const fed = body({ fatigue: 3200 }); const flog = [];
  Object.assign(survivalOf(fed, now), { lastAte: now - 10, fed: WELL_FED_MINUTES - 1, thirst: 110 });
  survivalMinute(fed, now, INDOORS, minuteDeps(fed, flog, CASUAL));
  assert.deepEqual(flog.filter((l) => l[0] !== 'say'), [['restore', DRAIN.wellFed], ['fatigue', DRAIN.dehydrated]], 'the refund first, then the charge out of it');
  // the floor scales with the pool: a stronger body keeps more
  const strong = body({ fatigue: 4000, stats: { ...STATS, strength: 80, endurance: 80 } });   // pool 10240, floor 5120
  const log = [];
  Object.assign(survivalOf(strong, now), { lastAte: now - 1500 });
  survivalMinute(strong, now, INDOORS, minuteDeps(strong, log, CASUAL));
  assert.deepEqual(log.filter((l) => l[0] === 'fatigue'), [], 'half of a bigger pool is a higher floor');
  // the dead constant is gone and its truth is written down
  const needs = read('src/systems/survival/needs.js');
  assert.doesNotMatch(needs, /export const FLOOR_FATIGUE/, 'no constant that looks wired and is not');
  assert.match(needs, /budget \?\?= Math\.max\(0, \(entity\.fatigue \?\? 0\) - Math\.floor\(maxFatigue\(entity\) \* floorShare\)\);/);
});

test('SURV-TIERS: BORROWED, NOT TAKEN - what a need takes in Casual it gives back the moment that need is met, each need its own; a rest pauses the charge, not the need; the pool is the ceiling; Hard lends nothing and drops a loan it inherits', () => {
  let now = 40001;
  const e = body(); const log = [];
  const s = survivalOf(e, now);
  Object.assign(s, { lastAte: now - 1500, thirst: 110, sleepDebt: 13, awakeSince: now - 2000 });
  const step = (env = INDOORS, rules = CASUAL) => { survivalMinute(e, now, env, minuteDeps(e, log, rules, { sinks: sinksFor(e, log) })); now++; };
  for (let i = 0; i < 10; i++) step();
  assert.deepEqual({ ...s.borrowed }, { hunger: 40, thirst: 120, sleep: 80 }, 'each need\'s charge, under its own name');
  assert.equal(e.fatigue, 6400 - 240);
  // a rest charges nothing - and repays nothing, because the needs are still there
  const owed = { ...s.borrowed }, f0 = e.fatigue;
  step({ ...INDOORS, resting: true });
  assert.deepEqual({ ...s.borrowed }, owed, 'a rest is not a meal, a drink or a sleep');
  assert.equal(e.fatigue, f0);
  // a meal: the hunger's loan comes back, and only the hunger's
  s.lastAte = now; log.length = 0;
  step();
  assert.deepEqual(restores(log), [['restore', 40]], 'the meal repays the hunger\'s forty');
  assert.ok(log.some((l) => l[0] === 'say' && l[1] === SURVIVAL_TEXT.repaid), 'and says so');
  assert.deepEqual(Object.keys(s.borrowed).sort(), ['sleep', 'thirst'], 'the thirst and the sleep still owed (and still charging)');
  s.thirst = 0; step();
  assert.equal(s.borrowed.thirst, undefined, 'a drink repays the thirst');
  s.sleepDebt = 0; step();
  assert.equal(s.borrowed, undefined, 'a sleep the exhaustion: nothing owed');
  assert.equal(e.fatigue, 6400, 'and every point that was taken is back');
  // the cold's loan comes back in a warm room
  const cold = body(); const clog = [];
  let t = 50001;
  survivalOf(cold, t);
  for (let i = 0; i < 5; i++, t++) survivalMinute(cold, t, BLIZZARD, minuteDeps(cold, clog, CASUAL));
  assert.ok(cold.survival.borrowed?.temp > 0, 'the blizzard borrows');
  survivalMinute(cold, t, INDOORS, minuteDeps(cold, clog, CASUAL));
  assert.deepEqual([cold.survival.borrowed, cold.fatigue], [undefined, 6400], 'and a warm room hands it back');
  // the pool is the ceiling: a loan is settled whole, and what does not fit is not banked
  Object.assign(s, { borrowed: { hunger: 500 } }); e.fatigue = 6390; log.length = 0;
  step();
  assert.deepEqual([restores(log), s.borrowed], [[['restore', 10]], undefined], 'ten fit; the loan is settled');
  // ...and the room is read AFTER the minute's own refund: the fed hour pays sixty-four first, so a loan that fit
  // the pool at the top of the minute is repaid only as far as the pool still has room - never asked past it
  Object.assign(s, { borrowed: { hunger: 100 }, lastAte: now - 10, fed: WELL_FED_MINUTES - 1 }); e.fatigue = 6300; log.length = 0;
  step();
  assert.deepEqual(restores(log), [['restore', DRAIN.wellFed], ['restore', 100 - DRAIN.wellFed]], 'the refund first, then the loan up to the room it left');
  // Hard lends nothing, and a loan carried in from Casual is dropped at its first minute - Hard keeps what it takes
  Object.assign(s, { borrowed: { hunger: 500 }, lastAte: now - 1500 }); e.fatigue = 6000; log.length = 0;
  step(INDOORS, HARD);
  assert.deepEqual([s.borrowed, drains(log)], [undefined, DRAIN.starving], 'charged, not lent');
  s.lastAte = now; step(INDOORS, HARD);
  assert.deepEqual(restores(log), [], 'a Hard meal repays nothing');
});

test('SURV-TIERS: a Hard morning lifts the minute the player turns to Casual - no stiff chip, no stiff attributes; Hard keeps it', () => {
  const now = 30001;
  for (const [rules, stiff] of [[CASUAL, false], [HARD, true]]) {
    const e = body();
    const s = survivalOf(e, now); s.stiffUntil = now + STIFF_HOURS * 60;
    survivalMinute(e, now, INDOORS, minuteDeps(e, [], rules));
    assert.equal(survivalHudChips(e, now + 1).some((c) => c.key === 'stiff'), stiff, `${rules.id}: the chip`);
    assert.equal((survivalStatMods(e.survival, null, now + 1, { rules }).agility ?? 0) < 0, stiff, `${rules.id}: the attribute`);
  }
  // the drink's swing is every tier's - chosen at a bar, not a need left unmet
  const drunk = { ...newSurvival(0), drunk: 60 };
  assert.ok(survivalStatMods(drunk, null, 0, { endurance: 50, rules: CASUAL }).personality > 0);
  assert.ok(survivalStatMods(drunk, null, 0, { endurance: 50, rules: CASUAL }).agility < 0);
});

test('SURV-TIERS: the rest - a Casual rough night is DFU\'s whole hour with one ask and no morning, pays the debt down to nothing, is never charged for the cold, and nothing refuses it; Hard\'s is as it was; Off keeps the place and prices it as a bed', () => {
  const full = sleeper(); restVitals(full, { day: false, inside: true });
  const c = sleeper(); restHour(c, 'rough', () => restVitals(c, { day: false, inside: true }), undefined, CASUAL);
  assert.equal(c.health, full.health, 'Casual: the whole hour on bare ground');
  const h = sleeper(); restHour(h, 'rough', () => restVitals(h, { day: false, inside: true }), undefined, HARD);
  assert.ok(h.health < full.health, 'Hard: half of it');
  assert.equal(stiffen(sleeper(), 0, 'rough', CASUAL), false, 'no morning in Casual');
  const st = sleeper(); assert.equal(stiffen(st, 0, 'rough', HARD), true); assert.equal(st.survival.stiffUntil, STIFF_HOURS * 60);
  // the sleep debt: the window is still the lesser sleep, but a Casual one pays down to nothing
  for (const [rules, left] of [[CASUAL, 0], [HARD, NEED.SLEEP_TIRED]]) {
    const e = body(); Object.assign(survivalOf(e, 0), { sleepDebt: 5, lastMinute: 0 });
    runSurvivalMinutes(e, 0, 12 * 60, { ...INDOORS, resting: true, sleeping: 'rough' }, minuteDeps(e, [], rules));
    assert.equal(e.survival.sleepDebt, left, `${rules.id}: twelve rough hours from tired leave ${left}`);
  }
  // AUDIT SURV-TIERS: A REST IS A REST. Casual has no gate, so its rest in a blizzard was charged the band faster than
  // DFU's hour restores - the sleeper woke more tired than they lay down, and a rest until healed never ended. The heat
  // and the cold charge a rest only in the tier whose gate refuses the worst of it.
  for (const [rules, charged] of [[CASUAL, false], [HARD, true]]) {
    const e = body({ fatigue: 4000 }); const log = [];
    survivalOf(e, 0);
    runSurvivalMinutes(e, 0, 480, { ...BLIZZARD, resting: true, sleeping: 'rough' }, minuteDeps(e, log, rules));
    assert.equal(drains(log) > 0, charged, `${rules.id}: eight hours asleep in a blizzard ${charged ? 'are charged' : 'charge nothing'}`);
  }
  // composed: the place is still where you sleep; the tier prices it
  _resetForTests(); setWorldMinutes(6000);
  const said = [];
  const e = sleeper();
  const d = createRestDeps(e, { advanceMinutes: () => {}, endLines: () => [], say: (l) => said.push(l), restKind: () => 'rough', day: () => false, inside: () => true });
  d.setResting(true);
  assert.equal(e.restKind, 'rough', 'the bare ground is still the bare ground');
  assert.equal(e.restAsks, 1, 'one encounter ask a minute in Casual, stamped beside the kind');
  d.tickVitals();
  assert.equal(e.health, full.health, 'the whole hour');
  d.setResting(false);
  assert.deepEqual(said, [], 'no stiff morning to say');
  assert.equal(e.survival, undefined, 'and nothing written on the record');
  setPref(SURVIVAL_PREF, 'hard');
  const hs = sleeper();
  const dh = createRestDeps(hs, { advanceMinutes: () => {}, endLines: () => [], say: (l) => said.push(l), restKind: () => 'rough', day: () => false, inside: () => true });
  dh.setResting(true);
  assert.equal(hs.restAsks, 2, 'Hard\'s rough night asks twice');
  dh.tickVitals(); dh.setResting(false);
  assert.deepEqual(said, [REST_TEXT_SURVIVAL.stiff], 'and rises stiff');
  assert.equal(hs.restAsks, null, 'and the stamp goes when the rest does');
  // a bed or a camp asks once in any tier
  for (const kind of ['bed', 'camp']) {
    const b = sleeper();
    const db = createRestDeps(b, { advanceMinutes: () => {}, restKind: () => kind, day: () => false, inside: () => true });
    db.setResting(true); assert.equal(b.restAsks, 1, `Hard: a ${kind} asks once`); db.setResting(false);
  }
  // AUDIT SURV-TIERS: Off stamped every place a BED, and the party pose broadcasts the stamp - a Casual or Hard
  // follower mirroring an Off leader slept a bed's night in a field. The place is the world's; Off only prices it.
  setPref(SURVIVAL_PREF, false);
  const o = sleeper();
  const doff = createRestDeps(o, { advanceMinutes: () => {}, restKind: () => 'rough', day: () => false, inside: () => true });
  doff.setResting(true);
  assert.equal(o.restKind, 'rough', 'Off: the field is a field - what a follower mirrors');
  assert.equal(o.restAsks, 1, 'priced as DFU\'s bed: one ask');
  doff.tickVitals(); assert.equal(o.health, full.health, '...and the whole hour');
  doff.setResting(false);
  // the encounter law takes the COUNT: one ask is DFU's, two is the rough night's
  const ctx = { gameMinutes: 1440 * 3, inside: true, inDungeon: true, isResting: true, enemyAlertActive: true, dungeonType: 0, playerLevel: 5 };
  const seq = (vals) => { let i = 0; return () => vals[i++ % vals.length]; };
  assert.equal(intermittentEnemySpawn({ ...ctx, restAsks: 1 }, seq([0.9, 0.0, 0.5])), null, 'one ask, a miss');
  assert.ok(intermittentEnemySpawn({ ...ctx, restAsks: 2 }, seq([0.9, 0.0, 0.5])), 'the second ask lands');
  // AUDIT SURV-TIERS: a count that is no finite number is one ask - NaN asked none at all, Infinity never stopped
  assert.ok(intermittentEnemySpawn({ ...ctx, restAsks: NaN }, seq([0.0, 0.5])), 'NaN is one ask');
  // (the rolls stop answering after a thousand calls, so an Infinity that asks for ever FAILS here rather than hangs)
  const bounded = (vals) => { let i = 0; return () => { if (++i > 1000) throw new Error('asked without end'); return vals[(i - 1) % vals.length]; }; };
  assert.equal(intermittentEnemySpawn({ ...ctx, restAsks: Infinity }, bounded([0.9])), null, 'Infinity is one ask, and it ends');
  assert.equal(intermittentEnemySpawn({ ...ctx, restAsks: '2' }, seq([0.9, 0.0, 0.5])), null, 'a string is no count');
  _resetForTests(); setWorldMinutes(0);
});

test('SURV-TIERS: the gate stands only in Hard - Casual sleeps in a deadly cold on bare ground; Off has no gate at all', () => {
  clearPreventRestConditions();
  _resetForTests();
  const p = body(); p.survival = newSurvival(0); p.survival.felt = -100;
  installSurvivalGate(registerPreventRestCondition, () => p, () => ({ byFire: false, insideBuilding: false }));
  assert.equal(survivalGateOn(), false); assert.equal(getPreventedRestMessage(), null, 'Casual: the sleep is never refused');
  p.survival.felt = 100; assert.equal(getPreventedRestMessage(), null, '...nor for the heat');
  setPref(SURVIVAL_PREF, 'hard');
  assert.equal(survivalGateOn(), true); assert.equal(getPreventedRestMessage(), REST_TEXT_SURVIVAL.tooHot, 'Hard: too hot anywhere');
  p.survival.felt = -100; assert.equal(getPreventedRestMessage(), REST_TEXT_SURVIVAL.tooCold, 'Hard: too cold without a fire');
  setPref(SURVIVAL_PREF, false);
  assert.equal(survivalGateOn(), false); assert.equal(getPreventedRestMessage(), null);
  clearPreventRestConditions(); _resetForTests();
});

test('SURV-TIERS: the meal - Casual makes no sickness roll at all (Hard\'s lucky branch, every time), and neither does Off; spoiling is the world\'s and still halves the worth, and putrid still will not go down', () => {
  const raw = createSurvivalItem(TEMPLATE.RawMeat);
  let asked = 0;
  const unlucky = () => { asked++; return 0.99; };
  const c = eatLaw(raw, { lastAte: 0, now: 5000, luck: 10, rolls: unlucky, rules: CASUAL });
  assert.equal(c.ok, true); assert.equal(c.sick, null); assert.equal(c.feel, 'invigorated'); assert.equal(asked, 0, 'no roll was made against the eater');
  const h = eatLaw(raw, { lastAte: 0, now: 5000, luck: 10, rolls: unlucky });
  assert.equal(h.sick, 'mild', 'Hard: the same meal on the same roll turns the stomach'); assert.equal(asked, 1);
  const mouldy = createSurvivalItem(TEMPLATE.Bread, { foodStage: FOOD_STAGE.Mouldy });
  const m = eatLaw(mouldy, { lastAte: 0, now: 5000, rolls: unlucky, rules: CASUAL });
  assert.equal(m.sick, null); assert.equal(m.satiety, Math.trunc(FOOD[TEMPLATE.Bread].satiety / 3), 'a mouldy loaf feeds a third - the world\'s law');
  assert.equal(eatLaw(createSurvivalItem(TEMPLATE.Bread, { foodStage: FOOD_STAGE.Putrid }), { lastAte: 0, now: 5000, rules: CASUAL }).reason, 'putrid');
  // through the use handler: the infliction is never reached
  const e = body(); e.items = [createSurvivalItem(TEMPLATE.RawFish)];
  Object.assign(survivalOf(e, 5000), { lastAte: 0 });
  let inflicted = 0;
  const r = useSurvivalItem(e.items[0], e.items, { entity: e, now: 5000, rolls: unlucky, inflict: () => { inflicted++; return true; }, rules: CASUAL });
  assert.equal(r.kind, 'ate'); assert.equal(r.sick, null); assert.equal(inflicted, 0);
  // AUDIT SURV-TIERS: and through the WHOLE use ladder, as the pack calls it - with the arc Off a leftover meal was
  // Hard's roll (the law's default for no rules), so the classic game could give a disease. Off eats as Casual does.
  for (const [tier, sickens] of [[false, false], ['casual', false], ['hard', true]]) {
    _resetForTests(); setPref(SURVIVAL_PREF, tier);
    const eater = body({ skillUses: [] }); eater.items = [createSurvivalItem(TEMPLATE.RawMeat)];
    Object.assign(survivalOf(eater, 5000), { lastAte: 0 });
    let rolled = 0;
    const out = useItem(eater.items[0], eater.items, { entity: eater, nowMinute: 5000, rolls: () => { rolled++; return 0.99; } });
    assert.equal(out.kind, 'ate', `${tier}: eaten`);
    assert.equal(out.sick != null, sickens, `${tier}: ${sickens ? 'the roll turns the stomach' : 'never sickened'}`);
    assert.equal(rolled > 0, sickens, `${tier}: ${sickens ? 'a roll made' : 'no roll made'}`);
  }
  _resetForTests();
});

test('SURV-TIERS: the hunt - on the SAME rolls, a Casual hunt is the Hard hunt with every harm swapped for its safe twin: the same catch, the same skills, no bite, no fall, no beast', () => {
  const HARM = (o) => !!(o.poison || o.disease || o.hurt > 0 || o.tired || o.beast);
  const harmful = new Set();
  let n = 0;
  for (const [climate, kinds] of Object.entries(HUNT_EVENTS)) for (const kind of kinds) for (const hasBow of [true, false]) for (const skill of [0, 50, 100]) {
    const skills = { archery: skill, stealth: skill, criticalStrike: skill, climbing: skill };
    for (let seed = 1; seed <= 200; seed++) {
      const hard = huntOutcome({ climate, kind }, { hasBow, skills, luck: 50, rolls: seeded(seed) });
      const casual = huntOutcome({ climate, kind }, { hasBow, skills, luck: 50, rolls: seeded(seed), rules: CASUAL });
      n++;
      if (HARM(hard)) harmful.add(hard.key);
      assert.equal(HARM(casual), false, `${climate}/${kind}/${hasBow}/${skill}/#${seed}: ${casual.key} carries a harm in Casual`);
      assert.equal(casual.key, HUNT_SAFE_TWIN[hard.key] ?? hard.key, 'the twin, or the same outcome');
      assert.equal(casual.meat, hard.meat); assert.equal(casual.fruit, hard.fruit); assert.deepEqual(casual.skills, hard.skills);
    }
  }
  assert.ok(n > 10000);
  assert.deepEqual([...harmful].sort(), Object.keys(HUNT_SAFE_TWIN).sort(), 'every harmful outcome has a twin, and every twin answers a real harm');
  for (const [from, to] of Object.entries(HUNT_SAFE_TWIN)) {
    assert.ok(Array.isArray(HUNT_TEXT[to]), `${from}'s twin ${to} has its words`);
    assert.equal(Object.hasOwn(HUNT_SAFE_TWIN, to), false, `${to} is not itself a harm`);
  }
  // composed, through the host's own hunt (scenes/hunting.js reads the live tier): the rolls that stand three
  // grizzlies in Hard (surv6_hunting.test.js) stand none in Casual
  const WILD = { minute: 10 * 60, luck: 50, winter: false, outdoors: true, inLocationRect: false, night: false, enemiesNear: false, resting: false, climateIndex: 232 };
  const seq = (...v) => { let i = 0; return () => v[Math.min(i++, v.length - 1)]; };
  for (const [tier, beasts] of [['casual', 0], ['hard', 1]]) {
    _resetForTests(); setPref(SURVIVAL_PREF, tier);
    const spawned = [];
    const env = { ...WILD, hasBow: true, skills: { archery: 100, stealth: 100, criticalStrike: 100, climbing: 100 } };
    const hunter = { isPlayer: true, level: 5, health: 30, maxHealth: 40, fatigue: 20 * 64, items: [], survival: newSurvival(1000), stats: { luck: 50 }, career: {} };
    const hunt = createHunting({ entity: hunter, env: () => env, rolls: seq(0.029, 0.69, 0.5, 0.2, 0.5, 0.95, 0), showOverlay: () => {}, spawnBeast: (b) => spawned.push(b) });
    const w = hunt.tick();
    assert.ok(w, `${tier}: the event opens`);
    w.input('KeyY'); w.tick(100); w.click(0, 0);
    assert.equal(spawned.length, beasts, `${tier}: ${beasts ? 'the beast stands' : 'no beast - the hunted is the dust'}`);
    assert.equal(hunter.health, 30, `${tier}: and no wound either way`);
  }
  _resetForTests();
});

test('SURV-TIERS: the tavern - the house asks after the gold and before the coin: Casual\'s barkeep will not pour the drink that would take the night, nor the kitchen sell a meal a full stomach would waste; Hard pours, charges and wastes as the mod does', () => {
  const s = (drunk = 45) => ({ ...newSurvival(0), drunk });
  const drink = (strength) => ({ kind: 'drink', strength, price: 5 });
  // the pour, through the one order law both windows ask
  assert.deepEqual(tavernOrder(s(), 0, drink(35), { endurance: 50, rules: CASUAL }), { ok: false, text: TAVERN_MENU_TEXT.cutOff });
  assert.deepEqual(tavernOrder(s(), 0, drink(0), { endurance: 50, rules: CASUAL }), { ok: true }, 'milk and tea always pour');
  assert.deepEqual(tavernOrder(s(), 0, drink(0), { endurance: 40, rules: CASUAL }), { ok: true },
    '...even to a player already past the endurance - a disease took ten of it since the last ale, and water is still water');
  assert.deepEqual(tavernOrder(s(40), 0, drink(10), { endurance: 50, rules: CASUAL }), { ok: true }, 'an ale that lands exactly ON the endurance pours - the blackout is past it');
  assert.deepEqual(tavernOrder(s(41), 0, drink(10), { endurance: 50, rules: CASUAL }), { ok: false, text: TAVERN_MENU_TEXT.cutOff }, 'one past it does not');
  assert.deepEqual(tavernOrder(s(), 0, drink(35), { endurance: 50, rules: HARD }), { ok: true }, 'Hard pours: the blackout is its answer');
  assert.deepEqual(tavernOrder(s(), 0, drink(35)), { ok: true }, 'no rules is Hard');
  assert.deepEqual(tavernOrder(s(), 0, drink(35), { endurance: 50, rules: null }), { ok: true }, 'null is no rules too');
  assert.deepEqual(tavernOrder(s(), 0, drink(35), { endurance: 50, rules: CASUAL }), tavernPour(s(), 35, { endurance: 50, rules: CASUAL }), 'a drink is the pour\'s question');
  // AUDIT SURV-TIERS: the meal - tavernEat's own test (the hunger under the meal's worth) asked before the coin
  const meal = { kind: 'food', worth: 200, price: 5 };
  const ateAgo = (hunger) => ({ ...newSurvival(0), lastAte: 1000 - hunger });
  assert.deepEqual(tavernOrder(ateAgo(199), 1000, meal, { rules: CASUAL }), { ok: false, text: TAVERN_MENU_TEXT.fullForMeal }, 'Casual will not sell a meal to a stomach too full for it');
  assert.deepEqual(tavernOrder(ateAgo(200), 1000, meal, { rules: CASUAL }), { ok: true }, 'a meal\'s worth of hunger buys it');
  assert.equal(tavernEat(ateAgo(200), 1000, 200).ok, true, '...and the law eats exactly what the order sells');
  assert.equal(tavernEat(ateAgo(199), 1000, 200).ok, false);
  assert.deepEqual(tavernOrder(ateAgo(0), 1000, meal, { rules: HARD }), { ok: true }, 'Hard sells it and wastes it (the mod\'s quirk, kept)');
  assert.deepEqual(tavernOrder(ateAgo(0), 1000, meal, { rules: null }), { ok: true }, 'and null rules are Hard\'s, for the meal too');
  assert.deepEqual(tavernOrder(ateAgo(0), 1000, { kind: 'header' }, { rules: CASUAL }), { ok: true }, 'a row that is neither asks nothing');
  // the drink law never blacks out Casual, even handed the drink
  assert.equal(tavernDrink(s(), 35, { endurance: 50, rules: CASUAL }).blackout, false);
  assert.equal(tavernDrink(s(), 35, { endurance: 50, rules: HARD }).blackout, true);
  assert.doesNotMatch(TAVERN_MENU_TEXT.cutOff, /another/, 'a first spirit is refused too - the line names the reason, not a repeat');
  // the classic window, end to end
  const tavern = (entity, passed) => new TavernWindow({ entity, ...tavernHooks(passed), onTalk: () => {}, onClose: () => {} });
  const pick = (w, at) => { w._food(); const i = typeof at === 'number' ? at : w.flow.top.picker.findIndex((t) => at.test(t)); assert.ok(i >= 0, String(at)); return w.flow.top.onPick(i); };
  _resetForTests();   // Casual, the default
  {
    const entity = guest(); const passed = []; const w = tavern(entity, passed);
    assert.equal(pick(w, /Rye Liquor/)[0].rows[0].text, TAVERN_MENU_TEXT.cutOff);
    assert.deepEqual([entity.goldPieces, passed, entity.survival.drunk], [100, [], 45], 'refused: nothing charged, no time, nothing poured');
    pick(w, /Cows Milk/);
    assert.deepEqual([entity.goldPieces, passed], [98, [DRINK_MINUTES]], 'the milk is poured and paid for');
    entity.survival.lastAte = TAVERN_NOW - 10; passed.length = 0;
    assert.equal(pick(w, TAVERN_MEAL)[0].rows[0].text, TAVERN_MENU_TEXT.fullForMeal);
    assert.deepEqual([entity.goldPieces, passed], [98, []], 'a full stomach buys nothing and loses no half hour');
  }
  {
    const entity = guest({ goldPieces: 0 }); const w = tavern(entity, []);
    assert.equal(pick(w, /Rye Liquor/)[0].rows[0].text, `r${NOT_ENOUGH_GOLD_ID}`, 'the gold is asked first - a purse that cannot pay hears that, not the barkeep\'s verdict');
  }
  setPref(SURVIVAL_PREF, 'hard');
  {
    const entity = guest(); entity.survival.lastAte = TAVERN_NOW - 10; const passed = []; const w = tavern(entity, passed);
    assert.equal(pick(w, TAVERN_MEAL)[0].rows[0].text, TAVERN_MENU_TEXT.tooFull, 'Hard: charged, and the rest goes to waste');
    assert.ok(entity.goldPieces < 100); assert.deepEqual(passed, [MEAL_MINUTES]);
  }
  _resetForTests();
  // both windows: the gold, then the house, then the coin
  for (const [file, fn] of [['src/ui/tavernWindow.js', '_survivalFood()'], ['src/ui/enhancedTavern.js', 'function pickSurvival(']]) {
    const src = read(file); const at = src.indexOf(fn);
    const part = src.slice(at, src.indexOf('deductGold(h.entity, row.price);', at));
    const gold = part.indexOf('totalGoldAmount(h.entity) < row.price'), order = part.indexOf('tavernOrder(s, now, row, { endurance, rules })');
    assert.ok(at > 0 && gold > 0 && order > gold, `${file}: the gold, then the house, then the coin`);
  }
});

test('SURV-TIERS: the enhanced tavern, driven - the same refusals before the coin as the classic window, and the menu stays up for what the house will serve', () => {
  const run = (tier, pickName, extra = {}) => {
    _resetForTests(); if (tier !== undefined) setPref(SURVIVAL_PREF, tier);
    const hadLoc = Object.hasOwn(globalThis, 'location'), loc = globalThis.location;
    globalThis.location = { search: '?skin=classic' };   // the CARD arm: the said line lands in the document (AUDIT ENH-NOTICE3 B19)
    try {
      return withDom((dom) => {
        const entity = guest(extra); const passed = [];
        const host = dom.mk('div'); dom.body.append(host);
        const view = mountEnhancedTavern(host, { entity, ...tavernHooks(passed), onExit: () => {} });
        const text = (n) => (n.textContent || '') + n.children.map(text).join(' ');
        dom.doc.querySelectorAll('.tavern-act').find((b) => b.textContent === 'Food & drink').onclick();
        const row = (name) => dom.doc.querySelectorAll('.tavern-row').find((r) => text(r).includes(name));
        assert.ok(row(pickName), `the menu offers ${pickName}`);
        row(pickName).onclick();
        const said = dom.doc.querySelectorAll('.px-note').map((n) => n.textContent);
        const out = { gold: entity.goldPieces, passed: [...passed], drunk: entity.survival.drunk, said, menuUp: !!row('Cows Milk') };
        view?.unmount?.();
        return out;
      });
    } finally {
      if (hadLoc) globalThis.location = loc; else delete globalThis.location;
      _resetForTests();
    }
  };
  const c = run(undefined, 'Rye Liquor');
  assert.deepEqual([c.gold, c.passed, c.drunk], [100, [], 45], 'Casual: refused before the coin - nothing charged, no time, nothing poured');
  assert.ok(c.said.includes(TAVERN_MENU_TEXT.cutOff), 'and the barkeep says why');
  assert.equal(c.menuUp, true, 'the menu stays up - a lighter drink still serves');
  const h = run('hard', 'Rye Liquor');
  assert.ok(h.gold < 100 && h.passed.length === 2, `Hard: poured, and the night taken (${JSON.stringify(h.passed)})`);
  const mealName = tavernMenu({ climateIndex: 232, quality: 10, hour: 23 }).rows[TAVERN_MEAL].name;
  const full = run(undefined, mealName, { survival: { ...newSurvival(TAVERN_NOW), lastAte: TAVERN_NOW - 10 } });
  assert.deepEqual([full.gold, full.passed], [100, []], 'Casual: a full stomach buys nothing');
  assert.ok(full.said.includes(TAVERN_MENU_TEXT.fullForMeal), 'and hears why');
  const hardFull = run('hard', mealName, { survival: { ...newSurvival(TAVERN_NOW), lastAte: TAVERN_NOW - 10 } });
  assert.ok(hardFull.gold < 100 && hardFull.said.includes(TAVERN_MENU_TEXT.tooFull), 'Hard: charged for the waste');
});

test('SURV-TIERS: composed - the feed hands the live tier\'s rules, and a Casual ticker in a blizzard for ten hours takes no health and no attribute while a Hard one does', () => {
  const tickerPlayer = () => ({
    isPlayer: true, level: 1, health: 40, maxHealth: 40, magicka: 0, maxMagicka: 20, fatigue: 6400, raceId: RACES.Breton,
    stats: { ...STATS }, skills: 20, career: {}, skillUses: { [SKILLS.Medical]: 0 }, activeEffects: [], items: [],
    equip: { slots: new Array(27).fill(null) },
  });
  _resetForTests(); clearPreventRestConditions();
  assert.equal(survivalFeed(tickerPlayer(), BLIZZARD).deps.rules, CASUAL, 'the default tier rides the feed');
  const run = (tier) => {
    _resetForTests(); setPref(SURVIVAL_PREF, tier); setWorldMinutes(3 * 1440 + 2 * 60);
    const p = tickerPlayer();
    createPlayerTicker(p, { say: () => {}, isInside: () => false, survivalEnv: () => BLIZZARD }).advance(600);
    clearPreventRestConditions();
    return p;
  };
  const c = run('casual');
  assert.equal(c.health, 40, 'Casual: the blizzard took no health');
  assert.equal(c.activeEffects.some((a) => a.kind === 'survival'), false);
  const h = run('hard');
  assert.ok(h.health < 40, 'Hard: it did');
  assert.ok(Object.values(h.activeEffects.find((a) => a.kind === 'survival')?.statMods ?? {}).some((v) => v < 0), 'Hard: and the cold cost attributes');   // AUDIT SURV-TIERS (the third pass): the title's half the pin had not asserted
  assert.equal(survivalFeed(tickerPlayer(), BLIZZARD).deps.rules, HARD);
  _resetForTests(); setPref(SURVIVAL_PREF, false);
  assert.equal(survivalFeed(tickerPlayer(), BLIZZARD), null, 'Off feeds nothing');
  _resetForTests(); setWorldMinutes(0);
  // the composition points hand the tier - by source
  assert.match(read('src/systems/survival/env.js'), /const deps = \{ worn: entity\.equip\?\.slots \?\? null, ctx: survivalCtx\(entity, full\), rules \};/);
  assert.match(read('src/scenes/hunting.js'), /huntOutcome\(ev, \{ hasBow: !!now\.hasBow, skills: now\.skills \?\? \{\}, luck: now\.luck \?\? 50, rolls, rules: survivalRules\(\) \?\? undefined \}\);/);
  assert.match(read('src/scenes/shared.js'), /stiffen\(entity, worldMinutes\(\), REST_KIND\.Rough, _rules\)/);
});

// ═══ AUDIT SURV-TIERS: THE LAWS HARD SHARES ══════════════════════════
// Four findings of the audit were never the tiers' - they were the arc's,
// and Hard had carried them since SURV1-7. Fixed where they live, pinned
// here beside the slice that found them.

test('AUDIT SURV-TIERS: the hour is its hour - 15:30 is the afternoon, not the small hours, in every climate', () => {
  for (const climate of Object.values(CLIMATES)) for (let q = -8; q < 104; q++) {
    const hour = q / 4;
    assert.equal(hourTemperature(hour, climate), hourTemperature(Math.floor(hour), climate), `${hour} at ${climate}`);
  }
  assert.equal(hourTemperature(15.5, CLIMATES.Mountain), 0, '15:30 is the afternoon band (it fell through every band to the night\'s -20)');
  assert.equal(hourTemperature(-1, CLIMATES.Mountain), hourTemperature(23, CLIMATES.Mountain), 'the wrap holds below');
  assert.equal(hourTemperature(25.5, CLIMATES.Mountain), hourTemperature(1, CLIMATES.Mountain), '...and above');
  assert.equal(hourTemperature(undefined, CLIMATES.Mountain), 0, 'no hour is noon');
});

test('AUDIT SURV-TIERS: FIVE LIVE - the needs\' and the drink\'s drain leaves the stat as it stands at five or more, so a tavern ale cannot kill; the drink reads the live endurance', () => {
  // a Drain Agility spell holds the live stat at four: the drink may take nothing more - it took the live stat to
  // zero, and a live zero kills (worldTick.js killIfAnyLiveStatZero)
  const e = body({ stats: { ...STATS, agility: 9 } });
  e.activeEffects.push({ kind: 'drainAttribute', stat: 'agility', magnitude: 5 });
  applySurvivalMods(e, { agility: -7 });
  assert.equal(liveStat(e, 'agility'), 4, 'no further than it stood');
  assert.equal(e.activeEffects.some((a) => a.kind === 'survival'), false, 'and the entry holds nothing the stat cannot pay (the read caps it too - the entry is capped where it is written)');
  applySurvivalMods(e, { agility: -7 }); applySurvivalMods(e, { agility: -7 });
  assert.equal(liveStat(e, 'agility'), 4, 'minute after minute');
  // the cap reads the stat WITHOUT its own entry - read with it, the drain would lift itself off every other minute
  const plain = body({ stats: { ...STATS, agility: 20 } });
  for (let i = 1; i <= 3; i++) { applySurvivalMods(plain, { agility: -40 }); assert.equal(liveStat(plain, 'agility'), 5, `minute ${i}: five, and five again`); }
  // a fortified stat drains no further than its permanent one allows, and the fortify stands on top
  const f = body({ stats: { ...STATS, agility: 20 } });
  f.activeEffects.push({ kind: 'fortifyAttribute', stat: 'agility', magnitude: 30 });
  applySurvivalMods(f, { agility: -40 });
  assert.equal(liveStat(f, 'agility'), 20 + 30 - 15, 'the permanent twenty drains to five');
  // the drink's bands on the LIVE endurance - the one the tavern, the HUD and the status page already read
  const d = body({ stats: { ...STATS, endurance: 80 } });
  d.activeEffects.push({ kind: 'drainAttribute', stat: 'endurance', magnitude: 40 });   // live forty
  Object.assign(survivalOf(d, 20001), { drunk: 40 });
  survivalMinute(d, 20001, INDOORS, minuteDeps(d, [], CASUAL));
  assert.equal(d.activeEffects.find((a) => a.kind === 'survival')?.statMods.agility, -2, 'forty drunk on a live forty is past half - the permanent eighty called it sober');
});

test('AUDIT SURV-TIERS: null is no rules - survivalRules() answers null for Off, and every law handed null runs Hard, as when handed nothing', () => {
  const e = body(); const log = [];
  Object.assign(survivalOf(e, 30000), { lastAte: 30000 - 1500 });   // starving; 30000 is a harm tick
  assert.doesNotThrow(() => survivalMinute(e, 30000, BLIZZARD, minuteDeps(e, log, null)), 'the minute law threw on `null.stamina`');
  assert.ok(log.some((l) => l[0] === 'hurt'), 'the blizzard wounds - Hard');
  assert.ok(e.activeEffects.some((a) => a.kind === 'survival'), 'and drains');
  assert.equal(e.survival.borrowed, undefined, 'and lends nothing');
  assert.ok(survivalStatMods({ ...newSurvival(0), sleepDebt: 13 }, null, 0, { rules: null }).strength < 0);
  assert.deepEqual(restCost('rough', null), HARD.roughRest);
  const st = sleeper(); assert.equal(stiffen(st, 0, 'rough', null), true);
  assert.equal(eatLaw(createSurvivalItem(TEMPLATE.RawMeat), { lastAte: 0, now: 5000, luck: 10, rolls: () => 0.99, rules: null }).sick, 'mild');
  assert.equal(tavernDrink({ ...newSurvival(0), drunk: 45 }, 35, { endurance: 50, rules: null }).blackout, true);
  const hunted = huntOutcome({ climate: Object.keys(HUNT_EVENTS)[0], kind: HUNT_EVENTS[Object.keys(HUNT_EVENTS)[0]][0] }, { rolls: seeded(3), rules: null });
  assert.deepEqual(hunted, huntOutcome({ climate: Object.keys(HUNT_EVENTS)[0], kind: HUNT_EVENTS[Object.keys(HUNT_EVENTS)[0]][0] }, { rolls: seeded(3) }));
});

test('AUDIT SURV-TIERS: Off\'s minutes are nobody\'s needs - a short Off span is paused whole, a long one is a fresh start (WORLD5\'s rule for an absence); a meal eaten Off is not moved twice; a gap the arc was ON for (WORLD5\'s short absence) still counts', async () => {
  const { pauseSurvival, hungerMinutes, awakeHours, ALIGN_GRACE_MINUTES } = await import('../src/systems/survival/needs.js');
  const { worldMinutes, setSharedClock } = await import('../src/systems/worldTick.js');
  const { snapshotPlayer, restorePlayer } = await import('../src/systems/save.js');
  // the law: both timestamps and the last paid minute carried by the span; no record, no record made
  const s = { ...newSurvival(1000), lastAte: 900, awakeSince: 940, lastMinute: 1000, thirst: 70, wet: 150, drunk: 30, exposure: 200 };
  assert.equal(pauseSurvival({ survival: s }, 1000, 1060), true);
  // AUDIT SURV-TIERS (the third pass): the NEEDS stand; the world's own decays run - the drink one off every ten
  // minutes, the wet a minute, the exposure cooling at two - as they had not (twenty hours Off came back Very drunk)
  assert.deepEqual([s.lastAte, s.awakeSince, s.lastMinute, s.thirst, s.wet, s.drunk, s.exposure], [960, 1000, 1060, 70, 90, 24, 80], 'an hour Off: the needs stand where they were, the drink and the wet wear off');
  assert.equal(pauseSurvival({ survival: s }, 1060, 1600), true);
  assert.deepEqual([s.lastAte, s.awakeSince, s.lastMinute, s.thirst, s.wet, s.drunk, s.exposure], [1500, 1540, 1600, 70, 0, 0, 0], 'ten hours Off: the needs stand where they were, and the body is sober and dry');
  assert.equal(pauseSurvival({ survival: s }, 1600, 1600), false, 'no span, no move');
  const long = { survival: s };
  pauseSurvival(long, 1600, 1600 + ALIGN_GRACE_MINUTES);
  assert.deepEqual([long.survival.thirst, long.survival.wet, long.survival.drunk, long.survival.sleepDebt, hungerMinutes(long.survival, 1600 + ALIGN_GRACE_MINUTES)], [0, 0, 0, 0, 10],
    'past a day Off the body has lived the classic game\'s days - fed, watered, rested, dry and sober (five days had come back Drenched and Very drunk)');
  const bare = {}; assert.equal(pauseSurvival(bare, 0, 100), false); assert.equal(bare.survival, undefined, 'a player with no record is given none');
  // composed, through the world tick: twelve hours Off, a loaf eaten an hour before the arc comes back, then on again
  const ENV = { ...INDOORS };
  const walker = () => ({ ...body(), isPlayer: true, name: 'P', level: 3, magicka: 10, maxMagicka: 20, skills: [20], career: {}, skillUses: new Array(35).fill(0), spells: [], equip: { slots: new Array(27).fill(null) }, chargenDone: true });
  for (const tier of ['casual', 'hard']) {
    _resetForTests(); setPref(SURVIVAL_PREF, tier); setWorldMinutes(50 * 1440 + 12 * 60);
    const e = walker(); e.items = [createSurvivalItem(TEMPLATE.Bread)];
    const t = createPlayerTicker(e, { say: () => {}, isInside: () => true, survivalEnv: () => ENV });
    t.tick(25);
    const before = { hunger: hungerMinutes(e.survival, Math.floor(worldMinutes())), awake: awakeHours(e.survival, Math.floor(worldMinutes())) };
    setPref(SURVIVAL_PREF, false);
    t.advance(12 * 60 - 60);
    assert.deepEqual([hungerMinutes(e.survival, Math.floor(worldMinutes())), awakeHours(e.survival, Math.floor(worldMinutes()))], [before.hunger, before.awake], `${tier}: eleven hours Off - the needs stand where they were`);
    useItem(e.items[0], e.items, { entity: e, nowMinute: Math.floor(worldMinutes()), rolls: () => 0.99 });
    const fed = hungerMinutes(e.survival, Math.floor(worldMinutes()));
    t.advance(60);
    setPref(SURVIVAL_PREF, tier);
    t.tick(5);
    const now = Math.floor(worldMinutes());
    assert.ok(e.survival.lastAte <= now, `${tier}: the meal's marker is not in the future (the first cut moved it ahead by the whole span Off)`);
    assert.ok(hungerMinutes(e.survival, now) - fed <= 6, `${tier}: the hour Off after the meal was paused too - only the minutes back on count (${hungerMinutes(e.survival, now) - fed})`);
    assert.equal(e.activeEffects.some((a) => a.kind === 'survival'), false, `${tier}: nothing drained`);
    assert.equal(e.survival.offFor, undefined, `${tier}: the Off span ends when the arc is on again`);
  }
  // a host with NO reader while the arc is ON is not Off: its minutes keep WORLD5's clocks (the timestamps run)
  _resetForTests(); setWorldMinutes(90 * 1440);
  const nr = walker(); Object.assign(survivalOf(nr, 90 * 1440), { lastAte: 90 * 1440 - 100, lastMinute: 90 * 1440 });
  createPlayerTicker(nr, { say: () => {}, isInside: () => true, survivalEnv: () => null }).advance(480);
  assert.equal(hungerMinutes(nr.survival, Math.floor(worldMinutes())), 100 + 480, 'eight hours with no reader, the arc on: eight hours hungrier');
  // WORLD5: an online load within the day - alignSurvival keeps the markers and the world tick moves the entity's
  // clock to now, so the absence is a gap the arc was ON for; it is charged, as it always was ("an hour away keeps its
  // hunger"). The first cut inferred Off from ANY gap and forgave it in every tier.
  _resetForTests(); setPref(SURVIVAL_PREF, 'hard');
  const S = 100 * 1440 + 8 * 60;
  const e = walker(); e.lastGameMinutes = S;
  e.survival = { ...newSurvival(S), lastAte: S - 300, awakeSince: S - 900, lastMinute: S };
  const snap = JSON.parse(JSON.stringify(snapshotPlayer(e, { classicMinutes: S })));
  let clock = S + 720;
  setSharedClock(() => clock);
  try {
    const r = walker(); restorePlayer(r, snap, null);
    const t = createPlayerTicker(r, { say: () => {}, isInside: () => true, survivalEnv: () => ENV });
    clock += 5; t.tick(0);
    assert.equal(Math.floor(clock) - r.survival.lastAte, 300 + 720 + 5, 'twelve hours away are twelve hours hungrier');
  } finally { setSharedClock(null); _resetForTests(); setWorldMinutes(0); }
});

test('AUDIT SURV-TIERS (the second pass): the loan is never more than the pool is short - a bed, a potion or the fed hour that refills the pool settles it, so a starving sleeper does not bank a pool of stamina to eat mid-fight', () => {
  let now = 60001;
  const run = (settle) => {
    const e = body(); const log = [];
    const s = survivalOf(e, now); Object.assign(s, { lastAte: now - 1500, thirst: 0 });
    let t = now;
    for (let i = 0; i < 60; i++, t++) survivalMinute(e, t, INDOORS, minuteDeps(e, log, CASUAL));
    assert.deepEqual({ ...s.borrowed }, { hunger: 240 }, 'an hour starving: two hundred and forty lent');
    settle(e);   // the pool refilled by something that is not a meal
    survivalMinute(e, t, INDOORS, minuteDeps(e, log, CASUAL)); t++;
    const owed = { ...(s.borrowed ?? {}) };
    s.lastAte = t;   // and then the meal
    log.length = 0;
    survivalMinute(e, t, INDOORS, minuteDeps(e, log, CASUAL));
    return { owed, back: restores(log).reduce((a, l) => a + l[1], 0), fatigue: e.fatigue };
  };
  const bed = run((e) => { e.fatigue = 6400; });
  assert.deepEqual(bed.owed, { hunger: DRAIN.starving }, 'a full pool settles the whole loan; the next starving minute lends four more');
  assert.equal(bed.back, DRAIN.starving, 'so the meal repays four, not the night the bed already paid');
  assert.equal(bed.fatigue, 6400);
  const half = run((e) => { e.fatigue += 100; });
  assert.deepEqual(half.owed, { hunger: 240 - 100 + DRAIN.starving }, 'a hundred back from elsewhere settles a hundred of it');
  // two needs share the cut in proportion
  const e = body(); const s = survivalOf(e, now); Object.assign(s, { lastAte: now - 1500, thirst: 110, borrowed: { hunger: 300, thirst: 100 } }); e.fatigue = 6400 - 200;
  survivalMinute(e, now, INDOORS, minuteDeps(e, [], CASUAL));
  assert.deepEqual({ ...s.borrowed }, { hunger: 150 + DRAIN.starving, thirst: 50 + DRAIN.dehydrated }, 'four hundred owed on a pool two hundred short: each cut by half, then the minute\'s own charges');
  // through a real night: DFU's hour refills the pool while the need is unmet, and the loan follows it down
  _resetForTests(); setWorldMinutes(now);
  const sl = { ...sleeper(), fatigue: 3000, items: [], raceId: RACES.Breton };
  Object.assign(survivalOf(sl, now), { lastAte: now - 1500, borrowed: { hunger: 3000 } });
  const d = createRestDeps(sl, { advanceMinutes: () => {}, restKind: () => 'bed', day: () => false, inside: () => true });
  d.setResting(true);
  for (let h = 0; h < 8; h++) { d.tickVitals(); survivalMinute(sl, now + 60 * (h + 1), { ...INDOORS, resting: true, sleeping: 'bed' }, minuteDeps(sl, [], CASUAL)); }
  d.setResting(false);
  const pool = (sl.stats.strength + sl.stats.endurance) * 64;
  assert.ok(Object.values(sl.survival.borrowed ?? {}).reduce((a, b) => a + b, 0) <= pool - sl.fatigue, 'after the night the loan is no more than the pool is short');
  _resetForTests(); setWorldMinutes(0);
});

test('AUDIT SURV-TIERS (the second pass): in Casual a lit fire answers the cold - no charge beside it and the cold\'s loan repaid, in a snowstorm too; Hard\'s fire is its fifteen degrees, as it was', () => {
  const SNOW = { ...BLIZZARD };
  for (const [rules, answered] of [[CASUAL, true], [HARD, false]]) {
    const e = body(); const log = [];
    let t = 70001;
    survivalOf(e, t);
    for (let i = 0; i < 5; i++, t++) survivalMinute(e, t, SNOW, minuteDeps(e, log, rules));
    const charged = drains(log);
    assert.ok(charged > 0, `${rules.id}: the storm charges`);
    log.length = 0;
    const temp = survivalMinute(e, t, { ...SNOW, byFire: true }, minuteDeps(e, log, rules));
    assert.ok(temp.felt <= CASUAL.stamina.coldFrom, `${rules.id}: beside the fire it is still Deadly cold on the strip - the world's reading (${temp.felt})`);
    assert.equal(drains(log) === 0, answered, `${rules.id}: ${answered ? 'no charge beside the fire' : 'still charged, awake beside it'}`);
    if (answered) assert.deepEqual([e.survival.borrowed, restores(log).reduce((a, l) => a + l[1], 0)], [undefined, charged], 'and what the storm lent comes back');
  }
  // a fire warms; it does not cool - Casual beside one in a scorching noon is charged the heat as ever
  const hot = body(); const hlog = [];
  survivalOf(hot, 80001);
  const felt = survivalMinute(hot, 80001, { climateIndex: CLIMATES.Desert2, month: 6, hour: 13, weather: 'sunny', inSunlight: true, byFire: true }, minuteDeps(hot, hlog, CASUAL, { worn: null })).felt;
  assert.ok(felt >= CASUAL.stamina.hotFrom && drains(hlog) > 0, `the heat beside a fire still charges (felt ${felt})`);
});

test('AUDIT SURV-TIERS (the second pass): a jump cannot kill with the heat or the cold - a replayed minute wounds to the floor and no further (SURV-THIRST1\'s law); the minute the player stands in still can', () => {
  const DESERT = { climateIndex: CLIMATES.Desert2, month: 6, hour: 13, weather: 'sunny', inSunlight: true };
  const e = body({ health: 30, maxHealth: 30 }); const log = [];
  Object.assign(survivalOf(e, 0), { lastMinute: 0 });
  runSurvivalMinutes(e, 0, 185, DESERT, { ...minuteDeps(e, log, HARD), worn: null });   // arriving off a harm tick
  const hurt = log.filter((l) => l[0] === 'hurt').length;
  assert.ok(hurt > 5, `the desert wounds through the jump (${hurt} bites)`);
  assert.equal(e.health, HEALTH_FLOOR, 'three hours of a summer desert replayed: at death\'s door, not dead (it was 0 - the heat\'s bites had no floor)');
  // the live minute is not floored: at the floor, the next harm tick in the heat still takes its bite
  const live = body({ health: 5, maxHealth: 30 }); const l2 = [];
  survivalMinute(live, 600, DESERT, minuteDeps(live, l2, HARD, { worn: null }));
  assert.ok(l2.some((l) => l[0] === 'hurt'), 'the minute the player stands in wounds past the floor');
});

test('AUDIT SURV-TIERS (the second pass): the needs\' drain is capped where the stat is READ - an ale, then a Drain between two minutes, cannot make a live zero', () => {
  const e = body({ stats: { ...STATS, agility: 7 } });
  applySurvivalMods(e, { agility: -2 });   // the drink's swing, capped at the minute: live 5
  assert.equal(liveStat(e, 'agility'), 5);
  e.activeEffects.push({ kind: 'drainAttribute', stat: 'agility', magnitude: 5 });   // a Drain lands before the next minute
  assert.equal(liveStat(e, 'agility'), 2, 'the drain takes its five; the drink\'s two is held off - not a live zero');
  assert.equal(liveStat(e, 'agility', 'survival'), 2, 'and the stat without the entry is the same two');
  e.activeEffects.pop();
  assert.equal(liveStat(e, 'agility'), 5, 'the Drain gone, the drink\'s swing is back');
});

test('AUDIT SURV-TIERS (the second pass): a tent used from the WAGON leaves the wagon - both inventory windows hand the list it came from and every host places off it (one tent had pitched from the wagon and packed into the pack, a new tent a time)', async () => {
  const { NativeInventoryWindow } = await import('../src/ui/nativeInventory.js');
  const { createCamps } = await import('../src/scenes/camps.js');
  _resetForTests(); setWorldMinutes(100);
  const entity = { isPlayer: true, items: [], wagonItems: [createSurvivalItem(TEMPLATE.CampingEquipment)], activeEffects: [], stats: { luck: 50 }, spells: [] };
  let menu = null;
  const pool = createCamps({ entity, camera: () => ({ feet: [0, 0, 0], yaw: 0 }), collider: () => ({ surfaceHit: () => ({ dist: 0.5 }) }), place: () => ({}), say: () => {}, selfId: () => 'me', showOverlay: (w) => { menu = w; } });
  const w = new NativeInventoryWindow({
    items: () => entity.items, entity, wagonItems: () => entity.wagonItems, nowMinute: () => 100, dungeon: { wagonPrompt: true },
    placeCamp: (item, list) => pool.placeItem(item, list ?? entity.items ?? []),   // the hosts' hook, as the three of them now read
  });
  assert.equal(w.usingWagon, true, 'the window is on the wagon');
  w._pickRemote(0, 'use');
  assert.deepEqual([entity.wagonItems.length, entity.items.length, pool.camps.length], [0, 0, 1], 'pitched: the tent left the wagon');
  pool.activate(`camp:${pool.camps[0].rec.id}`, 'grab');
  menu.onPick(menu.items.findIndex((t) => /pack/i.test(t)));
  assert.deepEqual([entity.wagonItems.length, entity.items.length], [0, 1], 'packed: one tent, in the pack');
  for (const f of ['src/scenes/world.js', 'src/scenes/exterior.js', 'src/scenes/dungeonContext.js']) {
    assert.match(read(f), /placeCamp: \(item, list\) => camps\.placeItem\(item, list \?\? playerEntity\.items \?\? \[\]\),/, `${f}: off the list the item was used from`);
  }
  assert.match(read('src/ui/enhancedInventory.js'), /place\(act\.item, collection\);/, 'the enhanced window hands its list too');
  _resetForTests(); setWorldMinutes(0);
});

test('AUDIT SURV-TIERS (the second pass): a party rest mirrored in a DUNGEON pays its night - the mirror runs on the outer host\'s ticker while its window holds the dungeon\'s frame, and that ticker now reads the dungeon\'s needs while the player rests (it read none: the follower woke Exhausted)', () => {
  // the composition as world.js and exterior.js now read it: underground, the dungeon's reader while resting, else none
  for (const f of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    assert.match(read(f), /survivalEnv: \(\) => \(_mode\(\) === 'dungeon' \? \(playerEntity\.isResting \? modes\?\.dungeonCtx\?\.survivalEnvNow\?\.\(\) \?\? null : null\) : survivalEnvNow\(\)\),/, f);
  }
  assert.match(read('src/scenes/dungeonContext.js'), /\n {4}survivalEnvNow, {3}\/\/ AUDIT SURV-TIERS/, 'the dungeon hands its reader out');
  // ...and what it buys, through the real ticker and the real rest deps: an Exhausted follower mirrors a leader's bed
  for (const tier of ['casual', 'hard']) {
    _resetForTests(); setPref(SURVIVAL_PREF, tier);
    const T0 = 60 * 1440 + 22 * 60; setWorldMinutes(T0);
    const e = { ...sleeper(), health: 30, fatigue: 6400, raceId: RACES.Breton, items: [], skills: [20], skillUses: new Array(35).fill(0), equip: { slots: new Array(27).fill(null) } };
    const dungeonEnv = () => ({ ...INDOORS, insideBuilding: false, insideDungeon: true, resting: !!e.isResting, sleeping: e.isResting && !e.isLoitering ? (e.restKind ?? 'rough') : null });
    const ticker = createPlayerTicker(e, { say: () => {}, isInside: () => true, survivalEnv: () => (e.isResting ? dungeonEnv() : null) });
    Object.assign(survivalOf(e, T0), { lastAte: T0 - 600, awakeSince: T0 - 20 * 60, sleepDebt: 13, lastMinute: T0 });   // the dungeon's own frame had paid up to here
    const deps = createRestDeps(e, { restKind: () => 'rough', advanceMinutes: (n) => ticker.advance(n), day: () => false, inside: () => true });
    deps.overrideRestKind(() => 'bed');   // the leader's broadcast kind (PARTY-REST4b)
    deps.setResting(true);
    for (let h = 0; h < 8; h++) { ticker.advance(60); deps.tickVitals(); }
    deps.setResting(false);
    assert.ok(e.survival.sleepDebt < NEED.SLEEP_TIRED, `${tier}: the night paid the sleep (${e.survival.sleepDebt.toFixed(2)})`);
    assert.equal(Math.floor(e.survival.awakeSince) >= T0 + 7 * 60, true, `${tier}: and woke the follower`);
  }
});

test('AUDIT SURV-TIERS (the second pass): before six the enhanced tavern says the kitchen is shut and still pours - as the classic window does (it said the words and served nothing)', () => {
  const early = 1440 * 10 + 3 * 60;
  const hadLoc = Object.hasOwn(globalThis, 'location'), loc = globalThis.location;
  globalThis.location = { search: '?skin=classic' };
  try {
    withDom((dom) => {
      const entity = guest({ survival: { ...newSurvival(early), drunk: 0 } }); const passed = [];
      const host = dom.mk('div'); dom.body.append(host);
      const view = mountEnhancedTavern(host, { entity, ...tavernHooks(passed, early), onExit: () => {} });
      const text = (n) => (n.textContent || '') + n.children.map(text).join(' ');
      dom.doc.querySelectorAll('.tavern-act').find((b) => b.textContent === 'Food & drink').onclick();
      assert.ok(dom.doc.querySelectorAll('.px-note').some((n) => n.textContent === TAVERN_MENU_TEXT.closedNight), 'the kitchen\'s words');
      const rows = dom.doc.querySelectorAll('.tavern-row');
      assert.ok(rows.length > 0 && rows.every((r) => !tavernMenu({ climateIndex: 232, quality: 10, hour: 12 }).rows.some((m) => m.kind === 'food' && text(r).includes(m.name))), 'the drinks alone');
      rows.find((r) => text(r).includes('Cows Milk')).onclick();
      assert.deepEqual([entity.goldPieces < 100, passed], [true, [DRINK_MINUTES]], 'and a drink pours');
      view?.unmount?.();
    });
  } finally { if (hadLoc) globalThis.location = loc; else delete globalThis.location; }
});

// ═══ SURV-OFFSIGHT (2026-09-23): OFF SEES OTHER PEOPLE'S CAMPFIRES ═══
//
// Mac: "No, not off.. theres no reason to have it in off, really only
// being able to see other people's campfires makes sense". Off kept every
// camp and hid all of them from this player (AUDIT SURV-TIERS); its eyes
// see another player's now - the flame, its light, the tent - and nothing
// of any camp is its to use. Its own, stood while the arc was on, stay out
// of sight with the rest of the arc.
test('SURV-OFFSIGHT: Off sees another player\'s camp - the flame, its light, the tent, and (the third pass) the ray, its name and a look - and uses none of it; its own stay out of sight; on, every camp is seen and used', async () => {
  const { createCamps, FIRE_LIGHT_UP } = await import('../src/scenes/camps.js');
  const { TENT_MODEL, FIRE_LIGHT_RANGE, CAMP_TEXT } = await import('../src/systems/survival/camp.js');
  setWorldMinutes(100);
  const renderer = { createBillboardBatch: (archive, record, size, positions) => ({ pos: positions[0] }), destroyBillboardBatch: () => {} };
  const said = [], menus = [];
  const pool = createCamps({
    renderer, getTexture: async () => ({ getFrameCount: () => 3, getSize: () => ({ width: 40, height: 40 }) }), uploadRecordFrame: () => {},
    meshes: { getGpuMesh: async () => ({ gpu: true }), cpuModels: new Map([[TENT_MODEL, { positions: [-1, 0, -1, 1, 2, 1] }]]) },
    entity: body(), camera: () => ({ feet: [0, 0, 0], yaw: 0 }), selfId: () => 'me', say: (l) => said.push(l), showOverlay: (w) => menus.push(w),
  });
  // mine, from a time the arc was on - pitched online under another tab's id (AUDIT SURV-TIERS, the third pass: mine is
  // the pool's word, so it is still mine here)
  pool.restore([{ id: 'pOLD:1:90', owner: 'pOLD', kind: 'tent', pos: [1, 0, 1], yaw: 0, litUntil: 500, wear: 0, placedAt: 0 }]);
  pool.applyOwner('peer', [{ i: 'p:1', k: 0, p: [20, 0, 20], y: 0, u: 500, w: 0 }]);   // a peer's tent and its fire
  await new Promise((r) => setTimeout(r, 0));   // the flame's frames and the tent's mesh are up
  const sight = () => ({
    flames: pool.batches().map((b) => b.pos),
    lights: pool.lights().map((l) => [l.x, l.y, l.z, l.range]),
    tents: (() => { let n = 0; pool.draw({ drawMesh: () => { n++; } }); return n; })(),
    targets: pool.targets().map((t) => t.key),
    names: [pool.hoverName('camp:pOLD:1:90'), pool.hoverName('camp:p:1')],
  });
  const use = () => {
    const before = menus.length;
    const clicked = [pool.activate('camp:pOLD:1:90', 'grab'), pool.activate('camp:p:1', 'grab')];
    return { warm: [pool.byFire([1, 0, 1]), pool.byFire([20, 0, 20])], clicked, menus: menus.length - before };
  };
  for (const tier of ['casual', 'hard']) {
    setPref(SURVIVAL_PREF, tier);
    assert.deepEqual(sight(), {
      flames: [[1, 0, 1], [20, 0, 20]], lights: [[1, FIRE_LIGHT_UP, 1, FIRE_LIGHT_RANGE], [20, FIRE_LIGHT_UP, 20, FIRE_LIGHT_RANGE]], tents: 2,
      targets: ['camp:pOLD:1:90', 'camp:pOLD:1:90', 'camp:p:1', 'camp:p:1'], names: [{ title: 'Camp' }, { title: 'Camp' }],
    }, `${tier}: every camp seen`);
    assert.deepEqual(use(), { warm: [true, true], clicked: [true, true], menus: 2 }, `${tier}: and used - warmth, and a menu on each`);
  }
  setPref(SURVIVAL_PREF, SURVIVAL_STORED[SURVIVAL_OFF]);
  assert.deepEqual(sight(), {
    flames: [[20, 0, 20]], lights: [[20, FIRE_LIGHT_UP, 20, FIRE_LIGHT_RANGE]], tents: 1,
    targets: ['camp:p:1', 'camp:p:1'], names: [null, { title: 'Camp' }],
  }, 'Off: the peer\'s flame, its light, its tent, the ray on it and its name - and none of this player\'s own');
  assert.deepEqual(use(), { warm: [false, false], clicked: [false, true], menus: 0 }, 'Off: no warmth, and the click the peer\'s camp takes opens nothing - seen, not used');
  said.length = 0;
  assert.deepEqual([pool.activate('camp:p:1', 'dialogue'), said], [true, [CAMP_TEXT.seeCamp]], 'a look says what it is');
  assert.equal(pool.fireNear([20, 0, 20]), true, 'the world still has the fire - the rest\'s place reads it (AUDIT SURV-TIERS)');
});

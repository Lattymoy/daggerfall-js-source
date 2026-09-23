import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  SURVIVAL_RULES, SURVIVAL_TIER_IDS, SURVIVAL_DEFAULT, SURVIVAL_OFF, HARD_RULES, rulesForTier, normalizeTier,
} from '../src/systems/survival/difficulty.js';
import { SURVIVAL_PREF, survivalTier, survivalOn, survivalRules } from '../src/systems/survival/switch.js';
import {
  NEED, DRAIN, newSurvival, survivalOf, survivalMinute, runSurvivalMinutes, survivalStatMods, SURVIVAL_TEXT,
} from '../src/systems/survival/needs.js';
import { temperatureWord } from '../src/systems/survival/temperature.js';
import { HUD_NEED_WORDS, survivalHudChips } from '../src/systems/survival/status.js';
import { REST_COST, REST_TEXT_SURVIVAL, STIFF_HOURS, restCost, restHour, stiffen } from '../src/systems/survival/rest.js';
import { survivalFeed, installSurvivalGate, survivalGateOn } from '../src/systems/survival/env.js';
import { TEMPLATE, FOOD, FOOD_STAGE, eatLaw } from '../src/systems/survival/food.js';
import { createSurvivalItem, useSurvivalItem } from '../src/systems/survival/items.js';
import { huntOutcome, HUNT_EVENTS, HUNT_SAFE_TWIN, HUNT_TEXT } from '../src/systems/survival/hunting.js';
import { tavernPour, tavernDrink, TAVERN_MENU_TEXT, DRINK_MINUTES } from '../src/systems/survival/tavernMenu.js';
import { intermittentEnemySpawn } from '../src/systems/encounters.js';
import { TavernWindow } from '../src/ui/tavernWindow.js';
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
// on what it costs - stamina only, red stages only, half the pool at
// most, nothing refused, nothing rolled against you. The per-law files
// (surv1-7, auditsurv) still pin Hard, because a law handed no rules
// runs it.

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
/** mulberry32 - a seeded stream, so both tiers can walk the SAME rolls. */
const seeded = (a) => () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

test('SURV-TIERS: one key, three tiers - the row, the table and the shelf agree; Casual is the default and every tier, Off included, is the player\'s online', () => {
  const row = FEATURES.find((f) => f.id === 'mod-climates-calories');
  const c = row.control;
  assert.equal(c.key, SURVIVAL_PREF);
  assert.deepEqual(c.tiers.map(([id]) => id), [...SURVIVAL_TIER_IDS], 'the bar\'s segments are the table\'s tiers, in order');
  assert.deepEqual(c.tiers.map(([, label]) => label), ['Off', 'Casual', 'Hard']);
  assert.equal(c.tiers[0][0], SURVIVAL_OFF, 'Off is the first segment - the tile reads a segment past the first as on');
  assert.equal(c.initial, SURVIVAL_DEFAULT); assert.equal(SURVIVAL_DEFAULT, 'casual');
  assert.equal(FEATURE_PREF_DEFAULTS.survival, 'casual', 'the shelf takes its default from the row (RF4)');
  assert.deepEqual(Object.keys(SURVIVAL_RULES), SURVIVAL_TIER_IDS.filter((t) => t !== SURVIVAL_OFF), 'every tier but Off has rules');
  // online: the player's, by name - "still let it be able to be turned off for online"
  assert.equal(c.online, 'player');
  assert.equal(onlineForcedPref(SURVIVAL_PREF, '?online=1'), undefined, 'the room forces no tier');
  assert.ok(ONLINE_PLAYERS_OWN_PREFS.includes(SURVIVAL_PREF));
  // a tier is a whole answer: both carry the same fields, frozen through
  const shape = (o) => Object.entries(o).map(([k, v]) => (v && typeof v === 'object' ? `${k}{${shape(v)}}` : k)).sort().join(',');
  assert.equal(shape(CASUAL), shape(HARD), 'no field one tier forgot');
  assert.ok(Object.isFrozen(CASUAL) && Object.isFrozen(CASUAL.stamina) && Object.isFrozen(HARD.roughRest), 'frozen through');
  // the reads
  assert.equal(rulesForTier('off'), null); assert.equal(rulesForTier('nonsense'), null);
  assert.equal(rulesForTier('casual'), CASUAL); assert.equal(rulesForTier('hard'), HARD);
  for (const v of [false, true, undefined, null, 3, 'Casual', {}]) assert.equal(normalizeTier(v), SURVIVAL_DEFAULT, `${String(v)} names no tier`);
  for (const t of SURVIVAL_TIER_IDS) assert.equal(normalizeTier(t), t);
  // and the leaf is a leaf
  assert.doesNotMatch(read('src/systems/survival/difficulty.js'), /^import /m, 'the table imports nothing - every law may read it without a cycle');
});

test('SURV-TIERS: the switch - on is anything but Off; the live rules are the tier\'s; a stored value that is no tier reads as the default, the rule the Features bar draws it by', () => {
  _resetForTests();
  assert.equal(survivalTier(), 'casual'); assert.equal(survivalOn(), true); assert.equal(survivalRules(), CASUAL);
  setPref(SURVIVAL_PREF, 'hard'); assert.equal(survivalTier(), 'hard'); assert.equal(survivalRules(), HARD); assert.equal(survivalOn(), true);
  setPref(SURVIVAL_PREF, 'off'); assert.equal(survivalTier(), 'off'); assert.equal(survivalOn(), false); assert.equal(survivalRules(), null);
  // BLOOD AUDIT 5's rule (ui/enhancedMenu.js tileStates): a value that is no tier shows as the default - so the laws
  // read it the same way, and the bar and the game can never disagree about which tier is live
  setPref(SURVIVAL_PREF, false); assert.equal(survivalTier(), 'casual', 'a raw boolean is no tier (the load converts the old one - below)');
  const menu = read('src/ui/enhancedMenu.js');
  assert.match(menu, /const fallback = Math\.max\(0, c\.tiers\.findIndex\(\(\[v\]\) => String\(v\) === String\(c\.default \?\? c\.initial\)\)\);/, 'the bar\'s own fallback is the row\'s default');
  _resetForTests();
});

test('SURV-TIERS: the old boolean converts once, at the shelf\'s load - a player who turned the arc off stays Off, everyone else moves to Casual, and the shelf then holds a tier', () => {
  const KEY = 'dagger.ui.v1';
  let store = new Map();
  const had = Object.hasOwn(globalThis, 'localStorage'), saved = globalThis.localStorage;
  globalThis.localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
  const withShelf = (blob) => { store = new Map([[KEY, JSON.stringify(blob)]]); _resetForTests(); loadPrefs(); };
  const shelf = () => JSON.parse(store.get(KEY) ?? '{}');
  try {
    withShelf({ survival: false });
    assert.equal(survivalTier(), 'off', 'the only boolean PREF1\'s shelf could have written was a player\'s Off');
    setPref('showFps', true);   // any write saves the shelf
    assert.equal(shelf().survival, 'off', 'written back as the tier');
    withShelf(shelf());
    assert.equal(survivalTier(), 'off', 'and it stays Off across every reload after');
    withShelf({});
    assert.equal(survivalTier(), 'casual', 'a player who never touched the switch stored nothing, and moves to Casual with the default');
    withShelf({ survival: true });
    assert.equal(survivalTier(), 'casual', 'a hand-written true names no tier');
    withShelf({ survival: 'hard' });
    assert.equal(survivalTier(), 'hard', 'a chosen tier is kept');
    setPref(SURVIVAL_PREF, 'casual');
    assert.equal(shelf().survival, undefined, 'choosing the default back stores nothing (PREF1: the default is not a choice)');
  } finally {
    if (had) globalThis.localStorage = saved; else delete globalThis.localStorage;
    _resetForTests();
  }
  assert.match(read('src/systems/uiPrefs.js'), /if \(p\.survival === false\) _prefs\.survival = SURVIVAL_OFF;\n\s+else if \(p\.survival === true\) _prefs\.survival = PREF_DEFAULTS\.survival;/);
});

test('SURV-TIERS: Hard is the arc as it stood - the rough rest, the drains, the band, no floor, every cost on; a law handed no rules runs it', () => {
  assert.equal(HARD_RULES, HARD);
  assert.deepEqual({ ...HARD.roughRest }, { recovery: 0.5, encounters: 2, stiffHours: STIFF_HOURS });
  assert.equal(REST_COST.rough, HARD.roughRest, 'rest.js prices the rough kind off the table - one source');
  assert.deepEqual({ ...HARD.stamina }, { floor: 0, hotFrom: 20, coldFrom: -20, bareFeet: true }, 'twenty either way - `abs >= 20`, as it was');
  for (const k of ['attributes', 'health', 'rust', 'sickness', 'huntHarms', 'restGate', 'blackout']) assert.equal(HARD[k], true, k);
  assert.equal(HARD.roughSleepFloor, 'tired');
  assert.deepEqual({ ...DRAIN }, { heatPer20: 6, starving: 4, parched: 6, dehydrated: 12, exhausted: 8, wellFed: 64, bareFeet: 4 }, 'the body\'s rates, unchanged');
  // the defaults
  assert.equal(restCost('rough'), HARD.roughRest); assert.equal(restCost('rough', null), HARD.roughRest, 'null is no rules too');
  assert.equal(restCost('bed', CASUAL), REST_COST.bed); assert.equal(restCost('camp', CASUAL), REST_COST.camp, 'a bed and a camp cost the same in every tier');
  const needs = read('src/systems/survival/needs.js');
  assert.match(needs, /rules = HARD_RULES \} = deps;/);
  assert.match(needs, /export function survivalStatMods\(s, temp, now, \{ endurance = 50, rules = HARD_RULES \} = \{\}\)/);
});

test('SURV-TIERS: Casual is five rules written out - stamina only, red stages only, half the pool at most, nothing refused, nothing rolled against you', () => {
  assert.deepEqual({ ...CASUAL.stamina }, { floor: 0.5, hotFrom: 51, coldFrom: -31, bareFeet: false });
  for (const k of ['attributes', 'health', 'rust', 'sickness', 'huntHarms', 'restGate', 'blackout']) assert.equal(CASUAL[k], false, k);
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
    const temp = survivalMinute(e, now, INDOORS, { sinks: sinksFor(e, log), autoDrink: false, autoEat: false, rules: CASUAL, rolls: () => 0.5, ctx: { raceId: RACES.Breton } });
    assert.equal(temperatureWord(temp.felt), 'comfortable', 'the room charges nothing');
    assert.equal(drains(log), rate ?? 0, `${need}:${stage} charges ${rate ?? 'nothing'} in Casual`);
    assert.equal(log.some((l) => l[0] === 'hurt'), false);
    assert.equal(e.activeEffects.some((a) => a.kind === 'survival'), false, `${need}:${stage} touches no attribute in Casual`);
  }
  // the temperature through the law: across climates, months, hours and weathers, a dressed body is charged exactly
  // when the felt word is red, by Hard's own formula - and Hard charges from twenty either way. Barefoot, Hard adds
  // its barefoot tax past half the endurance; Casual never does (the feet are no need, and have no chip)
  const clothes = { [S.ChestClothes]: { templateIndex: 158, group: 'MensClothing' }, [S.LegsClothes]: { templateIndex: 151, group: 'MensClothing' } };
  const shod = worn({ ...clothes, [S.Feet]: { templateIndex: 149, group: 'MensClothing' } }), barefoot = worn(clothes);
  let seenRed = 0, seenQuiet = 0, seenFeet = 0;
  for (const climateIndex of Object.values(CLIMATES)) for (const month of [0, 6]) for (const hour of [2, 12]) for (const weather of ['sunny', 'snow']) for (const feet of [shod, barefoot]) {
    for (const [rules, costs] of [[CASUAL, (f) => f >= 51 || f <= -31], [HARD, (f) => Math.abs(f) >= 20]]) {
      const e = body(); const log = [];
      survivalOf(e, now);
      const temp = survivalMinute(e, now, { climateIndex, month, hour, weather }, { worn: feet, sinks: sinksFor(e, log), autoDrink: false, autoEat: false, rules, rolls: () => 0.5, ctx: { raceId: RACES.Breton } });
      const tax = feet === barefoot && rules === HARD && temp.abs > STATS.endurance / 2 ? DRAIN.bareFeet : 0;
      const want = (costs(temp.felt) ? DRAIN.heatPer20 * Math.trunc(temp.abs / 20) : 0) + tax;
      assert.equal(drains(log), want, `${rules.id}: felt ${temp.felt} (${temperatureWord(temp.felt)}) at climate ${climateIndex}/${month}/${hour}/${weather}${feet === barefoot ? ', barefoot' : ''}`);
      if (rules === CASUAL) { if (want) seenRed++; else seenQuiet++; }
      if (tax) seenFeet++;
    }
  }
  assert.ok(seenRed > 0 && seenQuiet > 0 && seenFeet > 0, `the sweep saw both sides of the band and the bare feet (${seenRed} red, ${seenQuiet} quiet, ${seenFeet} barefoot taxes)`);
});

test('SURV-TIERS: THE WORST DAY - starving, dehydrated, exhausted, half naked, barefoot in a mountain blizzard in wet plate: Casual takes half the stamina and nothing else; Hard is what it always was', () => {
  const day = (rules) => {
    const e = body(); const log = [];
    e.items = [];   // no water, no rations
    const s = survivalOf(e, 0);
    Object.assign(s, { lastAte: -3000, thirst: NEED.THIRST_MAX, sleepDebt: 20, awakeSince: -2000, lastMinute: 0 });
    const cuirass = plate();
    runSurvivalMinutes(e, 0, 1440, BLIZZARD, { worn: worn({ [S.ChestArmor]: cuirass }), sinks: sinksFor(e, log), autoDrink: false, autoEat: false, rules, rolls: () => 0.01, ctx: { raceId: RACES.Breton } });
    return { e, log, cuirass, said: log.filter((l) => l[0] === 'say').map((l) => l[1]) };
  };
  const c = day(CASUAL);
  assert.equal(c.e.health, 40, 'Casual: not a point of health');
  assert.equal(c.log.some((l) => l[0] === 'hurt'), false, 'no wound was even asked for');
  assert.equal(c.e.activeEffects.some((a) => a.kind === 'survival'), false, 'no attribute moved');
  assert.equal(c.e.fatigue, 3200, 'the stamina came down to half the pool - and stopped there');
  assert.ok(drains(c.log) === 3200, 'exactly half was charged');
  assert.equal(c.cuirass.currentCondition, 100, 'the wet plate did not rust');
  for (const t of [SURVIVAL_TEXT.starving, SURVIVAL_TEXT.dehydrated, SURVIVAL_TEXT.exhausted, SURVIVAL_TEXT.deadly, SURVIVAL_TEXT.nakedCold, SURVIVAL_TEXT.bareFeetCold]) {
    assert.ok(c.said.includes(t), `Casual still says it: "${t}" - the world is the same world`);
  }
  const h = day(HARD);
  assert.ok(h.e.health < 40, 'Hard wounds');
  assert.ok(h.e.activeEffects.some((a) => a.kind === 'survival'), 'Hard drains the attributes');
  assert.ok(h.e.fatigue < 3200, 'Hard takes the stamina past half');
  assert.ok(h.cuirass.currentCondition < 100, 'Hard rusts');
  assert.deepEqual(h.said.filter((t) => c.said.includes(t)).length > 0, true);
});

test('SURV-TIERS: SAME WORLD - two players on the two tiers, the same night: every counter on the record is identical; only the bodies differ', () => {
  const run = (rules) => {
    const e = body();
    Object.assign(survivalOf(e, 0), { lastAte: -2000, thirst: 90, sleepDebt: 10, awakeSince: -1500, lastMinute: 0 });
    runSurvivalMinutes(e, 0, 720, { ...BLIZZARD, weather: 'rain', climateIndex: CLIMATES.Woodlands }, { worn: null, sinks: sinksFor(e), autoDrink: false, autoEat: false, rules, rolls: seeded(7), ctx: { raceId: RACES.Breton } });
    return e;
  };
  const c = run(CASUAL), h = run(HARD);
  assert.deepEqual(c.survival, h.survival, 'hunger, thirst, wet, sleep, exposure, the felt reading, the notes said - one world');
  assert.notEqual(c.health, h.health, 'what it cost is the tier\'s');
});

test('SURV-TIERS: the floor is ONE budget a minute, read after the fed hour\'s refund - two needs share it whatever the sink does; below it nothing is charged; Hard has none', () => {
  const now = 20001;
  const minute = (rules, fatigue, sinkWrites) => {
    const e = body({ fatigue }); const log = [];
    const s = survivalOf(e, now); s.lastAte = now - 1500; s.thirst = 110;   // starving (4) and dehydrated (12) in one minute
    const sinks = sinkWrites ? sinksFor(e, log) : { drainFatigue: (n) => log.push(['fatigue', n]), restoreFatigue: () => {}, hurt: () => {}, say: () => {} };
    survivalMinute(e, now, INDOORS, { sinks, autoDrink: false, autoEat: false, rules, rolls: () => 0.5, ctx: { raceId: RACES.Breton } });
    return log.filter((l) => l[0] === 'fatigue').map((l) => l[1]);
  };
  assert.deepEqual(minute(CASUAL, 3210, true), [4, 6], 'ten above the floor: the first need takes four, the second the six that are left');
  assert.deepEqual(minute(CASUAL, 3210, false), [4, 6], '...and the same with a sink that writes nothing back - the budget is the law\'s own');
  assert.deepEqual(minute(CASUAL, 3200, true), [], 'at the floor: nothing');
  assert.deepEqual(minute(CASUAL, 1000, true), [], 'below it (a sprint put it there): survival does not push it further');
  assert.deepEqual(minute(CASUAL, 6400, true), [4, 12], 'far above it: the whole charge');
  assert.deepEqual(minute(HARD, 10, true), [4, 12], 'Hard has no floor - the collapse is its cost (AUDIT-DEATH1)');
  // the floor scales with the pool: a stronger body keeps more
  const strong = body({ fatigue: 4000, stats: { ...STATS, strength: 80, endurance: 80 } });   // pool 10240, floor 5120
  const log = [];
  Object.assign(survivalOf(strong, now), { lastAte: now - 1500 });
  survivalMinute(strong, now, INDOORS, { sinks: sinksFor(strong, log), autoDrink: false, autoEat: false, rules: CASUAL, rolls: () => 0.5, ctx: { raceId: RACES.Breton } });
  assert.deepEqual(log.filter((l) => l[0] === 'fatigue'), [], 'half of a bigger pool is a higher floor');
  // the dead constant is gone and its truth is written down
  const needs = read('src/systems/survival/needs.js');
  assert.doesNotMatch(needs, /export const FLOOR_FATIGUE/, 'no constant that looks wired and is not');
  assert.match(needs, /budget \?\?= Math\.max\(0, \(entity\.fatigue \?\? 0\) - Math\.floor\(maxFatigue\(entity\) \* floorShare\)\);/);
});

test('SURV-TIERS: a Hard morning lifts the minute the player turns to Casual - no stiff chip, no stiff attributes; Hard keeps it', () => {
  const now = 30001;
  for (const [rules, stiff] of [[CASUAL, false], [HARD, true]]) {
    const e = body();
    const s = survivalOf(e, now); s.stiffUntil = now + STIFF_HOURS * 60;
    survivalMinute(e, now, INDOORS, { sinks: sinksFor(e), autoDrink: false, autoEat: false, rules, rolls: () => 0.5, ctx: { raceId: RACES.Breton } });
    assert.equal(survivalHudChips(e, now + 1).some((c) => c.key === 'stiff'), stiff, `${rules.id}: the chip`);
    assert.equal((survivalStatMods(e.survival, null, now + 1, { rules }).agility ?? 0) < 0, stiff, `${rules.id}: the attribute`);
  }
  // the drink's swing is every tier's - chosen at a bar, not a need left unmet
  const drunk = { ...newSurvival(0), drunk: 60 };
  assert.ok(survivalStatMods(drunk, null, 0, { endurance: 50, rules: CASUAL }).personality > 0);
  assert.ok(survivalStatMods(drunk, null, 0, { endurance: 50, rules: CASUAL }).agility < 0);
});

test('SURV-TIERS: the rest - a Casual rough night is DFU\'s whole hour with one ask and no morning, pays the debt down to nothing, and nothing refuses it; Hard\'s is as it was', () => {
  const sleeper = () => ({ isPlayer: true, level: 1, health: 10, maxHealth: 40, magicka: 0, maxMagicka: 20, fatigue: 0, stats: { ...STATS }, skills: 20, career: {}, skillUses: { [SKILLS.Medical]: 0 }, activeEffects: [] });
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
    runSurvivalMinutes(e, 0, 12 * 60, { ...INDOORS, resting: true, sleeping: 'rough' }, { sinks: sinksFor(e), autoDrink: false, autoEat: false, rules, rolls: () => 0.5, ctx: { raceId: RACES.Breton } });
    assert.equal(e.survival.sleepDebt, left, `${rules.id}: twelve rough hours from tired leave ${left}`);
  }
  // composed: the kind is still where you sleep; the tier prices it
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
  setPref(SURVIVAL_PREF, 'off');
  const o = sleeper();
  const doff = createRestDeps(o, { advanceMinutes: () => {}, restKind: () => 'rough', day: () => false, inside: () => true });
  doff.setResting(true); assert.equal(o.restKind, 'bed', 'Off: every rest is DFU\'s bed'); assert.equal(o.restAsks, 1);
  // the encounter law takes the COUNT: one ask is DFU's, two is the rough night's
  const ctx = { gameMinutes: 1440 * 3, inside: true, inDungeon: true, isResting: true, enemyAlertActive: true, dungeonType: 0, playerLevel: 5 };
  const seq = (vals) => { let i = 0; return () => vals[i++ % vals.length]; };
  assert.equal(intermittentEnemySpawn({ ...ctx, restAsks: 1 }, seq([0.9, 0.0, 0.5])), null, 'one ask, a miss');
  assert.ok(intermittentEnemySpawn({ ...ctx, restAsks: 2 }, seq([0.9, 0.0, 0.5])), 'the second ask lands');
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
  setPref(SURVIVAL_PREF, 'off');
  assert.equal(survivalGateOn(), false); assert.equal(getPreventedRestMessage(), null);
  clearPreventRestConditions(); _resetForTests();
});

test('SURV-TIERS: the meal - Casual makes no sickness roll at all (Hard\'s lucky branch, every time); spoiling is the world\'s and still halves the worth, and putrid still will not go down', () => {
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
});

test('SURV-TIERS: the tavern - Casual\'s barkeep will not pour the drink that would take the night, and says so before the coin changes hands; a soft drink always pours; Hard still blacks out', () => {
  const s = () => ({ ...newSurvival(0), drunk: 45 });
  assert.deepEqual(tavernPour(s(), 35, { endurance: 50, rules: CASUAL }), { ok: false, text: TAVERN_MENU_TEXT.cutOff });
  assert.deepEqual(tavernPour(s(), 0, { endurance: 50, rules: CASUAL }), { ok: true }, 'milk and tea always pour');
  assert.deepEqual(tavernPour(s(), 0, { endurance: 40, rules: CASUAL }), { ok: true },
    '...even to a player already past the endurance - a disease took ten of it since the last ale, and water is still water');
  assert.deepEqual(tavernPour(s(), 10, { endurance: 40, rules: CASUAL }), { ok: false, text: TAVERN_MENU_TEXT.cutOff }, 'the ale is not');
  assert.deepEqual(tavernPour({ ...newSurvival(0), drunk: 30 }, 10, { endurance: 50, rules: CASUAL }), { ok: true }, 'an ale that stays under the endurance pours');
  assert.deepEqual(tavernPour(s(), 35, { endurance: 50, rules: HARD }), { ok: true }, 'Hard pours: the blackout is its answer');
  assert.deepEqual(tavernPour(s(), 35), { ok: true }, 'no rules is Hard');
  const rec = s(); assert.equal(tavernDrink(rec, 35, { endurance: 50, rules: CASUAL }).blackout, false, 'and the drink law never blacks out Casual, even handed the drink');
  assert.equal(tavernDrink(s(), 35, { endurance: 50, rules: HARD }).blackout, true);
  // the window, end to end
  _resetForTests();
  const now = 1440 * 10 + 23 * 60;
  const entity = { name: 'Mac', goldPieces: 100, health: 20, maxHealth: 40, stats: { endurance: 50 }, rentedRooms: [], items: [], activeEffects: [], lastTimePlayerAteOrDrankAtTavern: 0, survival: { ...newSurvival(now), drunk: 45 } };
  const passed = [];
  const w = new TavernWindow({
    entity, rows: (id) => [{ text: `r${id}`, center: true }], now: () => now, mapId: () => 1, buildingKey: () => 2, buildingName: () => 'The Lamp',
    quality: () => 10, bedCount: () => 2, freeRooms: () => false, skills: () => ({ mercantile: 50, personality: 50 }),
    heal: () => {}, onTalk: () => {}, onClose: () => {}, rolls: () => 0.5,
    climateIndex: () => 232, advanceMinutes: (n) => passed.push(n), endurance: () => 50,
  });
  w._food();
  const picker = w.flow.top.picker;
  const rye = picker.findIndex((t) => /Rye Liquor/.test(t)), milk = picker.findIndex((t) => /Cows Milk/.test(t));
  assert.ok(rye > 0 && milk > 0);
  const out = w.flow.top.onPick(rye);
  assert.equal(out[0].rows[0].text, TAVERN_MENU_TEXT.cutOff);
  assert.equal(entity.goldPieces, 100, 'nothing charged'); assert.deepEqual(passed, [], 'no time passed'); assert.equal(entity.survival.drunk, 45, 'nothing poured');
  w._food();
  w.flow.top.onPick(milk);
  assert.equal(entity.goldPieces, 98, 'the milk is poured and paid for'); assert.deepEqual(passed, [DRINK_MINUTES]);
  // both windows ask the barkeep before the coin
  for (const [file, body0] of [['src/ui/tavernWindow.js', '_survivalFood()'], ['src/ui/enhancedTavern.js', 'function pickSurvival(']]) {
    const src = read(file); const at = src.indexOf(body0);
    const part = src.slice(at, src.indexOf('deductGold(h.entity, row.price);', at));
    assert.ok(at > 0 && part.includes('tavernPour(s, row.strength, { endurance, rules })'), `${file}: the pour is asked before the coin changes hands`);
  }
  _resetForTests();
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
  assert.equal(survivalFeed(tickerPlayer(), BLIZZARD).deps.rules, HARD);
  _resetForTests(); setWorldMinutes(0);
  // the composition points hand the tier - by source
  assert.match(read('src/systems/survival/env.js'), /const deps = \{ worn: entity\.equip\?\.slots \?\? null, ctx: survivalCtx\(entity, full\), rules \};/);
  assert.match(read('src/scenes/hunting.js'), /huntOutcome\(ev, \{ hasBow: !!now\.hasBow, skills: now\.skills \?\? \{\}, luck: now\.luck \?\? 50, rolls, rules: survivalRules\(\) \?\? undefined \}\);/);
  assert.match(read('src/scenes/shared.js'), /stiffen\(entity, worldMinutes\(\), REST_KIND\.Rough, _rules\)/);
});

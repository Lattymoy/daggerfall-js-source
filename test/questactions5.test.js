// Q5 - FOURTEEN GUARDS RETIRED, each pinned against its .cs on the
// questremainder harness: the five trigger conditions over live
// player/world reads, and the nine update actions through the
// machine's real task walk and the new host doors.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadQuestTables } from '../src/systems/quest/tables.js';
import { QuestMachine } from '../src/systems/quest/machine.js';
import { UnrestrainFoe, JournalNote, TrainPc, RunQuest } from '../src/systems/quest/actions.js';
import { SKILLS } from '../src/systems/skills.js';
import { SKILL_ADVANCEMENT_MULTIPLIER } from '../src/systems/advancement.js';
import { CRIMES } from '../src/systems/court.js';
import { FATIGUE_LOSS } from '../src/systems/statMods.js';

const VENDOR = join(dirname(fileURLToPath(import.meta.url)), '..', 'vendor', 'dfu-quests');
const read = (p) => readFileSync(p, 'utf8').replace(/^﻿/, '');
const sources = {};
for (const f of readdirSync(join(VENDOR, 'Tables'))) {
  if (f.endsWith('.txt')) sources[f.replace('.txt', '')] = read(join(VENDOR, 'Tables', f));
}
loadQuestTables(sources);

const mkEntity = () => ({
  isPlayer: true, level: 5, activeEffects: [],
  stats: { strength: 50, agility: 50, endurance: 50, speed: 50, willpower: 50, intelligence: 50, personality: 50, luck: 50 },
  skills: { [SKILLS.Climbing]: 42, [SKILLS.Etiquette]: 10 },
  skillUses: { [SKILLS.Climbing]: 0, [SKILLS.Etiquette]: 0 }, fatigue: 5000,
});

function makeMachine(overrides = {}) {
  const calls = [];
  const capture = (name) => (...args) => { calls.push([name, ...args]); };
  const world = {
    currentRegionIndex: () => 0,
    isPlayerInLocationRect: () => true,
    currentLocation: () => ({ loaded: true, mapTableData: { locationType: 0 } }),
    getFactionData: () => null,
    addNote: capture('addNote'),
    addNoteTokens: capture('addNoteTokens'),
    currentWeatherKey: () => world._weather,
    currentClimateIndex: () => world._climate,
    _weather: 'sunny', _climate: 231,
  };
  const entity = mkEntity();
  const m = new QuestMachine({
    nowSeconds: () => (overrides.nowMinutes ?? 0) * 60,
    world,
    playerEntity: entity,
    setPlayerCrime: capture('setPlayerCrime'),
    getGoldPieces: () => (m.pieces ?? 0),
    deductGoldPieces: (n) => { m.pieces -= n; calls.push(['deductGoldPieces', n]); },
    getGold: () => (m.money ?? 0),
    // AUDIT 39 #92: PayMoney's `money` arm gates on GetGoldAmount, a
    // seam of its own - getGold stays the bare GoldPieces read.
    getTotalGold: () => (m.money ?? 0),
    deductGold: (n) => { m.money -= n; calls.push(['deductGold', n]); },
    raiseTime: capture('raiseTime'),
    spawnCityGuards: capture('spawnCityGuards'),
    makeEnemiesHostile: capture('makeEnemiesHostile'),
    clearEnemies: capture('clearEnemies'),
    showPopup: capture('showPopup'),
    ...overrides.deps,
  });
  m.world = world;
  m.entity = entity;
  m.calls = calls;
  m.of = (name) => calls.filter((c) => c[0] === name);
  return m;
}

const HEADER = ['Quest: __Q5', 'QRC:', 'Message:  1011', ' x', '', 'Message:  1004', ' done', '', 'QBN:'];
const schedule = (m, qbn) => m.scheduleQuest([...HEADER, ...qbn], 0, { rolls: () => 0.4 });
const trig = (q, name) => q.getTask({ name }).getTriggerValue();

test('Q5: WhenSkillLevel and WhenAttributeLevel read the LIVE values; unknown names THROW at parse', () => {
  const m = makeMachine();
  const q = schedule(m, [
    '_s_ task:', ' when skill Climbing is at least 40', '',
    '_s2_ task:', ' when skill Etiquette is at least 40', '',
    '_a_ task:', ' when attribute Strength is at least 50', '',
    '_a2_ task:', ' when attribute Luck is at least 51', '',
    'variable _pad_',
  ]);
  m.tick();
  assert.equal(trig(q, 's'), true, 'Climbing 42 >= 40');
  assert.equal(trig(q, 's2'), false, 'Etiquette 10 < 40');
  assert.equal(trig(q, 'a'), true, 'Strength 50 >= 50 - inclusive');
  assert.equal(trig(q, 'a2'), false, 'Luck 50 < 51');
  assert.throws(() => schedule(makeMachine(), ['_t_ task:', ' when skill Juggling is at least 1', '', 'variable _pad_']),
    /not a known Daggerfall skill/);
  assert.throws(() => schedule(makeMachine(), ['_t_ task:', ' when attribute Charm is at least 1', '', 'variable _pad_']),
    /not a known Daggerfall attribute/);
});

test('Q5: Season, Weather and Climate are ALWAYS-ON conditions that follow the world', () => {
  // day 0 year 0 is winter's Morning Star
  const m = makeMachine({ nowMinutes: 0 });
  const q = schedule(m, [
    '_w_ task:', ' season winter', '',
    '_su_ task:', ' season summer', '',
    '_r_ task:', ' weather rain', '',
    '_wo_ task:', ' climate woodlands', '',
    '_base_ task:', ' climate base temperate', '',
    '_des_ task:', ' climate base desert', '',
    'variable _pad_',
  ]);
  m.tick();
  assert.equal(trig(q, 'w'), true, 'Morning Star is winter');
  assert.equal(trig(q, 'su'), false);
  assert.equal(trig(q, 'r'), false, 'the sky is sunny');
  assert.equal(trig(q, 'wo'), true, 'climate 231 is woodlands');
  assert.equal(trig(q, 'base'), true, 'woodlands folds to temperate');
  assert.equal(trig(q, 'des'), false);
  m.world._weather = 'rain';
  m.world._climate = 224;
  m.tick();
  assert.equal(trig(q, 'r'), true, 'the weather trigger follows the live sky');
  assert.equal(trig(q, 'wo'), false, 'desert is not woodlands');
  assert.equal(trig(q, 'des'), true, '224 folds to the desert base');
});

test('Q5: SetPlayerCrime rides the ONE setter; an unknown crime THROWS at parse', () => {
  const m = makeMachine();
  schedule(m, [' setplayercrime Criminal_Conspiracy', '', 'variable _pad_']);
  m.tick();
  assert.deepEqual(m.of('setPlayerCrime')[0], ['setPlayerCrime', CRIMES.Criminal_Conspiracy],
    'the startup task fires the enum VALUE through the hook (V4\'s suppression gate rides the host side)');
  assert.throws(() => schedule(makeMachine(), [' setplayercrime Jaywalking', '', 'variable _pad_']),
    /not a known crime/);
});

test('Q5: PayMoney - `gold` counts COINS alone, `money` the purse; paid or not, the right task starts', () => {
  const PAY_TASKS = [
    '_paid_ task:', ' setvar _p2_', '',
    '_broke_ task:', ' setvar _b2_', '',
    'variable _p2_', 'variable _b2_',
  ];
  const m = makeMachine();
  m.pieces = 100; m.money = 500;
  const q = schedule(m, [' pay 80 gold do _paid_ otherwise do _broke_', '', ...PAY_TASKS]);
  m.tick();
  assert.deepEqual(m.of('deductGoldPieces'), [['deductGoldPieces', 80]], 'coins taken, letters untouched');
  assert.equal(m.pieces, 20);
  assert.equal(trig(q, 'paid'), true, 'the paid task started');
  assert.equal(trig(q, 'broke'), false);
  const m2 = makeMachine();
  m2.pieces = 10; m2.money = 500;
  const q2 = schedule(m2, [' pay 80 gold do _paid_ otherwise do _broke_', '', ...PAY_TASKS]);
  m2.tick();
  assert.equal(m2.of('deductGoldPieces').length, 0, 'nothing is taken when it cannot cover');
  assert.equal(trig(q2, 'broke'), true);
  const m3 = makeMachine();
  m3.pieces = 10; m3.money = 200;
  const q3 = schedule(m3, [' pay 150 money do _paid_ otherwise do _broke_', '', ...PAY_TASKS]);
  m3.tick();
  assert.deepEqual(m3.of('deductGold'), [['deductGold', 150]], 'the money arm spends the whole purse\'s tender');
  assert.equal(trig(q3, 'paid'), true);
  // AUDIT 39 #92: the `money` GATE is GetGoldAmount - coins PLUS
  // letters of credit (PayMoney.cs:79-82) - not the bare GoldPieces
  // read the other actions use. The pin had been vacuous because one
  // host wired both quantities to the same coins-only function, so a
  // solvent player carrying paper took the `otherwise` task.
  const m4 = makeMachine({ deps: { getGold: () => 10, getTotalGold: () => 5010 } });
  const q4 = schedule(m4, [' pay 100 money do _paid_ otherwise do _broke_', '', ...PAY_TASKS]);
  m4.tick();
  assert.equal(trig(q4, 'paid'), true, '10 coins and a 5000-gold letter covers 100');
  assert.deepEqual(m4.of('deductGold'), [['deductGold', 100]], 'DeductGoldAmount takes it');
});

test('Q5: JournalNote files the message\'s tokens; TrainPc trains for free with the three-hour raise', () => {
  const m = makeMachine({ nowMinutes: 1000 });
  schedule(m, [' journal note 1004', ' train pc Climbing', '', 'variable _pad_']);
  m.tick();
  // AUDIT 39 #89: the pin moved from addNote to addNoteTokens. DFU
  // calls the TOKEN overload (JournalNote.cs:52 ->
  // PlayerNotebook.AddNote(List<TextFile.Token>)); the string overload
  // this used to hit concatenated the token array into a note reading
  // '[object Object],[object Object]' and threw past 70 tokens.
  assert.equal(m.of('addNote').length, 0, 'NOT the string overload');
  const filed = m.of('addNoteTokens');
  assert.equal(filed.length, 1, 'the notebook takes the note as TOKENS');
  assert.ok(Array.isArray(filed[0][1]) && typeof filed[0][1][0]?.text === 'string',
    'an array of {formatting,text}, the shape AddNote(List<Token>) walks');
  const before = 5000;
  assert.deepEqual(m.of('raiseTime'), [['raiseTime', 3 * 3600]], 'SecondsPerHour * 3');
  assert.equal(m.entity.timeOfLastSkillTraining, 1000, 'the training stamp, in classic minutes');
  assert.equal(m.entity.fatigue, before - FATIGUE_LOSS.Default * 180, 'DefaultFatigueLoss * 180');
  const tally = m.entity.skillUses[SKILLS.Climbing];
  const mult = SKILL_ADVANCEMENT_MULTIPLIER[SKILLS.Climbing];
  assert.ok(tally >= 10 * mult && tally <= 20 * mult, `Range(10,21) x the skill's multiplier (got ${tally})`);
  assert.equal(m.of('showPopup').length, 1, 'the QuestComplete popup shows');
});

test('Q5: KillFoe kills the resource; parsed "unrestrain foe" is SHADOWED by RestrainFoe - DFU\'s own quirk', () => {
  const m = makeMachine();
  const q = schedule(m, [
    ' kill foe _dummy_',
    ' unrestrain foe _dummy_', '',
    'Foe _dummy_ is Giant', '',
  ]);
  m.tick();
  const foe = q.getFoe({ name: 'dummy' });
  assert.equal(foe.deathTrigger, true, 'Foe.Kill()');
  // DFU's Test() is UNANCHORED (QuestAction.cs:142) and RestrainFoe
  // registers before UnrestrainFoe (QuestMachine.cs:395 vs :426), so
  // "unrestrain foe" contains "restrain foe" and parses as a RESTRAIN
  // in C# too. No shipped quest writes "unrestrain foe"; the port
  // keeps the registration order, quirk and all - recorded, not fixed.
  assert.equal(foe.isRestrained, true, 'the shadowing quirk, verbatim');
  const startup = [...q.tasks.values()][0];
  assert.ok(startup.actions.every((a) => a.constructor.name !== 'UnrestrainFoe'),
    'the parser never mints an UnrestrainFoe - RestrainFoe eats the line first, exactly as C#');
});

test('Q5: UnrestrainFoe itself clears the restraint, and WAITS on a missing foe (C# returns, no complete)', () => {
  const foe = { isRestrained: true, clearRestrained() { this.isRestrained = false; } };
  const q = { getFoe: (s) => (s?.name === 'dummy' ? foe : null) };
  const waiting = new UnrestrainFoe(null).createNew('unrestrain foe _ghost_', q);
  waiting.update(null);
  assert.equal(waiting.isComplete, false, 'a missing foe waits without completing');
  const done = new UnrestrainFoe(null).createNew('unrestrain foe _dummy_', q);
  done.update(null);
  assert.equal(foe.isRestrained, false, 'ClearRestrained()');
  assert.equal(done.isComplete, true);
});

test('Q5: RunQuest waits on the child and routes success/failure; an unservable name fails at once', () => {
  const m = makeMachine();
  // the lists cannot serve '__NOPE' - the failure task starts
  const q = schedule(m, [
    ' run quest __NOPE then _won_ or _lost_', '',
    '_won_ task:', ' setvar _w2_', '',
    '_lost_ task:', ' setvar _l2_', '',
    'variable _w2_', 'variable _l2_',
  ]);
  m.tick();
  assert.equal(trig(q, 'lost'), true, 'no such quest: the failure arm, immediately');
  assert.equal(trig(q, 'won'), false);
});

const CHILD_SOURCE = ['Quest: __CHILD', 'QRC:', 'Message:  1004', ' done', '', 'QBN:', 'variable _pad_'];

test('AUDIT 39 #91: RunQuest tombstones a child still running when the parent quest ends', () => {
  // RunQuest.cs Dispose: "Will ensure that target quest is also
  // terminated if still running when parent quest ends." Without it
  // the orphan ticks on alone, keeping its SiteLinks, placed foes and
  // talk topics alive.
  const m = makeMachine({ deps: { getQuestSourceLines: (name) => (name === '__CHILD' ? CHILD_SOURCE : null) } });
  const q = schedule(m, [
    ' run quest __CHILD then _won_ or _lost_', '',
    '_won_ task:', ' setvar _w2_', '',
    '_lost_ task:', ' setvar _l2_', '',
    'variable _w2_', 'variable _l2_',
  ]);
  m.tick();
  m.tick();
  const child = [...m.quests.values()].find((c) => c.questName === '__CHILD');
  assert.ok(child, 'the child quest is live');
  assert.equal(child.questComplete, false, 'and still running');
  assert.equal(child.questTombstoned, false);
  m.tombstoneQuest(q);
  assert.equal(child.questTombstoned, true, 'the child dies with the parent');
});

test('AUDIT 39 #90: JournalNote, TrainPc and RunQuest are allowRearm=false - a cleared task cannot re-run them', () => {
  const m = makeMachine({ nowMinutes: 1000 });
  const q = schedule(m, [
    '_t_ task:', ' journal note 1004', ' train pc Climbing', '',
    'variable _pad_',
  ]);
  m.tick();
  q.getTask({ name: 't' }).start(); m.tick();
  assert.equal(m.of('addNoteTokens').length, 1);
  assert.equal(m.of('raiseTime').length, 1);
  q.getTask({ name: 't' }).clear();
  q.getTask({ name: 't' }).start(); m.tick();
  assert.equal(m.of('addNoteTokens').length, 1, 'JournalNote.cs ctor allowRearm = false - no duplicate note');
  assert.equal(m.of('raiseTime').length, 1, 'TrainPc.cs ctor allowRearm = false - free training is once EVER');
  // the flag itself, straight off the ctor (RunQuest's rearm needs a
  // servable child to observe, and the ctor is where C# sets it)
  for (const [Cls, cs] of [[JournalNote, 'JournalNote.cs'], [TrainPc, 'TrainPc.cs'], [RunQuest, 'RunQuest.cs']]) {
    assert.equal(new Cls(null).allowRearm, false, `${cs} ctor sets allowRearm = false`);
  }
});

test('AUDIT 39 #94: Climate keeps C#\'s alternative ORDER - desert2 binds desert, mountainwoods binds mountain', () => {
  // Both engines take the leftmost alternative that matches at the
  // earliest start and Test() is unanchored, so C# never reaches
  // desert2/mountainwoods at all; the port had sorted the alternation
  // longest-first and bound 225/230 where DFU binds 224/226.
  const m = makeMachine();
  m.world._climate = 224;   // Climates.Desert
  const q = schedule(m, [
    '_d2_ task:', ' climate desert2', '',
    '_mw_ task:', ' climate mountainwoods', '',
    'variable _pad_',
  ]);
  m.tick();
  assert.equal(trig(q, 'd2'), true, "'climate desert2' bound desert (224) - the trailing '2' is never consumed");
  assert.equal(trig(q, 'mw'), false);
  m.world._climate = 226;   // Climates.Mountain
  m.tick();
  assert.equal(trig(q, 'd2'), false);
  assert.equal(trig(q, 'mw'), true, "'climate mountainwoods' bound mountain (226)");
  m.world._climate = 230;   // Climates.MountainWoods - NOT what the line bound
  m.tick();
  assert.equal(trig(q, 'mw'), false, 'bug-for-bug: the woods climate does not trigger the woods line');
});

test('Q5: SpawnCityGuards and Enemies fire their host doors, flags intact', () => {
  const m = makeMachine();
  schedule(m, [
    ' spawncityguards immediate',
    ' spawncityguards',
    ' enemies makehostile',
    ' enemies clear', '',
    'variable _pad_',
  ]);
  m.tick();
  // AUDIT 39 #93: the pin moved to DFU's own two quirks. The Pattern
  // is `spawncityguards (immediate)?` - the space sits OUTSIDE the
  // optional group, so a bare `spawncityguards` line matches no
  // template and the registry drops it (QuestMachine logs "Action not
  // found. Ignoring"). And CreateNew reads `match.Groups.Count > 1`,
  // the group count of the PATTERN (always 2), so every line that does
  // match spawns immediately. The port had matched the bare spelling
  // and computed the flag honestly; neither is C#.
  assert.deepEqual(m.of('spawnCityGuards'), [['spawnCityGuards', true]],
    'only the `immediate` line matches, and it spawns immediate');
  assert.equal(m.of('makeEnemiesHostile').length, 1);
  assert.equal(m.of('clearEnemies').length, 1);
});

test('Q5: the world host mounts every new door', () => {
  const w = readFileSync(new URL('../src/scenes/world.js', import.meta.url), 'utf8');
  for (const door of ['setPlayerCrime: (crime) => setCrimeCommitted(playerEntity, crime)',
    'getGoldPieces: () => goldAmount(playerEntity)',
    'deductGoldPieces: (n) => deductGoldPieces(playerEntity, n)',
    'raiseTime: (seconds) => setWorldMinutes(worldMinutes() + seconds / 60)',
    'spawnCityGuards: (immediate) =>',
    'makeEnemiesHostile: () =>', 'clearEnemies: () =>',
// AUDIT 39 (#27) MOVED THIS PIN. It used to read
    // `currentWeatherKey: () => WEATHER_TYPES[`, which pinned the bug:
    // WEATHER_TYPES is the NAME array and both operands are already
    // names, so the index answered undefined -> null on every call and
    // the always-on Weather trigger could never match. The fold is the
    // identity, so the seam is the bare read.
    'currentWeatherKey: () => weatherOverride ?? currentWeather()', 'currentClimateIndex: () => maps.getClimateIndex(',
    // AUDIT 39: the two seams this wave mounted - JournalNote's TOKEN
    // overload and PayMoney's GetGoldAmount gate.
    'addNoteTokens: (tokens) => questBridge?.notebook?.addNoteTokens(tokens)',
    'getTotalGold: () => totalGoldAmount(playerEntity)']) {
    assert.ok(w.includes(door), `world.js mounts ${door.split(':')[0]}`);
  }
});

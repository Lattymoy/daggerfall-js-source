// Q3-iv - THE REMAINDER SWEEP: the last six template owners over
// their seams. WhenPcEntersExits's polled exterior-type trigger with
// the p1=2 places-table validation and the 'anywhere' wildcard;
// WhenNpcIsAvailable's click-pulse over the machine's new
// faction-listener and active-person surfaces; WhenReputeWith's
// live-rep bar with the unknown-faction-false law; the two disease
// actions over the S18 seams (with MakePcDiseased's dropped 'saying'
// tail kept verbatim); and CastSpellDo's readied-spell gate with the
// template-SetComplete quirk arms. The corpus closes at 7231/7235 -
// the 4 left are DFU's own 'Action not found. Ignoring' floor.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadQuestTables } from '../src/systems/quest/tables.js';
import { QuestMachine } from '../src/systems/quest/machine.js';

const VENDOR = join(dirname(fileURLToPath(import.meta.url)), '..', 'vendor', 'dfu-quests');
const read = (p) => readFileSync(p, 'utf8').replace(/^﻿/, '');

function loadTables() {
  const sources = {};
  for (const f of readdirSync(join(VENDOR, 'Tables'))) {
    if (f.endsWith('.txt')) sources[f.replace('.txt', '')] = read(join(VENDOR, 'Tables', f));
  }
  loadQuestTables(sources);
}
loadTables();

// records carry LIVE rep - WhenReputeWith reads the field directly
const FACTIONS = new Map([
  [364, { id: 364, type: 4, name: 'King Gothryd', race: 3, rep: 10 }],
  [365, { id: 365, type: 4, name: 'Queen Aubk-i', race: 3, rep: 0 }],
  [40, { id: 40, type: 2, name: 'The Mages Guild', race: -1, rep: 0 }],
]);

function makeWorld() {
  const world = {
    currentRegionIndex: () => 0,
    isPlayerInLocationRect: () => world._inRect,
    currentLocation: () => ({ loaded: true, mapTableData: { locationType: world._locType } }),
    getFactionData: (id) => FACTIONS.get(id) ?? null,
    getClassicSpellEffects: (id) => world._spells[id] ?? null,
    readiedSpell: () => world._readied,
    readiedSpellHasMatchForClassicEffect: (e) => world._readied?.effects?.some(
      (r) => r.type === e.type && r.subType === e.subType) ?? false,
    _inRect: true, _locType: 0, _readied: null,
    _spells: { 17: [{ type: 5, subType: 1 }, { type: -1, subType: -1 }] },
  };
  return world;
}

function makeMachine(world) {
  const calls = [];
  const capture = (name) => (...args) => calls.push([name, ...args]);
  const m = new QuestMachine({
    nowSeconds: () => 0,
    world,
    makePcDiseased: capture('makePcDiseased'),
    cureDisease: capture('cureDisease'),
    endVampirism: capture('endVampirism'),
    endLycanthropy: capture('endLycanthropy'),
    lastNPCClicked: () => m.clicked,
  });
  m.clicked = null;
  m.calls = calls;
  m.of = (name) => calls.filter((c) => c[0] === name);
  return m;
}

const HEADER = ['Quest: __QR', 'QRC:', 'Message:  1011', ' x', '', 'QBN:'];
const schedule = (m, qbn) => m.scheduleQuest([...HEADER, ...qbn], 0, { rolls: () => 0.4 });

// ---------------------------------------------------------------

test('WhenPcEntersExits: enters fires on the standing state, exits on the observed transition', () => {
  const world = makeWorld();
  const m = makeMachine(world);
  const q = schedule(m, [
    '_in_ task:', ' when pc enters city', '',
    '_out_ task:', ' when pc exits city', '',
    'variable _pad_',
  ]);
  m.tick();
  assert.equal(q.getTask({ name: 'in' }).getTriggerValue(), true,
    'seeded IN a city at create - enters is state, not edge');
  assert.equal(q.getTask({ name: 'out' }).getTriggerValue(), false);
  world._inRect = false;   // the player leaves the location rect
  m.tick();
  assert.equal(q.getTask({ name: 'out' }).getTriggerValue(), true,
    'the poll observed city -> None: exited');
});

test("WhenPcEntersExits: 'anywhere' is the p2=-1 wildcard; a non-p1=2 type THROWS at parse", () => {
  const world = makeWorld();
  world._inRect = false;   // start outside
  const m = makeMachine(world);
  const q = schedule(m, ['_t_ task:', ' when pc enters anywhere', '', 'variable _pad_']);
  m.tick();
  assert.equal(q.getTask({ name: 't' }).getTriggerValue(), false, 'None never enters');
  world._inRect = true;
  m.tick();
  assert.equal(q.getTask({ name: 't' }).getTriggerValue(), true, 'any type at all');

  const m2 = makeMachine(makeWorld());
  assert.throws(
    () => schedule(m2, ['_t_ task:', ' when pc enters tavern', '', 'variable _pad_']),
    /p1=2/, "'tavern' is a building row (p1=0), not an exterior type");
});

test('WhenNpcIsAvailable: the click PULSES the task once, the memory holds the same click, an active Person locks out', () => {
  const m = makeMachine(makeWorld());
  const q = schedule(m, ['_t_ task:', ' when King_Gothryd is available', '', 'variable _pad_']);
  m.tick();
  assert.equal(q.getTask({ name: 't' }).getTriggerValue(), false, 'nothing clicked');
  // AUDIT 24 (the seven-slice sweep): the spam-click guard is an NPC
  // IDENTITY compare, not an object-reference one. C#'s
  // `lastClicked == clickMemory` (WhenNpcIsAvailable.cs:84) compares
  // two StaticNPC REFERENCES, and a scene holds exactly one StaticNPC
  // per NPC - so it reads "the same NPC again". The port's hosts mint a
  // fresh NPCData literal at every click, so `===` could never be true
  // and this guard never fired at all.
  const king = { factionID: 364, hash: 111, nameSeed: 7, mapID: 3, buildingKey: 9 };
  m.clicked = king;
  m.tick();
  assert.equal(q.getTask({ name: 't' }).getTriggerValue(), true, 'clicked and unbound - available');
  assert.equal(m.factionListeners.get(364)?.constructor.name, 'WhenNpcIsAvailable', 'the listener slot claimed');
  m.tick();
  assert.equal(q.getTask({ name: 't' }).getTriggerValue(), false, 'the same OBJECT does not re-fire');
  // ...and neither does a fresh object naming the SAME NPC, which is
  // what a second click on him actually produces.
  m.clicked = { factionID: 364, hash: 111, nameSeed: 7, mapID: 3, buildingKey: 9 };
  m.tick();
  assert.equal(q.getTask({ name: 't' }).getTriggerValue(), false,
    'spam-clicking the same NPC is exactly what the memory holds off');
  // a DIFFERENT NPC of the same faction clears the memory and fires
  m.clicked = { factionID: 364, hash: 222, nameSeed: 8, mapID: 3, buildingKey: 9 };
  m.tick();
  assert.equal(q.getTask({ name: 't' }).getTriggerValue(), true, 'someone else, then back again');

  // an ACTIVE Person of that faction locks the NPC out
  const m2 = makeMachine(makeWorld());
  schedule(m2, ['Person _king_ named King_Gothryd', '', 'variable _pad_']);
  const q2 = schedule(m2, ['_t_ task:', ' when King_Gothryd is available', '', 'variable _pad_']);
  m2.clicked = { factionID: 364, hash: 111, nameSeed: 7, mapID: 3, buildingKey: 9 };
  m2.tick();
  assert.equal(q2.getTask({ name: 't' }).getTriggerValue(), false, 'another quest binds the King');
});

test('WhenReputeWith: the live rep bar is INCLUSIVE; a faction with NO record throws at parse', () => {
  const m = makeMachine(makeWorld());
  const q = schedule(m, [
    '_lo_ task:', ' when repute with King_Gothryd is at least 10', '',
    '_hi_ task:', ' when repute with King_Gothryd is at least 11', '',
    'variable _pad_',
  ]);
  m.tick();
  assert.equal(q.getTask({ name: 'lo' }).getTriggerValue(), true, 'rep 10 >= 10');
  assert.equal(q.getTask({ name: 'hi' }).getTriggerValue(), false, 'rep 10 < 11');
  FACTIONS.get(364).rep = 11;
  m.tick();
  assert.equal(q.getTask({ name: 'hi' }).getTriggerValue(), true, 'the bar reads the LIVE field');
  FACTIONS.get(364).rep = 10;
  // AUDIT 24 systems: Person.GetFactionData (Person.cs:848-856) THROWS
  // on a missing record, and both actions call it (WhenReputeWith.cs:57,
  // WhenNpcIsAvailable.cs:58). The port's `factionData &&` guard let an
  // unknown individual fall through and mint a task that quietly read
  // false forever; DFU error-terminates the quest at parse.
  const m2 = makeMachine(makeWorld());
  assert.throws(
    () => schedule(m2, ['_gone_ task:', ' when repute with Cyndassa is at least 0', '', 'variable _pad_']),
    /Could not find faction data for FactionID/);
  const m3 = makeMachine(makeWorld());
  assert.throws(
    () => schedule(m3, ['_gone_ task:', ' when Cyndassa is available', '', 'variable _pad_']),
    /Could not find faction data for FactionID/);
});

test('WhenReputeWith/WhenNpcIsAvailable: a named NON-individual throws at parse under a world', () => {
  const m = makeMachine(makeWorld());
  assert.throws(
    () => schedule(m, ['_t_ task:', ' when repute with The_Mages_Guild is at least 5', '', 'variable _pad_']),
    /is not an individual NPC/);
  const m2 = makeMachine(makeWorld());
  assert.throws(
    () => schedule(m2, ['_t_ task:', ' when The_Mages_Guild is available', '', 'variable _pad_']),
    /is not an individual NPC/);
});

test("MakePcDiseased: the Quests-Diseases id through the seam; the corpus 'saying' tail is DROPPED", () => {
  const m = makeMachine(makeWorld());
  schedule(m, [
    ' make pc ill with Wizard_Fever',
    " make pc ill with Caliron's_Curse saying 1027",
  ]);
  m.tick();
  assert.deepEqual(m.of('makePcDiseased'), [['makePcDiseased', 16], ['makePcDiseased', 7]]);
  assert.equal(m.of('showPopup').length, 0, "C#'s pattern has no saying group - no popup, verbatim");
  const m2 = makeMachine(makeWorld());
  assert.throws(() => schedule(m2, [' make pc ill with Bogus_Pox']), /could not find disease/);
});

test('CurePcDisease: three arms, and the case-insensitive re-test catches Cure Vampirism through the third alternate', () => {
  const m = makeMachine(makeWorld());
  schedule(m, [
    ' cure vampirism',
    ' cure lycanthropy',
    ' cure Swamp_Rot',
    ' cure Vampirism',
  ]);
  m.tick();
  assert.deepEqual(m.of('endVampirism').length, 2, 'the capitalized form still lands on the vampirism arm');
  assert.deepEqual(m.of('endLycanthropy').length, 1);
  assert.deepEqual(m.of('cureDisease'), [['cureDisease', 6]]);
  const m2 = makeMachine(makeWorld());
  assert.throws(() => schedule(m2, [' cure Imaginary_Rot']), /could not find disease/);
});

test('CastSpellDo: the readied-spell gate matches EVERY classic effect, then starts the task once', () => {
  const world = makeWorld();
  const m = makeMachine(world);
  const q = schedule(m, [
    ' cast Shield spell do _t_', '',
    '_t_ task:', ' setvar _hit_', '',
    'variable _hit_',
  ]);
  m.tick();
  assert.equal(q.getTask({ name: 't' }).getTriggerValue(), false, 'nothing readied - the action idles');
  world._readied = { effects: [{ type: 9, subType: 0 }] };
  m.tick();
  assert.equal(q.getTask({ name: 't' }).getTriggerValue(), false, 'a NON-matching readied spell does not fire');
  world._readied = { effects: [{ type: 5, subType: 1 }] };
  m.tick();
  assert.equal(q.getTask({ name: 't' }).getTriggerValue(), true, 'every real effect matched (type -1 skipped)');
  const startup = [...q.tasks.values()][0];
  const act = startup.actions.find((a) => a.constructor.name === 'CastSpellDo');
  assert.equal(act.isComplete, true, 'fired once and completed');
});

test('CastSpellDo QUIRK: an unresolved spell completes the TEMPLATE - the minted action idles forever', () => {
  const m = makeMachine(makeWorld());
  const q = schedule(m, [
    ' cast Bogus_Bolt spell do _t_', '',
    '_t_ task:', ' setvar _hit_', '',
    'variable _hit_',
  ]);
  m.tick(); m.tick();
  const startup = [...q.tasks.values()][0];
  const act = startup.actions.find((a) => a.constructor.name === 'CastSpellDo');
  assert.equal(act.isComplete, false, 'the action never completes and never fires');
  assert.equal(q.getTask({ name: 't' }).getTriggerValue(), false);
});

// ---- the Q3-iv VERIFY pins (the mutation campaign's boundaries) ----

test('WhenPcEntersExits: the create seed needs rect AND loaded - an out-of-rect create seeds None', () => {
  const world = makeWorld();
  world._inRect = false;   // loaded location, player outside the rect
  const m = makeMachine(world);
  const q = schedule(m, ['_t_ task:', ' when pc exits city', '', 'variable _pad_']);
  m.tick();
  assert.equal(q.getTask({ name: 't' }).getTriggerValue(), false,
    'nothing was seeded - no phantom exit on the first poll');
  world._inRect = true;
  m.tick();   // the poll observes None -> city
  assert.equal(q.getTask({ name: 't' }).getTriggerValue(), false, 'entering is not exiting');
  world._inRect = false;
  m.tick();   // city -> None
  assert.equal(q.getTask({ name: 't' }).getTriggerValue(), true, 'the real exit fires');
});

test('WhenPcEntersExits: an ENTERS trigger never fires on an exit transition', () => {
  const world = makeWorld();
  const m = makeMachine(world);
  const q = schedule(m, ['_t_ task:', ' when pc enters city', '', 'variable _pad_']);
  world._inRect = false;   // leave BEFORE the first check ever runs
  m.tick();
  assert.equal(q.getTask({ name: 't' }).getTriggerValue(), false,
    'the seeded city slid to previous - the enters arm must not read it');
});

test("WhenPcEntersExits: 'exits anywhere' fires on any observed departure", () => {
  const world = makeWorld();
  const m = makeMachine(world);
  const q = schedule(m, ['_t_ task:', ' when pc exits anywhere', '', 'variable _pad_']);
  world._inRect = false;
  m.tick();
  assert.equal(q.getTask({ name: 't' }).getTriggerValue(), true, 'the p2=-1 wildcard on the exit arm');
});

test('WhenNpcIsAvailable: a click on the WRONG faction stays unavailable', () => {
  const m = makeMachine(makeWorld());
  const q = schedule(m, ['_t_ task:', ' when King_Gothryd is available', '', 'variable _pad_']);
  m.clicked = { factionID: 999 };
  m.tick();
  assert.equal(q.getTask({ name: 't' }).getTriggerValue(), false);
});

test('WhenReputeWith is ALWAYS-ON: the bar dropping back UN-triggers the task', () => {
  const m = makeMachine(makeWorld());
  const q = schedule(m, ['_t_ task:', ' when repute with King_Gothryd is at least 10', '', 'variable _pad_']);
  m.tick();
  assert.equal(q.getTask({ name: 't' }).getTriggerValue(), true, 'rep 10 meets the bar');
  FACTIONS.get(364).rep = 5;
  m.tick();
  assert.equal(q.getTask({ name: 't' }).getTriggerValue(), false,
    'the always-on PRIMARY reads the live field both ways');
  FACTIONS.get(364).rep = 10;
});

test('activeFactionPersons matches faction AND person-ness: an unrelated Person never locks out', () => {
  const m = makeMachine(makeWorld());
  // a bound Queen (365) must not block the King (364)
  m.scheduleQuest(['Quest: __QX', 'QRC:', 'Message:  1011', ' x', '', 'QBN:',
    'Person _p_ named Queen_Aubk-i', '', 'variable _pad_'], 0, { rolls: () => 0.4 });
  const q = schedule(m, ['_t_ task:', ' when King_Gothryd is available', '', 'variable _pad_']);
  m.clicked = { factionID: 364 };
  m.tick();
  assert.equal(q.getTask({ name: 't' }).getTriggerValue(), true, 'only a 364 Person could lock the King out');
  assert.equal(m.activeFactionPersons(365).length, 1, 'the Queen IS bound - the filter is the faction');
});

test('HEADLESS: every Q3-iv form parses; the world-free throws still fire', () => {
  const m = new QuestMachine({ nowSeconds: () => 0 });
  const q = m.scheduleQuest([...HEADER,
    '_a_ task:', ' when pc enters city', '',
    '_b_ task:', ' when repute with King_Gothryd is at least 5', '',
    '_c_ task:', ' when King_Gothryd is available', '',
    ' make pc ill with Plague',
    ' cure vampirism',
    ' cast Shield spell do _a_',
  ], 0, { rolls: () => 0.4 });
  m.tick();
  assert.equal(q.getTask({ name: 'a' }).getTriggerValue(), false, 'the poll sees None forever');
  assert.equal(q.getTask({ name: 'b' }).getTriggerValue(), false, 'no store, no rep');
  assert.equal(m.quests.has(q.uid), true, 'nothing faulted headless');
  // the table validations are world-free and still throw
  const m2 = new QuestMachine({ nowSeconds: () => 0 });
  assert.throws(
    () => m2.scheduleQuest([...HEADER, '_t_ task:', ' when pc enters magery', '', 'variable _pad_'], 0, { rolls: () => 0.4 }),
    /p1=2/);
});

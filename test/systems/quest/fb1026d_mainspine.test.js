// MAIN-SPINE (2026-10-26, Discord #feature-feedback "Main quest borked": "Level 8 and still no letter from Morgiah ...
// Other people having issues too"; bible/01-Overview/bugs/Field-Bugs-2026-10-26d.md): the main quest's backbone
// (S0000999, which sends Morgiah's letter at level 3) is started again when its one start failed to parse - the world's
// faction records not yet loaded on the page an online birth reloads into - and a game that already lost it gets it back.
// The real quest bridge over the vendored DFU quests; the world's faction records a stand-in (every royal an individual
// at regard 0, as FACTION.TXT has Morgiah), withheld for the ticks a cold page has none - and, where ARENA2 is fetched
// (tools/fetch-data.sh), the game's own FACTION.TXT. AUDIT FB1026d (A1-A6, E1, E2, E10, E11): the law reads the
// machine's own record of the opener and the backbone (`spine`), never the classic game's globals. Mutants:
// tools/mutants/fb1026d_mainspine.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createQuestBridge } from '../../../src/scenes/quest/questBridge.js';
import { loadQuestTables } from '../../../src/systems/quest/tables.js';
import { resetUid } from '../../../src/systems/quest/quest.js';
import { PLAYED_STEP_MAX_SECONDS } from '../../../src/systems/quest/clock.js';
import * as A from '../../../src/systems/quest/actions.js';
import { SPINE, SPINE_OPENER, SPINE_CURSE, SPINE_CHECK_TICKS, spineOwed } from '../../../src/systems/quest/mainSpine.js';
import { globalVarsTable } from '../../../src/systems/quest/tables.js';
import { FactionFile } from '../../../src/formats/factionFile.js';

const ARENA2 = process.env.ARENA2_PATH;
const FACTIONS = ARENA2 && existsSync(join(ARENA2, 'FACTION.TXT')) ? join(ARENA2, 'FACTION.TXT') : null;

const VENDOR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'vendor', 'dfu-quests');
const sources = {};
for (const f of readdirSync(join(VENDOR, 'Tables'))) if (f.endsWith('.txt')) sources[f.replace('.txt', '')] = readFileSync(join(VENDOR, 'Tables', f), 'utf8').replace(/^﻿/, '');
loadQuestTables(sources);
// the stand-in world has no tavern for Brisienna: her `create npc at` / `place npc` stand done, for _BRISIEN alone
for (const C of [A.PlaceNpc, A.CreateNpcAt, A.CreateNpc]) {
  const o = C.prototype.update;
  C.prototype.update = function (c) { if (this.parentQuest?.questName === '_BRISIEN') { this.setComplete(); return; } return o.call(this, c); };
}

/** A page: the bridge as world.js wires it online, the faction records `S.ready` (the stand-in's, or `S.factions`'s) or none. */
function page(S) {
  const b = createQuestBridge({
    data: {
      readListTable: (n) => (existsSync(join(VENDOR, 'Tables', `${n}.txt`)) ? readFileSync(join(VENDOR, 'Tables', `${n}.txt`), 'utf8') : ''),
      getQuestSourceLines: (n) => { const f = join(VENDOR, 'Quests', `${n}.txt`); return existsSync(f) ? readFileSync(f, 'utf8').replace(/^﻿/, '').split(/\r?\n/) : null; },
    },
    world: { getFactionData: (id) => (!S.ready ? null : S.factions ? S.factions.get(id) ?? null : { id, type: 4, rep: 0, name: 'Royal', parent: 0, flags: 0 }) },
    classicSeconds: () => S.now, skySeconds: () => S.sky, worldSeconds: () => S.sky, raisedSeconds: () => 0,
    questClockStepMax: () => PLAYED_STEP_MAX_SECONDS, sharedClock: () => true, ownMinutes: () => S.now / 60, noteMinutes: () => Math.floor(S.now / 60),
    playerEntity: { get level() { return S.level; }, name: 'Tester', gender: 'male' },
    isPlayerInTown: () => true,
    giveItemToPlayer: (it) => S.given.push([...S.b.machine.quests.values()].find((q) => q.uid === it?.questUID)?.questName ?? '?'),
    addHUDText: () => {},
  }, { label: 'mainspine' });
  return b;
}
const fresh = (factions = null) => { const S = { now: 0, sky: 8 * 3600, level: 1, ready: true, given: [], b: null, factions }; S.b = page(S); return S; };
const tick = (S, n = 1) => { for (let i = 0; i < n; i++) { S.now += 6; S.sky += 6; S.b.tick(0.11); } };
const has = (S, name) => [...S.b.machine.quests.values()].some((q) => q.questName === name);
const quest = (S, name) => [...S.b.machine.quests.values()].find((q) => q.questName === name);
/** The game's start: _BRISIEN begun (headless - the stand-in world has no maps for her Places), its first tick run. */
function begin(S) {
  const l = S.b.machine.deps.getQuestSourceLines('_BRISIEN');
  S.b.machine.startQuestImmediate(S.b.machine.parseQuestForLists(l, 0, { headless: true }));
  tick(S);   // tick 1: the start-up block (online the 1025 box holds the next tick, and a realm birth saves and reloads here)
}
/** Save, and load on a fresh page whose faction records are `ready` - `edit` the envelope first (an older save's shape). */
function reload(S, ready, edit = null) {
  const snap = JSON.parse(JSON.stringify(S.b.snapshot()));
  edit?.(snap);
  resetUid();
  S.ready = ready;
  S.b = page(S);
  S.b.restore(snap);
}
const silently = (fn, said = []) => { const w = console.warn; console.warn = (m) => said.push(String(m)); try { return fn(); } finally { console.warn = w; } };
/** The opener lost before this law: the backbone's start failed, and the page that failed it is gone. */
function lost(S) {
  begin(S);
  reload(S, false);
  silently(() => tick(S, 2));   // tick 2: the start fails ...
  assert.equal(has(S, SPINE), false);
}
const olderSave = (snap) => { delete snap.machine.spine; };   // an envelope saved before the record
const globalId = (name) => parseInt(globalVarsTable().getValue('id', name));
/** Play until Morgiah's letter (the backbone's) is given, or `max` ticks. */
const toLetter = (S, max = 20000) => { for (let i = 0; i < max && !S.given.includes(SPINE); i++) tick(S); return S.given.includes(SPINE); };

test('MAIN-SPINE THE REPORT: the page an online birth reloads into parses the backbone before its faction records land - the backbone is started again once the records are there, and Morgiah\'s letter comes at level 3, Brisienna met first or not, the failures said once (mutants: the check never run; the opener\'s start unread; a failure said every check)', () => {
  for (const meetFirst of [true, false]) {
    const S = fresh();
    begin(S);
    reload(S, false);
    const said = [];
    silently(() => tick(S, 3 * SPINE_CHECK_TICKS), said);   // the second tick's `start quest 999 999` fails, and every check's start while the records are away
    assert.equal(has(S, SPINE), false, 'the parse failed with no faction records');
    S.ready = true;
    silently(() => tick(S, SPINE_CHECK_TICKS + 1), said);
    assert.equal(has(S, SPINE), true, 'started again: the backbone stands');
    // AUDIT FB1026d A6: three checks failed, one started - said once each, never every check
    const spineSaid = said.filter((l) => l.includes(`${SPINE} (the main quest's backbone)`));
    assert.equal(spineSaid.length, 2, spineSaid.join(' | '));
    assert.match(spineSaid[0], /is owed and did not start \(Could not find faction data.*\) - asked again every 30 quest ticks$/);
    assert.match(spineSaid[1], /was owed - scheduled \(try 4\)$/);   // AUDIT FB1026d II A3: scheduled - the invoke loop starts it
    if (meetFirst) quest(S, SPINE_OPENER).startTask({ name: 'meetladyb' });
    S.level = 3;
    assert.equal(toLetter(S), true, `Morgiah's letter (${meetFirst ? 'Brisienna met first' : 'level 3 first'})`);
  }
});

test('MAIN-SPINE A GAME THAT LOST IT: a save whose backbone was never started (the retry\'s page gone) gets it back once it is owed - the opener\'s start done, no story begun - and no game is handed a second (mutants: the lost backbone unrepaired; owed with a story begun; a start unrecorded; scheduled unread; the opener\'s start ungated)', () => {
  const S = fresh();
  lost(S);
  reload(S, true);   // ... and the page is gone with its retry: the save holds no backbone
  assert.equal(spineOwed(S.b.machine), true, 'the opener ran its start, and nothing stands');
  silently(() => tick(S, SPINE_CHECK_TICKS + 1));
  assert.equal(has(S, SPINE), true, 'started again');
  assert.deepEqual(S.b.machine.spine, { opened: true, ran: true }, 'and the record says so');
  assert.equal(spineOwed(S.b.machine), false, 'one standing: owed no more');
  silently(() => tick(S, 2 * SPINE_CHECK_TICKS));
  assert.equal([...S.b.machine.quests.values()].filter((q) => q.questName === SPINE).length, 1, 'and never a second');
  S.level = 3;
  assert.equal(toLetter(S), true, 'and Morgiah\'s letter comes');
  // a game with a step of the story begun ran its backbone once - it is never started over (its courts' quests would be)
  const T = fresh();
  lost(T); reload(T, true);
  T.b.machine.storyStarted.add('S0000004');
  assert.equal(spineOwed(T.b.machine), false);
  // a game that never began the main quest owes nothing; nor one whose opener has not yet run its start (tick 1 done,
  // tick 2 to come); nor one whose backbone is scheduled (a tick from starting)
  assert.equal(spineOwed(fresh().b.machine), false);
  const U = fresh();
  begin(U);
  assert.equal(spineOwed(U.b.machine), false, 'the opener stands, its start still to run - it runs it itself');
  tick(U);   // tick 2: `start quest 999 999` parses - the backbone waits in the invoke list for the next tick
  assert.deepEqual(U.b.machine.questsToInvoke.map((q) => q.questName), [SPINE]);
  assert.equal(spineOwed(U.b.machine), false, 'scheduled is standing');
});

test('MAIN-SPINE A CLASSIC IMPORT IS OWED NOTHING: the classic game\'s globals (Brisienna met, the main quest finished) start no backbone - and a backbone that ran and ended is never started again, its tombstone gone (mutants: the met global read alone; a backbone begun unread)', () => {
  // world.js classicLoadBoot: no quest started, the 64 classic globals set in place on the machine
  const S = fresh();
  for (const g of ['MetLadyBrisienna', 'MyniseraSatisfied', 'LiftedCurse']) S.b.machine.globalVars.set(globalId(g), true);
  assert.equal(spineOwed(S.b.machine), false, 'no opener of its own');
  silently(() => tick(S, 4 * SPINE_CHECK_TICKS));
  reload(S, true);
  silently(() => tick(S, 4 * SPINE_CHECK_TICKS));
  assert.equal(has(S, SPINE), false, 'saved and loaded in the port\'s own shape, still none');
  // the loop the global read alone made: a backbone that ran, ended and was removed a week on
  const T = fresh();
  begin(T); tick(T, 3);
  assert.equal(has(T, SPINE), true);
  const spine = quest(T, SPINE);
  T.b.machine.tombstoneQuest(spine, { ended: true });
  T.b.machine.removeQuest(spine);
  assert.equal(spineOwed(T.b.machine), false, 'it ran');
  reload(T, true);
  assert.equal(spineOwed(T.b.machine), false, 'and the save says so');
  silently(() => tick(T, 4 * SPINE_CHECK_TICKS));
  assert.equal(has(T, SPINE), false, 'never started again');
});

test('MAIN-SPINE THE OPENER GONE: an opener met and ended (the journal files it) or removed before the reload still makes the game owed - the record saved with it, the archive read for a save from before the record (mutants: the archive unread; the opener\'s start unrecorded; the record unsaved; the saved table unread)', () => {
  // met, then ended a day on (`_oneday_`: `end quest`) and its tombstone gone: a save from before the record
  const S = fresh();
  lost(S);
  quest(S, SPINE_OPENER).startTask({ name: 'meetladyb' });
  silently(() => tick(S, 2));
  assert.equal(S.b.machine.globalVars.get(globalId('MetLadyBrisienna')), true, 'met: the global set');
  quest(S, SPINE_OPENER).startTask({ name: 'oneday' });
  silently(() => tick(S, 3));
  const opener = quest(S, SPINE_OPENER);
  assert.equal(opener.questTombstoned, true, 'ended');
  S.b.machine.removeQuest(opener);
  assert.ok(S.b.notebook.getFinishedQuests().some((e) => e[0]?.render?.quest === SPINE_OPENER), 'the journal files her');
  reload(S, true, olderSave);
  assert.equal(has(S, SPINE_OPENER), false, 'no opener on the table');
  assert.equal(spineOwed(S.b.machine), true, 'owed: the archive names this game\'s opener');
  silently(() => tick(S, SPINE_CHECK_TICKS + 1));
  assert.equal(has(S, SPINE), true, 'started again');
  // the record: an opener begun in this session and gone before the save is owed after the load
  const T = fresh();
  begin(T);
  T.ready = false;   // the records gone on the page the game began on - no reload to read a saved table
  silently(() => tick(T, 2));
  assert.equal(has(T, SPINE), false);
  T.b.machine.removeQuest(quest(T, SPINE_OPENER));
  assert.equal(spineOwed(T.b.machine), true, 'begun here, gone: owed');
  reload(T, true);
  assert.equal(spineOwed(T.b.machine), true, 'saved with the record');
  // a save from before the record whose opener stood: the saved table says it began
  const U = fresh();
  lost(U);
  reload(U, true, olderSave);
  U.b.machine.removeQuest(quest(U, SPINE_OPENER));
  assert.equal(spineOwed(U.b.machine), true, 'the saved table named it');
});

test('MAIN-SPINE A BACKBONE THAT WOULD NOT REBUILD RAN: one the load drops (an action it cannot rebuild) is not owed again - it ran, and a restart could send its letters twice, so a letter it had not sent is lost with it (AUDIT FB1026d II A2: the exception named in mainSpine.js) (mutant: the saved table\'s backbone unread)', () => {
  const S = fresh();
  begin(S); tick(S, 3);
  assert.equal(has(S, SPINE), true);
  reload(S, true, (snap) => {
    olderSave(snap);
    const q = snap.machine.quests.find((d) => d.questName === SPINE);
    q.tasks[0].actions = [{ typeName: 'NoSuchAction' }];
  });
  assert.equal(has(S, SPINE), false, 'dropped at the load');
  assert.equal(spineOwed(S.b.machine), false, 'it ran');
});

test('MAIN-SPINE THE CURSE IS THE OPENER\'S TRACE (AUDIT FB1026d II A1): a save from before the record whose opener left nothing - never met and gone, or met and its journal entry cleared - still holds the Curse every port birth starts beside it, so it is owed, and Morgiah\'s letter comes at level 3; a classic import holds no Curse and is owed nothing (mutant: the Curse unread)', () => {
  const curse = (S) => { const m = S.b.machine; m.startQuestImmediate(m.parseQuestForLists(m.deps.getQuestSourceLines(SPINE_CURSE), 0, { headless: true })); };
  for (const met of [false, true]) {
    const S = fresh();
    curse(S);   // questBridge.js GAME_START_QUESTS: the Curse beside the opener
    lost(S);
    const opener = quest(S, SPINE_OPENER);
    if (met) { opener.startTask({ name: 'meetladyb' }); silently(() => tick(S, 2)); }
    else { opener.startTask({ name: 'pcfailed' }); silently(() => tick(S, 2)); }
    quest(S, SPINE_OPENER).startTask({ name: 'oneday' }); silently(() => tick(S, 3));
    S.b.machine.removeQuest(quest(S, SPINE_OPENER));
    if (met) assert.ok(S.b.journalClean.clearFinished() > 0, 'met: the journal filed her, and the player cleared it (JOURNAL-CLEAN)');
    else assert.equal(S.b.notebook.getFinishedQuests().length, 0, 'never met: a failed opener files nothing');
    reload(S, true, olderSave);
    assert.equal(has(S, SPINE_OPENER), false, 'no opener on the table');
    assert.equal(has(S, SPINE_CURSE), true, 'the Curse stands');
    assert.equal(spineOwed(S.b.machine), true, `owed (${met ? 'met, the entry cleared' : 'never met'})`);
    silently(() => tick(S, SPINE_CHECK_TICKS + 1));
    assert.equal(has(S, SPINE), true, 'started again');
    S.level = 3;
    assert.equal(silently(() => toLetter(S)), true, 'and Morgiah\'s letter comes');
  }
  // a classic import: no quest of its own, the Curse among none
  const I = fresh();
  for (const g of ['MetLadyBrisienna']) I.b.machine.globalVars.set(globalId(g), true);
  reload(I, true, olderSave);
  assert.equal(has(I, SPINE_CURSE), false);
  assert.equal(spineOwed(I.b.machine), false, 'an import is owed nothing');
});

test('MAIN-SPINE THE GAME\'S OWN FACTION.TXT (ARENA2): lost on the cold page, back once the records load, Morgiah\'s letter at level 3 either order', { skip: !FACTIONS && 'ARENA2_PATH not set (sh tools/fetch-data.sh)' }, () => {
  const ff = new FactionFile();
  ff.load(readFileSync(FACTIONS));
  for (const meetFirst of [true, false]) {
    const S = fresh(ff.factionDict);
    lost(S);
    silently(() => tick(S, 2 * SPINE_CHECK_TICKS));
    assert.equal(has(S, SPINE), false);
    S.ready = true;
    silently(() => tick(S, SPINE_CHECK_TICKS + 1));
    assert.equal(has(S, SPINE), true);
    if (meetFirst) quest(S, SPINE_OPENER).startTask({ name: 'meetladyb' });
    S.level = 3;
    assert.equal(toLetter(S), true);
  }
});

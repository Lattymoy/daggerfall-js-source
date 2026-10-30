// QUEST-AUDIT IV (bible/01-Overview/audits/Quest-Audit-IV.md), the starts' and the quest core's lanes: each fix held by a
// pin that fails on the code before it - the backbone's record under a start, one backbone, the opener's hand-off again,
// a story begun past its record, the questor's draw, the commission kept, the Imperial start's wake, a capital slice's
// quest name, and a held lair's name.
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { spineRecord, spineOwed, openerOwed, SPINE, SPINE_CURSE, SPINE_OPENER } from '../../../src/systems/quest/mainSpine.js';
import { QuestListsManager, SELECT_TRIES } from '../../../src/systems/quest/questLists.js';
import { createStartsHost } from '../../../src/scenes/startsHost.js';
import { questTransferRefused } from '../../../src/systems/item/itemTransfer.js';
import { setValue, _resetForTests } from '../../../src/systems/settings/settings.js';
import { createQuestProvinceSites } from '../../../src/scenes/quest/questProvinceSites.js';
import { mapPixelToLongitudeLatitude, LOCATION_TYPES } from '../../../src/formats/mapsFile.js';
import { CYRODIIL_REGION } from '../../../src/formats/mapsTables.js';
import { Symbol as QuestSymbol } from '../../../src/systems/quest/symbol.js';
import { BAY_START_QUEST, HAND_START_QUEST } from '../../../src/systems/starts/starts.js';
import { ROOT, packMachine, parsedQuest } from '../../qlSources.mjs';

const named = (questName, more = {}) => ({ questName, questComplete: false, questTombstoned: false, tasks: new Map(), ...more });
const machineOf = (quests, o = {}) => ({ quests: new Map(quests.map((q, i) => [i + 1, q])), questsToInvoke: [], storyStarted: new Set(), storyEnded: new Set(), spine: { opened: false, ran: false }, ...o });

test('QUEST-AUDIT IV A1: a start begins the Curse, never the opener - a save that holds a start reads no opener begun, and owes no backbone while the start runs, whatever the record says (mutants: the Curse read beside a start; the start\'s owing arm)', () => {
  assert.deepEqual(spineRecord(undefined, [SPINE_CURSE, BAY_START_QUEST]), { opened: false, ran: false }, 'a new character: the Curse beside its start');
  assert.deepEqual(spineRecord(undefined, [SPINE_CURSE]), { opened: true, ran: false }, 'a game from before the starts: the Curse is the opener\'s trace');
  assert.deepEqual(spineRecord(undefined, [SPINE_CURSE, HAND_START_QUEST, SPINE_OPENER]), { opened: true, ran: false }, 'the opener itself');
  // a record the old law wrote as opened while the start ran
  const m = machineOf([named(SPINE_CURSE), named(BAY_START_QUEST)], { spine: { opened: true, ran: false } });
  assert.equal(spineOwed(m), false);
  m.quests.delete(2);
  assert.equal(spineOwed(m), true, 'no start, no opener on the table: a lost backbone is owed again (MAIN-SPINE)');
});

test('QUEST-AUDIT IV A1: the backbone is one - a second `start quest 999 999` while one runs or waits starts none (mutants: the guard)', () => {
  const asked = [];
  const m = packMachine({ getQuestSourceLines: (n) => { asked.push(n); return null; } });
  m.quests.set(1, named(SPINE, { uid: 1 }));
  assert.equal(m.scheduleQuestByName(SPINE), null);
  assert.deepEqual(asked, [], 'never parsed');
  m.quests.get(1).questTombstoned = true;
  m.scheduleQuestByName(SPINE);
  assert.deepEqual(asked, [SPINE], 'an ended one is no guard');
});

test('QUEST-AUDIT IV A4: a start that handed its commission in while no opener stands or waits owes the opener - started again at the backbone\'s check (mutants: openerOwed\'s StartQuest read; keepOpener unread at the beat)', () => {
  const p = parsedQuest(BAY_START_QUEST, packMachine());
  const start = p.quest;
  const handoff = [...start.tasks.values()].flatMap((t) => t.actions).find((a) => a.constructor?.typeName === 'StartQuest');
  assert.ok(handoff, 'the start\'s own `start quest _BRISIEN`');
  const m = machineOf([named(SPINE_CURSE), start]);
  assert.equal(openerOwed(m), false, 'not handed in yet');
  handoff.isComplete = true;
  assert.equal(openerOwed(m), true, 'handed in, no opener');
  m.questsToInvoke.push(named(SPINE_OPENER));
  assert.equal(openerOwed(m), false, 'the opener waits for the next tick');
  m.questsToInvoke.length = 0;
  m.quests.set(9, named(SPINE_OPENER));
  assert.equal(openerOwed(m), false, 'the opener stands');
  const src = readFileSync(join(ROOT, 'src/systems/quest/machine.js'), 'utf8');
  assert.match(src, /if \(this\.beat % SPINE_CHECK_TICKS === 0\) \{ this\.keepOpener\(\); this\.keepSpine\(\); \}/);
});

test('QUEST-AUDIT IV A2, A3: a load hands the commission over only where no story ever began - the Curse or the backbone on the table, the spine\'s record, an ended story step or a classic game\'s globals each say it began (mutants: each trace)', () => {
  const host = (o) => { const m = { storyLegacy: false, storyStarted: new Set(), storyEnded: new Set(), quests: new Map(), questsToInvoke: [], spine: { opened: false, ran: false }, globalVars: new Map([[1, false]]), begun: [], startQuestByName(n) { this.begun.push(n); }, ...o }; createStartsHost({ machine: () => m }).restored(); return m.begun; };
  assert.deepEqual(host({}), ['S0000977', HAND_START_QUEST], 'nothing at all: the commission in hand');
  for (const [why, o] of [
    ['the Curse and the backbone on the table', { quests: new Map([[1, named(SPINE_CURSE)], [2, named(SPINE)]]) }],
    ['the backbone alone', { quests: new Map([[1, named(SPINE)]]) }],
    ['the spine\'s record', { spine: { opened: true, ran: false } }],
    ['an ended story step', { storyEnded: new Set(['S0000004']) }],
    ['a classic game\'s global set', { globalVars: new Map([[1, false], [12, true]]) }],
  ]) assert.deepEqual(host(o), [], why);
});

test('QUEST-AUDIT IV A7: a questor\'s draw sets aside a quest that will not stand here and draws another, SELECT_TRIES at most (mutants: one roll; the cap)', () => {
  const parsed = [];
  const lists = new QuestListsManager({ rolls: () => 0, readListTable: () => null, getQuestSourceLines: (n) => [n], parseQuest: (lines) => { parsed.push(lines[0]); return lines[0].startsWith('GOOD') ? { questName: lines[0] } : null; } });
  assert.equal(lists.selectQuest([{ name: 'BAD1' }, { name: 'GOOD1' }], 0)?.questName, 'GOOD1');
  parsed.length = 0;
  assert.equal(lists.selectQuest(Array.from({ length: 10 }, (_, i) => ({ name: `BAD${i}` })), 0), null);
  assert.equal(parsed.length, SELECT_TRIES);
  assert.equal(SELECT_TRIES, 4);
});

test('QUEST-AUDIT IV A5: a start\'s commission never leaves the pack, Drop Quest Items on or off - its quest is the one way into the main quest (mutants: the refusal)', () => {
  const quest = parsedQuest(HAND_START_QUEST, packMachine()).quest;
  const item = { questItem: true, questUID: quest.uid, questSymbol: new QuestSymbol('_commission_') };
  try {
    setValue('GUI', 'CanDropQuestItems', 'True');
    assert.equal(questTransferRefused(item, { fromLocal: true, getQuest: () => quest }), true);
  } finally { _resetForTests(); }
});

test('QUEST-AUDIT IV A6: the Imperial start\'s wake is true at the prison\'s door as in its cell - Start In The Dungeon off stands the player outside (mutants: the cell floor back)', () => {
  const text = readFileSync(join(ROOT, 'src/systems/starts/quests/_STARTIC.txt'), 'utf8');
  const wake = text.slice(text.indexOf('Message:  1020'), text.indexOf('\n\n', text.indexOf('Message:  1020')));
  assert.doesNotMatch(wake, /wake on the floor|door standing open/);
});

test('QUEST-AUDIT IV A8: the journal, the HUD card and the talk\'s same-building check read the place by its quest name - a capital\'s slice as a quest site names it (mutants: any of the six back on the slice\'s own name)', () => {
  const src = readFileSync(join(ROOT, 'src/scenes/world.js'), 'utf8');
  assert.match(src, /const _questName = \(\) => questView\(_questLoc\(\)\)\?\.name \?\? '';/);
  assert.equal([...src.matchAll(/currentLocationName: \(\) => _questName\(\)/g)].length, 5);
  assert.equal([...src.matchAll(/questLocationName: \(\) => _questName\(\)/g)].length, 1);
  assert.equal([...src.matchAll(/currentLocationName: \(\) => _questLoc\(\)\?\.name \?\? ''/g)].length, 1, 'the talk\'s "Where am I" alone says the slice\'s own name');
});

test('QUEST-AUDIT IV A9: a site a quest holds is found by its name before a nearer lair of that name - the table is the questor\'s nearest, and from another pixel the name was another lair\'s (mutants: the table\'s row first; the held row shut out by its name)', () => {
  const R = CYRODIIL_REGION;
  const at = (px, py) => mapPixelToLongitudeLatitude(px, py);
  const lair = (mapId, px, py) => ({ loaded: true, name: 'Galgulus\'s Guard', regionIndex: R, mapTableData: { mapId, locationType: LOCATION_TYPES.DungeonRuin, dungeonType: 9, longitude: at(px, py).x, latitude: at(px, py).y } });
  const held = lair(0xa8000001, 2082, 636), near = lair(0xa8000002, 2065, 579);
  const stand = new Map([['2082,636', held], ['2065,579', near]]);
  let origin = { x: 2066, y: 590 }, stood = 0;
  const p = createQuestProvinceSites({
    worldPlaces: { inTheatre: () => [], generation: () => 0 }, regionAt: () => R,
    standAt: (x, y) => { if (x === 2082) stood++; return stand.get(`${x},${y}`) ?? null; },
    lairsNear: () => [{ mapId: near.mapTableData.mapId, name: near.name, px: 2065, py: 579, type: LOCATION_TYPES.DungeonRuin, dungeonType: 9 }],
    origin: () => origin,
    heldSites: () => [{ regionIndex: R, locationName: held.name, mapId: held.mapTableData.mapId, worldPixel: { x: 2082, y: 636 } }],
  });
  const region = p.getRegion(R);
  assert.equal(region.mapTable[region.mapNameLookup.get(held.name)].mapId, held.mapTableData.mapId, 'the held one, not the nearer namesake');
  assert.equal(p.locationByName(region.name, held.name), held);
  // the questor moves: a new table holds the held row from the start - it is never stood again to be found
  const was = stood;
  origin = { x: 2070, y: 600 };
  const again = p.getRegion(R);
  assert.equal(again.mapTable[again.mapNameLookup.get(held.name)].mapId, held.mapTableData.mapId);
  assert.equal(stood, was, 'found once, kept across tables');
});

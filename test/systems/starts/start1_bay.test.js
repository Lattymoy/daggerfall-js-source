// THE BAY'S START AND ITS COMMISSION, on the machine whole. A new character starts the Bay's start quest in _BRISIEN's
// place; nothing of the main quest runs until the commission the tide carried into Privateer's Hold is found and opened;
// opened, it sends the player to the city of Daggerfall, and there _BRISIEN begins as DFU wrote it - its start-up's
// waking popup taken out (quest/questPatches.js). The contract every start keeps (systems/starts/starts.js) is held for
// each name in START_QUESTS, so a province's start is held to it the day it joins. The world here is a synthetic Bay
// (Privateer's Hold's one block with its item and spawn markers at their real places, and the city of Daggerfall); the
// game's own data, where ARENA2_PATH names it, resolves the same places and Lady Brisienna's tavern in the last test.
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import { BAY_START_QUEST, START_QUESTS, MAIN_QUEST_OPENER, isStartQuestName } from '../../../src/systems/starts/starts.js';
import { GAME_START_QUESTS, createQuestBridge } from '../../../src/scenes/quest/questBridge.js';
import { PROTECTED_QUESTS, QuestMachine } from '../../../src/systems/quest/machine.js';
import { isMainQuestName } from '../../../src/systems/quest/questLists.js';
import { prepareQuestShare, canReceiveSharedQuest } from '../../../src/systems/quest/questShare.js';
import { QUEST_PATCHES, applyQuestPatches } from '../../../src/systems/quest/questPatches.js';
import { SITE_TYPES } from '../../../src/systems/quest/place.js';
import { TaskType } from '../../../src/systems/quest/task.js';
import { chunkMessageTokens } from '../../../src/systems/quest/quest.js';
import { sheetFor } from '../../../src/systems/questlines/qlSheets.js';
import { readObjectives, outcomeNow } from '../../../src/systems/questlines/qlLaw.js';
import { UNLISTED_FAMILY } from '../../../src/systems/questlines/qlFamilies.js';
import { tutorialById } from '../../../src/systems/tutorials.js';
import { PRIVATEERS_HOLD_MAP_ID } from '../../../src/world/dungeon/dungeonTextures.js';
import { ROW_CHARS } from '../../../tools/qlCheck.mjs';
import { ROOT, QUEST_FILES, packMachine, questSource, loadTables } from '../../qlSources.mjs';
import { town, dungeon, rmbBlock, worldOf, SPAWN, ITEM } from '../../fb1004dTowns.mjs';
import { BUILDING_TYPES } from '../../../src/world/buildingNames.js';
import { FACTION_TYPES } from '../../../src/formats/factionFile.js';

const DAY = 86400;
const rd = (p) => readFileSync(join(ROOT, p), 'utf8');
const BRISIEN_DFU = rd('vendor/dfu-quests/Quests/_BRISIEN.txt');

// ── a synthetic Bay ──────────────────────────────────────────────
// The region of Daggerfall in the port's own shapes (test/fb1004dTowns.mjs): Privateer's Hold - one block, S0000999.RDB,
// with its item marker (199.18) and spawn marker (199.11) where the game's block holds them; the city of Daggerfall
// (DaggerfallCity1's location id, 0xc36a); Woodcroft Hall, a town with a tavern, where Lady Brisienna can take a room;
// and a farm, anywhere else in the region.
const HOLD_ITEM_MARKER = [1428, -1824, 1699];
const holdFlat = (record, x, y, z) => ({ type: 3, position: record, xPos: x, yPos: y, zPos: z, resources: { flatResource: { textureArchive: 199, textureRecord: record } } });
const HOLD_BLOCK = { position: 0, rdbBlock: { objectRootList: [{ rdbObjects: [holdFlat(ITEM, ...HOLD_ITEM_MARKER), holdFlat(SPAWN, 645, -41, 1585)] }] } };
function bayLocations() {
  const hold = dungeon({ name: "Privateer's Hold", locationIndex: 0, mapId: PRIVATEERS_HOLD_MAP_ID, dungeonType: 0, block: 'S0000999.RDB' });
  hold.exterior.exteriorData.locationId = 0xc381;
  const city = town({ name: 'Daggerfall', locationIndex: 1, mapId: 1291010263, grid: ['CITY.RMB'] });
  city.exterior.exteriorData.locationId = 0xc36a;
  const inn = town({ name: 'Woodcroft Hall', locationIndex: 2, mapId: 5002, grid: ['INN.RMB'] });
  inn.exterior.buildings.push({ buildingType: BUILDING_TYPES.Tavern, factionId: 0, nameSeed: 100, quality: 10 });   // the directory the remote pre-check reads
  const farm = town({ name: 'Ashwick Farm', locationIndex: 3, mapId: 5003, grid: ['FARM.RMB'] });
  return [hold, city, inn, farm];
}
const BAY_BLOCKS = new Map([
  ['S0000999.RDB', HOLD_BLOCK],
  ['CITY.RMB', rmbBlock('CITY.RMB', [{ type: BUILDING_TYPES.Palace }])],
  ['INN.RMB', rmbBlock('INN.RMB', [{ type: BUILDING_TYPES.Tavern }])],
  ['FARM.RMB', rmbBlock('FARM.RMB', [{ type: BUILDING_TYPES.House1 }])],
]);

/** The machine as a host builds it, over the synthetic Bay: `at` moves the player (`hold` inside the Hold, `city` out in
 *  Daggerfall's streets, `wilds` at the farm), `pack` is what the player carries, `said` every popup. */
function bay({ now = { s: 1e6 } } = {}) {
  loadTables();
  const locations = bayLocations();
  const [HOLD, CITY, , FARM] = locations;
  const where = { loc: HOLD, inside: { dungeon: true } };
  const said = [], pack = new Set(), discovered = [], removed = [];
  const base = worldOf({ locations, blocks: BAY_BLOCKS });
  const world = {
    ...base,
    // the main quest's people are FACTION.TXT's individuals - Lady Brisienna (352), Prince Lhotun (382) and the other
    // royals S0000999 waits on: `Person ladyBrisienna ... named`, `when npc ... is available`
    getFactionData: (id) => ({ ...base.getFactionData(id), type: FACTION_TYPES.Individual }),
    currentLocation: () => where.loc, playerInside: () => where.inside, isPlayerInLocationRect: () => !where.inside,
    currentLocationIndex: () => locations.indexOf(where.loc),
    discoverLocation: (_r, l) => discovered.push(l), mountCurrentSiteQuestResources: () => {},
  };
  const deps = {
    nowSeconds: () => now.s, skySeconds: () => 100 * DAY + 12 * 3600, world,
    showPopup: (q, tokens) => said.push({ quest: q.questName, text: (tokens ?? []).map((t) => t.text).join(' ').replace(/\s+/g, ' ').trim() }),
    isPlayerInTown: () => !where.inside, giveItemToPlayer: () => {}, removeItemFromPlayer: (it) => removed.push(it),
    carriesQuestItem: (r) => pack.has(r.symbol.name),
  };
  const m = packMachine(deps);
  const at = (place) => { where.loc = place === 'hold' ? HOLD : place === 'city' ? CITY : FARM; where.inside = place === 'hold' ? { dungeon: true } : null; };
  const tick = (n = 1, step = 60) => { for (let i = 0; i < n; i++) { now.s += step; m.tick(); } };
  const live = () => [...m.quests.values()].filter((q) => !q.questTombstoned).map((q) => q.questName);
  const quest = (name) => [...m.quests.values()].find((q) => q.questName === name && !q.questTombstoned) ?? null;
  return { m, at, tick, live, quest, said, pack, discovered, removed, now, world, deps };
}
const logOf = (q) => [...q.activeLogMessages.values()].map((l) => [l.stepID, l.messageID]);
const textOf = (q, id) => q.getMessage(id).getTextTokens(-1, () => 0).map((t) => t.text).join(' ').replace(/\s+/g, ' ').trim();

// ── the registry, the bridge's list, and the main quest's family ─

test('START1 the start\'s place: a new character starts the curse and the Bay\'s start quest - never _BRISIEN, which a start\'s commission starts; the start is the main quest\'s own (its family, protected, never shared) (mutants: _BRISIEN back in the list, the start out of the protected list, out of the main quest\'s name test)', () => {
  assert.equal(BAY_START_QUEST, '_STARTIB');
  // The provinces' starts and the commission in hand beside it (test/systems/starts/start2_provinces.test.js)
  assert.deepEqual([...START_QUESTS], ['_STARTIB', '_STARTSK', '_STARTMW', '_STARTIC', '_STARTBM', '_STARTEL', '_STARTVW', '_STARTSU', '_STARTHD']);
  assert.equal(MAIN_QUEST_OPENER, '_BRISIEN');
  assert.deepEqual([...GAME_START_QUESTS], ['S0000977', BAY_START_QUEST]);
  assert.ok(!GAME_START_QUESTS.includes(MAIN_QUEST_OPENER), 'the main quest waits for the commission');
  for (const name of START_QUESTS) {
    assert.ok(QUEST_FILES.get(name)?.dir === 'starts', `${name}: the port's own script, in systems/starts/quests`);
    assert.ok(isStartQuestName(name) && isStartQuestName(name.toLowerCase()), 'by name, case-insensitive');
    assert.ok(isMainQuestName(name), `${name}: the chronicle files it with the main quest`);
    assert.ok(PROTECTED_QUESTS.includes(name), `${name}: the main quest's spine - never error-terminated, set aside or restarted`);
    assert.ok(UNLISTED_FAMILY.MainQuest.includes(name), `${name}: its sheet is the main quest family's`);
    assert.equal(sheetFor(name)?.family, 'MainQuest');
  }
  assert.ok(!isStartQuestName('_BRISIEN') && !isStartQuestName('S0000977') && !isStartQuestName(null));
  // the commission is the character's own: a start is never offered to a party
  const { m, tick } = bay();
  const q = m.startQuestByName(BAY_START_QUEST);
  tick(1);
  assert.equal(m.shelveRefusal(q.uid), 'protected', 'the journal never lets it go: the main quest waits on it');
  assert.equal(m.restartRefusal(q.uid), 'protected');
  assert.deepEqual(prepareQuestShare(m, q.uid), { ok: false, reason: 'mainQuest' }, 'never sent');
  assert.equal(canReceiveSharedQuest(m, null, BAY_START_QUEST).reason, 'mainQuest', 'never taken');
});

test('START1 the bridge: initAtGameStart starts S0000977 and the Bay\'s start, in that order, and the main quest\'s opener is not among them - DFU\'s pack and the port\'s scripts both read (mutants: _BRISIEN back in the list)', () => {
  loadTables();
  const started = [];
  const bridge = createQuestBridge({
    data: { readListTable: () => '', getQuestSourceLines: (n) => questSource(n) },
    world: null, classicSeconds: () => 0, playerEntity: { level: 1, name: 'Tester' },
    onQuestStarted: (q) => started.push(q.questName),
  });
  bridge.initAtGameStart();
  assert.deepEqual(started, ['S0000977', '_STARTIB']);
  // the browser's pack reads the starts' folder beside DFU's and the mods' (scenes/quest/questData.js - Vite's glob, which
  // node cannot run; test/qlSources.mjs is its twin here)
  assert.match(rd('src/scenes/quest/questData.js'), /\.\.\.import\.meta\.glob\('\.\.\/\.\.\/systems\/starts\/quests\/\*\.txt', \{ query: '\?raw', import: 'default' \}\),/);
  assert.ok(![...bridge.machine.quests.values()].some((q) => q.questName === '_BRISIEN' || q.questName === 'S0000999'), 'no main quest yet');
});

// ── the contract every start keeps ───────────────────────────────

for (const name of START_QUESTS) {
  test(`START1 the contract, ${name}: it holds the commission, a letter whose use sets _opened_ from the start-up on; it runs no clock; it orders the player to the city of Daggerfall; and only there, opened, does it start _BRISIEN and end (mutants: the watch on the letter dropped, the city's half of the gate dropped, a clock added)`, () => {
    const m = packMachine();
    const lines = questSource(name);
    const quest = m.parseQuestForLists(lines, 0, { rolls: () => 0, headless: true });
    assert.ok(quest, `${name} parses on DFU's machine`);
    const item = quest.getItem({ name: 'commission' });
    assert.ok(item?.isItem && item.itemName === 'letter', 'the commission is a quest letter');
    assert.ok(item.usedMessageID > 0 && quest.getMessage(item.usedMessageID), 'and opening it reads it');
    const headless = [...quest.tasks.values()].find((t) => t.type === TaskType.Headless);
    const watch = headless.actions.find((a) => a.typeName === 'ItemUsedDo');
    assert.ok(watch && watch.itemSymbol.name === 'commission' && watch.taskSymbol.name === 'opened', 'the start-up watches the letter from the first tick, whatever came before');
    const city = quest.getPlace({ name: 'daggerfall' });
    assert.equal(city?.name, 'DaggerfallCity1', 'the place S0000977 watches');
    const pcAt = headless.actions.find((a) => a.typeName === 'PcAt');
    assert.ok(pcAt && pcAt.placeSymbol.name === 'daggerfall' && pcAt.taskSymbol.name === 'incity');
    const reported = quest.tasks.get('reported');
    assert.ok(reported, 'the hand-off');
    const when = reported.actions.find((a) => a.typeName === 'WhenTask');
    assert.deepEqual(when.evaluations, [{ op: 'when', task: '_opened_' }, { op: 'and', task: '_incity_' }]);
    const startQuest = reported.actions.find((a) => a.typeName === 'StartQuest');
    assert.equal(startQuest?.questName, MAIN_QUEST_OPENER);
    assert.ok(reported.actions.at(-1).typeName === 'EndQuest', 'the start ends with the hand-off');
    // only the hand-off starts a quest, and nothing runs on a clock: no deadline, no failure, no letter on a timer
    const starters = [...quest.tasks.values()].flatMap((t) => t.actions.filter((a) => a.typeName === 'StartQuest' || a.typeName === 'RunQuest').map(() => t.symbol?.name));
    assert.deepEqual(starters, ['reported']);
    assert.deepEqual([...quest.resources.values()].filter((r) => r.isClock).map((r) => r.symbol.name), [], 'no clock: the player\'s watch');
    // its words fit the classic skin's box, and are written in American spelling - a
    // rumor is a talk line the window wraps, never a box's row
    const qrc = lines.slice(0, lines.findIndex((l) => /^\s*QBN:/i.test(l))).filter((l) => !l.trimStart().startsWith('--'));
    let rumor = false;
    const rows = qrc.filter((l) => { if (/^\S.*:\s+\[?\d+\]?\s*$/.test(l)) { rumor = /^Rumors/i.test(l); return false; } return !rumor && l.trim(); });
    assert.ok(rows.length > 40, 'the messages read');
    const long = rows.filter((l) => l.replace(/^<ce>\s*/, '').trim().length > ROW_CHARS);
    assert.deepEqual(long, [], `rows at most ${ROW_CHARS} characters`);
    // and each says itself in one box: DFU's quest box closes on the line past its 22 (quest.js chunkMessageTokens), and a
    // letter longer than that leaves its signature alone in a second (the first draft's 24 rows did, in the real game)
    const split = [...quest.messages.keys()].filter((id) => chunkMessageTokens(quest.getMessage(id).getTextTokens(-1, () => 0)).length > 1);
    assert.deepEqual(split, [], 'one box a message');
    assert.doesNotMatch(qrc.join('\n'), /\b(armour|harbour|colour|honour|favour|rumour|grey|centre|travell)/i);
  });
}

// ── the Bay's start, played ──────────────────────────────────────

test('START1 the Bay: the wake, and the commission at Privateer\'s Hold\'s item marker; a hundred and twenty days in the Hold start nothing of the main quest (mutants: the placement dropped, the wake\'s second page dropped)', () => {
  const b = bay();
  const q = b.m.startQuestByName(BAY_START_QUEST);
  b.tick(2);
  assert.deepEqual(b.said.map((s) => s.quest), ['_STARTIB', '_STARTIB'], 'two pages at the wake');
  assert.match(b.said[0].text, /^You wake and look around the room\. Some hours ago, you were in a boat, en route to Daggerfall/, 'DFU\'s own waking');
  assert.doesNotMatch(b.said[0].text, /begin the Emperor's quest/, 'its last sentence left out: the quest is not begun by leaving');
  assert.match(b.said[1].text, /oilskin case that held the Emperor's sealed commission/);
  assert.deepEqual(logOf(q), [[0, 1010]]);
  assert.match(textOf(q, 1010), /may have washed up somewhere in Privateer's Hold\./, 'the journal names the Hold');
  assert.deepEqual(b.discovered, ["Privateer's Hold"], 'and the travel map shows it, wherever the start stood the player');
  const hold = q.getPlace({ name: 'hold' });
  assert.equal(hold.siteDetails.siteType, SITE_TYPES.Dungeon);
  assert.equal(hold.siteDetails.mapId, PRIVATEERS_HOLD_MAP_ID);
  assert.deepEqual(hold.siteDetails.selectedMarker.targetResources?.map((s) => s.name), ['commission'], 'the commission stands at the Hold\'s item marker');
  assert.deepEqual(hold.siteDetails.selectedMarker.flatPosition, { x: HOLD_ITEM_MARKER[0] * 0.025, y: -HOLD_ITEM_MARKER[1] * 0.025, z: HOLD_ITEM_MARKER[2] * 0.025 });
  b.said.length = 0;
  b.now.s += 120 * DAY;
  b.tick(5);
  b.at('city');
  b.tick(5);
  assert.deepEqual(b.live(), ['_STARTIB'], 'no _BRISIEN, no S0000999, in the Hold or in Daggerfall itself: nothing of the main quest before the seal is broken');
  assert.deepEqual(b.said, []);
});

test('START1 the Bay: found, then opened in the Hold - its journal steps in turn; the city is revealed; outside Daggerfall nothing starts; in its streets the start says so, starts _BRISIEN and ends, its letter gone with it; and _BRISIEN wakes nobody - no 1025 - but starts the main quest\'s driver and Lady Brisienna\'s clock (mutants: the found task\'s entry, the reveal, the city\'s half of the gate, the start of _BRISIEN, the patch)', () => {
  const b = bay();
  const q = b.m.startQuestByName(BAY_START_QUEST);
  b.tick(2);
  b.said.length = 0;
  const item = q.getItem({ name: 'commission' });
  // taken from the pile (itemTransfer.js sendQuestItemClick), into the pack
  item.setPlayerClicked();
  b.pack.add('commission');
  b.tick(1);
  assert.deepEqual(b.said.map((s) => s.quest), ['_STARTIB']);
  assert.match(b.said[0].text, /you find the oilskin case\. The commission is inside, dry, its seal unbroken\./);
  assert.deepEqual(logOf(q), [[1, 1011]], 'found: the wreck\'s entry gives way');
  assert.equal(item.actionWatching, true, 'the use is watched (useItem.js sets useClicked)');
  b.said.length = 0;
  // opened (useItem.js: a watched quest letter's use)
  item.useClicked = true;
  b.tick(1);
  assert.deepEqual(logOf(q), [[2, 1012]]);
  assert.match(textOf(q, 1012), /I am to make for the city of Daggerfall, where his agent will find me\./);
  assert.deepEqual(b.discovered, ["Privateer's Hold", 'Daggerfall'], 'the city on the travel map');
  assert.deepEqual(b.live(), ['_STARTIB'], 'opened in the Hold: the orders are read, the main quest not yet begun');
  b.at('wilds');
  b.tick(5);
  assert.deepEqual(b.live(), ['_STARTIB'], 'nor anywhere but Daggerfall');
  assert.deepEqual(b.said, []);
  b.at('city');
  b.tick(1);
  assert.deepEqual(b.said.map((s) => s.quest), ['_STARTIB']);
  assert.match(b.said[0].text, /^You have reached Daggerfall, as the Emperor's orders bade you, and as they also bade you, you burn them\./);
  b.tick(4);
  assert.equal(b.quest('_STARTIB'), null, 'the start has ended');
  assert.ok(b.removed.some((it) => it?.questSymbol?.name === 'commission' || it === item.daggerfallUnityItem), 'and its letter left the pack with it (Item.dispose)');
  const brisien = b.quest('_BRISIEN');
  assert.ok(brisien, '_BRISIEN runs');
  assert.ok(b.quest('S0000999'), 'its persisting block started the main quest\'s driver');
  assert.equal(brisien.resources.get('invitepc').clockEnabled, true, 'and Lady Brisienna\'s 7-14 days, from the city of Daggerfall');
  assert.ok(!b.said.some((s) => s.quest === '_BRISIEN'), 'and showed nothing: the classic waking is the start\'s, told days or months before');
  // the outcome the chronicle files
  const sheet = sheetFor('_STARTIB');
  assert.equal(outcomeNow(q, sheet)?.id, 'reported');
});

test('START1 the Bay: opened in Daggerfall\'s streets, _BRISIEN begins at once - and a letter opened, then carried away and back, still hands on once (mutants: the gate read as "or")', () => {
  const b = bay();
  const q = b.m.startQuestByName(BAY_START_QUEST);
  b.tick(2);
  const item = q.getItem({ name: 'commission' });
  item.setPlayerClicked();
  b.pack.add('commission');
  b.tick(1);
  b.at('city');
  b.tick(3);
  assert.deepEqual(b.live(), ['_STARTIB'], 'in the city, sealed: nothing');
  item.useClicked = true;
  b.tick(4);
  assert.equal(b.quest('_STARTIB'), null);
  assert.ok(b.quest('_BRISIEN') && b.quest('S0000999'));
  assert.equal([...b.m.quests.values()].filter((x) => x.questName === '_BRISIEN').length, 1, 'one opener');
});

test('START1 the sheet: what the Quests page shows at each step - the find marked on the Hold, the opening once it is held, the order marked on Daggerfall once read (mutants: the find\'s mark, the order\'s open)', () => {
  const b = bay();
  const q = b.m.startQuestByName(BAY_START_QUEST);
  const sheet = sheetFor('_STARTIB');
  const states = () => Object.fromEntries(readObjectives(q, sheet).map((o) => [o.id, o.state]));
  b.tick(2);
  assert.deepEqual(states(), { find: 'open', open: 'hidden', report: 'hidden' });
  assert.deepEqual(readObjectives(q, sheet).map((o) => o.mark), ['hold', null, 'daggerfall']);
  q.getItem({ name: 'commission' }).setPlayerClicked();
  b.tick(1);
  assert.deepEqual(states(), { find: 'done', open: 'open', report: 'hidden' });
  q.getItem({ name: 'commission' }).useClicked = true;
  b.tick(1);
  assert.deepEqual(states(), { find: 'done', open: 'done', report: 'open' });
  assert.equal(outcomeNow(q, sheet), null, 'no outcome before Daggerfall');
  // _BRISIEN's sheet tells the days between: the wait for her letter
  const bs = sheetFor('_BRISIEN');
  assert.deepEqual(bs.objectives.map((o) => o.id), ['wait', 'meet']);
  assert.equal(bs.objectives.find((o) => o.id === 'wait').text, 'Wait for the Emperor\'s agent in Daggerfall to send for you');
});

test('START1 the save: a game saved with the commission found and sealed loads with it sealed, and the load\'s letter opens the main quest as the first would (mutants: the watch on the letter dropped)', () => {
  const b = bay();
  const q = b.m.startQuestByName(BAY_START_QUEST);
  b.tick(2);
  q.getItem({ name: 'commission' }).setPlayerClicked();
  b.tick(2);
  const saved = JSON.parse(JSON.stringify(b.m.getSaveData()));
  const b2 = bay({ now: { s: b.now.s } });
  b2.m.restoreSaveData(saved);
  const q2 = b2.quest('_STARTIB');
  assert.ok(q2, 'the start, loaded');
  assert.deepEqual(logOf(q2), [[1, 1011]]);
  b2.at('city');
  b2.tick(3);
  assert.deepEqual(b2.live(), ['_STARTIB'], 'sealed still');
  q2.getItem({ name: 'commission' }).useClicked = true;
  b2.tick(4);
  assert.ok(b2.quest('_BRISIEN') && !b2.quest('_STARTIB'));
});

test('START1 the old saves: a game begun before START1 holds _BRISIEN and no start - its load starts no start, and its _BRISIEN keeps the start-up it was saved with', () => {
  const b = bay();
  // a pre-START1 game: DFU's start, _BRISIEN begun at the character's creation from its as-shipped script
  const unpatched = new QuestMachine({ ...b.deps, getQuestSourceLines: (n) => (n === '_BRISIEN' ? BRISIEN_DFU.split(/\r?\n/) : questSource(n)) });
  const said = [];
  unpatched.deps.showPopup = (q) => said.push(q.questName);
  unpatched.startQuestByName('_BRISIEN');
  unpatched.tick();
  assert.deepEqual(said, ['_BRISIEN'], 'the classic waking, as it was');
  const saved = JSON.parse(JSON.stringify(unpatched.getSaveData()));
  const b2 = bay();
  b2.m.restoreSaveData(saved);
  b2.tick(3);
  assert.ok(b2.quest('_BRISIEN'), 'its main quest goes on');
  assert.equal(b2.quest('_STARTIB'), null, 'no start is begun for it');
  const say = [...b2.quest('_BRISIEN').tasks.values()].find((t) => t.type === TaskType.Headless).actions.find((a) => a.typeName === 'Say');
  assert.ok(say?.isComplete, 'the saved start-up, whole: its say kept, already said');
});

// ── the patch over _BRISIEN ──────────────────────────────────────

test('START1 the patch: _BRISIEN as the pack reads it is our own file (OWN-WORDS2) with its start-up\'s `say 1025` out and nothing else; the wreck (AUDIT STARTS Q3) is told as no player\'s own - its journal has no cave, its letter no accident at sea - in our words themselves, so the patch keeps only its QBN half; the vendored file is untouched; message 1025 itself stays (mutants: the patch dropped; the wreck kept)', () => {
  assert.equal(typeof QUEST_PATCHES._BRISIEN, 'function');
  const own = rd('src/systems/quest/own/_BRISIEN.txt');
  const patched = applyQuestPatches('_BRISIEN', own);
  assert.match(BRISIEN_DFU, /\tpc at PiratesHold set _exitstarter_ \n\tsay 1025 \n/, 'DFU\'s, verbatim (vendor/dfu-quests/README.md)');
  assert.match(own, /\tpc at PiratesHold set _exitstarter_ \n\tsay 1025 \n/, 'our file keeps DFU\'s QBN byte for byte');
  assert.doesNotMatch(patched, /^\s*say 1025\b/m);
  assert.equal(patched, own.replace('\tsay 1025 \n', ''), 'that line and nothing else');
  assert.equal(applyQuestPatches('_BRISIEN', BRISIEN_DFU), BRISIEN_DFU.replace('\tsay 1025 \n', ''), 'and on DFU\'s file, the same line alone');
  const message = (from, to) => patched.slice(patched.indexOf(from), patched.indexOf(to));
  const entry = message('QuestLogEntry:  [1010]', 'Message:  1011'), letter = message('Message:  1020', 'Message:  1021');
  assert.doesNotMatch(entry + letter, /storm|ship|cave|accident|\bsea\b/i, 'no wreck told as every player\'s');
  assert.match(letter, /I hear you have reached the Iliac Bay,\n safe and well\./, 'her letter true of every start');
  assert.match(patched, /^Message:\s+1025$/m, 'its words kept: nothing else reads them');
  assert.deepEqual(questSource('_BRISIEN'), patched.split(/\r?\n/), 'and the node twin of the pack reads it so');
});

// ── the welcome tour ─────────────────────────────────────────────

test('START1 the welcome tour says the main story waits on the commission (bible/10-UI/Voice.md rule 7: the capital unnamed) - START2: whichever start the character chose, so it names none', () => {
  const body = tutorialById('welcome').body.join(' ');
  assert.match(body, /Your story begins with the Emperor's sealed orders, your commission\. When you hold them, open them from your pack: they name the city where the main story begins\./);
  assert.doesNotMatch(body, /cave|shipwreck|Privateer/i, 'no one start\'s words');
  assert.doesNotMatch(body, /daggerfall/i);
});

// ── the game's own data ──────────────────────────────────────────

const ARENA2 = process.env.ARENA2_PATH;
const skipReal = !ARENA2 || !existsSync(join(ARENA2, 'MAPS.BSA')) ? 'ARENA2_PATH not set or missing - real-data validation skipped' : false;

test('START1 on the game\'s data: the Hold is Privateer\'s Hold and the commission stands at its block\'s one item marker; the city is Daggerfall; and _BRISIEN, begun there, draws Lady Brisienna\'s tavern in the region of Daggerfall, as her letter says', { skip: skipReal }, async () => {
  const { MapsFile } = await import('../../../src/formats/mapsFile.js');
  const { BlocksFile } = await import('../../../src/formats/blocksFile.js');
  const { FactionFile } = await import('../../../src/formats/factionFile.js');
  const bytes = (n) => new Uint8Array(readFileSync(join(/** @type {string} */ (ARENA2), n)));
  const maps = new MapsFile(); maps.load(bytes('MAPS.BSA'), bytes('CLIMATE.PAK'), bytes('POLITIC.PAK'));
  const blocks = new BlocksFile(); blocks.load(bytes('BLOCKS.BSA'));
  const factions = new FactionFile(); factions.load(bytes('FACTION.TXT'));
  const region = maps.getRegion(17);
  const indexOf = (name) => { for (let l = 0; l < region.locationCount; l++) if (maps.getLocation(17, l).name === name) return l; return -1; };
  const where = { l: indexOf("Privateer's Hold"), inside: { dungeon: true } };
  const city = indexOf('Daggerfall');
  assert.ok(where.l >= 0 && city >= 0);
  const world = {
    maps, getBlock: (n) => blocks.getBlockByName(n), getFactionData: (id) => factions.factionDict.get(id) ?? null,
    currentLocation: () => maps.getLocation(17, where.l), playerInside: () => where.inside, isPlayerInLocationRect: () => !where.inside,
    currentRegionIndex: () => 17, currentLocationIndex: () => where.l, discoverLocation: () => {}, mountCurrentSiteQuestResources: () => {},
  };
  const now = { s: 1e6 };
  const m = packMachine({ nowSeconds: () => now.s, skySeconds: () => 100 * DAY + 12 * 3600, world, showPopup() {}, isPlayerInTown: () => !where.inside, carriesQuestItem: () => true });
  const tick = (n) => { for (let i = 0; i < n; i++) { now.s += 60; m.tick(); } };
  const q = m.startQuestByName(BAY_START_QUEST);
  tick(2);
  const hold = q.getPlace({ name: 'hold' }).siteDetails;
  assert.equal(hold.locationName, "Privateer's Hold");
  assert.equal(hold.mapId >>> 0, PRIVATEERS_HOLD_MAP_ID);
  assert.equal(hold.questItemMarkers.length, 1, 'the Hold holds one item marker');
  assert.deepEqual(hold.selectedMarker.flatPosition, { x: 35.7, y: 45.6, z: 42.475 }, 'S0000999.RDB\'s, the commission on it');
  assert.deepEqual(hold.selectedMarker.targetResources.map((s) => s.name), ['commission']);
  const town = q.getPlace({ name: 'daggerfall' }).siteDetails;
  assert.deepEqual([town.locationName, town.siteType, town.regionName], ['Daggerfall', SITE_TYPES.Town, 'Daggerfall']);
  const item = q.getItem({ name: 'commission' });
  item.setPlayerClicked(); tick(1);
  item.useClicked = true; tick(1);
  where.inside = null; where.l = city;
  tick(4);
  const brisien = [...m.quests.values()].find((x) => x.questName === '_BRISIEN' && !x.questTombstoned);
  assert.ok(brisien, '_BRISIEN, begun in Daggerfall\'s streets');
  const inn = brisien.getPlace({ name: 'dirtypit' }).siteDetails;
  assert.equal(inn.siteType, SITE_TYPES.Building);
  assert.equal(inn.regionName, 'Daggerfall', '"_dirtypit_ in __dirtypit_ of Daggerfall" (her letter, 1020)');
  assert.notEqual(inn.locationName, 'Daggerfall', 'a remote tavern: another town than the one she is asked from');
  tick(2);
  assert.ok([...m.quests.values()].some((x) => x.questName === 'S0000999' && !x.questTombstoned), 'and the main quest\'s driver, on the game\'s own factions');
  assert.ok(![...m.quests.values()].some((x) => x.questName === BAY_START_QUEST && !x.questTombstoned), 'the start ended');
});

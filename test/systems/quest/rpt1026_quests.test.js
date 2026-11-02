// RPT1026-QUESTS (the private report inbox, 2026-10-26 - the batch's Field-Bugs page): the quest reports, read to their
// roots. Each pin below names the report family it answers and the mutants (tools/mutants/rpt1026_quests.json) it kills.
//
// ABANDON-ALWAYS (The Lost Artifact shared in a party: the knight paid, its objectives all struck, and the quest beyond
// abandoning - the guild's door shut by it; a Knights of the Dragon whose questor said a quest was already held while the
// log showed none to abandon; a Mages Guild that refused a new quest to a member with none to do). A quest whose
// questor is the NPC the player clicked shuts that questor's door while it runs
// (DFU's IsLastNPCClickedAnActiveQuestor - machine.js lastNPCClickedQuestorOf). B0B81Y02's knight writes `remove log
// step 0` with the reward and the quest runs on (RAVEN-CLOSE closes it online on the short wait now); N0B21Y14 writes its
// first entry only when its letter is read. A quest with nothing in its journal was no row the player could abandon: the
// bridge's walk dropped DFU's, and AUDIT QUESTLINES UI-8 drew no Abandon on a stamped one's row. Now every quest that
// holds its questor's door is a row with its Abandon, one set aside so is an Abandoned row with its Reclaim, and the
// questor's close says where the way out is.
//
// Driven through the real quest bridge (createQuestBridge - its machine, lists, offer flow and walk) on the guide suites'
// world, the questor bound by the machine at the accept, the pause window's real Quests tab on the minimal DOM.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Node_ } from '../../chargenDom.mjs';   // the minimal DOM - globals (the pause window mounts on it)
import { makeWorld } from '../../guideWorld.mjs';   // loads the vendored quest tables too
import { createQuestBridge, questorBusyRows } from '../../../src/scenes/quest/questBridge.js';
import { QuestMachine, QUEST_MESSAGES, holdsQuestorDoor } from '../../../src/systems/quest/machine.js';
import { GUILD_GROUPS } from '../../../src/formats/factionFile.js';
import { mountEnhancedMenu } from '../../../src/ui/enhanced/enhancedMenu.js';
import { unloggedRail, shelvedRail } from '../../../src/ui/quest/questRail.js';
import { setPref } from '../../../src/systems/uiPrefs.js';
import { TRACKER_PREF, _resetQuestTrackerForTests } from '../../../src/ui/quest/questTracker.js';
import { readFileSync } from 'node:fs';
import { SITE_TYPES } from '../../../src/systems/quest/place.js';
import { addQuestResourceObjects, markerScenePosition, siteMarkerSpots, standSpot, buildingStandSpot, crowdOf, besideSpot, QUEST_BESIDE_REACH, MARKER_FLOOR_REACH } from '../../../src/systems/quest/sceneMount.js';
import { _resetWorldDataReplacement, installWorldDataReplacement } from '../../../src/formats/worldData/worldDataReplacement.js';
import { _resetLayoutPins } from '../../../src/systems/layoutPins.js';
import { Collider } from '../../../src/player/collider.js';
import { templateByIndex } from '../../../src/systems/item/itemTemplates.js';
import { BUILDING_TYPES } from '../../../src/world/buildingNames.js';
import { rmbBlock, town, worldOf, mark, SPAWN } from '../../fb1004dTowns.mjs';
import { mapPixelToWorldCoord, mapPixelToLongitudeLatitude } from '../../../src/formats/mapsFile.js';
import { setWildMask, buildWildMask, wildMask, wildInside, WILD_REGION } from '../../../src/systems/wild/wildZone.js';
import { linkSiteOf } from '../../../src/systems/quest/machine.js';
import { createArenaOnline, CLIMB_WAIT_MS } from '../../../src/scenes/arena/arenaOnline.js';
import { ARENA_TEXT } from '../../../src/systems/arena/arenaText.js';
import { arenaBoutRoom } from '../../../src/net/arena/arenaLaw.js';
import { mintArenaReceipt } from '../../../src/net/arena/arenaReceipt.js';
import { standService } from '../../accountDb.mjs';
import { QUESTLINES_PREF, questlinesOn } from '../../../src/systems/questlines/qlLaw.js';
import { questSource as qlQuestSource, loadTables as loadQlTables, ROOT as QL_ROOT } from '../../qlSources.mjs';
import { addItem } from '../../../src/systems/inventory.js';
import { keepsQuestItem } from '../../../src/systems/item/itemTransfer.js';
import { useItem } from '../../../src/systems/useItem.js';
import { join } from 'node:path';
import { createBountyHost, bountyGroups } from '../../../src/scenes/bountyHost.js';
import { bountySites, boardPostings } from '../../../src/systems/bounty/bountyBoard.js';
import { tutorialById } from '../../../src/systems/tutorials.js';

void Node_;
// NO LIVE TIMER RUNS HERE (GUIDE2's law): the tab's intervals are recorded, never run
globalThis.setInterval = () => 0;
globalThis.clearInterval = () => {};
const quiet = (fn) => { const w = console.warn, l = console.log; console.warn = () => {}; console.log = () => {}; try { return fn(); } finally { console.warn = w; console.log = l; } };

// ── ABANDON-ALWAYS ─────────────────────────────────────────────────────────────────────────────────────────────────

/** B0B81Y02's shape at the knight's word (`_success_: when _S.02_ and _S.01_ / give pc nothing / remove log step 0`, and
 *  the quest running on under `_2dung_`): a guild quest whose questor is the NPC clicked at the offer, its journal's one
 *  entry taken back by the very task that pays it. */
const questSource = (name) => [
  `Quest: ${name}`, 'DisplayName: The Lost Errand', 'QRC:',
  `QuestorOffer:  [${QUEST_MESSAGES.QuestorOffer}]`, '<ce> Would you slay the thing?', '',
  `RefuseQuest:  [${QUEST_MESSAGES.RefuseQuest}]`, '<ce> Bah.', '',
  `AcceptQuest:  [${QUEST_MESSAGES.AcceptQuest}]`, '<ce> Good.', '',
  'Message:  1010', '%qdt:', ' I am to slay the thing.', '',
  'QBN:', 'Person _qgiver_ group Questor', '',
  '--\tQuest start-up:', '\tlog 1010 step 0', '',
  'variable _slain_',
  '_told_ task:', '\tclicked npc _qgiver_', '',
  '_success_ task:', '\twhen _told_ and _slain_', '\tgive pc nothing', '\tremove log step 0', '',
];
const LIST_HEAD = 'schema: *name, group, membership, minReq, flag, notes';
const GIVER = Object.freeze({ rawX: 10, rawY: 0, rawZ: 20, position: 1234, factionID: 849, flags: 0, textureArchive: 182, textureRecord: 3 });
const HALL = Object.freeze({ mapId: 111, locationIndex: 0, buildingKey: 33 });
const FIGHTERS = { id: 849, parent: 0, type: 2, name: 'The Fighters Guild', sgroup: 0, ggroup: GUILD_GROUPS.FightersGuild, flat1: 0, flat2: 0, race: -1 };

function makeBridge() {
  const world = { ...makeWorld(), getFactionData: (id) => (id === FIGHTERS.id ? FIGHTERS : null) };
  const bridge = createQuestBridge({
    data: {
      readListTable: (n) => (n === 'Classic' ? [LIST_HEAD, '__LST, FightersGuild, M, 0, 0, x'].join('\n') : null),
      getQuestSourceLines: (n) => (n === '__LST' ? questSource('__LST') : null),
    },
    world,
    classicSeconds: () => 0,
    playerEntity: { name: 'Hero Proudfoot', level: 3, gender: 'male' },
    getReputation: () => 0,
    dateTimeString: () => '13:30:00 on 4th of Morning Star, 3E405',
    midDateTimeString: () => '13:30:00 04 Morning Star 3E405',
    cityName: () => 'Bigtown',
  });
  bridge.giver = { ...GIVER };
  return bridge;
}
const askGuild = (bridge) => bridge.offerGuildQuest({ guildGroup: GUILD_GROUPS.FightersGuild, guild: { factionId: 41, name: 'Fighters Guild' }, membership: { factionId: 41, rank: 0 }, reputation: 0 });
const tick = (bridge, n = 3) => quiet(() => { for (let i = 0; i < n; i++) bridge.machine.tick(); });

/** The errand taken at the hall, its thing slain and the giver told: paid, its journal empty, still running. */
function paidAndUnwritten() {
  const bridge = makeBridge();
  bridge.clickNpc(bridge.giver, HALL);
  const offer = askGuild(bridge);
  assert.equal(offer.kind, 'offer');
  assert.equal(offer.respond(true).kind, 'accepted');
  const [quest] = bridge.machine.quests.values();
  tick(bridge);
  assert.equal(quest.getLogMessages().length, 1, 'its first entry, written at the start');
  quest.getTask({ name: 'slain' }).setTriggerValue(true);
  bridge.clickNpc(bridge.giver, HALL);   // back at the hall: the giver told
  tick(bridge);
  return { bridge, quest };
}

test('ABANDON-ALWAYS: a quest paid with its journal taken back still shuts its questor\'s door - and is a row of the Quests tab, with its Abandon; abandoned, the door opens and it is an Abandoned row with its Reclaim (mutants: the walk drops it; the predicate reads any questor; Abandon off an entryless row; no row set aside)', async () => {
  const { bridge, quest } = paidAndUnwritten();
  assert.equal(quest.questSuccess, true, 'paid (`give pc nothing`)');
  assert.equal(quest.questComplete, false, 'still running');
  assert.equal(quest.getLogMessages().length, 0, 'its journal empty (`remove log step 0`)');
  assert.equal(holdsQuestorDoor(quest), true, 'its questor is the giver clicked');
  bridge.clickNpc(bridge.giver, HALL);
  assert.equal(askGuild(bridge).kind, 'close', 'the hall\'s door shut: DFU\'s law');
  const log = bridge.questLog();
  assert.deepEqual(log.active, [], 'no entry, no logged row');
  assert.deepEqual(log.unlogged.map((r) => [r.id, r.name, r.ql]), [[String(quest.uid), 'The Lost Errand', null]], 'DFU\'s quest - no sheet - is a row by its name');
  assert.equal(unloggedRail(log)[0].key, `a:${quest.uid}`);
  // the Quests tab draws its Abandon, and the press gives it up
  setPref(TRACKER_PREF, true);
  _resetQuestTrackerForTests();
  const host = globalThis.document.createElement('div');
  globalThis.document.body.append(host);
  const menu = mountEnhancedMenu(host, { mode: 'pause', hooks: { questLog: () => bridge.questLog(), journalClean: () => bridge.journalClean }, onAction: () => {}, at: 'quests' });
  try {
    const buttons = () => host.querySelectorAll('*').filter((n) => n.tagName === 'BUTTON');
    const row = buttons().find((b) => String(b.className).includes('px-qrow') && b.textContent.includes('The Lost Errand'));
    assert.ok(row, 'the row, under Side Quests');
    row.click();
    const detail = host.querySelectorAll('.px-qdetail')[0];
    assert.ok(detail.textContent.includes('Nothing is written in your journal for this quest yet.'), 'said, not blank');
    const press = () => detail.querySelectorAll('*').find((n) => n.tagName === 'BUTTON' && /Abandon quest|Click again to abandon/.test(n.textContent));
    assert.ok(press(), `Abandon drawn (${buttons().map((b) => b.textContent)})`);
    press().click();
    host.querySelectorAll('.px-qdetail')[0].querySelectorAll('*').find((n) => n.tagName === 'BUTTON' && /Click again to abandon/.test(n.textContent)).click();
  } finally { menu.unmount(); host.remove(); _resetQuestTrackerForTests(); }
  assert.ok(quest.shelvedAt != null, 'set aside');
  bridge.clickNpc(bridge.giver, HALL);
  assert.equal(askGuild(bridge).kind, 'offer', 'the hall offers work again');
  const after = bridge.questLog();
  assert.deepEqual(after.unlogged, []);
  assert.deepEqual(shelvedRail(after).map((r) => [r.key, r.name, r.entries.length]), [[`s:${quest.uid}`, 'The Lost Errand', 0]], 'an Abandoned row, so its Reclaim stands');
  assert.equal(bridge.journalClean.reclaim(quest.uid).ok, true);
  assert.deepEqual(bridge.questLog().unlogged.map((r) => r.id), [String(quest.uid)], 'reclaimed, a row again');
});

test('ABANDON-ALWAYS: what is NOT a row - a running quest with nothing written and no questor the player met (the main story\'s backbone, a letter\'s errand not taken from anyone) stays off the tab, as before (mutant: every entryless quest listed)', () => {
  const bridge = makeBridge();
  const silent = quiet(() => bridge.machine.parseQuestForLists(['Quest: __SIL', 'DisplayName: Behind the Curtain', 'QRC:', 'Message:  1010', 'A line.', '', 'QBN:', 'variable _x_'], 0));
  assert.ok(silent);
  quiet(() => bridge.machine.startQuestImmediate(silent));
  tick(bridge);
  assert.equal(holdsQuestorDoor(silent), false, 'no questor of a click');
  // nor a questor the script names (`add _x_ as questor` leaves C#'s zero struct): its Person's questorData unbound
  assert.equal(holdsQuestorDoor({ resources: new Map([['q', { isPerson: true, isQuestor: true, questorData: { hash: 0, nameSeed: 0, mapID: 0, buildingKey: 0 } }]]) }), false);
  const log = bridge.questLog();
  assert.deepEqual([log.active.length, log.unlogged.length, log.shelved.length], [0, 0, 0]);
});

test('ABANDON-ALWAYS: the questor\'s close names the way out - a row of its own under the work, the player\'s language (mutant: the second row dropped)', () => {
  const { bridge, quest } = paidAndUnwritten();
  bridge.clickNpc(bridge.giver, HALL);
  const step = askGuild(bridge);
  assert.equal(step.quest, quest);
  assert.deepEqual(bridge.offerBoxes(step, () => [])[0].rows.map((r) => r.text), [
    'You have not finished the work you were given here: The Lost Errand.',
    'If you cannot finish it, you can abandon it from the Quests tab of the pause menu.',
  ]);
  assert.equal(questorBusyRows(null).length, 2);
});

// ── QUEST-CROWD ────────────────────────────────────────────────────────────────────────────────────────────────────
// A private report: two quests (the tutorial's run of starter quests among them) that met at one person's place left
// only one of them there. Two quests whose Places took one building each draw their own marker (Place.cs GetSiteMarker); drawn the
// same, DFU stands both Persons on it - one billboard over the other, one pick box. Two quests take one building where
// both drew their sites before either ran (the questlines' board parses a line's first step to show its letter - its
// places drawn then, `offerQuest` - and takes it later; GetAllActiveQuestSites reads the running quests alone), or where
// the building is a guild hall (_isBuildingAssigned's own exemption). The stands below are worldModes.js's own source
// over a real Collider floor, lifted as fb1020c_crowdclear.test.js lifts them.

const CROWD_MAP = 4343;
const IDENTITY = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
/** A room: its floor 18 m by 12 m at y 0 in the parent frame (x 92..110, z 44..56), the building's frame 100 m east and
 *  50 m north of it, one enter marker by the west wall, nobody of the room's own standing. */
function room() {
  const collider = new Collider(() => -Infinity);
  collider.addMesh('room', new Float32Array([92, 0, 44, 110, 0, 44, 110, 0, 56, 92, 0, 56]), new Uint32Array([0, 1, 2, 0, 2, 3]), IDENTITY);
  return { collider, parentPt: (x, y, z) => [x + 100, y, z + 50], enterMarkers: [[93, 0, 50]], billboardBatches: [], people: [] };
}
/** worldModes.js's building quest stands, lifted out and run over `ctx` (fb1020c_crowdclear.test.js's lift). */
function liftInteriorStands(ctx) {
  const WM = readFileSync(new URL('../../../src/scenes/worldModes.js', import.meta.url), 'utf8');
  const cut = (start, end) => {
    const a = WM.indexOf(start);
    assert.ok(a >= 0, `worldModes.js: ${start.trim()}`);
    return WM.slice(a, WM.indexOf(end, a) + end.length);
  };
  const source = [
    cut('export const INTERIOR_MARKER_FEET_LIFT = ', ';\n').replace(/^export /, ''),
    cut('  const QUEST_ITEM_MARKER_SHIFT = ', ';\n'),
    cut('  function standQuestFlatIn(', '\n  }\n'),
    cut('  const standQuestFlat = ', ';\n'),
    cut('  const interiorStandSpots = ', '\n  };\n'),
    cut('  const questAdapter = {', '\n  };\n'),
    'return questAdapter;',
  ].join('\n');
  const questFlats = [];
  const deps = {
    questFlats, interiorCtx: ctx, interiorFoeStands: [], _enemyRestoreInProgress: false,
    interiorFoes: { spawnFoe: () => Promise.resolve() },
    questSceneCtx: () => ({ mapId: CROWD_MAP }), sceneBehaviours: () => questFlats.map((s) => s.behaviour),
    getTexture: async () => ({ recordCount: 1000 }), uploadRecord: () => {}, billboardSize: () => ({ w: 0.95, h: 2 }), drawnFlat: (a, r) => [a, r],
    renderer: { createBillboardBatch: (_a, _r, _size, at) => ({ at: at[0] }) }, rideSceneMarker: () => {},
    templateByIndex, markerScenePosition, siteMarkerSpots, standSpot, buildingStandSpot, MARKER_FLOOR_REACH,
  };
  return { adapter: new Function(...Object.keys(deps), source)(...Object.values(deps)), questFlats };
}
const MA = mark(SPAWN, 40, 0, 40);    // (101, 0, 51) in the parent frame
const MB = mark(SPAWN, 240, 0, 40);   // (106, 0, 51)
/** A quest that places its one Person at the town's House2. */
const personAt = (name, who) => [`Quest: ${name}`, 'QRC:', 'Message:  1011', ' x', '', 'QBN:',
  `Person _${who}_ group Questor`, 'Place _hall_ local house2', '', `\tplace npc _${who}_ at _hall_`, '', 'variable _done_'];

/** Two quests both drawn before either runs (the board's offer, then the take), each placing a Person at the one House2
 *  of `markers`, stood in its room: the Persons' drawn points, in the order the quests started. */
async function twoAtOneHall(markers) {
  _resetLayoutPins(); _resetWorldDataReplacement(); installWorldDataReplacement();
  const blocks = new Map([
    ['HALL.RMB', rmbBlock('HALL.RMB', [{ type: BUILDING_TYPES.House2, markers }])],
    ['FARM.RMB', rmbBlock('FARM.RMB', [{ type: BUILDING_TYPES.House1 }])],   // the Persons' remote homes (Person.cs AssignHomeTown)
  ]);
  const farm = town({ name: 'Ashford', locationIndex: 0, mapId: CROWD_MAP + 1, grid: ['FARM.RMB'] });
  const hall = town({ name: 'Aldleigh', locationIndex: 1, mapId: CROWD_MAP, grid: ['HALL.RMB'] });
  const machine = new QuestMachine({ nowSeconds: () => 0, world: worldOf({ locations: [farm, hall], blocks, current: hall }), getReputation: () => 0, changeReputation: () => {} });
  const quests = quiet(() => [personAt('__ANN', 'ann'), personAt('__BEA', 'bea')].map((src) => machine.parseQuestForLists(src, 0, { rolls: () => 0 })));
  for (const q of quests) quiet(() => machine.startQuestImmediate(q));
  quiet(() => machine.tick());
  const sites = quests.map((q) => q.getPlace({ name: 'hall' }).siteDetails);
  assert.equal(sites[0].buildingKey, sites[1].buildingKey, 'both took the one House2');
  assert.deepEqual(sites.map((sd) => sd.selectedMarker.flatPosition), sites.map(() => sites[0].questSpawnMarkers[0].flatPosition), 'both drew its first marker');
  const { adapter, questFlats } = liftInteriorStands(room());
  quiet(() => addQuestResourceObjects(machine, adapter, SITE_TYPES.Building, sites[0].buildingKey));
  await new Promise((resolve) => setImmediate(resolve));   // the billboards' async fill
  assert.equal(questFlats.length, 2, 'both Persons stand');
  return questFlats.map((s) => s.batch.at);
}
const near = (got, want, why) => assert.ok(Math.abs(got[0] - want[0]) < 1e-9 && Math.abs(got[2] - want[2]) < 1e-9, `${why}: ${got} vs ${want}`);

test('QUEST-CROWD: two quests\' Persons that drew one marker of one building no longer stand in one pick box - the second stands at the site\'s other spawn marker; with none (a tavern\'s single marker, 215 of 345), beside the first (mutants: the stands unread; a stand counted as its own crowd; beside never asked)', async () => {
  const [ann, bea] = await twoAtOneHall([MA, MB]);
  near(ann, [101, 0, 51], 'the first where DFU stands her');
  near(bea, [106, 0, 51], 'the second at the clear marker, a pick box of her own');
  const [a1, b1] = await twoAtOneHall([MA]);
  near(a1, [101, 0, 51], 'one marker only: the first on it');
  near(b1, [101 + 1.1 * 0.95, 0, 51], 'the second beside her, east - a box apart');
});

test('QUEST-CROWD: besideSpot - the first of eight spots a box and a tenth out that stands on the same floor, in plain line and clear; never through a wall, onto a table or past a ledge; none, null (mutants: the floor\'s height unread; the wall unread; the crowd unread)', () => {
  const floorTop = (y, x0, x1, z0, z1) => [new Float32Array([x0, y, z0, x1, y, z0, x1, y, z1, x0, y, z1]), new Uint32Array([0, 1, 2, 0, 2, 3])];
  const roomOf = (parts) => {
    const c = new Collider(() => -Infinity);
    parts.forEach(([v, i], n) => c.addMesh(`p${n}`, v, i, IDENTITY));
    return c;
  };
  const w = 1, at = [0, 0, 0], lift = 1.2;
  const someone = [{ stood: true, active: true, x: 0.1, y: 0, z: 0, width: 1 }];
  // an open floor: east, the first direction
  const open = roomOf([floorTop(0, -5, 5, -5, 5)]);
  assert.deepEqual(besideSpot(at, open, lift, w, someone).map((v) => Math.round(v * 1000) / 1000), [1.1, 0, 0]);
  // a table east (0.8 m up): passed over - north-east is still in the box of the one standing there, north is the first
  const table = roomOf([floorTop(0, -5, 5, -5, 5), floorTop(0.8, 0.8, 1.4, -0.3, 0.3)]);
  const north = besideSpot(at, table, lift, w, someone);
  assert.ok(Math.abs(north[0]) < 1e-9 && Math.abs(north[2] - 1.1) < 1e-9, `the floor beside the table: ${north}`);
  // a wall a step east of the spot, the room past it floored too: never through it
  const wall = [new Float32Array([0.5, 0, -5, 0.5, 3, -5, 0.5, 3, 5, 0.5, 0, 5]), new Uint32Array([0, 1, 2, 0, 2, 3, 0, 2, 1, 0, 3, 2])];
  const walled = roomOf([floorTop(0, -5, 5, -5, 5), wall]);
  assert.ok(besideSpot(at, walled, lift, w, someone)[0] < 0.5, 'a spot this side of the wall');
  // nowhere clear (everyone round the spot): null - DFU's own spot stands
  const ring = [];
  for (let i = 0; i < 8; i++) for (const k of QUEST_BESIDE_REACH) ring.push({ stood: true, active: true, x: Math.cos(i * Math.PI / 4) * k, y: 0, z: Math.sin(i * Math.PI / 4) * k, width: 1 });
  assert.equal(besideSpot(at, open, lift, w, ring), null);
  // no floor under the spot itself: nothing to stand beside
  assert.equal(besideSpot([20, 0, 20], open, lift, w, someone), null);
});

test('QUEST-CROWD: crowdOf - a quest Person\'s stand drawn where it stands crowds, never the stand asking, one not drawn yet, an item\'s, a hidden or a gone one; nothing to add answers the room\'s own list (mutants: self, undrawn, items, hidden, dead)', () => {
  const person = { behaviour: { targetResource: { isPerson: true } }, batch: {}, x: 1, y: 0, z: 2, width: 0.9, active: true, dead: false };
  const item = { ...person, behaviour: { targetResource: { isItem: true } } };
  const own = [{ stood: true, x: 9, y: 0, z: 9, width: 1 }];
  assert.deepEqual(crowdOf(own, [person], null), [own[0], { stood: true, active: true, x: 1, y: 0, z: 2, width: 0.9 }]);
  assert.equal(crowdOf(own, [person], person), own, 'the stand asking is not its own crowd');
  assert.equal(crowdOf(own, [{ ...person, batch: null }], null), own, 'not drawn yet: its spot is not chosen');
  assert.equal(crowdOf(own, [item, { ...person, active: false }, { ...person, dead: true }], null), own);
  assert.equal(crowdOf(null, [], null), null);
});

// ── NO-GIVES-BACK ──────────────────────────────────────────────────────────────────────────────────────────────────
// A private report, Lord K'avar Part I (M0B11Y18): Sentinel's queen, handed the letter and answered No to reading it,
// would not speak again after. `_S.16_ task: toting _I.03_ and _ruler_ clicked` asks 1050
// ("Do you give the treasonous letter to _ruler_?") once - Prompt.cs's allowRearm false, the toting trigger answering
// true for a set task - and its No, `_S.20_ task: get item _I.03_`, only hands back the letter the toting took. The
// queen is the quest's (`_S.30_ clicked npc _ruler_`), so no talk window opens on her either: DFU's soft-lock on the
// loyal road. The asking and its No below are M0B11Y18's own lines, read out of the vendored script; the queen a stand-in
// Person of a town (Queen_Akorithi's `named` record wants FACTION.TXT), the first answer the queen's Yes as DFU has it.

const KAVAR = readFileSync(new URL('../../../vendor/dfu-quests/Quests/M0B11Y18.txt', import.meta.url), 'utf8').replace(/^﻿/, '').split(/\r?\n/);
/** A task's block of M0B11Y18, as written: its head and its indented lines. */
function kavarTask(name) {
  const at = KAVAR.findIndex((l) => l.startsWith(`${name} task:`));
  assert.ok(at >= 0, `M0B11Y18 ${name}`);
  const out = [KAVAR[at]];
  for (let i = at + 1; i < KAVAR.length && /^\s+\S/.test(KAVAR[i]); i++) out.push(KAVAR[i]);
  return out;
}
const queenQuest = () => ['Quest: __KAV', 'QRC:', 'Message:  1050', ...KAVAR.slice(KAVAR.indexOf('Message:  1050') + 1, KAVAR.indexOf('Message:  1051')), '', 'QBN:',
  'Item _I.03_ letter used 1031', 'Person _ruler_ face 1 group Resident1 local', 'Clock _patsy_ 30.00:00 0 flag 1 range 0 1', '',
  '--\tQuest start-up:', '\tget item _I.03_', '\tstart timer _patsy_', '',
  ...kavarTask('_S.16_'), '', ...kavarTask('_S.20_'), '', '_S.18_ task:', '\tgive pc nothing', ''];

test('NO-GIVES-BACK: the Queen of Sentinel asks again after a No that only hands the letter back - the next click toting it asks 1050 again, as often as it is refused, and a Yes goes on; the letter is in the pack after every No (mutants: the verdict unread; cleared before the letter came back; the No left set)', async () => {
  _resetLayoutPins(); _resetWorldDataReplacement(); installWorldDataReplacement();
  const blocks = new Map([['HALL.RMB', rmbBlock('HALL.RMB', [{ type: BUILDING_TYPES.House2 }])]]);
  const sentinel = town({ name: 'Sentinel', locationIndex: 0, mapId: CROWD_MAP + 7, grid: ['HALL.RMB'] });
  const held = new Set(), prompts = [];
  let q = null;
  const m = new QuestMachine({
    nowSeconds: () => 0, world: worldOf({ locations: [sentinel], blocks, current: sentinel }), getReputation: () => 0, changeReputation: () => {},
    showPrompt: (_q, message, respond) => prompts.push({ id: message.id, respond }),
    giveItemToPlayer: () => held.add('I.03'), carriesQuestItem: (r) => held.has(r.symbol?.name), releaseQuestItem: (_uid, r) => held.delete(r.symbol?.name),
  });
  q = quiet(() => m.parseQuestForLists(queenQuest(), 0, { rolls: () => 0 }));
  assert.ok(q, 'the script parses');
  quiet(() => m.startQuestImmediate(q));
  const tick = (n = 3) => quiet(() => { for (let i = 0; i < n; i++) m.tick(); });
  tick();
  assert.ok(held.has('I.03'), 'the letter in the pack');
  const queen = q.getResource({ name: 'ruler' });
  const click = () => { queen.setPlayerClicked(); tick(); };
  click();
  assert.deepEqual(prompts.map((p) => p.id), [1050], 'the toting click asks');
  assert.equal(held.has('I.03'), false, 'the toting took the letter (ReleaseQuestItemForReoffer)');
  prompts.at(-1).respond(false);
  tick(4);
  assert.ok(held.has('I.03'), 'No: `_S.20_` handed it back');
  assert.equal(q.getTask({ name: 'S.16' }).getTriggerValue(), false, 'the asking listens again');
  assert.equal(q.getTask({ name: 'S.20' }).getTriggerValue(), false, 'the No forgotten');
  click();
  assert.deepEqual(prompts.map((p) => p.id), [1050, 1050], 'the next click asks again');
  prompts.at(-1).respond(false);
  tick(4);
  assert.ok(held.has('I.03'), 'a second No hands it back again');
  click();
  assert.equal(prompts.length, 3, 'and asks a third time');
  prompts.at(-1).respond(true);
  tick(4);
  assert.equal(q.getTask({ name: 'S.18' }).getTriggerValue(), true, 'Yes: the loyal road');
  assert.equal(q.questSuccess, true);
  assert.equal(held.has('I.03'), false, 'the letter given');
  click();
  tick(4);
  assert.equal(prompts.length, 3, 'a Yes is final');
});

// ── QUEST-ZONE ─────────────────────────────────────────────────────────────────────────────────────────────────────
// A private report, a vampire quest: its dungeon lay near the middle of the Open World, unmarked on the map as any
// dungeon, and could not be entered. Every real dungeon inside the zone is sealed online (world.js
// wildDungeonGate) and its map draws only the day's halls; DFU's SelectRemoteDungeonSite drew any of the region's. The
// region below is the zone's (its map pixels region 16), the mask the map files' own (wildZone.js wildMaskOf); the quest
// world is kvarhold.test.js's shape: the player's town, then two Human Strongholds - one inside the zone's cut, one
// outside it - the nearest few both.

const ZONE_HOME = { x: 138, y: 70 };
const zoneLair = { position: 9000, rdbBlock: { objectRootList: [{ rdbObjects: [11, 18].map((record, i) => ({ type: 3, position: 100 + i * 8, xPos: 10, yPos: 4, zPos: 20, resources: { flatResource: { textureArchive: 199, textureRecord: record } } })) }] } };
/** The zone's region over map pixels x 100..199, y 50..149 (the cut keeps its north-east: x ~142..180, y 50..95). */
const zoneRegionAt = (x, y) => (x >= 100 && x < 200 && y >= 50 && y < 150 ? WILD_REGION : 0);
function zoneWorld(found = []) {
  const all = [{ kind: 'town', at: ZONE_HOME }, { kind: 'dungeon', at: { x: 145, y: 70 } }, { kind: 'dungeon', at: { x: 130, y: 70 } }];
  const locations = all.map((s, index) => {
    const wc = mapPixelToWorldCoord(s.at.x, s.at.y), ll = mapPixelToLongitudeLatitude(s.at.x, s.at.y);
    const dungeon = s.kind === 'dungeon';
    return {
      loaded: true, regionIndex: 0, regionName: 'Wrothgarian Mountains', name: `${s.kind}${s.at.x}`, locationIndex: index, hasDungeon: dungeon,
      mapTableData: { mapId: 7000 + index, locationType: dungeon ? 7 : 0, dungeonType: dungeon ? 2 : -1, longitude: ll.x, latitude: ll.y },
      exterior: { buildings: [], recordElement: { header: { x: wc.x, y: wc.y } }, exteriorData: { locationId: 0x700 + index, width: 0, height: 0, blockNames: [] } },
      dungeon: dungeon ? { blocks: [{ x: 0, z: 0, blockName: 'ZONEAA00.RDB' }] } : null,
    };
  });
  const region = { name: 'Wrothgarian Mountains', locationCount: locations.length, mapTable: locations.map((l) => ({ ...l.mapTableData })), mapNameLookup: new Map(locations.map((l, i) => [l.name, i])) };
  return {
    locations,
    maps: {
      regionCount: 1, getRegion: (r) => (r === 0 ? region : null), getLocation: (r, l) => (r === 0 ? locations[l] ?? null : null),
      getLocationByName: (rn, ln) => locations.find((l) => l.name === ln) ?? null, getRegionIndexAt: zoneRegionAt,
      readLocationIdFast: (r, l) => locations[l].exterior.exteriorData.locationId, getClimateIndex: () => 231,
    },
    getBlock: (name) => (name === 'ZONEAA00.RDB' ? zoneLair : null),
    currentLocation: () => locations[0], currentRegionIndex: () => 0, currentLocationIndex: () => 0, currentRegionName: () => 'Wrothgarian Mountains',
    isPlayerInLocationRect: () => true, playerInside: () => null, isHouseOwned: () => false,
    playerPixel: () => ({ ...ZONE_HOME }), buildingNameOpts: () => ({}),
    discoverLocation: (_r, location) => { found.push(location); }, addNote: () => {},
  };
}
/** WW-C2 (the fourth merge of main into #1184): the open zone the host's own mask (wildZone.js setWildMask - Cyrodiil's in
 *  the game), here the fixture's cut of its zone region: x 142..179, y 50..95. */
const zoneMask = () => buildWildMask({ width: 1000, height: 500, inZone: (x, y) => zoneRegionAt(x, y) === WILD_REGION && x >= 142 && x < 180 && y < 96 });
const zoneQuest = (lines) => ['Quest: __ZN', 'QRC:', 'Message:  1011', ' x', '', 'QBN:', ...lines, '', 'variable _pad_'];
const zoneRolls = (seed) => { let s = seed * 7919; return () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; }; };

test('QUEST-ZONE: online a quest\'s remote dungeon is never one the open zone seals - forty draws, the stronghold inside the cut never drawn, the one outside always; offline DFU\'s draw takes either (mutants: the seal unread; read offline too)', (t) => {
  t.after(() => setWildMask(null));   // the host's zone left as it was
  const world = zoneWorld();
  // PIN MOVED (the fourth merge of main into #1184 - WW-C2): the zone the host's (wildMask), stood here over the fixture's cut
  setWildMask(zoneMask());
  const mask = wildMask();
  assert.equal(wildInside(mask, 145, 70), true, 'the setup: inside the zone');
  assert.equal(wildInside(mask, 130, 70), false, 'and outside it');
  const draws = (online) => {
    const names = new Set();
    for (let seed = 1; seed <= 40; seed++) {
      const m = new QuestMachine({ nowSeconds: () => 0, world, playerLevel: () => 1, sharedClock: () => online });
      const q = quiet(() => m.scheduleQuest(zoneQuest(['Place _lair_ remote dungeon2']), 0, { rolls: zoneRolls(seed) }));
      names.add(q.getResource({ name: 'lair' }).siteDetails.locationName);
    }
    return [...names].sort();
  };
  assert.deepEqual(draws(true), ['dungeon130'], 'online: the sealed stronghold is no quest\'s');
  assert.deepEqual(draws(false), ['dungeon130', 'dungeon145'], 'offline: the mountains are Daggerfall\'s own');
});

test('QUEST-ZONE: a save whose remote dungeon the zone seals has it drawn again online at the load\'s re-seat (KVAR-HOLD\'s law): the foe carried, the link following, the reveal made again; offline it stays (mutants: the re-seat unwidened)', (t) => {
  t.after(() => setWildMask(null));   // the host's zone left as it was
  const found = [];
  const world = zoneWorld(found);
  setWildMask(zoneMask());   // PIN MOVED (WW-C2): the host's zone
  const build = (online) => {
    const m = new QuestMachine({ nowSeconds: () => 0, world, playerLevel: () => 1, sharedClock: () => online });
    const q = quiet(() => m.scheduleQuest(zoneQuest(['Place _lair_ remote dungeon2', '', 'Foe _vamp_ is Vampire', '', ' reveal _lair_', ' place foe _vamp_ at _lair_']), 0, { rolls: zoneRolls(3) }));
    quiet(() => { m.tick(); m.tick(); });
    const place = q.getResource({ name: 'lair' });
    // the save as a build before this one wrote it: the same draw, landed in the sealed stronghold
    const sealed = world.locations[1];
    place.siteDetails = { ...place.siteDetails, mapId: sealed.mapTableData.mapId, locationId: sealed.exterior.exteriorData.locationId, locationName: sealed.name };
    for (const link of m.siteLinks) if (link.questUID === q.uid) Object.assign(link, linkSiteOf(place));
    return { m, q, place };
  };
  const off = build(false);
  assert.equal(quiet(() => off.m.reseatMovedSites(world)), 0, 'offline: DFU\'s site stands');
  const on = build(true);
  found.length = 0;
  assert.equal(quiet(() => on.m.reseatMovedSites(world)), 1, 'online: drawn again');
  const sd = on.place.siteDetails;
  assert.equal(sd.locationName, 'dungeon130');
  assert.ok(sd.selectedMarker.targetResources.some((s) => s.name === 'vamp'), 'the foe carried to the new site');
  assert.ok(on.m.siteLinks.filter((l) => l.questUID === on.q.uid).every((l) => l.mapId === sd.mapId), 'the link follows');
  assert.deepEqual(found, ['dungeon130'], 'its reveal made again');
});

// ── ARENA-ORDER ────────────────────────────────────────────────────────────────────────────────────────────────────
// (two private reports: the arena questline's second bout, and the later bouts after it, on a floor with no opponent).
// The client's own arena half (createArenaOnline) over the real account service, the receipt the relay's own shape.

/** The account service's answer as net/accountClient.js call shapes it: the body on a 200, its `error` word otherwise. */
const asClient = (r) => (r.status === 200 ? { ok: true, data: r.body } : { ok: false, error: r.body?.error ?? 'server', status: r.status });
const turns = async (n = 40) => { for (let i = 0; i < n; i++) await new Promise((r) => setTimeout(r, 0)); };

test('ARENA-ORDER: a ladder win the service has not counted yet holds the next Fight at the Herald - past CLIMB_WAIT_MS no floor is entered for the step just fought (the empty floor, "not your next ladder bout"); the refusal carries the receipt again, and the climb it moves is the next Fight\'s (mutants: the guard dropped; the refusal carrying nothing)', async () => {
  const S = await standService();
  const who = await S.registered('Ladderfighter');
  let t = 1_000_000, reach = false;
  // AUDIT RPT1026 (the integration): the service's answers are SQLite and crypto, so a count of turns waits too little on a
  // loaded machine - settle waits until every call the arena made has answered, then lets its continuations run
  let inflight = 0;
  const track = (p) => { inflight++; return p.finally(() => { inflight--; }); };
  const settle = async () => { do await turns(); while (inflight > 0); await turns(); };
  const said = [], entered = [], attempts = [], asked = [], paid = [], sent = [];
  const session = { status: 'open', arenaOk: true, room: 'world:1,1', sendArena: (w) => { sent.push(w); return true; } };
  const A = createArenaOnline({
    now: () => t, session: () => session, say: (l) => said.push(l), guest: () => false, makeHall: () => ({ status: 'open', join() {}, leave() {}, sendArena: () => true }),
    bouts: { ask: (o) => asked.push(o), relayWord: () => true, dismiss() {}, holds: () => false, relay: () => null },
    account: {
      board: () => track((async () => asClient(await S.call('/v1/arena/board', {}, who.secret)))()),
      // the service out of reach until `reach` (a claim the way it fails online: net/accountClient.js's `offline`)
      claim: (receipt) => track((async () => (reach ? asClient(await S.call('/v1/arena/claim', { receipt }, who.secret)) : { ok: false, error: 'offline' }))()),
      attempt: (tier, bout, room) => track((async () => { const r = asClient(await S.call('/v1/arena/attempt', { tier, bout, room }, who.secret)); attempts.push([tier, bout, r.ok ? 'ticket' : r.error]); return r; })()),
      me: () => who.id,
    },
    enterFloor: async (k, o) => { entered.push(o); return true; }, level: () => 4, maxHealth: () => 60,
  });
  A.model();
  await settle();
  // the first bout: its floor, its ticket, and the relay's verdict - the purse held (relayVerdict's `owe`), the receipt
  // signed as the relay signs it (its attempt's ticket, its room) and handed down the bout's room
  assert.equal(A.fightLadder().ok, true);
  await settle();
  assert.deepEqual(attempts, [[0, 0, 'ticket']]);
  const o = entered[0], room = arenaBoutRoom(o);
  session.room = room;
  A.tick();
  const tk = sent.find((w) => w.k === 'in')?.z;
  assert.match(String(tk), /^[0-9a-f]{16}$/, 'the `in` carries the attempt\'s ticket');
  asked.at(-1).relay.owe(150, (g) => paid.push(g));
  A.word({ k: 'rc', r: await mintArenaReceipt({ a: 'l', j: o, s: who.id, q: 0, u: 0, r: 1, h: 'fall', z: tk }, S.gatePriv, { subtle: globalThis.crypto.subtle, nowS: Math.floor(Date.now() / 1000) }) }, room);
  await settle();
  assert.equal(A.claims.ladderKept(), true, 'the win kept, the service not reached');
  // out through the gates: the bout let go
  session.room = 'world:1,1';
  A.tick(); t += 5_001; A.tick();
  assert.equal(A.fightLadder().text, ARENA_TEXT.online.climbWait, 'within CLIMB_WAIT_MS the held purse holds the climb, as before');
  // past the wait: never the floor for the step just fought
  t += CLIMB_WAIT_MS;
  const r = A.fightLadder();
  await settle();
  assert.deepEqual(r, { ok: false, text: ARENA_TEXT.online.stillRecording }, 'refused at the Herald, in the words askTicket says');
  assert.equal(entered.length, 1, 'no floor entered for a stale step');
  assert.deepEqual(attempts, [[0, 0, 'ticket']], 'and no attempt asked');
  // the service reached: the refusal's own flush carries the win, the purse is paid, and the next Fight is the next step
  reach = true;
  assert.equal(A.fightLadder().ok, false, 'the receipt still kept at the press');
  await settle();
  assert.equal(A.claims.ladderKept(), false, 'the refusal carried it');
  assert.deepEqual(paid, [150], 'the win kept, its purse paid');
  assert.equal(A.fightLadder().ok, true);
  await settle();
  assert.deepEqual(attempts, [[0, 0, 'ticket'], [0, 1, 'ticket']], 'the next Fight asks the climb the service moved - never `order`');
  assert.equal(entered.length, 2);
  assert.ok(!said.some((l) => /not your next ladder bout/i.test(l)), 'never "not your next ladder bout"');
});

// ── CATALOG-READ ───────────────────────────────────────────────────────────────────────────────────────────────────
// (two private reports of Azimuthal Vectors: the scholar's teleport to the catalogue's dungeon finding nothing there, and
// the dead end's payment never coming). N0B00Y17 moves on READING its catalogue (`_map2_ used do _S.15_`,
// `_I.03_ used do _S.16_`): the itemdung revealed, the dead end's last condition. The questlines' sheet struck "Look for the
// old catalog" on CARRYING it, and nothing named the reading. DFU's own script through the real bridge and layer, the
// world's placements left out (they are the world's part); the pickup the pack's, the reading the inventory's use.

/** N0B00Y17 started on a branch (`rolls`: 0.4 the cousin's map, 0.9 the dead end) with the questlines on. */
function catalogQuest(rolls) {
  loadQlTables();
  setPref(QUESTLINES_PREF, true);
  const pack = [];
  let now = 100000;
  const bridge = createQuestBridge({
    data: {
      readListTable: (name) => { try { return readFileSync(join(QL_ROOT, 'vendor/dfu-quests/Tables', `QuestList-${name}.txt`), 'utf8'); } catch { return null; } },
      getQuestSourceLines: (n) => (qlQuestSource(n, questlinesOn()) ?? []).filter((l) => !/^\s*(place npc|place item|create npc at|reveal|teleport pc)/.test(l)),
    },
    classicSeconds: () => now, nowSeconds: () => now, worldSeconds: () => now,
    playerEntity: { name: 'Hero', level: 6, gender: 'female', skills: new Array(35).fill(30), stats: {} },
    giveItemToPlayer: (it) => addItem(pack, it),
    carriesQuestItem: (res) => keepsQuestItem({ items: pack }, res),
    showPopup: () => {}, showPrompt: (_q, _m, respond) => respond(true), showChoice: () => {},
  });
  const quest = quiet(() => bridge.machine.startQuestByName('N0B00Y17', 0, { rolls: () => rolls }));
  const tick = () => quiet(() => { for (let i = 0; i < 2; i++) { now += 5; bridge.machine.tick(); bridge.questlines.look(); } });
  tick();
  const rows = () => Object.fromEntries((bridge.questlines.rowOf(quest)?.objectives ?? []).map((o) => [o.id, o]));
  const set = (n) => quest.getTask({ name: n })?.getTriggerValue();
  return { bridge, quest, pack, tick, rows, set };
}

test('CATALOG-READ: Azimuthal Vectors\' catalogue carried and unread is a step still open - "Read the old catalog", the script not moved; read from the pack, it is done and the itemdung\'s search opens (the cousin\'s map) or the dead end can be reported (mutants: the reading objective gone; done on carrying)', () => {
  try {
    for (const [rolls, branch, cat, read] of [[0.4, 'cousin', 'map2', 'S.15'], [0.9, 'S.03', 'I.03', 'S.16']]) {
      const c = catalogQuest(rolls);
      assert.equal(c.set(branch), true, `${branch}: the branch the roll picks`);
      assert.equal(c.rows().read, undefined, 'nothing to read before it is found');
      addItem(c.pack, structuredClone(c.quest.getItem({ name: cat }).daggerfallUnityItem));   // picked up in the dungeon
      c.tick();
      assert.equal(c.rows().catalogue.state, 'done', 'found');
      assert.equal(c.set(read), false, `${branch}: carried, the script has not moved (\`${cat} used do ${read}\`)`);
      assert.equal(c.rows().read?.state, 'open', `${branch}: the reading is a step of its own, still open`);
      assert.match(c.rows().read.text, /^Read the old catalog from .*, which is in your pack$/);
      assert.equal(c.rows().find, undefined, 'the itemdung is not named yet');
      useItem(c.pack.find((it) => it.questItem), c.pack, { getQuest: (uid) => c.bridge.machine.getQuest(uid) });   // the inventory's Use
      c.tick();
      assert.equal(c.set(read), true, `${branch}: read`);
      assert.equal(c.rows().read.state, 'done');
      if (branch === 'cousin') assert.equal(c.rows().find?.state, 'open', 'the cousin\'s map names where the item is');
    }
  } finally { setPref(QUESTLINES_PREF, false); }
});

// ── BOUNTY-WAY ─────────────────────────────────────────────────────────────────────────────────────────────────────
// (a private report of a farm hunt whose rats never showed). Driven in the real game on the freeware's data (a board's
// orchard hunt held, the hunter walked onto its pixel): the farm stood 330 to 350 metres from where the hunter came onto
// the pixel, the way to it is said ONCE on the screen among the arrival's own lines, and the rats stand once the hunter is
// within 150 metres. A hunt of one group (fewer than six) kept that way nowhere: the journal's trail lines were the split
// hunt's alone. A hunter who missed the line stood on the right pixel with nothing to go on. The tutorial said to return
// for the gold, which a hunt never asks.

test('BOUNTY-WAY: a one-group farm hunt\'s way to its farmstead is said once and KEPT in the journal; walked, the pack stands and the last kill pays (mutant: the way kept for a split hunt alone)', async () => {
  const TOWN = { px: 300, py: 200, name: 'Daggerfall' };
  const sites = bountySites(TOWN.px, TOWN.py, () => true);
  let day = 900, p = null;
  for (; day < 1100 && !p; day++) p = boardPostings({ day, ...TOWN, level: 2, sites }).find((q) => q.farm && q.count < 6) ?? null;
  day--;
  assert.ok(p, 'a farm hunt of one group');
  assert.equal(bountyGroups(p).length, 1);
  const pool = [], said = [];
  let far = true, board = null;
  const entity = { goldPieces: 0, items: [] };
  const host = createBountyHost({
    now: () => day * 1440 + 60, level: () => 2, entity: () => entity, townName: () => 'Daggerfall', siteOk: () => true,
    playerPixel: () => ({ x: p.target.px, y: p.target.py }), canStand: () => true,
    standPack: (o) => {
      assert.equal(o.farm, true, 'the first group waits at the farm');
      if (far) return { far: true, dx: 250, dz: 250 };
      const foes = Array.from({ length: o.count }, () => ({ dead: false, entity: { health: 5 } }));
      pool.push(...foes);
      return { foes: Promise.resolve(foes), dx: 0, dz: 20 };
    },
    foePool: () => pool, say: (l) => said.push(l), showNotice: () => true, openBoardWindow: (d) => { board = d; },
  });
  host.openBoard(TOWN);
  board.take(board.rows().find((r) => r.posting.slot === p.slot).posting.id);
  const flush = async () => { for (let i = 0; i < 4; i++) await Promise.resolve(); };
  host.tick(1); await flush();
  const way = said.filter((l) => /^The farmstead lies 350 meters to the north-east\.$/.test(l));
  assert.equal(way.length, 1, 'the way named');
  const journal = () => host.questLogEntries()[0].messages[0].map((m) => m.text ?? m);
  assert.ok(journal().includes(way[0]), 'and the journal keeps it');
  assert.ok(!journal().some((l) => /two groups/.test(l)), 'a hunt of one group says no groups');
  host.tick(1); host.tick(1);
  assert.equal(said.filter((l) => /farmstead lies/.test(l)).length, 1, 'said once');
  far = false;
  for (let i = 0; i < 3; i++) { host.tick(1); await flush(); }   // the host asks again as the hunter closes in
  assert.equal(pool.length, p.count, 'walked within reach, the pack stands');
  for (const f of pool) { f.dead = true; f.corpse = true; }
  host.tick(1);
  assert.equal(entity.goldPieces, p.gold, 'the last kill pays - no going back for it');
});

test('BOUNTY-WAY: the tutorial says where a hunt is found and that the last kill pays (mutant: the old page)', () => {
  const words = tutorialById('bounties').body.join(' ');
  assert.match(words, /middle of its black circle on your map, or the dungeon it names/);
  assert.match(words, /which way it waits; the Quests tab keeps the way/);
  assert.match(words, /The last kill pays gold and an item/);
  assert.doesNotMatch(words, /return for gold/);
});

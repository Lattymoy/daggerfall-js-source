// QX1 / TP2 - THE FIXED-CITY HOST TAKES THE TWO LAWS IT WAS MISSING.
//
// `?exterior` is the port's own dev route: one location, laid out
// whole, with the same mode machine, the same windows and the same
// motor as the streaming host. Two laws lived in every OTHER host that
// has the surface and not in this one, each with a flag saying so:
//
//   PX3  - "this test host mounts no quest bridge, so the pause
//          window's Quests tab says so". One missing construction, and
//          EIGHT surfaces in that file had each separately recorded
//          the absence as a decision.
//   TP2  - "Recall pends here - the anchor machinery lives in the
//          streaming ?world host". True of ONE arm of Teleport.cs and
//          false as a refusal of the whole spell, which is exactly the
//          shape A10 found and fixed in the dungeon context.
//
// Both are paid here, and NOTHING IS RETYPED: every expression this
// file runs is lifted out of `src/scenes/exterior.js` and mounted on
// stubs, so a revert runs in these assertions rather than beside them.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { WORLD_CONTEXT, makeAnchor, teleportPlan } from '../src/systems/teleportAnchor.js';
import { locationWorldRect } from '../src/world/streamingWorld.js';
import { GLOBAL_SCALE } from '../src/world/meshReader.js';

const SRC = readFileSync(new URL('../src/scenes/exterior.js', import.meta.url), 'utf8');

/** Lift the source between two markers, both of which must be unique. */
function slice(from, to) {
  const a = SRC.indexOf(from);
  const b = SRC.indexOf(to);
  assert.ok(a >= 0, `exterior.js no longer contains: ${from}`);
  assert.ok(b > a, `exterior.js no longer contains: ${to}`);
  return SRC.slice(a, b);
}

// ───────────────────────── QX1: the quest bridge ─────────────────────────

test('QX1: the fixed-city host mounts a quest bridge, and its world reads answer the ONE loaded city', () => {
  // The construction itself. `data` is the vendored pack and `world`
  // is the adapter below - the two seams createQuestBridge requires.
  assert.match(SRC, /questBridge = createQuestBridge\(\{\n {4}data: questPack,\n {4}world: questWorld,/);
  assert.match(SRC, /const \{ loadQuestPack \} = await import\('\.\/questData\.js'\);/,
    'a DYNAMIC import - a static one drags this host out of moduleload_smoke');

  // ...and the adapter, RUN. This is what "the machine mounts over
  // that city" means: where the streaming host asks its pixel for the
  // current location on every read, this one answers `dfLocation`
  // outright, because it has exactly one for its whole life.
  const dfLocation = {
    name: 'Daggerfall', regionIndex: 17, locationIndex: 4,
    mapTableData: { mapId: 1050578, locationType: 8 },
    exterior: { exteriorData: { width: 8, height: 8, blockNames: ['MAGEAA00.RMB'] } },
  };
  const body = slice('  const questWorld = {', '  questBridge = createQuestBridge({');
  const mount = new Function(
    'maps', 'blocks', 'pipeline', 'townTalk', 'dfLocation', 'locationName', 'locClimateIndex',
    'currentWeather', '_musicInLocationRect', '_locPixel', 'legalRepOf', 'changeLegalRep',
    'isHouseOwned', 'playerEntity', 'generateBuildingName', 'modes', 'discoverLocation',
    'REGION_RACES', 'dungeonLocationFor', 'questBridge',
    `${body} return questWorld;`,
  );
  const asked = [];
  const world = mount(
    { getRegion: (i) => ({ name: `region-${i}` }), getLocation: () => null, getLocationByName: () => null },
    { getBlockByName: (n) => ({ n }) },
    { flatCaption: () => 'a caption' },
    { factionDict: new Map([[42, { id: 42 }]]), nameOpts: () => ({ seed: 1 }) },
    dfLocation, 'Daggerfall', 231,
    () => 'Rain', () => true, { x: 207, y: 213 },
    () => 7, (...a) => asked.push(['legal', ...a]),
    () => false, { houses: [] }, () => 'The Odd Blades', null,
    () => asked.push(['discover']), [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2], (l) => l, null,
  );

  assert.equal(world.currentLocation(), dfLocation, 'PlayerGPS.CurrentLocation IS the loaded city');
  assert.equal(world.currentRegionIndex(), 17);
  assert.equal(world.currentLocationIndex(), 4);
  assert.equal(world.currentLocationType(), 8);
  assert.equal(world.currentRegionName(), 'region-17');
  assert.equal(world.currentRegionRace(), 3, 'GetRaceOfCurrentRegion is RegionRaces[i] + 1');
  assert.deepEqual(world.playerPixel(), { x: 207, y: 213 }, 'the quest clock travels from the city\'s own pixel');
  assert.equal(world.currentClimateIndex(), 231);
  assert.equal(world.currentWeatherKey(), 'Rain', 'the Weather trigger reads the live weather');
  assert.equal(world.isPlayerInLocationRect(), true);
  assert.equal(world.legalRepNow(), 7);
  assert.equal(world.getFactionData(42).id, 42);
  assert.equal(world.getBlock('MAGEAA00.RMB').n, 'MAGEAA00.RMB');
  assert.equal(world.flatCaption(182, 3), 'a caption');
  // playerInside is the MOUNTED MODE's answer, exactly as in the
  // streaming host - outside one there is nothing to be inside of.
  assert.equal(world.playerInside(), null, 'no mode mounted, so the player is outside');
  assert.equal(world.currentBuildingName(), null, '%cbd outside a building is C#\'s "[invalid]" arm');
});

test('QX1: the pause window\'s Quests tab reads the machine, and BOTH pauses read the same walk', () => {
  // The PX3 site itself: the flag's refusal is gone and the two walks
  // are handed over by name.
  assert.equal(/PX3 FLAGGED/.test(SRC), false, 'the PX3 flag is retired, not merely edited');
  assert.match(SRC, /PX3 SHIPPED \(QX1\)/, 'and its site records what shipped, quoting what it retired');
  assert.match(SRC, /questMessages: pauseQuestMessages,\n\s*questLog: pauseQuestLog,/,
    'the host\'s own pause hands both walks over');
  // ...and the mode machine's INTERIOR pause reads the SAME two, so a
  // pause in a tavern is not a different journal (worldModes reads
  // host.pauseQuestMessages / host.pauseQuestLog).
  assert.match(SRC, /\n {4}pauseQuestMessages, pauseQuestLog,\n/,
    'the interior pause takes the same two expressions');
  // ...and the character sheet's LOGBOOK button, which charSheetHooks
  // withholds unless both hooks were handed over.
  assert.match(SRC, /\n {4}\.\.\.questJournalHooks\(\),\n/);

  // THE WALK, RUN. Nothing here is retyped: this is the shipped
  // expression, driven against a machine.
  const body = slice('  const questJournalHooks = () => (questBridge ? {',
    "  if (!playerEntity.chargenDone && params.has('class')) {");
  const mount = (bridge) => new Function('questBridge',
    `${body} return { questJournalHooks, pauseQuestLog, pauseQuestMessages };`)(bridge);

  // No bridge yet (a sheet opened during chargen): the hooks are the
  // EMPTY object, so the LOGBOOK button is withheld rather than opened
  // onto a log nothing can fill, and the rail is empty.
  const cold = mount(null);
  assert.deepEqual(cold.questJournalHooks(), {});
  assert.deepEqual(cold.pauseQuestMessages(), []);
  assert.deepEqual(cold.pauseQuestLog(), { active: [], finished: [] });

  const withLog = {
    uid: 5, displayName: 'A Small Debt', questName: '_BRISIEN',
    getLogMessages: () => [{ messageID: 1010 }, { messageID: 1020 }],
    getMessage: (id) => ({ id }),
    resources: new Map([
      ['clock_a', { clockEnabled: true, clockFinished: false, remainingTimeInSeconds: 600 }],
      ['clock_b', { clockEnabled: true, clockFinished: false, remainingTimeInSeconds: 120 }],
      ['clock_c', { clockEnabled: true, clockFinished: true, remainingTimeInSeconds: 1 }],
      ['not_a_clock', { clockEnabled: false, remainingTimeInSeconds: 2 }],
    ]),
  };
  const silent = { uid: 6, questName: '_TUTOR__', getLogMessages: () => [], resources: new Map() };
  const bridge = {
    machine: {
      quests: new Map([[5, withLog], [6, silent]]),
      getAllQuestLogMessages: () => ['entry-a', 'entry-b'],
    },
    notebook: { getFinishedQuests: () => ['a finished one'] },
  };
  const live = mount(bridge);

  assert.deepEqual(live.pauseQuestMessages(), ['entry-a', 'entry-b'],
    'the flat F5 seam is GetAllQuestLogMessages, not a refusal');
  assert.deepEqual(Object.keys(live.questJournalHooks()).sort(), ['notebook', 'questMessages']);
  assert.deepEqual(live.questJournalHooks().questMessages(), ['entry-a', 'entry-b']);

  const log = live.pauseQuestLog();
  assert.equal(log.active.length, 1, 'a quest that has written no log entry has no rail row');
  assert.deepEqual(log.active[0].messages, [{ id: 1010 }, { id: 1020 }]);
  assert.equal(log.active[0].id, '5');
  assert.equal(log.active[0].name, 'A Small Debt');
  assert.equal(log.active[0].questName, '_BRISIEN');
  assert.equal(log.active[0].clockSeconds, 120,
    'the SHORTEST live clock - a finished or disabled one is not a timer');
  assert.deepEqual(log.finished, ['a finished one']);
});

test('QX1: every surface that recorded "no quest bridge" reads the machine now', () => {
  // Each of these was its own sentence in exterior.js saying the host
  // had no machine to ask. One construction under all of them - and
  // this is the pin that stops any being reverted alone.
  assert.match(SRC, /tickQuests: \(\) => questBridge\?\.machine\?\.tick\?\.\(\),/, 'TickRest :379');
  assert.match(SRC, /getQuest: \(uid\) => questBridge\?\.machine\?\.getQuest\?\.\(uid\) \?\? null,/, 'the quest letter\'s name');
  assert.match(SRC, /statusInfoRows\(rows, questBridge\?\.machine\?\.macroContext\?\.\(\) \?\? null\)/, 'record 22\'s macros');
  assert.match(SRC, /stampResidenceQuestNames\(summaries, discoveredBuildings\(locId\), \{/, 'the residence plates');
  assert.match(SRC, /\n {4}questBridge,\n/, 'the bridge rides into the mode machine - mountScene over this city');
  assert.match(SRC, /if \(!_overlayHeld\) questBridge\?\.tick\(dt\);/, 'QuestMachine.Update, behind the pause gate');
  assert.match(SRC, /questBridge\.onInitWorld\(\);/, 'OnInitWorld - this route\'s one city IS its world');
  assert.match(SRC, /questInitAtGameStart\(\);   \/\/ QX1: OnStartGame for the new character/, 'StartGameBehaviour :445-447');
});

test('QX1: the journal doors U43 left hanging finally have something to open', () => {
  // `preloadQuestJournalArt` has been imported by this file since U43
  // with NO CALLER, because the host had no machine to fill a journal
  // from. One builder, four doors: L, N, the sheet's LOGBOOK button and
  // the pause window's Chronicle - plus the interior arm, which reads
  // `host.makeJournal` and nothing else.
  assert.match(SRC, /const makeJournalWindow = \(mode\) => \{\n\s*if \(!questBridge \|\| !chronicleDoorReady\(\)\) return null;/,
    'no bridge or no art answers null - the button opens nothing, never an empty book');
  assert.match(SRC, /toggleLogbook: \(\) => \{ const w = makeJournalWindow\('activeQuests'\);/);
  assert.match(SRC, /toggleNotebook: \(\) => \{ const w = makeJournalWindow\('notebook'\);/);
  assert.match(SRC, /if \(act === 'LogBook'\) \{ e\.preventDefault\(\); hudCtx\.toggleLogbook\(\); return; \}/);
  assert.match(SRC, /if \(act === 'NoteBook'\) \{ e\.preventDefault\(\); hudCtx\.toggleNotebook\(\); return; \}/);
  assert.match(SRC, /openChronicle: \(\) => \{ const w = makeJournalWindow\('notebook'\); if \(w\) townTalk\.showOverlay\(w\); \},/);
  assert.match(SRC, /makeJournal: \(mode\) => makeJournalWindow\(mode\),/, 'and the interior arm\'s own door');
  // ONE window, through the chronicle DOOR - never a second
  // construction of the classic journal beside it.
  assert.equal(/new QuestJournalWindow\(/.test(SRC), false, 'the door picks the skin, the host does not');
});

// ───────────────────────── TP2: the Recall anchor ─────────────────────────

/** Mount the host's SHIPPED Recall block on stubs. */
function mountRecall({ anchorContext, insideContext, mode = 'exterior', startInDungeon = null, restoreInterior = null } = {}) {
  const body = slice('  const _anchorRect = locationWorldRect(', '  const magic = createPlayerMagic({');
  const dfLocation = {
    name: 'Daggerfall',
    exterior: { exteriorData: { width: 8, height: 8, blockNames: ['MAGEAA00.RMB'] } },
  };
  const calls = [];
  const player = { pos: [100, 5, 200], spawn: (...a) => { calls.push(['spawn', ...a]); player.pos = [...a]; }, eyeAt: () => [1, 2, 3] };
  const cam = { pos: [0, 0, 0], yaw: 1.25, pitch: -0.5 };
  const playerEntity = { anchorPosition: null };
  const modes = {
    get mode() { return mode; },
    anchorContext: anchorContext ?? (() => ({ worldContext: WORLD_CONTEXT.Exterior, local: null, buildingKey: 0, interior: null })),
    insideContext: insideContext ?? (() => ({ insideBuilding: false, insideDungeon: false, buildingKey: 0 })),
    setPlayerLocalPosition: (p) => calls.push(['setPlayerLocalPosition', p]),
    forceExitToExterior: (o) => calls.push(['forceExitToExterior', o]),
    startInDungeon: startInDungeon ?? (async () => { calls.push(['startInDungeon']); return false; }),
    restoreInterior: restoreInterior ?? (async (...a) => { calls.push(['restoreInterior', ...a]); return false; }),
  };
  const said = [];
  const townTalk = { say: (l) => said.push(l), showOverlay: (w) => calls.push(['overlay', w]) };
  const api = new Function(
    'locationWorldRect', 'GLOBAL_SCALE', 'WORLD_CONTEXT', 'makeAnchor', 'teleportPlan',
    'dfLocation', 'locationName', '_locPixel', 'walkMode', 'player', 'cam', 'playerEntity',
    'townTalk', 'surfacePlayer', 'ChoiceWindow', 'modes',
    `${body} return { setRecallAnchor, recallToAnchor, teleportPrompt, anchorLanding };`,
  )(locationWorldRect, GLOBAL_SCALE, WORLD_CONTEXT, makeAnchor, teleportPlan,
    dfLocation, 'Daggerfall', { x: 207, y: 213 }, true, player, cam, playerEntity,
    townTalk, () => calls.push(['surfacePlayer']), function ChoiceWindow(o) { Object.assign(this, o); }, modes);
  return { ...api, calls, said, player, cam, playerEntity, modes };
}

test('TP2: SET ANCHOR works in this host, and the landing is the anchor\'s own native frame', () => {
  const h = mountRecall();
  h.setRecallAnchor();
  const a = h.playerEntity.anchorPosition;
  assert.ok(a, 'SetAnchor (Teleport.cs:100-117) needs a position and a context, both of which this host has');
  assert.equal(a.worldContext, WORLD_CONTEXT.Exterior);
  assert.deepEqual(a.pixel, { x: 207, y: 213 }, 'the location\'s own map pixel');
  assert.equal(a.yaw, 1.25);
  assert.equal(a.pitch, -0.5);
  // The natives are stated in the STREAMING host's frame - the
  // location's world rect - not a private one, and the landing is the
  // exact inverse, so a recall lands where the anchor was set.
  const rect = locationWorldRect({ exterior: { exteriorData: { width: 8, height: 8, blockNames: ['MAGEAA00.RMB'] } } }, 207, 213);
  assert.equal(a.nativeX, rect.minX + 100 / GLOBAL_SCALE);
  assert.equal(a.nativeZ, rect.minZ + 200 / GLOBAL_SCALE);
  assert.deepEqual(h.anchorLanding(a), [100, 5, 200], 'native -> scene is the inverse of scene -> native');
});

test('TP2: the 4001 refusal, and the 4000 box\'s two arms', () => {
  const h = mountRecall();
  h.recallToAnchor();
  assert.deepEqual(h.said, ['You must set an anchor first.'], 'the 4001 box (:268-275)');
  assert.equal(h.calls.length, 0, 'nothing is torn down for an anchor that does not exist');

  h.teleportPrompt();
  const box = h.calls.find((c) => c[0] === 'overlay')?.[1];
  assert.ok(box, 'PromptPlayer (:81-98) raises a window in THIS host\'s slot');
  assert.deepEqual(box.lines, ['Do you want to Teleport or Set an Anchor?'], 'TEXT.RSC record 4000, verbatim');
  assert.deepEqual(box.options.map((o) => o.code), ['KeyA', 'KeyT', 'Escape']);
});

test('TP2: the SAME-INTERIOR arm just moves the player (:129-134) - nothing is torn down', async () => {
  const inside = { worldContext: WORLD_CONTEXT.Interior, local: null, buildingKey: 9, interior: { door: { blockIndex: 1 } } };
  const h = mountRecall({
    mode: 'interior',
    anchorContext: () => inside,
    insideContext: () => ({ insideBuilding: true, insideDungeon: false, buildingKey: 9 }),
  });
  h.setRecallAnchor();
  h.player.pos = [400, 5, 400];
  await h.recallToAnchor();
  assert.deepEqual(h.calls.filter((c) => c[0] === 'setPlayerLocalPosition')[0][1], [100, 5, 200]);
  assert.equal(h.calls.some((c) => c[0] === 'forceExitToExterior'), false,
    '"Just need to move player" - the room you stand in IS the anchor\'s room');
  assert.equal(h.playerEntity.anchorPosition, null, 'consumed on arrival (:133)');
});

test('TP2: the CROSS-CONTEXT arm inside the loaded pixel really runs - the exit, then the landing', async () => {
  // Anchor set in the street, cast from inside a shop: DFU caches the
  // interior it is leaving (:145-151) and lands at the anchor.
  let mode = 'exterior';
  const h = mountRecall({
    get mode() { return mode; },
    insideContext: () => ({ insideBuilding: mode === 'interior', insideDungeon: false, buildingKey: 9 }),
  });
  h.setRecallAnchor();
  mode = 'interior';
  Object.defineProperty(h.modes, 'mode', { get: () => mode, configurable: true });
  h.player.pos = [0, 0, 0];
  await h.recallToAnchor();
  const exit = h.calls.find((c) => c[0] === 'forceExitToExterior');
  assert.ok(exit, 'a cast inside a mode leaves it first (:151)');
  assert.deepEqual(exit[1], { cacheScene: true }, 'CacheScene(Interior.name) - the same write the real door makes');
  assert.deepEqual(h.calls.find((c) => c[0] === 'spawn').slice(1), [100, 5, 200], 'the exterior landing');
  assert.equal(h.cam.yaw, 1.25, 'the pose rides the transform (:242)');
  assert.equal(h.playerEntity.anchorPosition, null);
});

test('TP2: a BUILDING anchor takes restoreInterior, and a missing door is DFU\'s reposition arm', async () => {
  const seen = [];
  const h = mountRecall({
    anchorContext: () => ({ worldContext: WORLD_CONTEXT.Interior, local: null, buildingKey: 9, interior: { door: { blockIndex: 1 } } }),
    insideContext: () => ({ insideBuilding: false, insideDungeon: false, buildingKey: 0 }),
    restoreInterior: async (saved, pos) => { seen.push([saved, pos]); return false; },
  });
  h.setRecallAnchor();
  await h.recallToAnchor();
  assert.equal(seen.length, 1, ':632-643 - "Start in building", off the anchor\'s own exteriorDoors');
  assert.deepEqual(seen[0][0], { door: { blockIndex: 1 } });
  assert.deepEqual(seen[0][1], [100, 5, 200]);
  assert.deepEqual(h.said, ['Building has no exterior doors. Repositioning player.'],
    'RestorePositionHelper\'s reposition arm (:615-620) says so');
});

test('TP2: a DUNGEON anchor takes the mount, and its `local` IS the landing', async () => {
  const h = mountRecall({
    anchorContext: () => ({ worldContext: WORLD_CONTEXT.Dungeon, local: [11, 22, 33], buildingKey: 0, interior: null }),
    insideContext: () => ({ insideBuilding: false, insideDungeon: false, buildingKey: 0 }),
    startInDungeon: async () => true,
  });
  h.setRecallAnchor();
  await h.recallToAnchor();
  assert.deepEqual(h.calls.find((c) => c[0] === 'setPlayerLocalPosition')[1], [11, 22, 33],
    'a dungeon\'s frame is its own, rebuilt at the same origin every mount');
  assert.equal(h.playerEntity.playerTeleportedIntoDungeon, true, ':246');
});

test('TP2 INTERIM: the ONE arm this host cannot take refuses BY NAME, and keeps the anchor', async () => {
  const h = mountRecall();
  // An anchor set in another city - the only thing `?exterior` cannot
  // arrive at, because arriving is StreamingWorld's job.
  h.playerEntity.anchorPosition = makeAnchor({
    worldContext: WORLD_CONTEXT.Exterior, pixel: { x: 100, y: 100 },
    nativeX: 0, nativeZ: 0, y: 3, yaw: 0, pitch: 0,
  });
  await h.recallToAnchor();
  assert.equal(h.said.length, 1);
  assert.match(h.said[0], /Recall cannot leave Daggerfall here/, 'the refusal names the city it cannot leave');
  assert.match(h.said[0], /another location/, '...and the reason');
  assert.match(h.said[0], /streaming \?world host/, '...and where the arm does live');
  assert.equal(h.calls.length, 0, 'nothing is torn down for a jump that cannot be made');
  assert.ok(h.playerEntity.anchorPosition, 'the anchor SURVIVES - the world host can still use it');

  // ...and the flag is narrowed to exactly that sentence, at its own
  // line, so tools/regenOpenFlags.mjs lists the arm and not the spell.
  const flag = SRC.split('\n').find((l) => l.includes('TP2 INTERIM'));
  assert.ok(flag, 'the narrowed flag has its own line for the harvest');
  assert.match(flag, /a jump to an anchor on ANOTHER map pixel/);
  assert.match(flag, /`\?exterior` loads ONE fixed city and runs no streamer/);
  assert.equal(/Recall pends here/.test(SRC), false, 'the whole-spell refusal is gone');
});

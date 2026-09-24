// AUDIT 68 (2026-09-24), cluster "worldjs" - src/scenes/world.js.
// The whole-tree sweep's pins for the streaming host: every assertion
// here failed on the base (ad238de0) and passes after the fix. Where the
// host needs a browser, the host's OWN source text is lifted and run over
// stubs, so a revert runs inside the assertion.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { createPlayerMagic } from '../src/scenes/hostMagic.js';
import { liveEnchantFoeSinks } from '../src/scenes/shared.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const WORLD = read('src/scenes/world.js');

/** The text from `from` up to (and including) the first `to` after it. */
function lift(src, from, to) {
  const i = src.indexOf(from);
  assert.ok(i >= 0, `lift: ${from.slice(0, 60)} is gone`);
  const j = src.indexOf(to, i);
  assert.ok(j > i, `lift: no ${JSON.stringify(to)} after ${from.slice(0, 60)}`);
  return src.slice(i, j + to.length);
}
/** The one line starting (after indentation) with `head`, inside the
 *  block that opens at `within`. */
function lineIn(src, within, head) {
  const i = src.indexOf(within);
  assert.ok(i >= 0, `lineIn: ${within} is gone`);
  const k = src.indexOf(`\n${head}`, i);
  assert.ok(k > i, `lineIn: no ${head.trim()} under ${within}`);
  return src.slice(k + 1, src.indexOf('\n', k + 1));
}

// ---- X4: the cast engine's provenance reaches the sinks ----------------

const blast = { name: 'Blast', index: 91, element: 4, rangeType: 4, effects: [{ type: 4, subType: 0, magnitudeBaseLow: 10, magnitudeBaseHigh: 10, magnitudeLevelBase: 0, magnitudeLevelHigh: 0, magnitudePerLevel: 1, durationBase: 0, durationMod: 0, durationPerLevel: 1, chanceBase: 0, chanceMod: 0, chancePerLevel: 1 }] };
const mkEntity = () => ({ level: 1, health: 40, maxHealth: 40, magicka: 0, maxMagicka: 0, skills: new Array(40).fill(30), stats: { willpower: 30 }, career: {}, activeEffects: [] });
const mkFoe = (x) => ({ dead: false, ai: { feet: [x, 0, 0] }, entity: mkEntity() });

/** The REAL engine, handed a host's own sinks door. */
function engineOver(door, foes) {
  const player = { isPlayer: true, level: 1, health: 100, maxHealth: 100, magicka: 500, maxMagicka: 500, skills: new Array(40).fill(50), skillUses: new Array(40).fill(0), stats: { intelligence: 50, willpower: 50, endurance: 50 }, career: {}, activeEffects: [] };
  return createPlayerMagic({
    renderer: { createBillboardBatch: () => ({}), destroyBillboardBatch: () => {} },
    audio: { playOneShot() {}, play3d() {}, playOneShotId() {}, play3dId() {} },
    getTexture: async () => ({ getSize: () => [16, 16], getScale: () => [0, 0] }),
    uploadRecord() {}, uploadRecordFrame() {}, collider: { raycast: () => Infinity },
    playerEntity: player,
    playerSinks: { hurt() {}, heal() {}, drainMagicka() {}, restoreMagicka() {}, drainFatigue() {}, restoreFatigue() {}, say: () => {} },
    say: () => {}, surfacePlayer() {},
    foes: () => foes, foeSinks: door,
    absorbCtx: () => ({ inside: false, day: true }), rolls: () => 0.99,
  });
}

/** A street host's cast-engine door, mounted from its own source: its
 *  `foeSinks`, its `enchantFoeSinks` router and the door the engine is
 *  handed, over the real shared.liveEnchantFoeSinks. */
function streetDoor(src, modes, seen) {
  const sinks = lift(src, '  const foeSinks = (g, fromPlayer = true) => ({', '\n  });');
  const router = lineIn(src, 'const _insidePool = () =>', '  const enchantFoeSinks = ');
  const door = lineIn(src, 'const magic = createPlayerMagic({', '    foeSinks: ');
  return new Function('liveEnchantFoeSinks', 'exteriorFoes', 'cityGuards', 'player', 'maxFatigue', 'modes', '_insidePool',
    `${sinks}\n${router}\nreturn ({\n${door}\n}).foeSinks;`)(
    liveEnchantFoeSinks,
    { damageFoe: (g, n, feet, kd, opts) => seen.push({ pool: 'encounter', n, fromPlayer: opts?.fromPlayer }) },
    { hurtGuard: (g, n, feet, kd, opts) => seen.push({ pool: 'watch', n, fromPlayer: opts?.fromPlayer }) },
    { pos: [0, 0, 0] }, () => 100, modes, () => modes.insideFoes());
}

/** An enemy mage's AreaAtRange burst at the player, beside a guard, through a street host's own door. */
function blastBesideGuard(host) {
  const seen = [];
  const guard = mkFoe(1);
  const mage = mkFoe(10); mage._encounter = true;
  const modes = { dungeonCtx: null, insideFoes: () => [], insideFoeSinksFor: () => null };
  const magic = engineOver(streetDoor(read(`src/scenes/${host}`), modes, seen), [guard, mage]);
  magic.explodeAt([0, 0.9, 0], blast, 1, [0, 0, 0], { entity: mage.entity, sinks: null }, { excludeFoe: mage });
  assert.deepEqual(seen, [{ pool: 'watch', n: 10, fromPlayer: false }],
    `${host}: the engine said "not the player" and the watch heard it - no handleAttackFromPlayer, no Murder on a kill`);
  seen.length = 0;
  magic.explodeAt([0, 0.9, 0], blast, 1, [0, 0, 0], null, { excludeFoe: mage });
  assert.deepEqual(seen, [{ pool: 'watch', n: 10, fromPlayer: true }], `${host}: and the player's own blast is still the player's`);
}

test('AUDIT 68 X4-foe-sink-provenance-dropped: world.js - an enemy\'s blast on a guard reaches the watch as the ENEMY\'s, not the player\'s', () => {
  blastBesideGuard('world.js');
});

test('AUDIT 68 X4-foe-sink-provenance-dropped: exterior.js - the town host\'s twin door carries it too', () => {
  blastBesideGuard('exterior.js');
});

test('AUDIT 68 X4-foe-sink-provenance-dropped: the router hands the provenance to every host\'s sinks, the interior and dungeon doors included', () => {
  const street = {}, room = {}, cell = {};
  const sinks = (tag) => (g, fp) => ({ tag, fp });
  const ctx = { foes: [cell], foeSinksFor: sinks('dungeon') };
  const pool = () => [room];
  assert.deepEqual(liveEnchantFoeSinks(street, ctx, sinks('exterior'), pool, sinks('inside'), false), { tag: 'exterior', fp: false });
  assert.deepEqual(liveEnchantFoeSinks(room, ctx, sinks('exterior'), pool, sinks('inside'), false), { tag: 'inside', fp: false });
  assert.deepEqual(liveEnchantFoeSinks(cell, ctx, sinks('exterior'), pool, sinks('inside'), false), { tag: 'dungeon', fp: false });
  // worldModes' interior doors, lifted and run: a foe's blast on the indoor watch is not my blow
  const wm = read('src/scenes/worldModes.js');
  const seen = [];
  const inside = new Function('interiorFoes', 'interiorGuards', 'player', 'maxFatigue',
    `${lift(wm, '  const insideFoeSinks = (foe', '\n  });')}\nreturn ({\n${lineIn(wm, 'insideFoes() {', '    insideFoeSinksFor(')}\n}).insideFoeSinksFor;`)(
    { damageFoe: (g, n, feet, kd, opts) => seen.push({ pool: 'encounter', n, opts }) },
    { hurtGuard: (g, n, feet, kd, opts) => seen.push({ pool: 'watch', n, opts }) },
    { pos: [0, 0, 0] }, () => 100);
  inside({ entity: mkEntity() }, false).hurt(6);
  inside({ entity: mkEntity(), _encounter: true }, false).hurt(4);
  inside({ entity: mkEntity() }).hurt(2);
  assert.deepEqual(seen, [
    { pool: 'watch', n: 6, opts: { fromPlayer: false } },
    { pool: 'encounter', n: 4, opts: { fromPlayer: false, kind: 'spell' } },
    { pool: 'watch', n: 2, opts: { fromPlayer: true } },
  ]);
  // and the dungeon's door onto its own sinks carries the second argument
  const dc = read('src/scenes/dungeonContext.js');
  const got = [];
  const foeSinksFor = new Function('foeSinks', `return ({\n${lineIn(dc, 'castAtFoe: (spell, foe', '    foeSinksFor: ')}\n}).foeSinksFor;`)((f, fp) => got.push(fp));
  foeSinksFor({}, false);
  assert.deepEqual(got, [false]);
});

// ---- S22: a door in the SECOND copy of a repeated block is that copy's building ----

test('AUDIT 68 S22-door-repeated-block-identity: the second instance of a shared parse resolves to ITS building - key, pool draw and all', async () => {
  const { blockFromJson, locationFromJson } = await import('../src/formats/worldDataReplacement.js');
  const { layoutLocation, RMB_SIDE } = await import('../src/world/locationLayout.js');
  const { MapsFile } = await import('../src/formats/mapsFile.js');
  const { getStaticDoors } = await import('../src/world/staticDoors.js');
  const talk = await import('../src/systems/talkTopics.js');
  // A world-data-replaced block: every repeat of it is ONE parse (the
  // replacement cache), which is what a streamed town's shared cells are.
  const B = blockFromJson({ Name: 'TWIN.RMB', Type: 'Rmb', RmbBlock: { FldHeader: { BuildingDataList: [{ BuildingType: 'Alchemist' }] }, SubRecords: [{}] } }, 7);
  const dfLoc = locationFromJson({ Name: 'Twinford', LocationIndex: 3,
    Exterior: { Buildings: [{ BuildingType: 'Alchemist', NameSeed: 11 }, { BuildingType: 'Alchemist', NameSeed: 22 }], ExteriorData: { Width: 2, Height: 1, BlockNames: ['TWIN.RMB', 'TWIN.RMB'] } } }, 5);
  const loc = layoutLocation(dfLoc, { getRmbBlockName: MapsFile.prototype.getRmbBlockName }, { checkName: (n) => n, getBlockByName: () => B });
  assert.equal(loc.blocks.length, 2);
  assert.equal(loc.blocks[0].dfBlock, loc.blocks[1].dfBlock, 'the two cells share one parse');
  // buildPixelNow's door push: getStaticDoors over the placed model's
  // pixel-local matrix, one door per instance
  const locOrigin = [100, 5, 200];
  const at = (x) => { const m = new Float32Array(16); m[0] = m[5] = m[10] = m[15] = 1; m[12] = locOrigin[0] + x; m[13] = locOrigin[1]; m[14] = locOrigin[2] + 10; return m; };
  const model = { doors: [{ vert0: { x: -1, y: 0, z: 0 }, vert2: { x: 1, y: 2, z: 0 }, type: 0, index: 0 }] };
  const buildingDoors = [10, RMB_SIDE + 10].map((x) => ({
    door: getStaticDoors(model, B.index, 0, at(x))[0], pixelKey: '4,4', dfBlock: B, recordIndex: 0,
  }));
  // the host's own three closures, lifted: shiftedDoor, doorTargets, buildingDataForDoor
  const shifted = lift(WORLD, '  const shiftedDoor = (entry) => {', '\n  };');
  const targets = lift(WORLD, '    doorTargets: () => buildingDoors.map((e) => ({', '\n    })),');
  const resolve = lift(WORLD, '    buildingDataForDoor: (hit) => {', '\n    },');
  const host = new Function('buildingDoors', 'state', 'locationIndex', 'built', 'setLastLocationKeyTo', 'buildingDataForDoor', 'townTalk',
    `${shifted}\nreturn ({\n${targets}\n${resolve}\n});`)(
    buildingDoors, { pixelTranslation: () => [500, 0, -300] }, new Map([['4,4', dfLoc]]),
    new Map([['4,4', { locBlocks: loc.blocks, locOrigin }]]), () => {}, talk.buildingDataForDoor, { directory: [] });
  const [first, second] = host.doorTargets();
  assert.notEqual(second.door.matrix[12], at(RMB_SIDE + 10)[12], 'a door hit is world-frame');
  assert.equal(host.buildingDataForDoor(first).buildingKey, talk.makeBuildingKey(0, 0, 0));
  const b = host.buildingDataForDoor(second);
  assert.equal(b.buildingKey, talk.makeBuildingKey(1, 0, 0), 'the second copy\'s door is the second copy\'s building');
  assert.equal(b.nameSeed, 22, 'and its shop is the second pool draw, not the first\'s');
  // the static-building arm (buildingUnderRay's pixel-local hit) agrees
  assert.equal(host.buildingDataForDoor({ dfBlock: B, recordIndex: 0, pixelKey: '4,4', door: { matrix: at(RMB_SIDE + 10) }, pixelLocal: true }).buildingKey, talk.makeBuildingKey(1, 0, 0));
});

// ---- S22: the ship's boarding memory survives a recenter and a reload ----

test('AUDIT 68 S22-ship-disembark-compensation: boarded after a highland recenter, saved, reloaded - the disembark lands on the dock, not 620 under it', async () => {
  const ship = await import('../src/systems/ship.js');
  const { StreamingWorldState } = await import('../src/world/streamingWorld.js');
  const { SHIP_TYPES, shipCoords } = await import('../src/systems/banking.js');
  const { STREAMING_TERRAIN_SCALE } = await import('../src/world/terrainSampler.js');
  // boardOrDisembark's own decision half, lifted: the transition and the landing it hands the teleport
  const arm = lift(WORLD, '    const here = playerTravelPixel();\n    const t = shipTransition(playerEntity, {', ' : null;\n');
  const run = (playerEntity, here, feet, state) => new Function('shipTransition', 'shipMemory', 'shipRestorePos', 'REPOSITION', 'playerEntity', 'playerTravelPixel', 'player', 'cam', 'state', 'STREAMING_TERRAIN_SCALE',
    `${arm}\nreturn { t, localPos, legacy: typeof legacy === 'undefined' ? undefined : legacy };`)(
    ship.shipTransition, ship.shipMemory, ship.shipRestorePos, ship.REPOSITION, playerEntity, () => here, { pos: feet }, { yaw: 0.5 }, state, STREAMING_TERRAIN_SCALE);
  const knight = { ownedShip: SHIP_TYPES.Small };
  const dock = { x: 210, y: 205 };
  // session 1: the highlands raised the eye past 500 - the streamer's vertical recenter
  const s1 = new StreamingWorldState();
  s1.init(dock.x, dock.y);
  s1.update([0, 620, 0]);
  assert.equal(s1.compensation[1], -620);
  const board = run(knight, dock, [410, 30 + s1.compensation[1], 300], s1);   // standing on a dock whose ground is at 30
  assert.equal(board.t.reposition, ship.REPOSITION.RandomStartMarker);
  knight.boardShipPosition = board.t.boardShipPosition;
  // session 2: a fresh page, compensation 0 - the save carried the memory as it was written
  const s2 = new StreamingWorldState();
  const off = run(knight, shipCoords(knight), [0, 0, 0], s2);
  assert.equal(off.t.reposition, ship.REPOSITION.None);
  assert.deepEqual(off.localPos, [410, 30, 300], 'the dock, in the frame the player arrives in');
  assert.equal(off.legacy, false);
  // and within one session after a recenter while aboard, the other sign
  const s3 = new StreamingWorldState(); s3.init(dock.x, dock.y); s3.update([0, -700, 0]);
  assert.deepEqual(run(knight, shipCoords(knight), [0, 0, 0], s3).localPos, [410, 30 + 700, 300]);
  // a memory written raw, before the flag, cannot be recovered: grounded, not stood in the air
  knight.boardShipPosition = { mapPixel: dock, pos: [410, -590, 300], yaw: 0 };
  const old = run(knight, shipCoords(knight), [0, 0, 0], s2);
  assert.equal(old.legacy, true);
  assert.match(WORLD, /await _teleportToPixel\(t\.go\.x, t\.go\.y, localPos, \{ reposition: t\.reposition, grounded: legacy \}\);/);
  // the pure pair
  const m = ship.shipMemory({ mapPixel: dock, pos: [410, -590, 300], yaw: 0, terrainScale: 1.25 }, -620);
  assert.deepEqual(m.pos, [410, 30, 300]);
  assert.deepEqual(ship.shipRestorePos(m, 0), [410, 30, 300]);
  assert.deepEqual(ship.shipRestorePos(m, -620), [410, -590, 300]);
  assert.equal(ship.shipRestorePos({ pos: [1, 2, 3] }, 0), null);
});

// ---- S22: one world move at a time ----

test('AUDIT 68 S22-teleport-reentry: F11 during a fast travel\'s build is refused, not run beside it - and every mover asks the one question first', () => {
  const busy = WORLD.includes('  function worldMoveBusy() {') ? lift(WORLD, '  function worldMoveBusy() {', '\n  }') : '';
  const head = lift(WORLD, '  async function worldQuickLoad(', '    _loading = true;');
  const said = [];
  const load = new Function('townTalk', 'travelOptions', 'worldTimeScale', 'resetTimeScale', 'online',
    `let _seasonStraightening = true, _traveling = true, _teleporting = false, _recalling = false, _respawning = false, _loading = false;\n${busy}\n${head}\n    return 'loading';\n  }\nreturn worldQuickLoad;`)(
    { say: (l) => said.push(l) }, { clearTravelDestination() { said.push('travel cleared'); } }, () => 1, () => {}, null);
  return load().then((r) => {
    assert.equal(r, undefined, 'the load does not start while the travel\'s arrival is building');
    assert.deepEqual(said, ['Loading is disabled while travelling.'], 'it says so, and touches nothing - not even the travel destination');
    // the predicate: the core's own window (the arrival latch) and every mover's latch
    const q = new Function('s', `let { _seasonStraightening, _traveling, _teleporting, _recalling, _respawning, _loading } = s;\n${busy}\nreturn worldMoveBusy();`);
    const idle = { _seasonStraightening: false, _traveling: false, _teleporting: false, _recalling: false, _respawning: false, _loading: false };
    assert.equal(q(idle), false);
    for (const k of Object.keys(idle)) assert.equal(q({ ...idle, [k]: true }), true, `${k} is a world move`);
    // every mover that can be reached while another is in flight refuses first - the ship and the court release had no latch at all
    for (const fn of ['async function fastTravelTo(', 'async function teleportTo(', 'async function recallToAnchor(', 'async function boardOrDisembark(', 'function positionPlayerAtLocationEntrance(']) {
      const at = WORLD.indexOf(`  ${fn}`);
      assert.ok(at > 0, fn);
      const body = WORLD.slice(WORLD.indexOf('{\n', at) + 2);
      assert.match(body, /^ {4}if \(worldMoveBusy\(\)\) return;/, `${fn}: the busy question is the first statement`);
    }
  });
});

// ---- S22: a failed road network is not a known one, and the retry keeps what it painted ----

test('AUDIT 68 S22-roads-retry-crash: a network that failed to build is not "known" on either path, and the retry arm keeps the pixel it painted', async () => {
  const { TerrainGenClient } = await import('../src/world/terrainGenClient.js');
  const warn = console.warn;
  console.warn = () => {};
  try {
    // same thread: buildRoadsFromSettlements catches and answers null
    const woods = { getHeightMapValue() { throw new Error('boom'); } };
    const c = new TerrainGenClient({ woods });
    c.setRoads([{ x: 1, y: 1, name: 'A' }, { x: 5, y: 5, name: 'B' }], null, {});
    assert.equal(c.roads(), null);
    assert.equal(c.hasRoads, false, 'no network, so no pixel is "painted without the network" - the retry gate stays shut');
    // the worker: its settlements arm answers net:null on a failed build
    let onmessage = null;
    const fake = { set onmessage(fn) { onmessage = fn; }, set onerror(fn) {}, postMessage() {}, terminate() {} };
    const w = new TerrainGenClient({ woods, woodsBytes: new Uint8Array(4), workerFactory: () => fake });
    w.setRoads([{ x: 1, y: 1, name: 'A' }], null, {});
    assert.equal(w.hasRoads, true, 'known the moment it is handed over (ROADS 25)');
    onmessage({ data: { t: 'roads', net: null, stats: null } });
    assert.equal(w.hasRoads, false, '...and not once the build has answered none');
    // his ready-made arrays: the worker's net:null acknowledgement leaves them standing
    w.setRoadsData({ roads: new Uint8Array(4), tracks: new Uint8Array(4) });
    onmessage({ data: { t: 'roads', net: null, stats: null } });
    assert.equal(w.hasRoads, true);
  } finally { console.warn = warn; }
  // the host's arm, lifted: the second paint without the network is KEPT, and the builder returns it
  const arm = lift(WORLD, '    if (!withRoads && terrainGen.hasRoads) {', '    const entry = built.get(key);');
  const built = new Map([['3,4', { px: 3, py: 4 }]]);
  const torn = [];
  const run = (roadsRetry) => new Function('withRoads', 'terrainGen', 'roadsRetry', 'destroyPixel', 'buildPixelNow', 'built', 'key', 'px', 'py', 'console',
    `${arm}\n    return entry;`)(false, { hasRoads: true }, roadsRetry, (x, y) => { torn.push(`${x},${y}`); built.delete(`${x},${y}`); },
    () => 'rebuilt', built, '3,4', 3, 4, { warn() {} });
  assert.equal(run(true)?.px, 3, 'kept as painted - the entry is still there to publish');
  assert.deepEqual(torn, []);
  assert.equal(run(false), 'rebuilt', 'the first roadless paint still goes back once');
  assert.deepEqual(torn, ['3,4']);
});

// ---- S22: TL2's edge is the side the landing already faces ----

test('AUDIT 68 S22-tl2-edge-facing: the roof refusal falls back to the edge of the SAME side - no second roll, so the facing is the edge\'s own', async () => {
  const { positionPlayerToLocation, locationArrivalLanding, LOCATION_SIDES, EXTRA_DISTANCE } = await import('../src/world/locationEntrance.js');
  const { RMB_SIDE } = await import('../src/world/locationLayout.js');
  const { locationFromJson } = await import('../src/formats/worldDataReplacement.js');
  // the law: one side pick answers both the marker landing and its edge
  for (const r of [0, 0.3, 0.6, 0.9]) {
    const at = positionPlayerToLocation({ mapWidth: 2, mapHeight: 2, startMarkers: [[5, 0, 5]], useNearestStartMarker: true, roll: () => r });
    const plain = positionPlayerToLocation({ mapWidth: 2, mapHeight: 2, roll: () => r });
    assert.equal(at.usedStartMarker, true);
    assert.deepEqual(at.edge, plain.pos, `roll ${r}: the marker's own side, outside the rectangle`);
    assert.equal(at.yaw, plain.yaw);
  }
  // the host's locationLandingFor, lifted: its edgePos stands on the side its yaw faces, every roll
  const dfLoc = locationFromJson({ Name: 'Edgeford', MapTableData: { LocationType: 'TownCity' }, Exterior: { ExteriorData: { Width: 2, Height: 2, BlockNames: ['A.RMB', 'A.RMB', 'A.RMB', 'A.RMB'] } } }, 5);
  const origin = [100, 0, 200];
  const landingFor = new Function('locationIndex', 'built', 'getLocationTerrainTileOrigin', 'tileSide', 'locationStartMarkers', 'collectBlockFlats', 'locationArrivalLanding', 'mapPixelToWorldCoords', 'state',
    `${lift(WORLD, '  function locationLandingFor(', '\n  }\n')}\nreturn locationLandingFor;`)(
    new Map([['7,8', dfLoc]]), new Map([['7,8', { locBlocks: [{ originX: 0, originZ: 0, dfBlock: {} }], locOrigin: origin }]]),
    () => ({ x: 0, y: 0 }), 1, () => [[5, 0, 5]], () => [], locationArrivalLanding, () => ({ x: 0, z: 0 }), { compensation: [0, -620, 0] });
  const half = RMB_SIDE;   // a 2x2 town's half-extent
  for (let i = 0; i < 24; i++) {
    const l = landingFor(7, 8);
    const side = LOCATION_SIDES.find((s) => Math.abs((s.facing * Math.PI) / 180 - l.yaw) < 1e-9);
    assert.deepEqual(l.edgePos, [origin[0] + half + side.dx * (half + EXTRA_DISTANCE), -620 + 2, origin[2] + half + side.dz * (half + EXTRA_DISTANCE)],
      `the ${side.name} edge, facing ${side.name}'s way`);
  }
  // the core's TL2 arm, lifted: it floors the landing's own edge and asks for no second landing
  const arm = lift(WORLD, '    if (walkMode && landing && pos[1] - raw[1] > OBSTRUCTED_ABOVE) {', '\n    }\n');
  const asked = [];
  const north = { pos: [5, 2, 5], yaw: Math.PI, grounded: true, edgePos: [300, 2, 520] };
  const pos = new Function('walkMode', 'landing', 'raw', 'OBSTRUCTED_ABOVE', 'locationLandingFor', 'floorLanding', 'collider', 'ARRIVAL_REACH', 'ARRIVAL_LIFT', 'px', 'py', 'hint', 'console',
    `let pos = [raw[0], raw[1] + 6, raw[2]];\n${arm}\nreturn pos;`)(
    true, north, north.pos, 3, (...a) => { asked.push(a); return { pos: [300, 2, -120], yaw: 0, grounded: true }; },
    (c, p) => [p[0], p[1] - 1, p[2]], {}, 240, 40, 7, 8, null, { warn() {} });
  assert.deepEqual(pos, [300, 1, 520], 'the north edge, which is the way the camera is about to face');
  assert.deepEqual(asked, [], 'no second side roll');
});

// ---- S17: the grass root takes the tile's real mean colour ----

test('AUDIT 68 S17-ground-mean-colour: a blade\'s root is the mean of the tile\'s own texels, off the color32 getColor32 mints - learned whenever the scene lacks it', async () => {
  const { tileMeanColour, grassRecordsOf } = await import('../src/render/labGrass.js');
  const { TextureFile } = await import('../src/formats/textureFile.js');
  assert.equal(typeof tileMeanColour, 'function');
  // the producer: a real TextureFile over a palette where index 7 is (200,200,200) and 9 is (100,50,0)
  const t = new TextureFile();
  const pal = new Uint8Array(768);
  pal.set([200, 200, 200], 7 * 3); pal.set([100, 50, 0], 9 * 3);
  assert.ok(t.palette.load(pal));
  const bitmap = { width: 2, height: 1, data: new Uint8Array([7, 9]) };
  const near = (a, b) => a.forEach((v, i) => assert.ok(Math.abs(v - b[i]) < 1e-9, `${a} vs ${b}`));
  near(tileMeanColour(t.getColor32(bitmap, 0)), [150 / 255, 125 / 255, 100 / 255]);
  near(tileMeanColour(t.getColor32({ width: 1, height: 1, data: new Uint8Array([7]) }, 0)), [200 / 255, 200 / 255, 200 / 255]);
  // the host's learning block, lifted and run - with the renderer's tile
  // array ALREADY cached (it outlives the scene), so only this block runs
  const block = lift(WORLD, '    if (!grassRecords.has(groundArchive)) {', '\n    }\n');
  const groundMeanColour = new Map();
  const groundTex = { recordCount: 2, getDFBitmap: (r) => (r === 0 ? bitmap : { width: 1, height: 1, data: new Uint8Array([9]) }), getColor32: (b, a) => t.getColor32(b, a) };
  new Function('grassRecords', 'groundArchive', 'groundTex', 'grassRecordsOf', 'groundMeanColour', 'tileMeanColour', block)(
    new Map(), 302, groundTex, grassRecordsOf, groundMeanColour, tileMeanColour);
  assert.ok(groundMeanColour.has(302), 'the scene learned the archive\'s colours though the tile array was the renderer\'s already');
  near(groundMeanColour.get(302)[0], [150 / 255, 125 / 255, 100 / 255]);
  near(groundMeanColour.get(302)[1], [100 / 255, 50 / 255, 0]);
});

// A10 (ROAD TO 1:1, wave A) - three world slices that had decided
// but never done the reference's work:
//
//  1. DungeonLightHandler's XZ block range (DungeonLightHandler.cs
//     :25, :53-75) - the port culled by a 16-slot GPU budget alone.
//  2. TransportManager's ship arm (:382-398) - the port teleported
//     but never cached the scene either side of it.
//  3. The Teleport (Recall) effect's cross-context arm (Teleport.cs
//     :119-164, :190-222, :228-256) - the port refused any anchor set
//     in another host.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { nearestLights } from '../src/world/cityLights.js';
import {
  DUNGEON_LIGHT_BLOCK_RANGE, UNSCALED_BLOCK_RANGE,
} from '../src/world/dungeonLights.js';
import { GLOBAL_SCALE } from '../src/world/meshReader.js';
import { StreamingWorldState, worldCoordToMapPixel } from '../src/world/streamingWorld.js';
import {
  createSceneCache, cacheScene, restoreCachedScene, worldSceneName, LOOT_CONTAINER_TYPES,
} from '../src/systems/sceneCache.js';
import {
  WORLD_CONTEXT, TELEPORT_OR_SET_ANCHOR, ANCHOR_MUST_BE_SET,
  makeAnchor, anchorContextOf, isSameInterior, teleportPlan,
} from '../src/systems/teleportAnchor.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

// ---------------------------------------------------------------
// 1. THE DUNGEON LIGHT BLOCK RANGE
// ---------------------------------------------------------------

test('A10: UnscaledBlockRange 2060 scaled by GlobalScale, verbatim (:25, :60)', () => {
  assert.equal(UNSCALED_BLOCK_RANGE, 2060, 'the field value, not a rounded block footprint');
  assert.equal(DUNGEON_LIGHT_BLOCK_RANGE, 2060 * GLOBAL_SCALE);
});

test('A10: the cut is XZ ONLY - a light straight overhead is never out of range (:62-64)', () => {
  const R = DUNGEON_LIGHT_BLOCK_RANGE;
  const lights = [
    { x: 0, y: 10000, z: 0, range: 5 },        // directly above, absurdly high
    { x: R + 1, y: 0, z: 0, range: 5 },        // just outside on X
    { x: R - 1, y: 0, z: 0, range: 5 },        // just inside on X
  ];
  const out = nearestLights(lights, [0, 0, 0], 16, lights.map((l) => l.range), null, R);
  const xs = [];
  for (let i = 0; i < out.length / 4; i++) xs.push(out[i * 4]);
  assert.deepEqual(xs.sort((a, b) => a - b), [0, R - 1],
    'the vertical distance does not enter the test; the X one does');
});

test('A10: strictly GREATER is disabled - a light exactly at the range stays lit (:67)', () => {
  const R = DUNGEON_LIGHT_BLOCK_RANGE;
  const on = nearestLights([{ x: R, y: 0, z: 0, range: 5 }], [0, 0, 0], 16, 5, null, R);
  assert.equal(on.length, 4, 'Vector3.Distance == scaledRange takes the else arm');
  const off = nearestLights([{ x: R * 1.0001, y: 0, z: 0, range: 5 }], [0, 0, 0], 16, 5, null, R);
  assert.equal(off.length, 0);
});

test('A10: the range is a RANGE, not a budget - forty lights around you all stay lit up to the cap', () => {
  // Forty lights in a tight ring, every one well inside the block
  // range. The reference lights all forty; the port's shader takes
  // 16, so the composition is "the nearest 16 OF THE IN-RANGE SET".
  const lights = [];
  for (let i = 0; i < 40; i++) {
    const a = (i / 40) * Math.PI * 2;
    lights.push({ x: Math.cos(a) * 3, y: 0, z: Math.sin(a) * 3, range: 5 });
  }
  const out = nearestLights(lights, [0, 0, 0], 16, 5, null, DUNGEON_LIGHT_BLOCK_RANGE);
  assert.equal(out.length / 4, 16, 'the GPU cap is the inner bound');
});

test('A10: the cull runs BEFORE the cap - in-range lights never lose a slot to out-of-range ones', () => {
  const R = DUNGEON_LIGHT_BLOCK_RANGE;
  // Twenty far lights listed FIRST, then two near ones. Capping first
  // and culling second would hand the shader nothing at all; the
  // reference order hands it exactly the two in range.
  const lights = [];
  for (let i = 0; i < 20; i++) lights.push({ x: R + 10 + i, y: 0, z: 0, range: 5 });
  lights.push({ x: 1, y: 0, z: 0, range: 5 }, { x: 2, y: 0, z: 0, range: 5 });
  const out = nearestLights(lights, [0, 0, 0], 16, 5, null, R);
  assert.equal(out.length / 4, 2);
  assert.deepEqual([out[0], out[4]], [1, 2], 'and nearest-first among the survivors');
});

test('A10: xzRange 0 is NO cut - every exterior and interior caller unchanged', () => {
  const lights = [{ x: 1e6, y: 0, z: 0, range: 5 }];
  assert.equal(nearestLights(lights, [0, 0, 0], 16, 5).length, 4, 'the default arm');
  assert.equal(nearestLights(lights, [0, 0, 0], 16, 5, null, 0).length, 4, 'explicit 0 too');
});

test('A10: both dungeon hosts pass the block range; the exterior/interior ones do not', () => {
  for (const host of ['src/scenes/dungeon.js', 'src/scenes/worldModes.js']) {
    const h = read(host);
    assert.match(h, /nearestLights\([^)]*flicker\.ranges, null, DUNGEON_LIGHT_BLOCK_RANGE\)/,
      `${host} culls its dungeon lights by the block range`);
    assert.match(h, /DUNGEON_LIGHT_BLOCK_RANGE/, `${host} imports the constant rather than restating 2060`);
  }
  // The interior arm in the same file must NOT take it - a building
  // interior has no DungeonLightHandler on its lights at all.
  const wm = read('src/scenes/worldModes.js');
  assert.match(wm, /nearestLights\(interiorCtx\.lights, cam\.pos, 16, interiorCtx\.lights\.map\(\(l\) => l\.range\)/);
});

// ---------------------------------------------------------------
// 2. THE SHIP'S SCENE CACHE
// ---------------------------------------------------------------

test('A10: the ship arm is a HAND-OFF between two world scenes (:382-388, :393-398)', () => {
  // Both arms cache under the DEPARTURE's scene name and restore
  // under the ARRIVAL's - which makes boarding and disembarking two
  // halves of one exchange rather than two teleports that forget.
  const cache = createSceneCache();
  const dock = worldSceneName(40, 50);
  const ship = worldSceneName(2, 2);
  const pile = { containerType: LOOT_CONTAINER_TYPES.DroppedLoot, nativeX: 1, nativeZ: 2, y: 3, record: 7, items: [{ name: 'chest' }] };

  // Board: cache the dock, arrive at a ship never cached.
  cacheScene(cache, dock, { lootContainers: [pile] });
  assert.equal(restoreCachedScene(cache, ship), null, 'a first boarding finds nothing on the deck');

  // Disembark: cache the deck, arrive back at the dock - and the
  // chest is where it was left.
  const onDeck = { ...pile, record: 9 };
  cacheScene(cache, ship, { lootContainers: [onDeck] });
  const back = restoreCachedScene(cache, dock);
  assert.equal(back.lootContainers.length, 1);
  assert.equal(back.lootContainers[0].record, 7, 'the dock got the DOCK\'s pile back');
  // ...and the deck's own is still waiting for the next boarding
  assert.equal(restoreCachedScene(cache, ship).lootContainers[0].record, 9);
});

test('A10: the host half - cache before the teleport, restore after, in native coordinates', () => {
  const w = read('src/scenes/world.js');
  const i = w.indexOf('async function boardOrDisembark()');
  assert.ok(i > 0);
  const arm = w.slice(i, w.indexOf('setTransportModeHere(t.mode);', i));
  assert.match(arm, /cacheExteriorScene\(here\);/,
    'CacheScene(world.SceneName) with SceneName still naming the pixel being LEFT');
  assert.match(arm, /restoreExteriorScene\(t\.go\);/,
    'RestoreCachedScene(world.SceneName) with SceneName naming the ARRIVAL');
  // ordering: the cache write must precede the teleport, the restore follow it
  assert.ok(arm.indexOf('cacheExteriorScene(') < arm.indexOf('await _teleportToPixel('),
    'cached before departing (:387, :396)');
  assert.ok(arm.indexOf('restoreExteriorScene(') > arm.indexOf('await _teleportToPixel('),
    'restored on arrival (:390, :398)');

  // ...and the pair itself, one definition shared with the Recall arm
  const c = w.indexOf('function cacheExteriorScene(pixel) {');
  const pair = w.slice(c, w.indexOf('function boardOrDisembark', c));
  assert.match(pair, /cacheScene\(_sceneCache\(\), worldSceneName\(pixel\.x, pixel\.y\)/);
  assert.match(pair, /restoreCachedScene\(_sceneCache\(\), worldSceneName\(pixel\.x, pixel\.y\)\)/);
  assert.match(pair, /containerType: LOOT_CONTAINER_TYPES\.DroppedLoot/,
    'the piles ride as DFU\'s own loot containers');
  assert.match(pair, /state\.worldCoords\(pos\)/, 'cached in NATIVE coordinates');
  assert.match(pair, /state\.localFromWorld\(nx, nz\)/, 'and restored back into the arrival origin');
  // the null arm: a scene never cached leaves the arrival as built
  assert.match(pair, /if \(!arrived\) return false;/);
});

test('A10: the to/from-ship exception on the map-pixel clear still stands (PlayerGPS.cs:336-339)', () => {
  // The pair above is only safe because this exception keeps the two
  // scenes out of the world-move clear - DFU's own "ship is special
  // case, cache will not be cleared".
  const w = read('src/scenes/world.js');
  assert.match(w, /if \(!toOrFromShip && playerEntity\.sceneCache\) \{/);
});

// ---------------------------------------------------------------
// 3. THE RECALL ANCHOR, ACROSS CONTEXTS
// ---------------------------------------------------------------

const anchorAt = (over = {}) => makeAnchor({
  worldContext: WORLD_CONTEXT.Exterior, pixel: { x: 40, y: 100 },
  nativeX: 1000, nativeZ: 2000, y: 5, yaw: 1.5, pitch: -0.25, ...over,
});
const outside = { insideBuilding: false, insideDungeon: false, buildingKey: 0, pixel: { x: 40, y: 100 } };

test('A10: the two TEXT.RSC ids the effect raises (:32-33)', () => {
  assert.equal(TELEPORT_OR_SET_ANCHOR, 4000);
  assert.equal(ANCHOR_MUST_BE_SET, 4001);
});

test('A10: SetAnchor carries the CONTEXT and, in a building, the way back in (:100-117)', () => {
  const out = anchorAt();
  assert.equal(out.insideBuilding, false);
  assert.equal(out.insideDungeon, false);
  assert.equal(out.interior, null, 'no doors to carry outside');
  assert.equal(out.buildingKey, 0);
  assert.equal(out.mode, 'world-exterior', 'the TP-slice field stays live for the save envelope');

  const shop = anchorAt({
    worldContext: WORLD_CONTEXT.Interior, buildingKey: 65794,
    interior: { door: { blockIndex: 1, recordIndex: 2, doorIndex: 3, buildingKey: 65794 }, building: { buildingKey: 65794 } },
  });
  assert.equal(shop.insideBuilding, true);
  assert.equal(shop.buildingKey, 65794);
  assert.ok(shop.interior?.door, 'exteriorDoors ride the anchor (:110) - without them it can only land you outside');
  assert.equal(shop.mode, 'interior');

  const crypt = anchorAt({ worldContext: WORLD_CONTEXT.Dungeon, local: [1, 2, 3], buildingKey: 77, interior: { door: {} } });
  assert.equal(crypt.insideDungeon, true);
  assert.equal(crypt.interior, null, 'a dungeon anchor carries no building record');
  assert.equal(crypt.buildingKey, 0);
  assert.deepEqual(crypt.local, [1, 2, 3]);
  // PIN MOVED (ROAD-Ar, R2): this used to assert that makeAnchor stored
  // `worldCompensationY` off the interior arm. It did - and nothing in
  // the port ever read it back, so the pin passed while the law it
  // named (RestoreWorldCompensationHeight, :137-143) had no port at
  // all. The record now carries no such field, and the test below
  // pins the encoding that stands in for the restore.
  for (const a of [out, shop, crypt]) assert.equal('worldCompensationY' in a, false);
});

test('A10: a pre-A10 anchor reads as EXTERIOR rather than falling down a dungeon arm', () => {
  // The TP slice's shape, verbatim off the old save envelope.
  const old = { mode: 'world-exterior', pixel: { x: 40, y: 100 }, nativeX: 1, nativeZ: 2, y: 3 };
  assert.equal(anchorContextOf(old), WORLD_CONTEXT.Exterior);
  assert.equal(anchorContextOf(null), WORLD_CONTEXT.Nothing);
  const plan = teleportPlan(old, outside);
  assert.equal(plan.arrive, 'exterior');
  assert.equal(plan.teleportedIntoDungeon, false);
});

test('A10: IsSameInterior - outside is never "the same interior" (:192-194)', () => {
  const shop = anchorAt({ worldContext: WORLD_CONTEXT.Interior, buildingKey: 7 });
  assert.equal(isSameInterior(shop, outside), false, 'standing in the open');
  assert.equal(isSameInterior(null, { insideBuilding: true, buildingKey: 7, pixel: { x: 40, y: 100 } }), false, 'no anchor');
});

test('A10: IsSameInterior - the building KEY and the map PIXEL both, "in case we\'re unlucky" (:197-207)', () => {
  const shop = anchorAt({ worldContext: WORLD_CONTEXT.Interior, buildingKey: 7 });
  const here = (over) => ({ insideBuilding: true, insideDungeon: false, buildingKey: 7, pixel: { x: 40, y: 100 }, ...over });
  assert.equal(isSameInterior(shop, here()), true);
  assert.equal(isSameInterior(shop, here({ buildingKey: 8 })), false, 'a different building');
  assert.equal(isSameInterior(shop, here({ pixel: { x: 41, y: 100 } })), false,
    'the same key in a different place is NOT the same interior - the forum case DFU cites at :202');
});

test('A10: IsSameInterior - a dungeon is its map pixel alone, "only one per pixel" (:209-218)', () => {
  const crypt = anchorAt({ worldContext: WORLD_CONTEXT.Dungeon, local: [1, 2, 3] });
  const here = (over) => ({ insideBuilding: false, insideDungeon: true, buildingKey: 0, pixel: { x: 40, y: 100 }, ...over });
  assert.equal(isSameInterior(crypt, here()), true);
  assert.equal(isSameInterior(crypt, here({ pixel: { x: 40, y: 101 } })), false);
  // and THIS arm alone raises the teleported-into-dungeon flag (:216)
  assert.equal(teleportPlan(crypt, here()).teleportedIntoDungeon, true);
  const shop = anchorAt({ worldContext: WORLD_CONTEXT.Interior, buildingKey: 0 });
  assert.equal(isSameInterior(shop, here()), false,
    'a building anchor read from inside a dungeon takes the cross-context arm, not this one');
});

test('A10: the same-interior arm moves the player and nothing else (:129-134)', () => {
  const crypt = anchorAt({ worldContext: WORLD_CONTEXT.Dungeon, local: [1, 2, 3] });
  const plan = teleportPlan(crypt, { insideBuilding: false, insideDungeon: true, buildingKey: 0, pixel: { x: 40, y: 100 } });
  assert.equal(plan.kind, 'same-interior');
  assert.deepEqual(plan.local, [1, 2, 3]);
  assert.equal(plan.yaw, 1.5);
  assert.equal(plan.pitch, -0.25);
  assert.equal(plan.cacheScene, undefined, 'nothing is cached, because nothing is left');
});

test('A10: "cache scene before departing" is the three-way arm (:145-151)', () => {
  const out = anchorAt();   // an exterior anchor, so every plan below is cross-context
  const from = (over) => teleportPlan(out, { insideBuilding: false, insideDungeon: false, buildingKey: 0, pixel: { x: 1, y: 1 }, ...over });
  assert.equal(from().cacheScene, 'exterior', 'outside: CacheScene(StreamingWorld.SceneName) (:147)');
  assert.equal(from({ insideBuilding: true }).cacheScene, 'building', 'in a building: the interior (:149)');
  const dungeon = from({ insideDungeon: true });
  assert.equal(dungeon.cacheScene, null, 'in a dungeon: nothing is cached');
  assert.equal(dungeon.dungeonExitImmediate, true, 'TransitionDungeonExteriorImmediate instead (:151)');
});

test('ROAD-Ar (R2): the compensation restore is an ENCODING here, not a plan field (:137-143)', () => {
  // PIN MOVED (ROAD-Ar, R2). What stood here asserted
  // `teleportPlan(shop, outside).worldCompensationY === 31` - the
  // payload of RestoreWorldCompensationHeight on the plan object. The
  // plan is consumed by exactly one host (recallToAnchor, the only
  // importer of teleportPlan), and that host never read the field, so
  // the named law had NO port and the pin could not tell. What the
  // port actually does instead is store the anchor's height
  // compensation-FREE and re-add the LIVE compensation on arrival,
  // which needs no restore at all because it survives any recenter
  // between the set and the cast. That is what this pins now.
  for (const a of [
    anchorAt({ worldContext: WORLD_CONTEXT.Interior, buildingKey: 7 }),
    anchorAt(),
    anchorAt({ worldContext: WORLD_CONTEXT.Dungeon, local: [0, 0, 0] }),
  ]) {
    const plan = teleportPlan(a, outside);
    assert.equal('worldCompensationY' in plan, false,
      'a field no host reads is the payload of a law with no port');
  }
  // The host half: setRecallAnchor takes the compensation OUT and
  // anchorLanding puts the live one back, so the two are inverse.
  const world = read('src/scenes/world.js');
  assert.match(world, /y: pf\[1\] - state\.compensation\[1\],/,
    'the anchor height must be stored compensation-free');
  assert.match(world, /return \[lx, \(a\.y \?\? 2\) \+ state\.compensation\[1\], lz\];/,
    'and anchorLanding must re-add the LIVE compensation');
  assert.equal(world.includes('worldCompensationY'), false,
    'no half-plumbed restore payload survives in the host');
  assert.equal(read('src/systems/teleportAnchor.js').includes('worldCompensationY:'), false,
    'nor in the law module');
});

test('A10: where the plan LANDS, and who owns the arrival restore (:622-655, :246-252)', () => {
  const arm = (ctx, over = {}) => teleportPlan(anchorAt({ worldContext: ctx, ...over }), outside);
  const ext = arm(WORLD_CONTEXT.Exterior);
  assert.equal(ext.arrive, 'exterior');
  assert.equal(ext.teleportedIntoDungeon, false);

  const bld = arm(WORLD_CONTEXT.Interior, { buildingKey: 7, interior: { door: {} } });
  assert.equal(bld.arrive, 'building', 'RespawnPlayer off the anchor\'s exteriorDoors (:632-643)');
  assert.equal(bld.teleportedIntoDungeon, false);

  const dng = arm(WORLD_CONTEXT.Dungeon, { local: [4, 5, 6] });
  assert.equal(dng.arrive, 'dungeon', 'RespawnPlayer(insideDungeon: true) (:626-630)');
  assert.equal(dng.teleportedIntoDungeon, true, 'the flag off the ANCHOR, not the departure (:246)');

  // The plan carries NO arrival-restore field, and that is the law
  // rather than an omission: DFU's (:249) keys off IsPlayerInside at
  // the moment the respawner completes, so an arm that meant to land
  // inside and repositioned outside restores the EXTERIOR scene.
  // Only the caller knows where the player ended up.
  for (const p of [ext, bld, dng]) assert.equal('restoreScene' in p, false);
  const w = read('src/scenes/world.js');
  assert.match(w, /if \(!landed\) restoreExteriorScene\(a\.pixel\);/,
    'the host answers it from the LANDING, which is DFU\'s own condition');
});

test('A10: no anchor is no plan - the caller raises 4001 (:268-275)', () => {
  assert.equal(teleportPlan(null, outside), null);
  assert.equal(teleportPlan(undefined, { insideDungeon: true, pixel: { x: 1, y: 1 } }), null);
});

test('A10: the host half - the refusal is GONE and every arm is wired', () => {
  const w = read('src/scenes/world.js');
  assert.equal(/cross-host recall pends/.test(w), false,
    'the INTERIM refusal this slice closes must be gone from the site, not merely bypassed');
  // SetAnchor reads the mounted mode's half rather than assuming outdoors
  assert.match(w, /modes\?\.anchorContext\?\.\(\)/, 'SetAnchor asks the mounted mode which context it is (:107-112)');
  assert.match(w, /makeAnchor\(\{/, 'and builds the ONE anchor shape');
  // TeleportPlayer asks IsSameInterior through the law, with the live flags
  assert.match(w, /teleportPlan\(anchor, \{[\s\S]*?modes\?\.insideContext\?\.\(\)/,
    'the plan is fed PlayerEnterExit\'s two live flags (:193, :197, :209)');
  assert.match(w, /if \(plan\.kind === 'same-interior'\)/);
  // the three landings
  assert.match(w, /plan\.arrive === 'dungeon'[\s\S]*?modes\?\.startInDungeon\?\.\(\)/,
    'the dungeon mount - the same door the quest respawner uses');
  assert.match(w, /plan\.arrive === 'building'[\s\S]*?modes\?\.restoreInterior\?\.\(a\.interior/,
    'the building re-entry - the same door the quickload uses');
  assert.match(w, /playerEntity\.playerTeleportedIntoDungeon = plan\.teleportedIntoDungeon;/,
    'the flag lands (:246)');
  assert.match(w, /if \(plan\.cacheScene === 'exterior'\) cacheExteriorScene\(playerTravelPixel\(\)\);/,
    'the outside arm of "cache scene before departing" (:147)');
});

test('A10: the anchor landing is native-coordinate for everything but a dungeon', () => {
  // A dungeon's frame never moves, so its transform survives; an
  // interior's is the exterior's (P8's unified frame) and the
  // floating origin shifts it, so it must land off natives - which is
  // why anchorContext hands back no local position for a building.
  const w = read('src/scenes/world.js');
  assert.match(w, /if \(a\.insideDungeon && a\.local\) return \[\.\.\.a\.local\];/);
  assert.match(w, /state\.localFromWorld\(a\.nativeX, a\.nativeZ\)/);
  const wm = read('src/scenes/worldModes.js');
  const i = wm.indexOf('anchorContext() {');
  const fn = wm.slice(i, wm.indexOf('insideContext()', i));
  assert.match(fn, /WORLD_CONTEXT\.Interior,\s*\n\s*local: null,/, 'no stale local on a building anchor');
  assert.match(fn, /WORLD_CONTEXT\.Dungeon, local: \[\.\.\.player\.pos\]/, 'the dungeon carries its own');
});

test('A10: the anchor is a BOOKMARK, not a save - it never writes the live scene', () => {
  // SetAnchor (:107-112) reads ExteriorDoors and BuildingDiscoveryData
  // and nothing else. interiorSaveData caches the live interior on its
  // way past; the anchor must take the identity without that write, or
  // the next real exit restores a stale entry.
  const wm = read('src/scenes/worldModes.js');
  const i = wm.indexOf('interiorAnchorData() {');
  assert.ok(i > 0, 'the cache-free reader exists');
  const fn = wm.slice(i, wm.indexOf('},', i));
  assert.equal(/cacheInteriorScene\(\)/.test(fn), false);
  assert.match(fn, /interiorIdentity\(\)/);
  // ...and the SAVE half still does cache, through the same identity
  const s = wm.indexOf('interiorSaveData() {');
  const save = wm.slice(s, wm.indexOf('},', s));
  assert.match(save, /cacheInteriorScene\(\);/);
  assert.match(save, /interiorIdentity\(\)/, 'one identity, two readers');
});

test('A10: the dungeon context routes Recall UP when the streaming host mounted it', () => {
  const dc = read('src/scenes/dungeonContext.js');
  assert.match(dc, /onTeleport: \(\) => \{\s*\n\s*if \(opts\.onTeleport\) \{ opts\.onTeleport\(\); return; \}/,
    'the mounted arm takes the host\'s prompt');
  assert.match(dc, /Recall pends in the standalone dungeon/,
    'and the standalone ?dungeon probe keeps the honest refusal - the AUDIT 24 seam shape, deliberate');
  const wm = read('src/scenes/worldModes.js');
  assert.match(wm, /onTeleport: host\.onTeleport \? \(\) => host\.onTeleport\(\) : null,/,
    'worldModes hands the outer host\'s prompt down to the context it mounts');
  const w = read('src/scenes/world.js');
  assert.match(w, /onTeleport: \(\) => teleportPrompt\(\),/, 'and the outer host supplies it - twice, engine and modes');
});

test('A10 CLOSEOUT: PlayerGPS freezes its map pixel underground (StreamingWorld.cs:297-301)', () => {
  // DFU opens StreamingWorld.Update with the law and its reason:
  //     // Do not update world position if player is inside dungeon
  //     // This can cause player to become desynced from world as dungeon
  //     // can actually extend beyond the current map pixel area
  //     if (GameManager.Instance.PlayerEnterExit.IsPlayerInsideDungeon) return;
  // so WorldX/WorldZ - and with them CurrentMapPixel, which is just
  // WorldCoordToMapPixel of the two (PlayerGPS.cs:141-143) - hold the
  // entrance's values for as long as the player is down there. BOTH
  // sides of IsSameInterior's dungeon arm (Teleport.cs:209-218) read
  // that one frozen source, which is how the arm can ever answer true.
  //
  // The port converted the player's DUNGEON-LOCAL feet through the
  // streamer's exterior origin instead. RDB block origins are signed
  // (dungeonLayout.js:64-65, RDB_SIDE = 51.2), so the arithmetic below
  // is not a corner case: walking one block west or south of the start
  // slides the pixel, and Privateer's Hold - the first dungeon in the
  // game - has blocks at -51.2 on both axes.
  const st = new StreamingWorldState();
  st.init(100, 200);
  const pixelOfFeet = (p) => { const wc = st.worldCoords(p); return worldCoordToMapPixel(wc.x, wc.z); };
  assert.deepEqual(pixelOfFeet([28.375, 0, 12.4]), { x: 100, y: 200 }, 'the start block is on the entrance pixel');
  assert.deepEqual(pixelOfFeet([-30, 0, 12.4]), { x: 99, y: 200 }, 'one block WEST and the pixel slides');
  assert.deepEqual(pixelOfFeet([28.375, 0, -20]), { x: 100, y: 201 }, 'one block SOUTH and it slides the other way');

  // ...and that slide is exactly what the dungeon arm cannot survive:
  // the anchor's pixel is the streamer's (setRecallAnchor has always
  // taken it there), so a slid read makes Recall in the room you are
  // standing in take the CROSS plan - forceExitToExterior, which tears
  // the dungeon down with its quest flats, its foes and its loot, and
  // re-mounts it from the entrance (or says "The way underground is
  // closed" where no entrance door is found).
  const crypt = makeAnchor({
    worldContext: WORLD_CONTEXT.Dungeon, pixel: { x: 100, y: 200 },
    nativeX: 0, nativeZ: 0, y: 0, yaw: 0, pitch: 0, local: [1, 2, 3], buildingKey: 0, interior: null,
  });
  const here = (pixel) => ({ insideBuilding: false, insideDungeon: true, buildingKey: 0, pixel });
  assert.equal(teleportPlan(crypt, here(pixelOfFeet([-30, 0, -20]))).kind, 'cross',
    'the feet-derived pixel loses the arm outright');
  assert.equal(teleportPlan(crypt, here({ x: st.current.x, y: st.current.y })).kind, 'same-interior',
    "...where the frozen pixel is the room the player is standing in");

  // THE HOST SEAM, which no pin ever asked about: `playerTravelPixel`
  // is this port's PlayerGPS.CurrentMapPixel, and it owes the freeze -
  // not just `recallToAnchor`, since the region/paperdoll read, the
  // footstep climate, the loose-pile keys and the quest location
  // lookup all go through it.
  const w2 = read('src/scenes/world.js');
  const fn = w2.slice(w2.indexOf('function playerTravelPixel() {'));
  const body = fn.slice(0, fn.indexOf('\n  }'));
  assert.match(body, /if \(\(modes\?\.mode \?\? 'exterior'\) === 'dungeon'\) return \{ x: state\.current\.x, y: state\.current\.y \};/,
    'the dungeon arm answers the streamer pixel');
  assert.ok(body.indexOf("=== 'dungeon'") < body.indexOf('state.worldCoords('),
    'and it answers BEFORE the feet are converted through the exterior origin');
});

// AUDIT 26 PARITY - wave hosts-streaming. Four laws the streaming host
// (?world) and its fixed-location twin (?exterior) had wrong, each one
// a measurable divergence rather than a crash:
//   F061 - the active crime cleared on the MAP PIXEL crossing instead
//          of on PlayerGPS's location-RECT exit;
//   F062 - the encounter roll's location arm read "this pixel carries
//          a location" instead of IsPlayerInLocationRect;
//   F207 - both exterior hosts fed the Detect scan entities only, so
//          Detect Treasure found nothing above ground although both
//          mount dropped piles and leave lootable corpses;
//   F216 - the exterior quicksave carried no live enemy at all, where
//          SaveData_v1 carries enemyData wherever the player stands.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { locationWorldRect, isInLocationRect, StreamingWorldState } from '../src/world/streamingWorld.js';
import { clearCrimeOnLocationExit } from '../src/systems/court.js';
import { intermittentEnemySpawn, MIN_WILDERNESS_SPAWN_DISTANCE } from '../src/systems/encounters.js';
import { CLIMATES } from '../src/formats/mapsFile.js';
import { createDetectFeed, lootNearbyRecord } from '../src/scenes/shared.js';
import { REFRESH_NEARBY_OBJECTS_INTERVAL } from '../src/systems/nearbyObjects.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (p) => readFileSync(join(root, p), 'utf8');

/** A 1x1 town's map data - the smallest footprint locationWorldRect
 *  takes, and the one where the pixel/rect gap is widest. */
const town1x1 = { exterior: { exteriorData: { width: 1, height: 1, blockNames: ['TVRNAS_00.RMB'] } } };

// ---------------------------------------------------------------
// F061 - PlayerGPS_OnExitLocationRect (PlayerEntity.cs:2449-2452)
// clears CrimeCommitted, and PlayerLocationRectCheck (PlayerGPS.cs
// :668-715) raises that event on the WIDENED WORLD RECT falling true
// -> false, never on a map-pixel crossing (:687: "Player can be
// inside a map pixel with location but not inside location rect").
// ---------------------------------------------------------------

test('audit26p F061: the location RECT is not the map pixel - the numbers, at a 1x1 town', () => {
  // The pixel is 32768 world units across (MapsFile); pixel 100,100's
  // corner is the rect's origin frame.
  const px = 100, py = 100;
  const corner = { x: px * 32768, z: (499 - py) * 32768 };
  const rect = locationWorldRect(town1x1, px, py);
  // SetWorldLocationRect (:636-659): the terrain tile origin of a 1x1
  // location is tile 56, and a tile is 2 * 128 world units.
  assert.equal(rect.minX - corner.x, 56 * 2 * 128);
  assert.equal(rect.maxX - rect.minX, 4096, 'one RMB block wide (WorldMapRMBDim)');
  // The check widens by one full city block on every side (:670, 690).
  assert.equal(isInLocationRect(rect.minX - 4096, rect.minZ, rect), true, 'the widened edge is IN');
  assert.equal(isInLocationRect(rect.minX - 4097, rect.minZ, rect), false, 'one unit past it is OUT');
  // ...and the point that makes the whole finding: deep inside the map
  // pixel, far outside the town.
  const inPixelOutOfRect = corner.x + 2000;
  assert.ok(inPixelOutOfRect >= corner.x && inPixelOutOfRect < corner.x + 32768, 'still the same map pixel');
  assert.equal(isInLocationRect(inPixelOutOfRect, corner.z + 2000, rect), false,
    'and outside the rect - where DFU has already cleared the crime');
});

test('audit26p F061: the clear is the rect EXIT transition, not any key change', () => {
  // The host tracks the rect it stands in and calls the one court
  // member only on true -> false, exactly as :709-714 raises the event
  // on that crossing alone.
  const step = (state, inRect, key) => {
    const now = inRect ? key : null;
    if (state.rect && !now) clearCrimeOnLocationExit(state.entity, state.rect, now);
    state.rect = now;
    return state.entity.crimeCommitted;
  };
  const state = { rect: null, entity: { crimeCommitted: 5 } };
  assert.equal(step(state, false, '100,100'), 5, 'the wilderness is not an exit');
  assert.equal(step(state, true, '100,100'), 5, 'ENTERING a rect is not an exit');
  assert.equal(step(state, true, '100,100'), 5, 'standing in it is not an exit');
  assert.equal(step(state, false, '100,100'), 0, 'leaving the rect - inside the SAME pixel - clears');
});

test('audit26p F061: the world host clears crime off the rect, and syncTopics no longer does', () => {
  const s = src('src/scenes/world.js');
  const i = s.indexOf('function syncTopics()');
  const j = s.indexOf('function syncLocationRectCrime()');
  assert.ok(i > 0 && j > i, 'both halves are here, the rect sync after the topic sync');
  assert.equal(s.slice(i, j).includes('clearCrimeOnLocationExit'), false,
    'the PIXEL crossing does not clear the crime - it is not OnExitLocationRect');
  const fn = s.slice(j, j + 400);
  assert.ok(fn.includes('_musicInLocationRect() ? _topicsKey : null'), 'the rect membership IS the flag');
  assert.ok(fn.includes('if (_crimeRectKey && !inRect) clearCrimeOnLocationExit(playerEntity, _crimeRectKey, inRect);'),
    'and only the true -> false crossing calls the court member');
  assert.equal((s.match(/clearCrimeOnLocationExit\(/g) || []).length, 1, 'ONE caller in the host');
  // the frame runs it every tick, as PlayerGPS.Update runs
  // PlayerLocationRectCheck, and AFTER syncTopics, which owns _musicLoc
  const st = s.indexOf('    syncTopics();');
  const sr = s.indexOf('    syncLocationRectCrime();');
  assert.ok(st > 0 && sr > st, 'the frame calls the rect check right after the topic sync');
});

// ---------------------------------------------------------------
// F062 - IntermittentEnemySpawn branches on
// PlayerGPS.IsPlayerInLocationRect (PlayerEntity.cs:564-596): the
// location arm rolls at NIGHT ONLY, the wilderness arms roll day and
// night. Feeding it "the pixel carries a location" silenced daytime
// encounters in the whole wilderness ring of every town.
// ---------------------------------------------------------------

test('audit26p F062: the flag alone decides whether a daytime minute can spawn', () => {
  const always = () => 0;   // every roll lands: RollRandomSpawn_* == 0 spawns
  const day = { gameMinutes: 576, inside: false, climateIndex: CLIMATES.Mountain, playerLevel: 3 };
  assert.equal(intermittentEnemySpawn({ ...day, inLocationRect: true }, always), null,
    'a location rect by DAY spawns nothing - the arm is night-only (:566-576)');
  const wild = intermittentEnemySpawn({ ...day, inLocationRect: false }, always);
  assert.ok(wild, 'the same minute in the wilderness rolls RollRandomSpawn_WildernessDay');
  assert.equal(wild.minDistance, MIN_WILDERNESS_SPAWN_DISTANCE);
  // and at night the two arms take different tables/distances
  const night = { gameMinutes: 1296, inside: false, climateIndex: CLIMATES.Mountain, playerLevel: 3 };
  const inRect = intermittentEnemySpawn({ ...night, inLocationRect: true }, always);
  const outRect = intermittentEnemySpawn({ ...night, inLocationRect: false }, always);
  assert.equal(inRect.minDistance, 10, 'minLocationDistance');
  assert.equal(outRect.minDistance, 10, 'minWildernessDistance');
  assert.notEqual(inRect.mobileType, outRect.mobileType,
    'the location-night table is not the wilderness-night table');
});

test('audit26p F062: the world host feeds the roll the RECT, not the pixel index', () => {
  const s = src('src/scenes/world.js');
  const i = s.indexOf('function runEncounterTick');
  assert.ok(i > 0);
  const fn = s.slice(i, i + 1800);
  assert.ok(fn.includes('inLocationRect: _musicInLocationRect()'), 'IsPlayerInLocationRect');
  assert.equal(fn.includes('locationIndex.has('), false, 'the map-pixel predicate is gone from the loop');
});

// ---------------------------------------------------------------
// F207 - UpdateNearbyObjects (PlayerGPS.cs:747-776) walks every
// active DaggerfallLoot with no scene gate at all, and GetLootFlags
// (:822-836) filters only on emptiness - the corpse container
// included, which the C# asks about out loud and leaves in.
// ---------------------------------------------------------------

test('audit26p F207: a Detect Treasure feed marks dropped piles AND corpse containers', () => {
  const entity = { activeEffects: [{ kind: 'detectTreasure' }] };
  const pile = { pos: [2, 0, 0], items: [{ templateIndex: 1 }] };
  const corpse = { pos: [0, 0, 3], items: [{ templateIndex: 2 }, { templateIndex: 3 }] };
  const empty = { pos: [0, 0, 4], items: [] };
  const feed = createDetectFeed(entity, {
    loot: () => [pile, corpse, empty].map(lootNearbyRecord),
    feet: () => [0, 0, 0],
  });
  const markers = feed.tick(REFRESH_NEARBY_OBJECTS_INTERVAL + 0.01);
  assert.deepEqual(markers, [[2, 0], [0, 3]],
    'both non-empty containers are marked, in scan order; the empty one is not (GetLootFlags)');
  // no detector, no markers - the port's own gate, unchanged
  entity.activeEffects[0].ended = true;
  assert.deepEqual(feed.tick(REFRESH_NEARBY_OBJECTS_INTERVAL + 0.01), []);
});

test('audit26p F207: both exterior hosts feed the scan their LOOT pools', () => {
  for (const f of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    const s = src(f);
    const i = s.indexOf('const detectLoot = () =>');
    assert.ok(i > 0, `${f}: the host answers the loot half of UpdateNearbyObjects`);
    const fn = s.slice(i, s.indexOf('const detectFeed = createDetectFeed', i));
    assert.ok(fn.includes('droppedLoot._piles'), `${f}: the player's own dropped piles are loot`);
    assert.ok(fn.includes(".filter((f) => f.corpse && f.entity && !f.corpseDisabled)"),
      `${f}: and so is every lootable corpse - the same test the activation targets use`);
    assert.ok(fn.includes('pos: f.corpseMarker?.pos ?? f.ai?.feet ?? null, items: f.entity.items ?? []'),
      `${f}: the container is the body's ground marker and its items`);
    assert.ok(fn.includes("(modes?.mode ?? 'exterior') !== 'exterior' ? [] :"),
      `${f}: an exterior pool is not active while the player is inside`);
    assert.ok(s.includes('loot: () => detectLoot().map(lootNearbyRecord),'),
      `${f}: and the feed is given it`);
  }
  // the world host's pool is BOTH its foe pools, the fixed host's is
  // the only one it mounts
  assert.ok(src('src/scenes/world.js').includes('...[...cityGuards.guards, ...exteriorFoes.foes]\n      .filter((f) => f.corpse'),
    'the streaming host: the watch AND the encounter foes');
  assert.ok(src('src/scenes/exterior.js').includes('...cityGuards.guards\n      .filter((f) => f.corpse'),
    'the ?exterior page: the watch, the only pool it spawns');
});

// ---------------------------------------------------------------
// F216 - SaveData_v1.enemyData is built for every registered live
// enemy wherever the player stands (SaveLoadManager.cs:865, restored
// :1006 -> SerializableStateManager.RestoreEnemyData :404-425), and
// an exterior enemy is registered like any other.
// ---------------------------------------------------------------

test('audit26p F216: the world envelope carries the live encounter foes, in NATIVES', () => {
  const s = src('src/scenes/world.js');
  const i = s.indexOf('function worldQuickSave');
  const fn = s.slice(i, s.indexOf('let _loading = false;', i));
  // AUDIT 26: this pin used to assert the `!f.dead &&` filter - the
  // port's answer, not the C#. SerializableEnemy SAVES the dead
  // (:115 isDead) and the restore disables the restored enemy
  // (:200-203); EnemyDeath.cs:76-77 keeps the object alive for exactly
  // that reason. Dropping corpses from the envelope while the load's
  // teardown could not remove them either duplicated their loot
  // through the save key.
  assert.ok(fn.includes('foes: exteriorFoes.foes.filter((f) => f.ai && !f.questBehaviour && (!f.dead || f.corpse))'),
    'every non-quest foe rides the save, a body on the ground included');
  assert.ok(fn.includes('const fwc = state.worldCoords(fpos);'), 'positions are NATIVES, not scene coords');
  assert.ok(fn.includes('y: fpos[1] - state.compensation[1]'), 'and the height sheds the compensation');
  // SerializableEnemy's own fields (:110-118)
  for (const k of ['mobileType', 'gender', 'yaw', 'health', 'magicka', 'items', 'hostile', 'encountered']) {
    assert.ok(new RegExp(`${k}:`).test(fn), `the record carries ${k}`);
  }
});

test('audit26p F216: the load re-mints exactly the saved enemy set', () => {
  const s = src('src/scenes/world.js');
  const i = s.indexOf('async function worldQuickLoad');
  const fn = s.slice(i, s.indexOf('const toggleTravelMap', i));
  // AUDIT 26: and this half pinned a teardown that could not tear a
  // corpse down. removeFoe's first line returns on a dead foe, so the
  // destroy is TWO doors - the disabled enemy and its loot container.
  assert.ok(fn.includes('exteriorFoes.removeFoe(f);') && fn.includes('exteriorFoes.removeCorpse(f);'),
    'the live pool AND its bodies are destroyed first - nothing born or killed after the save survives the load');
  assert.ok(fn.includes('const [fx, fz] = state.localFromWorld(sf.nativeX, sf.nativeZ);'),
    'and the saved ones land at their native spots under the NEW origin');
  assert.ok(fn.includes('await exteriorFoes.spawnFoe(sf.mobileType,'), 'ASYNC NEVER DROPS: the re-mint is awaited');
  for (const k of ['f.entity.health = sf.health;', 'f.entity.magicka = sf.magicka ?? f.entity.magicka;',
    'f.ai.isHostile = sf.hostile !== false;', 'f.ai.hasEncounteredPlayer = !!sf.encountered;']) {
    assert.ok(fn.includes(k), `the restore sets ${k}`);
  }
  // the point of natives: a foe saved under one floating origin lands
  // on the same ground under another (the pile half's law)
  const st = new StreamingWorldState();
  st.init(207, 213);
  const feet = [123.5, 40, -87.25];
  const wc = st.worldCoords(feet);
  st.compensation = [819.2, 3, -819.2];
  const [lx, lz] = st.localFromWorld(wc.x, wc.z);
  const back = st.worldCoords([lx, 0, lz]);
  assert.ok(Math.abs(back.x - wc.x) < 1e-6 && Math.abs(back.z - wc.z) < 1e-6,
    'the native round-trip survives a recenter');
});

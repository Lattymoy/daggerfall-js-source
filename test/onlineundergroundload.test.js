import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { undergroundWakeSpot, undergroundWakeText, nearestSafeLocation } from '../src/systems/deathRespawn.js';
import { LOCATION_TYPES, DUNGEON_TYPES } from '../src/formats/mapsFile.js';

// ═══ ONLINE-UNDERGROUND-LOAD1 ═══════════════════════════════════════
//
// Lost, 2026-09-19: online, the game saves when the page closes; a character saved underground must not wake
// inside the dungeon on the next online load - it wakes near a city, graveyard or temple.

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');
/** A map-table row at a map pixel: the reader's own lon/lat encoding, inverted (donline1_respawn's own fixture). */
const at = (x, y, locationType, dungeonType = DUNGEON_TYPES.NoDungeon) => ({ longitude: x * 128, latitude: (499 - y) * 128, locationType, dungeonType });

test('ONLINE-UNDERGROUND-LOAD1: the wake spot is the death respawn\'s own nearest-safe pick over the dungeon\'s pixel', () => {
  const table = [
    at(40, 40, LOCATION_TYPES.DungeonLabyrinth),          // the dungeon itself - never a wake spot
    at(44, 40, LOCATION_TYPES.ReligionTemple),
    at(40, 43, LOCATION_TYPES.TownVillage),
    at(50, 50, LOCATION_TYPES.Graveyard, DUNGEON_TYPES.Cemetery),
  ];
  const spot = undergroundWakeSpot(table, { x: 40, y: 40 });
  assert.deepEqual(spot, { kind: 'city', mapPixel: { x: 40, y: 43 } }, 'three pixels south: the village beats the temple four east');
  const pick = nearestSafeLocation(table, { x: 40, y: 40 });
  assert.equal(spot.kind, pick.kind, 'one search, not a second one');
  assert.deepEqual(spot.mapPixel, pick.mapPixel);
  assert.equal(undergroundWakeSpot(table, { x: 49, y: 50 }).kind, 'graveyard');
  assert.equal(undergroundWakeSpot(table, { x: 45, y: 40 }).kind, 'temple');
});

test('ONLINE-UNDERGROUND-LOAD1: a region with none of the three wakes the character at the dungeon\'s own door, never nowhere', () => {
  const table = [at(1, 1, LOCATION_TYPES.Tavern), at(2, 2, LOCATION_TYPES.DungeonKeep), null];
  assert.deepEqual(undergroundWakeSpot(table, { x: 7, y: 9 }), { kind: 'dungeon', mapPixel: { x: 7, y: 9 } });
  assert.deepEqual(undergroundWakeSpot(null, { x: 7, y: 9 }), { kind: 'dungeon', mapPixel: { x: 7, y: 9 } }, 'no table at all is the same answer, not a throw');
  const pixel = { x: 7, y: 9 };
  assert.notEqual(undergroundWakeSpot([], pixel).mapPixel, pixel, 'a copy - the caller\'s pixel is never handed back to be mutated');
});

test('ONLINE-UNDERGROUND-LOAD1: one wake line per kind, none of them a death line, an unknown kind reading as the city\'s', () => {
  for (const kind of ['temple', 'city', 'graveyard', 'dungeon']) {
    const line = undergroundWakeText(kind);
    assert.ok(typeof line === 'string' && line.length > 30, `${kind}: a line`);
    assert.doesNotMatch(line, /death|dead|died|dying/i, `${kind}: leaving is not dying`);
  }
  assert.match(undergroundWakeText('temple'), /temple/i);
  assert.match(undergroundWakeText('graveyard'), /headstones/i);
  assert.equal(undergroundWakeText('nowhere'), undergroundWakeText('city'));
});

test('ONLINE-UNDERGROUND-LOAD1 by source: the boot load\'s dungeon arm wakes an ONLINE page at the safe place - the Hold excepted - and leaves the offline arm as it was', () => {
  const w = read('src/scenes/world.js');
  const i = w.indexOf(`} else if (String(extras.locationKey ?? '').startsWith('dungeon:')) {`);
  assert.ok(i > 0, 'the dungeon arm of worldQuickLoad');
  const arm = w.slice(i, w.indexOf(`} else if (extras.locationKey && extras.locationKey !== 'world') {`, i));
  assert.match(arm, /else if \(onlineOn && !\(pixel\.x === getInt\('Startup', 'StartCellX'\) && pixel\.y === getInt\('Startup', 'StartCellY'\)\)\) \{/,
    'the PAGE flag (the boot load runs before any session exists), and the tutorial dungeon read off the configured start cell');
  assert.match(arm, /undergroundWakeSpot\(maps\.getRegion\(maps\.getRegionIndexAt\(pixel\.x, pixel\.y\)\)\?\.mapTable \?\? \[\], pixel\)/,
    'the region the DUNGEON stands in - the player is not there yet, so the current-region reader would answer the start cell\'s');
  assert.match(arm, /_teleportToPixel\(wake\.mapPixel\.x, wake\.mapPixel\.y, null, \{ modEvent: 'load', reposition: REPOSITION\.RandomStartMarker \}\)/,
    'the same teleport core and the death respawn\'s own marker landing, still a LOAD to the seasons');
  assert.match(arm, /townTalk\.say\(undergroundWakeText\(wake\.kind\)\)/);
  assert.doesNotMatch(arm.slice(0, arm.indexOf('} else {')), /startInDungeon|restoreDungeonSave/, 'the online arm never re-enters the dungeon');
  assert.match(arm, /\} else \{\s*\n\s*await _teleportToPixel\(pixel\.x, pixel\.y, null, \{ modEvent: 'load' \}\);[^\n]*\n\s*const entered = await \(modes\?\.startInDungeon\?\.\(\{ locationKey: extras\.locationKey \}\) \?\? false\);/,
    'offline (and the Hold) re-enter the dungeon exactly as MAC6 #1 wrote it (CASTLE1: naming the saved dungeon)');
  assert.match(w, /import \{[^}]*undergroundWakeSpot, undergroundWakeText[^}]*\} from '\.\.\/systems\/deathRespawn\.js';/);
});

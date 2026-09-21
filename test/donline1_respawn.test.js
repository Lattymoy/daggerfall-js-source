import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { nearestSafeLocation, respawnFlavorText, respawnHealth, RESPAWN_HEALTH_FRACTION } from '../src/systems/deathRespawn.js';
import { LOCATION_TYPES, DUNGEON_TYPES, longitudeLatitudeToMapPixel } from '../src/formats/mapsFile.js';

// ═══ D-ONLINE1: ONLINE, A DEATH RESPAWNS INSTEAD OF ENDING THE RUN ══
//
// Mac, 2026-09-17 ("daggerfalljsWildlifeSpawnsRespawn"; players: "when
// i die i just end up at the title menu", "still see you have died
// then main menu", "you should just respawn in this case"): in online
// play the death sequence still plays, and then, instead of the death
// video and the title menu, the player wakes at the nearest temple,
// town or graveyard - or, dead underground, on the dungeon's own door
// - with half their health and a line saying so. F11 on the death
// screen respawns too where it used to quickload. Offline is untouched.

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');
/** A map-table row at a map pixel: the reader's own lon/lat encoding, inverted. */
const at = (x, y, locationType, dungeonType = DUNGEON_TYPES.NoDungeon) => ({ longitude: x * 128, latitude: (499 - y) * 128, locationType, dungeonType });

test('D-ONLINE1: nearestSafeLocation picks the closest temple, town (city, hamlet or village) or CEMETERY graveyard by map-pixel distance, and ignores everything else', () => {
  const table = [
    at(10, 10, LOCATION_TYPES.Tavern),                                   // not safe
    at(12, 10, LOCATION_TYPES.DungeonLabyrinth),                         // not safe
    at(11, 10, LOCATION_TYPES.Graveyard, DUNGEON_TYPES.Crypt ?? 0),      // a graveyard that is NOT the small cemetery
    at(20, 10, LOCATION_TYPES.ReligionTemple),
    at(10, 16, LOCATION_TYPES.TownVillage),
    null,
    at(10, 14, LOCATION_TYPES.Graveyard, DUNGEON_TYPES.Cemetery),
  ];
  assert.deepEqual(longitudeLatitudeToMapPixel(table[6].longitude, table[6].latitude), { x: 10, y: 14 }, 'the fixture inverts the reader\'s own mapping');
  const pick = nearestSafeLocation(table, { x: 10, y: 10 });
  assert.deepEqual(pick, { kind: 'graveyard', locationIndex: 6, mapPixel: { x: 10, y: 14 } }, 'four pixels south: the cemetery, past the tavern, the dungeon and the crypt-graveyard next door');
  assert.equal(nearestSafeLocation(table, { x: 19, y: 10 }).kind, 'temple');
  assert.equal(nearestSafeLocation(table, { x: 10, y: 17 }).kind, 'city', 'a village is a town');
  assert.equal(nearestSafeLocation([at(0, 0, LOCATION_TYPES.TownHamlet)], { x: 5, y: 5 }).kind, 'city', 'so is a hamlet');
  assert.equal(nearestSafeLocation([at(0, 0, LOCATION_TYPES.Tavern), at(1, 1, LOCATION_TYPES.DungeonKeep)], { x: 0, y: 0 }), null, 'a region with none of the three: null, not a throw');
  assert.equal(nearestSafeLocation(null, { x: 0, y: 0 }), null);
});

test('D-ONLINE1: half health back, never none; one flavour line per kind, the pick pinned by the roll, an unknown kind falling to the city\'s', () => {
  assert.equal(RESPAWN_HEALTH_FRACTION, 0.5);
  assert.equal(respawnHealth(50), 25);
  assert.equal(respawnHealth(51), 25, 'floored');
  assert.equal(respawnHealth(1), 1, 'never zero - they have to be able to walk away');
  assert.equal(respawnHealth(0), 1);
  assert.equal(respawnHealth(undefined), 1);
  for (const kind of ['temple', 'city', 'graveyard', 'dungeon']) {
    const a = respawnFlavorText(kind, () => 0), b = respawnFlavorText(kind, () => 0.999);
    assert.ok(typeof a === 'string' && a.length > 20 && a !== b, `${kind}: two lines, the roll picks`);
  }
  assert.match(respawnFlavorText('temple', () => 0), /temple/i);
  assert.match(respawnFlavorText('dungeon', () => 0), /dungeon door/i);
  assert.equal(respawnFlavorText('nowhere', () => 0), respawnFlavorText('city', () => 0), 'an unknown kind reads as the city');
  assert.equal(respawnFlavorText('city', () => 1), respawnFlavorText('city', () => 0.999), 'a roll of exactly 1 stays in the pool');
});

test('D-ONLINE1 by source: the world host snapshots "was this death online" at the presenter, its reset respawns or ends the run by that snapshot, F11 does the same, the modal hosts ask through one door, and the respawn leaves any mode, lands on a start marker, restores half health and speaks', () => {
  const w = read('src/scenes/world.js');
  assert.match(w, /_deathWasOnline = _onlineWorldSession\(\);\s*\n\s*townTalk\.showOverlay\(new DeathScreen\(\{ eyeHeight: player\.eye\[1\] - player\.pos\[1\], capsuleHeight: player\.height, onReset: \(\) => \(_deathWasOnline \? respawnOnlinePlayer\(\) : endRunToTitleMenu\(renderer\)\) \}\)\);/, 'captured synchronously at the presenter, and read at the reset');
  assert.match(w, /const _onlineWorldSession = \(\) => onlineOn \|\| !!\(online && online\.status === 'open' && \(isWorldRoom\(online\.room\) \|\| isCellRoom\(online\.room\)\)\);/, 'the predicate counts the open world\'s CELL room - a death outdoors is an online death');
  assert.match(w, /if \(_deathWasOnline == null\) _deathWasOnline = _onlineWorldSession\(\);[^\n]*\n\s*if \(online\.room\) \{ worldPublish\(now, true\); online\.leave\(\);/, 'the frame\'s backstop for the modal hosts\' deaths is taken BEFORE the leave clears the room');
  assert.match(w, /if \(townTalk\.overlay instanceof DeathScreen && _deathWasOnline\) respawnOnlinePlayer\(\);\s*\n\s*else hudCtx\.quickLoad\(\);/, 'F11 on an online death respawns; otherwise it quickloads as ever');
  assert.match(w, /onlineRespawn: \(\) => \{ if \(!\(_deathWasOnline \?\? _onlineWorldSession\(\)\)\) return false; respawnOnlinePlayer\(\); return true; \},/, 'the host bag\'s door for the modal hosts');
  const ri = w.indexOf('function respawnOnlinePlayer() {');
  const fn = w.slice(ri, w.indexOf('\n  }\n', ri));
  assert.match(fn, /_deathWasOnline = null;/, 'armed fresh for the next death');
  assert.match(fn, /if \(mode !== 'exterior'\) modes\?\.forceExitToExterior\(\);/, 'a dungeon AND a building interior are left first - the exit clears the modal host\'s death screen with its slot');
  assert.match(fn, /if \(wasInDungeon && !isPrivateersHold\) kind = 'dungeon';/, 'dead underground: the door out is the pixel already under the player - unless it is the tutorial dungeon (D-ONLINE2)');
  // D-ONLINE2: the exception, and that it is read off the CONFIGURED start cell rather than a hardcoded pixel,
  // so a custom Startup.StartCellX/Y moves it. A death in the Hold takes the ordinary search below instead, and
  // that search answers only a temple, a city or a graveyard - never a dungeon - so it cannot land back inside.
  assert.match(fn, /const isPrivateersHold = wasInDungeon\s*\n\s*&& px\.x === getInt\('Startup', 'StartCellX'\) && px\.y === getInt\('Startup', 'StartCellY'\);/, 'the tutorial dungeon is the configured start cell, not a magic number');
  assert.match(read('src/systems/deathRespawn.js'), /'temple'|'city'|'graveyard'/, 'and the fall-through search never answers a dungeon');
  assert.match(fn, /const safe = nearestSafeLocation\(mapTable, px\);\s*\n\s*if \(safe\) \{ land = safe\.mapPixel; kind = safe\.kind; \}\s*\n\s*else kind = 'city';/, 'otherwise the nearest of the three, and a region with none stands where they fell');
  assert.match(fn, /await _teleportToPixel\(land\.x, land\.y, null, \{ reposition: REPOSITION\.RandomStartMarker \}\);/, 'the landing is a start marker, as TeleportAway names it - not the tile\'s dead centre');
  assert.match(fn, /_lastEncMinutes = Math\.floor\(playerTicker\.classicMinutes\);/, 'no encounter catch-up across the trip');
  assert.match(fn, /playerEntity\.health = respawnHealth\(playerEntity\.maxHealth\);\s*\n\s*surfacePlayer\(\);\s*\n\s*townTalk\.showOverlay\(new ActionTextBox\(\[respawnFlavorText\(kind\)\]\)\);/, 'half health, surfaced, and the line where the death screen stood');
  assert.match(read('src/scenes/worldModes.js'), /interiorOverlay = new DeathScreen\(\{ eyeHeight: player\.eye\[1\] - player\.pos\[1\], capsuleHeight: player\.height, onReset: \(\) => \{ if \(!host\.onlineRespawn\?\.\(\)\) endRunToTitleMenu\(renderer\); \} \}\);/, 'a building\'s death asks the host, and ends the run when it says no');
  assert.match(read('src/scenes/worldModes.js'), /return host\.onlineRespawn\?\.\(\) \?\? false;\s*\n\s*\},/, 'the dungeon context is handed the same door, falling through to it once PH1\'s in-place Privateer\'s Hold respawn declines');
  assert.match(read('src/scenes/dungeonContext.js'), /activeOverlay = new DeathScreen\(\{ eyeHeight: _ms\?\.eyeLevel, capsuleHeight: _ms\?\.capsule, onReset: \(\) => \{ if \(!opts\.onlineRespawn\?\.\(\)\) endRunToTitleMenu\(renderer\); \} \}\);/, 'and asks it');
  assert.match(read('src/scenes/exterior.js'), /new DeathScreen\(\{[^\n]*onReset: \(\) => endRunToTitleMenu\(renderer\), hint: 'ENTER end' \}\)/, 'the fixed city has no online and keeps the bare form');
});

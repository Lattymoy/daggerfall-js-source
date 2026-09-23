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
  assert.match(w, /if \(_deathWasOnline == null\) _deathWasOnline = _onlineWorldSession\(\);[^\n]*\n(?:(?![^\n]*online\.leave\(\))[^\n]*\n)*?\s*if \(online\.room\) \{ worldPublish\(now, true\); online\.leave\(\);/, 'the frame\'s backstop for the modal hosts\' deaths is taken BEFORE the leave clears the room (PCORPSE1\'s death pose between them, sent while the room is still joined)');
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
  // MAC-D3 (Seanobi: "stuck in an infinite deathloop. Instant death
  // after respawning"): THE HEAL IS FIRST, AND THIS PIN USED TO SAY
  // OTHERWISE. It asserted the heal sat immediately before the flavour
  // line - which is where it sat, at the END, after `await
  // _teleportToPixel` and after forceExitToExterior had torn the death
  // screen down. The frame loop only holds off raising death while a
  // DeathScreen is up, so every frame of that await saw a dead player
  // and no screen: death, reset, respawn, death. A lag spike widens
  // the window until it cannot be escaped. The pin agreed with the
  // wiring, so it went green over the loop.
  // DEATHLOOP1 re-aim: still the one fraction, now reached through the
  // one revival - `reviveForPlay` ends the drains at the same time,
  // which is the half MAC-D3's ordering fix did not cover.
  const healAt = fn.indexOf('reviveForPlay(playerEntity, { force: true });');
  assert.ok(healAt > 0, 'half health, off the one fraction, through the one revival');
  assert.ok(healAt < fn.indexOf('modes?.forceExitToExterior()'), 'MAC-D3: healed BEFORE the death screen is torn down (the CALL, not this file\u2019s prose about it)');
  assert.ok(healAt < fn.indexOf('await _teleportToPixel'), 'MAC-D3: ...and before anything is awaited - a dead player must not survive a single frame of the flight');
  assert.match(fn, /reviveForPlay\(playerEntity, \{ force: true \}\);\s*\n\s*surfacePlayer\(\);/, 'surfaced with it');
  assert.match(fn, /townTalk\.showOverlay\(new ActionTextBox\(\[respawnFlavorText\(kind\)\]\)\);/, 'and the line stands where the death screen did');
  // ...and one respawn at a time, or a death raised mid-flight starts
  // another teleport racing the first
  assert.match(fn, /if \(_respawning\) return;/, 'MAC-D3: re-entry is refused');
  assert.match(fn, /_respawning = true;/);
  assert.match(fn, /\.finally\(\(\) => \{ _respawning = false; \}\);/, '...and the latch is always released, even when the teleport throws');
  assert.match(read('src/scenes/worldModes.js'), /interiorOverlay = new DeathScreen\(\{ eyeHeight: player\.eye\[1\] - player\.pos\[1\], capsuleHeight: player\.height, onReset: \(\) => \{ if \(!host\.onlineRespawn\?\.\(\)\) endRunToTitleMenu\(renderer\); \} \}\);/, 'a building\'s death asks the host, and ends the run when it says no');
  assert.match(read('src/scenes/worldModes.js'), /return host\.onlineRespawn\?\.\(\) \?\? false;\s*\n\s*\},/, 'the dungeon context is handed the same door, falling through to it once PH1\'s in-place Privateer\'s Hold respawn declines');
  assert.match(read('src/scenes/dungeonContext.js'), /activeOverlay = new DeathScreen\(\{ eyeHeight: _ms\?\.eyeLevel, capsuleHeight: _ms\?\.capsule, onReset: \(\) => \{ if \(!opts\.onlineRespawn\?\.\(\)\) endRunToTitleMenu\(renderer\); \} \}\);/, 'and asks it');
  assert.match(read('src/scenes/exterior.js'), /new DeathScreen\(\{[^\n]*onReset: \(\) => endRunToTitleMenu\(renderer\), hint: 'ENTER end' \}\)/, 'the fixed city has no online and keeps the bare form');
});

// ── MAC-D3 (Seanobi on Discord, 2026-09-21: "stuck in an infinite
// deathloop. Instant death after respawning") ────────────────────────
test('MAC-D3: a respawn answers a LIVING number for any maxHealth, and the loop that needs a dead player mid-flight cannot form', async () => {
  const { respawnHealth, RESPAWN_HEALTH_FRACTION } = await import('../src/systems/deathRespawn.js');
  assert.equal(RESPAWN_HEALTH_FRACTION, 0.5);
  assert.equal(respawnHealth(50), 25, 'half, as it always was');
  // A NaN health is neither alive (health > 0 false) nor dead
  // (health <= 0 false), so a player carrying one stands up with a bar
  // no comparison can satisfy. Math.max(1, NaN) is NaN, which is how
  // it used to get out of here.
  for (const bad of [0, -5, NaN, undefined, null, 'x']) {
    const h = respawnHealth(bad);
    assert.ok(Number.isFinite(h) && h >= 1, `maxHealth ${String(bad)} -> ${h}: alive, and a number`);
  }

  // THE LOOP ITSELF. The heal used to be the LAST line of the async
  // arm, after `await _teleportToPixel` and after forceExitToExterior
  // had torn the death screen down. The frame loop only holds off
  // raising death while a DeathScreen is up, so every frame of that
  // await saw a dead player and no screen: death, reset, respawn,
  // death - and a teleport loads a map pixel, so under the lag spike
  // Seanobi reported the window is many frames wide.
  const { readFileSync } = await import('node:fs');
  const w = readFileSync(new URL('../src/scenes/world.js', import.meta.url), 'utf8');
  const ri = w.indexOf('function respawnOnlinePlayer()');
  // THE CODE, NOT THE PROSE ABOUT IT. The note above this function
  // names `await _teleportToPixel` and forceExitToExterior to say what
  // went wrong, so an index over the raw slice finds the comment and
  // reads the order backwards. Comment lines come out first.
  const code = w.slice(ri, w.indexOf('\n  }\n', ri))
    .split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
  // DEATHLOOP1 re-aim: the revival is `reviveForPlay` now, because a
  // heal alone was only half of it - the drains that emptied the bar
  // had to end with it. The ORDER this pin exists for is untouched and
  // is what is still read: alive before anything is torn down or
  // awaited.
  const heal = code.indexOf('reviveForPlay(playerEntity, { force: true });');
  assert.ok(heal > 0, 'the revival is there');
  assert.ok(heal < code.indexOf('modes?.forceExitToExterior()'), 'alive before the death screen goes');
  assert.ok(heal < code.indexOf('await '), 'alive before ANYTHING is awaited');
  assert.ok(heal < code.indexOf('Promise.resolve()'), '...and synchronously, in the same turn the reset ran');
  // one respawn in flight at a time, or a death raised mid-teleport
  // starts a second teleport racing the first
  assert.match(code, /if \(_respawning\) return;/);
  assert.match(code, /\.finally\(\(\) => \{ _respawning = false; \}\);/, 'released even when the teleport throws');

  // the dungeon arm of the same law already had this order, which is
  // what says it is the law and not a preference
  const wm = readFileSync(new URL('../src/scenes/worldModes.js', import.meta.url), 'utf8');
  const spawnAt = wm.indexOf('player.spawn(spawn[0], spawn[1], spawn[2]);');
  assert.ok(spawnAt > 0);
  const healAt = wm.indexOf('reviveForPlay(playerEntity, { force: true });', spawnAt);
  const clearAt = wm.indexOf('ctx.clearDeathOverlay?.();', spawnAt);
  assert.ok(healAt > spawnAt && healAt < clearAt, 'worldModes: spawn, heal, THEN clear the overlay - all in one turn');
});

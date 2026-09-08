// FIX-C (2026-09-08, Mac: "Players on first start either spawn in the
// ground or the sky"). One race, two symptoms, only on a new game: the
// roads network lands asynchronously and the sweep that tore down every
// pixel painted without it re-queued NOTHING - destroyPixel deletes the
// terrain, the collider bucket and the `built` entry, and the streamer
// never re-asks for a key it still holds in `loaded`. Landing before
// the first frame, the sweep emptied `built` of the start key and the
// boot's spawn gate never fired (the camera forty units up over a hole,
// the motor frozen: the sky); landing after the stand, it deleted the
// ground under a standing player with nothing to bring it back (the
// ground). Every other arrival re-inits the streamer through
// _teleportToPixel; the boot walk alone did not. These pin the shape
// the fix takes from the season re-skin - the one teardown in the host
// that was already done right - and two more defects in the same lane.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const world = read('src/scenes/world.js');

test('FIX-C: the roads sweep RE-QUEUES what it tears down, nearest-first, and holds the motor on the player\u2019s own pixel', () => {
  const body = world.slice(world.indexOf('function sweepRoadless() {'), world.indexOf('function sweepRoadless() {') + 1400);
  assert.match(body, /for \(const \[, p\] of \[\.\.\.built\]\) if \(!p\.withRoads\) again\.push\(\{ px: p\.px, py: p\.py \}\);/, 'the roadless pixels are collected first');
  assert.match(body, /if \(walkMode && playerSpawned && again\.some\(\(k\) => `\$\{k\.px\},\$\{k\.py\}` === under\)\) _seasonHoldKey = under;/, 'the hold is armed BEFORE the ground goes, on the pixel under the player, only if it is going');
  const destroyAt = body.indexOf('for (const k of again) destroyPixel(k.px, k.py, { collectLoose: false });');
  const pushAt = body.indexOf('queue.push(...again.sort(');
  const holdAt = body.indexOf('_seasonHoldKey = under;');
  assert.ok(holdAt > 0 && destroyAt > holdAt && pushAt > destroyAt, 'hold, then destroy, then re-queue');
  assert.match(body, /const ca = Math\.max\(Math\.abs\(p\.px - state\.current\.x\), Math\.abs\(p\.py - state\.current\.y\)\);/, 'nearest-first: the load list\u2019s own order, the player\u2019s pixel back first');
  // and the sweep runs on the FRAME, between builds - a pixel in flight publishes before its key can be torn down
  assert.match(world, /function rebuildRoadless\(\) \{ roadsSweepDue = true; \}/, 'the network\u2019s arrival marks the sweep');
  assert.match(world, /tickSeason\(\);\s*\n\s*if \(roadsSweepDue && !building\) \{ roadsSweepDue = false; sweepRoadless\(\); \}/, 'the frame runs it beside the season tick, never over a build in flight');
  // the release already exists: the hold lifts the moment the pixel stands again, or when nothing is coming
  assert.match(world, /if \(_seasonHoldKey !== null && \(built\.has\(_seasonHoldKey\) \|\| \(!building && !queue\.length\)\)\) \{\s*\n\s*player\.spawn\(player\.pos\[0\], player\.pos\[1\], player\.pos\[2\]\);\s*\n\s*_seasonHoldKey = null;/, 'the dead-man\u2019s release, shared with the season');
});

test('FIX-C: the first exterior stand is DFU\u2019s Origin reposition - the terrain\u2019s corner, not the pixel\u2019s centre', () => {
  // StartNewCharacter (StartGameBehaviour.cs:404-409): TeleportToCoordinates
  // + SetAutoReposition(Origin, Vector3.zero); Update (StreamingWorld
  // .cs:290-292) -> RepositionPlayer(MapPixelX, MapPixelY, Vector3.zero):
  // local (0, terrain height + half height + 0.15, 0).
  assert.match(world, /if \(!playerSpawned && built\.has\(startKey\)\) \{[\s\S]{0,1200}?const stand = floorLanding\(collider, \[0, heightAt\(0, 0\) \+ 2, 0\]\);\s*\n\s*player\.spawn\(stand\[0\], stand\[1\], stand\[2\]\);\s*\n\s*playerSpawned = true;/);
  assert.doesNotMatch(world, /floorLanding\(collider, \[cam\.pos\[0\], heightAt\(cam\.pos\[0\], cam\.pos\[2\]\) \+ 2, cam\.pos\[2\]\]\)/, 'the centre stand is gone - a location is centred in its pixel, so the centre was the middle of the town');
});

test('FIX-C: the dungeon start IS the spawn - the exterior gate cannot re-fire on the first step outside', () => {
  assert.match(world, /const entered = await modes\.startInDungeon\(\);\s*\n\s*if \(!entered\) console\.warn\([^\n]*\);\s*\n(?:\s*\/\/[^\n]*\n)*\s*if \(entered\) playerSpawned = true;/);
  // worldModes never writes the flag - the host does, at the one place it learns the dungeon stood the player
  assert.doesNotMatch(read('src/scenes/worldModes.js'), /playerSpawned\s*=/);
});

test('FIX-C: the probe can see it - __standing reports spawned, the ground under the feet and the pixel\u2019s build state, and the classic-start probe reads it after the exit', () => {
  assert.match(world, /window\.__standing = \(\) => JSON\.stringify\(\{\s*\n\s*spawned: playerSpawned, y: \+player\.pos\[1\]\.toFixed\(2\),\s*\n\s*ground: heightAt\(player\.pos\[0\], player\.pos\[2\]\), built: built\.has\(`\$\{state\.current\.x\},\$\{state\.current\.y\}`\),/);
  const probe = read('tools/classicStartProbe.mjs');
  assert.match(probe, /const st = JSON\.parse\(await page\.evaluate\(\(\) => window\.__standing\(\)\)\);/);
  assert.match(probe, /check\(st\.spawned === true,/);
  assert.match(probe, /check\(Number\.isFinite\(st\.ground\) && st\.y >= st\.ground - 1 && st\.y <= st\.ground \+ 6,/, 'on the terrain: not the sky, not the ground');
});

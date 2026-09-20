// AIWATER - NO WATER IN A SPAWNED DUNGEON (2026-09-20, Mac's patch:
// "Get these in for me").
//
// A spawned dungeon's water has been reported wrong every time it has
// been seen - shown well below the floor, in patches, reading like a
// no-clip glitch. Rather than keep chasing the placement, a spawn is
// given no water at all. A REAL dungeon is untouched, and that half
// matters as much as the first: the fix is a skip for one kind of
// location, not a deletion of the feature.
//
// PINNED BY SOURCE. `buildDungeonContext` is an async builder over a
// live collider, a renderer and the player's own ARENA2 - there is no
// standing it up on a table - so what is held here is the SHAPE of the
// two arms and, above all, that neither of them writes to the template.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('AIWATER: a spawned dungeon builds no water quads, and a real one still does', () => {
  const src = read('src/scenes/dungeonContext.js');

  // THE QUAD BUILD. Both halves in one condition: the sentinel that has
  // always meant "this block has no water", AND the new skip for a
  // spawn. Dropping either one is a different bug - the first floods
  // every dry block, the second takes the water out of the real game.
  assert.match(src, /if \(b\.layout\.waterLevel !== 10000 && !dfLocation\?\.spawned\) \{/,
    'the water quad is built for a real dungeon with water, and for nothing else');

  // THE TEMPLATE IS NEVER WRITTEN, which is the reason the skip is at
  // the READ and not a normalisation at the spawn. `dungeon.blocks` is
  // the template's own shared array (world/spawnedDungeons.js's
  // synthesizeDungeonLocation hands the real location's blocks
  // straight over), so assigning the sentinel into a block here would
  // drain the REAL dungeon this was cloned from, and every other spawn
  // sharing that template, for the rest of the session.
  const build = src.slice(src.indexOf('for (const l of collectDungeonLights('), src.indexOf('for (const door of b.layout.exitDoors)'));
  assert.doesNotMatch(build, /\bb\.layout\.waterLevel\s*=[^=]/, 'the block’s own water level is read, never assigned');
  assert.doesNotMatch(src, /layout\.waterLevel\s*=\s*10000/, 'and nothing anywhere normalises a spawn by writing the sentinel in');

  // ...AND NONE OF WHAT WATER IMPLIES. `blockWaterLevelAt` feeds the
  // underwater fog and the "am I swimming" check, so a spawn that kept
  // its level would keep the green murk and a half-submerged player
  // with nothing on screen to explain either.
  const at = src.slice(src.indexOf('function blockWaterLevelAt(x, z) {'));
  const body = at.slice(0, at.indexOf('\n  }'));
  assert.match(body, /if \(dfLocation\?\.spawned\) return 10000;/, 'a spawn answers the no-water sentinel');
  assert.ok(body.indexOf('dfLocation?.spawned') < body.indexOf('for (const b of dungeon.blocks)'),
    'and answers it BEFORE walking the blocks, so no block’s level can be returned for a spawn');
  // the sentinel is the same number the quad build tests against - one
  // meaning of "no water", not two that agree today
  assert.equal((src.match(/10000/g) || []).length >= 2, true);
});

test('AIWATER: the flag the skip reads is the one the spawner sets, and no real location has it', () => {
  // `spawned` is minted in exactly one place, and it is never true for
  // a location that came out of MAPS.BSA - which is what makes it safe
  // to hang a behaviour change on.
  const sp = read('src/world/spawnedDungeons.js');
  assert.match(sp, /spawned: true,/, 'the synthesized location carries the flag');
  assert.equal((sp.match(/spawned: true/g) || []).length, 1, 'from one place');
  for (const f of ['src/world/locationIndex.js', 'src/formats/mapsFile.js']) {
    let s; try { s = read(f); } catch { continue; }
    assert.doesNotMatch(s, /spawned: true/, `${f}: a real location never claims to be a spawn`);
  }
});

// SPAWNED-DUNGEONS-TTL (2026-09-20, the rest of Mac's patch). Two
// notices a host MAY wire: one when a context is built for a dungeon
// this client's own hash synthesized, one the first time that dungeon
// is fully cleared. Both are optional - nothing in this tree wires
// them yet - so what is pinned here is that they cost nothing until
// something does, and that the clear notice is told ONCE.
test('AIWATER/TTL: the spawn notice is for spawns only, and the clear notice is told once', () => {
  const src = read('src/scenes/dungeonContext.js');

  // THE SPAWN NOTICE fires only for a synthesized location, and is
  // optional-chained - a host that passes nothing pays nothing.
  assert.match(src, /if \(dfLocation\?\.spawned\) opts\.onDungeonSpawned\?\.\(\);/,
    'told for a spawn, and only for a spawn');

  // THE CLEAR NOTICE rides `automapTick`, the call every host already
  // makes each gameplay frame - a new per-frame call site would be one
  // that scenes/dungeon.js and scenes/worldModes.js both have to
  // remember, and the one that forgot would never expire its dungeon.
  const tick = src.slice(src.indexOf('    automapTick(dt, eye, fwd) {'));
  const body = tick.slice(0, tick.indexOf('\n    },'));
  assert.match(body, /if \(!_clearedSent && opts\.onDungeonCleared\) \{/, 'gated on a host having asked for it');
  assert.match(body, /_clearedSent = true;/, 'and latched, so the host is told ONCE and not once a frame after');
  // ...AHEAD of the scan's own early return, or it would only run on
  // the frames the automap happened not to skip.
  assert.ok(body.indexOf('_clearedCheckT') < body.indexOf('if (automapScanT < SCAN_INTERVAL_S) return;'),
    'the clear throttle runs before the scan’s early return, not after it');

  // CLEARED MEANS BOTH: every foe dead AND every pile empty. Either
  // half alone would expire a dungeon the player is still looting, or
  // still fighting through.
  assert.match(body, /foes\.every\(\(f\) => f\.dead\) && lootPiles\.every\(\(p\) => p\.items\.length === 0\)/,
    'every foe dead and every pile empty');
  assert.match(src, /const CLEARED_CHECK_INTERVAL_S = 5;/, 'on a slow throttle, not every frame');
});

// WATER-BACK - THE DUNGEON IS WET AGAIN (2026-09-22, kurkku: "invisible
// water", with a picture of a dry dungeon).
//
// THE BAND-AID OUTLIVED ITS BUG BY ONE DAY, and this file is the AIWATER
// pins re-aimed rather than deleted, because the laws under them are
// still live.
//
// AIWATER (2026-09-20) took the water out of every SPAWNED dungeon
// because "a spawn's water has been reported wrong every time - shown
// well below the floor, in patches, reading like a no-clip glitch" -
// and said so honestly: "rather than keep chasing the placement".
// WATER-D1 (2026-09-21, the next morning) chased it and CAUGHT it, and
// it was never the placement: both dungeon hosts called
// `renderer.drawWater` AFTER drawFoes returned, which is after the
// first screen quad, which is where the enhanced-lighting lane
// resolves its frame target - so the quad landed on the default
// framebuffer, whose depth buffer holds no world, and passed the depth
// test everywhere. WATER-D1's own words: "The level itself was never
// the defect: the quads sit exactly where DFU's AddWater puts its
// plane."
//
// A spawn was never special. It was where people met the bug because
// it was where people were.
//
// AND THE BAND-AID ONLY COVERED TWO OF THREE DOORS, which is the part
// worth keeping in front of the next reader. "Is there water here" is
// asked by the quad build, by `blockWaterLevelAt` (the fog and the
// swim check) and by `waterSurfaceYAt` (the swim TOGGLE and P12's
// drowning tick) - and the exclusion was written into the first two.
// So a spawned dungeon had water that could still pull a player under
// and drown them, with no plane drawn and no fog to say why. Invisible
// water in the dangerous sense, not the ugly one.
//
// PINNED BY SOURCE. `buildDungeonContext` is an async builder over a
// live collider, a renderer and the player's own ARENA2 - there is no
// standing it up on a table - so what is held is the SHAPE of the
// arms, that the three doors agree, that the template is never
// written, and the DRAW ORDER that makes wet dungeons safe again.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('WATER-BACK: the quad build asks only "does this block have water", and never asks whether the dungeon was spawned', () => {
  const src = read('src/scenes/dungeonContext.js');
  assert.match(src, /if \(b\.layout\.waterLevel !== 10000\) \{/,
    'the sentinel that has always meant "this block has no water", and nothing else');
  assert.doesNotMatch(src, /waterLevel !== 10000 && !dfLocation\?\.spawned/,
    'AIWATER\'s skip is retired - WATER-D1 closed the cause it was standing in for');

  // THE TEMPLATE IS NEVER WRITTEN. This law is untouched by any of the
  // above and outlives it: `dungeon.blocks` is the template's own
  // shared array (world/spawnedDungeons.js synthesizeDungeonLocation
  // hands the real location's blocks straight over), so assigning the
  // sentinel into a block here would drain the REAL dungeon this was
  // cloned from, and every other spawn sharing that template, for the
  // rest of the session.
  const build = src.slice(src.indexOf('for (const l of collectDungeonLights('), src.indexOf('for (const door of b.layout.exitDoors)'));
  assert.doesNotMatch(build, /\bb\.layout\.waterLevel\s*=[^=]/, 'the block\u2019s own water level is read, never assigned');
  assert.doesNotMatch(src, /layout\.waterLevel\s*=\s*10000/, 'and nothing anywhere normalises a spawn by writing the sentinel in');
});

test('WATER-BACK: all THREE water doors answer the same question - none of them asks about a spawn', () => {
  // The band-aid's real defect: it was written into two of three, so a
  // spawn could drown you in water it would not draw.
  const src = read('src/scenes/dungeonContext.js');
  const bodyOf = (sig) => { const at = src.slice(src.indexOf(sig)); return at.slice(0, at.indexOf('\n  }')); };

  const level = bodyOf('function blockWaterLevelAt(x, z) {');
  assert.doesNotMatch(level, /dfLocation\?\.spawned/, 'the fog and swim check read the block, whatever kind of dungeon it is');
  assert.match(level, /return b\.layout\.waterLevel;/, '...and answer the block\u2019s own level');

  const surface = bodyOf('function waterSurfaceYAt(x, z) {');
  assert.doesNotMatch(surface, /dfLocation\?\.spawned/, 'the swim toggle and the drowning tick never had the skip - now nothing does');
  assert.match(surface, /b\.layout\.waterLevel === 10000 \? null :/, 'and they share the one sentinel');

  // No water door anywhere in the file branches on the spawn flag. The
  // flag itself stays - it is a real thing about a location and other
  // code reads it - so the sweep is scoped to the water arms.
  for (const m of src.matchAll(/dfLocation\?\.spawned/g)) {
    const around = src.slice(Math.max(0, m.index - 400), m.index + 200);
    assert.ok(!/water/i.test(around), 'no water arm reads the spawn flag any more');
  }
});

test('WATER-BACK: the DRAW ORDER is what makes a wet dungeon safe, and it is held here', () => {
  // LostMyLeg on the report: "when water textures are activated again
  // they clip through walls and players will see water all the time."
  // That is a memory of the pre-WATER-D1 defect and it is the right
  // thing to be careful about - so the order that fixed it is pinned
  // where the re-enable lives, not only in waterd1.test.js.
  const src = read('src/scenes/dungeonContext.js');
  const draw = src.indexOf('renderer.drawWater(waterQuads, DUNGEON_WATER_COLOR');
  assert.ok(draw > 0, 'the draw is in this file - the one frame function both hosts call');

  // BEFORE the first screen quad: the weapon overlay and the HUD are
  // screen quads, and a screen quad is where the enhanced-lighting
  // lane resolves its target and unbinds the frame buffer.
  const weapon = src.indexOf('weaponRig.draw({ paralyzed: _pParalyzed })', draw);
  assert.ok(weapon > draw, 'the water is drawn BEFORE the weapon overlay');

  // AFTER the world billboards, so it blends over the foes as the
  // hosts had it.
  const billboards = src.lastIndexOf('renderer.drawBillboards(', draw);
  assert.ok(billboards > 0 && billboards < draw, 'and AFTER the last world billboard');

  // And neither host calls it themselves any more - that call site,
  // outside the world pass, IS the bug.
  for (const f of ['src/scenes/dungeon.js', 'src/scenes/worldModes.js']) {
    assert.doesNotMatch(read(f), /renderer\.drawWater\(/, `${f} does not draw water outside the world pass`);
  }
});

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

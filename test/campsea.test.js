// CAMP-SEA (2026-09-26, SquidKamer on the Discord: "puddle no more is too aggressive ... I jumped in last night and it
// summoned an army of everything"). Iliac Puddle No More's deep has its own population, and the land's rolls stand down
// over it (SuppressVanillaWaterEncounters sets PreventEnemySpawns in or above deep water). The lone roll honoured it; the
// port's own chunk-load CAMP roll did not: it runs on the pixel crossing, BEFORE the frame writes the flag, and the lone
// roll clears the flag at its tail - so at sea the camp roll read `false` every time and stood two to five land
// monsters at a time, in three groups, on the carved seabed. It asks the deep itself now, and a swimmer too.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { rollCampEncountersOnChunkLoad } from '../src/systems/campEncounters.js';

const world = readFileSync(new URL('../src/scenes/world.js', import.meta.url), 'utf8');

test('CAMP-SEA: a chunk-load camp roll with the deep\'s suppression up stands nothing - and one without it stands camps', () => {
  const ctx = { inside: false, inLocationRect: false, climateIndex: 231, playerLevel: 5, gameMinutes: 600 };
  let seed = 7;
  const rolls = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);   // seeded: the same crossings both ways
  let open = 0, shut = 0;
  for (let i = 0; i < 200; i++) if (rollCampEncountersOnChunkLoad({ ...ctx, preventEnemySpawns: false }, rolls)) open++;
  for (let i = 0; i < 200; i++) if (rollCampEncountersOnChunkLoad({ ...ctx, preventEnemySpawns: true }, rolls)) shut++;
  assert.ok(open > 50, `the land's camps roll where nothing stands them down (${open}/200 crossings)`);
  assert.equal(shut, 0, 'suppressed: nothing, ever');
});

test('CAMP-SEA by source: the crossing\'s camp roll asks the deep itself (the frame\'s flag is not written yet), with the lone roll\'s swim gate', () => {
  assert.match(world, /const _deepSuppressesSpawns = \(\) => !!dwPlayer\?\.inOrAboveDeepWater\(walkMode && playerSpawned \? player\.pos : cam\.pos, cam\.pos\[1\], 0\.25\);/, 'SuppressVanillaWaterEncounters\' test, one home');
  assert.match(world, /if \(_deepSuppressesSpawns\(\)\) playerEntity\.preventEnemySpawns = true;/, 'the frame\'s flag reads the same test');
  assert.match(world, /preventEnemySpawns: playerEntity\.preventEnemySpawns \|\| _deepSuppressesSpawns\(\) \|\| !!\(walkMode && playerSpawned && player\.isPlayerSwimming\),/, 'the camp roll asks it, and the swim');
  // WHY the roll must ask for itself: it runs on the crossing, before the frame's write, and the lone roll clears the flag
  const crossing = world.indexOf('const chunkCampHits = rollCampEncountersOnChunkLoad(');
  const write = world.indexOf('if (_deepSuppressesSpawns()) playerEntity.preventEnemySpawns = true;');
  assert.ok(crossing > 0 && write > crossing, 'the crossing\'s roll comes before the frame\'s flag write');
  assert.match(world, /if \(playerEntity\.preventEnemySpawns\) playerEntity\.preventEnemySpawns = false;/, 'and the lone roll clears the flag at its tail');
});

// FIELD BUGS 2026-10-18f WOD-SEA-TEST (bible/01-Overview/bugs/Field-Bugs-2026-10-18f.md, found tracing æther's "Weird
// objects in the ocean, north east of Tlactrn Manor"; Mac: "Yes fix WOD"). World of Daggerfall refuses a site on the sea
// (LocationLoader.cs:117-121: regions 31, 3, 29, 28, 30 with a WOODS height of 2 or less) - but it asks MapPixelData's
// mapRegionIndex, which GetMapPixelData fills from the pixel's LOCATION alone, and a pixel with one has already left the
// loop. So the arm never fired, in DFU or here, and every site its lists name on the sea stood there. The arm now asks the
// region the pixel itself answers (the sea's is 31). Driven on the real loader over the mod's own vendored lists.
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WodWorld } from '../../../src/world/worldOfDaggerfall/worldOfDaggerfall.js';
import { MapsFile } from '../../../src/formats/mapsFile.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const V = join(ROOT, 'vendor/world-of-daggerfall');
const diskSources = () => ({
  regions: () => readdirSync(join(V, 'Locations')).map((f) => Number(f.replace('.bin', ''))).sort((a, b) => a - b),
  pack: async (r) => { try { return new Uint8Array(readFileSync(join(V, 'Locations', `${r}.bin`))); } catch { return null; } },
  prefabs: async () => new Map(readdirSync(join(V, 'LocationPrefab')).map((f) => [f.replace('.txt', ''), readFileSync(join(V, 'LocationPrefab', f), 'utf8')])),
});
async function opened(regions) {
  const w = new WodWorld(diskSources(), { warn: () => {} });
  await w.open();
  for (const r of regions) w.noteRegion(r);
  await w.settle();
  return w;
}

test('WOD-SEA-TEST THE SEA ARM ASKS THE PIXEL: a pixel of the sea (its own region 31) at a WOODS height of 2 or less stands none of its list\'s sites, nor does a low pixel of the four coastal regions; over sea level, or a low pixel of another region, keeps its site; and a LOCATION\'s region (the mod\'s mapRegionIndex) is never the arm\'s (mutants: the location\'s region again, the arm unread)', async () => {
  const w = await opened([0]);
  const tile = { mapPixelX: 625, mapPixelY: 418, hasLocation: false, worldHeight: 50 };   // WOD2's bandit camp
  assert.equal(w.picksFor(tile).length, 1, 'on land it stands');
  for (const h of [0, 1, 2]) assert.deepEqual(w.picksFor({ ...tile, regionIndex: 31, worldHeight: h }), [], `the sea at height ${h} refuses it`);
  assert.equal(w.picksFor({ ...tile, regionIndex: 31, worldHeight: 3 }).length, 1, 'over the sea\'s line it stands');
  for (const r of [3, 29, 28, 30]) assert.deepEqual(w.picksFor({ ...tile, regionIndex: r, worldHeight: 2 }), [], `region ${r}'s low ground is sea`);
  assert.equal(w.picksFor({ ...tile, regionIndex: 17, worldHeight: 0 }).length, 1, 'a low pixel of another region keeps its site');
  assert.equal(w.picksFor({ ...tile, mapRegionIndex: 31, worldHeight: 0 }).length, 1, 'a location\'s region is not the arm\'s');
});

test('WOD-SEA-TEST EVERY SITE THE MOD SHIPS: the vendored lists hold only type-2 instances (rocks, shrines, camps, ruins, mountains and forts), the type the sea arm skips - so no site of the mod stands on a pixel of the sea', async () => {
  const w = await opened(diskSources().regions());
  const s = w.session;
  assert.ok(s.count > 200000, `the whole lists (${s.count})`);
  const types = new Set();
  let rocks = 0;
  for (let i = 0; i < s.count; i++) { types.add(s.type[i]); if (/Rocks/.test(s.prefab[i])) rocks++; }
  assert.deepEqual([...types], [2], 'one type, the one the sea skips');
  assert.ok(rocks > 200000, `the rock fields among them (${rocks})`);
});

test('WOD-SEA-TEST THE REGION THE SEA ANSWERS: a pixel of the sea (politic 64) is region 31, as PlayerGPS reads it, a land pixel its own; the streaming build hands the pick the pixel\'s region, and carries no location\'s in its place', () => {
  const at = (politic) => MapsFile.prototype.getRegionIndexAt.call({ getPoliticIndex: () => politic }, 0, 0);
  assert.equal(at(64), 31, 'the sea');
  assert.equal(at(128 + 17), 17, 'Daggerfall');
  assert.equal(at(128 + 29), 29);
  const pb = readFileSync(join(ROOT, 'src/scenes/pixelBuild.js'), 'utf8');
  assert.match(pb, /^ {10}regionIndex: maps\.getRegionIndexAt\(px, py\),/m);
  assert.doesNotMatch(pb, /mapRegionIndex:/, 'the location\'s region is no field of the tile');
});

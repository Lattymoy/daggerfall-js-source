// WG2 PHASE 1: THE FOUNDATION - the exact kit every
// gameplay field is built from, the designers' tables, the world manifest bound to the online ground law, and the stages'
// invalidation (a change goes stale downstream over its own reach, never the whole world). Pins mutation-checked
// (tools/mutants/wg2.json).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { INEXACT_CALLS, noise2, fbmExact, ridgedExact, rand01, seedOf } from '../../../src/world/gen2/exact.js';
import { tableProblems, PROFILES, BIOME_TABLE, provinceProfile } from '../../../src/world/gen2/tables.js';
import { worldManifest, manifestProblems, groundPrint, manifestPrint, manifestRefuses, touchesBay, GENERATORS } from '../../../src/world/gen2/manifest.js';
import { STAGE_GRAPH, STAGE_ORDER, staleAfter } from '../../../src/world/gen2/stageGraph.js';
import { BAKE_GENERATOR } from '../../../src/world/gen2/regionBake.js';
import { GROUND_LAW } from '../../../src/net/wire.js';
import { THEATRE_COUNT } from '../../../src/world/worldWide/worldGrid.js';
import { CLIMATES } from '../../../src/formats/mapsTables.js';

const files = (dir) => readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? files(join(dir, f)) : f.endsWith('.js') ? [join(dir, f)] : []));
const code = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '').replace(/'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`/g, "''");

test('WG2 EXACT: no module of world/gen2 calls an approximated function, a clock or the `**` operator - two machines on one revision make the same ground to the bit (mutants: a Math.pow let in, the list emptied)', () => {
  assert.ok(INEXACT_CALLS.includes('Math.pow') && INEXACT_CALLS.includes('Math.random') && INEXACT_CALLS.includes('Math.hypot') && INEXACT_CALLS.includes('Date.now'));
  const bad = [];
  for (const f of files('src/world/gen2')) {
    const c = code(readFileSync(f, 'utf8'));
    for (const call of INEXACT_CALLS) if (c.includes(call)) bad.push(`${f}: ${call}`);
    if (/[^*/]\*\*[^*/=]/.test(c)) bad.push(`${f}: **`);
  }
  assert.deepEqual(bad, []);
});

const NOISE_PIN = [0.20349679362163808, 0.04955475656875641, 0.6204493929296601];

test('WG2 EXACT: the noise is the law it was - pinned samples, seeded and without a period (mutants: the fade, the gradient table, the octave seed)', () => {
  assert.equal(noise2(7, 0.37, 0.61), NOISE_PIN[0]);
  assert.equal(fbmExact(7, 3.3, 4.4, 4), NOISE_PIN[1]);
  assert.equal(ridgedExact(7, 1.5, 2.5, 3), NOISE_PIN[2]);
  assert.notEqual(noise2(7, 0.37, 0.61), noise2(8, 0.37, 0.61), 'the seed moves it');
  assert.notEqual(noise2(7, 0.37, 0.61), noise2(7, 256.37, 0.61), 'no period of 256 (world/perlin.js has one)');
  assert.equal(noise2(7, 3, 9), 0, 'zero on the lattice');
  assert.ok(rand01(1, 2, 3) >= 0 && rand01(1, 2, 3) < 1 && seedOf(5, 'a') !== seedOf(5, 'b'));
});

test('WG2 TABLES: the designers\' tables hold together, every theatre of Tamriel has a profile, and every biome wears a Daggerfall climate (mutants: a biome\'s climate, a species\' soil, a profile dropped)', () => {
  assert.deepEqual(tableProblems(), []);
  assert.equal(PROFILES.length, THEATRE_COUNT, 'the Bay and the nine provinces');
  for (let t = 0; t < THEATRE_COUNT; t++) assert.equal(provinceProfile(t).theatre, t);
  const climates = new Set(Object.values(CLIMATES));
  for (const b of BIOME_TABLE) assert.ok(climates.has(b.climate), b.key);
  assert.equal(provinceProfile(2).key, 'Hammerfell'); assert.equal(provinceProfile(8).key, 'BlackMarsh');
  assert.ok(provinceProfile(2).precip < 500 && provinceProfile(8).precip > 1500, 'the lore\'s desert and marsh');
});

test('WG2 MANIFEST: the game\'s manifest is whole, names this build\'s generator, publishes nothing, and its published ground is bound to the online GROUND_LAW - a region published without the law raised fails here (mutants: the law\'s print, the published set, the Bay\'s reach)', () => {
  const m = worldManifest();
  assert.deepEqual(manifestProblems(m), []);
  assert.equal(m.generatorVersion, BAKE_GENERATOR);
  assert.ok(GENERATORS.includes(BAKE_GENERATOR));
  assert.deepEqual(m.published, [], 'Phase 6 is the owner\'s: no region is published by this arc');
  assert.equal(m.groundLaw, GROUND_LAW, 'the manifest names the ground law it was written under');
  assert.equal(m.groundPrints[String(GROUND_LAW)], groundPrint(m), 'the published ground at this law is the one recorded: publish a region and raise GROUND_LAW, or older builds are let in');
  assert.equal(groundPrint(m), '');
  assert.match(manifestPrint(m), /^[0-9a-f]{8}$/);
});

test('WG2 MANIFEST: a published region is refused on the Bay\'s ground without the owner\'s dated word, over another, or by a generator this build cannot read; two clients on different published ground refuse each other (mutants: the Bay test, the overlap, the ground in the refusal)', () => {
  const m = worldManifest();
  const region = { id: 'r', rect: { x: 1100, y: 600, w: 32, h: 32 }, bake: 'r.wg2', print: 'abcdef01', generator: BAKE_GENERATOR, revision: 1 };
  assert.deepEqual(manifestProblems({ ...m, published: [region] }), []);
  assert.deepEqual(manifestProblems({ ...m, published: [{ ...region, rect: { x: 990, y: 100, w: 32, h: 32 } }] }), ['published r: bay']);
  assert.deepEqual(manifestProblems({ ...m, published: [{ ...region, rect: { x: 990, y: 100, w: 32, h: 32 }, migration: { by: 'the owner', quote: 'Approve the migration', date: '2026-11-01' } }] }), []);
  assert.ok(touchesBay({ x: 1010, y: 0, w: 4, h: 4 }) && !touchesBay({ x: 1014, y: 0, w: 4, h: 4 }) && touchesBay({ x: -16, y: 0, w: 3, h: 4 }) && !touchesBay({ x: -17, y: 0, w: 3, h: 4 }), 'the seam band is 14');
  assert.deepEqual(manifestProblems({ ...m, published: [region, { ...region, id: 's', bake: 's.wg2' }] }), ['published s: overlaps r']);
  assert.deepEqual(manifestProblems({ ...m, published: [{ ...region, generator: 'wg2-9' }] }), ['published r: generator']);
  assert.deepEqual(manifestRefuses(m, m), []);
  assert.deepEqual(manifestRefuses(m, { ...m, published: [region] }), ['ground']);
  assert.notEqual(groundPrint({ ...m, published: [region] }), groundPrint({ ...m, published: [{ ...region, print: 'abcdef02' }] }), 'a re-bake moves the ground print');
});

test('WG2 STAGE_GRAPH: every stage reads only stages before it; a change goes stale downstream over its reach - a vegetation edit leaves the rocks and the water alone, a river\'s change reaches its basin and not the province (mutants: a reach, the basin ignored, the order)', () => {
  STAGE_ORDER.forEach((s, i) => { for (const r of STAGE_GRAPH[s].reads) assert.ok(STAGE_ORDER.indexOf(r) < i, `${s} reads ${r}`); });
  const bounds = { x: 0, y: 0, w: 1000, h: 1000 }, at = { x: 500, y: 500, w: 4, h: 4 };
  const veg = staleAfter('vegetation', at, bounds);
  assert.deepEqual([...veg.keys()], ['resources', 'suitability', 'settlements']);
  assert.deepEqual(veg.get('resources'), { x: 498, y: 498, w: 8, h: 8 });
  const basin = { x: 450, y: 480, w: 120, h: 60 };
  const river = staleAfter('erosion', at, bounds, { basinOf: () => basin });
  assert.deepEqual(river.get('hydrology'), { x: 450, y: 480, w: 120, h: 60 });
  assert.ok(!river.has('geology') && !river.has('climate'), 'upstream stages never go stale');
  assert.deepEqual(staleAfter('erosion', at, bounds).get('hydrology'), bounds, 'no basin known: the region');
  assert.deepEqual(staleAfter('geology', { x: -10, y: -10, w: 4, h: 4 }, bounds).get('climate'), { x: 0, y: 0, w: 18, h: 18 }, 'clipped to the region');
});

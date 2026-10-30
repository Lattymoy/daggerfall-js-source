// FOUNDATION F1 (bible/03-World/Foundation-Arc.md): THE ATLAS IN THE STREAMING WORLD (scenes/atlasHost.js) - a bundle made
// when first asked from the location the host stands, the places near a pixel asked of the registry each time, a new
// atlas when a provider moves, and the check: every listed place in idle slices against the blocks served, the console
// told once. A place past the Bay beside the Bay's. Pins mutation-checked (tools/mutants/foundation.json).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createAtlasHost, ATLAS_SLICE, ATLAS_SAID } from '../../src/scenes/atlasHost.js';
import { createWorldPlaces } from '../../src/world/worldWide/worldPlaces.js';
import { districtOf, areaOfDistrict } from '../../src/world/worldWide/worldGrid.js';

const [cx, cy] = districtOf(1500, -400);
const BAY = Array.from({ length: 1200 }, (_, i) => ({ mapId: 100 + i, name: `Bay ${i}`, px: 10 + (i % 40) * 3, py: 10 + Math.floor(i / 40) * 3, type: 0, region: 17 }));
const loc = (names) => ({ exterior: { exteriorData: { width: names.length, height: 1, blockNames: names }, buildings: [], recordElement: { doors: [] } } });
const BLOCKS = { count: 1295, checkName: (n) => (n.startsWith('GONE') ? '' : n), getBlockIndex: () => 0 };

const world = () => {
  const places = createWorldPlaces();
  places.register('bay', BAY);
  places.register('tesa', [{ mapId: 9000, name: 'Skyrim town', px: 1500, py: -400, type: 0, area: areaOfDistrict(3, cx, cy) }]);
  const stood = new Map(BAY.map((r) => [r.mapId, loc([r.mapId === 105 ? 'GONE01.RMB' : 'AAA.RMB'])]));
  const queue = [];
  let stands = 0;
  const host = createAtlasHost({
    places, blocks: BLOCKS,
    standing: (p) => stood.get(p.mapId) ?? null,
    stand: (p) => { stands++; return stood.get(p.mapId) ?? (p.mapId === 9000 ? loc(['TESAOPEN.RMB']) : null); },
    schedule: (fn) => queue.push(fn),
  });
  const drain = () => { let n = 0; while (queue.length) { queue.shift()(); n++; } return n; };
  return { places, host, drain, stands: () => stands };
};

test('F1 host: a bundle is made when first asked, from the location the host would stand - the Bay\'s and a place past the Bay alike - and kept; one no location answers is null (mutants: the stand asked every time, the keep)', () => {
  const { host, stands } = world();
  assert.equal(host.version, 1);
  assert.equal(host.atlas().counts().places, 0, 'nothing is made before it is asked');
  const b = host.bundle(100);
  assert.deepEqual([b.id, b.place.region, b.exterior.w], [100, 17, 1]);
  assert.equal(host.bundle(100), b);
  assert.equal(stands(), 1, 'asked twice, stood once');
  const sky = host.bundle(9000);
  assert.deepEqual([sky.place.region, sky.place.theatre], [64, 3], 'Skyrim\'s town, Skyrim\'s region');
  assert.equal(host.bundle(424242), null);
});

test('F1 host: residency is the registry\'s near, asked each time - the bundles within the reach of a pixel, none kept for being near (mutant: a reach kept)', () => {
  const { host } = world();
  assert.deepEqual(host.near(10, 10, 3).map((b) => b.id).sort((a, b) => a - b), [100, 101, 140, 141]);
  assert.deepEqual(host.near(1500, -400, 1).map((b) => b.id), [9000]);
  assert.deepEqual(host.near(-3000, 2000, 2), []);
});

test('F1 host: a provider that moves starts a new atlas - a bundle is never answered off a registry that changed (mutant: the generation unread)', () => {
  const { host, places } = world();
  const before = host.bundle(100);
  places.register('more', [{ mapId: 9001, name: 'Another', px: 900, py: 400, type: 0, region: 30 }]);
  const after = host.bundle(100);
  assert.notEqual(after, before);
  assert.deepEqual([after.id, host.atlas().counts().places], [100, 1]);
});

test(`F1 host: the check walks every listed place in slices of ${ATLAS_SLICE} at idle, keeps no bundle, and tells the console once of a block that serves nothing - a place not yet stood counted, not told (mutants: one slice, the warning unsaid, the unlocated told)`, async () => {
  const { host, drain } = world();
  const warned = [];
  const warn = console.warn;
  console.warn = (...a) => warned.push(a.join(' '));
  let report;
  try {
    const done = host.check();
    assert.equal(host.report(), null, 'nothing is checked before the idle');
    assert.equal(drain(), Math.ceil(1201 / ATLAS_SLICE));
    report = await done;
  } finally { console.warn = warn; }
  assert.deepEqual(report, { checked: 1201, unlocated: 1, problems: [{ place: 105, part: 'exterior', name: 'GONE01.RMB', why: 'unresolved' }] });
  assert.deepEqual(warned, ['[atlas] 1 block reference(s) serve nothing: GONE01.RMB (exterior of place 105)']);
  assert.equal(host.atlas().counts().places, 0, 'the check\'s bundles are its own');
  assert.ok(ATLAS_SAID >= 1);
});

test('F1 host: the streaming world wires it - the places host makes it over the registry (none without one), the blocks and the index, and checks when the world-data door serves edits (scenes/tamrielPlacesHost.js)', () => {
  const src = readFileSync(new URL('../../src/scenes/tamrielPlacesHost.js', import.meta.url), 'utf8');
  assert.match(src, /const worldAtlas = worldPlaces \? createAtlasHost\(\{ places: worldPlaces, blocks, standing: /);
  assert.match(src, /if \(worldAtlas && worldDataDoorOpen\(\)\) worldAtlas\.check\(\);/);
});

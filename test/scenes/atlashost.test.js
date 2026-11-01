// FOUNDATION F1 (bible/03-World/Foundation-Arc.md): THE ATLAS IN THE STREAMING WORLD (scenes/atlasHost.js) - a bundle made
// when first asked from the location the host stands, the places near a pixel asked of the registry each time, a new
// atlas when a provider moves, and the check: every listed place in idle slices against the blocks served, the console
// told once. A place past the Bay beside the Bay's. Pins mutation-checked (tools/mutants/foundation.json).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createAtlasHost, ATLAS_SLICE, ATLAS_SAID, ATLAS_RUN, ATLAS_SLICE_MS } from '../../src/scenes/atlasHost.js';
import { createWorldPlaces, placeOfRow } from '../../src/world/worldWide/worldPlaces.js';
import { districtOf, areaOfDistrict } from '../../src/world/worldWide/worldGrid.js';

const [cx, cy] = districtOf(1500, -400);
const BAY = Array.from({ length: 1200 }, (_, i) => ({ mapId: 100 + i, name: `Bay ${i}`, px: 10 + (i % 40) * 3, py: 10 + Math.floor(i / 40) * 3, type: 0, region: 17 }));
const loc = (names) => ({ exterior: { exteriorData: { width: names.length, height: 1, blockNames: names }, buildings: [], recordElement: { doors: [] } } });
const BLOCKS = { count: 1295, checkName: (n) => (n.startsWith('GONE') ? '' : n), getBlockIndex: () => 0 };

const world = (o = {}) => {
  const places = createWorldPlaces();
  places.register('bay', BAY);
  places.register('tesa', [{ mapId: 9000, name: 'Skyrim town', px: 1500, py: -400, type: 0, area: areaOfDistrict(3, cx, cy) }]);
  const stood = new Map(BAY.map((r) => [r.mapId, loc([r.mapId === 105 ? 'GONE01.RMB' : 'AAA.RMB'])]));
  const queue = [];
  let stands = 0, gen = 0;
  const host = createAtlasHost({
    places, blocks: BLOCKS,
    standing: (p) => stood.get(p.mapId) ?? null,
    stand: (p) => { stands++; if (stood.has(p.mapId)) return stood.get(p.mapId); const l = p.mapId === 9000 ? loc(['TESAOPEN.RMB']) : null; if (l) { stood.set(p.mapId, l); gen++; } return l; },   // stood anew: into the index, its stamp moved
    schedule: (fn) => queue.push(fn), stamp: () => gen, clock: () => 0, ...o,
  });
  const drain = () => { let n = 0; while (queue.length) { queue.shift()(); n++; } return n; };
  return { places, host, drain, stands: () => stands, stood, bump: () => { gen++; } };
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
  assert.equal(host.bundle(9000), sky, 'kept, though standing it moved the stamp (AUDIT FOUNDATION II A2)');
  assert.equal(stands(), 2);
  assert.equal(host.bundle(424242), null);
});

test('F1 host: residency is the registry\'s near, asked each time - the bundles of the places the host holds within the reach of a pixel; nothing stood for being near (AUDIT FOUNDATION A3; mutants: a reach kept, near standing)', () => {
  const { host, stands } = world();
  assert.deepEqual(host.near(10, 10, 3).map((b) => b.id).sort((a, b) => a - b), [100, 101, 140, 141]);
  assert.deepEqual(host.near(1500, -400, 1).map((b) => b.id), [], 'a place past the Bay not stood yet: none');
  assert.equal(stands(), 0, 'near stood nothing');
  host.bundle(9000);
  assert.deepEqual(host.near(1500, -400, 1).map((b) => b.id), [9000], 'stood by the host: near it');
  assert.deepEqual(host.near(-3000, 2000, 2), []);
});

test('F1 host: a provider that moves, or a location the host stands again (a town\'s layout pinned anew), starts a new atlas - a bundle is never answered off a world that changed (AUDIT FOUNDATION A2; mutants: the generation unread, the stamp unread)', () => {
  const { host, places, stood, bump } = world();
  const before = host.bundle(100);
  places.register('more', [{ mapId: 9001, name: 'Another', px: 900, py: 400, type: 0, region: 30 }]);
  const after = host.bundle(100);
  assert.notEqual(after, before);
  assert.deepEqual([after.id, host.atlas().counts().places], [100, 1]);
  stood.set(100, loc(['AAA.RMB', 'BBB.RMB']));
  bump();
  assert.equal(host.bundle(100).exterior.w, 2, 'the town as it stands now');
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
  assert.deepEqual(report, { checked: 1201, unlocated: 1, problems: [{ place: 105, part: 'exterior', name: 'GONE01.RMB', why: 'unresolved' }], unplaced: [] });
  assert.deepEqual(warned, ['[atlas] 1 block reference(s) serve nothing: GONE01.RMB (exterior of place 105)']);
  assert.equal(host.atlas().counts().places, 0, 'the check\'s bundles are its own');
  assert.ok(ATLAS_SAID >= 1);
});

test('F1 host: the check reads a place past the Bay the host has not stood through its peek - cloned, never stood - so every listed place is checked, and a property row in a town past the Bay against its grid (AUDIT FOUNDATION II A1; mutant: the peek unread)', async () => {
  const listings = () => [{ map: 9000, cell: [2, 0], sale: false }];
  const { host, drain, stands } = world({ peek: (p) => (p.mapId === 9000 ? loc(['GONE77.RMB']) : p.mapId === 105 ? loc(['GONE01.RMB']) : loc(['AAA.RMB'])), listings });
  const warn = console.warn;
  console.warn = () => {};
  let report;
  try { const done = host.check(); drain(); report = await done; } finally { console.warn = warn; }
  assert.deepEqual([report.unlocated, report.problems.map((q) => q.place), report.unplaced.map((u) => [u.row.map, u.why]), stands()], [0, [105, 9000], [[9000, 'no such cell']], 0]);
});

test('F1 host: a slice of the check keeps to its budget - a slow place ends it early, the rest at the next idle (AUDIT FOUNDATION II A1; mutant: the clock unread)', async () => {
  let t = 0;
  const { host, drain } = world({ clock: () => (t += ATLAS_SLICE_MS / 1.6) });
  const warn = console.warn;
  console.warn = () => {};
  let report;
  try { const done = host.check(); assert.equal(drain(), Math.ceil(1201 / (2 * ATLAS_RUN))); report = await done; } finally { console.warn = warn; }
  assert.equal(report.checked, 1201);
});

test('F1 host: a client\'s own world-data additions are checked with the listed places, and a property row naming a cell past its town\'s grid is said - read off what the host holds, nothing stood (mutants: the additions unread, the rows unchecked)', async () => {
  const places = createWorldPlaces();
  places.register('bay', BAY.slice(0, 3));
  const queue = [], said = [], warn = console.warn;
  const fort = { mapId: 5000, name: 'A fort', px: 300, py: 300, type: 0, region: 16, area: 16, theatre: 0, key: 1 };
  const host = createAtlasHost({ places, blocks: BLOCKS, standing: () => loc(['AAA.RMB']), schedule: (fn) => queue.push(fn),
    additions: () => [[fort, loc(['GONE09.RMB'])]], listings: () => [{ map: 4242, cell: [0, 0], sale: false }, { map: 100, cell: [0, 0], sale: false }, { map: 101, cell: [3, 0], sale: false }] });
  console.warn = (...a) => said.push(a.join(' '));
  let report;
  try { const done = host.check(); while (queue.length) queue.shift()(); report = await done; } finally { console.warn = warn; }
  assert.deepEqual(report.problems.map((q) => [q.place, q.name]), [[5000, 'GONE09.RMB']]);
  assert.deepEqual(report.unplaced.map((u) => [u.row.map, u.why]), [[101, 'no such cell']], 'a cell past its town\'s grid said; a town not known here passed over, town 100\'s cell stands');
  assert.equal(said.length, 2);
});

test('F1 host: a check whose slice throws ends - said, answered null, and asked again later (AUDIT FOUNDATION A5; mutant: the check left running)', async () => {
  const places = createWorldPlaces();
  places.register('bay', BAY.slice(0, 2));
  const queue = [], warn = console.warn;
  let fail = true;
  const host = createAtlasHost({ places, blocks: BLOCKS, standing: () => { if (fail) throw new Error('a location unread'); return loc(['AAA.RMB']); }, schedule: (fn) => queue.push(fn) });
  console.warn = () => {};
  try {
    const first = host.check();
    while (queue.length) queue.shift()();
    assert.equal(await first, null);
    fail = false;
    const again = host.check();
    while (queue.length) queue.shift()();
    assert.equal((await again)?.checked, 2, 'asked again, the check runs');
  } finally { console.warn = warn; }
});

test('F1 host: a mod\'s additions are each region\'s rows past its base count, with their locations - the base rows never (scenes/tamrielPlacesHost.js modAdditions; AUDIT FOUNDATION II A4; mutant: the base count unread)', () => {
  const src = readFileSync(new URL('../../src/scenes/tamrielPlacesHost.js', import.meta.url), 'utf8');
  const at = src.indexOf('  const modAdditions = () => {');
  const body = src.slice(at, src.indexOf('\n  };\n', at) + 5);
  const row = (r, l) => ({ name: `r${r}l${l}`, regionIndex: r, mapTableData: { mapId: r * 1000 + l } });
  const maps = { regionCount: 62, getRegion: (r) => ({ locationCount: r === 16 ? 3 : 2 }), baseLocationCount: () => 2, getLocation: row };
  const bayRows = (locs) => locs.map((l) => ({ mapId: l.mapTableData.mapId, name: l.name, px: 300, py: 300, type: 0, region: l.regionIndex }));
  const modAdditions = new Function('maps', 'placeOfRow', 'bayPlaceRows', `${body}\n  return modAdditions;`)(maps, placeOfRow, bayRows);
  assert.deepEqual(modAdditions().map(([p, loc]) => [p.mapId, p.region, loc.name]), [[16_002, 16, 'r16l2']]);
});

test('F1 host: the streaming world wires it - the places host makes it over the registry (none without one), the blocks and the index, and checks when the world-data door serves edits (scenes/tamrielPlacesHost.js)', () => {
  const src = readFileSync(new URL('../../src/scenes/tamrielPlacesHost.js', import.meta.url), 'utf8');
  assert.match(src, /const worldAtlas = worldPlaces \? createAtlasHost\(\{ places: worldPlaces, blocks, standing: /);
  assert.match(src, /if \(worldAtlas && \(worldDataDoorOpen\(\) \|\| homeListings\(\)\.length\)\) worldAtlas\.check\(\);/);
  assert.match(src, /peek: peekAt, listings: homeListings, additions: modAdditions, stamp: \(\) => host\._locIndexGen \}\) : null;/);
  assert.match(src, /const peekAt = \(p\) => locationIndex\.get\(`\$\{p\.px\},\$\{p\.py\}`\) \?\? \(inBay\(p\.px, p\.py\) \? null : settle2\.peekAt\(p\.px, p\.py\) \?\? capitalSliceAt\(p\.px, p\.py\) \?\? arenaPeekAt\(p\.px, p\.py\)\);/, 'AUDIT FOUNDATION II A1: a capital\'s slice and an Arena place read unstood');
});

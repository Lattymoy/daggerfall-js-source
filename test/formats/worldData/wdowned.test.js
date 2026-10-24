// WD-OWNED (2026-10-20, the owner: "do your own performance pass ... go deep"; bible/07-Rendering/Performance-Priority.md
// WD-OWNED) - A TOWN FILE'S EDITS LAID ON ITS OWN BASE. The boot reads every location of the world (its index), and each
// town a pack edits is rebuilt then: its classic location read afresh, made DFU's JSON (locationToDfuJson) and the
// author's edits laid on it (worldDataPack.js rebuild) - over a deep copy of that JSON, which nothing else held: the
// copy was 7,727 JSON round trips of 40 MB at the boot. A location's base is laid on in place now; a block's base (the
// classic JSON kept for the next file) and a file's (a kept base file) are still copied. Held here: patchJson's `owned`
// itself, a town file rebuilt the author's file without a copy made and every rebuild its own object, and the kept
// bases untouched by the files laid on them. Over the real data: every file of both town packs still rebuilds the
// author's file sha256 for sha256 (test/formats/worldData/wd3_pack.test.js, with ARENA2_PATH).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openWorldDataPack, PACK_FORMAT } from '../../../src/formats/worldData/worldDataPack.js';
import { patchJson, canonicalJson, locationToDfuJson, diffJson } from '../../../src/formats/worldData/worldDataJson.js';
import { tinyRmb, fakeBlocks } from '../../wd3Fakes.mjs';

/** A classic town as MapsFile reads it - every field locationToDfuJson reads. */
const tinyTown = () => ({
  loaded: true, name: 'Tinyford', regionName: 'Daggerfall', hasDungeon: false, regionIndex: 17, locationIndex: 4, politic: 0,
  mapTableData: { mapId: 1234, latitude: 100, longitude: 200, locationType: 2, dungeonType: 0, discovered: false, key: 0 },
  exterior: {
    recordElement: { header: { x: 1, y: 2, isExterior: 1, unknown2: 0, locationId: 5, isInterior: 0, exteriorLocationId: 0, locationName: 'Tinyford' } },
    buildingCount: 2,
    buildings: [{ nameSeed: 1, factionId: 0, sector: 1, locationId: 0, buildingType: 18, quality: 7 }, { nameSeed: 2, factionId: 41, sector: 2, locationId: 0, buildingType: 3, quality: 12 }],
    exteriorData: { anotherName: 'Tinyford', mapId: 1234, locationId: 5, width: 2, height: 1, portTownAndUnknown: 0, blockNames: ['TINYAA00.RMB', 'TINYAA00.RMB'] },
  },
  dungeon: { recordElement: { header: null }, header: { blockCount: 0 }, blocks: null },
  climate: { worldClimate: 230, climateType: 0, natureArchive: 504, groundArchive: 302, skyBase: 0, people: 0 },
});

/** A pack with a town file - the town renamed, a block of its grid swapped, a building moved and one removed - and a
 *  block file, both as the builder writes them (ops diffJson's). */
function townPack() {
  const classic = locationToDfuJson(tinyTown());
  const want = JSON.parse(JSON.stringify(classic));
  want.Name = 'Tinyford Hollow';
  want.Exterior.ExteriorData.BlockNames[1] = 'TINYBB00.RMB';
  want.Exterior.Buildings[0].Sector = 9;
  want.Exterior.Buildings.splice(1, 1);
  want.Exterior.BuildingCount = 1;
  const pack = {
    format: PACK_FORMAT, vendor: 'tiny-towns', mod: { title: 'Tiny Towns', author: 'nobody', version: '0.0.1' }, nodes: [],
    files: { 'location-17-4.json': ['sha', ['l', 17, 4, 'Tinyford'], diffJson(classic, want)] },
  };
  return { pack, want };
}
const mapsOf = () => { const m = { reads: 0, readClassicLocation: (r, l) => { m.reads++; return r === 17 && l === 4 ? tinyTown() : null; } }; return m; };

test('WD-OWNED patchJson lays the edits on a copy unless the base is the caller\'s own - then on the base itself, the same tree either way (mutant: `owned` ignored)', () => {
  const { pack, want } = townPack();
  const ops = pack.files['location-17-4.json'][2];
  const base = locationToDfuJson(tinyTown()), before = canonicalJson(base);
  const copied = patchJson(base, ops);
  assert.equal(canonicalJson(base), before, 'a base not owned is left as it was');
  assert.notEqual(copied, base);
  const owned = locationToDfuJson(tinyTown());
  const laid = patchJson(owned, ops, null, { owned: true });
  assert.equal(laid, owned, 'an owned base is the tree the edits are laid on');
  assert.equal(canonicalJson(laid), canonicalJson(copied));
  assert.equal(canonicalJson(laid), canonicalJson(want));
});

test('WD-OWNED a town file rebuilds the author\'s file with no copy of its base made, each rebuild its own object off its own read of the town (mutants: the town\'s base copied; laid on a kept base)', () => {
  const { pack, want } = townPack();
  const maps = mapsOf();
  const p = openWorldDataPack(pack, { blocks: fakeBlocks(tinyRmb()) });
  // a copy of the base - the round trip or WD-COPY's walk - reads every object of it; laid on as it is made, none is read
  const parse = JSON.parse, keys = Object.keys;
  let copied = 0;
  JSON.parse = function (...a) { copied++; return parse.apply(this, a); };
  Object.keys = function (...a) { copied++; return keys.apply(this, a); };
  let a;
  try { a = p.rebuild('location-17-4.json', maps); } finally { JSON.parse = parse; Object.keys = keys; }
  assert.equal(canonicalJson(a), canonicalJson(want), 'the author\'s file');
  assert.equal(copied, 0, 'the town\'s base laid on as it was made: nothing of it copied, and every value laid a plain one');
  const b = p.rebuild('location-17-4.json', maps);
  assert.notEqual(a, b, 'each rebuild its own object');
  assert.equal(maps.reads, 2, 'each off its own read of the town');
  a.Exterior.ExteriorData.BlockNames[0] = 'CHANGED.RMB';
  assert.equal(canonicalJson(b), canonicalJson(want), 'one rebuild\'s tree shares nothing with another\'s');
});

test('WD-OWNED (WD-COPY) a base laid on a copy is copied by a walk that writes what the JSON round trip writes - numbers it cannot write null and -0 as 0, an undefined left out of an object and null in an array, a toJSON, a non-plain object, a `__proto__` key and integer keys in their order - and throws where it throws (mutants: -0 kept; NaN kept; an undefined kept in an array; a non-plain object walked; a `__proto__` key walked; no depth bound)', () => {
  const viaJson = (v) => JSON.parse(JSON.stringify(v));
  const odd = [
    { a: 1, b: [1, undefined, () => 1, Symbol('s'), NaN, -0, Infinity, null, 'x'], c: undefined, d: () => 0, e: { f: -0, g: [[], {}] } },
    [new Date(0), new Map([[1, 2]]), new Uint8Array([1, 2]), Object.assign(Object.create(null), { z: 1, 2: 'two', 1: 'one' })],
    JSON.parse('{"__proto__": {"x": 1}, "y": 2}'),
    Object.assign([1, 2], { toJSON: () => 'arr' }),
    { 10: 'a', 2: 'b', z: 1, y: 2, '-1': 3 },
    Object.defineProperty({ a: 1 }, 'g', { enumerable: true, get: () => [undefined] }),
    { s: '\ud800 lone', u: ' ' },
    [1, , 3],   // eslint-disable-line no-sparse-arrays
    { boxed: [new Number(5), new String('ab'), new Boolean(false)] },   // eslint-disable-line no-new-wrappers
  ];
  const keysDeep = (v) => (v !== null && typeof v === 'object' ? [Object.keys(v), ...Object.values(v).map(keysDeep)] : null);
  for (const x of odd) {
    const want = viaJson(x), got = patchJson(x, []);
    assert.deepStrictEqual(got, want, JSON.stringify(want));
    assert.deepEqual(keysDeep(got), keysDeep(want), 'every key in the round trip\'s order');
  }
  const cyc = { a: 1 };
  cyc.self = cyc;
  assert.throws(() => patchJson(cyc, []), TypeError, 'a cycle throws as the round trip does');
  assert.throws(() => patchJson({ n: 1n }, []), TypeError, 'a bigint too');
});

test('WD-OWNED (WD-COPY) a plain tree is copied without the round trip - the walk, never JSON.stringify - and the copy shares nothing with it (mutant: the round trip for every tree)', () => {
  const tree = locationToDfuJson(tinyTown());
  const stringify = JSON.stringify;
  let n = 0;
  JSON.stringify = function (...a) { n++; return stringify.apply(this, a); };
  let copy;
  try { copy = patchJson(tree, [['s', ['Name'], 'Elsewhere']]); } finally { JSON.stringify = stringify; }
  assert.equal(n, 0);
  assert.equal(copy.Name, 'Elsewhere');
  assert.equal(tree.Name, 'Tinyford', 'the base untouched');
  copy.Exterior.ExteriorData.BlockNames[0] = 'X';
  copy.Exterior.Buildings[0].Sector = 99;
  assert.equal(canonicalJson(tree), canonicalJson(locationToDfuJson(tinyTown())), 'nothing of the base reached through the copy');
});

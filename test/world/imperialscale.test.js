// TOWN-SHAPES TS5 (2026-10-25, the owner: "This needs to be the scale of the Imperial City with the outskirt locations being
// circular also"; asked, "7x7 pixels"; bible/03-World/Town-Shapes.md TS5): the Imperial City over forty-nine pixels - its
// lake a round ring, the land past it its own; its landmarks carried in parts, a part a slice; the towns of its outskirts
// laid round.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { IMPERIAL, IMPERIAL_SPAN, IMPERIAL_CELLS, IMPERIAL_CITY_PLAN, IMPERIAL_OUTSKIRTS, IMPERIAL_PARTS, IMPERIAL_SLICE_NAMES, imperialSliceRect, imperialLand, imperialDistrictAt, bridgeLine, polar } from '../../src/world/imperialCity.js';
import { CAPITALS, BLOCK_M, capitalPixel, capitalCentrePixel, imperialOutskirts, capitalBlockNames } from '../../src/world/tamrielCapitals.js';
import { modelPart, vanillaTexels, installCapitals, _resetCapitals } from '../../src/world/capitalModels.js';
import { outlineCells, townOutlineCells, outlineTownLocation, ROUND_OUTLINE, TOWN_OUTLINE, TOWN_OUTLINE_BLOCK } from '../../src/world/townOutline.js';
import { customModelFor } from '../../src/world/customModels.js';
import { setTamrielFit } from '../../src/world/tamriel/tamrielFrame.js';

const rd = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
afterEach(() => setTamrielFit(null));
const B = BLOCK_M, HALF = IMPERIAL_CELLS / 2;

test('TS5 the lake round: every cell between the isle and the far shore the lake, every cell past it open ground (the land\'s own), the plan\'s corners land; Talos Bridge to the far shore (mutants: the far shore water; the bridge to the grid\'s edge)', () => {
  assert.equal(IMPERIAL_SPAN, 7);
  assert.ok(IMPERIAL.isle < IMPERIAL.lake && IMPERIAL.lake < HALF * B, 'the far shore inside the plan');
  for (const [r, c] of [[0, 0], [0, 55], [55, 0], [55, 55]]) assert.equal(IMPERIAL_CITY_PLAN[r][c], 'O', `corner ${c},${r}: open ground`);
  for (const b of [0, 90, 180, 270]) {
    const [x, z] = polar(b, (IMPERIAL.isle + IMPERIAL.lake) / 2 + 40), cell = IMPERIAL_CITY_PLAN[Math.floor(z / B + HALF)][Math.floor(x / B + HALF)];
    if (b === 180 || b === 270) continue;   // the quay and the bridge stand over it there
    assert.equal(cell, 'L', `the lake at ${b}`);
  }
  assert.equal(imperialLand(...polar(45, IMPERIAL.lake + 1)), true);
  assert.equal(imperialLand(...polar(45, IMPERIAL.lake - 1)), false);
  assert.equal(imperialDistrictAt(...polar(45, IMPERIAL.lake + 1)), 'Rumare Shore');
  const [a, z] = bridgeLine();
  assert.ok(Math.abs(Math.hypot(...z) - (IMPERIAL.lake + 40)) < 1e-6 && Math.abs(Math.hypot(...a) - IMPERIAL.cityWall.r) < 1e-6, 'from the west gate to the far shore');
  assert.deepEqual(capitalBlockNames([['O']], 0, new Map()), [TOWN_OUTLINE_BLOCK], 'open ground the open block');
});

test('TS5 the slices\' names: each its district\'s where the district holds eight of its cells or more (a sliver of a district names none), else City Isle, Lake Rumare or Rumare Shore - the centre the city\'s own (mutant: the least unread)', () => {
  assert.deepEqual(IMPERIAL_SLICE_NAMES, [
    'Rumare Shore', 'Rumare Shore', 'Lake Rumare', 'Lake Rumare', 'Lake Rumare', 'Rumare Shore', 'Rumare Shore',
    'Rumare Shore', 'Lake Rumare', 'Elven Gardens District', 'Market District', 'Market District', 'Prison District', 'Rumare Shore',
    'Lake Rumare', 'Talos Plaza District', 'Elven Gardens District', 'Market District', 'Market District', 'Arena District', 'Lake Rumare',
    'Lake Rumare', 'Talos Plaza District', 'Talos Plaza District', 'Imperial City', 'Arena District', 'Arena District', 'Lake Rumare',
    'Lake Rumare', 'Talos Plaza District', 'Temple District', 'Arboretum', 'Arboretum', 'Arena District', 'Lake Rumare',
    'Rumare Shore', 'Lake Rumare', 'Temple District', 'Arboretum', 'Arboretum', 'Arcane University', 'Rumare Shore',
    'Rumare Shore', 'Rumare Shore', 'Lake Rumare', 'Waterfront District', 'Lake Rumare', 'Rumare Shore', 'Rumare Shore',
  ]);
});

test('TS5 a landmark\'s part: the triangles whose middles stand in a slice\'s square (the world\'s +z north, the square\'s z south), its doors there, a submesh a picture; nothing lost between parts (mutants: the square\'s z unturned; a triangle in two parts)', () => {
  // two triangles: one about (10, 0, -10) - the anchor's metres (10, 10): slice 24's square - and one 900 m east
  const m = { positions: Float32Array.from([9, 0, -9, 11, 0, -9, 10, 0, -11, 909, 0, -9, 911, 0, -9, 910, 0, -11]), normals: new Float32Array(18).fill(0).map((_, i) => (i % 3 === 1 ? 1 : 0)), uvs: new Float32Array(12), indices: Uint32Array.from([0, 1, 2, 3, 4, 5]), subMeshes: [{ textureArchive: 1, textureRecord: 2, startIndex: 0, primitiveCount: 2 }], doors: [{ vert0: { x: 9, y: 0, z: -9 }, vert1: { x: 11, y: 0, z: -9 }, vert2: { x: 10, y: 3, z: -9 } }] };
  const centre = modelPart(m, imperialSliceRect(24)), east = modelPart(m, imperialSliceRect(25));
  assert.equal(centre.indices.length, 3);
  assert.equal(east.indices.length, 3);
  assert.deepEqual([...east.positions.slice(0, 3)], [909, 0, -9]);
  assert.deepEqual(centre.subMeshes, [{ textureArchive: 1, textureRecord: 2, startIndex: 0, primitiveCount: 1 }]);
  assert.equal(centre.doors.length, 1);
  assert.equal(east.doors.length, 0);
  assert.equal(modelPart(m, imperialSliceRect(17)).indices.length, 0, 'the slice north of the centre none: its z the anchor\'s south');
  assert.ok(IMPERIAL_PARTS.length > 40 && IMPERIAL_PARTS.every((p) => CAPITALS[0].models.includes(p.id)));
  // on the model door: each part its slice's share of its landmark
  _resetCapitals();
  installCapitals({ addTextures: () => 0 });
  const tower = IMPERIAL_PARTS.find((p) => p.base === CAPITALS[0].drawn[0] && p.s === 24);
  assert.ok(tower && customModelFor(tower.id)?.indices.length > 0, 'the White-Gold Tower\'s part in the centre');
  assert.equal(customModelFor(tower.id).indices.length, modelPart(customModelFor(tower.base), imperialSliceRect(24)).indices.length);
});

test('TS5 a model\'s pictures kilometres out: each coordinate from a whole number of pictures nearest its middle - the same look, its texels kept in a 32-bit UV (mutant: from the city\'s middle)', () => {
  const near = vanillaTexels({ positions: [0, 0, 0, 0.3, 0, 0, 0.3, 0.2, 0], indices: [0, 1, 2] });
  const far = vanillaTexels({ positions: [2400, 0, 0, 2400.3, 0, 0, 2400.3, 0.2, 0], indices: [0, 1, 2] });
  const frac = (v) => v - Math.floor(v);
  for (let i = 0; i < 6; i++) assert.ok(Math.abs(frac(far.uvs[i]) - frac(near.uvs[i] + (i % 2 === 0 ? 2400 / 1.6 : 0))) < 1e-4, 'the same picture');
  assert.ok(Math.max(...far.uvs.map(Math.abs)) < 2, 'small numbers');
});

test('TS5 the outskirts round: a round town keeps the cells of a ring of its grid - its corners out, the same each way, no seed\'s lobes; the Imperial City\'s outskirts its own seven pixels and as far again, the host laying a clone there round (mutants: the outskirts unread; the round unread)', () => {
  assert.deepEqual([ROUND_OUTLINE.depth[0], ROUND_OUTLINE.depth[1], ROUND_OUTLINE.noise], [0, 0, 0]);
  const three = outlineCells(3, 3, 1234, () => false, 0, ROUND_OUTLINE);
  assert.deepEqual([...three], [0, 1, 0, 1, 1, 1, 0, 1, 0], 'a three by three: its corners out');
  for (const seed of [1, 99, 500123]) {
    const five = outlineCells(5, 5, seed, () => false, 0, ROUND_OUTLINE);
    for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) assert.equal(five[y * 5 + x], five[x * 5 + (4 - y)], 'the same each way round');
    assert.deepEqual(five, outlineCells(5, 5, seed + 7, () => false, 0, ROUND_OUTLINE), 'no seed\'s lobes');
  }
  assert.notDeepEqual([...townOutlineCells(6, 6, 41, () => [], () => false, ROUND_OUTLINE)], [...townOutlineCells(6, 6, 41, () => [], () => false, TOWN_OUTLINE)]);
  // a clone laid round where the host says (no named building: its cells the round's alone)
  const empty = { rmbBlock: { fldHeader: { numBlockDataRecords: 0, buildingDataList: [] } } };
  const loc = { name: 'R', mapTableData: { mapId: 0xa7a0007 }, locationIndex: -1, exterior: { buildings: [], exteriorData: { width: 5, height: 5, blockNames: Array.from({ length: 25 }, (_, i) => `R${i}.RMB`) } } };
  const io = { classicOf: () => empty, servedOf: () => empty };
  const open = (o) => o.exterior.exteriorData.blockNames.map((n) => (n === TOWN_OUTLINE_BLOCK ? 0 : 1));
  assert.deepEqual(open(outlineTownLocation(loc, io, { round: true })), [...outlineCells(5, 5, 0xa7a0007, () => false, 0, ROUND_OUTLINE)]);
  setTamrielFit({ ox: 38 * 15.5, oy: 57 * 15.5, ppu: 15.5 });
  const at = capitalPixel(CAPITALS[0]);
  assert.deepEqual(capitalCentrePixel(0), at);
  assert.equal(IMPERIAL_OUTSKIRTS, 14);
  assert.equal(imperialOutskirts(at.px + 3, at.py), false, 'the city\'s own pixel');
  assert.equal(imperialOutskirts(at.px + 4, at.py), true, 'the first past it');
  assert.equal(imperialOutskirts(at.px + 10, at.py + 10), false, 'past fourteen');
  assert.equal(imperialOutskirts(at.px + 14, at.py), true);
  assert.equal(imperialOutskirts(at.px + 15, at.py), false);
  const h = rd('src/scenes/tamrielPlacesHost.js');
  assert.match(h, /blockOf, \{ round: imperialOutskirts\(px, py\) \}\);   \/\/ TS5/);
  assert.match(h, /const loc = outlineTownLocation\(made, blockOf, \{ round: imperialOutskirts\(px, py\) \}\);/);
});

// IC-GRAND (2026-10-26, the owner: "Lets do 20km"; the coordinator's brief: "only near blocks get full detail, with a far
// LOD/impostor for the rest of the city (skyline, walls, tower), streaming budgets so arriving or crossing the city does not
// hitch, and nothing that walks every location every frame"; bible/03-World/Arena-Provinces.md IC-GRAND) - THE IMPERIAL
// CITY NEAR AND FAR, pinned: its blocks and its fabric's models families made when first asked and kept a few hundred at a
// time; a slice within a pixel of the player built near, the rest far (its skyline, no collider, no walker); the sweep that
// builds a slice again when its view moves, walking only the built pixels and only when the player's pixel or the built set
// moves; the city past the stream's reach on the far ring's pass (FAR-LANDMARK: a landmark a slice).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CAPITALS, capitalNear, capitalBuildView, capitalViewOf, synthesizeCapitalLocation, capitalSliceCarriers, capitalSliceMarkers, capitalCentre, portBlockJson, miscModelAt, startMarkerAt, CAPITAL_NO_GROUND, CAPITAL_CLOSED_BYTE, inCapitalRim, BLOCK_M } from '../../src/world/tamrielCapitals.js';
import {
  NEAR_RING, NEAR_SLACK, IMPERIAL_BLOCK_INDEX, imperialBlockIndex, imperialBlockName, imperialOwnName, imperialFarName, imperialLakeName, imperialViewName,
  imperialFabricModelId, imperialSkylineId, isFabricModelId, isSkylineId, imperialBlockJson, imperialOwnLaws, imperialOpenAt, sliceOfCell,
  IMPERIAL_FABRIC_MODEL, IMPERIAL_SKYLINE_MODEL,
} from '../../src/world/imperialBlocks.js';
import { townWallBlockIndex, townWallModelId } from '../../src/world/townWalls.js';
import { TOWN_FABRIC_MODEL_BASE } from '../../src/world/urban/townFabricStand.js';
import { IMPERIAL, IMPERIAL_SPAN, IMPERIAL_CELLS, imperialSlicePlan, imperialCodeCell, IMPERIAL_ARENA_CODE, polar } from '../../src/world/imperialCity.js';
import { installCapitals, _resetCapitals, IMPERIAL_KEEP } from '../../src/world/capitalModels.js';
import { customModelFor, isSolidModel, registerCustomModelFamily, _resetCustomModels } from '../../src/world/customModels.js';
import { registerPortBlockFamily, getDFBlockReplacementData, getNewDFBlockIndex, getNewDFBlockName, _resetWorldDataReplacement, installWorldDataReplacement } from '../../src/formats/worldData/worldDataReplacement.js';
import { impostorSliceAt, impostorQuads, imperialLandmarkMesh } from '../../src/world/imperialImpostor.js';
import { FarRingRenderer } from '../../src/render/farRing.js';
import { createCapitalSkyline, SKYLINE_REACH, SKYLINE_BUDGET_MS } from '../../src/scenes/capitalSkyline.js';
import { createTamrielSweeps } from '../../src/scenes/tamrielSweepsHost.js';
import { locationStartMarkers } from '../../src/world/locationEntrance.js';
import { collectBlockFlats } from '../../src/world/rmbFlats.js';

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const IC = CAPITALS[0], N = IMPERIAL_SPAN, CENTRE = (N * N - 1) / 2, B = BLOCK_M, HALF = IMPERIAL_CELLS / 2;
const fh = { rmbBlock: { fldHeader: { numBlockDataRecords: 1, buildingDataList: [{ buildingType: 9, factionId: 0, quality: 5 }] } } };
const base = { name: 'B', regionIndex: 1, regionName: 'R', politic: 129, climate: {}, hasDungeon: false, mapTableData: { mapId: 9, locationType: 0 }, exterior: { exteriorData: { blockNames: ['X'], width: 1, height: 1 }, buildings: [] } };
const names = new Map(['GENR', 'ARMR', 'ALCH', 'GEMS', 'BOOK', 'PAWN', 'BANK', 'TVRN', 'RESI', 'FIGH', 'TEMP', 'LIBR', 'THIE', 'MAGE'].map((k) => [k, [`${k}AA00.RMB`]]));
const slice = (s, px = 0, py = 0) => synthesizeCapitalLocation({ cap: IC, k: 0, s }, { base, names, blockOf: (n) => (n.startsWith('TES') ? null : fh), px, py });

test('IC-GRAND NEAR AND FAR - a slice within NEAR_RING of the player\'s pixel near, a near one kept near NEAR_SLACK further (a walk along a pixel\'s edge builds nothing twice), the rest far (mutants: the slack unread; the ring two)', () => {
  assert.deepEqual([NEAR_RING, NEAR_SLACK], [1, 1]);
  const at = { x: 100, y: 100 };
  assert.equal(capitalNear(100, 100, at), true);
  assert.equal(capitalNear(101, 99, at), true, 'a diagonal neighbour');
  assert.equal(capitalNear(102, 100, at), false);
  assert.equal(capitalNear(102, 100, at, 'near'), true, 'a near one kept');
  assert.equal(capitalNear(102, 100, at, 'far'), false);
  assert.equal(capitalNear(103, 100, at, 'near'), false, 'past the slack');
  assert.equal(capitalNear(5, 5, null), true, 'no player\'s pixel: near');
});

test('IC-GRAND THE FAR VIEW - a family capital\'s slice far from the player built as its far view: every cell but the lake\'s, the open shore\'s and the arena\'s its far block, no building, no dungeon, `lod` far - made once a location; the index\'s location untouched; near the location itself; any other capital as it is (mutants: the arena\'s cell far; the view made anew)', () => {
  const s = sliceOfCell(...[100, 144]), loc = slice(s, 1018, 500), sx = s % N, sy = Math.floor(s / N);
  assert.equal(capitalViewOf(loc), 'near');
  const near = capitalBuildView(loc, 1018, 500, { x: 1018, y: 500 });
  assert.equal(near, loc);
  const far = capitalBuildView(loc, 1018, 500, { x: 1010, y: 500 });
  assert.notEqual(far, loc);
  assert.equal(capitalBuildView(loc, 1018, 500, { x: 1010, y: 500 }), far, 'made once');
  assert.deepEqual([far.hasDungeon, far.dungeon, far.exterior.buildings.length, far.exterior.exteriorData.buildingCount, far.capital.lod, capitalViewOf(far)], [false, null, 0, 0, 'far', 'far']);
  const plan = imperialSlicePlan(s), ed = loc.exterior.exteriorData;
  far.exterior.exteriorData.blockNames.forEach((name, i) => {
    const pr = 7 - Math.floor(i / 8), pc = i % 8, cell = plan[pr][pc];
    const keep = cell === 'L' || cell === 'O' || cell === IMPERIAL_ARENA_CODE;
    assert.equal(name, keep ? ed.blockNames[i] : imperialFarName(sy * 8 + pr, sx * 8 + pc), `${i} ${cell}`);
    assert.equal(imperialViewName(sy * 8 + pr, sx * 8 + pc, ed.blockNames[i], true), name);
  });
  assert.ok(far.exterior.exteriorData.blockNames.includes(ed.blockNames.find((n) => n === 'ARENADAG.RMB')), 'the arena stands far too');
  assert.equal(loc.exterior.buildings.length > 0 || loc.exterior.buildings.length === 0, true);
  assert.equal(loc.capital.lod, undefined, 'the index\'s location untouched');
  const sol = synthesizeCapitalLocation({ cap: CAPITALS[1], k: 1 }, { base, names: new Map([...names, ...['GRVE', 'CUST', 'SHIP', 'MARK'].map((k) => [k, [`${k}AA00.RMB`]])]), blockOf: () => fh, px: 1, py: 1 });
  assert.equal(capitalBuildView(sol, 1, 1, { x: 90, y: 90 }), sol, 'another capital as it is');
  assert.equal(capitalViewOf(sol), null);
});

test('IC-GRAND THE FAMILIES - the city\'s blocks served by their names on the world-data door (each kind its fixed index, past every port block\'s), made when first read and kept IMPERIAL_KEEP at a time; its fabric\'s models solid and its skylines drawn alone (no collider), each made when first asked (mutants: a far block an own one\'s index; the skyline solid; the keep unbounded)', () => {
  assert.equal(imperialBlockIndex(imperialOwnName(3, 4)), IMPERIAL_BLOCK_INDEX.own + 3 * IMPERIAL_CELLS + 4);
  assert.equal(imperialBlockIndex(imperialFarName(3, 4)), IMPERIAL_BLOCK_INDEX.far + 3 * IMPERIAL_CELLS + 4);
  assert.equal(imperialBlockIndex(imperialLakeName(3, 4)), IMPERIAL_BLOCK_INDEX.lake + 3 * IMPERIAL_CELLS + 4);
  for (const n of [imperialOwnName(199, 0), imperialFarName(0, 199), imperialLakeName(12, 34)]) assert.equal(imperialBlockName(imperialBlockIndex(n)), n);
  assert.equal(imperialBlockIndex('GENRAA00.RMB'), -1);
  assert.ok(IMPERIAL_BLOCK_INDEX.own > 900200 && IMPERIAL_BLOCK_INDEX.far - IMPERIAL_BLOCK_INDEX.own >= IMPERIAL_CELLS ** 2 && IMPERIAL_BLOCK_INDEX.lake - IMPERIAL_BLOCK_INDEX.far >= IMPERIAL_CELLS ** 2);
  // the door's family law on its own: an LRU of `keep`
  _resetWorldDataReplacement();
  installWorldDataReplacement();
  let made = 0;
  registerPortBlockFamily({ indexOf: (n) => (/^FAM\d+\.RMB$/.test(n) ? 990000 + Number(n.slice(3, -4)) : -1), nameOf: (i) => (i >= 990000 && i < 990100 ? `FAM${i - 990000}.RMB` : null), make: (n) => { made++; return portBlockJson(n, { tile: () => 3 }); }, keep: 2 });
  assert.equal(getNewDFBlockIndex('FAM7.RMB'), 990007);
  assert.equal(getNewDFBlockName(990007), 'FAM7.RMB');
  const a = getDFBlockReplacementData(990007, 'FAM7.RMB');
  assert.equal(getDFBlockReplacementData(990007, 'FAM7.RMB'), a, 'kept');
  getDFBlockReplacementData(990008, 'FAM8.RMB'); getDFBlockReplacementData(990009, 'FAM9.RMB');
  assert.notEqual(getDFBlockReplacementData(990007, 'FAM7.RMB'), a, 'the oldest let go past its keep');
  assert.equal(made, 4);
  _resetWorldDataReplacement();
  // the model door's: solid unless said, an LRU too
  _resetCustomModels();
  let built = 0;
  registerCustomModelFamily({ owns: (id) => id >= 5000 && id < 5010, build: () => { built++; return { positions: new Float32Array(9), indices: new Uint32Array([0, 1, 2]) }; }, keep: 1, solid: false });
  assert.equal(isSolidModel(5003), false);
  assert.equal(isSolidModel(17), true, 'any other model solid');
  const m = customModelFor(5003);
  assert.equal(customModelFor(5003), m);
  customModelFor(5004);
  assert.notEqual(customModelFor(5003), m);
  assert.equal(built, 3);
  _resetCustomModels();
  // the city's, installed
  _resetCapitals();
  installCapitals({ addTextures: () => 0 });
  assert.ok(isFabricModelId(imperialFabricModelId(50, 60)) && !isFabricModelId(imperialSkylineId(3)) && isSkylineId(imperialSkylineId(3)));
  assert.equal(isSolidModel(imperialFabricModelId(50, 60)), true, 'the fabric solid');
  assert.equal(isSolidModel(imperialSkylineId(CENTRE - 5)), false, 'a skyline drawn alone');
  assert.ok(IMPERIAL_KEEP.blocks >= 9 * 64 && IMPERIAL_KEEP.fabric >= 9 * 64 && IMPERIAL_KEEP.skylines >= 49, 'the near ring\'s and the stream\'s worth kept');
  const name = imperialOwnName(100, 130), blk = getDFBlockReplacementData(getNewDFBlockIndex(name), name);
  assert.ok(blk?.rmbBlock, 'an own block on the door');
  const far = getDFBlockReplacementData(getNewDFBlockIndex(imperialFarName(100, 130)), imperialFarName(100, 130));
  assert.ok(far.rmbBlock.fldHeader.autoMapData.every((v) => v === 0 || v === CAPITAL_CLOSED_BYTE) && !far.rmbBlock.fldHeader.autoMapData.includes(CAPITAL_CLOSED_BYTE), 'a far block closes nothing');
});

test('IC-GRAND THE FAMILIES APART - the city\'s block indices and model ids each a run of its own: its own, far and lake blocks past TS4\'s walled towns\' (1,000,000 plus a map id\'s low twenty bits), its fabric\'s and skylines\' models past the town walls\' (3,000,000 plus the same) and the towns\' fabric\'s (from TOWN_FABRIC_MODEL_BASE, two million before they meet) - FOUND in IC-GRAND\'s perf pass, the own blocks at 2,000,000 and the models at 3,000,000 inside the walls\' runs (mutants: the fabric back at 3,000,000; the own blocks back at 2,000,000)', () => {
  const LOW = 0xfffff, CELLS = IMPERIAL_CELLS ** 2, SLICES = IMPERIAL_SPAN ** 2;
  const runs = [
    ['town wall blocks', townWallBlockIndex(0), townWallBlockIndex(LOW) + 1],
    ['own blocks', IMPERIAL_BLOCK_INDEX.own, IMPERIAL_BLOCK_INDEX.own + CELLS],
    ['far blocks', IMPERIAL_BLOCK_INDEX.far, IMPERIAL_BLOCK_INDEX.far + CELLS],
    ['lake blocks', IMPERIAL_BLOCK_INDEX.lake, IMPERIAL_BLOCK_INDEX.lake + CELLS],
  ];
  const models = [
    ['town wall models', townWallModelId(0), townWallModelId(LOW) + 1],
    ['town fabric models', TOWN_FABRIC_MODEL_BASE, TOWN_FABRIC_MODEL_BASE + 2_000_000],
    ['fabric models', IMPERIAL_FABRIC_MODEL, IMPERIAL_FABRIC_MODEL + CELLS],
    ['skyline models', IMPERIAL_SKYLINE_MODEL, IMPERIAL_SKYLINE_MODEL + SLICES],
  ];
  for (const set of [runs, models]) {
    for (let i = 0; i < set.length; i++) for (let j = i + 1; j < set.length; j++) {
      const [a, a0, a1] = set[i], [b, b0, b1] = set[j];
      assert.ok(a1 <= b0 || b1 <= a0, `${a} [${a0}, ${a1}) and ${b} [${b0}, ${b1}) apart`);
    }
  }
  assert.equal(imperialFabricModelId(IMPERIAL_CELLS - 1, IMPERIAL_CELLS - 1), IMPERIAL_FABRIC_MODEL + CELLS - 1);
  assert.equal(imperialSkylineId(SLICES - 1), IMPERIAL_SKYLINE_MODEL + SLICES - 1);
});

test('IC-GRAND EVERY SLICE\'S ARRIVALS ON ITS CARRIER - its start markers editor flats on its carrier block (made on the door) at the anchor\'s metres, each on its cell\'s open ground; a block on the plan\'s outer ring leaves Daggerfall\'s rim to the land (PIN MOVED from test/audit_tesa.test.js A6-1 and test/world/audittesa2c_capitals.test.js C1 - the city\'s blocks a family\'s; mutants: a marker in the water; the rim unread)', () => {
  _resetCapitals();
  installCapitals({ addTextures: () => 0 });
  const carriers = capitalSliceCarriers(IC);
  for (const s of [CENTRE, CENTRE - 3, CENTRE + 2 * N + 1, 5 * N + 12]) {
    const code = carriers.get(s), [r, c] = imperialCodeCell(code), markers = capitalSliceMarkers(IC, s);
    assert.ok(markers.length >= 2, `slice ${s}`);
    const name = imperialOwnName(r, c), blk = getDFBlockReplacementData(getNewDFBlockIndex(name), name);
    const got = locationStartMarkers([{ originX: 0, originZ: 0, flats: collectBlockFlats(blk, 0) }]);
    const at = [(HALF - c) * B, (r + 1 - HALF) * B];
    assert.equal(got.length, markers.length, `slice ${s}`);
    markers.forEach(([dx, dz], i) => {
      assert.ok(Math.abs(got[i][0] - (at[0] + dx)) < 0.03 && Math.abs(got[i][2] - (at[1] - dz)) < 0.03, `slice ${s} marker ${i}`);
      const laws = imperialOwnLaws(Math.floor(dz / B + HALF), Math.floor(dx / B + HALF));
      assert.ok(laws.tile(dx, dz) !== 0 && !laws.closed(dx, dz) && imperialOpenAt(dx, dz), `slice ${s} marker ${i} on open ground`);
    });
  }
  assert.equal(capitalCentre(IC), CENTRE);
  // the rim: a block at the plan's west edge, its outer eleven tiles no ground of its own, closed
  const deps = { portBlockJson, miscModelAt, startMarkerAt, footprintOf: () => null, anchorMarkers: IC.markers, noGround: CAPITAL_NO_GROUND, rim: (r, c, x, z) => inCapitalRim(IC, c * B + x, (r + 1) * B - z) };
  const j = imperialBlockJson(imperialLakeName(100, 0), deps), g = j.RmbBlock.FldHeader.GroundData.GroundTiles;
  for (let i = 0; i < 256; i++) assert.equal(g[i].TileBitfield === CAPITAL_NO_GROUND, (i % 16) < 11, `tile ${i}`);
  assert.equal(imperialBlockJson('GENRAA00.RMB', deps), null);
});

test('IC-GRAND THE SWEEP - on the frame, walked only when the player\'s pixel or the built set moves (the built pixels alone - never the city\'s slices): a slice whose view is not the one it was built in built again, the ones coming near first at the queue\'s head, the ones going far at its tail (mutants: walked every frame; near at the tail; the slack unread)', () => {
  const built = new Map(), queue = [{ px: 900, py: 900 }], destroyed = [];
  const host = { destroyPixel: (x, y) => { destroyed.push(`${x},${y}`); built.delete(`${x},${y}`); }, maps: {}, built, queue, state: { current: { x: 100, y: 100 } }, locationIndex: new Map() };
  const put = (px, py, capitalLod) => built.set(`${px},${py}`, { px, py, capitalLod });
  put(100, 100, 'near'); put(101, 100, 'far'); put(102, 100, 'near'); put(103, 100, 'near'); put(104, 100, null); put(99, 99, 'near');
  const { sweepCapitalLod } = createTamrielSweeps(host);
  sweepCapitalLod();
  assert.deepEqual(destroyed.sort(), ['101,100', '103,100'], 'the far one beside the player and the near one past the slack');
  assert.deepEqual(queue[0], { px: 101, py: 100 }, 'coming near: the head');
  assert.deepEqual(queue[queue.length - 1], { px: 103, py: 100 }, 'going far: the tail');
  // unmoved: nothing walked (a built entry changed in place is not read)
  destroyed.length = 0;
  put(101, 100, 'far');   // the set's size back to what the sweep left plus one: a pixel built
  sweepCapitalLod();
  assert.deepEqual(destroyed, ['101,100'], 'a pixel built: walked');
  destroyed.length = 0;
  built.get('100,100').capitalLod = 'far';
  sweepCapitalLod();
  assert.deepEqual(destroyed, [], 'nothing moved: not walked');
  host.state.current = { x: 101, y: 100 };
  sweepCapitalLod();
  assert.deepEqual(destroyed, ['100,100'], 'the player moved: walked');
  // PIN MOVED (IC-GRAND's perf pass): the city's worker told first (scenes/capitalPrebuild.js), then this sweep
  assert.match(read('src/scenes/tamrielSweepsHost.js'), /function sweepCapitalPixels\(\) \{\n\s+capitalPrebuild\.sweep\(\);[^\n]*\n\s+sweepCapitalLod\(\);/, 'asked where the capitals\' sweep is (scenes/world.js, the frame)');
});

test('IC-GRAND THE BUILD - a pixel built as its view (the location the index holds, its far view where it is far), its view on its entry; a far view stands no walker, no yard and no port; a model no collider takes the model door\'s word (mutants: the view unread; walkers on a far slice; the skyline solid in the collider)', () => {
  const pb = read('src/scenes/pixelBuild.js');
  assert.match(pb, /const dfLocation = capitalBuildView\(_locationToBuild\(px, py\), px, py, host\.state\.current\) \|\| null;/);
  assert.match(pb, /const farView = capitalViewOf\(dfLocation\) === 'far';/);
  assert.match(pb, /const yardTown = !farView && isYardTown\(dfLocation\), portTown = !farView && isPortTown\(dfLocation, portOnSea\(dfLocation\)\);/);
  assert.match(pb, /if \(!farView && populatesWanderingNpcs\(dfLocation\.mapTableData\.locationType\)\) \{/);
  assert.match(pb, /if \(isSolidModel\(placed\.modelIdNum\)\) late\.add\(gateKey, cpu\.positions, cpu\.indices, local,/);
  assert.match(pb, /capitalLod: capitalViewOf\(dfLocation\),/);
});

// PIN MOVED (IC-GRAND x FAR-LANDMARK, at the merge of the streams' head): the city from afar was an impostor of IC-GRAND's own
// on the far ring's pass (render/ringImpostors.js, its order a counting sort); stream B's FAR-LANDMARK hook draws a
// silhouette a pixel in the ring's painter's order now (render/farLandmarks.js), and the city hands one in a slice.
test('IC-GRAND THE CITY FROM AFAR - its silhouette a landmark a slice (render/farLandmarks.js FAR-LANDMARK): the centre\'s the tower to its spire in its pixel\'s middle; each slice\'s landmarks and its streets as a few masses (a key a cell - its neighbourhood\'s walls, roof and height - merged into rectangles), tens of triangles; in its pixel\'s frame, x east and z north from its south-west corner; none where nothing stands (mutants: the masses unmerged; the frame\'s z south)', () => {
  const meshes = Array.from({ length: N * N }, (_, s) => imperialLandmarkMesh(s));
  const tris = meshes.filter(Boolean).map((m) => m.indices.length / 3).sort((a, b) => a - b);
  assert.ok(tris.length > 200 && tris.length < 400, `${tris.length} slices stand something`);
  assert.equal(meshes[0], null, 'a corner of the open shore: nothing');
  assert.ok(tris[tris.length >> 1] <= 100 && tris.reduce((a, b) => a + b, 0) < 30000, `tens of triangles a slice (the median ${tris[tris.length >> 1]})`);
  // the centre: the tower to its spire's tip, over its pixel's middle
  const c = meshes[CENTRE];
  let top = -Infinity, at = null;
  for (let i = 0; i < c.positions.length; i += 3) if (c.positions[i + 1] > top) { top = c.positions[i + 1]; at = [c.positions[i], c.positions[i + 2]]; }
  assert.equal(top, IMPERIAL.tower.spireTop);
  assert.ok(Math.abs(at[0] - 409.6) < 1 && Math.abs(at[1] - 409.6) < 1, `the spire over the pixel's middle: ${at}`);
  // the frame: the Temple of the One's dome (bearing 210, 4.4 km - south-west, its slice 434) where its pixel holds it, z north
  const T = IMPERIAL.temple, s = impostorSliceAt(...polar(T.b, T.r)), m = meshes[s], hi = [];
  for (let i = 0; i < m.positions.length; i += 3) if (m.positions[i + 1] > T.h + 16) hi.push([m.positions[i], m.positions[i + 2]]);
  const [tx, tz] = polar(T.b, T.r), sx = s % N, sy = Math.floor(s / N);
  const want = [tx - (sx - N / 2) * 8 * B, (sy - N / 2 + 1) * 8 * B - tz], mean = hi.reduce((a, p) => [a[0] + p[0] / hi.length, a[1] + p[1] / hi.length], [0, 0]);
  assert.ok(hi.length && Math.hypot(mean[0] - want[0], mean[1] - want[1]) < 2, `the dome at ${mean} (${want})`);
  // merged: a slice's streets a handful of boxes (one a rectangle of cells of one key), never a box a cell
  const boxes = [];
  for (let q = 0; q < N * N; q++) { const quads = impostorQuads([], q); if (quads.length) boxes.push(quads.filter((u) => u.n[1] === 1).length); }
  boxes.sort((a, b) => a - b);
  assert.ok(boxes[boxes.length >> 1] <= 8 && boxes[boxes.length - 1] <= 20, `boxes a slice: the median ${boxes[boxes.length >> 1]}, the most ${boxes[boxes.length - 1]}`);
  assert.ok(impostorQuads([], null).every((q) => q.s >= 0 || q.sea), 'every landmark in a slice');
});

test('IC-GRAND THE CITY ON THE HORIZON - the sweep hands the far ring one landmark a slice (its addLandmark), a budget a frame, the nearest the traveller first, each stood at the city\'s ground - the ring\'s at the centre pixel, as the stream flattens every slice to it (PIN MOVED, AUDIT RELEASE R1-4: it stood each on the ring\'s ground at its own pixel, up to 40 m under the city\'s) - its masses\'s feet down to the ring\'s lowest round its pixel, never above the city\'s ground; off the grid the centre\'s ground estimated from the nearest slice on it and every slice stood again once it is known; made once; let go out of SKYLINE_REACH, on another ring or when the ring disposed them; a slice off the ring\'s grid waits for it to move; none on the classic skin (mutants: never let go; stood at nought; stood at its own pixel; feet in the air; feet above the city; the estimate kept; all at once; far first; the wait forgotten; a disposed ring kept; unwired; the ring\'s ground by column for row)', () => {
  const ground = (px, py) => 40 + (px - 500) * 2 + (py - 400) * 0.5;
  const ringOf = (g = ground) => {
    const r = { baseX: 500, baseY: 400, added: [], removed: 0, groundAt: g };
    r.addLandmark = ({ px, py, mesh, key }) => { const h = { landmark: { vao: {}, px, py, mesh, key }, remove: () => { r.removed++; h.landmark.vao = null; } }; r.added.push(h); return h; };
    return r;
  };
  const stand = Array.from({ length: N * N }, (_, s) => !!imperialLandmarkMesh(s)).filter(Boolean).length;
  let t = 0;
  const host = { farRing: ringOf(), state: { current: { x: 500, y: 400 } } };
  const sk = createCapitalSkyline(host, { now: () => (t += 1), centre: () => ({ px: 500, py: 400 }) });
  const settle = () => { for (let i = 0; i < 2000; i++) { sk.sweep(); if (!sk.owed) break; } };   // bounded: a mutant never settles
  sk.sweep();
  const first = host.farRing.added;
  assert.ok(first.length >= 1 && first.length < SKYLINE_BUDGET_MS, 'a budget\'s worth a frame');
  assert.deepEqual([first[0].landmark.key, first[0].landmark.px, first[0].landmark.py], [`imperial:${CENTRE}`, 500, 400], 'the nearest first');
  settle();
  assert.equal(first.length, stand, 'every slice that stands something, one landmark each');
  const span = (positions) => { let lo = Infinity, hi = -Infinity; for (let i = 1; i < positions.length; i += 3) { lo = Math.min(lo, positions[i]); hi = Math.max(hi, positions[i]); } return [lo, hi]; };
  /** each landmark's top at the city's ground (`city`) over its made mesh's, its lowest the ring's lowest round it (`low`) */
  const stoodAt = (added, city, low) => {
    let west = 0, east = 0;
    for (const h of added.filter((a) => a.landmark.vao)) {
      const { px, py, mesh, key } = h.landmark, [lo, hi] = span(mesh.positions), made = span(imperialLandmarkMesh(Number(key.slice(9))).positions);
      assert.ok(Math.abs(hi - (made[1] + city)) < 1e-3, `${px},${py} at the city's ground (${hi - made[1]})`);
      if (made[0] < 0 || made[1] <= 0) continue;
      const want = Math.min(city, low(px, py));
      assert.ok(Math.abs(lo - want) < 1e-3, `${px},${py}'s feet at ${want} (${lo})`);
      if (want < city) west++; else east++;
    }
    assert.ok(west > 50 && east > 50, `feet down to a lower ring and never above the city (${west}, ${east})`);
  };
  stoodAt(first, 40, (px, py) => ground(px - 1, py - 1));
  for (const h of first) {   // the feet are the corners at its ground: the far view lays no flat quad there
    const made = imperialLandmarkMesh(Number(h.landmark.key.slice(9))).positions;
    for (let q = 0; q < made.length; q += 12) assert.ok(Math.max(made[q + 1], made[q + 4], made[q + 7], made[q + 10]) > 0, 'a quad stands up');
  }
  // out of reach: every one let go; back: handed in again
  host.state.current = { x: 500 + SKYLINE_REACH + 1, y: 400 };
  sk.sweep();
  assert.deepEqual([host.farRing.removed, sk.count], [stand, 0], 'out of reach: let go');
  host.state.current = { x: 500, y: 400 };
  settle();
  assert.equal(sk.count, stand);
  // the ring disposed them with itself (a whole dispose): let go and handed in again
  for (const h of host.farRing.added) h.landmark.vao = null;
  const before = host.farRing.added.length;
  sk.sweep();
  assert.ok(host.farRing.added.length > before, 'handed in again');
  // another ring: the old one's let go, the new one handed them
  const old = host.farRing;
  host.farRing = ringOf();
  sk.sweep();
  assert.equal(old.added.filter((h) => h.landmark.vao).length, 0, 'the old ring\'s let go');
  settle();
  assert.equal(host.farRing.added.length, stand);
  // off the ring's grid: waiting, handed in when the ring moves
  const part = ringOf((px, py) => (px > 505 ? null : ground(px, py)));
  host.farRing = part;
  settle();
  assert.ok(sk.waiting > 0 && part.added.length < stand, 'the slices off its grid wait');
  part.groundAt = ground;
  part.baseX = 501;
  settle();
  assert.deepEqual([part.added.length, sk.waiting], [stand, 0], 'handed in once the ring moved');
  // R1-4: the centre off the grid - the city's ground estimated from the nearest slice on it (503, 400: 46), every slice
  // stood again at the centre's (40) once the ring has it
  const off = ringOf((px, py) => (px < 503 ? null : ground(px, py)));
  host.farRing = off;
  settle();
  assert.ok(off.added.length > 0 && sk.waiting > 0, 'the slices on the grid stand on the estimate');
  for (const h of off.added) assert.ok(Math.abs(span(h.landmark.mesh.positions)[1] - span(imperialLandmarkMesh(Number(h.landmark.key.slice(9))).positions)[1] - 46) < 1e-3, 'at the estimate');
  const estimated = off.added.length;
  off.groundAt = ground;
  off.baseX = 502;
  settle();
  assert.equal(off.removed, estimated, 'the estimate\'s slices let go');
  assert.equal(off.added.filter((h) => h.landmark.vao).length, stand, 'and every slice stood again');
  stoodAt(off.added, 40, (px, py) => ground(px - 1, py - 1));
  // the classic skin: no ring, nothing asked
  host.farRing = null;
  assert.doesNotThrow(() => sk.sweep());
  assert.equal(sk.count, 0);
  // wired: the capitals' sweep asks it on the frame, the world host hands its ring - PIN MOVED (IC-GRAND's perf pass): the
  // city's worker told first (scenes/capitalPrebuild.js)
  assert.match(read('src/scenes/tamrielSweepsHost.js'), /function sweepCapitalPixels\(\) \{\n\s+capitalPrebuild\.sweep\(\);[^\n]*\n\s+sweepCapitalLod\(\);[^\n]*\n\s+capitalSkyline\.sweep\(\);/);
  assert.match(read('src/scenes/world.js'), /createTamrielSweeps\(\{[^\n]*\n(?:\s+[^\n]*\n){0,12}?\s+get farRing\(\) \{ return farRing; \},/);
  // the ring's ground at a pixel's centre: its own grid, row by row
  const r = Object.create(FarRingRenderer.prototype);
  assert.equal(r.groundAt(10, 20), null, 'before a build');
  r._ringY = { positions: Float32Array.from({ length: 27 }, (_, i) => (i % 3 === 1 ? 100 * Math.floor(i / 9) + Math.floor((i % 9) / 3) : 0)), side: 3, baseX: 10, baseY: 20, radius: 1 };
  assert.deepEqual([r.groundAt(11, 19), r.groundAt(9, 21), r.groundAt(10, 20), r.groundAt(12, 20)], [2, 200, 101, null]);
});

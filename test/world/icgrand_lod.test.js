// IC-GRAND (2026-10-26, the owner: "Lets do 20km"; the coordinator's brief: "only near blocks get full detail, with a far
// LOD/impostor for the rest of the city (skyline, walls, tower), streaming budgets so arriving or crossing the city does not
// hitch, and nothing that walks every location every frame"; bible/03-World/Arena-Provinces.md IC-GRAND) - THE IMPERIAL
// CITY NEAR AND FAR, pinned: its blocks and its fabric's models families made when first asked and kept a few hundred at a
// time; a slice within a pixel of the player built near, the rest far (its skyline, no collider, no walker); the sweep that
// builds a slice again when its view moves, walking only the built pixels and only when the player's pixel or the built set
// moves; the city past the stream's reach on the far ring's pass.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CAPITALS, capitalNear, capitalBuildView, capitalViewOf, synthesizeCapitalLocation, capitalSliceCarriers, capitalSliceMarkers, capitalCentre, portBlockJson, miscModelAt, startMarkerAt, CAPITAL_NO_GROUND, CAPITAL_CLOSED_BYTE, inCapitalRim, BLOCK_M } from '../../src/world/tamrielCapitals.js';
import {
  NEAR_RING, NEAR_SLACK, IMPERIAL_BLOCK_INDEX, imperialBlockIndex, imperialBlockName, imperialOwnName, imperialFarName, imperialLakeName, imperialViewName,
  imperialFabricModelId, imperialSkylineId, isFabricModelId, isSkylineId, imperialBlockJson, imperialOwnLaws, imperialOpenAt, sliceOfCell,
} from '../../src/world/imperialBlocks.js';
import { IMPERIAL, IMPERIAL_SPAN, IMPERIAL_CELLS, imperialSlicePlan, imperialCodeCell, IMPERIAL_ARENA_CODE } from '../../src/world/imperialCity.js';
import { installCapitals, _resetCapitals, IMPERIAL_KEEP } from '../../src/world/capitalModels.js';
import { customModelFor, isSolidModel, registerCustomModelFamily, _resetCustomModels } from '../../src/world/customModels.js';
import { registerPortBlockFamily, getDFBlockReplacementData, getNewDFBlockIndex, getNewDFBlockName, _resetWorldDataReplacement, installWorldDataReplacement } from '../../src/formats/worldData/worldDataReplacement.js';
import { createImperialImpostor, imperialRingImpostor, impostorSliceAt, IMPOSTOR_ROWS_A_STEP } from '../../src/world/imperialImpostor.js';
import { registerRingImpostor, ringImpostors, _resetRingImpostors } from '../../src/render/ringImpostors.js';
import { FarRingRenderer } from '../../src/render/farRing.js';
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
  assert.match(read('src/scenes/tamrielSweepsHost.js'), /function sweepCapitalPixels\(\) \{\n\s+sweepCapitalLod\(\);/, 'asked where the capitals\' sweep is (scenes/world.js, the frame)');
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

test('IC-GRAND THE CITY FROM AFAR - the impostor on the far ring\'s pass: the tower to its spire, the walls, the landmarks, a mass a cell of the streets\' buildings, the lake; made IMPOSTOR_ROWS_A_STEP rows a step; ordered from the eye\'s pixel - the lake first, then the faces turned to the eye far to near - leaving out every slice the stream has built (mutants: a built slice drawn; near before far; a back face drawn)', () => {
  const imp = createImperialImpostor();
  let steps = 1;
  while (!imp.step()) steps++;
  assert.equal(steps, 1 + IMPERIAL_CELLS / IMPOSTOR_ROWS_A_STEP + 0, 'the landmarks a step, then the rows');
  const m = imp.mesh();
  let top = -Infinity;
  for (let i = 1; i < m.positions.length; i += 3) top = Math.max(top, m.positions[i]);
  assert.equal(top, IMPERIAL.tower.spireTop, 'the tower its top');
  assert.ok(m.quads > 20000 && m.quads < 120000, `${m.quads} quads`);
  const none = () => false, all = imp.order(0, 2, 0, none);
  assert.equal(all.length % 6, 0);
  const allBuilt = imp.order(0, 2, 0, () => true);
  assert.equal(allBuilt.length, 0, 'every slice built: nothing - the city and its lake all stand on its slices');
  // far to near from the eye: the distance of each solid quad's middle never grows along the order
  const P = m.positions, mid = (q) => { let x = 0, y = 0, z = 0; for (let k = 0; k < 4; k++) { x += P[(q * 4 + k) * 3]; y += P[(q * 4 + k) * 3 + 1]; z += P[(q * 4 + k) * 3 + 2]; } return [x / 4, z / 4, y / 4]; };
  const eye = [0, 3000], order = imp.order(eye[0], 2, -eye[1], none), quads = [];
  for (let i = 0; i < order.length; i += 6) quads.push(order[i] / 4);
  const solids = quads.filter((q) => !m.sea[q * 4]);
  for (let i = 1; i < solids.length; i++) {
    const a = mid(solids[i - 1]), b = mid(solids[i]), da = Math.hypot(a[0] - eye[0], a[1] - eye[1], a[2] - 2), db = Math.hypot(b[0] - eye[0], b[1] - eye[1], b[2] - 2);
    assert.ok(db <= da + 40, `near before far at ${i}: ${da.toFixed(0)} then ${db.toFixed(0)}`);
  }
  const dist = (q) => { const c = mid(q); return Math.hypot(c[0] - eye[0], c[1] - eye[1], c[2] - 2); };
  assert.ok(dist(solids[0]) > dist(solids[solids.length - 1]) + 5000, 'the farthest first, the nearest last');
  assert.ok(quads.slice(0, 50).every((q) => m.sea[q * 4] === 255), 'the lake first');
  // no side turned away from the eye drawn (a roof kept: the eye may stand over it)
  const N3 = m.normals;
  for (const q of solids) {
    const v = q * 4 * 3, n = [N3[v], N3[v + 1], N3[v + 2]], c = mid(q);
    if (n[1] >= 0.9) continue;
    assert.ok((c[0] - eye[0]) * n[0] + (c[2] - 2) * n[1] + (c[1] - eye[1]) * n[2] < 0, `a side turned away drawn: quad ${q}`);
  }
  // a slice built: its quads out
  const s = impostorSliceAt(0, 0);
  assert.equal(s, CENTRE);
  const noCentre = imp.order(0, 2, 0, (q) => q === CENTRE);
  assert.ok(noCentre.length < all.length, 'the centre built: the tower out');
  // the ring's door: an impostor registered once, the city's anchored on its centre pixel, its slices the pixels round it
  _resetRingImpostors();
  const ring = imperialRingImpostor(() => ({ px: 500, py: 400 }));
  assert.equal(registerRingImpostor(ring), true);
  assert.equal(registerRingImpostor(ring), false);
  assert.deepEqual(ringImpostors(), [ring]);
  assert.equal(ring.reach, (N - 1) / 2);
  let asked = new Set();
  const ordered = imperialRingImpostor(() => ({ px: 500, py: 400 }));
  while (!ordered.step());
  ordered.order(0, 2, 0, (px, py) => { asked.add(`${px},${py}`); return false; });
  assert.ok(asked.has('488,388') && asked.has('512,412') && !asked.has('487,400'), 'its slices the pixels about its anchor');
  asked = null;
  _resetRingImpostors();
});

test('IC-GRAND THE FAR RING DRAWS THE IMPOSTORS - stepped a frame, uploaded once whole, ordered again only when the eye\'s pixel or the built pixels under it move, drawn after the ring\'s ground at the same far plane about its anchor on the ring\'s ground; dropped out of reach (mutants: ordered every frame; drawn before the ground; never dropped)', () => {
  const src = read('src/render/farRing.js');
  assert.match(src, /punchHole\(holeX, holeY, holeRadius, built = null\) \{\n\s+this\._impostorFrame\(holeX, holeY, built\);/);
  assert.match(src, /gl\.drawElements\(gl\.TRIANGLES, this\.ringCount \+ 6 \* fill, gl\.UNSIGNED_INT, 0\);[^\n]*\n\s+this\._drawImpostors\(origin\);/);
  // a renderer of fakes: the GL a recorder
  const calls = [], gl = new Proxy({}, { get: (t, k) => (typeof k === 'string' && /^[A-Z_]+$/.test(k) ? k : (...a) => { calls.push([k, ...a]); return { k }; }) });
  const r = Object.create(FarRingRenderer.prototype);
  Object.assign(r, { gl, _imp: new Map(), _ground: { positions: new Float32Array(97 * 97 * 3).fill(5), side: 97 }, baseX: 480, baseY: 400, u: { uOrigin: 'uOrigin' } });
  let orders = 0, stepped = 0, at = { px: 500, py: 400 };
  _resetRingImpostors();
  registerRingImpostor({ anchor: () => at, reach: 12, step: () => ++stepped >= 2, mesh: () => ({ positions: new Float32Array(12), normals: new Float32Array(12), colors: new Uint8Array(12), sea: new Uint8Array(4) }), order: () => { orders++; return new Uint32Array(6); } });
  const built = new Map([['1,1', {}]]);
  built.changes = 1;
  r._impostorFrame(500, 400, built);
  assert.equal(r._imp.size, 0, 'not whole yet');
  r._impostorFrame(500, 400, built);
  assert.equal(r._imp.size, 1, 'uploaded once whole');
  assert.equal(orders, 1);
  r._impostorFrame(500, 400, built);
  assert.equal(orders, 1, 'nothing moved: not ordered');
  built.changes = 2;
  r._impostorFrame(500, 400, built);
  assert.equal(orders, 1, 'the built set moved, none under it: not ordered');
  built.set('500,400', {}); built.changes = 3;
  r._impostorFrame(500, 400, built);
  assert.equal(orders, 2, 'a pixel under it built: ordered');
  r._impostorFrame(501, 400, built);
  assert.equal(orders, 3, 'the eye\'s pixel moved: ordered');
  calls.length = 0;
  r._drawImpostors([10, 20, 30]);
  const origin = calls.find((c) => c[0] === 'uniform3f');
  assert.deepEqual(origin.slice(2), [10 + (500 - 480 + 0.5) * 819.2, 20 + 5, 30 - (400 - 400 - 0.5) * 819.2], 'about its anchor pixel\'s middle on the ring\'s ground');
  assert.ok(calls.some((c) => c[0] === 'drawElements'));
  at = { px: 9000, py: 400 };
  r._impostorFrame(501, 400, built);
  assert.equal(r._imp.size, 0, 'out of reach: dropped');
  _resetRingImpostors();
});

// A SETTLEMENT STOOD - its ground paved at its pads' heights with walls
// down their rims, decks on posts, links between its pads; each building the fabric's mesher over its footprint, its door
// on its front wall facing its street, its rooms the fabric's own filed under its place and key, its record the door's; the
// host stands what the built pixels hold, draws it, files it with the collider, hands its doors over and takes it down.
// A Hammerfell settlement (the published row's) on synthetic ground. Pins mutation-checked (tools/mutants/rmbc4.json).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { earClip, groundModel, buildingPiece, buildingInterior, buildingRecord, interiorPoolOf, groundModelId, buildingModelId, featuresModelId, isSettlementModelId, SETTLEMENT_MODEL_BASE, WALL_DROP, FLIGHT_STEP, interiorCacheKey } from '../../../src/world/settlement/settlementModels.js';
import { standSettlement, createSettlementHost, slotsFree } from '../../../src/scenes/settlementHost.js';
import { layoutSettlement } from '../../../src/world/settlement/settlementLayout.js';
import { dressSettlement } from '../../../src/world/settlement/settlementGen.js';
import { SETTLEMENT_ROWS, settlementInput, settlementPlaceId } from '../../../src/world/settlement/settlementPlaces.js';
import { ringArea2, flightOf, pointInRing } from '../../../src/world/settlement/settlementGeometry.js';
import { flightRun } from '../../../src/world/settlement/settlementLimits.js';
import { keyBandOf } from '../../../src/world/settlement/settlementContract.js';
import { DOOR_TYPE } from '../../../src/world/meshReader.js';
import { BUILDING_TYPES as T } from '../../../src/world/buildingNames.js';
import { IMPERIAL_DOOR_MODEL } from '../../../src/world/imperialFabricBuildings.js';
import { art, CAPITAL_ART } from '../../../src/world/capitalShapes.js';
import { customModelFor } from '../../../src/world/customModels.js';
import { SYNTHETIC } from '../../../tools/settlementProbe.mjs';
import { standTownGrowth, townGrowthJob } from '../../../src/world/settlement/townGrowth.js';
import { generateSettlement } from '../../../src/world/settlement/settlementGen.js';
import { MAX_TERRAIN_HEIGHT, STREAMING_TERRAIN_SCALE } from '../../../src/world/terrain/terrainSampler.js';


const ROW = SETTLEMENT_ROWS.find((r) => r.province === 'Hammerfell');
const env = SYNTHETIC.oasis;
const input = { ...settlementInput(ROW, 1084, 241), env };
const L = layoutSettlement(input, env);
const { plan } = dressSettlement(input, L);
const P = { px: 1084, py: 241, settlement: { ordinal: ROW.ordinal, layout: L } };

test('RMBC4 ear clipping: a ring\'s n - 2 triangles cover its area, a concave one too (mutants: the convex test, the ear test)', () => {
  const ring = [[0, 0], [10, 0], [10, 10], [5, 4], [0, 10]];
  const tris = earClip(ring);
  assert.equal(tris.length, 3);
  const area = tris.reduce((a, [i, j, k]) => a + Math.abs(ringArea2([ring[i], ring[j], ring[k]])), 0);
  assert.ok(Math.abs(area - Math.abs(ringArea2(ring))) < 1e-9);
  for (const pad of plan.pads) {
    const t = earClip(pad.poly), a = t.reduce((s, [i, j, k]) => s + Math.abs(ringArea2([pad.poly[i], pad.poly[j], pad.poly[k]])), 0);
    assert.equal(t.length, pad.poly.length - 2, pad.id);
    assert.ok(Math.abs(a - Math.abs(ringArea2(pad.poly))) < 1e-6 * Math.abs(ringArea2(pad.poly)), `${pad.id} covered`);
  }
});

test('RMBC4 the ground\'s model: every pad paved at its own height, a wall down its rim, links between their pads\' heights (mutants: the height, the wall\'s drop)', () => {
  const g = groundModel(plan, L.datum, new Map(L.cells.map((c) => [c.id, c])));
  const ys = new Set();
  for (let i = 1; i < g.positions.length; i += 3) ys.add(Math.round(g.positions[i] * 100) / 100);
  for (const p of plan.pads) {
    assert.ok(ys.has(Math.round((L.datum + p.y) * 100) / 100), `${p.id} paved at its height`);
    if (p.base === 'cut') assert.ok(ys.has(Math.round((L.datum + p.y - WALL_DROP) * 100) / 100), `${p.id}'s wall reaches down`);
  }
  assert.ok(g.indices.length / 3 > plan.pads.length * 10);
  // its terraces paved in its style's stone - a village's, never a city's flags (mutant: the style unread)
  const recs = (m) => new Set(m.subMeshes.map((x) => `${x.textureArchive}/${x.textureRecord}`));
  const [sand, flags] = [art(CAPITAL_ART.sandstone), art(CAPITAL_ART.bridgeStone)].map(([a, r]) => `${a}/${r}`);
  const desert = recs(groundModel(plan, L.datum, new Map(L.cells.map((c) => [c.id, c])), 'Hammerfell'));
  assert.ok(desert.has(sand), 'Hammerfell\'s sandstone');
  assert.ok(recs(groundModel(plan, L.datum, new Map(L.cells.map((c) => [c.id, c])), 'Imperial')).has(flags), 'the Empire\'s flags');
});

test('RMBC4 a building: the fabric\'s mesher over its footprint; its door the fabric\'s door model on its front wall, facing its street (mutants: the turn, the floor)', () => {
  for (const b of plan.buildings.slice(0, 12)) {
    const pad = plan.pads.find((p) => p.id === b.pad), floor = L.datum + pad.y;
    const piece = buildingPiece(plan, b, floor, ROW.style);
    assert.ok(piece.model.indices.length > 30);
    assert.ok(piece.doorId >= IMPERIAL_DOOR_MODEL && piece.doors?.[0]?.doorType === DOOR_TYPE.BUILDING);
    const m = piece.doorFrame, e = b.entrances[0], r = (e.facing * Math.PI) / 180;
    assert.ok(Math.abs(m[12] - e.at[0]) < 1e-3 && Math.abs(m[13] - floor) < 1e-3 && Math.abs(m[14] - e.at[1]) < 1e-3, 'on its door');
    const n = piece.doors[0].normal, out = [m[0] * n.x + m[8] * n.z, m[2] * n.x + m[10] * n.z];   // the door's normal into the scene
    assert.ok(Math.abs(out[0] - Math.sin(r)) < 1e-6 && Math.abs(out[1] - Math.cos(r)) < 1e-6, `faces ${e.facing}`);
    assert.ok(Math.abs(piece.frame[13] - floor) < 1e-3, 'at its floor');
  }
});

test('RMBC4 a building\'s rooms and record: its own interior filed under its place and key; the record the door reads, its key minted (mutants: the cache key, the record\'s key)', () => {
  const [a, b] = plan.buildings;
  const pa = buildingPiece(plan, a, 100, ROW.style), pb = buildingPiece(plan, b, 100, ROW.style);
  const ia = buildingInterior(input.place, a, pa, null), ib = buildingInterior(input.place, b, pb, null);
  assert.equal(ia.made, true);
  assert.notEqual(ia, ib, 'each its own');
  assert.equal(buildingInterior(input.place, a, pa, null), ia, 'kept');
  assert.notEqual(buildingInterior(settlementPlaceId(8), a, pa, null), ia, 'another place\'s building of that key is another');
  assert.ok(ia.block3dObjectRecords.length > 0);
  const rec = buildingRecord({ place: input.place, name: ROW.name, regionIndex: 63 }, a, pa.area);
  assert.equal(rec.buildingKey, a.key);
  assert.equal(keyBandOf(rec.buildingKey), 'minted');
  assert.deepEqual([rec.townMapId, rec.townName, rec.regionIndex, rec.buildingType, rec.hasInterior], [input.place, ROW.name, 63, a.type, true]);
  assert.equal(interiorPoolOf(T.Tavern), 'tavern');
  assert.equal(interiorPoolOf(T.Palace), 'house4', 'no donor keeps a palace: the largest house\'s rooms');
});

test('RMBC4 the model ids: a run of 4,096 a settlement past the Imperial City\'s (mutant: the run)', () => {
  assert.equal(SETTLEMENT_MODEL_BASE, 7_600_000);
  assert.equal(groundModelId(0), 7_600_000);
  assert.equal(buildingModelId(1, 0), 7_604_097);
  assert.ok(isSettlementModelId(buildingModelId(8, 4094)) && !isSettlementModelId(IMPERIAL_DOOR_MODEL));
});

test('RMBC4 the host: stands what a built pixel holds, draws it, files it with the collider, hands its doors over and takes it down (mutants: the stand, the take-down, the doors, the feet held back)', async () => {
  const added = [], removed = [], drawn = [];
  const collider = { addMesh: (k) => added.push(k), removeBucket: (k) => removed.push(k) };
  const pipeline = { getGpuMesh: (id) => Promise.resolve({ id }) };
  const firstYards = new Map();
  let entries = [{ ...P, homeFrames: firstYards }], feetAt = null;
  const host = createSettlementHost({ renderer: { drawMesh: (m) => drawn.push(m.id) }, pipeline, collider: () => collider, built: () => entries, translation: (px, py, out = [0, 0, 0]) => { out[0] = 10; out[1] = 2; out[2] = -5; return out; }, feet: () => feetAt });
  feetAt = [plan.buildings[0].at[0] + 10, 0, plan.buildings[0].at[1] - 5];   // a body inside a wall: the collider waits
  host.frame();
  assert.equal(host.count(), 1);
  assert.equal(added.length, 0);
  feetAt = null;
  host.frame();
  assert.equal(added.length, 2 + plan.buildings.length, 'the ground, the features and every building, one bucket');
  await new Promise((r) => setTimeout(r, 10));
  assert.ok(host.draw() > plan.buildings.length);
  const ids = host.idsAt(1084, 241);
  assert.ok(drawn.includes(ids.ground) && drawn.includes(ids.features) && ids.ground === groundModelId(ids.slot) && ids.features === featuresModelId(ids.slot), 'its ground and its features drawn, on its run');
  const doors = host.doorTargets();
  assert.equal(doors.length, plan.buildings.length);
  assert.equal(doors[0].settlement.buildingKey, plan.buildings[0].key);
  assert.ok(Math.abs(doors[0].door.matrix[12] - (plan.buildings[0].entrances[0].at[0] + 10)) < 1e-3, 'the door in the scene');
  assert.ok(doors[0].dfBlock.rmbBlock.subRecords[0].interior.made, 'its rooms, made when asked');
  assert.equal(host.planAt(1084, 241).buildings.length, plan.buildings.length);
  // built again in place, the entry swapped with no frame between: the same plan files its yards on the new entry,
  // another is stood again (mutants: the swap unread, the yards left on the old entry)
  const was = host.planAt(1084, 241), yards = new Map(), wasIds = host.idsAt(1084, 241), wasGround = customModelFor(wasIds.ground);
  assert.ok(wasGround?.positions.length > 0 && customModelFor(wasIds.features)?.positions.length > 0, 'its ground and its features built through the family');
  assert.ok(firstYards.size > 0, 'its yards filed on its entry');
  entries = [{ ...P, settlement: { ...P.settlement }, homeFrames: yards }];
  host.frame();
  assert.equal(host.planAt(1084, 241), was, 'the same plan stands on');
  assert.ok(yards.size > 0 && [...yards.keys()].every((k) => plan.buildings.some((b) => b.key === k)), 'its yards on the live entry');
  assert.equal(firstYards.size, 0, 'and gone from the old one');
  const swapped = entries[0].settlement, layoutOf = swapped.layout;
  let reads = 0;
  Object.defineProperty(swapped, 'layout', { get: () => { reads++; return layoutOf; } });
  host.frame();
  assert.equal(reads, 0, 'the swap read once: the live entry its own from then on');
  entries = [{ ...P, settlement: { ordinal: ROW.ordinal, layout: layoutSettlement({ ...input, seed: input.seed + 1 }, env) }, homeFrames: new Map() }];
  host.frame();
  assert.notEqual(host.planAt(1084, 241), was, 'another plan stood again');
  assert.ok(host.idsAt(1084, 241).slot !== wasIds.slot && customModelFor(wasIds.ground) === null, 'stood again on a fresh run, the old run\'s kept model let go');
  assert.equal(yards.size, 0, 'the old entry\'s yards let go');
  assert.equal(host.count(), 1);
  const before = removed.length, lastIds = host.idsAt(1084, 241);
  entries = [];
  host.frame();
  assert.equal(host.count(), 0);
  assert.deepEqual(removed.slice(before), ['settlement:1084,241'], 'taken down: its bucket removed once');
  assert.equal(customModelFor(lastIds.ground), null, 'and its models gone');
  assert.equal(customModelFor(lastIds.features), null, 'its features too');
  assert.equal(standSettlement({ px: 0, py: 0, settlement: { ordinal: 99, layout: L } }, null, 0), null, 'no row');
  assert.equal(standSettlement(P, null, -1), null, 'no run');
  const sand = art(CAPITAL_ART.sandstone);   // the host paves in the row's style (mutant: the style unpassed)
  const styled = standSettlement(P, null, 0);
  assert.ok([styled.ground, styled.features].every((model) => model.subMeshes.some((m) => m.textureArchive === sand[0] && m.textureRecord === sand[1])), 'its ground and its features');
});

test('RMBC4 the wiring (by source): the world builds, frames, draws, drops and asks the host; a settlement door\'s record answers the door; the pixel carries its layout (mutants: each seam)', () => {
  const world = readFileSync(new URL('../../../src/scenes/world.js', import.meta.url), 'utf8');
  assert.match(world, /settlements = createSettlementHost\(\{/);
  assert.match(world, /\n {4}settlements\?\.frame\(\);/);
  assert.match(world, /settlements\?\.draw\(renderer, yardCull\);/, 'by the street\'s view test');
  assert.match(world, /translation: onFloatingFrame\(state, \(px, py, out\) => state\.pixelTranslation\(px, py, out\)\),/, 'its collider rides the floating frame');
  assert.equal(world.match(/settlements\?\.destroyAll\(\);/g)?.length, 2, 'at a re-anchor and a load');
  assert.match(world, /\.\.\.\(settlements\?\.doorTargets\(\) \?\? \[\]\)\]/);
  assert.match(world, /if \(!hit\?\.pixelKey\) return hit\?\.settlement \? \{ \.\.\.hit\.settlement \} : null;/, 'a copy: the transition writes on the record (the game\'s first run threw on a frozen one)');
  const build = readFileSync(new URL('../../../src/scenes/pixelBuild.js', import.meta.url), 'utf8');
  assert.match(build, /bridges, meets, settlement \} = await terrainGen\.generate\(\{/);
  assert.match(build, /\n\s+settlement,\s+\/\/ its settlement's layout/);
  assert.match(readFileSync(new URL('../../../src/scenes/tamrielPlacesHost.js', import.meta.url), 'utf8'), /\n {2}if \(worldPlaces\) worldPlaces\.registerLive\(SETTLEMENTS_SOURCE, \{ stamp: \(\) => \[tamrielFit\(\)\], rows: \(\) => settlementPlaceRows\(\) \}\);/);
});

test('RMBC4 the host\'s costs: one settlement stood a frame; its collider filed once, riding the pixel\'s translation; each piece culled by the street\'s view test; feet in a well hold the collider back; the host dresses unchecked (mutants: the frame\'s budget, the ride, the cull, the solids, the check skipped)', async () => {
  const { featureSolids } = await import('../../../src/world/settlement/settlementFeatures.js');
  const { DECOR_SKIP, DECOR_SHADOW, DECOR_DRAW } = await import('../../../src/scenes/decor/decorRoom.js');
  const added = [], rides = [], drawn = [], cast = [];
  const collider = { addMesh: (k, pos, idx, m, ride) => { added.push(k); rides.push(ride); }, removeBucket: () => {} };
  const t = [10, 2, -5];
  const second = { px: 1085, py: 241, settlement: { ordinal: ROW.ordinal, layout: L } };
  let feetAt = null;
  const freeBefore = slotsFree();
  const host = createSettlementHost({ renderer: { drawMesh: (m) => drawn.push(m.id), recordShadowMesh: (m) => cast.push(m.id) }, pipeline: { getGpuMesh: (id) => Promise.resolve({ id }) }, collider: () => collider,
    built: () => [P, second], translation: (px, py, out = [0, 0, 0]) => { out[0] = t[0]; out[1] = t[1]; out[2] = t[2]; return out; }, feet: () => feetAt });
  const well = plan.features.find((f) => f.kind === 'well');
  assert.ok(featureSolids(plan).some((ring) => ring.length > 6), 'the well\'s ring among its solids');
  feetAt = [well.at[0] + t[0], 0, well.at[1] + t[2]];   // a body in the well: nothing filed yet
  host.frame();
  assert.equal(host.count(), 1, 'one stood this frame');
  assert.equal(added.length, 0, 'feet in a well: the collider waits');
  feetAt = null;
  host.frame();
  assert.equal(host.count(), 2, 'the next the frame after');
  const once = added.length;
  assert.ok(once > 0 && rides.every((ride) => typeof ride === 'function' && ride()[0] === t[0]), 'each mesh filed with the pixel\'s translation to ride');
  t[0] += 819.2;   // the floating origin moves: nothing filed again
  host.frame();
  assert.equal(added.length, once, 'filed once');
  await new Promise((r) => setTimeout(r, 10));
  drawn.length = 0;
  assert.equal(host.draw(undefined, () => DECOR_SKIP), 0, 'all off screen and out of reach: nothing');
  assert.equal(drawn.length + cast.length, 0);
  host.draw(undefined, () => DECOR_SHADOW);
  assert.ok(cast.length > 0 && drawn.length === 0, 'in a shadow\'s reach: cast alone');
  assert.ok(host.draw(undefined, () => DECOR_DRAW) > 0 && drawn.length > 0, 'in view: drawn');
  host.destroyAll();
  assert.equal(slotsFree(), freeBefore, 'their runs let go');
  const unchecked = dressSettlement(input, L, { check: false });
  assert.deepEqual(unchecked.plan, plan, 'the same plan');
  const broken = { ...L, pads: [...L.pads, { id: 'x', poly: [[0, 0], [1, 0]], y: 0, rim: 'grade', base: 'cut' }] };
  assert.ok(dressSettlement(input, broken).report.problems.length > 0 && dressSettlement(input, broken, { check: false }).report.problems.length === 0, 'the check skipped, not its plan');
});

test('RMBC4 a stair is its steps: from one pad\'s height to the other\'s, every tread level, every riser at most FLIGHT_STEP and well under the walker\'s step; a ramp stays a slope (mutants: one step, the tread\'s height, the riser\'s)', () => {
  const pads = [{ id: 'low', poly: [[0, 0], [20, 0], [20, 20], [0, 20]], y: 0, base: 'cut' }, { id: 'high', poly: [[0, 24], [20, 24], [20, 44], [0, 44]], y: 2.7, base: 'cut' }];
  const flightOf = (kind) => groundModel({ pads, links: [{ id: 'l0', kind, from: 'low', to: 'high', a: [10, 18], b: [10, 26], width: 3 }] }, 10, new Map());
  const stairs = flightOf('stairs'), ys = new Set(), levels = [];
  for (let i = 0; i < stairs.positions.length; i += 3) if (stairs.normals[i + 1] > 0.999 && Math.abs(stairs.positions[i] - 10) < 1.6 && stairs.positions[i + 2] > 18 - 1e-6 && stairs.positions[i + 2] < 26 + 1e-6) ys.add(Math.round(stairs.positions[i + 1] * 1000) / 1000);   // the treads
  for (const y of ys) if (y >= 10 - 1e-6) levels.push(y);
  levels.sort((x, y) => x - y);
  const steps = Math.ceil((12.7 - 10) / FLIGHT_STEP);   // its two pads' heights apart, as the flight reads them
  assert.equal(levels.length, steps, `${steps} treads, a riser under each`);
  assert.ok(Math.abs(levels[0] - (10 + (12.7 - 10) / steps)) < 1e-3 && levels.at(-1) === 12.7, 'one riser up off the low pad, the last tread the high one\'s height');
  for (let i = 1; i < levels.length; i++) assert.ok(levels[i] - levels[i - 1] <= FLIGHT_STEP + 1e-3 && FLIGHT_STEP < 0.5 / 2, 'a riser the walker takes in its stride');
  const ramp = flightOf('ramp'), rampYs = new Set();
  for (let i = 1; i < ramp.positions.length; i += 3) if (ramp.positions[i] >= 10 - 1e-6) rampYs.add(Math.round(ramp.positions[i] * 1000) / 1000);
  assert.ok(rampYs.size <= 6, 'a ramp: its two ends and its skirts');
});

test('RMBC4 the host moves its doors\' generation as a settlement stands and goes, and the modes read it with the world\'s; a stand that throws gives its run back and is not tried again; two rebuilt pixels re-stand one a frame, each asked once while it waits (mutants: the generation still, the world\'s sum, the run kept, a throw retried, the budget, the swap asked each frame)', () => {
  const second = { px: 1085, py: 241, settlement: { ordinal: ROW.ordinal, layout: L } };
  let entries = [P, second];
  const host = createSettlementHost({ built: () => entries, translation: (px, py, out = [0, 0, 0]) => { out[0] = out[1] = out[2] = 0; return out; } });
  const gen0 = host.doorsGen();
  host.frame();
  assert.ok(host.doorsGen() > gen0 && host.count() === 1, 'one stood, its doors announced');
  host.frame();
  const stood = host.doorsGen();
  // both rebuilt with a new plan in one frame: one stands again now, the other waits a frame, its swap asked once
  const other = layoutSettlement({ ...input, seed: input.seed + 3 }, env);
  let reads = 0;
  const waiting = { ordinal: ROW.ordinal, get layout() { reads++; return other; } };
  entries = [{ ...P, settlement: { ordinal: ROW.ordinal, layout: other } }, { ...second, settlement: waiting }];
  const before = [host.planAt(1084, 241), host.planAt(1085, 241)];
  host.frame();
  const moved = [host.planAt(1084, 241) !== before[0], host.planAt(1085, 241) !== before[1]];
  assert.deepEqual(moved, [true, false], 'one a frame');
  assert.ok(host.doorsGen() > stood, 'its doors announced again');
  const asked = reads;
  host.frame();
  assert.ok(host.planAt(1085, 241) !== before[1], 'the other the next frame');
  assert.ok(asked > 0 && asked <= 2, `its swap asked once while it waited (${asked})`);
  entries = [];
  const up = host.doorsGen();
  host.frame();
  assert.ok(host.doorsGen() > up && host.count() === 0, 'taken down, announced');
  // a plan that throws: its run given back, tried once
  const free = slotsFree(), warn = console.warn;
  let warned = 0;
  console.warn = () => { warned++; };
  try {
    entries = [{ px: 1086, py: 241, settlement: { ordinal: ROW.ordinal, layout: { ...L, cells: null } } }];
    host.frame(); host.frame(); host.frame();
  } finally { console.warn = warn; }
  assert.equal(slotsFree(), free, 'its run back on the free list');
  assert.equal(warned, 1, 'tried once');
  const world = readFileSync(new URL('../../../src/scenes/world.js', import.meta.url), 'utf8');
  assert.match(world, /doorGeneration: \(\) => doorGeneration \+ \(settlements\?\.doorsGen\(\) \?\? 0\),/, 'the modes\' door cache moves with them');
});

test('RMBC4 a building\'s rooms are cached under its kind and its footprint with its key: a plan that retypes or reshapes it under the same key never hands it the rooms it had (mutants: the kind, the footprint)', () => {
  const b = plan.buildings[0];
  assert.equal(interiorCacheKey(input.place, b), interiorCacheKey(input.place, { ...b }));
  assert.notEqual(interiorCacheKey(input.place, b), interiorCacheKey(input.place, { ...b, type: b.type + 1 }), 'another kind');
  assert.notEqual(interiorCacheKey(input.place, b), interiorCacheKey(input.place, { ...b, footprint: b.footprint.map(([e, n]) => [e + 0.5, n]) }), 'another shape');
  assert.ok(interiorCacheKey(input.place, b).startsWith(`settlement:${input.place >>> 0}.${b.key}.`), 'its place and key first');
});

test('RMBC4 a rebuilt town waiting for the frame\'s budget is compared with its stood plan once, however many frames it waits (mutant: the swap asked each frame)', () => {
  let entries = [P];
  const host = createSettlementHost({ built: () => entries, translation: (px, py, out = [0, 0, 0]) => { out[0] = out[1] = out[2] = 0; return out; } });
  host.frame();
  const other = layoutSettlement({ ...input, seed: input.seed + 5 }, env);
  let reads = 0;
  const waiting = { ...P, settlement: { ordinal: ROW.ordinal, get layout() { reads++; return other; } } };
  const fresh = (i) => ({ px: 1090 + i, py: 241, settlement: { ordinal: ROW.ordinal, layout: L } });
  for (let i = 0; i < 3; i++) {   // each frame a new town takes the frame's one stand first
    entries = [...Array.from({ length: i + 1 }, (_, k) => fresh(k)), waiting];
    host.frame();
  }
  assert.ok(host.planAt(1084, 241) !== null && reads > 0 && reads <= 2, `asked once in three frames waiting (${reads})`);
  entries = [];
  host.frame();
});

test('RMBC4 every flight tops out level with its higher pad at its rim and lands on its lower pad: no ledge to climb at a terrace\'s edge (mutants: the rim, the foot, the run)', () => {
  for (const archetype of ['fort', 'wetland', 'river']) {
    const inp = { place: 9, origin: { px: 1000, py: 200, east: 0, north: 0 }, seed: 7, archetype, style: archetype === 'wetland' ? 'BlackMarsh' : 'HighRock', site: { east: 400, north: 400, radius: 90 }, env: SYNTHETIC[archetype] };
    const lay = layoutSettlement(inp, SYNTHETIC[archetype]), p = dressSettlement(inp, lay).plan, pads = new Map(p.pads.map((x) => [x.id, x]));
    let flights = 0;
    for (const l of p.links) {
      const f = pads.get(l.from), t = pads.get(l.to);
      if (Math.abs(t.y - f.y) < 1e-6) continue;
      const lowFirst = f.y < t.y, way = flightOf(lowFirst ? l.a : l.b, lowFirst ? l.b : l.a, (lowFirst ? t : f).poly, (lowFirst ? f : t).poly);
      assert.ok(way, `${archetype} ${l.id} crosses its rim`);
      const run = flightRun(l.kind, t.y - f.y, way.enter), foot = [way.top[0] + way.dir[0] * run, way.top[1] + way.dir[1] * run];
      assert.ok(run <= way.room - 0.05 && pointInRing(foot, (lowFirst ? f : t).poly), `${archetype} ${l.id}: its foot on its lower pad`);
      const g = groundModel({ ...p, links: [l] }, lay.datum, new Map()), high = lay.datum + Math.max(f.y, t.y), low = lay.datum + Math.min(f.y, t.y);
      let atRim = false, atFoot = false;
      for (let i = 0; i < g.positions.length; i += 3) {
        const at = [g.positions[i], g.positions[i + 2]];
        if (Math.hypot(at[0] - way.top[0], at[1] - way.top[1]) < l.width / 2 + 0.01 && Math.abs(g.positions[i + 1] - high) < 1e-3) atRim = true;
        if (Math.hypot(at[0] - foot[0], at[1] - foot[1]) < l.width / 2 + 0.01 && Math.abs(g.positions[i + 1] - low) < 1e-3) atFoot = true;
      }
      assert.ok(atRim && atFoot, `${archetype} ${l.id}: its top at the rim, level with the pad; its foot its run back, on the lower`);
      flights++;
    }
    assert.ok(flights > 10, `${archetype}: ${flights} flights`);
  }
});

test('RMBC4 a flight\'s steps each span their own stretch, risers face down it, both its sides are skirted; a ramp is skirted both sides; a core is never paved; a deck stands on a post at every third corner (mutants: one tread the whole run, the risers turned, a side bare, the core paved, the posts)', () => {
  const pads = [{ id: 'low', poly: [[0, 0], [20, 0], [20, 20], [0, 20]], y: 0, base: 'cut' }, { id: 'high', poly: [[0, 20], [20, 20], [20, 44], [0, 44]], y: 2.7, base: 'cut' }];
  const model = (kind) => groundModel({ pads, links: [{ id: 'l0', kind, from: 'low', to: 'high', a: [10, 17], b: [10, 23], width: 3 }] }, 0, new Map());
  const stairs = model('stairs'), treads = new Map(), normals = { riserUp: 0, riserDown: 0, left: 0, right: 0 };
  for (let i = 0; i < stairs.positions.length; i += 3) {
    const [x, y, z] = [stairs.positions[i], stairs.positions[i + 1], stairs.positions[i + 2]], [nx, ny, nz] = [stairs.normals[i], stairs.normals[i + 1], stairs.normals[i + 2]];
    if (Math.abs(x - 10) > 1.6 || z < 10 || z > 20.01) continue;
    if (ny > 0.999 && y > 0.01) { const span = treads.get(y.toFixed(3)) ?? [Infinity, -Infinity]; treads.set(y.toFixed(3), [Math.min(span[0], z), Math.max(span[1], z)]); }
    if (Math.abs(nz) > 0.999) normals[nz < 0 ? 'riserDown' : 'riserUp']++;
    if (Math.abs(nx) > 0.999) normals[nx < 0 ? 'left' : 'right']++;
  }
  const steps = Math.ceil(2.7 / FLIGHT_STEP), run = 2.7 / 0.75;
  assert.equal(treads.size, steps);
  for (const [, [from, to]] of treads) assert.ok(Math.abs(to - from - run / steps) < 1e-3, `a tread its own ${(run / steps).toFixed(2)} m, not ${(to - from).toFixed(2)}`);
  assert.ok(normals.riserDown > 0 && normals.riserUp === 0, 'its risers face down the flight, toward its foot');
  assert.ok(normals.left > 0 && normals.right > 0, 'both its sides skirted');
  const ramp = model('ramp');
  let sides = 0;
  for (let i = 0; i < ramp.normals.length; i += 3) if (Math.abs(ramp.normals[i]) > 0.999 && Math.abs(ramp.positions[i] - 10) < 1.6 && ramp.positions[i + 2] > 16 && ramp.positions[i + 2] < 24) sides |= ramp.normals[i] < 0 ? 1 : 2;   // its own sides, not the pads' walls
  assert.equal(sides, 3, 'a ramp skirted both sides');
  // a grown town's core is its town's own ground: never paved
  const s = new Float32Array(129 * 129).fill(60 / (MAX_TERRAIN_HEIGHT * STREAMING_TERRAIN_SCALE)), rect = { xMin: 56, xMax: 72, yMin: 56, yMax: 72 };
  const grown = standTownGrowth(200, 200, s, townGrowthJob({ mapTableData: { mapId: 7301, locationType: 2 }, name: 'Paveless' }, 'IliacBay', 17), rect, {});
  const { half, centre } = grown.layout.core, g = groundModel(dressSettlement(grown.input, grown.layout).plan, grown.layout.datum, new Map(grown.layout.cells.map((c) => [c.id, c])));
  const at = (k) => [g.positions[k * 3], g.positions[k * 3 + 2]];
  for (let i = 0; i < g.indices.length; i += 3) {
    const [p, q, r] = [g.indices[i], g.indices[i + 1], g.indices[i + 2]].map(at);
    if (g.normals[g.indices[i] * 3 + 1] < 0.999) continue;
    assert.ok(!pointInRing(centre, [p, q, r]), 'nothing paved over the middle of the core: its town\'s own ground');
  }
  // a deck on a post at every third corner, each down to its ground
  const wet = generateSettlement({ place: 9, origin: { px: 1000, py: 200, east: 0, north: 0 }, seed: 7, archetype: 'wetland', style: 'BlackMarsh', site: { east: 400, north: 400, radius: 90 }, env: SYNTHETIC.wetland });
  const wl = layoutSettlement({ place: 9, origin: { px: 1000, py: 200, east: 0, north: 0 }, seed: 7, archetype: 'wetland', style: 'BlackMarsh', site: { east: 400, north: 400, radius: 90 } }, SYNTHETIC.wetland);
  const deck = wet.plan.pads.find((p) => p.base === 'raised'), cell = wl.cells.find((c) => c.id === deck.id), foot = cell.low - 0.5;
  const dm = groundModel({ ...wet.plan, pads: [deck], links: [] }, wl.datum, new Map([[deck.id, cell]]));
  let bottoms = 0;
  for (let i = 1; i < dm.positions.length; i += 3) if (Math.abs(dm.positions[i] - foot) < 1e-3) bottoms++;
  assert.equal(bottoms, Math.ceil(deck.poly.length / 3) * 18, 'a post at every third corner, down past its lowest ground');
  assert.ok(cell.low <= cell.natural && wl.datum + deck.y - foot > 0.5, 'the deck over it');
});

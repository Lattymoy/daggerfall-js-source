// A SETTLEMENT STOOD - its ground paved at its pads' heights with walls
// down their rims, decks on posts, links between its pads; each building the fabric's mesher over its footprint, its door
// on its front wall facing its street, its rooms the fabric's own filed under its place and key, its record the door's; the
// host stands what the built pixels hold, draws it, files it with the collider, hands its doors over and takes it down.
// A Hammerfell settlement (the published row's) on synthetic ground. Pins mutation-checked (tools/mutants/rmbc4.json).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { earClip, groundModel, buildingPiece, buildingInterior, buildingRecord, interiorPoolOf, groundModelId, buildingModelId, featuresModelId, isSettlementModelId, SETTLEMENT_MODEL_BASE, WALL_DROP } from '../../../src/world/settlement/settlementModels.js';
import { standSettlement, createSettlementHost } from '../../../src/scenes/settlementHost.js';
import { layoutSettlement } from '../../../src/world/settlement/settlementLayout.js';
import { dressSettlement } from '../../../src/world/settlement/settlementGen.js';
import { SETTLEMENT_ROWS, settlementInput, settlementPlaceId } from '../../../src/world/settlement/settlementPlaces.js';
import { ringArea2 } from '../../../src/world/settlement/settlementGeometry.js';
import { keyBandOf } from '../../../src/world/settlement/settlementContract.js';
import { DOOR_TYPE } from '../../../src/world/meshReader.js';
import { BUILDING_TYPES as T } from '../../../src/world/buildingNames.js';
import { IMPERIAL_DOOR_MODEL } from '../../../src/world/imperialFabricBuildings.js';
import { art, CAPITAL_ART } from '../../../src/world/capitalShapes.js';
import { customModelFor } from '../../../src/world/customModels.js';
import { SYNTHETIC } from '../../../tools/settlementProbe.mjs';

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
  let entries = [P], feetAt = null;
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
  assert.ok(drawn.includes(groundModelId(ROW.ordinal)) && drawn.includes(featuresModelId(ROW.ordinal)), 'its ground and its features drawn');
  const doors = host.doorTargets();
  assert.equal(doors.length, plan.buildings.length);
  assert.equal(doors[0].settlement.buildingKey, plan.buildings[0].key);
  assert.ok(Math.abs(doors[0].door.matrix[12] - (plan.buildings[0].entrances[0].at[0] + 10)) < 1e-3, 'the door in the scene');
  assert.ok(doors[0].dfBlock.rmbBlock.subRecords[0].interior.made, 'its rooms, made when asked');
  assert.equal(host.planAt(1084, 241).buildings.length, plan.buildings.length);
  // built again in place, the entry swapped with no frame between: the same plan files its yards on the new entry,
  // another is stood again (mutants: the swap unread, the yards left on the old entry)
  const was = host.planAt(1084, 241), yards = new Map(), wasGround = customModelFor(groundModelId(ROW.ordinal));
  assert.ok(wasGround?.positions.length > 0, 'its ground built through the family');
  entries = [{ ...P, settlement: { ...P.settlement }, homeFrames: yards }];
  host.frame();
  assert.equal(host.planAt(1084, 241), was, 'the same plan stands on');
  assert.ok(yards.size > 0 && [...yards.keys()].every((k) => plan.buildings.some((b) => b.key === k)), 'its yards on the live entry');
  entries = [{ ...P, settlement: { ordinal: ROW.ordinal, layout: layoutSettlement({ ...input, seed: input.seed + 1 }, env) }, homeFrames: new Map() }];
  host.frame();
  assert.notEqual(host.planAt(1084, 241), was, 'another plan stood again');
  assert.ok(customModelFor(groundModelId(ROW.ordinal)) !== wasGround, 'its run\'s ids built again, never the old plan\'s kept model');
  assert.equal(yards.size, 0, 'the old entry\'s yards let go');
  assert.equal(host.count(), 1);
  const before = removed.length;
  entries = [];
  host.frame();
  assert.equal(host.count(), 0);
  assert.deepEqual(removed.slice(before), ['settlement:1084,241'], 'taken down: its bucket removed once');
  assert.equal(customModelFor(groundModelId(ROW.ordinal)), null, 'and its models gone');
  assert.equal(customModelFor(featuresModelId(ROW.ordinal)), null, 'its features too');
  assert.equal(standSettlement({ px: 0, py: 0, settlement: { ordinal: 99, layout: L } }, null), null);
  const sand = art(CAPITAL_ART.sandstone);   // the host paves in the row's style (mutant: the style unpassed)
  assert.ok(standSettlement(P, null).ground.subMeshes.some((m) => m.textureArchive === sand[0] && m.textureRecord === sand[1]));
});

test('RMBC4 the wiring (by source): the world builds, frames, draws, drops and asks the host; a settlement door\'s record answers the door; the pixel carries its layout (mutants: each seam)', () => {
  const world = readFileSync(new URL('../../../src/scenes/world.js', import.meta.url), 'utf8');
  assert.match(world, /settlements = createSettlementHost\(\{/);
  assert.match(world, /\n {4}settlements\?\.frame\(\);/);
  assert.match(world, /settlements\?\.draw\(renderer\);/);
  assert.equal(world.match(/settlements\?\.destroyAll\(\);/g)?.length, 2, 'at a re-anchor and a load');
  assert.match(world, /\.\.\.\(settlements\?\.doorTargets\(\) \?\? \[\]\)\]/);
  assert.match(world, /if \(!hit\?\.pixelKey\) return hit\?\.settlement \? \{ \.\.\.hit\.settlement \} : null;/, 'a copy: the transition writes on the record (the game\'s first run threw on a frozen one)');
  const build = readFileSync(new URL('../../../src/scenes/pixelBuild.js', import.meta.url), 'utf8');
  assert.match(build, /bridges, meets, settlement \} = await terrainGen\.generate\(\{/);
  assert.match(build, /\n\s+settlement,\s+\/\/ its settlement's layout/);
  assert.match(readFileSync(new URL('../../../src/scenes/tamrielPlacesHost.js', import.meta.url), 'utf8'), /\n {2}if \(worldPlaces\) worldPlaces\.registerLive\(SETTLEMENTS_SOURCE, \{ stamp: \(\) => \[tamrielFit\(\)\], rows: \(\) => settlementPlaceRows\(\) \}\);/);
});

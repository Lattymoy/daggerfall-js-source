// FIELD BUGS 2026-10-09 - HOME-FOOT, the Discord's "Property Problem": "House on the left is mine, right is unowned. I
// can't place in front of my door but I can place in front of another's home. This looks to be a bug." (a desert
// town, a torch being placed on the street between the two).
//
// A yard's house was the BOX round its models (scenes/homeYards.js yardLot, the box world.js recorded at the build),
// and Hammerfell's houses are L-shaped, or stand an outside stair before their door: the door opens onto open ground
// INSIDE the box (ARCH3D 600's open corner, 709's forecourt), so the step before the owner's own door was "inside your
// house", while a neighbour whose door is in its box's side had free ground before it. Measured on the game's own
// desert towns (the real-data pin below): 5,166 of 11,701 houses refused a piece 1.5 m before their ground-floor door.
// Now a building's ground is what its models' faces cover seen from above (modelFootRects - roofs, eaves, treads, never
// a wall), recorded at the build beside the box (world.js `rects`), and the house and its neighbours are asked of that.
// `01-Overview/Field-Bugs-2026-10-09.md`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as homeYards from '../src/scenes/homeYards.js';
import { Collider } from '../src/player/collider.js';
import { accountDecor, SESSION_KEY } from '../src/net/accountClient.js';
import { localAabb, transformedAabb } from '../src/render/frustum.js';
import { trs, multiply } from '../src/world/mat4.js';
import { layoutLocation } from '../src/world/locationLayout.js';
import { getLocationTerrainTileOrigin } from '../src/world/terrainTiles.js';
import { buildingSummaries } from '../src/world/buildingSummaries.js';
import { homeCandidate } from '../src/systems/onlineHomes.js';
import { makeBuildingKey } from '../src/systems/talkTopics.js';
import { longitudeLatitudeToMapPixel } from '../src/formats/mapsFile.js';
import { DOOR_TYPE } from '../src/world/meshReader.js';
import { standService, sessionStorageOf, T0 } from './accountDb.mjs';
import { realmAt } from './realmSeat.mjs';
import { fakeDoc, fakeWin, fakeBlocks, rmb, TOWN, settle, ACTIONS } from './decorFakes.mjs';
import { townPixel, houseAt, lHouse, L_DOOR, CHAIR_MODEL, BENCH_MODEL } from './fb1001Town.mjs';
import { skipReal, game } from './lwRealTown.mjs';

// read off the namespace, so the code before the fix fails each pin on its own assertion rather than at the import
const { createHomeYards, yardLot, yardWhyNot, YARD_IN_HOUSE, YARD_ON_OTHER, YARD_MARGIN } = homeYards;
const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const square = (h) => [[-h, -h], [h, -h], [h, h], [-h, h]];
const CHAIR = square(0.5);   // a chair's ground, as decorTool.js footprintOf turns its box (unturned)
const r3 = (rs) => rs.map((r) => r.map((v) => Math.round(v * 1000) / 1000 + 0));

test('FB1009 HOME-FOOT the ground a model stands on: its faces seen from above - the roofs of an L\'s back and leg, never its open corner, never a wall; placed by a quarter turn it turns with it (mutants: a wall covering ground; a face sampled on its edge; the run never carried up; the turn dropped)', () => {
  const { modelFootRects, footRectsAt } = homeYards;
  const L = lHouse();
  assert.deepEqual(r3(modelFootRects(L.positions, L.indices)), [[-3.6, -3.6, 0, 0], [-3.6, 0, 3.6, 3.6]], 'the leg and the back - the open corner (x 0 to 3.6, z -3.6 to 0) is no house');
  assert.deepEqual(localAabb(L.positions).map((v) => Math.round(v * 1000) / 1000 + 0), [-3.6, 0, -3.6, 3.6, 3, 3.6], 'while the box round it holds the corner');
  // a wall alone covers no ground: an upright face seen from above is a line
  const wall = { positions: new Float32Array([0, 0, 0, 2, 0, 0, 2, 3, 0, 0, 3, 0, 0, 0, 0.0001, 2, 0, 0.0001]), indices: new Uint32Array([0, 1, 2, 0, 2, 3]) };
  assert.deepEqual(modelFootRects(wall.positions, wall.indices), [], 'a wall alone stands on no ground');
  assert.deepEqual(modelFootRects(new Float32Array(0), new Uint32Array(0)), [], 'nor does nothing');
  // a quarter turn (mat4 trs: local x to (cos, -sin)) stands the leg where the turn puts it, at the placement's place
  const turned = footRectsAt([[-3.6, -3.6, 0, 0]], trs(10, 0, 20, 0, 90, 0));
  assert.deepEqual(r3(turned), [[6.4, 20, 10, 23.6]], 'the leg, a quarter turn round, ten metres east and twenty north');
  assert.deepEqual(footRectsAt(null, trs(0, 0, 0, 0, 0, 0)), [], 'no ground, none placed');
});

test('FB1009 HOME-FOOT the lot asks the house\'s ground, not its box: the step before the door in an L\'s open corner is the yard\'s, under either roof it is the house\'s (a piece\'s middle on a seam between two of its rects too), and a neighbour\'s open corner is no neighbour\'s ground; a lot without its ground is its box, as before (mutants: the lot\'s box asked; the rects left in the box\'s frame; the middle unasked on a seam)', () => {
  const L = lHouse();
  const origin = [100, 7, 200];
  const place = trs(origin[0], origin[1], origin[2], 0, 0, 0);
  const box = transformedAabb(localAabb(L.positions), place);
  const rects = homeYards.footRectsAt(homeYards.modelFootRects(L.positions, L.indices), place);
  const lot = yardLot(origin, box, YARD_MARGIN, rects);
  assert.deepEqual(r3([lot.house]), [[-3.6, -3.6, 3.6, 3.6]], 'the box still sizes the lot');
  assert.deepEqual(r3(lot.walls), [[-3.6, -3.6, 0, 0], [-3.6, 0, 3.6, 3.6]], 'its ground, from its own place');
  const doorStep = [(L_DOOR.x0 + L_DOOR.x1) / 2, 0, L_DOOR.z - 0.6];   // a chair 0.1 m off the door's wall, in the open corner
  assert.equal(yardWhyNot(doorStep, lot, [], CHAIR), null, 'before the owner\'s own door: the yard (the report)');
  assert.equal(yardWhyNot(doorStep, yardLot(origin, box), [], CHAIR), YARD_IN_HOUSE, 'which the box alone called the house');
  assert.equal(yardWhyNot([1.8, 0, 1.8], lot, [], CHAIR), YARD_IN_HOUSE, 'under the back\'s roof');
  assert.equal(yardWhyNot([-1.8, 0, -1.8], lot, [], CHAIR), YARD_IN_HOUSE, 'under the leg\'s roof');
  assert.equal(yardWhyNot([1.8, 0, 0.3], lot, [], CHAIR), YARD_IN_HOUSE, 'through the door\'s wall');
  assert.equal(yardWhyNot([-1.8, 0, 0], lot, []), YARD_IN_HOUSE, 'a point on the seam between the leg and the back: inside, though the pad takes in both');
  // a neighbour's L, the same: its open corner the owner's lot may hold, its roofs never
  const others = [[4.5, -3.6, 8.1, 0], [4.5, 0, 11.7, 3.6]];   // an L like it, 8.1 m east of its frame, its corner at x 8.1 to 11.7, z -3.6 to 0
  assert.equal(yardWhyNot([8.6, 0, -1.2], lot, others, CHAIR), null, 'a neighbour\'s open corner, within the lot, is no building\'s ground');
  assert.equal(yardWhyNot([6, 0, -1.2], lot, others, CHAIR), YARD_ON_OTHER, 'its leg is');
  assert.equal(yardWhyNot([6, 0, 0], lot, others), YARD_ON_OTHER, 'a point on its seam too');
  // a frame recorded without its ground (the town's pins of FB1001, a frame of before) is its box, as it always was
  assert.deepEqual(yardLot(origin, box).walls, [yardLot(origin, box).house]);
  assert.deepEqual(yardLot(origin, box, YARD_MARGIN, []).walls, [yardLot(origin, box).house], 'none known, its box');
});

/** The street of the pins: two L-shaped houses (lHouse) on grass - A, the owner's, its open corner south-east before
 *  its door; B, a stranger's, 9 m east of it, turned half round, its open corner north-west, inside A's lot. */
const lTown = () => townPixel({ houses: [houseAt(40, 51.2), [...houseAt(49, 51.2), 1024]], ground: () => 2, model: lHouse() });

/** One client's yards over the town, the owner `who` playing `charId`, whose home is `key` - fb1001_yard.test.js's rig,
 *  its collider the houses' own faces where they stand (the eye meets the ground in an open corner, a roof over a leg). */
function yardRig(svc, town, { who, charId, key, gold = 5000 }) {
  const T = [-300, 0, -350];
  const built = new Map([[`${town.built.px},${town.built.py}`, town.built]]);
  const collider = new Collider(() => town.floor);
  const L = lHouse();
  for (const [bk, local] of town.locals) collider.addMesh(`pixel:${bk}`, L.positions, L.indices, local, () => T);
  const box = (x0, y0, z0, x1, y1, z1) => ({
    positions: new Float32Array([x0, y0, z0, x1, y0, z0, x1, y1, z0, x0, y1, z0, x0, y0, z1, x1, y0, z1, x1, y1, z1, x0, y1, z1]),
    indices: new Uint32Array([0, 1, 2, 0, 2, 3, 4, 6, 5, 4, 7, 6, 0, 4, 5, 0, 5, 1, 3, 2, 6, 3, 6, 7, 0, 3, 7, 0, 7, 4, 1, 5, 6, 1, 6, 2]),
  });
  const cpuModels = new Map([[CHAIR_MODEL, box(-0.5, -0.1, -0.5, 0.5, 0.9, 0.5)], [BENCH_MODEL, box(-1.5, 0, -0.3, 1.5, 0.8, 0.3)]]);
  const renderer = {
    createDecalBatch: (cap) => ({ cap, writes: [] }), writeDecalSlot: () => true, drawDecals() {}, destroyDecalBatch() {}, uploadTexture: () => 'tex',
    drawMesh() {}, createBillboardBatch: () => ({ bounds: [0, 0, 0, 1] }), destroyBillboardBatch() {},
  };
  const api = accountDecor({ fetch: svc.fetch, storage: sessionStorageOf(SESSION_KEY, who) });
  const purse = { n: gold };
  const f = town.built.homeFrames.get(key);
  const at = (rx, rz) => [T[0] + f.at[0] + rx, T[1] + town.floor, T[2] + f.at[2] + rz];
  const feet = at(0, -6);   // on the lot, south of the house
  const cam = { pos: [feet[0], town.floor + 1.6, feet[2]], yaw: 0, pitch: -Math.PI / 2 + 1e-6 };
  const doc = fakeDoc();
  const win = fakeWin();
  const yards = createHomeYards({
    api: { yards: (m) => api.yards(m), place: (a) => api.place(a), move: (a) => api.move(a), remove: (a) => api.remove(a) },
    homes: { homeAt: (m, k) => (k === key ? { owner: who.handle, own: true, mine: true, look: null } : town.built.homeFrames.has(k) ? { owner: 'Tomas', own: false } : null) },
    built: () => built, translation: () => T, feet: () => feet, outside: () => true, eye: () => cam.pos,
    collider: () => collider, meshes: { getGpuMesh: async (id) => ({ gpu: id }), cpuModels }, renderer, getTexture: async () => ({ recordCount: 1 }), uploadRecord() {},
    scanDeps: () => ({ blocks: fakeBlocks([{ type: TOWN, block: rmb([CHAIR_MODEL, BENCH_MODEL]) }]), isTownBlock: (x) => x === TOWN, modelRadius: () => 0.8, flatRadius: async () => 0.2 }),
    character: () => charId,
    realm: () => async ({ reserve = null, apply = null, call }) => {
      const undo = reserve ? reserve() : null;
      const r = await call(realmAt(svc.env, charId));
      if (r?.ok) apply?.(r); else undo?.();
      return r;
    },
    wallet: () => ({ get gold() { return purse.n; }, pay: (n) => { purse.n -= n; }, credit: (n) => { purse.n += n; } }), regionOf: () => 17,
    doc, win, canvas: null, touch: false, actionOf: (e) => ACTIONS.get(e.code) ?? null, locked: () => true, cursorOff() {}, stick: () => null,
    say() {}, refusal: (w) => `refused: ${w}`, openSlot() {}, now: () => 0,
  });
  const tool = yards.tool();
  const panel = () => doc.body.children.find((c) => c.className === 'dfdecor');
  const walk = (n, fn) => { fn(n); for (const k of n.children ?? []) walk(k, fn); };
  const click = (pred) => walk(panel(), (n) => { if (pred(n)) n.fire('click'); });
  async function frames(n = 1, overlayUp = false) { for (let i = 0; i < n; i++) { yards.frame({ dt: 0.1, cam, overlayUp }); await settle(); await settle(); } }
  /** A chair chosen in the catalogue, its ghost aimed straight down at (rx, rz) from the house's frame. */
  async function ghostAt(rx, rz) {
    if (tool.flying()) tool.back();
    else assert.equal(tool.openPanel(), true, 'the decorator opens on the lot');
    await frames(8, true);
    const p = at(rx, rz);
    cam.pos = [p[0], town.floor + 1.6, p[2]];
    click((n) => n.dataset?.key === `m${CHAIR_MODEL}` && String(n.className).includes('dfdecor-row'));
    click((n) => n.tag === 'button' && n.textContent === 'Place');
    for (let i = 0; i < 8 && !tool.ghost(); i++) await frames(1);
    await frames(1);
    return tool.ghost();
  }
  return { yards, tool, frames, ghostAt };
}

test('FB1009 HOME-FOOT the report on the real decorator: the owner of an L-shaped house places a chair on the step before their own door - the bar says nothing against it and the service writes it; under their roof it is the house, under the stranger\'s roof it is theirs, and the stranger\'s open corner within the lot stands as the owner\'s own does (mutants: the yard made without its ground; a neighbour asked by its box; the host\'s frames without their ground)', async (t) => {
  t.mock.method(Date, 'now', () => T0 * 1000);
  const town = lTown();
  const [A, B] = town.keys;
  assert.ok(town.built.homeFrames.get(A).rects.length && town.built.homeFrames.get(B).rects.length, 'each frame carries its ground, as world.js records it');
  const svc = await standService();
  const who = await svc.registered('Olga');
  const o = await svc.seatHome(who, { mapId: 7, buildingKey: A, region: 17, price: 5000 });
  assert.equal(o.status, 200, JSON.stringify(o.body));
  const rows = () => svc.env.DB._raw.prepare('SELECT yard, place FROM home_decor ORDER BY placed_at, id').all().map((r) => ({ yard: r.yard, ...JSON.parse(r.place) }));
  const r = yardRig(svc, town, { who, charId: o.character, key: A });
  await r.frames(8);
  assert.equal(r.yards.here()?.yard.bk, A, 'the owner stands on their own lot');
  const step = await r.ghostAt(1.8, -0.6);   // the door's wall is z 0, x 1.2 to 2.4: the chair 0.1 m off it
  assert.deepEqual([step.pos[0], step.pos[2]], [1.8, -0.6], 'the ghost before the door');
  assert.equal(r.tool.why(), null, 'the step before the owner\'s own door is the yard\'s: nothing said against it');
  assert.equal(await r.tool.commit(), true, 'placed');
  assert.deepEqual(rows().map((p) => [p.yard, p.pos[0], p.pos[2]]), [[1, 1.8, -0.6]], 'and written, in the yard');
  await r.ghostAt(-1.8, -1.8);
  assert.equal(r.tool.why(), YARD_IN_HOUSE, 'under the leg\'s roof: the house');
  assert.equal(await r.tool.commit(), false);
  // the stranger's house B, half turned 9 m east: its back x 5.4 to 12.6 by z -3.6 to 0, its open corner x 5.4 to 9 by
  // z 0 to 3.6 (its door at x 6.6 to 7.8 facing north into it) - in the owner's lot, which runs to x 9.6
  const theirs = town.built.homeFrames.get(B);
  const mine = town.built.homeFrames.get(A);
  assert.deepEqual(r3([[theirs.at[0] - mine.at[0], theirs.at[2] - mine.at[2]]]), [[9, 0]], 'nine metres east of the owner\'s');
  assert.deepEqual(r3(theirs.rects.map((q) => [q[0] - mine.at[0], q[1] - mine.at[2], q[2] - mine.at[0], q[3] - mine.at[2]])), [[9, 0, 12.6, 3.6], [5.4, -3.6, 12.6, 0]], 'its ground half turned: its leg north-east, its back south - the open corner north-west');
  await r.ghostAt(7.2, 1.8);
  assert.equal(r.tool.why(), null, 'the stranger\'s open corner is no building\'s ground - as the owner\'s own is not');
  await r.ghostAt(7.2, -1.8);
  assert.equal(r.tool.why(), YARD_ON_OTHER, 'under the stranger\'s roof it is theirs');
  assert.equal(await r.tool.commit(), false);
  assert.equal(rows().length, 1, 'the one piece written');
});

test('FB1009 HOME-FOOT the world host by source: every building\'s ground measured once per model and recorded beside its box at the build, a second model\'s ground joining the first\'s; the yard\'s lot and its neighbours read it (mutants: the host records no ground; a second model\'s ground dropped; the host measures the box)', () => {
  const w = src('src/scenes/world.js');
  assert.match(w, /import \{ modelFootRects, footRectsAt \} from '\.\/homeYards\.js';/);
  assert.match(w, /const modelFeetOf = \(id, cpu\) => \{\n\s*let rs = modelFeet\.get\(id\);\n\s*if \(!rs\) modelFeet\.set\(id, rs = modelFootRects\(cpu\.positions, cpu\.indices\)\);\n\s*return rs;\n\s*\};/);
  assert.match(w, /const rects = footRectsAt\(modelFeetOf\(placed\.modelIdNum, cpu\), local\);[^\n]*\n\s*const f = pixelHomeFrames\.get\(homeKey\);\n\s*if \(!f && at\) pixelHomeFrames\.set\(homeKey, \{ at, box: \[\.\.\.box\], rects \}\);\n\s*else if \(f\) \{ for \(let i = 0; i < 3; i\+\+\) \{ f\.box\[i\] = Math\.min\(f\.box\[i\], box\[i\]\); f\.box\[i \+ 3\] = Math\.max\(f\.box\[i \+ 3\], box\[i \+ 3\]\); \} f\.rects\.push\(\.\.\.rects\); \}/,
    'the ground beside the box, a second model\'s joined to the first\'s');
  const y = src('src/scenes/homeYards.js');
  assert.match(y, /lot: yardLot\(frame\.at, frame\.box, YARD_MARGIN, frame\.rects\)/);
  assert.match(y, /const ground = f\.rects\?\.length \? f\.rects : \[\[f\.box\[0\], f\.box\[2\], f\.box\[3\], f\.box\[5\]\]\];/);
});

test('FB1009 HOME-FOOT the game\'s own houses (ARENA2): Hammerfell\'s two-storey house (ARCH3D 709) - its forecourt and the step before its ground door the yard\'s, its body the house; and over every desert town\'s houses, the step 1.5 m before each ground-floor door the box called "inside your house" for 5,166 of 11,701 and the ground for under a thousand (a porch under its own roof), while a point 2 m inside every door is still the house', { skip: skipReal }, () => {
  const { maps, blocks, modelOf } = game();
  const m = modelOf(709);
  const box = localAabb(m.positions);
  const lot = yardLot([0, 0, 0], box, YARD_MARGIN, homeYards.modelFootRects(m.positions, m.indices));
  const ground = m.doors.find((d) => (d.vert0.y + d.vert2.y) / 2 < 2);
  const c = [(ground.vert0.x + ground.vert2.x) / 2, 0, (ground.vert0.z + ground.vert2.z) / 2];
  assert.deepEqual([c[0], c[2], ground.normal.z].map((v) => Math.round(v * 100) / 100 + 0), [-5.43, -3.2, -1], 'its ground door in the body\'s south wall, 3.2 m inside its box');
  const before = [c[0], 0, c[2] - 1.5];
  assert.equal(yardWhyNot(before, yardLot([0, 0, 0], box), [], CHAIR), YARD_IN_HOUSE, 'the box held its forecourt');
  assert.equal(yardWhyNot(before, lot, [], CHAIR), null, 'its ground leaves it open');
  assert.equal(yardWhyNot([c[0], 0, c[2] + 2], lot, [], CHAIR), YARD_IN_HOUSE, 'inside the door, the house');
  assert.equal(yardWhyNot([4.8, 0, -4.8], lot, [], CHAIR), YARD_IN_HOUSE, 'its outside stair is its own');
  // every desert town (climates 224 and 225), each building framed as world.js frames it
  const feet = new Map();
  const feetOf = (id, cpu) => { if (!feet.has(id)) feet.set(id, homeYards.modelFootRects(cpu.positions, cpu.indices)); return feet.get(id); };
  let houses = 0, boxIn = 0, groundIn = 0, insideOut = 0;
  for (let r = 0; r < 62; r++) {
    for (let l = 0; l < (maps.baseLocationCount(r) ?? 0); l++) {
      const loc = maps.getLocation(r, l);
      if (!loc?.exterior?.exteriorData?.width) continue;
      const p = longitudeLatitudeToMapPixel(loc.mapTableData.longitude, loc.mapTableData.latitude);
      const climate = maps.getClimateIndex(p.x, p.y);
      if (climate !== 224 && climate !== 225) continue;
      const laid = layoutLocation(loc, maps, blocks);
      const tp = getLocationTerrainTileOrigin(loc);
      const locLocal = [tp.x * 6.4, 0, tp.y * 6.4];
      const frames = new Map();
      for (const b of laid.blocks) {
        const om = trs(locLocal[0] + b.originX, 0, locLocal[2] + b.originZ, 0, 0, 0);
        for (const placed of b.layout.models) {
          if (!Number.isSafeInteger(placed.recordIndex)) continue;
          const cpu = modelOf(placed.modelIdNum);
          if (!cpu) continue;
          const local = multiply(om, placed.matrix);
          const bx = transformedAabb(localAabb(cpu.positions), local);
          const k = makeBuildingKey(b.x, b.y, placed.recordIndex);
          const at = [locLocal[0] + b.originX + placed.recordAt[0], placed.recordAt[1], locLocal[2] + b.originZ + placed.recordAt[2]];
          const rects = homeYards.footRectsAt(feetOf(placed.modelIdNum, cpu), local);
          let f = frames.get(k);
          if (!f) frames.set(k, (f = { at, box: [...bx], rects, doors: [] }));
          else { for (let i = 0; i < 3; i++) { f.box[i] = Math.min(f.box[i], bx[i]); f.box[i + 3] = Math.max(f.box[i + 3], bx[i + 3]); } f.rects.push(...rects); }
          for (const d of cpu.doors ?? []) {
            const dc = { x: (d.vert0.x + d.vert2.x) / 2, y: (d.vert0.y + d.vert2.y) / 2, z: (d.vert0.z + d.vert2.z) / 2 };
            if (d.type !== DOOR_TYPE.BUILDING || dc.y >= 2) continue;   // a ground-floor door
            const nx = local[0] * d.normal.x + local[8] * d.normal.z, nz = local[2] * d.normal.x + local[10] * d.normal.z, nl = Math.hypot(nx, nz) || 1;
            f.doors.push({ x: local[0] * dc.x + local[4] * dc.y + local[8] * dc.z + local[12], z: local[2] * dc.x + local[6] * dc.y + local[10] * dc.z + local[14], nx: nx / nl, nz: nz / nl });
          }
        }
      }
      const home = new Map(buildingSummaries(loc.exterior?.buildings ?? [], laid.blocks, { locationIndex: loc.locationIndex ?? 0, locationName: loc.name }).map((s) => [s.buildingKey, homeCandidate(s)]));
      for (const [k, f] of frames) {
        if (!home.get(k) || !f.doors.length) continue;
        houses++;
        const d = f.doors[0];
        const front = [d.x + d.nx * 1.5 - f.at[0], 0, d.z + d.nz * 1.5 - f.at[2]];
        const inside = [d.x - d.nx * 2 - f.at[0], 0, d.z - d.nz * 2 - f.at[2]];
        if (yardWhyNot(front, yardLot(f.at, f.box), [], CHAIR) === YARD_IN_HOUSE) boxIn++;
        const lot = yardLot(f.at, f.box, YARD_MARGIN, f.rects);
        if (yardWhyNot(front, lot, [], CHAIR) === YARD_IN_HOUSE) groundIn++;
        if (yardWhyNot(inside, lot, []) !== YARD_IN_HOUSE) insideOut++;
      }
    }
  }
  assert.ok(houses > 11_000, `the desert's houses with a ground-floor door (${houses})`);
  assert.ok(boxIn > 5_000, `the box called the step before the door the house for ${boxIn}`);
  assert.ok(groundIn < 1_000, `the ground calls it so for ${groundIn} - a door under its own roof`);
  assert.equal(insideOut, 0, 'and a point 2 m inside every door is still the house');
});

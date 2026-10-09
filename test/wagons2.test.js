// WAGONS2 (2026-10-09, Mac: "3. People should be able to use the interior just like houses ... 4. ... see inside/outside
// of house windows + the new wagon. 5. Exterior and interior texture customization of the wagons"; asked, the caravan's
// room "Caravan-shaped", its paint "Free, any time"): the caravan's own room (world/caravanRoomModel.js, systems/
// caravanRoom.js, scenes/caravanRoom.js) and the wagons' paint (systems/wagonLooks.js, world/wagonArt.js's paints, the
// pool's draw, the word, the park record, the Stable and the decorator), and the Overworld's riders.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  WAGON_OUTSIDE_LOOKS, CARAVAN_INSIDE_LOOKS, CARAVAN_INSIDE_PARTS, LOOK_COUNT, LOOK_NAMES, LOOK_TEXT, readWagonLook, wagonLookOf,
  wagonLookCode, wagonLookOfCode, WAGON_LOOK_CODE_MAX, paintedWagon, paintDrivenWagon, caravanPaintRows, outsidePaintRow,
} from '../src/systems/wagonLooks.js';
import { newWagonItem } from '../src/systems/wagonKinds.js';
import {
  wagonArt, wagonLookArt, TEX, WAGON_ARCHIVE, LOOK_RECORDS, LOOK_RECORD_STRIDE, lookRecord, isGlassRecord, CARAVAN_SIDE_WINDOW,
  CARAVAN_FRONT_WINDOW, SIDE_Y0, SIDE_Y1,
} from '../src/world/wagonArt.js';
import { caravanRoomModel, CARAVAN_ROOM, CARAVAN_ENTER, CARAVAN_LANTERN, ceilingArc } from '../src/world/caravanRoomModel.js';
import { wagonGeometry, MEASURED, LIFT } from '../src/world/wagonModels.js';
import { caravanRoomBlock, CARAVAN_ROOM_MODEL_ID, roomToSaved, savedToRoom, turnCaravanScene, readCaravanRoom } from '../src/systems/caravanRoom.js';
import { caravanRoomEntry, caravanRoomRecords, caravanRoomPictures, paintCaravanRoom, serveRoomModels, CARAVAN_LIVE_CHOICE } from '../src/scenes/caravanRoom.js';
import { buildInteriorContext } from '../src/scenes/interiorContext.js';
import { interiorLightProperties } from '../src/world/interiorLights.js';
import { billboardSize } from '../src/world/rmbFlats.js';
import { createHorseCartPool } from '../src/scenes/horseCartPool.js';
import { hccWireRecord, validHccRecord, HCC_WIRE_KIND } from '../src/systems/horseCartWire.js';
import { validParkData, PARK_WAGON_LOOK_MAX } from '../src/net/wire.js';
import { stableProviderFor } from '../src/ui/holdingsPages.js';
import { createDecorPanel } from '../src/ui/decorPanel.js';
import { toolRig, fakeDoc, fakeWin, all, one } from './decorFakes.mjs';
import { createWagonRiders, RIDE_LOST_GRACE_MS } from '../src/scenes/wagonRiders.js';

const src = (p) => readFileSync(new URL(`../src/${p}`, import.meta.url), 'utf8');
const bakeOf = (kind) => JSON.parse(readFileSync(new URL(`../src/assets/wagons/${kind}.json`, import.meta.url), 'utf8'));
const tick = () => new Promise((r) => setTimeout(r, 0));
const flush = async (n = 8) => { for (let i = 0; i < n; i++) await tick(); };
const near = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;
const alphaAt = (pic, x, y) => pic.data[(y * pic.width + x) * 4 + 3];

test('WAGONS2 THE PAINT\'S LAW: six choices a list, the first the wagon as built; a look is checked to what the law knows, one wire number of four base-six digits, the relay\'s bound the law\'s; the outside paints any wagon, the inside only a caravan, the built look kept as no field; the driven wagon painted in the pack, said (mutants: a digit dropped from the code, an unknown choice kept, the inside painted on a cart, the built look kept as a field)', () => {
  for (const list of [...Object.values(WAGON_OUTSIDE_LOOKS), ...Object.values(CARAVAN_INSIDE_LOOKS)]) {
    assert.equal(list.length, LOOK_COUNT);
    for (const k of list) assert.equal(typeof LOOK_NAMES[k], 'string', k);
  }
  assert.deepEqual([WAGON_OUTSIDE_LOOKS.cart[0], WAGON_OUTSIDE_LOOKS.openWagon[0], WAGON_OUTSIDE_LOOKS.caravan[0]], ['oak', 'cream', 'green'], 'as built');
  assert.deepEqual(readWagonLook({ o: 7, w: -1, f: 2.5, c: 3 }), { o: 0, w: 0, f: 0, c: 3 });
  assert.deepEqual(readWagonLook(null), { o: 0, w: 0, f: 0, c: 0 });
  const seen = new Set();
  for (let code = 0; code <= WAGON_LOOK_CODE_MAX; code++) { const l = wagonLookOfCode(code); assert.equal(wagonLookCode(l), code); seen.add(JSON.stringify(l)); }
  assert.equal(seen.size, LOOK_COUNT ** 4, 'every look its own code');
  assert.deepEqual(wagonLookOfCode(WAGON_LOOK_CODE_MAX + 1), readWagonLook(null));
  assert.equal(PARK_WAGON_LOOK_MAX, WAGON_LOOK_CODE_MAX, 'the relay keeps exactly the codes the law makes');
  const cart = newWagonItem('cart'), caravan = newWagonItem('caravan');
  assert.deepEqual(paintedWagon(cart, 'outside', 2).wagonLook, { o: 2, w: 0, f: 0, c: 0 });
  assert.equal(paintedWagon(cart, 'walls', 2), null, 'a cart has no inside');
  assert.equal(paintedWagon(newWagonItem('openWagon'), 'ceiling', 2), null, 'nor an open wagon');
  assert.deepEqual(paintedWagon(caravan, 'floor', 4).wagonLook, { o: 0, w: 0, f: 4, c: 0 });
  assert.equal('wagonLook' in paintedWagon({ ...caravan, wagonLook: { f: 4 } }, 'floor', 0), false, 'painted back as built: no field');
  assert.equal(paintedWagon({ templateIndex: 1 }, 'outside', 1), null);
  const items = [{ templateIndex: 2 }, newWagonItem('openWagon'), caravan];
  assert.deepEqual(paintDrivenWagon(items, 'outside', 3), { ok: true, text: LOOK_TEXT.painted('Ochre') }, 'the caravan driven - the best owned');
  assert.equal(items[2].wagonLook.o, 3);
  assert.equal(items[1].wagonLook, undefined, 'the open wagon left as it is');
  assert.deepEqual(paintDrivenWagon(items, 'ceiling', 2), { ok: true, text: LOOK_TEXT.paintedInside('ceiling', 'Night sky') });
  assert.deepEqual(paintDrivenWagon([newWagonItem('cart')], 'walls', 1), { ok: false, text: LOOK_TEXT.notCaravan });
  assert.deepEqual(paintDrivenWagon([], 'outside', 1), { ok: false, text: LOOK_TEXT.noWagon });
  assert.deepEqual(caravanPaintRows(items[2].wagonLook).map((r) => [r.part, r.current, r.choices.length]), [['walls', 0, 6], ['floor', 0, 6], ['ceiling', 2, 6]]);
  assert.deepEqual(outsidePaintRow(items), { choices: WAGON_OUTSIDE_LOOKS.caravan.map((k) => LOOK_NAMES[k]), current: 3 });
  assert.equal(outsidePaintRow([]), null);
});

test('WAGONS2 THE PAINTS\' PICTURES: each choice past the first painted to its own records, a stride from the built ones, the same bytes every time and not the built picture; the caravan\'s glass a hole - its sides\' and its room\'s windows exactly where the side\'s picture puts them, its front\'s round window - and nothing else of any picture see-through (mutants: the glass left opaque, a paint\'s picture its built one)', () => {
  const built = new Map(wagonArt());
  assert.equal(built.size, 20);
  for (const [list, names] of [...Object.entries(WAGON_OUTSIDE_LOOKS), ...Object.entries(CARAVAN_INSIDE_LOOKS)]) {
    assert.deepEqual(wagonLookArt(list, 0, names[0]), [], 'the built choice paints nothing here');
    for (let i = 1; i < names.length; i++) {
      const pics = wagonLookArt(list, i, names[i]);
      assert.deepEqual(pics.map(([rec]) => rec), LOOK_RECORDS[list].map((rec) => rec + LOOK_RECORD_STRIDE * i), `${list} ${names[i]}`);
      const again = wagonLookArt(list, i, names[i]);
      pics.forEach(([rec, pic], k) => {
        assert.deepEqual([pic.width, pic.height], [64, 64]);
        assert.deepEqual(pic.data, again[k][1].data, 'from numbers, the same every time');
        assert.notDeepEqual(pic.data, built.get(rec % LOOK_RECORD_STRIDE).data, `${list} ${names[i]} is its own picture`);
      });
    }
  }
  const all = [...built, ...Object.entries(WAGON_OUTSIDE_LOOKS).flatMap(([l, n]) => n.flatMap((k, i) => wagonLookArt(l, i, k))), ...Object.entries(CARAVAN_INSIDE_LOOKS).flatMap(([l, n]) => n.flatMap((k, i) => wagonLookArt(l, i, k)))];
  const { x0, x1, y0, y1 } = CARAVAN_SIDE_WINDOW;
  for (const [rec, pic] of all) {
    const holes = [];
    for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) if (alphaAt(pic, x, y) !== 255) holes.push([x, y, alphaAt(pic, x, y)]);
    assert.equal(holes.every(([, , a]) => a === 0), true, 'a texel is whole or a hole');
    const base = rec % LOOK_RECORD_STRIDE;
    assert.equal(isGlassRecord(rec), [TEX.caravanSide, TEX.caravanFront, TEX.roomSide, TEX.roomFront].includes(base));
    if (base === TEX.caravanSide || base === TEX.roomSide) {
      const glass = [];
      for (let y = y0 + 1; y < y1; y++) for (let x = x0 + 1; x < x1; x++) if (x !== ((x0 + x1) >> 1) && y !== ((y0 + y1) >> 1)) glass.push([x, y]);
      assert.deepEqual(holes.map(([x, y]) => [x, y]).sort((a, b) => a[1] - b[1] || a[0] - b[0]), glass.sort((a, b) => a[1] - b[1] || a[0] - b[0]), `record ${rec}: its window's panes, its frame and its lead whole`);
    } else if (base === TEX.caravanFront || base === TEX.roomFront) {
      const { cx, cy, glassR } = CARAVAN_FRONT_WINDOW;
      assert.ok(holes.length > 40 && holes.every(([x, y]) => Math.hypot(x - cx, y - cy) <= glassR), `record ${rec}: the round window's panes alone`);
    } else assert.equal(holes.length, 0, `record ${rec} has no glass`);
  }
});

/** A point's picture coordinate on the faces of `model` wearing record `rec` (mod the paint stride) that hold the point
 *  in their plane - or null. */
function uvAt(model, rec, p, normalSign = null) {
  const P = (i) => [model.positions[i * 3], model.positions[i * 3 + 1], model.positions[i * 3 + 2]];
  for (const sm of model.subMeshes) {
    if ((sm.textureRecord ?? sm.record) % LOOK_RECORD_STRIDE !== rec) continue;
    for (let t = sm.startIndex; t < sm.startIndex + sm.primitiveCount * 3; t += 3) {
      const [ia, ib, ic] = [model.indices[t], model.indices[t + 1], model.indices[t + 2]];
      const a = P(ia), b = P(ib), c = P(ic);
      const n = [(b[1] - a[1]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[1] - a[1]), (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]), (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])];
      const nl = Math.hypot(...n);
      if (nl < 1e-9 || (normalSign && Math.sign(n[0]) !== normalSign[0] && Math.abs(n[0]) / nl > 0.9)) continue;
      // project on the face's dominant plane and take barycentrics there
      const ax = Math.abs(n[0]) > Math.abs(n[2]) ? [1, 2] : [0, 1];
      const q = (v) => [v[ax[0]], v[ax[1]]], A = q(a), B = q(b), C = q(c), X = q(p);
      const d = (B[0] - A[0]) * (C[1] - A[1]) - (C[0] - A[0]) * (B[1] - A[1]);
      if (Math.abs(d) < 1e-12) continue;
      const u = ((X[0] - A[0]) * (C[1] - A[1]) - (C[0] - A[0]) * (X[1] - A[1])) / d, v = ((B[0] - A[0]) * (X[1] - A[1]) - (X[0] - A[0]) * (B[1] - A[1])) / d;
      if (u < -1e-9 || v < -1e-9 || u + v > 1 + 1e-9) continue;
      const plane = Math.abs(((p[0] - a[0]) * n[0] + (p[1] - a[1]) * n[1] + (p[2] - a[2]) * n[2]) / nl);
      if (plane > 0.2) continue;
      const uvs = (i) => [model.uvs[i * 2], model.uvs[i * 2 + 1]];
      const [ua, ub, uc] = [uvs(ia), uvs(ib), uvs(ic)];
      return [ua[0] + u * (ub[0] - ua[0]) + v * (uc[0] - ua[0]), ua[1] + u * (ub[1] - ua[1]) + v * (uc[1] - ua[1])];
    }
  }
  return null;
}
const texelAt = (uv) => [((Math.floor(uv[0] * 64) % 64) + 64) % 64, Math.min(63, Math.max(0, Math.floor((1 - uv[1]) * 64)))];

test('WAGONS2 THE ROOM\'S MODEL: the caravan\'s inside - a floor, two sides, two ends under a barrel ceiling through both eaves and the peak - every face looking into the room, all of it inside the body; and its windows MEET the caravan\'s: a point of a side or the front is glass in the room\'s picture exactly where it is glass in the caravan\'s (mutants: a wall facing out, the side\'s u from the other side, the room\'s ends swapped)', () => {
  const R = CARAVAN_ROOM, M = MEASURED.caravan;
  assert.ok(R.halfX < M.sideX && R.floorY >= M.floorY - LIFT && R.peakY < M.endTopY - LIFT && R.rearZ > M.rearZ && R.frontZ < M.bedZ[1], 'inside the body');
  const arc = ceilingArc();
  assert.ok(near(Math.hypot(R.halfX, R.eavesY - arc.cy), arc.r) && near(arc.cy + arc.r, R.peakY), 'the barrel through both eaves and the peak');
  const room = caravanRoomModel();
  const centre = [0, (R.floorY + R.peakY) / 2, (R.rearZ + R.frontZ) / 2];
  for (let t = 0; t < room.indices.length; t += 3) {
    const v = [0, 1, 2].map((j) => { const i = room.indices[t + j]; return [room.positions[i * 3], room.positions[i * 3 + 1], room.positions[i * 3 + 2]]; });
    const e1 = v[1].map((x, k) => x - v[0][k]), e2 = v[2].map((x, k) => x - v[0][k]);
    const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    const g = v[0].map((x, k) => (x + v[1][k] + v[2][k]) / 3);
    assert.ok(n[0] * (centre[0] - g[0]) + n[1] * (centre[1] - g[1]) + n[2] * (centre[2] - g[2]) > 0, `triangle ${t / 3} looks into the room`);
    for (const p of v) assert.ok(Math.abs(p[0]) <= R.halfX + 1e-6 && p[1] >= R.floorY - 1e-6 && p[1] <= R.peakY + 1e-6 && p[2] >= R.rearZ - 1e-6 && p[2] <= R.frontZ + 1e-6);
  }
  assert.deepEqual(room.subMeshes.map((s) => s.textureRecord), [TEX.roomFloor, TEX.roomSide, TEX.roomCeiling, TEX.roomRear, TEX.roomFront]);
  // the windows meet: the body's faces as baked (wagonGeometry's statics, the lifted frame)
  const body = wagonGeometry(bakeOf('caravan')).statics;
  const bodyModel = { ...body, subMeshes: body.subMeshes.map((sm, k) => ({ ...sm, textureRecord: body.slots[k].record })) };
  const art = new Map(wagonArt());
  const glass = (rec, uv) => { const [x, y] = texelAt(uv); return alphaAt(art.get(rec), x, y) === 0; };
  let sideGlass = 0, frontGlass = 0;
  for (const side of [1, -1]) for (let z = R.rearZ + 0.05; z < R.frontZ - 0.05; z += 0.05) for (let y = SIDE_Y0 - LIFT + 0.85; y < SIDE_Y1 - LIFT - 0.1; y += 0.05) {
    const out = uvAt(bodyModel, TEX.caravanSide, [side * M.sideX, y, z]);
    const inn = uvAt(room, TEX.roomSide, [side * R.halfX, y, z]);
    assert.ok(out && inn, `both walls at ${side} ${y.toFixed(2)} ${z.toFixed(2)}`);
    const o = glass(TEX.caravanSide, out), i = glass(TEX.roomSide, inn);
    if (o && i) sideGlass++;
    // THE SAME TEXEL: the room's wall and the caravan's side lay one point on one texel of their two pictures (away
    // from a texel's edge, where a hair of rounding may fall either way), so their windows are one window
    const onEdge = (uv) => uv.some((c) => Math.abs(c * 64 - Math.round(c * 64)) < 1e-6);
    if (!onEdge(out) && !onEdge(inn)) assert.deepEqual(texelAt(inn), texelAt(out), `side ${side}, ${y.toFixed(2)}, ${z.toFixed(2)}`);
  }
  for (let x = -0.4; x <= 0.4; x += 0.02) for (let y = 1.3; y <= 1.8; y += 0.02) {
    const out = uvAt(bodyModel, TEX.caravanFront, [x, y, M.bedZ[1]]);
    const inn = uvAt(room, TEX.roomFront, [x, y, R.frontZ]);
    if (!out || !inn) continue;
    if (glass(TEX.caravanFront, out) && glass(TEX.roomFront, inn)) frontGlass++;
    assert.deepEqual(texelAt(inn), texelAt(out), `the front at ${x.toFixed(2)}, ${y.toFixed(2)}`);
  }
  assert.ok(sideGlass > 100, `the side windows meet (${sideGlass} points)`);
  assert.ok(frontGlass > 20, `the round window meets (${frontGlass} points)`);
});

/** The interior builder over fakes (test/audit68_scenes_ab.test.js's shape): a texture of `h` metres' height a record. */
function builderDeps() {
  const cpuModels = new Map();
  const uploads = [];
  const renderer = {
    createBillboardBatch: (a, r, s, c) => ({ a, r, s, c }), destroyBatch() {}, destroyMesh() {}, createMesh: (m) => ({ m }),
    uploadTexture: (a, r, px, o) => uploads.push([a, r, o]), evictTexture() {},
  };
  const tex = { recordCount: 40, getSize: () => ({ width: 32, height: 64 }), getScale: () => ({ width: 0, height: 0 }), getFrameCount: () => 1 };
  const hold = { getGpuMesh: async (id) => { cpuModels.set(id, null); return null; }, uploadRecord() {}, uploadRecordFrame() {}, release() {}, settle() {} };
  return { cpuModels, renderer, tex, hold, uploads };
}

test('WAGONS2 THE ROOM BUILT BY THE INTERIOR HOST: the caravan\'s block read as any record is - its model served through the building\'s hold (never asked of ARCH3D), drawn and solid, its floor under the enter marker, the room stood at the caravan\'s pose and turned with it, its lantern hung from the roof and lit, nothing of it furniture to take out (mutants: the hold not serving the room, the lantern not hung, the room unturned)', async () => {
  const { cpuModels, renderer, tex, hold } = builderDeps();
  const e = caravanRoomEntry({ v: 2, kind: 'caravan', origin: [100, 10, 200], turn: 90, step: [0, 0, 0], yaw: 0 }, (p) => p, { renderer });
  serveRoomModels(hold, e.hit.roomModels, renderer, cpuModels);
  const ctx = await buildInteriorContext({ renderer, getGpuMesh: hold.getGpuMesh, cpuModels, getTexture: async () => tex, uploadRecord() {}, uploadRecordFrame() {}, palette: null, placeHold: hold },
    e.hit.dfBlock, e.hit.dfBlock.index, 0, 2, 0, e.hit.door.matrix, { houseOwned: true, peopleVisible: false, baseEditable: true });
  assert.equal(cpuModels.get(CARAVAN_ROOM_MODEL_ID), e.hit.roomModels.get(CARAVAN_ROOM_MODEL_ID), 'the model stood in the pipeline\'s map for the read');
  assert.equal(ctx.drawList.length, 1, 'the room, drawn');
  const turned = (p) => [100 + p[2], 10 + p[1], 200 - p[0]];   // Ry(90): local +z -> world +x, local +x -> world -z
  const [mx, my, mz] = turned(CARAVAN_ENTER);
  assert.equal(ctx.enterMarkers.length, 1);
  assert.ok(ctx.enterMarkers[0].every((v, k) => near(v, [mx, my, mz][k], 1e-4)), 'the marker inside the door, turned with the caravan');
  const d = ctx.collider.raycast([mx, my + 1, mz], [0, -1, 0], 3);
  assert.ok(near(d, 1, 1e-3), 'the floor under it, solid');
  const h = billboardSize(tex, 22).h;
  assert.equal(ctx.lights.length, 1, 'the lantern lights the room');
  const [lx, , lz] = turned(CARAVAN_LANTERN);
  assert.ok(near(ctx.lights[0].x, lx, 1e-4) && near(ctx.lights[0].z, lz, 1e-4));
  assert.ok(near(ctx.lights[0].foot, 10 + CARAVAN_LANTERN[1] - h / 2, 1e-4), 'hung: its middle half its height under the roof');
  assert.deepEqual([ctx.lights[0].range, ctx.lights[0].intensity], [interiorLightProperties(22).range, interiorLightProperties(22).intensity]);
  assert.deepEqual((ctx.base.list?.() ?? []).map((x) => x.key), ['f0:210.22'], 'the room itself is not furniture to take out - its lantern is, as a house\'s own is');
  // a room of Daggerfall's is untouched by the serving
  const plain = { getGpuMesh: () => 'pipeline' };
  assert.equal(serveRoomModels(plain, null, renderer, cpuModels).getGpuMesh, plain.getGpuMesh);
  ctx.destroy();
});

test('WAGONS2 THE ROOM\'S THINGS KEPT UNTURNED: what the room holds is saved in its own frame - the caravan parked another way round, its furniture, its floor\'s piles and its torches stand where they stood in it, each piece turned with the room - the interior host turning the scene at its cache and its restore; and a room that travels (a caravan, a ship\'s cabin) is no town\'s layout (mutants: the save unturned, the restore unturned, a piece\'s heading left)', () => {
  const p = [1, 2, 3];
  assert.ok(roomToSaved(savedToRoom(p, 37), 37).every((v, k) => near(v, p[k])));
  assert.ok(savedToRoom([0, 0, 1], 90).every((v, k) => near(v, [1, 0, 0][k])), 'turned 90: the room\'s fore is the world\'s +x');
  const visit = { droppedPiles: [{ pos: [1, 0, 0], items: [1] }], droppedTorches: [{ position: [0, 1, 2], time: 5 }], decor: [{ id: 'a', pos: [0, 0, 2], rot: [10, 0, 0], scale: 1 }], decorItems: { a: [] }, frame: 'building' };
  const saved = turnCaravanScene(visit, 90);   // parked heading +x
  assert.ok(saved.decor[0].pos.every((v, k) => near(v, [-2, 0, 0][k])));
  assert.equal(saved.decor[0].rot[0], -80);
  assert.deepEqual(saved.decorItems, visit.decorItems);
  assert.deepEqual(visit.decor[0].pos, [0, 0, 2], 'the visit\'s own untouched');
  const back = turnCaravanScene(saved, -180);   // the next visit, parked heading -z
  assert.ok(back.decor[0].pos.every((v, k) => near(v, savedToRoom([-2, 0, 0], 180)[k])));
  assert.equal(back.decor[0].rot[0], 100);
  assert.ok(back.droppedPiles[0].pos.every((v, k) => near(v, savedToRoom(roomToSaved([1, 0, 0], 90), 180)[k])));
  assert.ok(back.droppedTorches[0].position.every((v, k) => near(v, savedToRoom(roomToSaved([0, 1, 2], 90), 180)[k])));
  assert.equal(turnCaravanScene(visit, 0), visit, 'unturned, as it is');
  const wm = src('scenes/worldModes.js');
  assert.match(wm, /if \(isCaravanRoom\(interiorCabin\)\) state = turnCaravanScene\(state, interiorCabin\.turn\);/);
  assert.match(wm, /if \(isCaravanRoom\(interiorCabin\)\) data = turnCaravanScene\(data, -interiorCabin\.turn\);/);
  assert.match(wm, /const townKey = interiorCabin \? null : layoutLocationKeyOfMapId\(/);
  assert.match(wm, /if \(interiorCabin\) _visitLayout = null;/);
  assert.equal(readCaravanRoom({ v: 2, kind: 'caravan', origin: [0, 0, 0], turn: 45, step: [0, 0, 0], yaw: 0 }).turn, 45);
});

function fakeRenderer() {
  const r = { textures: new Map(), draws: [], evicted: [] };
  r.uploadTexture = (a, rec, px, o) => { const k = `${a}_${rec}${o?.opaque ? '#opaque' : ''}`; if (!r.textures.has(k)) r.textures.set(k, { px, o }); };
  r.evictTexture = (k) => { r.evicted.push(k); r.textures.delete(k); };
  r.createMesh = (model) => ({ model });
  r.drawMesh = (gpu, m, remap, o) => r.draws.push({ gpu, remap, o });
  r.createBillboardBatch = () => ({ origin: [0, 0, 0] });
  r.destroyBillboardBatch = () => {};
  return r;
}
const parked = { isGrounded: true, position: [10, 1, 10], rotation: [0, 0, 0, 1], cargoTier: 0 };
const runtimeOf = (view) => ({ view: () => ({ state: { HorseName: '', HorseMode: 0, Mode: 2, WorldX: 10, WorldZ: 10 }, moving: null, deployed: parked, horse: null, teamFollowing: false, horseFollowing: false, persistence: true, ...view }), lateUpdate() {}, actionRows: () => [] });

test('WAGONS2 THE PAINT ON THE WAGON: the pool draws the driven wagon in its paint - its body and wheels through a remap to the paint\'s records, painted once - and a caravan\'s room inside its body in its inside\'s paint, casting no shadow; the word says the paint (`wl`) and a reader draws by it, a bad code as built; a parked wagon\'s record carries it and the relay keeps no code the law does not make (mutants: the look unread, the room casting a shadow, wl dropped from the park word, the relay keeping a bad code)', async () => {
  const r = fakeRenderer();
  const look = { o: 2, w: 1, f: 3, c: 0 };
  const pool = createHorseCartPool({ renderer: r, meshes: null, collider: () => null, now: () => 0, wagonKind: () => 'caravan', wagonLook: () => look, bakedWagon: async (k) => bakeOf(k) });
  pool.attach(runtimeOf({}));
  pool.partsOf('caravan');
  await flush();
  r.draws.length = 0;
  assert.equal(pool.draw(r), 1);
  const body = r.draws[0], room = r.draws[1];
  for (const rec of LOOK_RECORDS.caravan) assert.equal(body.remap.get(`${WAGON_ARCHIVE}_${rec}`), `${WAGON_ARCHIVE}_${lookRecord(rec, 2)}`);
  assert.equal(body.remap.size, LOOK_RECORDS.caravan.length);
  assert.ok(r.draws.slice(2).every((d) => d.remap === body.remap), 'its wheels in its paint');
  assert.equal(room.gpu.model.subMeshes.length, 5, 'the room inside');
  assert.deepEqual(room.o, { noShadow: true });
  assert.equal(room.remap.get(`${WAGON_ARCHIVE}_${TEX.roomSide}`), `${WAGON_ARCHIVE}_${lookRecord(TEX.roomSide, 1)}`);
  assert.equal(room.remap.get(`${WAGON_ARCHIVE}_${TEX.roomFloor}`), `${WAGON_ARCHIVE}_${lookRecord(TEX.roomFloor, 3)}`);
  assert.equal(room.remap.has(`${WAGON_ARCHIVE}_${TEX.roomCeiling}`), false, 'the ceiling as built');
  for (const rec of [...LOOK_RECORDS.caravan.map((x) => lookRecord(x, 2)), lookRecord(TEX.roomFloor, 3)]) assert.ok(r.textures.has(`${WAGON_ARCHIVE}_${rec}`) || r.textures.has(`${WAGON_ARCHIVE}_${rec}#opaque`), `record ${rec} uploaded`);
  const ups = r.textures.size;
  pool.draw(r);
  assert.equal(r.textures.size, ups, 'painted once');
  // the word
  const rec = hccWireRecord(pool.shown?.() ?? { wagon: { kind: HCC_WIRE_KIND.Deployed, position: [1, 1, 1], rotation: [0, 0, 0, 1], tier: 0, angle: 0, model: 'caravan', look } }, (p) => p);
  assert.equal(rec.wl, wagonLookCode(look));
  assert.deepEqual(validHccRecord(rec).w.look, look);
  assert.deepEqual(validHccRecord({ ...rec, wl: WAGON_LOOK_CODE_MAX + 1 }).w.look, readWagonLook(null), 'a code the law does not make: as built');
  pool.applyOwner('ann', { ...rec }, (p) => p, 0);
  assert.deepEqual(pool.peers.get('ann').wagon.look, look);
  // the park record
  const word = pool.parkWord((p) => p);
  assert.equal(word.r.wl, wagonLookCode(look));
  const kept = validParkData({ c: 'char-0001', a: [word.a[0], word.a[1]], r: word.r });
  assert.equal(kept.r.wl, wagonLookCode(look));
  assert.equal(validParkData({ c: 'char-0001', a: [word.a[0], word.a[1]], r: { ...word.r, wl: PARK_WAGON_LOOK_MAX + 1 } }).r.wl, undefined);
  assert.equal(validParkData({ c: 'char-0001', a: [word.a[0], word.a[1]], r: { ...word.r, wl: 0 } }).r.wl, undefined, 'as built: no field');
});

test('WAGONS2 THE PAINTERS: the Stable lists the driven wagon\'s outside paints and paints it on a press (free, the mod on or off), the host told; the room is painted into its LIVE records - each let go and given its paint\'s picture, glass cut out - so a paint chosen in the room is on its walls at once; the decorator\'s painter in a caravan paints a part on a chip\'s press and says so, and lists the inside\'s three parts (mutants: the Stable\'s paint not written, the live records not let go, the decorator\'s press unpainted)', async () => {
  const items = [newWagonItem('openWagon')];
  let told = 0;
  const p = stableProviderFor({ runtime: null, on: () => false, hasHorse: () => false, hasCart: () => true, items: () => items, onPainted: () => { told++; } });
  assert.deepEqual(p.stable().paint, { choices: WAGON_OUTSIDE_LOOKS.openWagon.map((k) => LOOK_NAMES[k]), current: 0 });
  assert.deepEqual(p.stableAct('paint', 1), { ok: true, text: LOOK_TEXT.painted('Red') });
  assert.equal(wagonLookOf(items[0]).o, 1);
  assert.equal(told, 1);
  // the live records
  assert.deepEqual(Object.values(caravanRoomRecords()).sort(), [TEX.roomSide, TEX.roomFront, TEX.roomRear, TEX.roomCeiling, TEX.roomFloor].map((x) => lookRecord(x, CARAVAN_LIVE_CHOICE)).sort());
  const r = fakeRenderer();
  paintCaravanRoom(r, { w: 2 });
  const side = lookRecord(TEX.roomSide, CARAVAN_LIVE_CHOICE);
  assert.ok(r.evicted.includes(`${WAGON_ARCHIVE}_${side}`) && r.evicted.includes(`${WAGON_ARCHIVE}_${side}#opaque`));
  assert.deepEqual(r.textures.get(`${WAGON_ARCHIVE}_${side}`).o, { cutout: true });
  const whitewash = new Map(wagonLookArt('walls', 2, 'whitewash'));
  assert.deepEqual(caravanRoomPictures({ w: 2 }).find(([rec]) => rec === side)[1].data, whitewash.get(lookRecord(TEX.roomSide, 2)).data);
  paintCaravanRoom(r, { w: 3 });
  assert.deepEqual(caravanRoomPictures({ w: 3 }).find(([rec]) => rec === side)[1].data, new Map(wagonLookArt('walls', 3, 'blue')).get(lookRecord(TEX.roomSide, 3)).data);
  assert.equal(r.evicted.filter((k) => k === `${WAGON_ARCHIVE}_${side}`).length, 2, 'let go each time');
  // the decorator
  const painted = [];
  const door = { caravan: caravanPaintRows({ w: 1 }), set: (part, i) => { painted.push([part, i]); return `The ${part} are now x.`; } };
  const rig = toolRig({ room: { kind: 'caravan', where: 'Your caravan' }, look: () => door });
  assert.equal(await rig.tool.paintAct('caravan', { part: 'floor', i: 4 }), true);
  assert.deepEqual(painted, [['floor', 4]]);
  assert.equal(await rig.tool.paintAct('preview', null), false, 'nothing tried on in a caravan');
  const doc = fakeDoc();
  const pressed = [];
  const panel = createDecorPanel({ doc, win: fakeWin(), onPlace() {}, onPaint: (what, look) => pressed.push([what, look]), thumbOf: async () => null });
  panel.open({ where: 'Your caravan', entries: [], progress: 1, ready: true, gold: 0, count: 0, cap: 200, placed: [], own: [], paint: door });
  const tab = all(panel.root, 'dfdecor-chip').find((c) => c.textContent === 'Paint');
  assert.ok(tab, 'the painter\'s tab');
  tab.fire('click');
  assert.deepEqual(all(panel.root, 'dfdecor-row').map((x) => x.dataset.key), ['walls', 'floor', 'ceiling']);
  assert.ok(all(panel.root, 'dfdecor-chip').some((c) => c.textContent === 'Whitewash'), 'the walls\' paints first');
  all(panel.root, 'dfdecor-row').find((x) => x.dataset.key === 'floor').fire('click');
  all(panel.root, 'dfdecor-chip').find((c) => c.textContent === 'Blue rug').fire('click');
  assert.deepEqual(pressed.filter(([w]) => w === 'caravan'), [['caravan', { part: 'floor', i: CARAVAN_INSIDE_LOOKS.floor.indexOf('blueRug') }]], 'a chip pressed paints its part');
  assert.equal(one(panel.root, 'dfdecor-pick-price').textContent, 'Free');
});

test('WAGONS2 THE OVERWORLD\'S RIDERS: a rider seated in another\'s wagon sets out on no journey of their own - the Overworld refuses it as it refuses a boat\'s passenger, and the party\'s walk never takes them; the owner\'s wagon unheard a moment is not the owner gone - the rider sits on through RIDE_LOST_GRACE_MS and only then stands down; a journey telling its riders cannot be set out on twice (mutants: no grace, the journey\'s guard gone)', () => {
  const w = src('scenes/world.js');
  assert.match(w, /if \(wagonRiders\?\.seated\(\)\) \{ tvSay\(TRAVEL_VIEW_TEXT\.rider\); return false; \}/);
  assert.match(w, /&& !wagonRiders\?\.seated\(\)   \/\/ WAGONS2/);
  assert.match(w, /if \(_goLeadBusy\) return;/);
  assert.match(w, /_goLeadBusy = true; try \{ await new Promise\(\(r\) => setTimeout\(r, GO_LEAD_MS\)\); \} finally \{ _goLeadBusy = false; \}/);
  // the grace, by execution
  let now = 0, word = { model: 'openWagon', kind: 1, passengers: [['me', 0]], go: null, declined: [], position: [0, 0, 0], wire: [0, 0, 0] };
  const said = [];
  const riders = createWagonRiders({
    selfId: () => 'me', name: (id) => id, now: () => now, say: (t) => said.push(t), changed() {},
    pool: { peerRide: () => word, peerSeat: () => ({ feet: [0, 0, 0], yaw: 0 }), mySeatCount: () => 0 },
    pin() {}, unpin() {}, jumpPressed: () => false, travel() {}, canTravel: () => true, traveling: () => false, prompt: { open() {}, render() {} },
  });
  riders.press('ann', 'wagon:ride', 1);
  riders.frame();
  assert.ok(riders.seated(), 'seated by the owner\'s word');
  word = null;
  now = 100; riders.frame();
  now = RIDE_LOST_GRACE_MS - 1; riders.frame();
  assert.ok(riders.seated(), 'a moment unheard: still sitting');
  word = { model: 'openWagon', kind: 1, passengers: [['me', 0]], go: null, declined: [], position: [0, 0, 0], wire: [0, 0, 0] };
  now = RIDE_LOST_GRACE_MS + 10; riders.frame();
  word = null;
  const t0 = now + 50;
  now = t0; riders.frame();
  now = t0 + RIDE_LOST_GRACE_MS - 1; riders.frame();
  assert.ok(riders.seated(), 'heard again: the grace starts over from the next frame unheard');
  now = t0 + RIDE_LOST_GRACE_MS; riders.frame();
  assert.equal(riders.seated(), false, 'past the grace: stood down');
});

// FIELD BUGS 2026-10-01 - HOME-YARD: "Decorating the exterior is bugged for houses." and "Exterior placement bounds
// shouldnt touch roads/pathways". Every pin walks the REAL yard: scenes/homeYards.js createHomeYards over the real
// decorator (scenes/decor/decorTool.js, ui/decorPanel.js), the real pool (scenes/decor/decorRoom.js), the real Collider
// (player/collider.js) and the real account service (the Worker over node:sqlite, test/accountDb.mjs) through the real
// client (net/accountClient.js accountDecor) - in a town of the producers' own (test/fb1001Town.mjs: the real layout,
// setLocationTiles and terrain kernel, the road painter's mask with it).
//   ROAD-LOT       - the lot let a piece stand on the town's street, its paths and the painter's track, and its marked
//                    edge ran across the road: refused now, and the edge runs along the road's side
//   YARD-CORNER    - a piece turned across the house's corner stood through it: the lot asked its corners, never the
//                    ground between them
//   YARD-STALE     - the town's yards read before a write and answered after it stood the yard as it was: the piece
//                    placed vanished (the one removed came back) for a minute
//   YARD-RECENTRE  - the world's recentre runs after the yards' frame and before the draw: every yard drawn (and solid)
//                    a whole pixel off for the crossing's frame
// `01-Overview/bugs/Field-Bugs-2026-10-01.md`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as homeYards from '../../src/scenes/homeYards.js';
import * as decorTool from '../../src/scenes/decor/decorTool.js';
import { DECAL_FLOATS } from '../../src/combat/blood/bloodDecals.js';
import { Collider } from '../../src/player/collider.js';
import { accountDecor, SESSION_KEY } from '../../src/net/accountClient.js';
import { RMB_TILE_SIDE } from '../../src/world/locationEntrance.js';
import { DIR } from '../../src/world/road/roadNetwork.js';
import { standService, sessionStorageOf, T0 } from '../accountDb.mjs';
import { realmAt } from '../realmSeat.mjs';
import { fakeDoc, fakeWin, fakeBlocks, rmb, TOWN, settle, ACTIONS } from '../decorFakes.mjs';
import { townPixel, houseAt, HOUSE_BOX, BENCH_MODEL, CHAIR_MODEL } from '../fb1001Town.mjs';

// read off the namespaces, so the code before the fix fails each pin on its own assertion rather than at the import
const { createHomeYards, yardLot, yardWhyNot, yardLotEdges, yardLotQuads, YARD_IN_HOUSE, YARD_ON_ROAD, YARD_TOWN_TTL_MS, YARD_WRITE_HOLD_MS, YARD_MARK_HIGH } = homeYards;
const { DECOR_LOT_MARKS } = decorTool;
const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const box = (x0, y0, z0, x1, y1, z1) => ({
  positions: new Float32Array([x0, y0, z0, x1, y0, z0, x1, y1, z0, x0, y1, z0, x0, y0, z1, x1, y0, z1, x1, y1, z1, x0, y1, z1]),
  indices: new Uint32Array([0, 1, 2, 0, 2, 3, 4, 6, 5, 4, 7, 6, 0, 4, 5, 0, 5, 1, 3, 2, 6, 3, 6, 7, 0, 3, 7, 0, 7, 4, 1, 5, 6, 1, 6, 2]),
});
const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

/** The town of the pins: house A in the block's middle, the street along its north (tile row 9, Daggerfall's road
 *  record 46), a road-grass edge (55) cutting into its lot's east, a field's own dirt edge (11) in its lot's south-east;
 *  house B at the block's west edge, its lot reaching the town's clearance where the road painter's track runs (11,
 *  the painter's own mark beside it). */
const ground = (x, y) => (y === 9 ? 46 : x === 9 && y === 8 ? 55 : x === 9 && y === 6 ? 11 : 2);
const theTown = () => townPixel({ houses: [houseAt(51.2, 51.2), houseAt(5, 51.2)], ground, network: { tracks: DIR.E | DIR.W } });

/**
 * One client's yards over the town `town` and the service `svc`: the owner `who` playing `charId`, whose home is the
 * building `key`; the pixel at `t` (mutable - the world's recentre). Answers the rig: the yards, the tool, the owner's
 * feet and eye, the wire, the decals, and helpers to aim a ghost.
 */
function yardRig(svc, town, { who, charId, key, t = [-300, 0, -350], gold = 5000, now = () => 0 }) {
  const T = [...t];
  const built = new Map([[`${town.built.px},${town.built.py}`, town.built]]);
  const collider = new Collider(() => town.floor);
  for (const [bk, f] of town.built.homeFrames) { const b = box(...f.box); collider.addMesh(`pixel:${bk}`, b.positions, b.indices, I, () => T); }
  const cpuModels = new Map([[CHAIR_MODEL, box(-0.5, -0.1, -0.5, 0.5, 0.9, 0.5)], [BENCH_MODEL, box(-1.5, 0, -0.3, 1.5, 0.8, 0.3)]]);
  const decals = [];
  const draws = [];
  const renderer = {
    createDecalBatch: (cap) => { const b = { cap, writes: [] }; decals.push(b); return b; },
    writeDecalSlot: (b, slot, floats) => { b.writes.push(Array.from(floats)); return true; },
    drawDecals() {}, destroyDecalBatch() {}, uploadTexture: () => 'tex',
    drawMesh: (gpu, m) => draws.push([gpu.gpu, m[12], m[13], m[14]]),
    createBillboardBatch: () => ({ bounds: [0, 0, 0, 1] }), destroyBillboardBatch() {},
  };
  const api = accountDecor({ fetch: svc.fetch, storage: sessionStorageOf(SESSION_KEY, who) });
  const gate = { hold: false, release: null };
  const wire = [];
  const door = {
    yards: async (m) => { const r = await api.yards(m); wire.push('yards'); if (gate.hold) await new Promise((res) => { gate.release = res; }); return r; },
    place: async (a) => { wire.push('place'); return api.place(a); },
    move: async (a) => { wire.push('move'); return api.move(a); },
    remove: async (a) => { wire.push('remove'); return api.remove(a); },
  };
  const purse = { n: gold };
  const f = town.built.homeFrames.get(key);
  const at = (rx, rz) => [T[0] + f.at[0] + rx, T[1] + town.floor, T[2] + f.at[2] + rz];
  const feet = { at: at(f.box[3] - f.at[0] + 2, 0) };   // two metres off the house's east wall
  const cam = { pos: [feet.at[0], town.floor + 1.6, feet.at[2]], yaw: 0, pitch: -Math.PI / 2 + 1e-6 };
  const doc = fakeDoc();
  const win = fakeWin();
  const said = [];
  const yards = createHomeYards({
    api: door,
    homes: { homeAt: (m, k) => (k === key ? { owner: who.handle, own: true, mine: true, look: null } : town.built.homeFrames.has(k) ? { owner: 'Tomas', own: false } : null) },
    built: () => built, translation: () => T, feet: () => feet.at, outside: () => true, eye: () => cam.pos,
    collider: () => collider, meshes: { getGpuMesh: async (id) => ({ gpu: id }), cpuModels }, renderer, getTexture: async () => ({ recordCount: 1 }), uploadRecord() {},
    scanDeps: () => ({ blocks: fakeBlocks([{ type: TOWN, block: rmb([CHAIR_MODEL, BENCH_MODEL]) }]), isTownBlock: (x) => x === TOWN, modelRadius: () => 0.8, flatRadius: async () => 0.2 }),
    character: () => charId,
    realm: () => async ({ reserve = null, apply = null, call }) => {   // systems/realmSaves.js realmGoldAct's order: held, asked where the record stands, kept or given back
      const undo = reserve ? reserve() : null;
      const r = await call(realmAt(svc.env, charId));
      if (r?.ok) apply?.(r); else undo?.();
      return r;
    },
    wallet: () => ({ get gold() { return purse.n; }, pay: (n) => { purse.n -= n; }, credit: (n) => { purse.n += n; } }), regionOf: () => 17,
    doc, win, canvas: null, touch: false, actionOf: (e) => ACTIONS.get(e.code) ?? null, locked: () => true, cursorOff() {}, stick: () => null,
    say: (l) => said.push(l), refusal: (w) => `refused: ${w}`, openSlot() {}, now,
  });
  const tool = yards.tool();
  const panel = () => doc.body.children.find((c) => c.className === 'dfdecor');
  const walk = (n, fn) => { fn(n); for (const k of n.children ?? []) walk(k, fn); };
  const click = (pred) => walk(panel(), (n) => { if (pred(n)) n.fire('click'); });
  async function frames(n = 1, overlayUp = false) { for (let i = 0; i < n; i++) { yards.frame({ dt: 0.1, cam, overlayUp }); await settle(); await settle(); } }
  /** A new piece of `model` chosen in the catalogue and its ghost aimed straight down at (rx, rz) from the house's frame,
   *  turned by `turns` presses of Turn Right (fifteen degrees each). Answers the ghost. */
  async function ghostAt(model, rx, rz, turns = 0) {
    if (tool.flying()) tool.back();
    else assert.equal(tool.openPanel(), true, 'the decorator opens on the lot');
    await frames(8, true);
    const p = at(rx, rz);
    cam.pos = [p[0], town.floor + 1.6, p[2]];
    click((n) => n.dataset?.key === `m${model}` && String(n.className).includes('dfdecor-row'));
    click((n) => n.tag === 'button' && n.textContent === 'Place');
    for (let i = 0; i < 8 && !tool.ghost(); i++) await frames(1);
    for (let i = 0; i < turns; i++) win.fire('keydown', { code: 'ArrowRight' });
    await frames(1);
    return tool.ghost();
  }
  /** The bands the decorator marked the lot's edge with, last written - each its foot [ax, az, bx, bz], in the frame. */
  function marked() {
    const b = decals.find((d) => d.cap === DECOR_LOT_MARKS);
    const w = b?.writes.at(-1);
    if (!w) return [];
    const out = [];
    for (let i = 0; i < b.cap; i++) {
      const o = i * DECAL_FLOATS;
      if (w.slice(o, o + DECAL_FLOATS).every((v) => v === 0)) continue;
      const o3 = o + 3 * (DECAL_FLOATS / 4);
      out.push([w[o] - T[0] - f.at[0], w[o + 2] - T[2] - f.at[2], w[o3] - T[0] - f.at[0], w[o3 + 2] - T[2] - f.at[2]].map((v) => Math.round(v * 100) / 100 + 0));
    }
    return out;
  }
  /** The piece `id` removed through the panel's "In this yard" view (the panel opened when it is not up). */
  async function removeVia(id) {
    if (tool.flying()) tool.back();
    else if (!tool.panelOpen()) tool.openPanel();
    await frames(4, true);
    click((n) => String(n.className).includes('dfdecor-chip') && /^In this yard/.test(n.textContent));
    await frames(1, true);
    click((n) => String(n.className).includes('dfdecor-row') && n.dataset?.key === id);
    await frames(1, true);
    click((n) => n.tag === 'button' && n.textContent === 'Remove');
    await frames(4, true);
  }
  return { yards, tool, T, f, feet, cam, wire, gate, purse, said, decals, draws, collider, frames, ghostAt, marked, at, removeVia };
}

/** The service, an owner with a home at `key` (a realm character's, bought on its record). */
async function seated(key) {
  const svc = await standService();
  const who = await svc.registered('Olga');
  const o = await svc.seatHome(who, { mapId: 7, buildingKey: key, region: 17, price: 5000 });
  assert.equal(o.status, 200, JSON.stringify(o.body));
  const rows = () => svc.env.DB._raw.prepare('SELECT id, yard, place FROM home_decor ORDER BY placed_at, id').all().map((r) => ({ id: r.id, yard: r.yard, ...JSON.parse(r.place) }));
  return { svc, who, charId: o.character, rows };
}

test('FB1001 ROAD-LOT: a yard\'s lot is no road - a piece on the town\'s street, on its road edge, or on the road painter\'s track beside the town is refused in the bar\'s own words and never written; the ground between the wall and the street, and a field\'s own dirt edge, stay the yard\'s (mutants: the road records unread; the painter\'s mark unread; the tile\'s side; the road test dropped)', async (t) => {
  t.mock.method(Date, 'now', () => T0 * 1000);
  const town = theTown();
  const [A] = town.keys;
  const { svc, who, charId, rows } = await seated(A);
  const r = yardRig(svc, town, { who, charId, key: A });
  await r.frames(8);
  assert.ok(r.yards.here(), 'the owner stands on the lot');
  // house A's lot is [-10, -9, 10, 9] round its frame; the street (tile row 9) covers z 6.4 to 12.8 of it, the 55 edge
  // x 6.4 to 12.8 by z 0 to 6.4, and the field's 11 x 6.4 to 12.8 by z -12.8 to -6.4
  const onStreet = await r.ghostAt(CHAIR_MODEL, 0, 7.5);
  assert.ok(onStreet, 'a ghost on the street');
  assert.equal(r.tool.why(), YARD_ON_ROAD, 'on the street: the bar says so');
  assert.equal(await r.tool.commit(), false, 'and nothing is placed');
  await r.ghostAt(CHAIR_MODEL, 8, 3);
  assert.equal(r.tool.why(), YARD_ON_ROAD, 'on the road\'s grass edge (55)');
  await r.ghostAt(CHAIR_MODEL, 8, -8);
  assert.equal(r.tool.why(), null, 'a field\'s own dirt edge (11) is the yard\'s - a record alone never makes a path');
  await r.ghostAt(CHAIR_MODEL, 2, 5.9);
  assert.equal(r.tool.why(), null, 'touching the street\'s side is not on it');
  await r.ghostAt(CHAIR_MODEL, 0, 5);
  assert.equal(r.tool.why(), null, 'between the wall and the street');
  assert.equal(await r.tool.commit(), true, 'placed');
  // the turned box: the bench's middle off the street, its end on it
  await r.ghostAt(BENCH_MODEL, -2, 5.6, 6);
  assert.equal(r.tool.ghost().rot[0], 90, 'turned to run north-south');
  assert.equal(r.tool.why(), YARD_ON_ROAD, 'its end reaches over the street\'s side');
  assert.equal(await r.tool.commit(), false);
  assert.deepEqual(rows().map((p) => [p.yard, p.pos[0], p.pos[2]]), [[1, 0, 5]], 'the service holds the one piece off the road');
  assert.deepEqual(r.wire.filter((w) => w === 'place'), ['place'], 'and was asked once');
  assert.deepEqual(r.yards.here().roads.map((q) => q.map((v) => Math.round(v * 10) / 10 + 0)), [[6.4, 0, 12.8, 6.4], [-12.8, 6.4, -6.4, 12.8], [-6.4, 6.4, 0, 12.8], [0, 6.4, 6.4, 12.8], [6.4, 6.4, 12.8, 12.8]],
    'the road under the lot, read off the pixel\'s own tiles: the street and its edge, never the field\'s dirt edge');

  // house B, at the block's west edge: its lot reaches the town's clearance, where the road painter's track runs past
  // (record 11 - the very record a field's edge writes - which the painter's own mask names)
  const [, B] = town.keys;
  const s2 = await seated(B);
  const rb = yardRig(s2.svc, town, { who: s2.who, charId: s2.charId, key: B });
  await rb.frames(8);
  const fb = town.built.homeFrames.get(B);
  const trackX = 55 * RMB_TILE_SIDE + 2 - fb.at[0];   // inside tile 55, the clearance's
  assert.equal(town.tilemapBytes[63 * 128 + 55] >> 2, 11, 'the track\'s own tile, by record a field\'s dirt edge');
  assert.equal(town.paths[63 * 128 + 55], 1, 'which the painter says it wrote');
  await rb.ghostAt(CHAIR_MODEL, trackX, 0);
  assert.equal(rb.tool.why(), YARD_ON_ROAD, 'on the painter\'s track');
  await rb.ghostAt(CHAIR_MODEL, trackX, -8);
  assert.equal(rb.tool.why(), null, 'beside it, off it');
});

test('FB1001 ROAD-LOT: what the owner sees agrees - the lot\'s marked edge runs along the road\'s side, never across it, and where no road cuts in it is the lot\'s four sides as ever (mutants: the edge\'s road unread; a road square\'s side; a side\'s turn)', async (t) => {
  t.mock.method(Date, 'now', () => T0 * 1000);
  const town = theTown();
  const [A] = town.keys;
  const { svc, who, charId } = await seated(A);
  const r = yardRig(svc, town, { who, charId, key: A });
  await r.frames(8);
  await r.ghostAt(CHAIR_MODEL, 0, 5);
  const bands = r.marked();
  assert.deepEqual(bands, [[-10, -9, 10, -9], [10, -9, 10, 0], [10, 0, 6.4, 0], [6.4, 0, 6.4, 6.4], [6.4, 6.4, -10, 6.4], [-10, 6.4, -10, -9]],
    'south, east to the road edge, round the edge\'s notch, the street\'s side, west - the lot on each band\'s left');
  const roads = r.yards.here().roads;
  for (const [ax, az, bx, bz] of bands) {
    const mx = (ax + bx) / 2, mz = (az + bz) / 2;
    assert.ok(!roads.some((q) => mx > q[0] + 0.01 && mx < q[2] - 0.01 && mz > q[1] + 0.01 && mz < q[3] - 0.01), `no band stands on the road (${[ax, az, bx, bz]})`);
  }
  // no road under it: the four sides, south first and the lot on each one's left (the bands' faces turned in)
  const lot = yardLot([0, 0, 0], [-4, 0, -3, 4, 6, 3]);
  assert.deepEqual(yardLotEdges(lot, []), [[-10, -9, 10, -9], [10, -9, 10, 9], [10, 9, -10, 9], [-10, 9, -10, -9]]);
  assert.deepEqual(yardLotQuads(lot, [0, 0, 0], YARD_MARK_HIGH, []).map((q) => q.right), [[1, 0, 0], [0, 0, 1], [-1, 0, 0], [0, 0, -1]]);
  // a road across the middle parts the lot into two, each its own loop; one wholly inside, a hole round it
  assert.deepEqual(yardLotEdges(lot, [[-12, -1, 12, 1]]), [[-10, -9, 10, -9], [10, -9, 10, -1], [10, -1, -10, -1], [-10, -1, -10, -9], [-10, 1, 10, 1], [10, 1, 10, 9], [10, 9, -10, 9], [-10, 9, -10, 1]]);
  assert.deepEqual(yardLotEdges(lot, [[5, 5, 7, 7]]).slice(4), [[5, 5, 5, 7], [5, 7, 7, 7], [7, 7, 7, 5], [7, 5, 5, 5]], 'a road square inside the lot ringed, the lot on its left');
});

/** The ground a model's box covers, turned `deg` and scaled `s` - decorTool.js footprintOf's own arithmetic (mat4 trs:
 *  local x to (cos, -sin), z to (sin, cos)). */
const turned = ([x0, , z0, x1, , z1], deg, s = 1) => {
  const a = (deg * Math.PI) / 180, c = Math.cos(a), n = Math.sin(a);
  return [[x0, z0], [x1, z0], [x1, z1], [x0, z1]].map(([lx, lz]) => [(c * lx + n * lz) * s, (-n * lx + c * lz) * s]);
};
const BENCH_BOX = [-1.5, 0, -0.3, 1.5, 0.8, 0.3];

test('FB1001 YARD-CORNER: a piece turned across the house\'s corner - none of its corners in the house, the house\'s corner in it - is refused and never written; a step off the corner it stands; a neighbour\'s ground the same (mutants: the corners-only test; an edge\'s normal; the pad)', async (t) => {
  t.mock.method(Date, 'now', () => T0 * 1000);
  const town = theTown();
  const [A] = town.keys;
  const { svc, who, charId, rows } = await seated(A);
  const r = yardRig(svc, town, { who, charId, key: A });
  await r.frames(8);
  // the house is [-4, -3, 4, 3] round its frame; the bench (3 m by 0.6) turned 45 degrees lies along its north-east
  // corner's diagonal's normal, its long side 0.16 m past the corner
  const g = await r.ghostAt(BENCH_MODEL, 4.1, 3.1, 3);
  assert.deepEqual([g.pos[0], g.pos[2], g.rot[0]], [4.1, 3.1, 45], 'the ghost where the eye looks, turned by the tool');
  const corners = turned(BENCH_BOX, 45).map(([dx, dz]) => [4.1 + dx, 3.1 + dz]);
  assert.ok(corners.every(([x, z]) => !(x > -4 && x < 4 && z > -3 && z < 3)), 'not one of its corners in the house');
  assert.equal(r.tool.why(), YARD_IN_HOUSE, 'and yet the house\'s corner is in it: refused');
  assert.equal(await r.tool.commit(), false);
  await r.ghostAt(CHAIR_MODEL, 4.5, 0);
  assert.equal(r.tool.why(), null, 'against the wall is not in it');
  await r.ghostAt(BENCH_MODEL, 4.4, 3.4, 3);
  assert.equal(r.tool.why(), null, 'a step off the corner, along its diagonal');
  assert.equal(await r.tool.commit(), true);
  assert.deepEqual(rows().map((p) => [p.pos[0], p.pos[2], p.rot[0]]), [[4.4, 3.4, 45]], 'only the one clear of the wall written');
  // a neighbour's footprint is asked the same way: its south-west corner (7, 2) inside the turned bench
  const lot = yardLot([0, 0, 0], HOUSE_BOX);
  const foot = turned(BENCH_BOX, 45);
  assert.equal(yardWhyNot([6.9, 0, 1.9], lot, [[7, 2, 9, 5]], foot), 'That is another building\'s ground.');
  // PIN MOVED (HOME-LINE, FIELD BUGS 2026-10-11b): off its corner the bench meets none of its ground - and stands nearer
  // it than the house's, the neighbour's side of the line the ground between them is split by
  assert.equal(homeYards.yardFootMeets(foot.map(([dx, dz]) => [6.6 + dx, 1.6 + dz]), [7, 2, 9, 5], homeYards.YARD_EDGE_PAD), false, 'off its corner');
  assert.equal(yardWhyNot([6.6, 0, 1.6], lot, [[7, 2, 9, 5]], foot), 'That is another building\'s ground.', 'and on the neighbour\'s side of the line');
  // the ground as the law asks it: across both boxes' axes and every edge of the piece's - a diagonal whose box meets a
  // rect, itself clear of it, is clear (a segment's one axis too)
  assert.equal(homeYards.yardFootMeets([[0, 0], [2, 2]], [1.5, 0, 3, 0.4]), false);
  assert.equal(homeYards.yardFootMeets([[0, 0], [2, 2]], [0.5, 0, 3, 0.6]), true);
});

test('FB1001 YARD-STALE: the town\'s yards read before the owner\'s writes and answered after them never stand the yard as it was - the piece placed stays, the piece removed stays gone - and the next read is believed (mutants: the write unrecorded; the answer\'s turn; the old answer believed)', async (t) => {
  t.mock.method(Date, 'now', () => T0 * 1000);
  const town = theTown();
  const [A] = town.keys;
  const { svc, who, charId, rows } = await seated(A);
  const clock = { t: 0 };
  const r = yardRig(svc, town, { who, charId, key: A, now: () => clock.t });
  await r.frames(8);
  await r.ghostAt(CHAIR_MODEL, 0, 5);
  assert.equal(await r.tool.commit(), true, 'the first piece');
  r.tool.close();
  await r.frames(2);
  const [first] = r.yards.here().yard.pool.list().map((p) => p.id);
  // the minute runs out: the town is asked again and read at once, its answer on the way
  r.gate.hold = true;
  clock.t = YARD_TOWN_TTL_MS + 1;
  await r.frames(6);
  assert.ok(r.gate.release, 'a read in flight');
  // meanwhile the owner places a second piece and removes the first
  await r.ghostAt(CHAIR_MODEL, 0, -5);
  assert.equal(await r.tool.commit(), true, 'the second piece');
  await r.removeVia(first);
  // Wait for the removal's service write, not a fixed number of scheduler turns.
  const removedBy = performance.now() + 5000;
  while (rows().some((p) => p.pos[2] === 5) && performance.now() < removedBy) await r.frames(1);
  r.tool.close();
  await r.frames(2);
  const zs = () => r.yards.here().yard.pool.list().map((p) => p.pos[2]);
  assert.deepEqual(rows().map((p) => p.pos[2]), [-5], 'the service holds the second alone');
  assert.deepEqual(zs(), [-5], 'and so does the yard');
  // the read from before both lands
  r.gate.hold = false;
  r.gate.release();
  await r.frames(12);
  assert.deepEqual(zs(), [-5], 'it stands nothing back: the second stays, the first stays gone');
  // the next read is the service's word again - the piece moved from another tab
  svc.env.DB._raw.prepare("UPDATE home_decor SET place = json_set(place, '$.pos[2]', -6)").run();
  clock.t = 2 * YARD_TOWN_TTL_MS + 10;
  await r.frames(12);
  assert.deepEqual(zs(), [-6], 'the next answer is believed');
});

test('PRIMARY-TRIPS audit (FB1001 YARD-STALE): the owner\'s write stands over an answer ASKED AFTER it for YARD_WRITE_HOLD_MS - the service keeps a town\'s answer YARDS_KEPT_S an isolate and reads it off a replica, so one asked after the write can still be from before it - and the answer past the hold is believed, and one asked before a write never stands it back however late it lands (mutants: the hold dropped; the answer\'s turn)', async (t) => {
  t.mock.method(Date, 'now', () => T0 * 1000);
  const town = theTown();
  const [A] = town.keys;
  const { svc, who, charId, rows } = await seated(A);
  const clock = { t: 0 };
  const r = yardRig(svc, town, { who, charId, key: A, now: () => clock.t });
  await r.frames(8);
  clock.t = YARD_TOWN_TTL_MS / 2;
  await r.ghostAt(CHAIR_MODEL, 0, 5);
  assert.equal(await r.tool.commit(), true, 'the piece');
  r.tool.close();
  await r.frames(2);
  const zs = () => r.yards.here().yard.pool.list().map((p) => p.pos[2]);
  assert.deepEqual(rows().map((p) => p.pos[2]), [5]);
  assert.deepEqual(zs(), [5]);
  // the next ask, after the write, answered with a yard other than the write's (as a replica behind it holds the town)
  svc.env.DB._raw.prepare("UPDATE home_decor SET place = json_set(place, '$.pos[2]', -6)").run();
  const asks = r.wire.filter((w) => w === 'yards').length;
  clock.t = YARD_TOWN_TTL_MS + 1;
  await r.frames(12);
  assert.equal(r.wire.filter((w) => w === 'yards').length, asks + 1, 'asked after the write');
  assert.deepEqual(zs(), [5], 'the write stands over an answer from before it');
  assert.ok(YARD_WRITE_HOLD_MS >= 2 * 30_000, 'the service\'s kept answer (YARDS_KEPT_S) and a replica\'s lag inside the hold');
  // past the hold, the service's word again
  clock.t = YARD_TOWN_TTL_MS / 2 + YARD_WRITE_HOLD_MS + YARD_TOWN_TTL_MS + 10;
  await r.frames(12);
  assert.equal(r.wire.filter((w) => w === 'yards').length, asks + 2, 'asked again');
  assert.deepEqual(zs(), [-6], 'believed past the hold');
  // and an answer asked BEFORE a write never stands it back, however long past the hold it lands (YARD-STALE's own turn)
  r.gate.hold = true;
  clock.t += YARD_TOWN_TTL_MS + 1;
  await r.frames(6);
  assert.ok(r.gate.release, 'a read in flight');
  await r.ghostAt(CHAIR_MODEL, 0, -5);
  assert.equal(await r.tool.commit(), true, 'a piece placed while it is out');
  r.tool.close();
  await r.frames(2);
  clock.t += YARD_WRITE_HOLD_MS + 1;
  r.gate.hold = false;
  r.gate.release();
  await r.frames(12);
  assert.deepEqual(zs().sort((x, y) => x - y), [-6, -5], 'the piece placed stands over the answer asked before it');
});

test('FB1001 YARD-RECENTRE: the host\'s recentre stands every yard where the shift put it, in place, before that frame\'s draw - drawn and solid there the very frame - and the world host calls it in its recentre (mutants: the rebase dropped; put again for in place; the matrix kept; the host\'s call)', async (t) => {
  t.mock.method(Date, 'now', () => T0 * 1000);
  const town = theTown();
  const [A] = town.keys;
  const { svc, who, charId } = await seated(A);
  const r = yardRig(svc, town, { who, charId, key: A });
  await r.frames(8);
  await r.ghostAt(CHAIR_MODEL, 0, 5);
  assert.equal(await r.tool.commit(), true);
  r.tool.close();
  await r.frames(3);
  const id = r.yards.here().yard.pool.list()[0].id;
  const frameX = () => r.T[0] + r.f.at[0];
  const drawnAt = () => { r.draws.length = 0; r.yards.draw(); return r.draws.filter(([m]) => m === CHAIR_MODEL).map(([, x]) => Math.round((x - frameX()) * 1000) / 1000 + 0); };
  assert.deepEqual(drawnAt(), [0], 'drawn at its frame');
  // the host's frame: the yards' turn, the motor, then the streaming step recentres a pixel east and the draw follows -
  // with nothing awaited between
  r.yards.frame({ dt: 0.016, cam: r.cam, overlayUp: false });
  r.T[0] -= 819.2; r.cam.pos[0] -= 819.2; r.feet.at[0] -= 819.2;   // the shift moves the pixel, the eye and the body
  r.yards.rebase();
  assert.deepEqual(drawnAt(), [0], 'the crossing\'s own frame draws it where it stands now');
  const b = r.collider._buckets.get(`decor:${id}`);
  assert.ok(Math.abs((b.min[0] + b.max[0]) / 2 - frameX()) < 1e-3, 'and it is solid there');
  // a flat stands again in place too - its picture's place, moved once however often it is asked
  const { createDecorRoom } = await import('../../src/scenes/decor/decorRoom.js');
  const o = [10, 0, 10];
  const made = [];
  const room = createDecorRoom({
    meshes: {}, collider: () => null, origin: () => o, uploadRecord() {},
    renderer: { createBillboardBatch: (a, rec, size, centers) => { const bb = { centers, origin: null }; made.push(bb); return bb; }, destroyBillboardBatch() {} },
    getTexture: async () => ({ recordCount: 64, getSize: () => ({ width: 16, height: 32 }), getScale: () => ({ width: 0, height: 0 }) }),
  });
  room.put({ id: 'flat00000001', model: null, flat: [254, 3], pos: [1, 0, 2], rot: [0, 0, 0], scale: 1, light: null, storage: false, paid: 10 });
  await settle(); await settle();
  assert.deepEqual(made[0].centers, [[11, 0, 12]]);
  o[0] -= 819.2;   // the origin the host hands is moved where it stands
  room.restand();
  room.restand();
  assert.deepEqual(made.length, 1, 'its picture kept, never asked again');
  assert.ok(Math.abs(made[0].origin[0] + 819.2) < 1e-9 && made[0].origin[1] === 0 && made[0].origin[2] === 0, 'moved by the shift, once');
  // the world host: the call in its recentre, among everything else holding a world position
  const w = src('src/scenes/world.js');
  const shift = w.indexOf('    if (r.offset) {');
  const call = w.indexOf('csaSyncColliders(); yards?.rebase();', shift);
  const end = w.indexOf('    if (r.pixelChanged) {', shift);
  assert.ok(shift > 0 && call > shift && call < end, 'yards.rebase() in the recentre');
  assert.ok(w.indexOf('    yards?.frame({ dt, cam,') < shift && w.indexOf('    yards?.draw(renderer);') > end, 'the yards\' frame above it, their draw below');
});

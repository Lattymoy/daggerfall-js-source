// FIELD BUGS 2026-10-29f YARD-BORDER and YARD-JOINED (#feature-feedback, "Housing feedback & suggestions after 20 hours of
// decorating", item 16: "Fix the borders of the house visibility - If two plots overlap, which they do literally all the
// time, the borders you see are just wrong"; item 17: "Owning two houses next to each other should allow you to build
// beyond the plot border"). HOME-LINE gives the ground between two houses to the nearer, but the edge was drawn round
// the lot's whole rectangle; it is now drawn where a piece may stand. And two homes of one owner side by side split no
// ground between them: each yard reaches its own lot's edge (AUDIT FB1029f B4: never the other's lot).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as homeYards from '../../src/scenes/homeYards.js';
import { DECOR_LOT_MARKS } from '../../src/scenes/decor/decorTool.js';
import { DECOR_YARD_POS_MAX } from '../../src/net/decorLaw.js';
import { Collider } from '../../src/player/collider.js';
import { accountDecor, SESSION_KEY } from '../../src/net/accountClient.js';
import { standService, sessionStorageOf, T0 } from '../accountDb.mjs';
import { realmAt } from '../realmSeat.mjs';
import { fakeDoc, fakeWin, fakeBlocks, rmb, TOWN, settle, ACTIONS } from '../decorFakes.mjs';
import { townPixel, houseAt, CHAIR_MODEL } from '../fb1001Town.mjs';

const { yardLot, yardWhyNot, yardLotEdges, yardStandEdges, yardJoinLots, YARD_MARGIN, YARD_IN_HOUSE, YARD_ON_OTHER, YARD_OFF_LOT, YARD_BORDER_TOL } = homeYards;
const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
/** A lot round an 8 x 6 m house standing at the frame's origin. */
const LOT = yardLot([0, 0, 0], [-4, 0, -3, 4, 6, 3], YARD_MARGIN);
/** A neighbour's house 12.3 m east: the midline at x 6.15, off the trace's half-metre cells. */
const EAST = [[8.3, -3, 16.3, 3]];
const MID = (4 + 8.3) / 2;
/** Whether (x, z) is inside the loops `segs` draw (the ground on each one's left). */
function inside(segs, x, z) {
  let n = 0;
  for (const [ax, az, bx, bz] of segs) if ((az > z) !== (bz > z) && ax + ((z - az) / (bz - az)) * (bx - ax) > x) n += 1;
  return n % 2 === 1;
}
const near = (segs, x, z, d) => segs.some(([ax, az, bx, bz]) => {
  const L2 = (bx - ax) ** 2 + (bz - az) ** 2 || 1, k = Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (z - az) * (bz - az)) / L2));
  return Math.hypot(ax + k * (bx - ax) - x, az + k * (bz - az) - z) < d;
});

test('YARD-BORDER the marked edge is where a piece may stand: the midline with a neighbour\'s house, straight where their walls face, and nothing past it; with none it is the lot\'s four sides as before (mutants: YARDBORDER-midline-unread, YARDBORDER-facing-uncut)', () => {
  assert.deepEqual(yardStandEdges(LOT, [], []), yardLotEdges(LOT, []), 'no neighbour: the lot');
  const segs = yardStandEdges(LOT, [], EAST);
  assert.ok(segs.some(([ax, az, bx, bz]) => ax === MID && bx === MID && Math.min(az, bz) <= -3 && Math.max(az, bz) >= 3), 'the midline, straight along the walls that face');
  assert.ok(!segs.some(([ax, , bx]) => ax === 10 && bx === 10), 'the lot\'s own east side is the neighbour\'s now');
  // the edge drawn and the law agree everywhere but within a drawn corner's tolerance of the edge
  for (let x = -9.75; x < 10; x += 0.5) {
    for (let z = -8.75; z < 9; z += 0.5) {
      if (near(segs, x, z, YARD_BORDER_TOL + 0.1)) continue;
      const ok = yardWhyNot([x, 0, z], LOT, [], [], [], EAST);
      assert.equal(inside(segs, x, z), ok === null || ok === YARD_IN_HOUSE, `(${x}, ${z}): ${ok}`);
    }
  }
});

test('YARD-BORDER a road and a midline together, and a crowded street still draws within the decal batch\'s marks (mutant: YARDBORDER-road-uncut)', () => {
  const road = [[-10, -9, 10, -6]];
  const segs = yardStandEdges(LOT, road, EAST);
  assert.ok(segs.some(([ax, az, bx, bz]) => az === -6 && bz === -6 && Math.min(ax, bx) <= -9 && Math.max(ax, bx) >= 5.5), 'the road\'s side');
  assert.equal(inside(segs, 0, -7.5), false, 'the road is no one\'s');
  const crowd = [[8.3, -3, 16.3, 3], [-16, -3, -8, 3], [-4, 8, 4, 14], [-3, -14, 3, -9.5], [9, 9, 12, 12], [-12, 8, -9, 11]];
  assert.ok(yardStandEdges(LOT, road, crowd).length <= DECOR_LOT_MARKS, 'within the marks');
});

test('YARD-JOINED the law: a lot beside its owner\'s other house - no midline between them, the other house still a house, the midline with a stranger drawn from the nearer of the owner\'s houses; a piece stands on its own lot alone (AUDIT FB1029f B4), never past the service\'s bound (mutants: YARDJOINED-walls-unjoined, YARDJOINED-past-the-bound)', () => {
  const mate = { walls: [[8, -3, 16, 3]] };
  const lot = yardJoinLots(LOT, [mate]);
  assert.equal(yardWhyNot([7, 0, 0], lot, [], [], [], []), null, 'between the two, past the midline: no midline between one owner\'s houses');
  assert.equal(yardWhyNot([7, 0, 0], LOT, [], [], [], mate.walls), homeYards.YARD_ON_OTHER, 'unjoined, the neighbour\'s side');
  assert.equal(yardWhyNot([9, 0, 0], lot, [], [], [], []), YARD_IN_HOUSE, 'the other house is a house');
  assert.equal(yardWhyNot([12, 0, 0], lot, [], [], [], []), YARD_OFF_LOT, 'B4: never on the other house\'s lot - its sale would leave the piece there');
  // a stranger north: (7, 8) is nearer the stranger than this house, nearer the owner's second house than the stranger
  const stranger = [[-3, 12, 3, 18]];
  assert.equal(yardWhyNot([7, 0, 8], LOT, [], [], [], stranger), homeYards.YARD_ON_OTHER, 'unjoined, the stranger\'s side');
  assert.equal(yardWhyNot([7, 0, 8], lot, [], [], [], stranger), null, 'joined, nearer the owner\'s second house');
  assert.equal(yardWhyNot([0, 0, 8.5], lot, [], [], [], stranger), homeYards.YARD_ON_OTHER, 'the stranger\'s side still');
  const segs = yardStandEdges(lot, [], stranger);
  assert.ok(inside(segs, 7, 0) && inside(segs, 7, 8) && !inside(segs, 0, 8.5) && !inside(segs, 12, 0), 'the edge drawn as the law stands');
  assert.ok(!inside(yardStandEdges(LOT, [], [...stranger, ...mate.walls]), 7, 0), 'unjoined, the midline drawn');
  const wide = yardLot([0, 0, 0], [-45, 0, -3, 45, 6, 3], YARD_MARGIN);
  assert.equal(yardWhyNot([DECOR_YARD_POS_MAX - 1, 0, 0], wide, [], [], [], []), null, 'on a wide lot');
  assert.equal(yardWhyNot([DECOR_YARD_POS_MAX + 1, 0, 0], wide, [], [], [], []), YARD_OFF_LOT, 'never past the service\'s bound');
  const lone = { ...LOT, alone: true };
  assert.equal(yardJoinLots(lone, [mate]), lone, 'a lone lot joins none');
});

/** A desert house's ground, an L of 1.6 m cells (Hammerfell's houses stand 27 to 41 rects), and its lot. */
function desertLot() {
  const ground = [];
  for (let i = 0; i < 8; i++) for (let j = 0; j < 5; j++) if (!(i > 4 && j > 2)) ground.push([-6.4 + i * 1.6, -4 + j * 1.6, -4.9 + i * 1.6, -2.5 + j * 1.6]);
  return yardLot([0, 0, 0], [-6.4, 0, -4, 6.4, 6, 4], YARD_MARGIN, ground);
}
/** `n` neighbours' rects 1 to 4 m a side within 30 m that `keep` takes - the same street each run. */
function street(n, keep, seed = 7) {
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const out = [];
  while (out.length < n) {
    const x = -30 + rnd() * 60, z = -30 + rnd() * 60, w = 1 + rnd() * 3, d = 1 + rnd() * 3;
    if (keep(x, z, w, d)) out.push([x, z, x + w, z + d]);
  }
  return out;
}
/** A trace's work: how many times it reads a neighbour's rect (counted, as a clock on a shared runner is not). */
function workOf(lot, roads, lines) {
  let n = 0;
  const counted = lines.map((r) => new Proxy(r, { get: (t, k) => { if (k === '0') n += 1; return t[k]; } }));
  const segs = yardStandEdges(lot, roads, counted);
  return { n, segs };
}

test('AUDIT FB1029f B1: a desert house\'s trace does bounded work - cut only where two walls face, and no more cuts than YARD_BORDER_CUTS_MAX (every pair took Sentinel\'s houses seconds); a crowded street still cuts the walls that face exactly (mutants: AUDITFB1029F-B1-every-pair, AUDITFB1029F-B1-cuts-uncapped)', () => {
  const lot = desertLot();
  const scattered = workOf(lot, [], street(180, (x, z, w, d) => !(x + w > -12 && x < 12 && z + d > -10 && z < 10)));
  assert.ok(scattered.n < 3e6, `a scattered street: ${scattered.n} reads (the commit's trace: 37 million)`);
  const facing = workOf(lot, [], street(180, (x, z, w) => x > -6 && x + w < 6 && z > 10.5));
  assert.ok(facing.n < 1e6, `a row facing the house: ${facing.n} reads (uncapped: 2 million)`);
  // 180 small neighbours past the lot's north corners, each farther from every point of it than the house: none faces it
  const posts = [];
  for (let k = 0; k < 90; k++) for (const sx of [1, -1]) { const x = sx * (16.1 + 0.025 * k), z = 15.2 + (k % 10) * 0.2; posts.push([Math.min(x, x + 0.05 * sx), z, Math.max(x, x + 0.05 * sx), z + 0.05]); }
  const segs = yardStandEdges(LOT, [], [...EAST, ...posts]);
  assert.ok(segs.some(([ax, az, bx, bz]) => ax === MID && bx === MID && Math.min(az, bz) <= -3 && Math.max(az, bz) >= 3), 'the midline, straight along the walls that face');
});

test('AUDIT FB1029f B5 and B6: every line that can win a point of the lot is read - a long house whose ground is its two ends, a neighbour 13 m past its edge nearer its middle; and the edge never holds more bands than the decal batch, every loop drawn (mutants: AUDITFB1029F-B5-near-short, AUDITFB1029F-B5-far-at-corners, AUDITFB1029F-B6-no-coarser-read)', () => {
  const long = yardLot([0, 0, 0], [-30, 0, -1, 30, 6, 1], YARD_MARGIN, [[-30, -1, -29, 1], [29, -1, 30, 1]]);
  const north = [[-2, 20, 2, 22]];
  assert.equal(yardWhyNot([0, 0, 0], long, [], [], [], north), YARD_ON_OTHER, 'the law: its middle the neighbour\'s side');
  assert.equal(inside(yardStandEdges(long, [], north), 0, 0), false, 'and the edge says so');
  // a path's paving stones over the yard, each a hole: 116 bands at the fine read
  const stones = [];
  for (const z of [-7.5, -5.5, 4.5, 6.5]) for (let x = -9; x < 5; x += 2) stones.push([x, z, x + 1, z + 1]);
  const segs = yardStandEdges(LOT, stones, EAST);
  assert.ok(segs.length <= DECOR_LOT_MARKS, `${segs.length} bands`);
  const ends = new Map();
  for (const [ax, az] of segs) ends.set(`${ax},${az}`, (ends.get(`${ax},${az}`) ?? 0) + 1);
  for (const [, , bx, bz] of segs) ends.set(`${bx},${bz}`, (ends.get(`${bx},${bz}`) ?? 0) - 1);
  assert.ok([...ends.values()].every((v) => v === 0), 'every loop closed');
  assert.ok(inside(segs, -8.5, -6.2) && !inside(segs, 9, 0), 'the yard, and the neighbour\'s side');
});

test('AUDIT FB1029f B10: a cut a few micrometres from another is the same cut - Wayrest\'s house 131846, where a midline\'s tie meets three road squares\' corner, drew a hairline band twice (mutant: AUDITFB1029F-B10-cuts-unsnapped)', () => {
  const walls = [[-4.799992942810064, -4.799995231628486, 4.80000705718993, 4.800004768371537]];
  const lot = yardLot([0, 0, 0], [-6.7999933242797965, 0, -5.199995231628463, 6.80000705718993, 6, 5.20000438690181], YARD_MARGIN, walls);
  const roads = [[4.800000762939476, -1.6000015258789517, 11.200000762939453, 4.799998474121082], [11.200000762939453, -1.6000015258789517, 17.60000076293943, 4.799998474121082], [4.800000762939476, 4.799998474121082, 11.200000762939453, 11.19999847412106]];
  const segs = yardStandEdges(lot, roads, [[11.199988555908192, 11.20000438690181, 27.19998855590819, 20.800004386901833]]);
  assert.deepEqual(segs.filter(([ax, az, bx, bz]) => Math.hypot(bx - ax, bz - az) < 0.01), [], 'no hairline band');
});

/** One client over two box houses 12 m apart (A west, B east), `owned` the keys the player's account owns. */
function yardRig(svc, town, { who, charId, key, owned }) {
  const T = [-300, 0, -350];
  const built = new Map([[`${town.built.px},${town.built.py}`, town.built]]);
  const collider = new Collider(() => town.floor);
  const box = { positions: new Float32Array([-0.5, -0.1, -0.5, 0.5, -0.1, -0.5, 0.5, 0.9, -0.5, -0.5, 0.9, -0.5, -0.5, -0.1, 0.5, 0.5, -0.1, 0.5, 0.5, 0.9, 0.5, -0.5, 0.9, 0.5]),
    indices: new Uint32Array([0, 1, 2, 0, 2, 3, 4, 6, 5, 4, 7, 6, 0, 4, 5, 0, 5, 1, 3, 2, 6, 3, 6, 7, 0, 3, 7, 0, 7, 4, 1, 5, 6, 1, 6, 2]) };
  const renderer = {
    createDecalBatch: (cap) => ({ cap }), writeDecalSlot: () => true, drawDecals() {}, destroyDecalBatch() {}, uploadTexture: () => 'tex',
    drawMesh() {}, createBillboardBatch: () => ({ bounds: [0, 0, 0, 1] }), destroyBillboardBatch() {},
  };
  const api = accountDecor({ fetch: svc.fetch, storage: sessionStorageOf(SESSION_KEY, who) });
  const purse = { n: 5000 };
  const f = town.built.homeFrames.get(key);
  const at = (rx, rz) => [T[0] + f.at[0] + rx, T[1] + town.floor, T[2] + f.at[2] + rz];
  const feet = at(0, -5);
  const cam = { pos: [feet[0], town.floor + 1.6, feet[2]], yaw: 0, pitch: -Math.PI / 2 + 1e-6 };
  const doc = fakeDoc();
  const yards = homeYards.createHomeYards({
    api: { yardCells: (m, c) => api.yardCells(m, c), place: (a) => api.place(a), move: (a) => api.move(a), remove: (a) => api.remove(a) },
    homes: { homeAt: (m, k) => (owned.includes(k) ? { owner: who.handle, own: true, mine: true, look: null } : town.built.homeFrames.has(k) ? { owner: 'Tomas', own: false } : null) },
    built: () => built, translation: () => T, feet: () => feet, outside: () => true, eye: () => cam.pos,
    collider: () => collider, meshes: { getGpuMesh: async (id) => ({ gpu: id }), cpuModels: new Map([[CHAIR_MODEL, box]]) }, renderer, getTexture: async () => ({ recordCount: 1 }), uploadRecord() {},
    scanDeps: () => ({ blocks: fakeBlocks([{ type: TOWN, block: rmb([CHAIR_MODEL]) }]), isTownBlock: (x) => x === TOWN, modelRadius: () => 0.4, flatRadius: async () => 0.2 }),
    character: () => charId,
    realm: () => async ({ reserve = null, apply = null, call }) => { const undo = reserve ? reserve() : null; const r = await call(realmAt(svc.env, charId)); if (r?.ok) apply?.(r); else undo?.(); return r; },
    wallet: () => ({ get gold() { return purse.n; }, pay: (n) => { purse.n -= n; }, credit: (n) => { purse.n += n; } }), regionOf: () => 17,
    doc, win: fakeWin(), canvas: null, touch: false, actionOf: (e) => ACTIONS.get(e.code) ?? null, locked: () => true, cursorOff() {}, stick: () => null,
    say() {}, refusal: (w) => `refused: ${w}`, openSlot() {}, now: () => 0,
  });
  const tool = yards.tool();
  const walk = (n, fn) => { fn(n); for (const k of n.children ?? []) walk(k, fn); };
  const click = (pred) => walk(doc.body.children.find((c) => c.className === 'dfdecor'), (n) => { if (pred(n)) n.fire('click'); });
  async function frames(n = 1, overlayUp = false) { for (let i = 0; i < n; i++) { yards.frame({ dt: 0.1, cam, overlayUp }); await settle(); await settle(); } }
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

test('YARD-JOINED the real decorator: the owner of two houses side by side places from the first house\'s yard on the ground between them, never in the second house nor on its lot; a stranger\'s house there keeps its side of the line (mutants: YARDJOINED-host-unjoined, YARDJOINED-mate-a-line, YARDJOINED-stranger-a-mate)', async (t) => {
  t.mock.method(Date, 'now', () => T0 * 1000);
  const town = townPixel({ houses: [houseAt(40, 51.2), houseAt(52, 51.2)], ground: () => 2 });
  const [A, B] = town.keys;
  const svc = await standService();
  const who = await svc.registered('Olga');
  const a = await svc.seatHome(who, { mapId: 7, buildingKey: A, region: 17, price: 5000 });
  assert.equal(a.status, 200, JSON.stringify(a.body));
  const both = yardRig(svc, town, { who, charId: a.character, key: A, owned: [A, B] });
  await both.frames(8);
  assert.equal(both.yards.here()?.yard.bk, A);
  await both.ghostAt(7, 0);
  assert.equal(both.tool.why(), null, 'between the two houses, past the midline: both are hers');
  assert.equal(await both.tool.commit(), true, 'placed, and the service keeps it');
  await both.ghostAt(9, 0);
  assert.equal(both.tool.why(), YARD_IN_HOUSE, 'never in the second house');
  await both.ghostAt(17, 0);
  assert.equal(both.tool.why(), YARD_OFF_LOT, 'AUDIT FB1029f B4: never on the second house\'s lot from the first\'s yard');
  // B a stranger's, with a piece in its yard - a yard the town stands, never the owner's to join
  const tomas = await svc.registered('Tomas');
  const b = await svc.seatHome(tomas, { mapId: 7, buildingKey: B, region: 17, price: 5000 });
  assert.equal(b.status, 200, JSON.stringify(b.body));
  const his = yardRig(svc, town, { who: tomas, charId: b.character, key: B, owned: [B] });
  await his.frames(8);
  await his.ghostAt(0, -5);
  assert.equal(await his.tool.commit(), true, 'his own piece, in his yard');
  const one = yardRig(svc, town, { who, charId: a.character, key: A, owned: [A] });
  await one.frames(8);
  assert.ok(one.yards.yards().some((y) => y.bk === B), 'the stranger\'s yard stands');
  await one.ghostAt(7, 0);
  assert.equal(one.tool.why(), YARD_ON_OTHER, 'a stranger\'s house beside it keeps its side');
});

test('YARD-BORDER the host by source: the edge is traced from the lot as joined, its road and its lines, once each time they move; the owner\'s own house beside it is no line (mutants: YARDBORDER-host-lineless, AUDITFB1029F-B2-memo-unkept)', () => {
  const y = src('src/scenes/homeYards.js');
  assert.match(y, /quads: yardLotQuads\(cur\.lot, o, YARD_MARK_HIGH, cur\.roads, cur\.lines\)/);
  assert.match(y, /lot: lotQuadsHere,/);
  assert.match(y, /if \(edgeMemo\.of !== cur \|\| edgeMemo\.o !== at\) edgeMemo = /, 'AUDIT FB1029f B2: kept while the yard is, never signed over every line each frame');
  assert.match(y, /if \(holds && !mate\) lines\.push\(g\);/);
});

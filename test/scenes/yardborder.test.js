// FIELD BUGS 2026-10-29f YARD-BORDER and YARD-JOINED (#feature-feedback, "Housing feedback & suggestions after 20 hours of
// decorating", item 16: "Fix the borders of the house visibility - If two plots overlap, which they do literally all the
// time, the borders you see are just wrong"; item 17: "Owning two houses next to each other should allow you to build
// beyond the plot border"). HOME-LINE gives the ground between two houses to the nearer, but the edge was drawn round
// the lot's whole rectangle; it is now drawn where a piece may stand. And two homes of one owner side by side split no
// ground between them: either yard stands on both lots.
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

test('YARD-JOINED the law: a lot joined to its owner\'s lot beside it - a piece stands on either, never in the other house; the midline is drawn from both houses; never past the service\'s bound (mutants: YARDJOINED-joined-unread, YARDJOINED-walls-unjoined, YARDJOINED-past-the-bound)', () => {
  const mate = { lot: [2, -9, 22, 9], walls: [[8, -3, 16, 3]] };
  const lot = yardJoinLots(LOT, [mate]);
  assert.equal(yardWhyNot([7, 0, 0], lot, [], [], [], []), null, 'between the two: no midline between one owner\'s houses');
  assert.equal(yardWhyNot([19, 0, 0], lot, [], [], [], []), null, 'on the other lot, past this one\'s edge');
  assert.equal(yardWhyNot([12, 0, 0], lot, [], [], [], []), YARD_IN_HOUSE, 'the other house is a house');
  assert.equal(yardWhyNot([19, 0, 0], LOT, [], [], [], []), YARD_OFF_LOT, 'unjoined, off the lot');
  // a stranger 12 m east of the second house: the line is drawn from the nearer of the owner's houses
  const stranger = [[20, -3, 28, 3]];
  assert.equal(yardWhyNot([17.5, 0, 0], lot, [], [], [], stranger), null, 'nearer the owner\'s second house');
  assert.equal(yardWhyNot([18.5, 0, 0], lot, [], [], [], stranger), homeYards.YARD_ON_OTHER, 'the stranger\'s side');
  const segs = yardStandEdges(lot, [], []);
  assert.ok(inside(segs, 19, 0) && inside(segs, -8, 0) && !inside(segs, 23, 0), 'the edge round both lots');
  const far = yardJoinLots(LOT, [{ lot: [-60, -9, -2, 9], walls: [[-56, -3, -40, 3]] }]);
  assert.equal(yardWhyNot([-DECOR_YARD_POS_MAX - 1, 0, 0], far, [], [], [], []), YARD_OFF_LOT, 'never past the service\'s bound');
  assert.equal(yardJoinLots({ ...LOT, alone: true }, [mate]).joined, undefined, 'a lone lot joins none');
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

test('YARD-JOINED the real decorator: the owner of two houses side by side places from the first house\'s yard on the ground between them and past the second house, never in it; a stranger\'s house there keeps its side of the line (mutants: YARDJOINED-host-unjoined, YARDJOINED-mate-a-line, YARDJOINED-stranger-a-mate)', async (t) => {
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
  await both.ghostAt(17, 0);
  assert.equal(both.tool.why(), null, 'past the second house, on its lot');
  assert.equal(await both.tool.commit(), true, 'placed, and the service keeps it');
  await both.ghostAt(12, 0);
  assert.equal(both.tool.why(), YARD_IN_HOUSE, 'never in the second house');
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

test('YARD-BORDER the host by source: the edge is traced from the lot as joined, its road and its lines, once each time they move; the owner\'s own house beside it is no line (mutant: YARDBORDER-host-lineless)', () => {
  const y = src('src/scenes/homeYards.js');
  assert.match(y, /quads: yardLotQuads\(cur\.lot, o, YARD_MARK_HIGH, cur\.roads, cur\.lines\)/);
  assert.match(y, /lot: lotQuadsHere,/);
  assert.match(y, /if \(holds && !mate\) lines\.push\(g\);/);
});

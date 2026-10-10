// MWNPC11 (2026-10-10, the MW-NPC arc's eleventh slice - bible/04-Characters/Morrowind-NPCs.md section 16): EVERY NPC
// LANE'S ONE FRAME. Ten slices gave every population a lane of its own, each under its own caps, and the stated bound
// was their sum - a port's street in a siege with a party on the road stood eight lanes' worth. Now the lanes share one
// frame budget (characters/npcBodies.js createFrameBudget, NPC_FRAME_TIERS): the nearest bodies across every lane stand,
// to the tier's count; the skins a frame are shared out, one a lane with a body and the rest by share; a body at the
// cut's edge is held (hysteresis); and no rig is built for one past its lane's range. Pinned on the budget alone, on
// PeerBodies' new limits, and on lanes of stub rigs that count what they stand, skin and draw.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createFrameBudget, createNpcBodies, NPC_FRAME_TIERS, NPC_BODY_TIERS, WATCH_BODY_TIERS, NPC_BUDGET_STALE_MS } from '../src/characters/npcBodies.js';
import { PeerBodies } from '../src/net/peerBodies.js';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const flush = () => new Promise((r) => setTimeout(r, 0));
const F = (...v) => Float64Array.from(v);

test('MWNPC11-1 the budget: the cut is the k-th nearest across every lane\'s report, Infinity while fewer stand; a stale lane or a dropped one takes no share; the skins one a lane with a body in the cut and the rest by share - their sum the budget\'s, or one a lane where more lanes stand', () => {
  const clock = { t: 0 };
  const b = createFrameBudget({ now: () => clock.t });
  const A = {}, B = {}, C = {};
  b.report(A, F(1, 4, 9, 16), 4);
  b.report(B, F(2, 3, 100), 3);
  assert.equal(b.cut(3), 3, 'the third nearest of 1, 2, 3, 4, ... across both');
  assert.equal(b.cut(5), 9);
  assert.equal(b.cut(7), 100);
  assert.equal(b.cut(8), Infinity, 'fewer than eight: every one stands');
  assert.equal(b.lanes, 2);
  b.report(A, F(1, 4, 9, 16, 99), 2);
  assert.equal(b.cut(3), 3, 'only the first n of a buffer');
  assert.equal(b.cut(5), 100);
  // the skins under a cut of 9: A has 1, 4, 9 in it (3), B 2, 3 (2) - a budget of 7: one each, five by share
  b.report(A, F(1, 4, 9, 16), 4);
  b.cut(5);
  assert.deepEqual([b.skins(A, 7), b.skins(B, 7)], [1 + Math.floor(5 * 3 / 5), 1 + Math.floor(5 * 2 / 5)]);
  assert.ok(b.skins(A, 7) + b.skins(B, 7) <= 7, 'the sum the budget\'s');
  assert.equal(b.skins(C, 7), 0, 'a lane with no report none');
  // more lanes than skins: one each
  const many = Array.from({ length: 5 }, () => ({}));
  const m = createFrameBudget({ now: () => 0 });
  for (const l of many) m.report(l, F(1), 1);
  m.cut(10);
  assert.deepEqual(many.map((l) => m.skins(l, 3)), [1, 1, 1, 1, 1], 'one a lane where more lanes than skins stand');
  // stale and dropped
  clock.t = NPC_BUDGET_STALE_MS + 1;
  b.report(B, F(2, 3, 100), 3);
  assert.equal(b.lanes, 1, 'A and C not drawn of late: no share');
  assert.equal(b.cut(2), 3);
  b.drop(B);
  assert.equal(b.lanes, 0);
  assert.equal(b.cut(1), Infinity);
});

/** a stub rig that counts its skins and draws */
const counting = (log) => () => {
  const r = { mode: 'first', skinned: false,
    attach() {}, async build() { await flush(); return { ok: true }; },
    canThirdPerson: () => true, raceHeightScale: () => 1, setViewMode(m) { r.mode = m; return true; },
    thirdActive: () => r.mode === 'third' && r.skinned,
    update(dt, o) { if (o?.pose !== false) { r.skinned = true; log.skins++; } },
    drawThird() { log.draws++; return r.thirdActive(); }, unload() {}, setSheathed() {}, revive() {} };
  log.rigs++;
  return r;
};
const look = { race: 'Breton', gender: 'male', faceIndex: 0, items: [] };
const toScene = (p) => [p.x, p.y, p.z];
const peer = (id, z) => ({ id, name: '', told: true, look, shown: { x: 0, y: 0, z: -z, yaw: 0, pitch: 0, mv: 0, wd: 0, an: 0, as: 0, cn: 0 } });

test('MWNPC11-2 PeerBodies\' limits: moved by the frame (a body past the new range stands no more - its sprite again); a lane that builds in range builds no rig past it; a standing body held to the hysteresis past the range, a far one back only within it', async () => {
  const log = { skins: 0, draws: 0, rigs: 0 };
  const pb = new PeerBodies({ renderer: {}, createRig: counting(log), buildOpts: () => ({}), now: () => 1000, limits: { max: 8, range: 30, skinBudget: 4, spareMax: 0, buildInRange: true, hysteresis: 1.2 } });
  const list = [peer('a', 5), peer('b', 20), peer('c', 40)];
  for (let i = 0; i < 12; i++) { pb.sync(list, toScene, 1 / 60, [0, 0, 0]); await flush(); await flush(); }
  assert.deepEqual(['a', 'b', 'c'].map((id) => pb.has(id)), [true, true, false]);
  assert.equal(log.rigs, 2, 'no rig built for the one past the range');
  pb.setLimits({ range: 10 });
  pb.sync(list, toScene, 1 / 60, [0, 0, 0]);
  assert.equal(pb.has('b'), false, 'past the frame\'s range: its sprite again');
  assert.equal(pb.has('a'), true);
  // held: a standing body at 11 m (within 10 x 1.2) keeps standing; at 13 m it falls; back at 11 m it stays far
  list[0] = peer('a', 11);
  pb.sync(list, toScene, 1 / 60, [0, 0, 0]);
  assert.equal(pb.has('a'), true, 'held past the range by the hysteresis');
  list[0] = peer('a', 13);
  pb.sync(list, toScene, 1 / 60, [0, 0, 0]);
  assert.equal(pb.has('a'), false);
  list[0] = peer('a', 11);
  pb.sync(list, toScene, 1 / 60, [0, 0, 0]);
  assert.equal(pb.has('a'), false, 'a far one comes back only within the range');
  list[0] = peer('a', 9);
  pb.sync(list, toScene, 1 / 60, [0, 0, 0]);
  assert.equal(pb.has('a'), true);
  pb.setLimits({ skinBudget: 1 });
  assert.equal(pb._skinBudget, 1);
  pb.destroy();
  // a peers' instance (no buildInRange, no hysteresis) as it always was: a rig for the one past the range
  const log2 = { skins: 0, draws: 0, rigs: 0 };
  const peers = new PeerBodies({ renderer: {}, createRig: counting(log2), buildOpts: () => ({}), now: () => 1000 });
  for (let i = 0; i < 12; i++) { peers.sync([peer('far', 60)], toScene, 1 / 60, [0, 0, 0]); await flush(); await flush(); }
  assert.equal(log2.rigs, 1, 'a peer far off still gets its rig, ready');
  peers.destroy();
});

/** two lanes - the foes' and the walkers' - of twelve each, interleaved by distance, on one budget (or none) */
async function twoLanes(budget, frameTiers = { off: null, near: { bodies: 6, skins: 2 }, all: null }) {
  const log = { skins: 0, draws: 0, rigs: 0 };
  const mk = () => createNpcBodies({ renderer: {}, tier: () => 'near', createRig: counting(log), now: () => 1000, budget, frameTiers });
  const foes = mk(), folk = mk();
  const at = (lane, z0) => Array.from({ length: 12 }, (_, i) => ({ id: i, look, feet: [0, 0, -(z0 + 2 * i)], yaw: 0 }));
  const fa = at('foe', 2), wa = at('folk', 3);
  const frame = async () => {
    foes.begin(); for (const a of fa) foes.stand('foe', a); foes.end(1 / 60, [0, 0, 0]);
    folk.begin(); for (const a of wa) folk.stand('folk', a); folk.end(1 / 60, [0, 0, 0]);
    foes.draw({}, { proj: null, view: null, eye: [0, 0, 0] }); folk.draw({}, { proj: null, view: null, eye: [0, 0, 0] });
    await flush(); await flush();
  };
  for (let i = 0; i < 40; i++) await frame();
  const standing = () => [...fa.map((a) => foes.has('foe', a.id) ? a.feet[2] : null), ...wa.map((a) => folk.has('folk', a.id) ? a.feet[2] : null)].filter((z) => z != null).map((z) => -z).sort((x, y) => x - y);
  log.skins = 0; log.draws = 0;
  for (let i = 0; i < 30; i++) await frame();
  return { log, standing: standing(), foes, folk, frame, fa };
}

test('MWNPC11-3 two lanes on one budget: the six nearest across both stand, whoever\'s; two skins a frame between them; no rig built past the cut\'s reach; and alone, each lane its own caps (24 standing, 8 skins) - what the budget saves; a lane let go hands the frame to the other', async () => {
  const clock = { t: 0 };
  const shared = createFrameBudget({ now: () => clock.t });
  const on = await twoLanes(shared);
  assert.equal(on.standing.length, 6, `six standing across both lanes (${on.standing})`);
  assert.ok([2, 3, 4, 5].every((z) => on.standing.includes(z)) && on.standing.every((z) => z <= 8), `the nearest, whoever\'s - one held at the edge at most (${on.standing})`);
  assert.ok(on.log.skins / 30 <= 2, `two skins a frame between them (${on.log.skins / 30})`);
  assert.ok(on.log.draws / 30 <= 6, `six drawn a frame (${on.log.draws / 30})`);
  const off = await twoLanes(null);
  assert.equal(off.standing.length, 24, 'alone: every lane its own twelve');
  // the first frame the foes' lane reported alone and built its six nearest; the walkers' then theirs within the cut
  assert.ok(on.log.rigs <= 9 && off.log.rigs === 24, `rigs for the near ones only (${on.log.rigs}, alone ${off.log.rigs})`);
  assert.ok(off.log.skins / 30 > 2, `alone: each lane its own skins (${off.log.skins / 30})`);
  // the walkers' lane let go: the foes take the whole frame - their six nearest
  on.folk.destroy();
  on.folk.begin = () => {}; on.folk.end = () => {};
  for (let i = 0; i < 30; i++) await on.frame();
  const foesUp = on.fa.filter((a) => on.foes.has('foe', a.id)).map((a) => -a.feet[2]);
  assert.deepEqual(foesUp, [2, 4, 6, 8, 10, 12], 'the foes\' six nearest, the frame theirs');
});

test('MWNPC11-4 the frame\'s tiers sit below what MWNPC7 summed for the foes, the watch and the walkers - so no lane since adds a body or a skin; every host\'s lane on the one budget', () => {
  for (const t of ['near', 'all']) {
    const sumBodies = NPC_BODY_TIERS[t].max * 2 + WATCH_BODY_TIERS[t].max, sumSkins = NPC_BODY_TIERS[t].skinBudget * 2 + WATCH_BODY_TIERS[t].skinBudget;
    assert.ok(NPC_FRAME_TIERS[t].bodies < sumBodies && NPC_FRAME_TIERS[t].skins < sumSkins, `${t}: ${NPC_FRAME_TIERS[t].bodies} < ${sumBodies}, ${NPC_FRAME_TIERS[t].skins} < ${sumSkins}`);
  }
  assert.deepEqual({ ...NPC_FRAME_TIERS.near }, { bodies: 24, skins: 8 });
  assert.deepEqual({ ...NPC_FRAME_TIERS.all }, { bodies: 48, skins: 16 });
  assert.equal(NPC_FRAME_TIERS.off, null);
  const n = rd('src/characters/npcBodies.js');
  assert.ok(n.includes("tier: () => getPref('mwNpcBodies') ?? NPC_BODIES_DEFAULT, collider, tiers, budget: NPC_FRAME_BUDGET });"), 'every host\'s lane on the page\'s one budget');
});

test('MWNPC11-5 a lane reports what it could stand - its nearest within its range, to its cap, in whatever order it offers them: the six nearest stand from a shuffled crowd; a lane whose people are all past its range takes no skin of the frame\'s', async () => {
  const shared = createFrameBudget({ now: () => 0 });
  const logA = { skins: 0, draws: 0, rigs: 0 }, logB = { skins: 0, draws: 0, rigs: 0 };
  const tiers = { off: null, near: { max: 12, range: 30, skinBudget: 4, spareMax: 0 }, all: null };
  const frameTiers = { off: null, near: { bodies: 6, skins: 2 }, all: null };
  const A = createNpcBodies({ renderer: {}, tier: () => 'near', tiers, createRig: counting(logA), now: () => 1000, budget: shared, frameTiers });
  const B = createNpcBodies({ renderer: {}, tier: () => 'near', tiers, createRig: counting(logB), now: () => 1000, budget: shared, frameTiers });
  const order = [13, 4, 19, 2, 8, 17, 6, 11, 3, 15, 21, 7, 10, 5, 18, 9, 14, 20, 12, 16];
  const crowd = order.map((z) => ({ id: z, look, feet: [0, 0, -z], yaw: 0 }));
  const far = [40, 44, 48, 52].map((z) => ({ id: z, look, feet: [0, 0, -z], yaw: 0 }));
  const frame = async () => {
    A.begin(); for (const a of crowd) A.stand('a', a); A.end(1 / 60, [0, 0, 0]);
    B.begin(); for (const a of far) B.stand('b', a); B.end(1 / 60, [0, 0, 0]);
    A.draw({}, { proj: null, view: null, eye: [0, 0, 0] });
    await flush(); await flush();
  };
  for (let i = 0; i < 40; i++) await frame();
  assert.deepEqual(crowd.filter((a) => A.has('a', a.id)).map((a) => a.id).sort((x, y) => x - y), [2, 3, 4, 5, 6, 7], 'the six nearest of the shuffled crowd');
  assert.equal(logB.rigs, 0, 'nothing built past the range');
  // a frame with room for twenty: the crowd's twelve all stand (fewer than twenty could), and the frame's two skins
  // are all the crowd's - the lane whose people are past its range reports none, so takes none
  const roomy = createFrameBudget({ now: () => 0 });
  const roomyTiers = { off: null, near: { bodies: 20, skins: 2 }, all: null };
  const logC = { skins: 0, draws: 0, rigs: 0 };
  const C = createNpcBodies({ renderer: {}, tier: () => 'near', tiers, createRig: counting(logC), now: () => 1000, budget: roomy, frameTiers: roomyTiers });
  const D = createNpcBodies({ renderer: {}, tier: () => 'near', tiers, createRig: counting({ skins: 0, draws: 0, rigs: 0 }), now: () => 1000, budget: roomy, frameTiers: roomyTiers });
  const frame2 = async () => {
    C.begin(); for (const a of crowd) C.stand('c', a); C.end(1 / 60, [0, 0, 0]);
    D.begin(); for (const a of far) D.stand('d', a); D.end(1 / 60, [0, 0, 0]);
    await flush(); await flush();
  };
  for (let i = 0; i < 40; i++) await frame2();
  assert.equal(crowd.filter((a) => C.has('c', a.id)).length, 12, 'the crowd\'s cap stands');
  logC.skins = 0;
  for (let i = 0; i < 20; i++) await frame2();
  assert.equal(logC.skins / 20, 2, 'the frame\'s two skins all the crowd\'s');
});

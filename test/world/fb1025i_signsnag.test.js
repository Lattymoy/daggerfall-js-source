// FIELD BUGS 2026-10-25i SIGN-PASS (#bug-reports, ajaegerson, "Caravans get caught on shop signs": "Sometimes they do
// when travelling through towns its really easy to fix just return and move a bit but kinda annoying it stops you";
// Harlander: "Even going on foot you can get hung up on shop signs and fences"). A shop's sign (ARCH3D 43700-43755, a
// town block's misc model) went into the collider whole, as DFU's combined block MeshCollider takes it, and its board,
// arm and brace hang over the street from 1.65, 2.1 and 2.4 m - inside a rider's 2.6 m capsule (a wagon's driver is
// one) and, the lowest, a walker's 1.8 m. Now a sign's triangles every corner of which stands SIGN_HANG_M over its
// foot hang: drawn, met by every ray and sweep as DFU's collider is, and by no body (world/signSolid.js sightMarksOf,
// player/collider.js addMesh's `sight` - AUDIT FB1025i G5); its posts stand. Driven through the real PlayerMotor and
// Collider, on a sign built to 43727's measures and, with ARENA2, on the game's own: ARCH3D's 56 signs and the tavern
// sign of TVRNBM04 as the block's own layout stands it (layoutRmbBlock).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { signHungMarks, sightMarksOf, SIGN_HANG_M } from '../../src/world/signSolid.js';
import { SHOP_SIGN_FIRST_MODEL, SHOP_SIGN_LAST_MODEL } from '../../src/world/houseSigns.js';
import { layoutRmbBlock } from '../../src/world/rmbLayout.js';
import { Collider } from '../../src/player/collider.js';
import { lateSolidsOf } from '../../src/player/lateSolid.js';
import { PlayerMotor, FIXED_DT, CAPSULE_RADIUS, EYE_HEIGHT, RIDE_HEIGHT } from '../../src/player/motor.js';
import { TRANSPORT_MODES } from '../../src/systems/transport.js';
import { skipReal, game } from '../lwRealTown.mjs';
import { buildYardModel, STABLE_YARD, CARPENTER_YARD, WAGON_YARD, SIGN_BOARD } from '../../src/world/merchantYards/merchantYardModels.js';
import { buildShipyardModel } from '../../src/world/shipyardModel.js';

const IDLE = { forward: 0, strafe: 0, run: false, jump: false, up: false, down: false };
const RUN = { ...IDLE, forward: 1, run: true };
const WALK = { ...IDLE, forward: 1 };
const I4 = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
const rd = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');

/** A box's twelve triangles, appended to `p` / `ix`. */
function box(p, ix, x0, y0, z0, x1, y1, z1) {
  const v = p.length / 3;
  p.push(x0, y0, z0, x1, y0, z0, x1, y1, z0, x0, y1, z0, x0, y0, z1, x1, y0, z1, x1, y1, z1, x0, y1, z1);
  for (const k of [0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 3, 7, 6, 3, 6, 2, 0, 4, 7, 0, 7, 3, 1, 2, 6, 1, 6, 5]) ix.push(v + k);
}
/** A sign to 43727's measures, centred on its own middle as ARCH3D's are (y -1.6..1.6, its foot 1.6 under its origin):
 *  the post at z -1..-0.8 the whole height, the arm out over the street at 2.5-2.7 m, the board under it at 1.65-2.45 m
 *  from z -0.65 to 0.95, 0.1 thick. `post` is its post's twelve triangles' end. */
function madeSign() {
  const p = [], ix = [];
  box(p, ix, -0.1, -1.6, -1.0, 0.1, 1.6, -0.8);    // the post
  const post = ix.length;
  box(p, ix, -0.1, 0.9, -0.8, 0.1, 1.1, 1.0);      // the arm
  box(p, ix, -0.05, 0.05, -0.65, 0.05, 0.85, 0.95);   // the board
  return { positions: new Float32Array(p), indices: new Uint32Array(ix), post };
}
const SIGN_AT = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 1.6, 0, 1]);   // its foot on the ground
/** A run of the real motor from `from` along `yaw` for `seconds`: a wagon's driver (a rider's capsule) at the gallop, a
 *  walker at a walk (a runner's stride carries it through a board's edge that holds a walker). */
function run(col, from, yaw, mode, seconds = 2, each = null) {
  const m = new PlayerMotor(col);
  m.spawn(from[0], 0.05, from[2]);
  if (mode) m.transportMode = mode;
  for (let i = 0; i < 20; i++) m.update(FIXED_DT, IDLE, yaw);
  const s = [...m.pos];
  for (let i = 0; i < seconds * 60; i++) { m.update(FIXED_DT, mode ? RUN : WALK, yaw); each?.(m.pos); }
  return { m, d: Math.hypot(m.pos[0] - s[0], m.pos[2] - s[2]) };
}
/** How far (seen from above) a point stands from the post's footprint, x -0.1..0.1 by z -1..-0.8 in the sign's frame. */
const offPost = (x, z) => Math.hypot(Math.max(-0.1 - x, 0, x - 0.1), Math.max(-1 - z, 0, z + 0.8));
const ground = () => new Collider(() => 0);
/** The made sign in a collider as the town hosts stand it - its hung triangles a ray's (`sight`) - or whole, as DFU's. */
function signCollider(marked) {
  const s = madeSign(), c = ground();
  c.addMesh('sign', s.positions, s.indices, SIGN_AT, null, null, false, marked ? sightMarksOf(43727, s) : null);
  return c;
}

test('SIGN-PASS the law: a sign\'s triangles every corner of which stands SIGN_HANG_M over its own foot hang - the board and the arm of a sign built to 43727\'s measures, and its post\'s cap - and its post stands; a model that is no sign is a body\'s whole; the range is HOUSE-SIGN\'s one export (AUDIT FB1025i G3); a sign\'s marks are made once (mutants: the foot not read; the line at the board; a hanging triangle kept; the highest corner read; the range closed at either end; the law asked of no sign; made at every ask)', () => {
  assert.equal(SIGN_HANG_M, 1);
  const s = madeSign();
  const marks = signHungMarks(s.positions, s.indices);
  assert.equal(marks.length, s.indices.length / 3);
  const postTris = s.post / 3;
  assert.deepEqual([...marks.slice(0, postTris)], [0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0], 'the post\'s sides and foot stand; its cap, 3.2 m up, hangs over every head as the board does');
  assert.ok(marks.slice(postTris).every((m) => m === 1), 'the arm and the board hang, every triangle');
  // the foot is the model's own lowest corner, wherever its origin is: the same sign lifted 5 m keeps the same marks
  const lifted = Float32Array.from(s.positions, (v, i) => (i % 3 === 1 ? v + 5 : v));
  assert.deepEqual([...signHungMarks(lifted, s.indices)], [...marks]);
  // a triangle with one corner under the line stands: the board's lowest corner moved to 0.9 m over the foot
  const low = Float32Array.from(s.positions);
  const boardCorner = s.indices[s.indices.length - 1];
  low[boardCorner * 3 + 1] = -1.6 + 0.9;
  assert.ok(signHungMarks(low, s.indices).slice(postTris).some((m) => m === 0), 'a board corner 0.9 m up stands');
  const sign = { positions: s.positions, indices: s.indices };
  assert.equal(sightMarksOf(43727, sign), sightMarksOf(43727, sign), 'made once a model');
  assert.deepEqual([...sightMarksOf(43727, sign)], [...marks]);
  assert.deepEqual([SHOP_SIGN_FIRST_MODEL - 1, SHOP_SIGN_FIRST_MODEL, 43727, SHOP_SIGN_LAST_MODEL, SHOP_SIGN_LAST_MODEL + 1].map((id) => sightMarksOf(id, { positions: s.positions, indices: s.indices }) !== null), [false, true, true, true, false]);
  assert.equal(sightMarksOf(41105, sign), null, 'a bench, a fence, a house: a body\'s, every triangle');
  const src = rd('src/world/signSolid.js');
  assert.match(src, /import \{ isShopSignModel \} from '\.\/houseSigns\.js';/, 'the range is houseSigns.js\'s');
  assert.doesNotMatch(src, /export const \w*(FIRST|LAST)\w*|[<>]= 437/, 'and declared nowhere else');
});

test('SIGN-PASS the motor, on a sign built to 43727\'s measures: a wagon\'s driver crossing under the board was stopped at its face and now drives on; a walker under its low edge passes; the post stops both, as a post does (mutants: the board a body\'s again; the law asked of no sign; the resolve meets a ray\'s triangle)', () => {
  const whole = signCollider(false), hung = signCollider(true), open = ground();
  const E = Math.PI / 2;   // along +x, square to the board's faces
  for (const mode of [TRANSPORT_MODES.Cart, null]) {
    const free = run(open, [-4, 0, 0.15], E, mode);
    const before = run(whole, [-4, 0, 0.15], E, mode), after = run(hung, [-4, 0, 0.15], E, mode);
    assert.ok(free.d > 6, 'the street is open without the sign');
    assert.ok(before.m.pos[0] < 0 && before.d < free.d - 2, `${mode ?? 'a walker'}: stopped under the board (x ${before.m.pos[0].toFixed(2)})`);
    assert.ok(Math.abs(after.d - free.d) < 0.05, `${mode ?? 'a walker'}: on under it as through the open street (${after.d.toFixed(2)} of ${free.d.toFixed(2)})`);
    let nearest = Infinity;
    const post = run(hung, [-4, 0, -0.9], E, mode, 2, (q) => { nearest = Math.min(nearest, offPost(q[0], q[2])); });
    assert.ok(nearest > CAPSULE_RADIUS - 0.01 && nearest < CAPSULE_RADIUS + 0.01, `${mode ?? 'a walker'}: met the post and kept off it (${nearest.toFixed(3)})`);
    assert.ok(Math.abs(post.m.pos[2] + 0.9) > 0.3 && Math.abs(post.m.pos[1]) < 0.01, 'turned round it, on the ground');
  }
});

test('SIGN-PASS a board is every ray\'s and no body\'s (AUDIT FB1025i G5): a walker\'s eye, an arrow and the camera\'s sweep meet the hung board where DFU\'s would; the body\'s own questions - room for it, what it touches, what holds it, a floor to stand it on - pass it (mutants: a ray passes it; the overlap, the contact, the parity or a body\'s ray meets it)', () => {
  const hung = signCollider(true), whole = signCollider(false);
  for (const [label, c] of [['hung', hung], ['whole', whole]]) {
    // the board's near face, x -0.05, 1.65-2.45 m up, z -0.65..0.95
    assert.ok(Math.abs(c.raycast([-3, EYE_HEIGHT, 0.15], [1, 0, 0], 10) - 2.95) < 1e-3, `${label}: a walker's eye 3 m off meets the board`);
    assert.ok(Math.abs(c.raycast([-6, 2.0, 0.5], [1, 0, 0], 20) - 5.95) < 1e-3, `${label}: an arrow at 2 m meets it`);
    assert.ok(Math.abs(c.sphereCast([-3, 2.0, 0.15], 0.2, [1, 0, 0], 10).dist - 2.75) < 0.02, `${label}: the camera's sweep meets it`);
  }
  // the body's own: inside the board, its height's room, its contact, its parity - and a floor to stand it on, from
  // inside the board's span (findClearFloor's drop): the ground, never the board's underside
  assert.equal(hung.sphereOverlaps([0, 2.0, 0.15], 0.3), false, 'room for a body in the board');
  assert.equal(whole.sphereOverlaps([0, 2.0, 0.15], 0.3), true);
  assert.equal(hung.insideSolid([0, 2.0, 0.15]), false, 'nothing holds a body there');
  assert.equal(whole.insideSolid([0, 2.0, 0.15]), true);
  const touch = (c) => c.capsuleContact([0, 0, 0.15], RIDE_HEIGHT, 0.05, { only: ['sign'] }, [0, 0, 0]);
  assert.equal(touch(hung), null, 'a rider stood under the board touches nothing of the sign');
  assert.ok(touch(whole) !== null);
  for (const c of [hung, whole]) c.addMesh('floor', new Float32Array([-9, 0, -9, 9, 0, -9, 9, 0, 9, -9, 0, 9]), new Uint32Array([0, 1, 2, 0, 2, 3]), I4);   // a floor a ray meets, as a dungeon's
  assert.ok(Math.abs(hung.findClearFloor([0, 1.7, 0.15])[1]) < 1e-6, 'a body unstuck in the board\'s span stands on the floor');
  assert.ok(whole.findClearFloor([0, 1.7, 0.15])[1] > 1, 'where the whole sign sets it on the board');
  // and a ray's triangle as wide as a square (the collider files it apart, its own tree): a body's ray passes it too
  const plaza = ground();
  plaza.addMesh('floor', new Float32Array([-30, 0, -30, 30, 0, -30, 30, 0, 30, -30, 0, 30]), new Uint32Array([0, 1, 2, 0, 2, 3]), I4);
  plaza.addMesh('awning', new Float32Array([-30, 1.7, -30, 30, 1.7, -30, 30, 1.7, 30, -30, 1.7, 30]), new Uint32Array([0, 1, 2, 0, 2, 3]), I4, null, null, false, new Uint8Array([1, 1]));
  assert.ok(Math.abs(plaza.raycast([0, 5, 0], [0, -1, 0], 10) - 3.3) < 1e-6, 'a look down meets the wide one');
  assert.ok(Math.abs(plaza.findClearFloor([0, 1.8, 0])[1]) < 1e-6, 'a body unstuck over it stands on the floor under it');
});

/** Privateer's Hold's seam connector (test/player/fb1025i_railhang.test.js seamRamp): a ramp rising 0.55 m over 1.6 m
 *  to a 0.45 m riser - a lip a walker takes by PH1's floor, rising half a metre in one step - and a board 0.1 thick hung
 *  across the corridor `over` m above the lip, z -0.6..0.6, a ray's (`marked`) or whole. */
function boardOverLip(over, marked) {
  const p = [], ix = [];
  const quad = (a, b, c, d) => { const v = p.length / 3; p.push(...a, ...b, ...c, ...d); ix.push(v, v + 1, v + 2, v, v + 2, v + 3); };
  const top = 1.0;
  quad([-2, 0, 1.6], [2, 0, 1.6], [2, 0, 8], [-2, 0, 8]);
  quad([-2, 0.55, 0], [2, 0.55, 0], [2, 0, 1.6], [-2, 0, 1.6]);
  quad([-2, 0.55, 0], [-2, top, 0], [2, top, 0], [2, 0.55, 0]);
  quad([-2, top, -8], [2, top, -8], [2, top, 0], [-2, top, 0]);
  const floorTris = ix.length / 3;
  quad([-2, top + over, -0.6], [2, top + over, -0.6], [2, top + over, 0.6], [-2, top + over, 0.6]);
  quad([-2, top + over + 0.1, -0.6], [2, top + over + 0.1, -0.6], [2, top + over + 0.1, 0.6], [-2, top + over + 0.1, 0.6]);
  const sight = new Uint8Array(ix.length / 3).map((_, t) => (t >= floorTris ? 1 : 0));
  let over0 = 0;
  for (const x of [-1, -0.5, 0, 0.5, 1]) {
    for (const runs of [false, true]) {
      const col = new Collider(() => -Infinity);
      col.addMesh('dungeon', new Float32Array(p), new Uint32Array(ix), I4, null, null, false, marked ? sight : null);
      const m = new PlayerMotor(col);
      m.spawn(x, 0.02, 4);
      for (let i = 0; i < 20; i++) m.update(FIXED_DT, IDLE, Math.PI);
      for (let i = 0; i < 180; i++) m.update(FIXED_DT, runs ? RUN : WALK, Math.PI);
      if (m.pos[2] < -1) over0++;
    }
  }
  return over0;
}

test('SIGN-PASS a body\'s own rays pass a board (AUDIT FB1025i G5): a walker and a runner taking a lip half a metre over their feet under a board hung 1.4 m over it - the head\'s rise through it, and the headroom over the lip it stands on, asked by rays of its own - take it, as under none; under the same board whole, none does (mutants: the head\'s rise or the headroom asked by a ray every board stops)', () => {
  assert.equal(boardOverLip(1.4, true), 10, 'under the hung board: every line over the lip');
  assert.equal(boardOverLip(1.4, false), 0, 'under it whole: none');
});

test('SIGN-PASS the late gate carries the marks (player/lateSolid.js): a sign stood while a rider stands under its board is no solid closing on the rider - it stands at once, its board a ray\'s, the rider riding on; whole, it is withheld (mutants: the gate drops the marks, standing it or asking it)', () => {
  const s = madeSign();
  const rider = { pos: [0, 0, 0.15], height: RIDE_HEIGHT };
  const c = ground(), late = lateSolidsOf(c);
  late.settle(rider);
  assert.equal(late.add('sign', s.positions, s.indices, SIGN_AT, { sight: sightMarksOf(43727, s) }), true, 'stood at once');
  assert.ok(Math.abs(c.raycast([-3, 2.0, 0.15], [1, 0, 0], 10) - 2.95) < 1e-3, 'its board a ray\'s');
  const m = new PlayerMotor(c);
  m.spawn(0, 0.05, 0.15);
  m.transportMode = TRANSPORT_MODES.Cart;
  for (let i = 0; i < 60; i++) m.update(FIXED_DT, RUN, Math.PI / 2);
  assert.ok(m.pos[0] > 3, `the rider rides on from under it (x ${m.pos[0].toFixed(2)})`);
  const w = ground(), lw = lateSolidsOf(w);
  lw.settle(rider);
  assert.equal(lw.add('sign', s.positions, s.indices, SIGN_AT), false, 'whole, withheld');
});

test('SIGN-PASS with ARENA2: ARCH3D\'s 56 signs are three frames of nineteen boards, and the line parts every one alike - the two-post frame keeps its 16 of 34, the post with an arm its 8 of 42, the T on a pole its 16 of 30; every standing triangle comes down to 0.5 m of the foot or lower, every hanging one stands 1.65 m over it or higher', { skip: skipReal }, () => {
  const { modelOf } = game();
  const fams = { frame: [], arm: [], pole: [] };
  let lowestHung = Infinity, highestStanding = -Infinity;
  for (let id = SHOP_SIGN_FIRST_MODEL; id <= SHOP_SIGN_LAST_MODEL; id++) {
    const m = modelOf(id);
    if (!m) continue;
    const P = m.positions, I = m.indices;
    let foot = Infinity;
    for (let i = 1; i < P.length; i += 3) foot = Math.min(foot, P[i]);
    const marks = sightMarksOf(id, m);
    for (let t = 0; t < I.length / 3; t++) {
      const low = Math.min(P[I[t * 3] * 3 + 1], P[I[t * 3 + 1] * 3 + 1], P[I[t * 3 + 2] * 3 + 1]) - foot;
      if (marks[t]) lowestHung = Math.min(lowestHung, low); else highestStanding = Math.max(highestStanding, low);
    }
    const fam = id <= 43717 ? fams.frame : id <= 43736 ? fams.arm : fams.pole;
    fam.push(`${marks.filter((x) => !x).length}/${I.length / 3}`);
  }
  assert.deepEqual(fams, { frame: Array(18).fill('16/34'), arm: Array(19).fill('8/42'), pole: Array(19).fill('16/30') });
  assert.ok(highestStanding < 0.51 && highestStanding > 0.49, `the T's pole off its flared foot (${highestStanding.toFixed(3)})`);
  assert.ok(lowestHung > 1.64 && lowestHung < 1.66, `the lowest board (${lowestHung.toFixed(3)})`);
});

test('SIGN-PASS with ARENA2, the report\'s case: TVRNBM04\'s tavern sign (43727) as the block\'s layout stands it, in the block\'s collider as the town hosts build it - a wagon driven along the street under its board was stopped at it and now drives on, a walker as well, both still kept off its post; and a walker\'s eye looking at the board meets it (AUDIT FB1025i G5)', { skip: skipReal }, () => {
  const { blocks, modelOf } = game();
  const lay = layoutRmbBlock(blocks.getBlockByName('TVRNBM04.RMB'));
  const si = lay.models.findIndex((m) => m.modelIdNum === 43727);
  assert.ok(si >= 0, 'the tavern\'s sign');
  /** the block's collider: every model at its matrix, a sign's marks by `law` (the hosts': sightMarksOf) */
  const world = (law, skip = -1) => {
    const c = ground();
    lay.models.forEach((pm, i) => {
      const m = modelOf(pm.modelIdNum);
      if (i !== skip && m) c.addMesh(`m${i}`, m.positions, m.indices, pm.matrix, null, null, false, law(pm.modelIdNum, m));
    });
    return c;
  };
  const hosts = world(sightMarksOf), dfu = world(() => null), none = world(sightMarksOf, si);
  const M = lay.models[si].matrix;
  // the sign's own frame: x across its board's faces, z along the board from its post (z -1..-0.8) out over the street
  const p = (x, z) => [M[0] * x + M[8] * z + M[12], 0, M[2] * x + M[10] * z + M[14]];
  const yaw = Math.atan2(M[0], M[2]);
  for (const mode of [TRANSPORT_MODES.Cart, null]) {
    const who = mode ? 'a wagon\'s driver' : 'a walker';
    const free = run(none, p(-4, 0.15), yaw, mode);
    assert.ok(free.d > 6, `${who}: the street open without the sign (${free.d.toFixed(2)})`);
    const before = run(dfu, p(-4, 0.15), yaw, mode), after = run(hosts, p(-4, 0.15), yaw, mode);
    assert.ok(before.d < free.d - 2, `${who}: the whole sign stopped it (${before.d.toFixed(2)} of ${free.d.toFixed(2)})`);
    assert.ok(Math.abs(after.d - free.d) < 0.05, `${who}: on under the board (${after.d.toFixed(2)} of ${free.d.toFixed(2)})`);
    let nearest = Infinity;
    const local = (q) => [(q[0] - M[12]) * M[0] + (q[2] - M[14]) * M[2], (q[0] - M[12]) * M[8] + (q[2] - M[14]) * M[10]];
    const post = run(hosts, p(-4, -0.9), yaw, mode, 2, (q) => { const [x, z] = local(q); nearest = Math.min(nearest, offPost(x, z)); });
    assert.ok(nearest > CAPSULE_RADIUS - 0.01 && nearest < CAPSULE_RADIUS + 0.02, `${who}: met the post and kept off it (${nearest.toFixed(3)})`);
    assert.ok(Math.abs(local(post.m.pos)[1] + 0.9) > 0.3, `${who}: turned round it`);
  }
  // a walker 3 m off, its eye on the board's middle: the ray meets the board, in the hosts' collider as in DFU's
  const sm = modelOf(43727), marks = sightMarksOf(43727, sm);
  let lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity], foot = Infinity;
  for (let i = 1; i < sm.positions.length; i += 3) foot = Math.min(foot, sm.positions[i]);
  for (let t = 0; t < marks.length; t++) {
    if (!marks[t]) continue;
    for (let k = 0; k < 3; k++) {
      const v = sm.indices[t * 3 + k], y = sm.positions[v * 3 + 1];
      if (y - foot > 2.4) continue;   // the board, under its arm
      for (let a = 0; a < 3; a++) { lo[a] = Math.min(lo[a], sm.positions[v * 3 + a]); hi[a] = Math.max(hi[a], sm.positions[v * 3 + a]); }
    }
  }
  const mid = [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2];
  const w = (v) => [M[0] * v[0] + M[4] * v[1] + M[8] * v[2] + M[12], M[1] * v[0] + M[5] * v[1] + M[9] * v[2] + M[13], M[2] * v[0] + M[6] * v[1] + M[10] * v[2] + M[14]];
  const target = w(mid), eye = w([-3, foot + EYE_HEIGHT, mid[2]]);
  const d = [target[0] - eye[0], target[1] - eye[1], target[2] - eye[2]], L = Math.hypot(...d);
  const dir = d.map((v) => v / L);
  const met = hosts.raycast(eye, dir, 20);
  assert.ok(met < L && Math.abs(met - dfu.raycast(eye, dir, 20)) < 1e-6, `the eye meets the board (${met.toFixed(2)} of ${L.toFixed(2)}), as DFU's does`);
  assert.ok(!(none.raycast(eye, dir, 20) < L), 'nothing else stands there');
});

test('SIGN-PASS THE TOWN HOSTS: the world\'s town build and the exterior host stand every placed model\'s triangles and hand a sign\'s marks beside them (sightMarksOf, the one law), and the late gate carries them to the collider - no interior and no dungeon stands a sign (mutants: either host back to the whole mesh a body\'s)', () => {
  const pb = rd('src/scenes/pixelBuild.js'), ex = rd('src/scenes/exterior.js'), ls = rd('src/player/lateSolid.js');
  assert.match(pb, /late\.add\(gateKey, cpu\.positions, cpu\.indices, local,\n[^\n]*\[0, 0, 0\]\)\), sight: sightMarksOf\(placed\.modelIdNum, cpu\) \}\);/);
  assert.match(pb, /import \{ sightMarksOf \} from '\.\.\/world\/signSolid\.js';/);
  assert.match(ex, /collider\.addMesh\(bucketKey, cpu\.positions, cpu\.indices, matrix, null, null, false, sightMarksOf\(placed\.modelIdNum, cpu\)\);/);
  assert.match(ex, /import \{ sightMarksOf \} from '\.\.\/world\/signSolid\.js';/);
  assert.match(ls, /const stand = \(key, h\) => collider\.addMesh\?\.\(key, h\.positions, h\.indices, h\.matrix, h\.translation, null, false, h\.sight\);/);
});

test('SIGN-PASS THE PORT\'S OWN BOARDS: the Stable\'s, the Wagon Yard\'s, the Joinery\'s and the Shipyard\'s signboards, and the Shipyard\'s crew board under its eaves, hang - a ray\'s, no body\'s: every model marks a board\'s triangles (its two faces, its four edges, its two rods: 32) and no other, and no hung triangle comes lower than 1.75 m (mutants: a board laid a body\'s; the mark left on after it; every triangle a body\'s)', () => {
  const models = { stable: buildYardModel('stable'), transport: buildYardModel('transport'), carpenter: buildYardModel('carpenter'), shipyard: buildShipyardModel() };
  const hungOf = {};
  for (const [kind, m] of Object.entries(models)) {
    assert.equal(m.sight.length, m.indices.length / 3, `${kind}: a mark a triangle`);
    let hung = 0, lowest = Infinity;
    for (let t = 0; t < m.sight.length; t++) {
      if (!m.sight[t]) continue;
      hung++;
      lowest = Math.min(lowest, ...[0, 1, 2].map((k) => m.positions[m.indices[t * 3 + k] * 3 + 1]));
    }
    hungOf[kind] = hung;
    assert.ok(lowest >= 1.75 - 1e-6, `${kind}: its lowest hung corner ${lowest.toFixed(3)}`);
  }
  assert.deepEqual(hungOf, { stable: 32, transport: 32, carpenter: 32, shipyard: 64 });
  assert.ok(STABLE_YARD.gate.beamY - 0.2 - SIGN_BOARD.h < 2.6 && CARPENTER_YARD.gate.beamY - 0.2 - SIGN_BOARD.h < 2.6, 'the gates\' boards hang inside a rider\'s 2.6 m');
});

test('SIGN-PASS THE PORT\'S OWN BOARDS, the motor: a wagon\'s driver riding in under the Stable\'s and the Joinery\'s gate boards, and the Wagon Yard\'s by its opening, was stopped at each and now rides in; a walker as before; the gateposts still stand, and a look at the Stable\'s board meets it', () => {
  const ways = [['stable', STABLE_YARD.fence.z1, [-0.4, 0, 0.4]], ['carpenter', CARPENTER_YARD.fence.z1, [-0.4, 0, 0.4]], ['transport', WAGON_YARD.fence.z1, [-5.8, -5.6]]];
  const yardOf = (m) => { const c = ground(); c.addMesh('y', m.positions, m.indices, I4, null, null, false, m.sight); return c; };
  for (const [kind, z1, xs] of ways) {
    const m = buildYardModel(kind);
    const whole = ground(), yard = yardOf(m);
    whole.addMesh('y', m.positions, m.indices, I4);
    for (const x of xs) {
      const before = run(whole, [x, 0, z1 + 3], Math.PI, TRANSPORT_MODES.Cart, 1.5), after = run(yard, [x, 0, z1 + 3], Math.PI, TRANSPORT_MODES.Cart, 1.5);
      assert.ok(before.m.pos[2] > z1 - 0.5, `${kind} at x ${x}: the board stopped it (z ${before.m.pos[2].toFixed(2)})`);
      assert.ok(after.m.pos[2] < z1 - 3, `${kind} at x ${x}: ridden in (z ${after.m.pos[2].toFixed(2)})`);
      assert.ok(run(yard, [x, 0, z1 + 3], Math.PI, null, 2).m.pos[2] < z1 - 3, `${kind} at x ${x}: walked in`);
    }
  }
  const m = buildYardModel('stable'), yard = yardOf(m);
  const post = run(yard, [-STABLE_YARD.gate.half, 0, STABLE_YARD.fence.z1 + 3], Math.PI, TRANSPORT_MODES.Cart, 1.5);
  assert.ok(post.m.pos[2] > STABLE_YARD.fence.z1, `the gatepost stands (z ${post.m.pos[2].toFixed(2)})`);
  const boardY = STABLE_YARD.gate.beamY - 0.2 - SIGN_BOARD.h / 2;
  assert.ok(yard.raycast([0, boardY, STABLE_YARD.fence.z1 + 3], [0, 0, -1], 10) < 3.1, 'the board meets a look at it');
});

test('SIGN-PASS THE PORT\'S OWN BOARDS by source: both yard hosts stand a model\'s every triangle and hand its marks to the collider (mutants: either host back to the whole model a body\'s)', () => {
  for (const host of ['src/scenes/merchantYardsHost.js', 'src/scenes/portHost.js']) {
    const h = rd(host);
    assert.match(h, /const sight = parts\.some\(\(p\) => p\.sight\) \? new Uint8Array\(icount \/ 3\) : null;/, host);
    assert.match(h, /if \(sight && p\.sight\) sight\.set\(p\.sight, i \/ 3\);/, host);
    assert.match(h, /col\.addMesh\((y|pl)\.bucket, g\.positions, g\.indices, (y|pl)\.matrix, null, null, false, g\.sight\);/, host);
  }
});

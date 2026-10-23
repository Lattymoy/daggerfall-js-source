// FIELD BUGS 2026-10-20f - ORRERY-STONES (bible/01-Overview/bugs/Field-Bugs-2026-10-20f.md; ilovemybonk in #general, of the
// Elite Breach: "the clocks that do the time in the orrery task halls do not have models showing you where to interact with
// them. You have to search around an empty area for the 'rewind back, move forward' options while imps hit you"): AN
// ATHENAEUM'S STONES STAND, AND THEIR LEVERS ARE THE HANDLES. The Spire drew each stone as a gold disc on the floor and offered
// the activation ray two boxes 0.9 m to either side of it a metre up, with nothing drawn there. Pinned here:
//   THE STONES - each spot of an Athenaeum stands the Hour's own stone j (world/superDungeon/sdHall.js buildStoneModel, its bezel,
//     hand and crown gear - scenes/eliteGates/egOrrery.js), its foot on the spot and its floor (THE ASCENT's and the 0 court of
//     the laws before), facing the court's heart;
//   THE LEVERS - each handle's box holds its stone's drawn lever whole, the forward one on the right of one who faces the
//     stone, found by the real ray from a body before the stone over the circle's collider and the stones' own solids, from
//     within the room's reach of it;
//   SOLID - the stones stand in the collider;
//   THE HANDS - at the relay's start before the trial, at the room's word in it, at the true hours once the hall is behind,
//     going to a word's hour at the Hour's pace;
//   THE WORDS - a stone's name and hour stand over its crown, never across its sign.
// Every fixture is the producers' own: the halls off the law (egHallOf, egCirclePlan), the circle's collider
// (egCircleColliderTris), the span stood (createEgSpan), the real pick (player/activate.js pickActivatableHit), the breach from
// the director (egBreachNew, egEnter, egStep), its words through the wire (validEgOut) and the fold (foldEg).
import test from 'node:test';
import assert from 'node:assert/strict';
import { egHallOf, egFirstHallOf, egCirclePlan, egCircleOfHall, egSpecForget, EG_SPEC, EG_SEALED_MS } from '../../../src/net/eliteGates/egLaw.js';
import { egGive8 } from '../../egGive8.mjs';
import { createEgSpan } from '../../../src/scenes/eliteGates/egSpan.js';
import { EG_STONE_TOP_M } from '../../../src/scenes/eliteGates/egOrrery.js';
import { egCircleColliderTris, egToDungeon } from '../../../src/world/eliteGates/egHall.js';
import { pickActivatableHit, DEFAULT_ACTIVATION_DISTANCE } from '../../../src/player/activate.js';
import { stoneFrame, stonePoint, handMatrix, crownGearMatrix, SD_HANDLE, SD_STONE_SIZE, SD_STONE_SHAPE } from '../../../src/world/superDungeon/sdHall.js';
import { realmToDungeon, SD_STONE_POS, SD_STONES } from '../../../src/net/superDungeon/sdBrain.js';
import { SD_HAND_RATE } from '../../../src/scenes/superDungeon/sdHall.js';
import { registerSpireObjs } from '../../../src/systems/eliteGates/spireKit.js';
import { spireOrreryOf, EG_STONE_REACH_M } from '../../../src/systems/eliteGates/spireOrrery.js';
import { egBreachNew, egEnter, egStep, egStateOf } from '../../../src/net/eliteGates/egBrain.js';
import { egFightState, EG_ROLE } from '../../../src/net/eliteGates/egBodies.js';
import { EG_OBJ } from '../../../src/net/eliteGates/egLords.js';
import { validEgOut } from '../../../src/net/wire.js';
import { foldEg, EG_STATE_EMPTY } from '../../../src/net/eliteGates/egLink.js';
import { createEgFight } from '../../../src/scenes/eliteGates/egFight.js';
import { egScreenAt } from '../../../src/world/eliteGates/egTelegraph.js';
import { lookAt, perspective, mirrorProjectionX, multiply, UP_Y } from '../../../src/world/mat4.js';

/** The first circle (seeds 1-80, circles 2-20) of law `law` whose Athenaeum `want` takes: `{ seed, c, s }`. */
function findAthenaeum(law, want) {
  for (let seed = 1; seed <= 80; seed++) for (let c = 2; c <= 20; c++) {
    const k = egCirclePlan(seed, c, law).findIndex((p) => p.kind === 'athenaeum');
    if (k < 0) continue;
    const s = egHallOf(seed, egFirstHallOf(c) + k, 0, law);
    if (want(s)) return { seed, c, s };
  }
  throw new Error('no such Athenaeum');
}
/** A renderer that makes a mesh of every model (no vertex updates: each part its own draw, its matrix read whole). */
const RENDERER = Object.freeze({ createMesh: (m) => ({ m }), uploadTexture: () => {}, uploadEmissionTexture: () => {} });
/** The span of circle `c` stood: its draws and every collider mesh it added (key -> triangles). */
function stood(seed, c) {
  const span = createEgSpan({ renderer: RENDERER, seed, c, lite: false }), draws = [], added = new Map();
  span.stand({ dynamicDraws: draws, collider: { addMesh: (key, p) => added.set(key, p) } });
  return { span, draws, added };
}
/** The circle's collider as the pick reads it: the nearest triangle the ray meets within `max` (Moller-Trumbore). */
const colliderOf = (...lists) => ({
  raycast(o, d, max) {
    let best = Infinity;
    for (const tris of lists) for (let i = 0; i < tris.length; i += 9) {
      const e1 = [tris[i + 3] - tris[i], tris[i + 4] - tris[i + 1], tris[i + 5] - tris[i + 2]], e2 = [tris[i + 6] - tris[i], tris[i + 7] - tris[i + 1], tris[i + 8] - tris[i + 2]];
      const p = [d[1] * e2[2] - d[2] * e2[1], d[2] * e2[0] - d[0] * e2[2], d[0] * e2[1] - d[1] * e2[0]], det = e1[0] * p[0] + e1[1] * p[1] + e1[2] * p[2];
      if (Math.abs(det) < 1e-12) continue;
      const t0 = [o[0] - tris[i], o[1] - tris[i + 1], o[2] - tris[i + 2]], u = (t0[0] * p[0] + t0[1] * p[1] + t0[2] * p[2]) / det;
      if (u < 0 || u > 1) continue;
      const qv = [t0[1] * e1[2] - t0[2] * e1[1], t0[2] * e1[0] - t0[0] * e1[2], t0[0] * e1[1] - t0[1] * e1[0]], v = (d[0] * qv[0] + d[1] * qv[1] + d[2] * qv[2]) / det;
      if (v < 0 || u + v > 1) continue;
      const t = (e2[0] * qv[0] + e2[1] * qv[1] + e2[2] * qv[2]) / det;
      if (t > 1e-6 && t < best && t <= max) best = t;
    }
    return best;
  },
});
const unit = (v) => { const n = Math.hypot(...v); return v.map((x) => x / n); };
const inBox = (b, p, eps = 1e-9) => p.every((x, k) => x >= b.min[k] - eps && x <= b.max[k] + eps);
/** Stone `j`'s drawn lever on `side` (world/superDungeon/sdHall.js stoneQuads' cast lever: across, up and out from its slab's
 *  mid-plane), its eight corners where the Hour stands it - the realm's frame. */
function leverCorners(j, side) {
  const x = side * (SD_STONE_SIZE.w / 2 - SD_HANDLE.inset), L = SD_STONE_SHAPE.lever, out = [], mid = SD_STONE_SIZE.d / 2;
  for (const r of [x - L.half, x + L.half]) for (const y of [SD_HANDLE.y - 0.085, SD_HANDLE.y + 0.085]) for (const o of [L.base, L.front]) out.push(stonePoint(j, r, y, o - mid));
  return out;
}

/** Every stone of Athenaeum `s` (circle `c` of `seed`, its floor `floorY`) stood, its levers its handles, reached. */
function eachStoneStands(seed, c, s, floorY) {
  const { span, draws, added } = stood(seed, c);
  const heart = s.spots.orrery[0], tris = egCircleColliderTris(seed, c, 0), solids = added.get(`eg:orrery:${s.h}`), targets = span.targets();
  assert.ok(solids && solids.length === 6 * 126 * 3, `the six stones stand in the collider, each its slab, cap and levers (${solids?.length})`);
  assert.equal(targets.filter((t) => t.key.startsWith(`egstone:${s.h}:`)).length, 2 * s.spots.stone.length, 'each stone\'s two handles');
  for (const [j, q] of s.spots.stone.entries()) {
    const st = span.orrery.find((x) => x.h === s.h && x.j === j), at = [s.x0 + q.x, floorY, q.z];
    assert.ok(st, `stone ${j} stood`);
    // THE STONE: its four parts drawn, its body the Hour's stone j carried to its spot on its floor, facing its court's heart
    for (const part of ['body', 'bezel', 'hand', 'gear']) assert.ok(st[part] && draws.includes(st[part]) && st[part].gpu, `stone ${j}: its ${part} drawn`);
    assert.deepEqual([SD_STONE_POS[j].x + st.d[0], st.d[1], SD_STONE_POS[j].z + st.d[2]].map((v) => +v.toFixed(9)), at.map((v) => +v.toFixed(9)), `stone ${j}: its foot on its spot, on its floor (${floorY} m)`);
    const m = st.body.object.matrix, D = realmToDungeon(...at), H = realmToDungeon(...stoneFrame(j).at);
    assert.deepEqual([m[0], m[5], m[10], m[15], m[1], m[2], m[4], m[6], m[8], m[9]], [1, 1, 1, 1, 0, 0, 0, 0, 0, 0], `stone ${j}: carried, never turned`);
    assert.deepEqual([m[12], m[13], m[14]].map((v) => +v.toFixed(4)), [D[0] - H[0], D[1] - H[1], D[2] - H[2]].map((v) => +v.toFixed(4)), `stone ${j}: drawn on its spot`);
    const { n, R } = stoneFrame(j), toHeart = unit([heart.x - q.x, heart.z - q.z]);
    assert.ok(n[0] * toHeart[0] + n[2] * toHeart[1] > 0.9999, `stone ${j}: its face toward the court's heart`);
    // THE LEVERS: each handle holds its drawn lever whole, forward on the right as one faces it, found by the real ray
    for (const side of [1, -1]) {
      const key = `egstone:${s.h}:${j}:${side > 0 ? 'f' : 'b'}`, box = targets.find((t) => t.key === key).aabb;
      for (const p of leverCorners(j, side)) assert.ok(inBox(box, realmToDungeon(p[0] + st.d[0], p[1] + st.d[1], p[2] + st.d[2])), `${key}: its box holds its drawn lever`);
      const c0 = box.min.map((v, k) => (v + box.max[k]) / 2);
      assert.ok(Math.abs(c0[1] - D[1] - SD_HANDLE.y) < 1e-6, `${key}: at the lever's height over its own floor`);
      assert.ok(Math.sign((c0[0] - D[0]) * R[0] + (c0[2] - D[2]) * R[2]) === side, `${key}: ${side > 0 ? 'forward on the right' : 'back on the left'} of one who faces it`);
      // a body before the stone, its eyes 1.6 m over the floor, aims at the lever: the ray over the circle and the stones finds it
      const before = SD_STONE_SIZE.d / 2 + 1.2, eye = realmToDungeon(at[0] + n[0] * before, floorY + 1.6, at[2] + n[2] * before);
      assert.ok(Math.hypot(eye[0] - D[0], eye[2] - D[2]) <= EG_STONE_REACH_M, `${key}: from within the room's reach of the stone`);
      const hit = pickActivatableHit(eye, unit([c0[0] - eye[0], c0[1] - eye[1], c0[2] - eye[2]]), targets, colliderOf(tris, solids));
      assert.equal(hit?.key, key, `${key}: the ray from before the stone finds its lever`);
      assert.ok(hit.distance <= DEFAULT_ACTIVATION_DISTANCE, `${key}: within reach (${hit.distance.toFixed(2)} m)`);
    }
    // SOLID: from the court's heart at a metre over its floor, a body's way to the stone meets its slab
    const o = realmToDungeon(s.x0 + heart.x, floorY + 1, heart.z), t = colliderOf(solids).raycast(o, unit([D[0] - o[0], 0, D[2] - o[2]]), 20);
    assert.ok(Math.abs(t - (Math.hypot(heart.x - q.x, heart.z - q.z) - SD_STONE_SIZE.d / 2)) < 0.05, `stone ${j}: solid at its face (${t})`);
  }
  assert.equal(span.hoverName(`egstone:${s.h}:0:f`).title, 'Daggerfall - the lion');
  return span;
}

test('ORRERY-STONES (FIELD BUGS 2026-10-20f): an Athenaeum\'s six stones stand as the Hour\'s own on their spots and their court\'s floor, facing its heart, solid; each handle holds its stone\'s drawn lever, forward on the right, and the real ray from a body before the stone finds it (mutants: the floor unread; the shift unread; a box left at the Hour\'s place; forward and back swapped; the stones not solid; a stone drawn at the Hour\'s place)', () => {
  const { seed, c, s } = findAthenaeum(EG_SPEC, (q) => Math.abs(q.spots.stone?.[0]?.y ?? 0) >= 400);
  assert.ok((s.law ?? 0) >= 9, 'THE ASCENT\'s court, off the 0 floor');
  eachStoneStands(seed, c, s, s.spots.stone[0].y / 100);
});

test('ORRERY-STONES (FIELD BUGS 2026-10-20f): the laws before THE ASCENT stand the Athenaeum\'s court at 0, and its stones on it (mutant: a spot with no height read as no number)', () => {
  const { seed, c, s } = findAthenaeum(8, () => true);
  assert.equal(s.spots.stone[0].y, undefined, 'law 8 lays no spot height');
  egGive8(seed, [c], 0);
  try {
    eachStoneStands(seed, c, egHallOf(seed, s.h, 0), 0);
  } finally { egSpecForget(); }
});

test('ORRERY-STONES (FIELD BUGS 2026-10-20f): THE HANDS - at the relay\'s start before the trial, going to the room\'s word in it at the Hour\'s pace the short way, at the true hours once the hall is behind the company; each crown gear with its hand (mutants: the hands never posed a frame; the truth unread; a hand drawn at the Hour\'s place)', () => {
  const { seed, c, s } = findAthenaeum(EG_SPEC, () => true);
  const o = spireOrreryOf(seed, s), { span } = stood(seed, c);
  const carried = (j, hour, fn) => { const st = span.orrery.find((x) => x.h === s.h && x.j === j), m = fn(j, hour); m[12] += st.d[0]; m[13] += st.d[1]; m[14] += st.d[2]; return [...m].map((v) => +v.toFixed(4)); };
  const shows = (j, hour) => {
    const st = span.orrery.find((x) => x.h === s.h && x.j === j);
    assert.deepEqual([...st.hand.object.matrix].map((v) => +v.toFixed(4)), carried(j, hour, handMatrix), `stone ${j}'s hand at ${hour}`);
    assert.deepEqual([...st.gear.object.matrix].map((v) => +v.toFixed(4)), carried(j, hour, crownGearMatrix), `stone ${j}'s gear with its hand at ${hour}`);
  };
  const frames = (n, dt = 0.1) => { for (let k = 0; k < n; k++) span.ride(k * dt, dt, null, false); };
  let word = { h: s.h - 1, objs: [] };
  registerSpireObjs(() => word);
  try {
    // before the trial: the relay's start
    frames(3);
    for (let j = 0; j < SD_STONES.length; j++) shows(j, o.start[j]);
    // the room's word in its trial: stone 2 three hours on, stone 4 five back - a frame takes each SD_HAND_RATE an hour a second
    const said = [...o.start];
    said[2] = (said[2] + 3) % 12; said[4] = (said[4] + 7) % 12;
    word = { h: s.h, objs: [], orr: said };
    frames(1);
    shows(2, (o.start[2] + 0.1 * SD_HAND_RATE) % 12);
    shows(4, (o.start[4] + 12 - 0.1 * SD_HAND_RATE) % 12);   // five back is the short way
    shows(0, o.start[0]);
    frames(30);
    for (let j = 0; j < SD_STONES.length; j++) shows(j, said[j]);
    // the hall behind the company: its door opened on a true Orrery alone
    word = { h: s.h + 1, objs: [] };
    frames(40);
    for (let j = 0; j < SD_STONES.length; j++) shows(j, o.truth[j]);
  } finally { registerSpireObjs(null); }
});

test('ORRERY-STONES (FIELD BUGS 2026-10-20f): THE WORDS - in an Athenaeum\'s trial each stone\'s name and hour stand over its crown gear, never across its sign (mutant: the words at an errand\'s height, on the stone\'s face)', () => {
  // the director's own breach, woken in the hall, its word folded as a member's screen holds it (fb1017e_orrerysight's)
  const T0 = 1_800_000_000_000, SITE = { px: 1, py: 1, x: 0, y: 0, z: 0, yaw: 0 };
  const wire = (f) => { const { to: _to, ...rest } = f; const v = validEgOut(JSON.parse(JSON.stringify(rest))); assert.ok(v, `the wire refuses ${f.k}`); return v; };
  let rs = 1;
  const rng = () => { rs = (Math.imul(rs, 1103515245) + 12345) >>> 0; return rs / 4294967296; };
  const { seed, s } = findAthenaeum(EG_SPEC, () => true), h = s.h;
  const co = [['acct-0', 'Mac', 1], ['acct-1', 'Ann', 2]];
  const B = egBreachNew({ b: '0123456789abcdef', ez: 'z'.repeat(20), s: 'acct-0', o: 'Mac', ew: 0, rh: 0, seed, op: T0, co, site: SITE, wg: [] });
  let now = T0 + EG_SEALED_MS + 100;
  for (const [sub] of co) assert.equal(egEnter(B, sub, `ord${sub}`.padEnd(20, 'x'), 40, now), null);
  B.pr = ''; B.dc = [];
  B.h = h; B.sg = 'arrive'; B.wk = now; B.cnt = { left: 1_800_000, at: now }; B.pulledAt = now; B.su = now + 30_000;
  const pos = Object.fromEntries(co.map(([sub], i) => [sub, { sx: s.x0 + s.arrive.x + i * 0.5, z: s.arrive.z }]));
  for (let k = 0; k < 400 && B.sg !== 'trial'; k++) { now += 250; egStep(B, now, co.map(([sub]) => ({ sub, ...pos[sub], dead: false, at: now })), rng); }
  assert.equal(B.sg, 'trial');
  const { k: _k, ...st } = egStateOf(B, now);
  const E = foldEg(foldEg(EG_STATE_EMPTY, wire({ k: 'st', ...st }), now), wire(egFightState(B.F, now)), now);
  const stones = E.fight.bodies.filter((b) => b.role === EG_ROLE.obj && b.k === EG_OBJ.stone);
  assert.equal(stones.length, 6);
  const fight = createEgFight({ link: { state: () => E, now: () => now }, now: () => now, player: () => ({ health: 100, maxHealth: 100 }), me: () => 'acct-0', strike: () => {},
    feet: () => egToDungeon(s, s.fight.x, 0, s.fight.z), peerAt: () => null });
  fight.frame();
  try {
    for (const [j, q] of s.spots.stone.entries()) {
      const y = Number.isFinite(q.y) ? q.y / 100 : 0, eye = egToDungeon(s, s.fight.x, y + 1.6, s.fight.z), foot = egToDungeon(s, q.x, y, q.z);
      const proj = mirrorProjectionX(perspective(1.2, 16 / 9, 0.1, 500)), view = lookAt(eye, egToDungeon(s, q.x, y + 2, q.z), UP_Y);
      fight.drawPass(proj, view, eye, 1);
      const b = stones.find((x) => x.pt === j), sg = fight.sigils().find((x) => x.key === `orr${b.i}`);
      assert.ok(sg, `stone ${j}: its words`);
      const crown = egScreenAt(multiply(proj, view), [foot[0], foot[1] + EG_STONE_TOP_M, foot[2]]), sign = egScreenAt(multiply(proj, view), [foot[0], foot[1] + 2.34, foot[2]]);
      assert.ok(crown && sign && sg.y < crown[1] && sg.y < sign[1], `stone ${j}: its words (${sg.y.toFixed(3)}) over its crown (${crown?.[1].toFixed(3)}) and its sign (${sign?.[1].toFixed(3)})`);
    }
  } finally { fight.leave?.(); }
});

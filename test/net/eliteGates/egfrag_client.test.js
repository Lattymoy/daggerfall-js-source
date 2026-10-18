// EG-FULL, LAYER THREE (2026-10-11, the Elite Gates arc; bible/11-Multiplayer/Elite-Gates.md sections 11.3, 11.6-11.10
// and 13.3): THE FRAGMENTS ON THIS SCREEN - the fragments' own pieces stood and moved by the one law (scenes/eliteGates/egSpan.js): a
// Moon branch there only under its beam, a Drum that carries, a Bone bridge that crumbles, a Sinking flight that sinks
// under my foot; the Collapsing Tube's floor falling behind the company and its cast forward; Grath's islands falling as
// the relay says and a cast-back onto a standing one; a false wall standing in its alcove's doorway until it falls; an
// Athenaeum's Orrery handles and a chamber's engine in the activation ray. The circle's mesh and collider (world/eliteGates/egHall.js):
// the passages' walls broken at their alcoves, the Colonnade open, the Tube's vault and Grath's islands left to the spans,
// a Drop's far wall a doorway on the course's line. The fight's place pass (scenes/eliteGates/egFight.js): a fire fall that burns
// once a burning, an Eclipse that strikes outside its moon-shafts, a soul-wisp that drains and lets go. The breach client
// (scenes/eliteGates/egClient.js): a stone's turn and an engine's work sent, a page of the Annals kept.
import test from 'node:test';
import assert from 'node:assert/strict';
import { egHallOf, egCircleSpecs, egFirstHallOf, egTubeCircle, egSpecForget } from '../../../src/net/eliteGates/egLaw.js';
import { egGive8 } from '../../egGive8.mjs';
import { egHazardParts, egEclipseShafts, EG_HAZARDS } from '../../../src/net/eliteGates/egFragLaw.js';
import { egPieceAt, EG_SINK_MPS, EG_SINK_GONE_M } from '../../../src/net/eliteGates/egSpanLaw.js';
import { createEgSpan, egStepKey, egDropTris, DROP_DOOR, EG_STEP_GONE_Y } from '../../../src/scenes/eliteGates/egSpan.js';
import { egCircleColliderTris, egCircleLights, buildEgCircleModel, egNicheBoxes, egIsleDisc, egToDungeon } from '../../../src/world/eliteGates/egHall.js';
import { createEgFight } from '../../../src/scenes/eliteGates/egFight.js';
import { EG_FIGHT_EMPTY } from '../../../src/net/eliteGates/egLink.js';
import { realmToDungeon, dungeonToRealm } from '../../../src/net/superDungeon/sdBrain.js';
import { registerSpireWake, registerSpireObjs, registerSpireAct } from '../../../src/systems/eliteGates/spireKit.js';
import { egBreachNew, egEnter, egStateOf } from '../../../src/net/eliteGates/egBrain.js';
import { EG_SEALED_MS } from '../../../src/net/eliteGates/egLaw.js';
import { createEgClient } from '../../../src/scenes/eliteGates/egClient.js';
import { validEgOut } from '../../../src/net/wire.js';
import { EG_ANNALS } from '../../../src/net/eliteGates/egAnnals.js';
import { egTubeFromMouth, EG_TUBE_MOUTH_S } from '../../../src/net/eliteGates/egFair.js';   // EG-PERFECT: a routed hall's tube from its mouth

/** The first circle (seeds 1-600, circles 1-20) one of whose specs `want` takes: `{ seed, c, s }`. */
function findCircle(want, from = 1) {
  for (let seed = 1; seed <= 600; seed++) for (let c = from; c <= 20; c++) for (const s of egCircleSpecs(seed, c, 0)) if (want(s)) return { seed, c, s };
  throw new Error('no such circle');
}
/** PIN MOVED (THE ASCENT - THE ROOMS, LAW 9 - 2026-10-16): a circle of spec law 8 that `want` holds, given (test/egGive8.mjs) -
 *  for a pin written on law 8's ground (a passage along +z, its alcove beside it); egSpecForget after. */
function findCircle8(want) {
  for (let seed = 1; seed <= 600; seed++) for (let c = 1; c <= 20; c++) for (let k = 0; k < 5; k++) {
    const s = egHallOf(seed, egFirstHallOf(c) + k, 0, 8);
    if (want(s)) { egGive8(seed, [c], 0); return { seed, c, s: egHallOf(seed, s.h, 0) }; }
  }
  throw new Error('no such circle');
}
const stand = (span) => { const buckets = new Map(); span.stand({ dynamicDraws: [], collider: { addMesh: (key, p, i, m, T) => buckets.set(key, { T, p }) } }); return buckets; };
/** Does a horizontal triangle of the collider lie under (x, z) at height y (the dungeon's frame)? */
function floorUnder(tris, x, y, z) {
  for (let i = 0; i < tris.length; i += 9) {
    const ys = [tris[i + 1], tris[i + 4], tris[i + 7]];
    if (!ys.every((q) => Math.abs(q - y) < 0.05)) continue;
    const ax = tris[i], az = tris[i + 2], bx = tris[i + 3], bz = tris[i + 5], cx = tris[i + 6], cz = tris[i + 8];
    const d = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz), l1 = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / d, l2 = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / d;
    if (l1 >= -1e-6 && l2 >= -1e-6 && 1 - l1 - l2 >= -1e-6) return true;
  }
  return false;
}
/** Does any triangle of the collider cross the level segment from (x0, y, z0) to (x1, y, z1)? (Moller-Trumbore) */
function wallBetween(tris, x0, z0, x1, z1, y) {
  const o = [x0, y, z0], d = [x1 - x0, 0, z1 - z0];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  for (let i = 0; i < tris.length; i += 9) {
    const A = [tris[i], tris[i + 1], tris[i + 2]], B = [tris[i + 3], tris[i + 4], tris[i + 5]], C = [tris[i + 6], tris[i + 7], tris[i + 8]];
    const e1 = sub(B, A), e2 = sub(C, A), pv = cross(d, e2), det = dot(e1, pv);
    if (Math.abs(det) < 1e-12) continue;
    const tv = sub(o, A), u = dot(tv, pv) / det;
    if (u < 0 || u > 1) continue;
    const qv = cross(tv, e1), v = dot(d, qv) / det;
    if (v < 0 || u + v > 1) continue;
    const t = dot(e2, qv) / det;
    if (t >= 0 && t <= 1) return true;
  }
  return false;
}

test('EG-FULL LAYER THREE THE FRAGMENTS\' PIECES ON THE SCREEN (sections 10.3 and 11.3): a Moon branch\'s bucket stands only while its beam lies on it; a Drum stands where the law rolls it and carries its rider; a Bone bridge falls under my foot as a Crumble; a Sinking flight sinks under my foot at 0.5 m/s, carrying me down, and is gone 3 m down (mutants: a branch solid in the dark; the rider left behind; the flight that never sinks)', () => {
  const moonC = findCircle((s) => s.steps.some((q) => q.kind === 'moon'));
  const span = createEgSpan({ seed: moonC.seed, c: moonC.c }), B = stand(span);
  const ms = moonC.s.steps.find((q) => q.kind === 'moon'), key = egStepKey(moonC.s.h, ms.i);
  for (const t of [0, 0.7, 1.4, 2.1, 2.8, 3.5]) {
    span.ride(t, 0.016, null, false);
    const st = span.steps.find((q) => q.key === key);
    assert.equal(st.solid, egPieceAt(ms, t).solid, `t ${t}: the branch as its beam has it`);
    assert.equal(B.get(key).T()[1] === EG_STEP_GONE_Y, !egPieceAt(ms, t).solid, 'its bucket sunk while dark');
  }
  const drumC = findCircle((s) => s.steps.some((q) => q.kind === 'drum'));
  const dspan = createEgSpan({ seed: drumC.seed, c: drumC.c });
  stand(dspan);
  const dr = drumC.s.steps.find((q) => q.kind === 'drum'), dkey = egStepKey(drumC.s.h, dr.i);
  const rider = { pos: realmToDungeon(drumC.s.x0 + dr.x, dr.y, dr.z), grounded: true, groundKey: dkey, height: 1.8, carried: [0, 0, 0], carryBy(dx, dy, dz) { this.carried[0] += dx; this.carried[2] += dz; }, collider: { move: () => {} } };
  dspan.ride(0.2, 0.016, rider, true); dspan.ride(0.3, 0.016, rider, true);
  assert.ok(Math.abs(rider.carried[2] - (egPieceAt(dr, 0.3).dz - egPieceAt(dr, 0.2).dz)) < 1e-6 && rider.carried[2] !== 0, 'the drum carries its rider along');
  const boneC = findCircle((s) => s.steps.some((q) => q.kind === 'bone'));
  const bspan = createEgSpan({ seed: boneC.seed, c: boneC.c });
  stand(bspan);
  const bn = boneC.s.steps.find((q) => q.kind === 'bone'), bkey = egStepKey(boneC.s.h, bn.i);
  const onBone = { pos: realmToDungeon(boneC.s.x0 + bn.x, bn.y, bn.z), grounded: true, groundKey: bkey, height: 1.8, carryBy: () => {}, collider: { move: () => {} } };
  bspan.ride(10, 0.016, onBone, true);
  onBone.grounded = false; onBone.groundKey = null;
  bspan.ride(10.5, 0.016, onBone, true);
  assert.equal(bspan.steps.find((q) => q.key === bkey).solid, true, 'still whole inside its delay');
  bspan.ride(10.8, 0.016, onBone, true);
  assert.equal(bspan.steps.find((q) => q.key === bkey).solid, false, 'fallen after it');
  const sinkC = findCircle((s) => s.steps.some((q) => q.kind === 'sink'));
  const sspan = createEgSpan({ seed: sinkC.seed, c: sinkC.c }), SB = stand(sspan);
  const sk = sinkC.s.steps.find((q) => q.kind === 'sink'), skey = egStepKey(sinkC.s.h, sk.i);
  const home = realmToDungeon(sinkC.s.x0 + sk.x, sk.y, sk.z)[1];
  const onFlight = { pos: realmToDungeon(sinkC.s.x0 + sk.x, sk.y, sk.z), grounded: true, groundKey: skey, height: 1.8, carried: [0, 0, 0], carryBy(dx, dy, dz) { this.carried[1] += dy; }, collider: { move: () => {} } };
  sspan.ride(20, 0.016, onFlight, true);
  sspan.ride(22, 0.016, onFlight, true);
  assert.ok(Math.abs(SB.get(skey).T()[1] - (home - EG_SINK_MPS * 2)) < 1e-6, 'two seconds on, a metre down');
  assert.ok(Math.abs(onFlight.carried[1] + EG_SINK_MPS * 2) < 1e-6, 'carrying me down');
  sspan.ride(20 + EG_SINK_GONE_M / EG_SINK_MPS + 0.1, 0.016, onFlight, true);
  assert.equal(SB.get(skey).T()[1], EG_STEP_GONE_Y, 'gone three metres down');
});

test('EG-FULL LAYER THREE THE COLLAPSING TUBE AND GRATH\'S ISLANDS (sections 11.3 and 13.3): the Tube\'s floor stands as segments - none fallen before its start after the wake, then each falling as its fallen edge passes at 4.0 m/s - and a member caught is cast forward onto the nearest standing segment ahead; Grath\'s three islands stand as buckets, cracked one still standing, fallen one sunk as the relay says, and a cast-back from a fallen one lands on a standing one; neither the circle\'s mesh nor its collider carries either (mutants: the tube never falling; a cast back into the void; the islands fixed in the static floor)', () => {
  const tc = findCircle((s) => !!s.tube);
  const wake = { h: 0, hw: 0, tm: 0 };
  registerSpireWake(() => wake);
  try {
    const span = createEgSpan({ seed: tc.seed, c: tc.c });
    stand(span);
    const T = tc.s.tube;
    span.ride(1, 0.016, null, false);
    assert.ok(span.tubes.length >= 30 && span.tubes.every((g) => !g.gone), 'the Tube as segments, standing');
    // PIN MOVED (EG-PERFECT, 2026-10-18): a routed hall's Tube (spec law 9) falls from the company's arrival at its mouth (the
    // stage's `tm` - net/eliteGates/egFair.js egTubeEdgeIn), EG_TUBE_MOUTH_S after it, never from the wake (its mouth stands 34-82 s
    // of walking from the plate - test/net/eliteGates/egperfect_tube.test.js); a hall of the laws before falls from its wake
    const routed = egTubeFromMouth(tc.s), S0 = routed ? 2_040_000 + EG_TUBE_MOUTH_S * 1000 : 2_000_000 + T.start * 1000;
    wake.h = tc.s.h; wake.hw = 2_000_000;
    if (routed) {
      span.ride((2_000_000 + T.start * 1000 + 5000) / 1000, 0.016, null, false);
      assert.ok(span.tubes.every((g) => !g.gone), 'a routed hall: none fallen from its wake while nobody has reached its mouth');
      wake.tm = 2_040_000;
    }
    span.ride((S0 - 100) / 1000, 0.016, null, false);
    assert.ok(span.tubes.every((g) => !g.gone), 'none before its start');
    span.ride((S0 + 5000) / 1000, 0.016, null, false);
    const edge = T.z0 + T.mps * 5;
    for (const g of span.tubes) assert.equal(g.gone, g.z1 <= edge + 1e-9, `segment ${g.k}`);
    // caught behind the edge: cast forward
    const body = { pos: realmToDungeon(tc.s.x0 + T.x, T.y, T.z0 + 3), grounded: true, groundKey: span.tubes[1].key, height: 1.8, carryBy: () => {}, collider: { move: () => {} } };
    span.ride((S0 - 50) / 1000, 0.016, body, true);
    body.grounded = false; body.groundKey = null; body.pos[1] -= 40;
    const back = span.ride((S0 + 5000) / 1000, 0.016, body, true);
    const [, , bz] = dungeonToRealm(back[0], back[1], back[2]);
    assert.ok(bz > edge, `cast forward past the fallen edge (${bz.toFixed(2)} > ${edge.toFixed(2)})`);
    // the circle's collider carries no floor under the Tube
    const tris = egCircleColliderTris(tc.seed, tc.c, 0), mid = realmToDungeon(tc.s.x0 + T.x, T.y, (T.z0 + T.z1) / 2);
    assert.equal(floorUnder(tris, mid[0], mid[1], mid[2]), false, 'no static floor under the Tube');
  } finally { registerSpireWake(null); }
  // GRATH'S ISLANDS
  const gc = findCircle((s) => s.kind === 'court' && s.lord === 'hound', 1);
  const isles = gc.s.discs.filter((d) => egIsleDisc(gc.s, d));
  assert.equal(isles.length, 3);
  const objs = { h: gc.s.h, objs: isles.map((d, i) => ({ t: 'isle', i: 10 + i, x: d.x, z: d.z, st: 0, stAt: 0, pt: 0 })) };
  registerSpireObjs(() => objs);
  try {
    const span = createEgSpan({ seed: gc.seed, c: gc.c }), B = stand(span);
    assert.equal(span.isles.length, 3);
    objs.objs[0].st = 1; objs.objs[1].st = 2; objs.objs[1].stAt = 5000;
    span.ride(6, 0.016, null, false);
    const now = span.isles;
    assert.equal(now[0].gone, false, 'a cracked island still stands');
    assert.equal(now[1].gone, true, 'a fallen one is sunk');
    assert.equal(B.get(now[1].key).T()[1], EG_STEP_GONE_Y);
    // a cast-back from the fallen island lands on a standing one
    const d1 = isles[1], body = { pos: realmToDungeon(gc.s.x0 + d1.x, d1.y, d1.z), grounded: true, groundKey: 'eg:hall', height: 1.8, carryBy: () => {}, collider: { move: () => {} } };
    objs.objs[1].st = 0;
    span.ride(6.1, 0.016, body, true);
    objs.objs[1].st = 2;
    body.grounded = false; body.groundKey = null; body.pos[1] -= 40;
    const back = span.ride(6.2, 0.016, body, true);
    const [bx, , bz] = dungeonToRealm(back[0], back[1], back[2]);
    const onto = isles.findIndex((d) => Math.hypot(bx - gc.s.x0 - d.x, bz - d.z) < 1);
    assert.ok(onto === 0 || onto === 2, `onto a standing island (${onto})`);
    assert.notEqual(onto, 1);
    const tris = egCircleColliderTris(gc.seed, gc.c, 0), c0 = realmToDungeon(gc.s.x0 + isles[2].x, isles[2].y, isles[2].z);
    assert.equal(floorUnder(tris, c0[0], c0[1], c0[2]), false, 'the islands are the spans\' alone');
  } finally { registerSpireObjs(null); }
});

test('EG-FULL LAYER THREE THE WALLS, THE NICHES AND THE HANDS (sections 11.6 and 11.10): a seam alcove\'s false wall stands in its doorway while the relay keeps it and is gone once it falls; a passage\'s wall is broken at its alcove and the niche behind floored; the Colonnade stands open; a Drop\'s far wall keeps a doorway on the course\'s line; an Athenaeum offers each stone\'s two handles and a chamber its engine to the activation ray, and a press goes to the breach client (mutants: a wall left across the doorway; a niche with no floor; a press that goes nowhere)', () => {
  const ac = findCircle8((s) => s.alcoves.some((a) => a.seal === 'seam') && s.caves.some((q) => !q.open));
  const a = ac.s.alcoves.find((q) => q.seal === 'seam');
  const objs = { h: ac.s.h, objs: [{ t: 'fwall', i: 50, x: a.x, z: a.z, st: 0, stAt: 0, pt: a.i }] };
  registerSpireObjs(() => objs);
  try {
    const span = createEgSpan({ seed: ac.seed, c: ac.c }), B = stand(span);
    span.ride(1, 0.016, null, false);
    const seal = span.seals.find((g) => g.h === ac.s.h && g.i === a.i);
    assert.ok(seal?.up, 'the false wall stands');
    assert.equal(B.get(seal.key).T()[1], 0);
    objs.objs = [];
    span.ride(2, 0.016, null, false);
    assert.equal(span.seals.find((g) => g.key === seal.key).up, false, 'gone once it falls');
    assert.equal(B.get(seal.key).T()[1], EG_STEP_GONE_Y);
  } finally { registerSpireObjs(null); }
  const tris = egCircleColliderTris(ac.seed, ac.c, 0);
  const nb = egNicheBoxes(ac.s).find((q) => q.a.i === a.i);
  const mid = [(nb.b[0] + nb.b[3]) / 2, nb.b[1], (nb.b[2] + nb.b[5]) / 2];
  assert.ok(floorUnder(tris, mid[0], mid[1], mid[2]), 'the niche floored');
  const q = ac.s.caves.find((c) => a.z > c.z0 && a.z < c.z1);
  const inside = egToDungeon(ac.s, q.x + Math.sign(a.x - q.x) * (q.halfW - 0.3), a.y + 1, a.z), through = egToDungeon(ac.s, q.x + Math.sign(a.x - q.x) * (q.halfW + 0.9), a.y + 1, a.z);
  assert.equal(wallBetween(tris, inside[0], inside[2], through[0], through[2], a.y + 1), false, 'the wall broken at the alcove\'s doorway');
  const elsewhere = egToDungeon(ac.s, q.x + Math.sign(a.x - q.x) * (q.halfW + 0.3), a.y + 1, a.z + 4);
  assert.ok(wallBetween(tris, inside[0], inside[2] + 4, elsewhere[0], elsewhere[2], a.y + 1), 'and whole beside it');
  // the Colonnade stands open
  egSpecForget();   // the alcove's law 8 circle let go before the Colonnade is sought on the build's law
  const col = findCircle((s) => s.caves.some((c) => c.kit === 'colonnade'));
  const cq = col.s.caves.find((c) => c.kit === 'colonnade'), ctris = egCircleColliderTris(col.seed, col.c, 0);
  const cin = egToDungeon(col.s, cq.x, cq.y + 1, (cq.z0 + cq.zA) / 2), cout = egToDungeon(col.s, cq.x + cq.halfW + 3, cq.y + 1, (cq.z0 + cq.zA) / 2);
  assert.equal(wallBetween(ctris, cin[0], cin[2], cout[0], cout[2], cq.y + 1), false, 'no walls along the Colonnade');
  // a Drop's far wall keeps its doorway on the course's line
  const { positions } = egDropTris(6, 6);
  let blocked = false;
  for (let i = 0; i < positions.length; i += 9) {
    const zs = [positions[i + 2], positions[i + 5], positions[i + 8]], xs = [positions[i], positions[i + 3], positions[i + 6]], ys = [positions[i + 1], positions[i + 4], positions[i + 7]];
    if (Math.min(...zs) >= 3 - 1e-6 && Math.min(...xs) < DROP_DOOR.w / 2 - 0.01 && Math.max(...xs) > -DROP_DOOR.w / 2 + 0.01 && Math.min(...ys) < 1.5 && Math.max(...ys) > 1.5) blocked = true;
  }
  assert.equal(blocked, false, 'the doorway open at a body\'s height');
  // the hands: an Athenaeum's stones, a chamber's engine
  const ath = findCircle((s) => s.kind === 'athenaeum');
  const sp = createEgSpan({ seed: ath.seed, c: ath.c });
  stand(sp);
  const keys = sp.targets().map((t) => t.key);
  assert.equal(keys.filter((k) => k.startsWith(`egstone:${ath.s.h}:`)).length, 2 * ath.s.spots.stone.length, 'each stone\'s two handles');
  const pressed = [];
  registerSpireAct((key) => { pressed.push(key); return true; });
  try {
    assert.equal(sp.press(`egstone:${ath.s.h}:2:f`), true);
    assert.deepEqual(pressed, [`egstone:${ath.s.h}:2:f`]);
    assert.equal(sp.press('loot:1'), false);
  } finally { registerSpireAct(null); }
  assert.equal(sp.hoverName(`egstone:${ath.s.h}:2:b`).title, 'Wayrest - the ship');   // PIN MOVED (FIELD BUGS 2026-10-17e, ORRERY-SIGHT): the stone by its name, never "Orrery stone 3"
  const ec = findCircle((s) => s.engines.length > 0);
  const esp = createEgSpan({ seed: ec.seed, c: ec.c });
  stand(esp);
  const ek = esp.targets().find((t) => t.key.startsWith('egengine:'));
  assert.ok(ek && esp.hoverName(ek.key)?.subs?.length, 'an engine in the ray, named');
});

test('EG-FULL LAYER THREE THE CIRCLE\'S MODEL AND LIGHTS (sections 11.6 and 11.9): every circle builds - its fragments\' walls, niches, arches, stairs and vignettes - and its lights carry each fragment\'s own (the lava\'s orange, the moon\'s blue, the kit\'s colour) (mutants: a fragment\'s lights dropped)', () => {
  for (const seed of [77, 3]) for (let c = 1; c <= 20; c += 3) {
    const m = buildEgCircleModel(seed, c, 0);
    assert.ok(m && (m.positions?.length ?? m.vertices?.length ?? 1) > 0, `circle ${c} builds`);
    const lights = egCircleLights(seed, c, 0), specs = egCircleSpecs(seed, c, 0);
    for (const s of specs) for (const [x, y, z, kind] of s.lights) {
      const p = egToDungeon(s, x, y, z), l = lights.find((q) => Math.hypot(q.x - p[0], q.y - p[1], q.z - p[2]) < 1e-6);
      assert.ok(l, `hall ${s.h}: its ${kind} light stood`);
      if (kind === 'lava') assert.ok(l.color[1] < 0.5, 'the lava\'s orange');
      if (kind === 'moon') assert.ok(l.color[2] > 0.9, 'the moon\'s blue');
    }
  }
});

test('EG-FULL LAYER THREE THE HAZARDS ON MY FEET (section 11.2): standing in a fire fall as it burns takes its 15%, fire, once a burning - its shimmer takes nothing; outside the Eclipse\'s moon-shafts at its landing takes 30%, inside nothing; a soul-wisp near me drains a tick a second and lets go at 4 s (mutants: the fall judged every frame; the Eclipse inside its havens; a wisp that never lets go)', () => {
  const fc = findCircle((s) => s.hazards.some((h) => h.kind === 'fall'));
  const hz = fc.s.hazards.find((h) => h.kind === 'fall');
  let t = 0;
  for (let k = 0; k < 1000; k++) { const p = egHazardParts(hz, k / 100)[0]; if (p?.st === 'live') { t = k * 10 + 5; break; } }
  const E = { b: '0123456789abcdef', h: fc.s.h, seed: fc.seed, geo: 0, sg: 'trial', end: null, hw: 1, fight: EG_FIGHT_EMPTY, co: [] };
  const hits = [], entity = { health: 100, maxHealth: 100 };
  const cx = (hz.sh[0] + hz.sh[2]) / 2, cz = (hz.sh[1] + hz.sh[3]) / 2;
  let feetAt = realmToDungeon(fc.s.x0 + cx, hz.y, cz);
  const fight = createEgFight({ link: { state: () => E }, now: () => t, feet: () => feetAt, player: () => entity, save: () => 100, strike: (d, how) => hits.push([d, how?.el, how?.name]), me: () => 'acct-mac' });
  fight.frame(); t += 300; fight.frame(); t += 300; fight.frame();
  assert.equal(hits.filter((x) => x[2] === 'Fire Fall').length, 1, 'once a burning');
  assert.equal(hits[0][1], 'fire');
  t += 5000 - 600; fight.frame();
  assert.equal(hits.filter((x) => x[2] === 'Fire Fall').length, 2, 'again the next burning');
  // its shimmer: told, takes nothing
  let tTell = 0;
  for (let k = 0; k < 1000; k++) { const p = egHazardParts(hz, k / 100)[0]; if (p?.st === 'tell') { tTell = k * 10 + 5; break; } }
  t = tTell + 50000; while (egHazardParts(hz, t / 1000)[0]?.st !== 'tell') t += 10;
  const n0 = hits.length; fight.frame();
  assert.equal(hits.length, n0, 'the shimmer takes nothing');
  // the Eclipse
  const ec = findCircle((s) => s.hazards.some((h) => h.kind === 'eclipse'));
  const eh = ec.s.hazards.find((h) => h.kind === 'eclipse');
  let te = 0;
  for (let k = 0; k < 8000; k++) { const p = egHazardParts(eh, k / 100)[0]; if (p?.st === 'live') { te = k * 10 + 5; break; } }
  const E2 = { ...E, h: ec.s.h, seed: ec.seed };
  const hits2 = [];
  const [haven] = egEclipseShafts(eh, te / 1000);
  let f2 = realmToDungeon(ec.s.x0 + haven[0], eh.y, haven[1]);
  const fight2 = createEgFight({ link: { state: () => E2 }, now: () => te, feet: () => f2, player: () => entity, save: () => 100, strike: (d, how) => hits2.push([d, how?.name]), me: () => 'acct-mac' });
  fight2.frame();
  assert.equal(hits2.length, 0, 'inside a moon-shaft, nothing');
  te += EG_HAZARDS.eclipse.period;
  // the vault's middle: every moon-shaft walks its ring, 9 m out - outside them all
  f2 = realmToDungeon(ec.s.x0 + eh.x, eh.y, eh.z);
  assert.ok(egEclipseShafts(eh, te / 1000).every((q) => Math.hypot(q[0] - eh.x, q[1] - eh.z) > 3));
  fight2.frame();
  assert.equal(hits2.filter((x) => x[1] === 'The Eclipse').length, 1, 'outside every shaft - struck');
  // a soul-wisp
  const wc = findCircle((s) => s.hazards.some((h) => h.kind === 'wisp'));
  const wh = wc.s.hazards.find((h) => h.kind === 'wisp');
  const E3 = { ...E, h: wc.s.h, seed: wc.seed };
  let tw = 1000, hits3 = [];
  const wAt = () => { const ts = tw / 1000, w = 2 * Math.PI * (ts + wh.phase) / wh.period; return [wh.path[0] + wh.path[2] * Math.sin(w), wh.path[1] + wh.path[3] * Math.sin(2 * w)]; };
  const fight3 = createEgFight({ link: { state: () => E3 }, now: () => tw, feet: () => { const p = wAt(); return realmToDungeon(wc.s.x0 + p[0], wh.y - 1.2, p[1]); }, player: () => entity, save: () => 100, strike: (d, how) => hits3.push(how?.name), me: () => 'acct-mac' });
  for (let k = 0; k < 60; k++) { fight3.frame(); tw += 100; }
  const drains = hits3.filter((n) => n === 'Soul-Wisp').length;
  assert.ok(drains >= 3 && drains <= 4, `a tick a second, letting go at 4 s (${drains})`);
});

test('EG-FULL LAYER THREE THE BREACH CLIENT\'S HANDS (sections 8.4 and 11.10): a press on an Orrery stone\'s handle sends its turn (`pz`, forward or back) - only in the hall I stand in, only in its trial; an engine\'s, its work (`use`); `/breach use` works the engine within reach; a page of the Annals said to me is kept and read back by `/breach annals`; the spans read the fight\'s objects by name (mutants: a turn sent for another hall; the page forgotten)', () => {
  const ath = findCircle((x) => x.kind === 'athenaeum' && x.seed === x.seed);
  const T0 = 1_800_000_000_000, ME = 'acct-0';
  const make = (seed, h) => {
    const clock = T0 + EG_SEALED_MS + 60_000;
    const co = [[ME, 'Mac', 1], ['acct-1', 'Ann', 2]];
    const B = egBreachNew({ b: '0123456789abcdef', ez: 'z'.repeat(20), s: ME, o: 'Mac', ew: 0, rh: 0, seed, op: T0, co, site: { px: 1, py: 1, x: 0, y: 0, z: 0, yaw: 0 }, wg: [] });
    for (const [sub] of co) egEnter(B, sub, `ord${sub}`.padEnd(20, 'x'), 30, clock);
    B.h = h; B.sg = 'trial'; B.wk = clock - 1000; B.cnt = { left: 1_500_000, at: clock - 1000 };
    const sent = [], said = [];
    const spec = egHallOf(seed, h, 0);
    const player = { pos: realmToDungeon(spec.x0 + spec.arrive.x, 0, spec.arrive.z), height: 1.8, grounded: true, collider: { move: () => {} } };
    const modes = { mode: 'dungeon', egHallBreach: () => B.b, egHallCircle: () => 1, egPlace: () => true, egLeave: () => true, egHallReturn: () => null, dungeonCtx: { exitDoors: [] } };
    const online = { welcomes: 1, terminal: false, sendEg: (k, f = {}) => { sent.push({ k, ...f }); return true; } };
    const entity = { level: 30, health: 80, maxHealth: 100, magicka: 10, maxMagicka: 50, fatigue: 0, stats: {}, items: [] };
    const client = createEgClient({ modes: () => modes, online: () => online, hub: () => null, account: { me: () => ME, guest: () => false, keys: async () => ({ ok: false }) }, now: () => clock, entity, player, cam: { pos: [0, 0, 0] },
      say: (t) => said.push(t), mid: () => {}, site: () => ({}), wire: () => null, landAt: () => true, hurt: () => {}, peers: () => [] });
    client.word(validEgOut(JSON.parse(JSON.stringify(egStateOf(B, clock)))));
    return { client, sent, said, spec, player, B };
  };
  const A = make(ath.seed, ath.s.h);
  // PIN MOVED (FIELD BUGS 2026-10-17e, ORRERY-SIGHT): a turn is sent from the stone the room would take it at - each press
  // from beside its stone (the arrival plate is out of every stone's reach: test/systems/eliteGates/fb1017e_orrerysight.test.js)
  const by = (j) => { const q = ath.s.spots.stone[j]; A.player.pos = realmToDungeon(ath.s.x0 + q.x + 1, Number.isFinite(q.y) ? q.y / 100 : 0, q.z); };
  by(3);
  assert.equal(A.client.act(`egstone:${ath.s.h}:3:f`), true);
  assert.deepEqual(A.sent.at(-1), { k: 'pz', i: 3, a: 1 });
  by(1);
  A.client.act(`egstone:${ath.s.h}:1:b`);
  assert.deepEqual(A.sent.at(-1), { k: 'pz', i: 1, a: -1 });
  const n0 = A.sent.length;
  A.client.act(`egstone:${ath.s.h + 1}:1:b`);
  assert.equal(A.sent.length, n0, 'never for another hall');
  // a page of the Annals, kept and read back
  A.client.word({ k: 'egot', w: 'page', p: 4 });
  assert.ok(A.said.at(-1).includes(EG_ANNALS[4][0]), 'the page said');
  assert.deepEqual(A.client.annals(), [4]);
  A.client.command('annals 1');
  assert.ok(A.said.at(-1).includes(EG_ANNALS[4][1]), 'and read back');
  // an engine
  const en = findCircle((x) => x.engines.length > 0);
  const N = make(en.seed, en.s.h), e = en.s.engines[0];
  N.player.pos = realmToDungeon(en.s.x0 + e.x + 1, 0, e.z);
  N.client.command('use');
  assert.deepEqual(N.sent.at(-1), { k: 'use', i: e.i }, '/breach use works the engine within reach');
  N.player.pos = realmToDungeon(en.s.x0 + e.x + 9, 0, e.z);
  const n1 = N.sent.length;
  N.client.command('use');
  assert.equal(N.sent.length, n1, 'from too far, nothing');
  assert.deepEqual(N.client.objs(), { h: en.s.h, objs: [], lit: [], br: [] }, 'no fight yet - no objects');   // PIN MOVED (EG-ZC): and no branch the Moon-Mirror lit; PIN MOVED (AUDIT EG III): and no Spirebridge
});

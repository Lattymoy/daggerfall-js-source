// AUDIT EG V, fix group F ("law"; bible/11-Multiplayer/Elite-Gates.md sections 8.3, 11.7, 11.10, 13.3 and 31's AUDIT EG V record) -
// THE WAYS WALKED: what spec law 8 and its client half lay, crossed by the real PlayerMotor on the real Collider over the circle's
// own collider triangles (world/eliteGates/egHall.js egCircleColliderTris) and by the legion's walk graph (net/eliteGates/egWalkGraph.js). Pins L5-15
// (a Rampart's caster pillar and the Wyrm's perch climbed by their stairs; a raised floor's rim faces - nothing walks in under its
// top and falls), L5-1 (the Eclipse Vault's galleries on the walk graph), L5-14 (the Council Rotunda's balconies climbed), L5-8
// (a hero alcove's false wall in its own doorway).
import test from 'node:test';
import assert from 'node:assert/strict';
import { egHallOf, egCircleSpecs, egSpecGive, egSpecForget, egCircleOfHall } from '../../../src/net/eliteGates/egLaw.js';
import { egCircleColliderTris, egNicheBoxes, egHeroDoor, egToDungeon, EG_RAISED_ROLES, EG_RAISED_WAY_PAD_M } from '../../../src/world/eliteGates/egHall.js';
import { sealParts } from '../../../src/scenes/eliteGates/egSpan.js';
import { egFightView, egWalkGraph, egWalkNext, egRegionAt } from '../../../src/net/eliteGates/egWalkGraph.js';
import { egPolyIn } from '../../../src/net/eliteGates/egShape.js';
import { EG_HERO_FRAGS } from '../../../src/net/eliteGates/egHeroFrags.js';
import { PlayerMotor } from '../../../src/player/motor.js';
import { Collider } from '../../../src/player/collider.js';
import { realmToDungeon, dungeonToRealm } from '../../../src/net/superDungeon/sdBrain.js';
import { identity } from '../../../src/world/mat4.js';
import { SD_LIP, SD_ISLAND_SIDES } from '../../../src/world/superDungeon/sdRealm.js';

const still = (o = {}) => ({ forward: 0, strafe: 0, run: false, jump: false, up: false, down: false, ...o });
/** The circle of hall `h` of `seed` stood in a real Collider (its one bucket, as the hosts stand it). */
function circleCollider(seed, h) {
  const col = new Collider(() => -Infinity), tris = egCircleColliderTris(seed, egCircleOfHall(h), 0), n = tris.length / 3, idx = new Uint32Array(n);
  for (let i = 0; i < n; i++) idx[i] = i;
  col.addMesh('eg:hall', tris, idx, identity());
  return col;
}
/** THE SPAN BUILD's body (Speed 10, Running 0 - the slowest the game makes) walked from (x, y, z) of hall `spec` toward (gx, gz),
 *  `frames` sixtieths: `{ feet, at, minFeet, maxFeet }` - its feet's height and place (the hall's frame) at the end. */
function walk(col, spec, [x, y, z], [gx, gz], frames = 600) {
  const m = new PlayerMotor(col, { speed: 10, running: 0, swimming: 30 }), p0 = realmToDungeon(spec.x0 + x, y + 0.05, z);
  m.spawn(p0[0], p0[1], p0[2]);
  let minFeet = Infinity, maxFeet = -Infinity;
  for (let k = 0; k < frames; k++) {
    const [rx, ry, rz] = dungeonToRealm(m.pos[0], m.pos[1], m.pos[2]), d = Math.hypot(gx - (rx - spec.x0), gz - rz);
    m.update(1 / 60, still({ forward: d > 0.25 ? 1 : 0 }), Math.atan2(gx - (rx - spec.x0), gz - rz), 0);
    minFeet = Math.min(minFeet, ry); maxFeet = Math.max(maxFeet, ry);
  }
  const [rx, ry, rz] = dungeonToRealm(m.pos[0], m.pos[1], m.pos[2]);
  return { feet: ry, at: [rx - spec.x0, rz], minFeet, maxFeet };
}

test('AUDIT EG V L5-15 A RAISED FLOOR CLIMBED BY THE REAL MOTOR (sections 8.3: "Reach them by short side spans"; 13.3: "Each pillar is reached by a side span and broken from on top"): THE SPAN BUILD walks a Rampart\'s caster pillar\'s stair from the walkway onto its top 2 m up and stands there, and the Wyrm\'s perch\'s from the court onto its top 3 m up; and a raised floor stands its rim faces as deep as its drawn lip, but where its stair comes up - so law 7\'s flat side span, walked to its end, meets the pillar\'s face and stands, where it walked in under the top and fell into the void (mutants: the stair left flat; the rim faces dropped; a rim face across the stair\'s top)', () => {
  // the pillar (seed 1's Hall 4): from the stair's foot on the walkway, up onto the top
  const R = egHallOf(1, 4, 0), col = circleCollider(1, 4);
  for (const d of R.discs.filter((q) => q.role === 'pillar').slice(0, 2)) {
    const q = R.ramps.find((r) => Math.abs(r.bz - d.z) < 1e-9 && Math.sign(r.bx) === Math.sign(d.x));
    const w = walk(col, R, [q.ax - Math.sign(q.bx - q.ax) * 0.6, 0, q.az], [d.x, d.z]);
    assert.ok(Math.abs(w.feet - d.y) < 0.05 && Math.hypot(w.at[0] - d.x, w.at[1] - d.z) < d.r - 0.5, `on the pillar's top (feet ${w.feet.toFixed(2)} at ${w.at.map((v) => v.toFixed(2))})`);
    assert.ok(w.minFeet > -0.1, 'never fell');
  }
  // the perch (seed 1's Hall 85): from the court up onto its top
  const W = egHallOf(1, 85, 0), wc = circleCollider(1, 85), perch = W.discs.find((q) => q.role === 'perch');
  const pq = W.ramps.find((r) => Math.abs(Math.hypot(r.bx - perch.x, r.bz - perch.z) - perch.r) < 0.02), ux = (pq.bx - pq.ax) / Math.hypot(pq.bx - pq.ax, pq.bz - pq.az), uz = (pq.bz - pq.az) / Math.hypot(pq.bx - pq.ax, pq.bz - pq.az);
  const wp = walk(wc, W, [pq.ax - ux * 1.5, pq.y0, pq.az - uz * 1.5], [perch.x, perch.z]);
  assert.ok(Math.abs(wp.feet - perch.y) < 0.05 && Math.hypot(wp.at[0] - perch.x, wp.at[1] - perch.z) < perch.r - 0.5, `on the perch's top (feet ${wp.feet.toFixed(2)})`);
  // the rim faces in the collider: every raised floor's, as deep as its drawn lip, a gap where its stair comes up
  assert.deepEqual([...EG_RAISED_ROLES], ['pillar', 'perch', 'balcony']);
  const tris = egCircleColliderTris(1, 1, 0), d0 = R.discs.find((q) => q.role === 'pillar'), q0 = R.ramps.find((r) => Math.abs(r.bz - d0.z) < 1e-9 && Math.sign(r.bx) === Math.sign(d0.x));
  let faces = 0, overStair = 0;
  for (let i = 0; i < tris.length; i += 9) {
    const ys = [tris[i + 1], tris[i + 4], tris[i + 7]];
    if (Math.max(...ys) - Math.min(...ys) < SD_LIP - 1e-4 || Math.max(...ys) - Math.min(...ys) > SD_LIP + 1e-4 || Math.abs(Math.max(...ys) - d0.y) > 1e-4) continue;
    const [mx, , mz] = dungeonToRealm((tris[i] + tris[i + 3] + tris[i + 6]) / 3, 0, (tris[i + 2] + tris[i + 5] + tris[i + 8]) / 3), lx = mx - R.x0;
    if (Math.abs(Math.hypot(lx - d0.x, mz - d0.z) - d0.r) > 0.2) continue;
    faces++;
    if (Math.hypot(lx - q0.bx, mz - q0.bz) < q0.hw) overStair++;
  }
  assert.ok(faces >= 2 * (SD_ISLAND_SIDES - 12), `the pillar's rim faces (${faces} triangles)`);
  assert.equal(overStair, 0, 'none across its stair\'s top');
  assert.ok(EG_RAISED_WAY_PAD_M > 0);
  // law 7's hall (the relay's bytes given, as a law-foreign client builds them): its flat side span walked to its end meets the
  // pillar's face - the body stands on the span, never under the top
  try {
    for (const h of [1, 2, 3, 4, 5]) assert.ok(egSpecGive(egHallOf(1, h, 0, 7)));
    const R7 = egHallOf(1, 4, 0), c7 = circleCollider(1, 4), lane = R7.lanes.find((l) => l.role === 'side'), d7 = R7.discs.find((q) => q.role === 'pillar' && Math.abs(q.z - lane.az) < 1e-9);
    assert.equal(R7.v, 7);
    const w7 = walk(c7, R7, [lane.ax + Math.sign(lane.bx - lane.ax) * 0.5, 0, lane.az], [d7.x, d7.z], 420);
    assert.ok(w7.minFeet > -0.1 && Math.abs(w7.feet) < 0.05, `stood on its span (feet ${w7.feet.toFixed(2)}, at worst ${w7.minFeet.toFixed(2)})`);
    assert.ok(Math.hypot(w7.at[0] - d7.x, w7.at[1] - d7.z) > d7.r - 0.05, 'stopped at the pillar\'s face');
  } finally { egSpecForget(); }
});

test('AUDIT EG V L5-1 A HERO\'S STAIR JOINED AT ITS OWN EDGES (section 11.7: "the legion walks the graph"; the EG-HERO (the Shade Perilous) record: "up both stairs and onto both galleries"): wherever the Eclipse Vault is laid, the walk graph joins each of its stairs to the floor at its foot and the gallery at its top - the foot the point of its low edge on a floor of its height, never the middle of its low corners 1.5 m off its floor - so a walker on the court reaches a member on either gallery, and every hero\'s raised floor is climbed (mutants: a hero\'s stair read by its middle; a hero\'s stair dropped; its foot taken off the floor)', () => {
  // PIN MOVED (THE ASCENT - THE ROOMS, LAW 9 - 2026-10-16): spec law 8's halls by name, here and in the alcoves' pin below - the
  // hero laid where law 8 lays it, the hall's one hero (a LAW 9 hall's heroes are its rooms beside it)
  let laid = 0;
  for (const [seed, h] of [[2, 52], [2, 62], [2, 72], [4, 74]]) {
    const spec = egHallOf(seed, h, 0, 8), H = spec.heroes?.[0];
    assert.equal(H?.id, 'egheroEclipse', `seed ${seed} hall ${h}: the Eclipse Vault laid`);
    laid++;
    const view = egFightView(spec), G = egWalkGraph(view), R = EG_HERO_FRAGS.egheroEclipse;
    const galleries = R.anchors.caster.map(([x, y, z]) => [H.x + x / 100, H.y + y / 100, H.z + z / 100]);
    for (const [gx, gy, gz] of galleries) {
      const b = { x: H.x, z: H.z + 20, y: H.y, fr: -1, wn: -1 }, path = [];
      for (let k = 0; k < 40; k++) { const [x, z, last] = egWalkNext(view, b, gx, gz, gy); path.push([x, z]); b.x = x; b.z = z; if (last) break; }
      const [goal] = egRegionAt(view, G, gx, gz, gy);
      assert.equal(b.fr, goal, `seed ${seed} hall ${h}: a walker from the court stands in the gallery's region`);
      assert.ok(Math.hypot(b.x - gx, b.z - gz) < 0.05, 'at the member\'s place');
      assert.ok(path.length >= 3, 'by the stair\'s foot and top');
      assert.ok((view.fl[G.rg[goal].f].y ?? 0) > H.y + 3, 'a gallery 3.5 m up');
    }
    // each stair's foot on the floor of its height (0.3 m about), its top on its gallery
    const hs = G.nodes.filter((n) => view.fl[G.rg[n.rg].f].t === 'p');
    for (const q of H.ramps) {
      const lo = q.poly.filter((p) => p[1] === Math.min(...q.poly.map((c) => c[1]))), mid = [(lo[0][0] + lo[1][0]) / 2, (lo[0][2] + lo[1][2]) / 2];
      const floor = view.fl.find((f) => f.t === 'p' && Math.abs(f.y - lo[0][1]) < 0.01);
      assert.ok(!egPolyIn(floor.poly, mid[0], mid[1], 0.6), 'the middle of its low corners off the floor');
      assert.ok(hs.some((n) => egPolyIn(floor.poly, n.x, n.z, 0.3) && Math.min(Math.hypot(n.x - lo[0][0], n.z - lo[0][2]), Math.hypot(n.x - lo[1][0], n.z - lo[1][2])) <= Math.hypot(lo[0][0] - lo[1][0], lo[0][2] - lo[1][2])), 'its foot node on the floor, on its low edge');
    }
  }
  assert.equal(laid, 4);
});

test('AUDIT EG V L5-8 A HERO ALCOVE\'S DOORWAY (section 11.10: "behind a false wall (one blow; a faint gold seam shows within 4 m)"): a hero\'s seam alcove opens off its own hero\'s floor - its false wall stands in the hero\'s wall where the line from the alcove back toward the course meets the floor it opens off, at the alcove\'s own height, flush along that wall (the Clan Pit\'s slanted west wall); a code-built niche keeps its 1.2 m rule (mutants: the hero\'s door by the code-built rule; the slab across the wall\'s way; the door at the floor\'s height under a raised niche)', () => {
  // the Mist Stair (a shaft): its alcove 0.6 m over its rim floor, the rim floor's east edge 4.0 m out - the slab in the doorway
  const mist = egHallOf(2, 42, 0, 8), Hm = mist.heroes[0];
  assert.equal(Hm.id, 'egheroMistStair');
  const am = mist.alcoves.find((a) => a.x >= Hm.box[0] && a.x <= Hm.box[3] && a.z >= Hm.box[2] && a.z <= Hm.box[5]);
  const dm = egHeroDoor(mist, am), nb = egNicheBoxes(mist).find((q) => q.a === am);
  assert.ok(Math.abs(dm.x - (Hm.x + 4.0)) <= 0.05, `its wall's inner face at the rim floor's edge (${dm.x - Hm.x})`);
  assert.ok(Math.abs(Math.abs(dm.along[1]) - 1) < 1e-9, 'a wall along the course');
  assert.deepEqual(nb.door.map((v) => +v.toFixed(3)), egToDungeon(mist, dm.x + 0.3, am.y, am.z).map((v) => +v.toFixed(3)), 'the door 0.3 m into it, at the niche\'s own height');
  assert.ok(Math.abs(am.y - (Hm.y + 0.6)) < 1e-9, 'a niche 0.6 m over the rim');
  // the Clan Pit (a chamber): its west wall slants - the slab stands flush along it, never into the pit floor
  const pit = egHallOf(1, 77, 0, 8), Hp = pit.heroes[0];
  assert.equal(Hp.id, 'egheroClanPit');
  const ap = pit.alcoves.find((a) => a.x >= Hp.box[0] && a.x <= Hp.box[3] && a.z >= Hp.box[2] && a.z <= Hp.box[5]);
  const dp = egHeroDoor(pit, ap), floor = Hp.floors.find((g) => g.fight && Math.abs(g.y - Hp.y) < 1e-9);
  assert.ok(Math.abs(dp.along[0]) > 0.4 && Math.abs(dp.along[1]) > 0.4, 'a slanted wall\'s way');
  const nbp = egNicheBoxes(pit).find((q) => q.a === ap), { tris } = sealParts(nbp.door, nbp.side, ap.y, nbp.along);
  let inside = 0;
  for (let i = 0; i < tris.length; i += 3) { const [x, , z] = dungeonToRealm(tris[i], tris[i + 1], tris[i + 2]); if (egPolyIn(floor.poly, x - pit.x0, z, -0.05)) inside++; }
  assert.equal(inside, 0, 'no corner of the slab on the pit floor');
  const { tris: old } = sealParts(egToDungeon(pit, ap.x - ap.side * 1.2 + ap.side * 0.3, ap.y, ap.z), ap.side, ap.y);
  let oldIn = 0;
  for (let i = 0; i < old.length; i += 3) { const [x, , z] = dungeonToRealm(old[i], old[i + 1], old[i + 2]); if (egPolyIn(floor.poly, x - pit.x0, z, -0.05)) oldIn++; }
  assert.ok(oldIn > 0, 'the code-built rule stood it on the pit floor');
  // a code-built niche: its 1.2 m rule, its wall along z
  const code = [1, 2, 3, 4, 5, 6].flatMap((c) => egCircleSpecs(1, c, 0, 8)).flatMap((s) => egNicheBoxes(s).map((q) => [s, q])).find(([s]) => !(s.heroes ?? []).length);
  assert.ok(code, 'a code-built alcove');
  const [cs, cq] = code;
  assert.equal(egHeroDoor(cs, cq.a), null);
  assert.equal(cq.along, undefined);
  assert.ok(Math.abs(cq.door[0] - egToDungeon(cs, cq.a.x - cq.side * 0.9, 0, 0)[0]) < 1e-9);
  // the default slab: the code-built one, unchanged
  const plain = sealParts([10, 1, 20], 1), turned = sealParts([10, 1, 20], 1, 1, [0, 1]);
  assert.deepEqual([...plain.tris.slice(0, 9)], [9.800000190734863, 1, 19, 9.800000190734863, 1, 21, 9.800000190734863, 3.5999999046325684, 21]);
  assert.equal(turned.tris.length, plain.tris.length);
});

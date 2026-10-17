// EG-ZN (2026-10-12, Mac: "I said I want everything"; bible/11-Multiplayer/Elite-Gates.md sections 11.6 and 11.8): THE
// OCCLUDERS DITHER, THEIR LAW. THE OCCLUDERS MARKED (world/eliteGates/egHall.js buildEgCircleModel's `occluders`, egOccluderRuns): the
// circle's rock marked as it is laid - a passage's wall runs and vault, each box of its kit's dress, a niche's walls and lid
// (never its floor), a vignette, a ring wall's segment, an arch's walls, a door's posts and lintel, a slag spout - as runs of
// the circle's one mesh, and nothing rising from the ground unmarked. THE RAY (scenes/eliteGates/egOcclude.js): a segment from the
// third-person eye to the body's pivot and chest, stopped 0.3 m short, crossing exactly the rock between. THE DITHER PASS
// (createEgOccluders): the circle's draw the loop's while nothing stands between; else its shadow recorded whole, the rest
// and the dithered pieces every index once, the share eased to a quarter and back, a view a share, views kept and capped.
// The host's pass over the real renderer is test/world/eliteGates/egz_camera_host.test.js, the budget test/scenes/eliteGates/egz_camera_budget.test.js, the
// shaft's camera test/net/eliteGates/egz_camera_shaft.test.js.
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildEgCircleModel, egToDungeon, egNicheBoxes, egHeroGroundYs, egInHeroBox } from '../../../src/world/eliteGates/egHall.js';
import { EG_WALL } from '../../../src/world/eliteGates/egGround.js';
import { egCircleParts } from '../../../src/world/eliteGates/egCircleParts.js';
import { egHallOf, egCircleSpecs, egCircleOfHall } from '../../../src/net/eliteGates/egLaw.js';
import { createEgOccluders, egOccludersHit, egSegTri, egSegBox, egOccludeEase, egOccludeRanges, EG_OCCLUDE_KEEP, EG_OCCLUDE_FADE_S, EG_OCCLUDE_BODY_M, EG_OCCLUDE_CHEST_M, EG_OCCLUDE_VIEWS_MAX } from '../../../src/scenes/eliteGates/egOcclude.js';
import { egLawSeam } from '../../../src/net/eliteGates/egLaw.js';

// PIN MOVED (THE ASCENT - THE ROOMS, LAW 9 - 2026-10-16): these pins measure spec law 8's halls - drawn where no law is named
// (net/eliteGates/egLaw.js egLawSeam - a test's seam, never a breach's: a breach draws its own law), the dress, the camera and the client
// as they were written over law 8's ground; LAW 9's dress is THE DRESS slice's (Elite-Gates-Ascent.md section 8) and its
// ground test/net/eliteGates/law9_rooms.test.js's
egLawSeam(8);

const I4 = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
/** Every index a list of sub-mesh ranges covers, as one sorted list. */
const covered = (ranges) => ranges.flatMap((r) => Array.from({ length: r.primitiveCount * 3 }, (_, k) => r.startIndex + k)).sort((a, b) => a - b);
/** The Fallen Stacks (seed 77, hall 2 - a passage of bookcases), and its circle's model. */
const STACKS = { seed: 77, h: 2 };
// PIN MOVED (EG-LOOK HALLS, Elite-Gates-Look.md section 2): the Stacks' bookcases are sunk in the bays of the academy's wall
// now, behind the collider's plane (world/eliteGates/egGround.js bookcase), each bay of a wall one piece - so the piece a ray meets is a
// bay of the left wall: its pilaster (the first EG_WALL.pil of its box) standing between an eye and a body in the bay's
// recess, RECESS_D behind the plane at a body's height. Its box runs from the wall's outer face to the ressaut over it.
const leftBay = (left) => (o) => Math.abs(o.b[0] - (left - EG_WALL.thick)) < 1e-3 && o.b[3] - o.b[0] < 1.5;
const RECESS_D = 0.15, RAY_Y = 3.6;   // over the bookcases sunk in the bays, under the pilasters' capitals

// ── THE OCCLUDERS, MARKED ───────────────────────────────────────────────────────────────────────────────────────────
test('EG-ZN THE OCCLUDERS MARKED (world/eliteGates/egHall.js, section 11.8): every circle\'s model carries its rock as runs of its own sub-meshes - each run inside its sub-mesh, no index in two pieces, each piece\'s box its own triangles\' - a closed passage\'s every wall run and its vault, each box of its kit\'s dress, a niche\'s walls and lid but never its floor, a ring wall a segment at a time, an arch, a door\'s posts and lintel, a slag spout; the floors, bands, lanes, plates and ramps none; the swap\'s worker build carries the same; the mesh itself one draw a record as before (mutants: a wall run unmarked; the vault unmarked; the dress unmarked; a niche\'s floor an occluder; the ring wall unmarked; an arch unmarked; the door unmarked; a spout unmarked; a run at the wrong sub-mesh; the box off its triangles)', () => {
  for (const [seed, c] of [[77, 1], [7, 4], [99, 6], [12345, 11], [7, 16]]) {
    const m = buildEgCircleModel(seed, c, 0), occ = m.occluders;
    assert.ok(occ.length > 0);
    assert.equal(new Set(m.subMeshes.map((s) => s.textureRecord)).size, m.subMeshes.length, 'one sub-mesh a record: one draw a record, as before');
    const owner = new Map();
    occ.forEach((o, i) => {
      const b = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
      for (const [s, at, n] of o.r) {
        const sm = m.subMeshes[s];
        assert.ok(at >= sm.startIndex && at + n * 3 <= sm.startIndex + sm.primitiveCount * 3, `piece ${i}: its run inside its sub-mesh`);
        for (let j = at; j < at + n * 3; j++) {
          assert.ok(!owner.has(j), `index ${j} in two pieces`);
          owner.set(j, i);
          for (let k = 0; k < 3; k++) { const x = m.positions[m.indices[j] * 3 + k]; b[k] = Math.min(b[k], x); b[k + 3] = Math.max(b[k + 3], x); }
        }
      }
      assert.deepEqual(o.b, b, `piece ${i}: its box is its triangles'`);
    });
    // which index lies at a point: every triangle of the mesh whose three corners are within `eps` of plane `y`, inside a box
    const trisIn = (x0, y0, z0, x1, y1, z1) => { const out = []; for (let j = 0; j < m.indices.length; j += 3) { let all = true; for (let v = 0; v < 3 && all; v++) { const p = m.indices[j + v] * 3; all = m.positions[p] >= x0 - 1e-4 && m.positions[p] <= x1 + 1e-4 && m.positions[p + 1] >= y0 - 1e-4 && m.positions[p + 1] <= y1 + 1e-4 && m.positions[p + 2] >= z0 - 1e-4 && m.positions[p + 2] <= z1 + 1e-4; } if (all) out.push(j); } return out; };
    for (const spec of egCircleSpecs(seed, c, 0)) {
      // the ground is never an occluder: every band's floor, every plate and disc's top
      for (const b of spec.bands) {
        if (b.role === 'tube' || (spec.variant === 'fallingwall' && b.role === 'walk')) continue;
        const a = egToDungeon(spec, b.x - b.halfW, b.y, b.z0), e = egToDungeon(spec, b.x + b.halfW, b.y, b.z1);
        const floor = trisIn(a[0], a[1], a[2], e[0], a[1], e[2]);
        assert.ok(floor.length > 0 && floor.every((j) => !owner.has(j)), `hall ${spec.h}: a band's floor is ground, never an occluder`);
      }
      for (const q of spec.caves) {
        if (q.open) continue;
        const yLo = Math.min(q.y, q.yB) - (q.shaft || q.kit === 'mist' ? 6 : 1.2), yHi = Math.max(q.y, q.yB);
        // each wall's inner face over its whole height (down past its foot - world/eliteGates/egHall.js egWallFoot): an occluder's
        for (const s of [-1, 1]) {
          const x = egToDungeon(spec, q.x + s * q.halfW, 0, 0)[0], zm = egToDungeon(spec, 0, 0, (q.z0 + q.z1) / 2)[2];
          const face = trisIn(x, yLo, zm - 40, x, yHi + q.height, zm + 40).filter((j) => Math.abs(m.positions[m.indices[j] * 3 + 1] - m.positions[m.indices[j + 1] * 3 + 1]) > 0.5 || Math.abs(m.positions[m.indices[j + 2] * 3 + 1] - m.positions[m.indices[j] * 3 + 1]) > 0.5);
          assert.ok(face.length > 0 && face.every((j) => owner.has(j)), `hall ${spec.h}: a ${q.kit} wall run is an occluder`);
        }
        if (q.kit === 'gloam' || q.tube) continue;
        // PIN MOVED (EG-LOOK HALLS, Elite-Gates-Look.md section 2): the vault is a barrel springing over the collider's ceiling
        // (world/eliteGates/egGround.js passageVault; the Caverns' a rock vault pushed out by noise), no longer a slab a metre thick - so
        // every triangle over the ceiling within the passage and its walls' reach (its cornice, its ribs, its coffers, its
        // roof) is the vault's, an occluder's
        const v0 = egToDungeon(spec, q.x - q.halfW - 2.6, yHi + q.height, q.z0), v1 = egToDungeon(spec, q.x + q.halfW + 2.6, yHi + q.height + q.halfW + 4, q.z1);
        const vault = trisIn(v0[0], v0[1], v0[2], v1[0], v1[1], v1[2]);
        assert.ok(vault.length >= 12 && vault.every((j) => owner.has(j)), `hall ${spec.h}: a ${q.kit} vault is an occluder`);
      }
    }
    assert.deepEqual(egCircleParts(seed, c, 0).model.occluders, occ, 'the swap\'s worker build carries the same occluders');
    assert.ok(occ.every((o) => o.r.length > 0 && o.r.every(([, , n]) => n > 0)), 'every piece some rock');
  }
  // NOTHING RISES FROM THE GROUND UNMARKED: over circles holding every kit, every grounds' dress and every piece of rock, every
  // triangle of the mesh that is no occluder and stands more than 0.2 m tall tops out within a hand (0.2 m) of a height the law
  // lays ground at (a floor's lip, an island's side, rim and teeth, a ramp's underside) - every wall, vault, piece of dress,
  // niche, vignette, ring, tier wall,
  // arch, door, long wall and spout is an occluder
  for (const [seed, c] of [[7, 1], [7, 2], [7, 4], [7, 6], [7, 9], [7, 11], [7, 16], [7, 18], [7, 20], [99, 12]]) {
    const m = buildEgCircleModel(seed, c, 0), owned = new Uint8Array(m.indices.length / 3);
    for (const o of m.occluders) for (const [, at, n] of o.r) for (let k = 0; k < n; k++) owned[at / 3 + k] = 1;
    const ys = (j) => [0, 1, 2].map((v) => m.positions[m.indices[j + v] * 3 + 1]);
    const ground = new Set(), heroGround = new Set(), lay = (y) => ground.add(Math.round(egToDungeon({ x0: 0 }, 0, y, 0)[1] * 1000));
    for (const spec of egCircleSpecs(seed, c, 0)) {
      for (const d of spec.discs) lay(d.y);
      for (const b of spec.bands) lay(b.y);
      for (const l of spec.lanes ?? []) lay(l.y ?? 0);
      for (const q of spec.ramps ?? []) { lay(q.y0); lay(q.y1); }
      for (const q of spec.caves) { lay(q.y); lay(q.yB); }
      for (const a of spec.alcoves ?? []) lay(a.y);
      for (const d of spec.deco ?? []) if (d.t === 'magma') lay(d.y ?? -1.5); else if (d.t === 'tiers') for (let k = 1; k <= 3; k++) lay((d.y ?? 0) - 0.5 + k * (d.h / 6));
      // EG-HERO-LAY (spec law 7): a hero's ground is where its law lays it - its floors and its stairs' corners, a hand either
      // side (world/eliteGates/egHall.js egHeroGroundYs: its mesh's floor drawn a hair under its law's is ground still)
      for (const q of spec.heroes ?? []) for (const y of egHeroGroundYs(q)) heroGround.add(Math.round(egToDungeon({ x0: 0 }, 0, q.y + y, 0)[1] * 1000));
    }
    let rising = 0;
    for (let j = 0; j < m.indices.length; j += 3) {
      if (owned[j / 3]) continue;
      const y = ys(j), top = Math.max(...y);
      if (top - Math.min(...y) <= 0.2) continue;
      rising++;
      assert.ok([...ground].some((g) => top * 1000 - g >= -1 && top * 1000 - g <= 201) || [...heroGround].some((g) => Math.abs(top * 1000 - g) <= 201), `circle ${c} of seed ${seed}: an unmarked triangle rising to ${top} - rock left out of the occluders`);
    }
    assert.ok(rising > 0, 'the ground\'s own sides counted');
  }
  // the kits' dress, the niches, the rings, the arches, the doors and the spouts - each found and counted on real halls
  const pieceAt = (m, x, y, z) => m.occluders.findIndex((o) => x >= o.b[0] && x <= o.b[3] && y >= o.b[1] && y <= o.b[4] && z >= o.b[2] && z <= o.b[5]);
  const kinds = { stacks: 0, niche: 0, nicheBare: 0, nicheFloor: 0, nicheFloors: 0, ring: 0, arch: 0, door: 0, spout: 0, vignette: 0 };
  const ownedOf = new WeakMap(), owned = (m) => { let o = ownedOf.get(m); if (!o) { o = new Set(); for (const p of m.occluders) for (const [, at, n] of p.r) for (let k = 0; k < n * 3; k += 3) o.add(at + k); ownedOf.set(m, o); } return o; };
  for (const seed of [7, 77, 99]) for (let c = 1; c <= 16; c += 3) {
    const m = buildEgCircleModel(seed, c, 0);
    for (const spec of egCircleSpecs(seed, c, 0)) {
      for (const q of spec.caves) if (q.kit === 'stacks') { const p = egToDungeon(spec, q.x - q.halfW + 0.2, q.y + 1.2, q.z0 + 0.2 + 1.1); if (pieceAt(m, p[0], p[1], p[2]) >= 0) kinds.stacks++; }
      // each niche: every triangle of its walls and lid an occluder's, every triangle of its floor none
      for (const { b: [x0, y0, z0, x1, y1, z1], a } of egNicheBoxes(spec)) {
        if (egInHeroBox(spec, a.x, a.z)) continue;   // PIN MOVED (AUDIT EG V, f): a hero's alcove is its own mesh's (its box at its hero's wall since - world/eliteGates/egHall.js egHeroDoor)
        const inBox = (j) => [0, 1, 2].every((v) => { const p = m.indices[j + v] * 3; return m.positions[p] >= x0 - 1e-4 && m.positions[p] <= x1 + 1e-4 && m.positions[p + 1] >= y0 - 1e-4 && m.positions[p + 1] <= y1 + 1e-4 && m.positions[p + 2] >= z0 - 1e-4 && m.positions[p + 2] <= z1 + 1e-4; });
        const ys = (j) => [0, 1, 2].map((v) => m.positions[m.indices[j + v] * 3 + 1]);
        for (let j = 0; j < m.indices.length; j += 3) {
          if (!inBox(j)) continue;
          const y = ys(j);
          if (y.every((v) => Math.abs(v - y0) < 1e-4)) { kinds.nicheFloors++; if (owned(m).has(j)) kinds.nicheFloor++; }
          else if (Math.max(...y) - Math.min(...y) > 1) { if (owned(m).has(j)) kinds.niche++; else kinds.nicheBare++; }
        }
      }
      for (const d of spec.deco ?? []) {
        if (d.t === 'wall') { const a0 = Math.PI / 2, a1 = (9 / 32) * Math.PI * 2, p = egToDungeon(spec, d.x + (d.r * (Math.sin(a0) + Math.sin(a1))) / 2, (d.y ?? 0) + 1, d.z + (d.r * (Math.cos(a0) + Math.cos(a1))) / 2); if (pieceAt(m, p[0], p[1], p[2]) >= 0) kinds.ring++; }
        if (d.t === 'arch') { const p = egToDungeon(spec, d.x + (d.w / 2 + d.r + 1) / 2, (d.y ?? 0) + 1, d.z); if (pieceAt(m, p[0], p[1], p[2]) >= 0) kinds.arch++; }
      }
      for (const d of spec.discs) if (d.role === 'end') { const p = egToDungeon(spec, d.x + 1.6, d.y + 2, d.z); if (pieceAt(m, p[0], p[1], p[2]) >= 0) kinds.door++; }
      for (const v of spec.vignettes ?? []) { const p = egToDungeon(spec, v.x, v.y + 0.3, v.z); if (pieceAt(m, p[0], p[1], p[2]) >= 0) kinds.vignette++; }
    }
  }
  for (const seed of [7, 99, 12345]) for (let c = 16; c <= 20; c++) {
    const specs = egCircleSpecs(seed, c, 0);
    if (!specs.some((s) => (s.steps ?? []).some((t) => t.kind === 'slag'))) continue;
    const m = buildEgCircleModel(seed, c, 0);
    for (const spec of specs) for (const st of spec.steps ?? []) if (st.kind === 'slag') {
      const q = spec.caves.find((k) => st.z >= k.z0 && st.z <= k.z1), zN = st.z - st.d / 2;
      for (const side of [-1, 1]) { const p = egToDungeon(spec, (q ? q.x : st.x) + side * ((q ? q.halfW : 0) - 0.3), st.y + 2.9, zN - 0.4); if (pieceAt(m, p[0], p[1], p[2]) >= 0) kinds.spout++; }
    }
  }
  assert.ok(kinds.stacks > 0, 'a bookcase is an occluder');
  assert.ok(kinds.niche > 0 && kinds.nicheBare === 0, `a niche's walls and lid an occluder's (${kinds.niche}, ${kinds.nicheBare} not)`);
  assert.ok(kinds.nicheFloors > 0 && kinds.nicheFloor === 0, `its floor never (${kinds.nicheFloor} of ${kinds.nicheFloors})`);
  assert.ok(kinds.ring > 0, 'a ring wall\'s segment is an occluder');
  assert.ok(kinds.arch > 0, 'an arch is an occluder');
  assert.ok(kinds.door > 0, 'the door\'s post is an occluder');
  assert.ok(kinds.vignette > 0, 'a vignette is an occluder');
  assert.ok(kinds.spout > 0, 'a slag spout is an occluder');
});

// ── THE RAY ─────────────────────────────────────────────────────────────────────────────────────────────────────────
test('EG-ZN THE RAY (scenes/eliteGates/egOcclude.js): a segment crosses a triangle from either face, only within its length; a box by the slab test; a ray from the eye to the body - stopped 0.3 m short - crosses exactly the pieces of rock between them: a bookcase of the Fallen Stacks between my camera and me, never the wall I stand beside, the floor under me, or a piece just beyond my body; a body pressed into a bookcase does not dither it (mutants: one face only; the length unread; the box test skipped wrongly; the stop not taken; a second point unread)', () => {
  assert.deepEqual([EG_OCCLUDE_KEEP, EG_OCCLUDE_FADE_S, EG_OCCLUDE_BODY_M, EG_OCCLUDE_CHEST_M, EG_OCCLUDE_VIEWS_MAX], [0.25, 0.2, 0.3, 0.9, 64]);
  const T = new Float32Array([0, -1, -1, 0, 1, -1, 0, 0, 1]);   // a triangle in the plane x = 0
  assert.equal(egSegTri([-1, 0, 0], [1, 0, 0], 2, T, 0), true, 'from the front');
  assert.equal(egSegTri([1, 0, 0], [-1, 0, 0], 2, T, 0), true, 'from behind');
  assert.equal(egSegTri([-1, 0, 0], [1, 0, 0], 0.9, T, 0), false, 'short of it');
  assert.equal(egSegTri([1, 0, 0], [1, 0, 0], 2, T, 0), false, 'behind the eye');
  assert.equal(egSegTri([-1, 0, 2], [1, 0, 0], 2, T, 0), false, 'beside it');
  assert.equal(egSegTri([-1, 1.4, 0.6], [1, 0, 0], 2, T, 0), false, 'past its far edge');
  assert.equal(egSegTri([-1, 0.2, 0.2], [1, 0, 0], 2, T, 0), true, 'inside it, off its middle');
  assert.equal(egSegTri([-1, 0, 0], [0, 1, 0], 5, T, 0), false, 'along its plane\'s side');
  assert.equal(egSegBox([0, 0, 0], [1, 0, 0], 2, [1, -1, -1, 3, 1, 1]), true);
  assert.equal(egSegBox([0, 0, 0], [1, 0, 0], 0.9, [1, -1, -1, 3, 1, 1]), false, 'short of the box');
  assert.equal(egSegBox([0, 2, 0], [1, 0, 0], 5, [1, -1, -1, 3, 1, 1]), false, 'over it');
  assert.equal(egSegBox([2, 0, 0], [0, 0, 1], 5, [1, -1, -1, 3, 1, 1]), true, 'starting inside it');
  // the real Stacks: its bookcases along the walls
  const spec = egHallOf(STACKS.seed, STACKS.h, 0), q = spec.caves[0], m = buildEgCircleModel(STACKS.seed, egCircleOfHall(STACKS.h), 0);
  const occ = createEgOccluders({ renderer: null });
  occ.set({ id: 'mesh' }, m);
  const pieces = [];
  { const P = m.positions, I = m.indices; let at = 0; const T2 = []; for (const o of m.occluders) { const first = at; for (const [, s, n] of o.r) for (let j = s; j < s + n * 3; j++) { T2.push(P[I[j] * 3], P[I[j] * 3 + 1], P[I[j] * 3 + 2]); at++; } pieces.push({ b: o.b, at: first / 3, n: (at - first) / 3 }); } pieces.T = new Float32Array(T2); }
  const left = egToDungeon(spec, q.x - q.halfW, q.y, q.z0)[0];
  const cases = m.occluders.map((o, i) => [i, o]).filter(([, o]) => leftBay(left)(o));
  assert.ok(cases.length >= 4, 'the left wall\'s bays');
  const [bi, bk] = cases[2], cx = left - RECESS_D, cy = q.y + RAY_Y, pEnd = bk.b[2] + EG_WALL.pil;
  const eye = [cx, cy, bk.b[2] - 0.2], chest = [cx, cy, pEnd + 0.35], feet = [chest[0], chest[1] - EG_OCCLUDE_CHEST_M, chest[2]];
  assert.deepEqual(egOccludersHit(pieces, pieces.T, eye, [chest]), [bi], 'exactly the bookcase between');
  assert.deepEqual(egOccludersHit(pieces, pieces.T, eye, [null, chest]), [bi], 'every point read');
  assert.deepEqual(egOccludersHit(pieces, pieces.T, [cx + 1.5, cy, bk.b[2] - 0.2], [[cx + 1.5, cy, pEnd + 0.35]]), [], 'a ray past it, along the walk: nothing');
  assert.deepEqual(egOccludersHit(pieces, pieces.T, null, [chest]), [], 'no eye: nothing');
  assert.deepEqual(egOccludersHit(pieces, pieces.T, [cx + 2, cy, bk.b[2] - 0.2], [[cx + 2, cy, pEnd + 3]]), [], 'down the walk beside the wall: nothing');
  assert.deepEqual(egOccludersHit(pieces, pieces.T, [cx + 2, cy + 3, bk.b[2] - 0.2], [[cx + 2, feet[1] + 0.05, pEnd]]), [], 'down onto the floor: the floor is no occluder');
  // a body pressed 0.1 m into the bookcase's near face: the ray stops 0.3 m short, before it
  assert.deepEqual(egOccludersHit(pieces, pieces.T, eye, [[cx, cy, bk.b[2] + 0.1]]), [], 'a body pressed 0.1 m into it: the ray stopped short of it');
  assert.deepEqual(egOccludersHit(pieces, pieces.T, eye, [[cx, cy, bk.b[2] + 0.6]]), [bi], 'the body 0.6 m past its face: between');
  assert.deepEqual(egOccludersHit(pieces, pieces.T, eye, [[cx, cy, bk.b[2] - 0.05]]), [], 'a body nearer than the stop: nothing');
  assert.equal(occ.stats().pieces, m.occluders.length);
  assert.equal(occ.stats().tris, m.occluders.reduce((n, o) => n + o.r.reduce((k, r) => k + r[2], 0), 0), 'only the occluders\' own triangles kept for the ray');
});

// ── THE DITHER PASS ─────────────────────────────────────────────────────────────────────────────────────────────────
/** A renderer that records: meshView as render/renderer.js mints it, drawMesh's views, setDissolve's shares, the shadow. */
function recRenderer() {
  const log = [];
  return {
    log,
    meshView: (mesh, subMeshes) => (mesh?.vao ? { vao: mesh.vao, subMeshes: subMeshes.map((s) => ({ ...s })), buffers: [], viewOf: mesh } : null),
    drawMesh: (mesh, M, remap, o) => log.push(['draw', mesh, remap, !!o?.noShadow]),
    setDissolve: (k) => log.push(['dissolve', k]),
    recordShadowMesh: (mesh, M, remap) => log.push(['shadow', mesh, remap]),
  };
}
test('EG-ZN THE DITHER PASS (scenes/eliteGates/egOcclude.js): while nothing stands between, the circle\'s draw is the loop\'s - untouched, nothing drawn here; while a piece does, the pass takes the circle\'s draw for the frame, records the WHOLE mesh\'s shadow, draws the rest of the mesh and the piece at its share, the two together every index of the mesh exactly once; the share falls to a quarter over 0.2 s and rises back once the ray is clear, and the circle is the loop\'s again; pieces at one share are one view, adjacent runs one range; views are kept, and let go with the circle; a dead mesh is never drawn through (mutants: the shadow never recorded; the rest drawn whole; the piece drawn whole; the dissolve never set back; the draw never handed back; the ease reversed; views never kept)', () => {
  const m = buildEgCircleModel(STACKS.seed, egCircleOfHall(STACKS.h), 0);
  const R = recRenderer(), occ = createEgOccluders({ renderer: R }), mesh = { vao: { id: 'vao' } };
  const draw = { gpu: mesh, object: { matrix: I4 }, texRemap: null };
  assert.equal(occ.set(mesh, m), m.occluders.length);
  occ.stand(draw);
  const full = m.subMeshes.map((s) => ({ ...s }));
  // nothing between
  assert.equal(occ.frame({ eye: null, points: null, dt: 0.016 }), 0);
  assert.equal(occ.draw(new Map()), 0);
  assert.deepEqual([R.log.length, !!draw.hidden], [0, false], 'the loop draws the circle whole');
  // the egOccludeEase numbers
  assert.equal(egOccludeEase(1, true, 0.1), 1 - (0.75 * 0.1) / 0.2);
  assert.equal(egOccludeEase(1, true, 0.2), EG_OCCLUDE_KEEP);
  assert.equal(egOccludeEase(0.3, true, 1), EG_OCCLUDE_KEEP, 'never past its keep');
  assert.equal(egOccludeEase(EG_OCCLUDE_KEEP, false, 0.1), EG_OCCLUDE_KEEP + 0.375);
  assert.equal(egOccludeEase(0.9, false, 1), 1, 'never past whole');
  assert.equal(egOccludeEase(0.5, true, 0), 0.5, 'no time, no step');
  // a bookcase between: one piece hit
  const spec = egHallOf(STACKS.seed, STACKS.h, 0), q = spec.caves[0], left = egToDungeon(spec, q.x - q.halfW, 0, 0)[0];
  const bi = m.occluders.findIndex(leftBay(left)), bk = m.occluders[bi], pEnd = bk.b[2] + EG_WALL.pil;
  const cx = left - RECESS_D, cy = RAY_Y, eye = [cx, cy, bk.b[2] - 0.2], body = [[cx, cy, pEnd + 0.35]];
  const remap = new Map();
  assert.equal(occ.frame({ eye, points: body, dt: 0.1 }), 1);
  assert.deepEqual(occ.shares(), [[bi, 0.625]]);
  const n = occ.draw(remap);
  assert.equal(draw.hidden, true, 'the circle\'s draw taken for the frame');
  const [shadow, rest, dis, piece, back, ...more] = R.log;
  assert.deepEqual(more, []);
  assert.deepEqual(shadow, ['shadow', mesh, remap], 'the whole mesh\'s shadow, as the loop records it');
  assert.equal(rest[1].viewOf, mesh); assert.equal(rest[3], true, 'the rest: no shadow of its own');
  assert.deepEqual(dis, ['dissolve', 0.625]);
  assert.equal(piece[1].viewOf, mesh); assert.equal(piece[3], true);
  assert.deepEqual(back, ['dissolve', 1], 'the dissolve set back');
  assert.deepEqual(covered([...rest[1].subMeshes, ...piece[1].subMeshes]), covered(full), 'the rest and the piece: every index of the mesh, once');
  assert.deepEqual(piece[1].subMeshes.map((s) => [s.startIndex, s.primitiveCount]), bk.r.map(([, at, k]) => [at, k]), 'the piece: its own runs');
  assert.ok(piece[1].subMeshes.every((s, i) => s.textureArchive === m.subMeshes[bk.r[i][0]].textureArchive && s.textureRecord === m.subMeshes[bk.r[i][0]].textureRecord), 'in its own dress');
  assert.equal(n, rest[1].subMeshes.length + piece[1].subMeshes.length);
  assert.equal(occ.stats().glDraws, n);
  // the next frames: the same views, the share down to its keep and held
  R.log.length = 0;
  occ.frame({ eye, points: body, dt: 0.1 }); occ.draw(remap);
  assert.deepEqual(occ.shares(), [[bi, EG_OCCLUDE_KEEP]]);
  assert.equal(R.log[1][1], rest[1], 'the rest\'s view kept');
  assert.equal(R.log[3][1], piece[1], 'the piece\'s view kept');
  assert.deepEqual(R.log[2], ['dissolve', EG_OCCLUDE_KEEP]);
  occ.stand(draw);
  assert.deepEqual([occ.shares(), draw.hidden], [[], false], 'a stand starts whole');
  occ.frame({ eye, points: body, dt: 0.1 }); occ.frame({ eye, points: body, dt: 0.1 });
  // clear: back up over 0.2 s, then the loop's again
  occ.frame({ eye: [cx + 2, cy, bk.b[2] - 0.2], points: [[cx + 2, cy, pEnd + 0.35]], dt: 0.1 });
  assert.deepEqual(occ.shares(), [[bi, EG_OCCLUDE_KEEP + 0.375]], 'rising back');
  R.log.length = 0; occ.draw(remap);
  assert.equal(draw.hidden, true);
  occ.frame({ eye: [cx + 2, cy, bk.b[2] - 0.2], points: [[cx + 2, cy, pEnd + 0.35]], dt: 0.1 });
  assert.deepEqual(occ.shares(), []);
  R.log.length = 0;
  assert.equal(occ.draw(remap), 0);
  assert.deepEqual([R.log.length, draw.hidden], [0, false], 'whole again: the loop draws the circle');
  // two pieces at one share: one view, their runs one range where they meet
  // PIN MOVED (EG-LOOK HALLS): a bay is a piece of several records now - two bays side by side meet in each record they wear
  const inside = (i) => m.occluders[i].r.every(([s, at, k]) => { const sm = m.subMeshes[s]; return at > sm.startIndex && at + k * 3 < sm.startIndex + sm.primitiveCount * 3; });
  const meet = (i) => { const a = m.occluders[i], b = m.occluders[i + 1]; return !!b && a.r.length === b.r.length && a.r.every(([s, at, k], j) => b.r[j][0] === s && at + k * 3 === b.r[j][1]); };
  const two = m.occluders.map((o, i) => i).filter((i) => meet(i) && inside(i) && inside(i + 1))[0];
  const ranges = egOccludeRanges(m.subMeshes, m.occluders, [two, two + 1], false);
  assert.deepEqual(ranges.map((s) => [s.startIndex, s.primitiveCount]), m.occluders[two].r.map(([, at, k], j) => [at, k + m.occluders[two + 1].r[j][2]]), 'adjacent runs one range a sub-mesh');
  const cut = egOccludeRanges(m.subMeshes, m.occluders, [two, two + 1], true);
  assert.equal(cut.length, m.subMeshes.length + m.occluders[two].r.length, 'the rest: each sub-mesh they wear cut in two');
  assert.deepEqual(covered([...cut, ...ranges]), covered(full));
  // two bookcases on one ray, at one share: the rest and ONE view of the two
  const lefts = m.occluders.map((o, i) => i).filter((i) => leftBay(left)(m.occluders[i]));
  const [b1, b2] = [m.occluders[lefts[1]], m.occluders[lefts[2]]];
  const both = occ.frame({ eye: [cx, cy, b1.b[2] - 0.2], points: [[cx, cy, b2.b[2] + EG_WALL.pil + 0.35]], dt: 0.1 });
  assert.equal(both, 2);
  R.log.length = 0; occ.draw(remap);
  const drawn = R.log.filter((e) => e[0] === 'draw');
  assert.equal(drawn.length, 2, 'the rest, and the two in one view');
  assert.deepEqual(drawn[1][1].subMeshes.map((s) => [s.startIndex, s.primitiveCount]), egOccludeRanges(m.subMeshes, m.occluders, [lefts[1], lefts[2]], false).map((r) => [r.startIndex, r.primitiveCount]));   // PIN MOVED (EG-LOOK HALLS): the two bays' runs, met a sub-mesh at a time
  for (let k = 0; k < 4; k++) occ.frame({ eye: [cx + 2, cy, b1.b[2] - 0.2], points: [[cx + 2, cy, b2.b[2] + EG_WALL.pil + 0.35]], dt: 0.1 });
  assert.deepEqual(occ.shares(), []);
  // the views kept are let go past their cap, never grown without end (a circle of many pieces, each dithered in turn)
  const m2 = buildEgCircleModel(99, 6, 0), occ2 = createEgOccluders({ renderer: R });
  assert.ok(m2.occluders.length > EG_OCCLUDE_VIEWS_MAX);
  occ2.set(mesh, m2);
  let drew = 0;
  for (const o of m2.occluders) {
    const c0 = [(o.b[0] + o.b[3]) / 2, (o.b[1] + o.b[4]) / 2, (o.b[2] + o.b[5]) / 2];
    occ2.stand(draw);
    if (occ2.frame({ eye: [c0[0] + 0.01, c0[1] + 30, c0[2] + 0.01], points: [[c0[0] - 0.01, c0[1] - 30, c0[2] - 0.01]], dt: 0.1 }) > 0 && occ2.draw(remap) > 0) drew++;
    assert.ok(occ2.stats().views <= EG_OCCLUDE_VIEWS_MAX, 'at most the cap');
  }
  assert.ok(drew > EG_OCCLUDE_VIEWS_MAX / 2, `past the cap (${drew} sets drawn)`);
  draw.hidden = false;
  // let go with the circle; a dead mesh never drawn through
  occ.clear();
  assert.deepEqual(occ.stats(), { pieces: 0, tris: 0, dithering: 0, glDraws: 0, views: 0, hidden: false });
  occ.set(mesh, m); occ.stand(draw);
  occ.frame({ eye, points: body, dt: 0.1 });
  mesh._dead = true;
  R.log.length = 0;
  assert.equal(occ.draw(remap), 0);
  assert.deepEqual([R.log.length, draw.hidden], [0, false], 'a dead mesh: nothing drawn through it');
  // a renderer with no views (a headless host): the loop draws the circle whole, as before
  const bare = createEgOccluders({ renderer: { drawMesh() { throw new Error('no'); } } });
  bare.set({ vao: {} }, m); bare.stand(draw);
  bare.frame({ eye, points: body, dt: 0.1 });
  assert.equal(bare.draw(), 0);
  assert.equal(draw.hidden, false);
});

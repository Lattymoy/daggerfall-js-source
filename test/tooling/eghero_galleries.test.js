// EG-HERO (the Broken Galleries, 2026-10-13, Mac: "You have to author the fragments"; bible/11-Multiplayer/Elite-Gates.md
// sections 11.2, 11.6 and 31, EG-HERO (the Broken Galleries)): THE GALLERIES' THREE HERO FRAGMENTS - the Oblivion Caverns
// passage (tools/egHeroCavernsScene.mjs), the Fallen Stacks chamber (tools/egHeroStacksScene.mjs) and the Broken Colonnade
// passage (tools/egHeroColonnadeScene.mjs), each a scene the port writes from numbers, baked by its own script through
// tools/fragBake.mjs. For each: the scene writes the committed .fbx byte for byte; its bake gives the committed halves byte
// for byte, and again; the reader takes its law and the registries hold both halves; its envelope is its kit's code-built
// one; THE TIMED SOLVER proves its inner course; it keeps the budget; THE EDGE LINE stands on every rim a member could fall
// from; no drawn vertex stands in the room its floors give a body, and the proxy is that room's envelope; its walk graph
// never crosses a gap; its signature is in its law.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { bakeFrag, fragJson } from '../../tools/fragBake.mjs';
import { heroCavernsScene, writeHeroCavernsFbx, HERO_CAVERNS_FBX } from '../../tools/egHeroCavernsScene.mjs';
import { heroStacksScene, writeHeroStacksFbx, HERO_STACKS_FBX } from '../../tools/egHeroStacksScene.mjs';
import { heroColonnadeScene, writeHeroColonnadeFbx, HERO_COLONNADE_FBX } from '../../tools/egHeroColonnadeScene.mjs';
import * as CAV from '../../tools/bakeEgHeroCaverns.mjs';
import * as STK from '../../tools/bakeEgHeroStacks.mjs';
import * as COL from '../../tools/bakeEgHeroColonnade.mjs';
import { EG_FRAGS, EG_FRAG_PIECES, EG_FRAG_BUDGET, EG_FRAG_HEADROOM_CM, EG_PLAYS, EG_ENGINES, EG_HAZARDS, egFragRecordFault, egFragSteps, egFragHazards, egFragInPoly, egFragCeilAt, egHazardLawful } from '../../src/net/eliteGates/egFragLaw.js';
import { egSpanProof, egRoadCross, egJumpReach, EG_DRUM_MPS } from '../../src/net/eliteGates/egSpanLaw.js';
import { EG_HERO_FRAGS, egHeroFragLaws } from '../../src/net/eliteGates/egHeroFrags.js';
import { EG_HERO_FRAG_MESHES, egHeroFragModel, egHeroFragCollider } from '../../src/world/eliteGates/egHeroFragModel.js';
import { EG_DRESS } from '../../src/world/eliteGates/egBandArt.js';

const ROOT = new URL('../../', import.meta.url);
const committed = (rel) => readFileSync(new URL(rel, ROOT));
const FRAGS = [
  { name: 'caverns', write: writeHeroCavernsFbx, scene: heroCavernsScene, fbx: HERO_CAVERNS_FBX, bake: CAV, src: 'tools/egHeroCavernsScene.mjs' },
  { name: 'stacks', write: writeHeroStacksFbx, scene: heroStacksScene, fbx: HERO_STACKS_FBX, bake: STK, src: 'tools/egHeroStacksScene.mjs' },
  { name: 'colonnade', write: writeHeroColonnadeFbx, scene: heroColonnadeScene, fbx: HERO_COLONNADE_FBX, bake: COL, src: 'tools/egHeroColonnadeScene.mjs' },
];
/** Each fragment baked once from its committed scene (the byte test bakes again). */
const BAKED = new Map(FRAGS.map((f) => [f.name, bakeFrag(committed(f.fbx), f.bake.SPEC)]));
const lawOf = (name) => BAKED.get(name).law;
const meshOf = (name) => BAKED.get(name).mesh;

// ── plan geometry, in metres (the law's centimetres over 100), the fragment's frame (x across, y up, z along) ──────────
const M = (v) => v / 100;
const polyM = (poly) => poly.map((p) => [M(p[0]), M(p[1])]);
/** The distance from (x, z) to segment a-b. */
function segDist(x, z, a, b) {
  const dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz, t = l2 ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / l2)) : 0;
  return Math.hypot(x - (a[0] + dx * t), z - (a[1] + dz * t));
}
/** Is (x, z) inside polygon `poly` (metres) by at least `inset`? */
const deepIn = (poly, x, z, inset) => egFragInPoly(poly, x, z) && poly.every((p, i) => segDist(x, z, p, poly[(i + 1) % poly.length]) >= inset);
/** A ramp's height under (x, z): its plane through its corners (metres). */
function rampY(q, x, z) {
  const P = q.poly.map((p) => [M(p[0]), M(p[1]), M(p[2])]), [a, b, c] = [P[0], P[1], P[2]];
  const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  return a[1] - (n[0] * (x - a[0]) + n[2] * (z - a[2])) / n[1];
}
/** The closest distance from point p to triangle a, b, c (3D). */
function triDist(p, a, b, c) {
  const sub = (u, v) => [u[0] - v[0], u[1] - v[1], u[2] - v[2]], dot = (u, v) => u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
  const ab = sub(b, a), ac = sub(c, a), ap = sub(p, a), d1 = dot(ab, ap), d2 = dot(ac, ap);
  const at = (q) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
  if (d1 <= 0 && d2 <= 0) return at(a);
  const bp = sub(p, b), d3 = dot(ab, bp), d4 = dot(ac, bp);
  if (d3 >= 0 && d4 <= d3) return at(b);
  const vc = d1 * d4 - d3 * d2;
  if (vc <= 0 && d1 >= 0 && d3 <= 0) { const v = d1 / (d1 - d3); return at([a[0] + ab[0] * v, a[1] + ab[1] * v, a[2] + ab[2] * v]); }
  const cp = sub(p, c), d5 = dot(ab, cp), d6 = dot(ac, cp);
  if (d6 >= 0 && d5 <= d6) return at(c);
  const vb = d5 * d2 - d1 * d6;
  if (vb <= 0 && d2 >= 0 && d6 <= 0) { const w = d2 / (d2 - d6); return at([a[0] + ac[0] * w, a[1] + ac[1] * w, a[2] + ac[2] * w]); }
  const va = d3 * d6 - d5 * d4;
  if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) { const w = (d4 - d3) / (d4 - d3 + (d5 - d6)); return at([b[0] + (c[0] - b[0]) * w, b[1] + (c[1] - b[1]) * w, b[2] + (c[2] - b[2]) * w]); }
  const den = 1 / (va + vb + vc), v = vb * den, w = vc * den;
  return at([a[0] + ab[0] * v + ac[0] * w, a[1] + ab[1] * v + ac[1] * w, a[2] + ab[2] * v + ac[2] * w]);
}
/** The triangles of a flat array of corners (nine numbers a triangle). */
const trisOf = (flatArr) => Array.from({ length: flatArr.length / 9 }, (_, t) => [0, 1, 2].map((k) => flatArr.slice(t * 9 + k * 3, t * 9 + k * 3 + 3)));
/** A mesh's triangles of dress record `rec`. */
function recordTris(mesh, rec) {
  const s = mesh.subMeshes.find((q) => q.record === rec), out = [];
  if (!s) return out;
  for (let t = s.startIndex; t < s.startIndex + s.primitiveCount * 3; t += 3) out.push([0, 1, 2].map((k) => mesh.positions.slice(mesh.indices[t + k] * 3, mesh.indices[t + k] * 3 + 3)));
  return out;
}
/** Is (x, z) inside a triangle in plan? */
function inTriPlan(x, z, [a, b, c]) {
  const s = (p, q) => (q[0] - p[0]) * (z - p[2]) - (q[2] - p[2]) * (x - p[0]);
  const d1 = s(a, b), d2 = s(b, c), d3 = s(c, a);
  return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
}

/** EVERY RIM A MEMBER COULD FALL FROM (section 25.3): each open edge's points every 0.25 m (5 cm in from its ends) - but not
 *  where it runs on into another floor or a ramp at its height (a step, not a fall), nor on a socket's face (the course
 *  joins there) - as [floor, x, z, inward x, inward z]. */
function rimSamples(law) {
  const out = [], floors = law.floors.map((f) => ({ y: M(f.y), poly: polyM(f.poly) }));
  const sockets = [law.sockets.in, ...law.sockets.out].map((s) => ({ z: M(s.z), x0: M(s.x - s.w / 2), x1: M(s.x + s.w / 2), y: M(s.y) }));
  for (const [fi, e] of law.open) {
    const f = floors[fi], a = f.poly[e], b = f.poly[(e + 1) % f.poly.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const nx = (b[1] - a[1]) / L, nz = -(b[0] - a[0]) / L;   // outward: the floor winds counter-clockwise
    for (let d = 0.05; d <= L - 0.05 + 1e-9; d += Math.max(0.05, Math.min(0.25, (L - 0.1) / 2))) {
      const x = a[0] + ((b[0] - a[0]) * d) / L, z = a[1] + ((b[1] - a[1]) * d) / L, ox = x + nx * 0.15, oz = z + nz * 0.15;
      const onSocket = sockets.some((s) => Math.abs(z - s.z) < 0.02 && x >= s.x0 - 0.02 && x <= s.x1 + 0.02 && Math.abs(f.y - s.y) < 0.02);
      const runsOn = floors.some((g, gi) => gi !== fi && Math.abs(g.y - f.y) < 0.05 && egFragInPoly(g.poly, ox, oz))
        || law.ramps.some((q) => egFragInPoly(q.poly.map((p) => [M(p[0]), M(p[2])]), ox, oz) && Math.abs(rampY(q, ox, oz) - f.y) < 0.3);
      if (!onSocket && !runsOn) out.push([fi, x, z, -nx, -nz]);
    }
  }
  return out;
}
/** THE ROOM A BODY HAS: over each floor (5 cm in from its edges) from 3 cm over it to 3 cm under its ceiling - or its
 *  class's headroom where it is open to the sky; over each ramp the same over its slope. True when a point stands in it. */
function inRoom(law, p) {
  const room = M(EG_FRAG_HEADROOM_CM[law.class]);
  for (const f of law.floors) {
    const y = M(f.y), poly = polyM(f.poly);
    if (p[1] <= y + 0.03 || !deepIn(poly, p[0], p[2], 0.05)) continue;
    const c = egFragCeilAt(law, p[0] * 100, p[2] * 100, f.y), top = c === null ? y + room : M(c);
    if (p[1] < top - 0.03) return true;
  }
  for (const q of law.ramps) {
    const plan = q.poly.map((c) => [M(c[0]), M(c[2])]);
    if (!deepIn(plan, p[0], p[2], 0.05)) continue;
    const y = rampY(q, p[0], p[2]);
    if (p[1] > y + 0.03 && p[1] < y + M(EG_FRAG_HEADROOM_CM.passage) - 0.03) return true;
  }
  return false;
}

/** WHAT EACH IS, pinned: its spec, the envelope its kit's code-built fragment keeps, its art's and law's counts, and its
 *  proof (net/eliteGates/egFragLaw.js egFragPassage / egFragChamber, net/eliteGates/egLaw.js EG_CAVE and the proving court's R 1400). */
const PIN = {
  caverns: {
    spec: ['egheroCaverns', 'caverns', 'passage', 'caverns', []],
    sockets: { in: { x: 0, y: 0, z: 0, yaw: 180, w: 600, h: 520 }, out: [{ x: 0, y: 0, z: 2800, yaw: 0, w: 600, h: 520 }] },
    box: [-1062, -1726, 0, 1061, 1921, 2800],
    floors: [[0, 1, 10], [0, 1, 8]], ramps: 0, ceil: [520, 520], open: 6,
    cost: { tris: 8918, collider: 76, lights: 3, draws: 6 }, proof: { crossFast: 2066, crossSlow: 2066, moves: 4 },
    course: [['ledge', 50, -20, 1070, 170], ['ledge', -50, -45, 1450, 180], ['ledge', 40, -15, 1830, 180]],
    hazards: ['basalt', 'fall', 'surge'], graph: [10, 12], alcoves: [{ x: 420, y: 0, z: 440, seal: 'seam', side: 1, holds: 'page' }],
  },
  stacks: {
    spec: ['egheroStacks', 'stacks', 'chamber', 'stacks', ['balcony', 'engine']],
    sockets: { in: { x: 0, y: 0, z: 0, yaw: 180, w: 660, h: 800 }, out: [{ x: 0, y: 0, z: 4700, yaw: 0, w: 660, h: 800 }] },
    box: [-2347, -1400, 0, 2580, 2142, 4700],
    floors: [[0, 0, 4], [350, 1, 21], [0, 1, 62], [350, 1, 19], [0, 0, 4]], ramps: 2, ceil: null, open: 66,
    cost: { tris: 5176, collider: 260, lights: 4, draws: 7 }, proof: { crossFast: 1280, crossSlow: 1280, moves: 3 },
    course: [['ledge', 30, 30, 374, 160], ['ledge', -30, -20, 724, 160]],   // PIN MOVED (AUDIT EG IV): its second shelf 2.0 m deep, THE LANDING ROOM's 52 cm
    hazards: ['cascade'], graph: [21, 23], alcoves: [{ x: 2400, y: 350, z: 2350, seal: 'seam', side: 1, holds: 'shard' }],
  },
  colonnade: {
    spec: ['egheroColonnade', 'colonnade', 'passage', 'colonnade', []],
    sockets: { in: { x: 0, y: 0, z: 0, yaw: 180, w: 500, h: 460 }, out: [{ x: 0, y: 0, z: 2800, yaw: 0, w: 500, h: 460 }] },
    box: [-1120, -1310, 0, 1105, 845, 2800],
    floors: [[40, 0, 4], [0, 1, 4], [0, 1, 4]], ramps: 0, ceil: null, open: 12,
    cost: { tris: 5094, collider: 84, lights: 3, draws: 5 }, proof: { crossFast: 2999, crossSlow: 3099, moves: 4 },
    course: [['still', 0, 35, 810, 220], ['drum', 0, 0, 1350, 260], ['drum', 0, 0, 1950, 300]],
    hazards: [], graph: [6, 6], alcoves: [{ x: 560, y: 40, z: 200, seal: 'jump', side: 1, holds: 'lumen' }],
  },
};

test('EG-HERO (Galleries) WRITTEN AND BAKED BYTE FOR BYTE (section 11.6: "each fragment its own bake script and byte-for-byte test"): each scene the port writes is its committed .fbx bit for bit; its bake script\'s spec bakes it to the committed law half and mesh half bit for bit, and again to the same bytes; each half names its source and its sha256 (mutants: a scene\'s number moved; a spec\'s field)', () => {
  for (const f of FRAGS) {
    const fbx = committed(f.fbx);
    assert.ok(f.write().equals(fbx), `${f.src} writes the committed ${f.fbx}`);
    const { law, mesh } = bakeFrag(fbx, f.bake.SPEC);
    assert.equal(fragJson(law), committed(f.bake.LAW).toString('utf8'), `${f.name}: the law half`);
    assert.equal(fragJson(mesh), committed(f.bake.MESH).toString('utf8'), `${f.name}: the mesh half`);
    const again = bakeFrag(committed(f.fbx), f.bake.SPEC);
    assert.equal(fragJson(again.law) + fragJson(again.mesh), fragJson(law) + fragJson(mesh), `${f.name}: a re-bake is the same bytes`);
    assert.equal(law.bake.source, f.fbx);
    assert.equal(law.bake.sha256, mesh.bake.sha256);
    assert.equal(mesh.bake.writer, 'port');
    assert.equal(f.bake.LAW, f.fbx.replace('source/', '').replace('.fbx', '.law.json'));
    assert.equal(f.bake.MESH, f.fbx.replace('source/', '').replace('.fbx', '.mesh.json'));
  }
});

test('EG-HERO (Galleries) THE READER AND THE REGISTRIES (sections 11.5 and 11.6): each law half has no fault the reader finds; net/eliteGates/egHeroFrags.js holds it (frozen) and lays it for its kit, never the reference; world/eliteGates/egHeroFragModel.js holds its mesh beside it and builds its model under the Galleries\' archive and its collider from its proxy (mutants: a law left out of the registry; a mesh left out)', () => {
  for (const f of FRAGS) {
    const { law, mesh } = BAKED.get(f.name), id = f.bake.SPEC.id;
    assert.deepEqual(egFragRecordFault(law), [], `${f.name}: the reader takes it`);
    assert.equal(JSON.stringify(EG_HERO_FRAGS[id]), JSON.stringify(law), `${f.name}: registered`);
    assert.ok(Object.isFrozen(EG_HERO_FRAGS[id]));
    assert.deepEqual(egHeroFragLaws(law.kit).map((l) => l.id), [id], `${f.name}: the hero a hall may lay for its kit`);
    assert.equal(JSON.stringify(EG_HERO_FRAG_MESHES[id]), JSON.stringify(mesh), `${f.name}: its mesh registered`);
    const model = egHeroFragModel(id);
    assert.equal(model.positions.length, mesh.indices.length * 3, `${f.name}: every corner in the model`);
    assert.deepEqual(model.subMeshes.map((s) => s.textureRecord), mesh.subMeshes.map((s) => s.record));
    assert.deepEqual([...egHeroFragCollider(id, [1, 2, 3]).slice(0, 3)].map((v) => Math.round(v * 1e4) / 1e4), [mesh.collider[0] + 1, mesh.collider[1] + 2, mesh.collider[2] + 3].map((v) => Math.round(v * 1e4) / 1e4));
  }
});

test('EG-HERO (Galleries) THE ENVELOPE (each its kit\'s code-built one - net/eliteGates/egFragLaw.js egFragPassage and egFragChamber): its spec (id, kit, class, a variant of its own, a chamber\'s play), its sockets (the mouth at the origin, the exits on the box\'s +Z face - the Caverns\' 6 m by 5.2 m, the Colonnade\'s 5 m, the Stacks\' 6 m doorways 47 m apart about the proving court\'s R 14 m), its box, floors, ceilings, open edges, course, graph and alcove (mutants: a socket\'s height; a floor\'s fight; a ceiling dropped)', () => {
  for (const f of FRAGS) {
    const law = lawOf(f.name), P = PIN[f.name];
    assert.deepEqual([law.id, law.kit, law.class, law.variant, law.play], P.spec, `${f.name}: its spec`);
    assert.equal(law.band, 0, 'the Broken Galleries');
    assert.equal(law.reverb, EG_FRAGS[law.kit].reverb);
    assert.notEqual(law.variant, 'reference');
    assert.ok(EG_FRAGS[law.kit].classes.includes(law.class));
    assert.deepEqual(law.sockets, P.sockets, `${f.name}: its sockets`);
    assert.deepEqual(law.box, P.box, `${f.name}: its box`);
    assert.deepEqual(law.floors.map((q) => [q.y, q.fight, q.poly.length]), P.floors, `${f.name}: its floors`);
    assert.equal(law.ramps.length, P.ramps);
    assert.deepEqual(law.ceil?.map((c) => c.y) ?? null, P.ceil, `${f.name}: its ceilings`);
    assert.equal(law.open.length, P.open, `${f.name}: its open edges`);
    assert.deepEqual(law.course.map((c) => [c.kind, c.x, c.y, c.z, c.gap]), P.course, `${f.name}: its course`);
    assert.deepEqual([law.graph.nodes.length, law.graph.edges.length], P.graph);
    assert.deepEqual(law.alcoves, P.alcoves, `${f.name}: its alcove`);
    assert.deepEqual(law.hazards.map((h) => h.kind), P.hazards, `${f.name}: its hazards`);
  }
  // the passages' length and floor at both ends (the kits' len 2800, yB 0), the chamber's play among the page's
  for (const name of ['caverns', 'colonnade']) assert.deepEqual([lawOf(name).sockets.out[0].z, lawOf(name).sockets.out[0].y], [2800, 0]);
  assert.ok(lawOf('stacks').play.every((p) => EG_PLAYS.includes(p)));
  assert.ok(lawOf('stacks').floors.filter((q) => q.fight && q.y >= 300 && q.y <= 400).length === 2, 'two balconies 3-4 m up (section 11.4)');
  assert.equal(EG_FRAGS.stacks.engine, 'shelf');
  assert.ok(EG_ENGINES.shelf && lawOf('stacks').anchors.engine.length === 1, 'THE SHELF stands where its anchor is');
  assert.ok(lawOf('stacks').anchors.rift.length >= 4 && lawOf('stacks').anchors.caster.length === 2, 'rifts for a Rift-Yard, a Caster on each gallery');
});

test('EG-HERO (Galleries) THE TIMED SOLVER PROVES EACH INNER COURSE (section 10.5): every piece its kit\'s (EG_FRAG_PIECES), every pair\'s windows and waits, THE MEDIAN - the proof the record carries is the solver\'s own (the fastest and the median crossings at THE SPAN BUILD); the Colonnade\'s drums roll at the law\'s 2.0 m/s (mutants: a gap past the reach; a drum\'s roll; a piece out of its kit)', () => {
  for (const f of FRAGS) {
    const law = lawOf(f.name), steps = egFragSteps(law);
    assert.ok(law.course.every((c) => EG_FRAG_PIECES[law.kit].includes(c.kind)), `${f.name}: its kit's pieces`);
    const P = egSpanProof({ steps });
    assert.ok(P.ok, `${f.name}: proven - ${P.why.join('; ')}`);
    const c = egRoadCross({ steps }, 0);
    assert.deepEqual(law.proof, { crossFast: Math.round(c.fast * 1000), crossSlow: Math.round(c.median * 1000), moves: c.n });
    assert.deepEqual(law.proof, PIN[f.name].proof, `${f.name}: its proof`);
    // the solver takes the ground before the first piece and after the last as level with them: their real rise is held
    // here - the jump off the ground onto the first, and off the last onto the ground, inside THE SPAN BUILD's reach
    const first = law.course[0], last = law.course[law.course.length - 1];
    const groundAt = (z) => law.floors.find((q) => q.poly.some((p) => p[1] === z) && egFragInPoly(q.poly, first.x, z));
    const g0 = groundAt(first.z - first.d / 2 - first.gap), g1 = law.floors.find((q) => q.poly.some((p) => p[1] === last.z + last.d / 2 + last.after));
    assert.ok(g0 && g1, `${f.name}: the ground before and after its course`);
    assert.ok(egJumpReach(M(first.y - g0.y)).reach >= M(first.gap), `${f.name}: onto the first piece, ${first.y - g0.y} cm up over ${first.gap} cm`);
    assert.ok(egJumpReach(M(g1.y - last.y)).reach >= M(last.after), `${f.name}: onto the ground after, ${g1.y - last.y} cm up over ${last.after} cm`);
  }
  const drums = lawOf('colonnade').course.filter((c) => c.kind === 'drum');
  assert.equal(drums.length, 2, 'the rolling drums - the Colonnade\'s signature');
  for (const d of drums) assert.equal(d.period, Math.trunc((4 * d.amp * 1000) / (EG_DRUM_MPS * 100)), 'out and back at 2.0 m/s');
  assert.deepEqual(drums.map((d) => [d.amp, d.period]), [[120, 2400], [120, 2400]]);
});

test('EG-HERO (Galleries) THE SIGNATURES, LAWFUL (sections 11.2 and 11.7): the Caverns\' fire fall a lane across the passage, its surge a 4 m lane along its channel over the far floor, its basalt two discs r 2.5 on the near; the Stacks\' cascade four lanes 4 m deep across its floor, the near first; each keeps THE WIDTH RULE and THE WIND-UP FLOOR (mutants: a lane narrowed; the cascade reordered)', () => {
  const cav = lawOf('caverns'), by = Object.fromEntries(cav.hazards.map((h) => [h.kind, h]));
  assert.deepEqual([by.fall.sh, by.fall.w], [[-240, 720, 240, 720], 120], 'the fire fall across the passage, just short of the near lip');
  assert.deepEqual([by.surge.sh, by.surge.w], [[-60, 2340, -60, 2540], 400], 'the surge along the channel, 4 m wide');
  assert.deepEqual([by.basalt.spots, by.basalt.r], [[[80, 270], [-90, 520]], 250]);
  const cas = lawOf('stacks').hazards[0];
  assert.deepEqual([cas.kind, cas.w, cas.lanes.map((q) => q[1])], ['cascade', 400, [1525, 2075, 2625, 3175]], 'four lanes along +Z, 5.5 m apart');
  for (const name of ['caverns', 'stacks']) for (const h of egFragHazards(lawOf(name))) assert.ok(egHazardLawful(h).ok, `${name}: ${h.kind} lawful`);
  assert.equal(EG_HAZARDS.cascade.every, 1500);
  // the fight floors the aimed hazards land on: the Caverns' two, the Stacks' reading floor
  assert.ok(by.surge.sh.every((v, i) => (i % 2 ? v >= 2100 : true)) && by.basalt.spots.every((s) => s[1] < 800), 'the surge over the far floor, the basalt over the near');
});

test('EG-HERO (Galleries) THE BUDGET (section 11.9\'s starting bounds - net/eliteGates/egFragLaw.js EG_FRAG_BUDGET): at most 12,000 drawn triangles (each a showpiece, past 4,000), 12 draws, 3,000 collider triangles, 4 lights - the record\'s cost the mesh\'s own; the art wears the Galleries\' dress alone (mutants: the budget\'s bound; a cost miscounted)', () => {
  for (const f of FRAGS) {
    const { law, mesh } = BAKED.get(f.name);
    assert.deepEqual(law.cost, PIN[f.name].cost, `${f.name}: its cost`);
    for (const [k, max] of Object.entries(EG_FRAG_BUDGET)) assert.ok(law.cost[k] <= max, `${f.name}: ${k} ${law.cost[k]} inside ${max}`);
    assert.ok(law.cost.tris >= 4000, `${f.name}: a showpiece (${law.cost.tris} triangles)`);
    assert.equal(law.cost.tris, mesh.indices.length / 3);
    assert.equal(law.cost.draws, mesh.subMeshes.length);
    assert.equal(law.cost.collider, mesh.collider.length / 9);
    assert.ok(mesh.subMeshes.every((s) => EG_DRESS[s.material] === s.record));
    assert.ok(law.cost.collider < law.cost.tris / 10, `${f.name}: the proxy, never the drawn mesh`);
  }
});

test('EG-HERO (Galleries) THE EDGE LINE ON EVERY RIM (section 25.3): every point of every open edge a member could fall from - not where it runs on into another floor or a ramp, not on a socket\'s face - stands on a strip of the edge record, lying on its floor just inside it (mutants: a lip\'s line left off; a kerb\'s; the bridge\'s side)', () => {
  for (const f of FRAGS) {
    const { law, mesh } = BAKED.get(f.name), edge = recordTris(mesh, EG_DRESS.edge), samples = rimSamples(law);
    assert.ok(samples.length >= 20, `${f.name}: ${samples.length} rim points`);
    const bare = samples.filter(([fi, x, z, ix, iz]) => {
      const y = M(law.floors[fi].y), px = x + ix * 0.06, pz = z + iz * 0.06;
      return !edge.some((t) => t.every((p) => p[1] > y && p[1] < y + 0.03) && inTriPlan(px, pz, t));
    });
    assert.deepEqual(bare.map(([fi, x, z]) => [fi, Math.round(x * 100), Math.round(z * 100)]), [], `${f.name}: rim points with no edge line`);
  }
});

test('EG-HERO (Galleries) THE PROXY IS THE ROOM\'S ENVELOPE (section 11.6: "no drawn vertex lies inside the proxy"): no drawn vertex stands in the room a body has over any floor or ramp; the proxy floors every floor (a point every half metre inside it) and walls every edge that is not open (a metre over its middle - half a metre at a parapet) (mutants: the bore pushed in; a ceiling under the vault; a proxy wall left off)', () => {
  for (const f of FRAGS) {
    const { law, mesh } = BAKED.get(f.name), P = mesh.positions;
    const inside = [];
    for (let i = 0; i < P.length; i += 3) if (inRoom(law, [P[i], P[i + 1], P[i + 2]])) inside.push(P.slice(i, i + 3));
    assert.deepEqual(inside.slice(0, 5), [], `${f.name}: drawn vertices in the room (${inside.length})`);
    const proxy = trisOf(mesh.collider);
    for (const [fi, q] of law.floors.entries()) {
      const poly = polyM(q.poly), y = M(q.y), xs = poly.map((p) => p[0]), zs = poly.map((p) => p[1]);
      let n = 0;
      for (let x = Math.min(...xs) + 0.25; x < Math.max(...xs); x += 0.5) for (let z = Math.min(...zs) + 0.25; z < Math.max(...zs); z += 0.5) {
        if (!deepIn(poly, x, z, 0.05)) continue;
        n++;
        assert.ok(proxy.some((t) => t.every((p) => Math.abs(p[1] - y) < 0.01) && inTriPlan(x, z, t)), `${f.name}: floors[${fi}] has no proxy under (${x.toFixed(2)}, ${z.toFixed(2)})`);
      }
      assert.ok(n > 0, `${f.name}: floors[${fi}] sampled`);
      const open = new Set(law.open.filter(([g]) => g === fi).map(([, e]) => e));
      for (let e = 0; e < poly.length; e++) {
        if (open.has(e)) continue;
        const a = poly[e], b = poly[(e + 1) % poly.length], m = [(a[0] + b[0]) / 2, y + (q.fight && y > 0 ? 0.5 : 1.0), (a[1] + b[1]) / 2];
        assert.ok(proxy.some((t) => triDist(m, ...t) < 0.03), `${f.name}: floors[${fi}]'s wall ${e} has no proxy face at (${m.map((v) => v.toFixed(2))})`);
      }
    }
  }
});

test('EG-HERO (Galleries) THE WALK GRAPH NEVER CROSSES A GAP (section 11.7: the legion walks, it does not jump): every point along every edge stands on a floor or a ramp at its height; every node on its ground (mutants: an edge across the chasm; a node off its floor)', () => {
  for (const f of FRAGS) {
    const law = lawOf(f.name), N = law.graph.nodes.map((n) => [M(n[0]), M(n[1]), M(n[2])]);
    const onGround = (x, y, z) => law.floors.some((q) => Math.abs(M(q.y) - y) <= 0.5 && egFragInPoly(polyM(q.poly), x, z))
      || law.ramps.some((q) => egFragInPoly(q.poly.map((c) => [M(c[0]), M(c[2])]), x, z) && Math.abs(rampY(q, x, z) - y) <= 0.5);
    for (const [a, b] of law.graph.edges) {
      const A = N[a], B = N[b], L = Math.hypot(B[0] - A[0], B[2] - A[2]);
      for (let d = 0; d <= L; d += 0.2) {
        const t = L ? d / L : 0, p = [A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t];
        assert.ok(onGround(...p), `${f.name}: edge ${a}-${b} leaves the ground at (${p.map((v) => v.toFixed(2))})`);
      }
    }
  }
});

test('EG-HERO (Galleries) WRITTEN FROM NUMBERS ALONE (the brief\'s determinism - tools/egHeroKit.mjs\'s rule): no scene calls an engine-rounded function (Math.sin, cos, tan, atan2, pow, exp, log, hypot, random) or raises by `**` - the bytes a function of IEEE arithmetic alone; each scene objects\' names are its own (mutants: none - a source sweep)', () => {
  for (const f of FRAGS) {
    const src = readFileSync(new URL(f.src, ROOT), 'utf8').replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g, '');
    assert.doesNotMatch(src, /Math\.(sin|cos|tan|atan2|pow|exp|log|hypot|random)\b|\*\*/, f.src);
    const names = f.scene().map((o) => o.name);
    assert.equal(new Set(names).size, names.length, `${f.name}: every object named once`);
  }
  const kit = readFileSync(new URL('tools/egHeroKit.mjs', ROOT), 'utf8'), ours = kit.slice(kit.indexOf('// ── EG-HERO (the Broken Galleries'));
  assert.ok(ours.length > 1000, 'the band\'s kit section stands');
  assert.doesNotMatch(ours.replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g, ''), /Math\.(sin|cos|tan|atan2|pow|exp|log|hypot|random)\b|\*\*/);
});

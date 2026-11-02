// EG-HERO (2026-10-13, the owner: "You have to author the fragments"; bible/11-Multiplayer/Elite-Gates.md sections 11.2,
// 11.4-11.9 and 25.3): THE SHADE PERILOUS'S HERO FRAGMENTS - the Gloam Thicket's passage (tools/egHeroGloamScene.mjs) and the
// Eclipse Vault's chamber (tools/egHeroEclipseScene.mjs), each a scene the port writes from numbers alone, baked by
// tools/fragBake.mjs as one of Mac's Blender exports would be (tools/bakeEgHeroGloam.mjs, tools/bakeEgHeroEclipse.mjs) and
// registered beside the reference (net/eliteGates/egHeroFrags.js, world/eliteGates/egHeroFragModel.js). For each: the scene is the committed .fbx
// bit for bit, the bake gives the committed halves bit for bit (and again), the reader accepts the record, its envelope is
// the kit's code-built one (net/eliteGates/egFragLaw.js egFragPassage('gloam'), egFragChamber('eclipse', r, 1600)), THE TIMED SOLVER
// proves its course (the Thicket's Moon branches) or its CHECK keeps its havens near (the Vault's Eclipse), it keeps the
// budget, THE EDGE LINE stands on every walkable rim, and no drawn vertex stands in the space the proxy leaves a body.
// Every fixture is what the producer minted (TEST THE SHAPE THE PRODUCER MINTS): the committed halves and the bake's output.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { bakeFrag, fragJson } from '../../tools/fragBake.mjs';
import { gloamScene, writeGloamFbx, GLOAM_FBX, GLOAM, GLOAM_BRANCHES, GLOAM_MOON } from '../../tools/egHeroGloamScene.mjs';
import { eclipseScene, writeEclipseFbx, ECLIPSE_FBX, ECLIPSE } from '../../tools/egHeroEclipseScene.mjs';
import * as GLOAM_BAKE from '../../tools/bakeEgHeroGloam.mjs';
import * as ECLIPSE_BAKE from '../../tools/bakeEgHeroEclipse.mjs';
import { egFragRecordFault, egFragSteps, egFragHazards, egFragInPoly, egFragCeilAt, egFragPassage, egFragChamber, egEclipseShafts, egHazardLawful,
  EG_FRAGS, EG_FRAG_BUDGET, EG_FRAG_HEADROOM_CM, EG_FRAG_PIECES, EG_HAZARDS, EG_ECLIPSE_RING_M, EG_PLAYS, EG_ENGINES } from '../../src/net/eliteGates/egFragLaw.js';
import { egSpanProof, egRoadCross, egPieceAt, EG_MEDIAN_X, EG_MOON_EVERY_S } from '../../src/net/eliteGates/egSpanLaw.js';
import { EG_HERO_FRAGS, egHeroFragLaws } from '../../src/net/eliteGates/egHeroFrags.js';
import { EG_HERO_FRAG_MESHES, egHeroFragModel, egHeroFragCollider } from '../../src/world/eliteGates/egHeroFragModel.js';
import { EG_DRESS } from '../../src/world/eliteGates/egBandArt.js';
import { EG_BAND_ARCHIVES } from '../../src/world/eliteGates/pseudoArchives.js';

const ROOT = new URL('../../', import.meta.url);
const committed = (rel) => readFileSync(new URL(rel, ROOT));
const json = (rel) => JSON.parse(committed(rel).toString('utf8'));
const HEROES = [
  { name: 'the Gloam Thicket', id: 'egheroGloam', fbx: GLOAM_FBX, write: writeGloamFbx, scene: gloamScene, bake: GLOAM_BAKE },
  { name: 'the Eclipse Vault', id: 'egheroEclipse', fbx: ECLIPSE_FBX, write: writeEclipseFbx, scene: eclipseScene, bake: ECLIPSE_BAKE },
];
/** Each hero as its producer mints it: its scene written again and baked by its own spec - what every rule below reads
 *  (the first test holds the committed halves to these bytes, the second the registries to the committed halves). */
const FRESH = Object.fromEntries(HEROES.map((H) => [H.id, bakeFrag(H.write(), H.bake.SPEC)]));
const LAW = Object.fromEntries(HEROES.map((H) => [H.id, FRESH[H.id].law]));
const MESH = Object.fromEntries(HEROES.map((H) => [H.id, FRESH[H.id].mesh]));

// ── the measures every hero is held to ─────────────────────────────────────────────────────────────────────────────────
/** Distance (cm) from (x, z) to the segment a-b ([x, z]). */
function segDist(x, z, a, b) {
  const dx = b[0] - a[0], dz = b[1] - a[1], L2 = dx * dx + dz * dz, u = L2 ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / L2)) : 0;
  return Math.sqrt((x - a[0] - dx * u) ** 2 + (z - a[1] - dz * u) ** 2);
}
/** Inside polygon `poly` by more than `m` cm. */
const deepIn = (poly, x, z, m) => egFragInPoly(poly, x, z) && poly.every((p, i) => segDist(x, z, p, poly[(i + 1) % poly.length]) > m);
/** A ramp's surface as a plane through its corners (cm): its height over (x, z) - least squares, exact for a planar ramp. */
function rampPlane(q) {
  const S = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], Y = [0, 0, 0];
  for (const [x, y, z] of q.poly) { const r = [x, z, 1]; for (let i = 0; i < 3; i++) { Y[i] += r[i] * y; for (let j = 0; j < 3; j++) S[i][j] += r[i] * r[j]; } }
  const det = (M) => M[0][0] * (M[1][1] * M[2][2] - M[1][2] * M[2][1]) - M[0][1] * (M[1][0] * M[2][2] - M[1][2] * M[2][0]) + M[0][2] * (M[1][0] * M[2][1] - M[1][1] * M[2][0]);
  const D = det(S), k = [0, 1, 2].map((c) => det(S.map((row, i) => row.map((v, j) => (j === c ? Y[i] : v)))) / D);
  return (x, z) => k[0] * x + k[1] * z + k[2];
}
/**
 * THE SPACE THE PROXY LEAVES A BODY (section 11.6: "no drawn vertex lies inside the proxy" - the collider's proxy is the
 * inner envelope, so neither the camera nor the body ever sits inside visible rock): over every floor its polygon (2 cm
 * in) from 2 cm over it to 2 cm under its lowest ceiling (or the inner course's 4.5 m where it is open to the sky); over
 * every ramp its outline from 4 cm over its surface to a passage's headroom; over every inner piece its footprint up 4.5 m,
 * and the gap before it (and after the last) between the two widths. Each volume a test `(x, y, z) => bool` (cm).
 */
function freeSpace(law) {
  const vols = [];
  for (const [i, f] of law.floors.entries()) {
    const c = Math.min(...f.poly.map((p) => egFragCeilAt(law, p[0], p[1], f.y) ?? Infinity));
    const top = c === Infinity ? f.y + EG_FRAG_HEADROOM_CM.course : c - 2;
    vols.push({ what: `floors[${i}]`, inside: (x, y, z) => y > f.y + 2 && y < top && deepIn(f.poly, x, z, 2) });
  }
  for (const [i, q] of law.ramps.entries()) {
    const plane = rampPlane(q), pl = q.poly.map((p) => [p[0], p[2]]);
    vols.push({ what: `ramps[${i}]`, inside: (x, y, z) => { const s = plane(x, z); return y > s + 4 && y < s + EG_FRAG_HEADROOM_CM.passage && deepIn(pl, x, z, 2); } });
  }
  law.course.forEach((c, i) => {
    const x0 = c.x - c.w / 2, x1 = c.x + c.w / 2, z0 = c.z - c.d / 2, z1 = c.z + c.d / 2, prev = law.course[i - 1];
    vols.push({ what: `course[${i}]`, inside: (x, y, z) => x > x0 && x < x1 && z > z0 && z < z1 && y > c.y && y < c.y + EG_FRAG_HEADROOM_CM.course });
    const gx0 = Math.min(x0, prev ? prev.x - prev.w / 2 : x0), gx1 = Math.max(x1, prev ? prev.x + prev.w / 2 : x1), ga = prev ? prev.z + prev.d / 2 : z0 - c.gap;
    const gy0 = Math.min(c.y, prev ? prev.y : c.y), gy1 = Math.max(c.y, prev ? prev.y : c.y);
    vols.push({ what: `the gap before course[${i}]`, inside: (x, y, z) => x > gx0 && x < gx1 && z > ga && z < z0 && y > gy0 && y < gy1 + EG_FRAG_HEADROOM_CM.course });
    if (c.after) vols.push({ what: `the gap after course[${i}]`, inside: (x, y, z) => x > x0 && x < x1 && z > z1 && z < z1 + c.after && y > c.y && y < c.y + EG_FRAG_HEADROOM_CM.course });
  });
  return vols;
}
/** Every drawn vertex (cm) standing in a volume of the free space: `[what, [x, y, z]]`. */
function drawnInside(law, mesh) {
  const vols = freeSpace(law), bad = [];
  for (let i = 0; i < mesh.positions.length; i += 3) {
    const v = [mesh.positions[i] * 100, mesh.positions[i + 1] * 100, mesh.positions[i + 2] * 100];
    for (const vol of vols) if (vol.inside(...v)) bad.push([vol.what, v.map(Math.round)]);
  }
  return bad;
}
/** The edge record's triangles (cm, each [[x, y, z] x 3]). */
function edgeTris(mesh) {
  const sm = mesh.subMeshes.find((s) => s.record === EG_DRESS.edge), P = mesh.positions, out = [];
  for (let t = sm.startIndex; t < sm.startIndex + sm.primitiveCount * 3; t += 3) out.push([0, 1, 2].map((k) => { const v = mesh.indices[t + k]; return [P[v * 3] * 100, P[v * 3 + 1] * 100, P[v * 3 + 2] * 100]; }));
  return out;
}
/** Is (x, z) under an edge-record triangle (in plan, within 1.5 cm) whose height lies in [y - below, y + 6] cm? */
function lined(tris, x, y, z, below = 6) {
  return tris.some((T) => {
    if (!T.every((p) => p[1] >= y - below && p[1] <= y + 6)) return false;
    const d = (a, b) => (b[0] - a[0]) * (z - a[2]) - (b[2] - a[2]) * (x - a[0]);
    const s = [d(T[0], T[1]), d(T[1], T[2]), d(T[2], T[0])];
    return s.every((v) => v >= 0) || s.every((v) => v <= 0) || T.some((p, i) => segDist(x, z, [p[0], p[2]], [T[(i + 1) % 3][0], T[(i + 1) % 3][2]]) < 1.5);
  });
}
/**
 * THE WALKABLE RIMS (section 25.3: "every edge a member could fall from"): each open edge of a floor that does not run on
 * into another floor at its height and does not open onto a ramp (a stair's foot is walked on, not fallen from); and each
 * edge of a ramp past which, a hand out, a floor lies half a metre or more below it - each sampled every 10 cm: `{ at,
 * x, y, z, below }`, `below` how far under the law's surface a drawn stair's tread may lie (its rise).
 */
function walkableRims(law, rise = 0) {
  const out = [], other = (fi, x, z, y) => law.floors.some((g, gi) => gi !== fi && Math.abs(g.y - y) <= 1 && egFragInPoly(g.poly, x, z));
  const onRamp = (x, z) => law.ramps.some((q) => egFragInPoly(q.poly.map((p) => [p[0], p[2]]), x, z));
  for (const [fi, e] of law.open) {
    const f = law.floors[fi], a = f.poly[e], b = f.poly[(e + 1) % f.poly.length], L = Math.sqrt((b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2);
    const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2, ox = mx + ((b[1] - a[1]) / L) * 10, oz = mz - ((b[0] - a[0]) / L) * 10;   // a hand out (the outline winds counter-clockwise: out is its right)
    if (other(fi, ox, oz, f.y) || onRamp(ox, oz)) continue;
    for (let s = 5; s < L - 5; s += 10) out.push({ at: `floors[${fi}] edge ${e}`, x: a[0] + ((b[0] - a[0]) * s) / L, y: f.y, z: a[1] + ((b[1] - a[1]) * s) / L, below: 6 });
  }
  for (const [qi, q] of law.ramps.entries()) {
    const plane = rampPlane(q), n = q.poly.length;
    for (let e = 0; e < n; e++) {
      const a = q.poly[e], b = q.poly[(e + 1) % n], L = Math.sqrt((b[0] - a[0]) ** 2 + (b[2] - a[2]) ** 2);
      for (let s = 5; s < L - 5; s += 10) {
        const x = a[0] + ((b[0] - a[0]) * s) / L, z = a[2] + ((b[2] - a[2]) * s) / L, y = plane(x, z), ox = x + ((b[2] - a[2]) / L) * 10, oz = z - ((b[0] - a[0]) / L) * 10;
        if (law.floors.some((g) => g.y <= y - 50 && egFragInPoly(g.poly, ox, oz))) out.push({ at: `ramps[${qi}] edge ${e}`, x, y, z, below: rise + 1 });
      }
    }
  }
  return out;
}

// ── the tests ──────────────────────────────────────────────────────────────────────────────────────────────────────────
for (const H of HEROES) {
  test(`EG-HERO ${H.name.toUpperCase()}, WRITTEN AND BAKED BYTE FOR BYTE (section 11.6: "each fragment its own bake script and byte-for-byte test"): the scene the port writes is the committed .fbx bit for bit; its bake script's spec bakes it to the committed law half and mesh half bit for bit, and again to the same bytes; each half names its source and its sha256 (mutants: any number of the scene moved; the spec's kit, class, variant or play)`, () => {
    const fbx = committed(H.fbx);
    assert.ok(H.write().equals(fbx), `${H.fbx}: the scene writes the committed file`);
    const { law, mesh } = bakeFrag(fbx, H.bake.SPEC);
    assert.equal(fragJson(law) + fragJson(mesh), fragJson(FRESH[H.id].law) + fragJson(FRESH[H.id].mesh), 'the committed scene bakes as the scene written again does');
    assert.equal(fragJson(law), committed(H.bake.LAW).toString('utf8'), 'the law half');
    assert.equal(fragJson(mesh), committed(H.bake.MESH).toString('utf8'), 'the mesh half');
    const again = bakeFrag(committed(H.fbx), H.bake.SPEC);
    assert.equal(fragJson(again.law) + fragJson(again.mesh), fragJson(law) + fragJson(mesh), 'a re-bake is the same bytes');
    assert.equal(law.bake.source, H.fbx);
    assert.equal(law.bake.sha256, mesh.bake.sha256);
    assert.equal(mesh.bake.writer, 'port');
    assert.equal(H.bake.SPEC.id, H.id);
    assert.ok(Object.isFrozen(H.bake.SPEC));
  });

  test(`EG-HERO ${H.name.toUpperCase()}, READ AND REGISTERED (sections 11.5 and 11.6): the reader accepts its record; its law registered in net/eliteGates/egHeroFrags.js (frozen, the bytes the bake wrote) and laid by halls of its kit (a hero, never the reference); its mesh in world/eliteGates/egHeroFragModel.js beside it, packed under the Shade's archive, its collider the proxy alone (mutants: the hero left out of a registry; its variant the reference's)`, () => {
    const law = LAW[H.id], mesh = MESH[H.id];
    assert.deepEqual(egFragRecordFault(law), []);
    assert.equal(JSON.stringify(EG_HERO_FRAGS[H.id]), JSON.stringify(json(H.bake.LAW)), 'the committed law half, registered');
    assert.ok(Object.isFrozen(EG_HERO_FRAGS[H.id]));
    assert.deepEqual(egHeroFragLaws(law.kit).map((l) => l.id), [H.id], 'its kit lays it');
    assert.notEqual(law.variant, 'reference');
    assert.equal(EG_HERO_FRAG_MESHES[H.id].bake.sha256, law.bake.sha256);
    const model = egHeroFragModel(H.id);
    assert.deepEqual(model.subMeshes.map((s) => [s.textureArchive, s.textureRecord, s.primitiveCount]), mesh.subMeshes.map((s) => [EG_BAND_ARCHIVES[2], s.record, s.primitiveCount]), 'the Shade\'s archive, a sub-mesh a dress record');
    assert.equal(egHeroFragCollider(H.id).length, law.cost.collider * 9);
    assert.equal(mesh.band, 2);
    for (const s of mesh.subMeshes) assert.equal(EG_DRESS[s.material], s.record, 'every face wears the band\'s dress');
  });

  test(`EG-HERO ${H.name.toUpperCase()}, ITS ART (section 11.6): every triangle faces out along its own normals (the mirror's winding kept); the budget (section 11.9 - EG_FRAG_BUDGET: 12,000 drawn triangles, 3,000 collider triangles, 4 lights, 12 draws), its proxy far smaller than its drawn mesh; its box the volume it laid (mutants: a budget's bound; the winding)`, () => {
    const law = LAW[H.id], mesh = MESH[H.id], P = mesh.positions, N = mesh.normals, I = mesh.indices;
    let out = 0;
    for (let t = 0; t < I.length; t += 3) {
      const [a, b, c] = [I[t], I[t + 1], I[t + 2]].map((i) => [P[i * 3], P[i * 3 + 1], P[i * 3 + 2]]);
      const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
      const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
      const vn = [0, 1, 2].map((k) => N[I[t] * 3 + k] + N[I[t + 1] * 3 + k] + N[I[t + 2] * 3 + k]);
      if (n[0] * vn[0] + n[1] * vn[1] + n[2] * vn[2] > 0) out++;
    }
    assert.equal(out, I.length / 3, 'every triangle faces out along its normals');
    for (const [k, max] of Object.entries(EG_FRAG_BUDGET)) assert.ok(law.cost[k] <= max, `cost.${k} ${law.cost[k]} within ${max}`);
    assert.equal(law.cost.tris, I.length / 3);
    assert.equal(law.cost.draws, mesh.subMeshes.length);
    assert.equal(law.cost.collider, mesh.collider.length / 9);
    assert.ok(law.cost.tris >= 4000, 'a showpiece - finer than the code-built kit');
    assert.ok(law.cost.collider * 20 < law.cost.tris, 'the proxy, never the drawn mesh');
  });

  test(`EG-HERO ${H.name.toUpperCase()}, THE EDGE LINE ON EVERY WALKABLE RIM (section 25.3: "every edge a member could fall from ... carries a gold line"; section 11.1: "a handsome platform never lies about where it ends"): every open edge of its floors that drops - and every stair's side over the floor below - carries the edge record along its whole length, at its height (a drawn stair's treads at most a rise below its slope) (mutants: an edge line dropped)`, () => {
    const law = LAW[H.id], tris = edgeTris(MESH[H.id]), rise = H.id === 'egheroEclipse' ? ECLIPSE.up / 14 * 100 : 0;
    const rims = walkableRims(law, rise);
    assert.ok(rims.length > 100, 'its rims sampled');
    const bare = rims.filter((p) => !lined(tris, p.x, p.y, p.z, p.below));
    assert.deepEqual(bare.slice(0, 5).map((p) => `${p.at} at ${Math.round(p.x)}, ${Math.round(p.y)}, ${Math.round(p.z)}`), [], 'an unlined rim');
  });

  test(`EG-HERO ${H.name.toUpperCase()}, NO DRAWN VERTEX INSIDE THE PROXY (section 11.6: "neither the camera nor the body ever sits inside visible rock"): no vertex of its art stands in the space its floors, ramps and inner course leave a body - its walls pushed OUTWARD, its trunks, columns and engines outside its floors' outlines, its vaults over its ceilings (mutants: a piece of the art moved onto a floor)`, () => {
    assert.deepEqual(drawnInside(LAW[H.id], MESH[H.id]).slice(0, 5), []);
  });
}

test('EG-HERO THE GLOAM THICKET\'S ENVELOPE AND LAW (net/eliteGates/egFragLaw.js egFragPassage(\'gloam\'); sections 11.2, 11.5 and 11.8): a passage of the Gloam kit, band 2, the Quarry\'s reverb; its mouth the kit\'s 7 m by 6.5 m on the course\'s line, its one exit at the kit\'s 28 m on the floor\'s height; open to the moon (no ceiling); two fight floors, its landings, open at the mouth, the lips and the exit; its walk graph on the landings, never across the chasm; Lurkers, a Caster, the Battlemage\'s niche and the Moon-Mirror\'s engine; a seam alcove; three moonlights; no hazard - its signature is its course (mutants: the envelope\'s numbers; an edge across the chasm)', () => {
  const law = LAW.egheroGloam, kit = egFragPassage('gloam', () => 0);
  assert.deepEqual([law.kit, law.band, law.class, law.variant, law.play, law.reverb], ['gloam', 2, 'passage', 'gloam', [], EG_FRAGS.gloam.reverb]);
  assert.deepEqual(law.sockets, { in: { x: 0, y: 0, z: 0, yaw: 180, w: 2 * kit.halfW, h: kit.height }, out: [{ x: 0, y: kit.yB, z: kit.len, yaw: 0, w: 2 * kit.halfW, h: kit.height }] });
  assert.deepEqual([GLOAM.len * 100, GLOAM.halfW * 100, GLOAM.height * 100], [kit.len, kit.halfW, kit.height], 'the code-built passage\'s length, half-width and height');
  assert.equal(law.ceil, null, 'open to the moon, as the kit\'s Thicket is (world/eliteGates/egHall.js: no vault over the Gloam)');
  assert.deepEqual(law.floors.map((f) => [f.y, f.fight]), [[0, 1], [0, 1]]);
  assert.deepEqual(law.open, [[0, 4], [0, 8], [1, 3], [1, 8]], 'each landing\'s lip and its mouth or exit (the far landing first, by its marker\'s name)');
  assert.deepEqual(law.box.slice(2, 3).concat(law.box.slice(5)), [-5, 2800], 'the mouth the box\'s -Z face, the exit its +Z face');
  assert.ok(law.box[0] >= -700 && law.box[3] <= 700, 'no wider than 14 m - a Low Road\'s passage 15 m from the High Road keeps its 2 m');
  // the walk graph: each edge on one landing (the legion walks, it does not jump)
  const side = (n) => (law.graph.nodes[n][2] < GLOAM.lipNear * 100 ? 'near' : 'far');
  assert.equal(law.graph.nodes.length, 8);
  for (const [a, b] of law.graph.edges) assert.equal(side(a), side(b), `edge ${a}-${b} crosses the chasm`);
  assert.deepEqual(Object.fromEntries(Object.entries(law.anchors).map(([k, v]) => [k, v.length])), { rift: 0, caster: 1, lurker: 2, niche: 1, engine: 1, hazard: 0 });
  assert.equal(EG_FRAGS.gloam.engine, 'mirror');
  assert.deepEqual(law.alcoves.map((a) => [a.seal, a.holds, a.side]), [['seam', 'shard', -1]]);
  assert.deepEqual(law.lights.map((l) => l[3]), ['moon', 'moon', 'moon'], 'moonbeams the only light');
  assert.deepEqual(law.hazards, []);
});

test('EG-HERO THE GLOAM THICKET\'S MOON-BOUND BRANCHES (sections 10.5 and 11.2 - "solid only while a moving moonbeam lies on it"): four Moon branches, the kit\'s only piece (EG_FRAG_PIECES.gloam), alternating sides, the beams walking from the near lip (the kit\'s `beat`) every EG_MOON_EVERY_S on the scene\'s phase; THE TIMED SOLVER proves the course alone - every window, no queue, THE MEDIAN within 1.6 x the fastest - and the record\'s proof is its answer; each branch solid and gone on the beams\' clock (mutants: a branch moved past the solver; the proof\'s bounds; a beam\'s origin)', () => {
  const law = LAW.egheroGloam, kit = egFragPassage('gloam', () => 0);
  assert.deepEqual(law.course.map((c) => c.kind), ['moon', 'moon', 'moon', 'moon']);
  assert.ok(law.course.every((c) => EG_FRAG_PIECES.gloam.includes(c.kind)));
  assert.deepEqual(law.course.map((c) => [c.x, c.y, c.z, c.w, c.d, c.gap]), GLOAM_BRANCHES.map((b, i) => [Math.round(b.x * 100), Math.round(b.top * 100), Math.round(((b.y0 + b.y1) / 2) * 100), Math.round(b.w * 100), Math.round((b.y1 - b.y0) * 100), Math.round((b.y0 - (i ? GLOAM_BRANCHES[i - 1].y1 : GLOAM.lipNear)) * 100)]));
  assert.deepEqual(law.course.map((c) => Math.sign(c.x)), [-1, 1, -1, 1], 'boughs off alternate sides');
  assert.ok(law.course.every((c) => c.period === EG_MOON_EVERY_S * 1000 && c.phase === GLOAM_MOON.ph && c.beat === GLOAM_MOON.beat));
  assert.equal(GLOAM_MOON.beat, GLOAM.lipNear * 100);
  assert.equal(kit.course[0].beat, kit.zA, 'the kit\'s beams start at its chasm\'s near lip too');
  assert.equal(law.course[3].after, Math.round((GLOAM.lipFar - GLOAM_BRANCHES[3].y1) * 100), 'the far landing after the last');
  const steps = egFragSteps(law), P = egSpanProof({ steps });
  assert.deepEqual(P, { ok: true, why: [] });
  const c = egRoadCross({ steps }, 0);
  assert.deepEqual(law.proof, { crossFast: Math.round(c.fast * 1000), crossSlow: Math.round(c.median * 1000), moves: c.n });
  assert.deepEqual(law.proof, { crossFast: 3681, crossSlow: 5081, moves: 5 });
  assert.ok(law.proof.crossSlow <= EG_MEDIAN_X * law.proof.crossFast);
  // the beams: a branch solid while a beam's 7 m lies on it, gone in the 3 m between
  const solid = Array.from({ length: 40 }, (_, k) => egPieceAt(steps[0], k / 10).solid);
  assert.equal(solid.filter(Boolean).length, 28, 'solid 2.8 s of every 4');
});

test('EG-HERO THE ECLIPSE VAULT\'S ENVELOPE AND LAW (net/eliteGates/egFragLaw.js egFragChamber(\'eclipse\', r, R) as net/eliteGates/egLaw.js\'s Deepway lays it, R = 16 m; sections 11.4, 11.5 and 11.8): a chamber of the Eclipse kit, band 2, the Stoneroom\'s reverb, its play a second fight floor on two stairs and the Moon-Mirror\'s engine; its fight floor the court\'s disc of 16 m, its middle 20 m in (edge + 400 + R), the mouth and the exit on the course\'s line 40 m apart; two galleries 3.5 m up (the balcony play\'s 3-4 m), each on its stair; the vault\'s ceiling 10 m and the gatehouses\' 7 m (a chamber\'s 6 m over every floor); four rifts in the walls, Lurkers, a Caster on each gallery, the niche and the engine; the walk graph up both stairs (mutants: the envelope\'s numbers; a gallery\'s height; a stair left off the graph)', () => {
  const law = LAW.egheroEclipse, R = ECLIPSE.R * 100, cz = ECLIPSE.cy * 100;
  assert.deepEqual([law.kit, law.band, law.class, law.variant, law.reverb], ['eclipse', 2, 'chamber', 'eclipse', EG_FRAGS.eclipse.reverb]);
  assert.deepEqual(law.play, ['balcony', 'engine']);
  assert.ok(law.play.every((p) => EG_PLAYS.includes(p)) && EG_FRAGS.eclipse.engine === 'mirror' && EG_ENGINES.mirror);
  assert.equal(cz, 400 + R, 'the court\'s middle where net/eliteGates/egLaw.js puts it, 4 m past the slot\'s start');
  assert.deepEqual(law.sockets, { in: { x: 0, y: 0, z: 0, yaw: 180, w: 600, h: 700 }, out: [{ x: 0, y: 0, z: ECLIPSE.len * 100, yaw: 0, w: 600, h: 700 }] });
  assert.deepEqual(law.box.slice(2, 3).concat(law.box.slice(5)), [-5, 4005]);
  // the code-built chamber the hero stands in for: a disc of R, its play and its Eclipse the kit's
  const kit = egFragChamber('eclipse', () => 0, R, { play: 'engine' });
  assert.deepEqual([kit.play, kit.engine.kind, kit.hazards[0].kind, kit.hazards[0].ring], ['engine', 'mirror', 'eclipse', EG_ECLIPSE_RING_M * 100]);
  // the fight floors: the court's disc (its 24 corners on the 16 m circle but where the gatehouses' and the stairs' chords
  // cut it) and the two galleries 3.5 m up; the thresholds traversal
  const vault = law.floors.find((f) => f.fight && f.y === 0), galleries = law.floors.filter((f) => f.fight && f.y > 0), trav = law.floors.filter((f) => !f.fight);
  assert.equal(vault.poly.length, 24);
  const radii = vault.poly.map(([x, z]) => Math.sqrt(x * x + (z - cz) ** 2));
  assert.equal(radii.filter((r) => Math.abs(r - R) <= 1).length, 20, 'twenty corners on the court\'s circle');
  assert.ok(radii.every((r) => r <= R + 1));
  assert.deepEqual(galleries.map((f) => f.y), [350, 350]);
  assert.deepEqual(trav.map((f) => [f.y, Math.min(...f.poly.map((p) => p[1])), Math.max(...f.poly.map((p) => p[1]))]), [[0, 3561, 4000], [0, 0, 440]], 'the exit\'s threshold and the mouth\'s (the gatehouses\' chords 4.395 m in from either end, each a half away from nought)');
  assert.equal(law.ramps.length, 2);
  for (const q of law.ramps) assert.deepEqual([q.y0, q.y1], [0, 350]);
  assert.deepEqual(law.ceil.map((c) => c.y).sort((a, b) => a - b), [700, 700, 1000]);
  for (const f of law.floors) for (const p of f.poly) assert.ok(egFragCeilAt(law, p[0], p[1], f.y) - f.y >= EG_FRAG_HEADROOM_CM.chamber, 'a chamber\'s 6 m');
  assert.deepEqual(Object.fromEntries(Object.entries(law.anchors).map(([k, v]) => [k, v.length])), { rift: 4, caster: 2, lurker: 2, niche: 1, engine: 1, hazard: 0 });
  for (const r of law.anchors.rift) assert.ok(Math.abs(Math.sqrt(r[0] ** 2 + (r[2] - cz) ** 2) - R) < 60, 'rifts set in the walls');
  assert.ok(law.anchors.caster.every((c) => c[1] === 350), 'Casters on the galleries');
  assert.deepEqual(law.alcoves.map((a) => [a.seal, a.holds]), [['seam', 'page']]);
  assert.deepEqual(law.lights.map((l) => l[3]).sort(), ['band', 'moon', 'moon', 'moon']);
  // the graph reaches both galleries over the stairs: every node joined to every other
  const N = law.graph.nodes.length, adj = Array.from({ length: N }, () => []);
  for (const [a, b] of law.graph.edges) { adj[a].push(b); adj[b].push(a); }
  const seen = new Set([0]), todo = [0];
  while (todo.length) for (const n of adj[todo.pop()]) if (!seen.has(n)) { seen.add(n); todo.push(n); }
  assert.equal(seen.size, N, 'one walk graph');
  assert.equal(law.graph.nodes.filter((n) => n[1] === 350).length, 2, 'a node on each gallery');
  assert.equal(law.graph.nodes.filter((n) => n[1] > 0 && n[1] < 350).length, 4, 'two on each stair');
});

test('EG-HERO THE ECLIPSE (section 11.2: "every 40 s, everyone outside the moon-shafts takes 30%. The shafts (r 3, walking at a fixed 1.5 m/s) are havens ... from 6 s out; the nearest is never more than 20 m away"): the Vault\'s one hazard, in its kind\'s shape - the moon-shafts\' ring a disc of EG_ECLIPSE_RING_M about the fight floor\'s middle - and lawful; at every moment of its cycle, from every point of every floor, ramp and gallery, the nearest haven\'s edge lies within 20 m; the shafts walk under the dome\'s open slot (mutants: the ring\'s size or middle; the 20 m law)', () => {
  const law = LAW.egheroEclipse, [hz] = law.hazards, cz = ECLIPSE.cy * 100;
  assert.equal(law.hazards.length, 1);
  assert.deepEqual([hz.kind, hz.x, hz.z, hz.ring, hz.y, hz.period, hz.phase], ['eclipse', 0, cz, EG_ECLIPSE_RING_M * 100, 0, 0, 12000]);
  const [laid] = egFragHazards(law);
  assert.ok(egHazardLawful(laid).ok);
  assert.ok(ECLIPSE.slot0 * 100 < hz.ring && hz.ring < ECLIPSE.slot1 * 100, 'the moon-slot over the ring the shafts walk');
  // the 20 m law, swept: the floors' points every metre, the havens every 2 s of the 40 s cycle
  const pts = [];
  for (const f of law.floors) { const xs = f.poly.map((p) => p[0]), zs = f.poly.map((p) => p[1]); for (let x = Math.min(...xs); x <= Math.max(...xs); x += 100) for (let z = Math.min(...zs); z <= Math.max(...zs); z += 100) if (egFragInPoly(f.poly, x, z)) pts.push([x / 100, z / 100]); }
  for (const q of law.ramps) for (const p of q.poly) pts.push([p[0] / 100, p[2] / 100]);
  assert.ok(pts.length > 800);
  let worst = 0;
  for (let t = 0; t < EG_HAZARDS.eclipse.period / 1000; t += 2) {
    const hv = egEclipseShafts(laid, t);
    for (const [x, z] of pts) worst = Math.max(worst, Math.min(...hv.map(([hx, hz2]) => Math.sqrt((x - hx) ** 2 + (z - hz2) ** 2))) - EG_HAZARDS.eclipse.r);
  }
  assert.ok(worst <= 20, `the nearest haven ${worst.toFixed(1)} m away at worst`);
  assert.ok(worst > 12, 'the sweep reached the galleries and the gates');
});

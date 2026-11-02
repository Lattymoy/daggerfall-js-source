// EG-HERO (the Soul Cairn, 2026-10-13, the owner: "You have to author the fragments"; bible/11-Multiplayer/Elite-Gates.md
// sections 10.4-10.5, 11.2, 11.5-11.9 and 25.3, and the EG-HERO (the Soul Cairn) record) - THE OSSUARY AND THE MIST STAIR,
// the Cairn's hero fragments, written by the port in code (tools/egHeroOssuaryScene.mjs, tools/egHeroMistStairScene.mjs on
// tools/egHeroKit.mjs) and baked through the one bake (tools/fragBake.mjs - tools/bakeEgHeroOssuary.mjs,
// tools/bakeEgHeroMistStair.mjs). Each: its scene the committed .fbx byte for byte; its bake the committed halves byte for
// byte, and again; its law read sound and registered; its envelope the code-built kit's (net/eliteGates/egFragLaw.js egFragPassage,
// egFragShaft), so a hall can lay it where it lays that one; THE TIMED SOLVER's proof; the budget; THE EDGE LINE on every
// walkable rim; and no drawn vertex inside its collider's proxy, nothing drawn where a body walks or flies, its headroom
// measured on the drawn mesh. The law and the geometry are read off the LIVE scene's bake, so a scene that breaks a law
// fails here by name, not only by its bytes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { bakeFrag, fragJson } from '../../tools/fragBake.mjs';
import { writeOssuaryFbx, OSSUARY_FBX, OSSUARY, OSSUARY_CROWN } from '../../tools/egHeroOssuaryScene.mjs';
import { writeMistStairFbx, MIST_STAIR_FBX, MIST_STAIR } from '../../tools/egHeroMistStairScene.mjs';
import { SPEC as OSS_SPEC, LAW as OSS_LAW, MESH as OSS_MESH } from '../../tools/bakeEgHeroOssuary.mjs';
import { SPEC as MIST_SPEC, LAW as MIST_LAW, MESH as MIST_MESH } from '../../tools/bakeEgHeroMistStair.mjs';
import { cuts, walkStrip, faceTo, mirrorX } from '../../tools/egHeroKit.mjs';
import { refFragMesh } from '../../tools/egRefFragScene.mjs';
import {
  egFragRecordFault, egFragSteps, egFragSwept, egFragCeilAt, egFragInPoly, egFragPassage, egFragShaft, EG_FRAGS, EG_FRAG_PIECES, EG_SHAFT_PIECES,
  EG_FRAG_BUDGET, EG_FRAG_HEADROOM_CM, EG_SHAFT_FLIGHT_CM, EG_SHAFT_DROP_CM, EG_SHAFT_RIM_CM, EG_SHAFT_FOOT_CM, EG_SHAFT_HEIGHT_CM,
} from '../../src/net/eliteGates/egFragLaw.js';
import { egSpanProof, egRoadCross, EG_SHAFT_MAX_S, EG_SPAN_RUN_MPS, EG_CRUMBLE_DELAY_S, EG_CRUMBLE_SLACK_S } from '../../src/net/eliteGates/egSpanLaw.js';
import { EG_HERO_FRAGS, egHeroFragLaws } from '../../src/net/eliteGates/egHeroFrags.js';
import { EG_HERO_FRAG_MESHES, egHeroFragCollider } from '../../src/world/eliteGates/egHeroFragModel.js';
import { EG_DRESS } from '../../src/world/eliteGates/egBandArt.js';

const ROOT = new URL('../../', import.meta.url);
const committed = (rel) => readFileSync(new URL(rel, ROOT));
/** Each fragment: its scene's writer, its committed source, its spec and halves - and its live bake. */
const FRAGS = [
  { name: 'the Ossuary', write: writeOssuaryFbx, fbx: OSSUARY_FBX, spec: OSS_SPEC, law: OSS_LAW, mesh: OSS_MESH },
  { name: 'the Mist Stair', write: writeMistStairFbx, fbx: MIST_STAIR_FBX, spec: MIST_SPEC, law: MIST_LAW, mesh: MIST_MESH },
];
const live = new Map();
/** The live scene, baked (once a fragment). */
function baked(f) {
  if (!live.has(f.spec.id)) live.set(f.spec.id, bakeFrag(f.write(), f.spec));
  return live.get(f.spec.id);
}
const OSS = FRAGS[0], MIST = FRAGS[1];

// ── geometry, metres, the fragment's frame (x across, y up, z along the course) ──────────────────────────────────────────
/** A mesh half's triangles, `[[a, b, c], ...]`, from its positions and indices (the collider's when `collider`). */
function trianglesOf(mesh, records = null) {
  const out = [], P = mesh.positions, at = (i) => [P[i * 3], P[i * 3 + 1], P[i * 3 + 2]];
  for (const s of mesh.subMeshes) {
    if (records && !records.includes(s.record)) continue;
    for (let t = 0; t < s.primitiveCount; t++) { const k = s.startIndex + t * 3; out.push([at(mesh.indices[k]), at(mesh.indices[k + 1]), at(mesh.indices[k + 2])]); }
  }
  return out;
}
function colliderOf(mesh) {
  const c = mesh.collider, out = [];
  for (let i = 0; i < c.length; i += 9) out.push([[c[i], c[i + 1], c[i + 2]], [c[i + 3], c[i + 4], c[i + 5]], [c[i + 6], c[i + 7], c[i + 8]]]);
  return out;
}
/** Where an axis ray from `p` along axis `k` (0 x, 1 y, 2 z) meets triangle `t` - its distance (signed along the axis), or
 *  null where the ray misses it. */
function axisHit(t, p, k) {
  const u = (k + 1) % 3, v = (k + 2) % 3, [a, b, c] = t;
  const d = (b[u] - a[u]) * (c[v] - a[v]) - (c[u] - a[u]) * (b[v] - a[v]);
  if (Math.abs(d) < 1e-12) return null;
  const l1 = ((p[u] - a[u]) * (c[v] - a[v]) - (c[u] - a[u]) * (p[v] - a[v])) / d, l2 = ((b[u] - a[u]) * (p[v] - a[v]) - (p[u] - a[u]) * (b[v] - a[v])) / d;
  if (l1 < -1e-9 || l2 < -1e-9 || l1 + l2 > 1 + 1e-9) return null;
  return a[k] + l1 * (b[k] - a[k]) + l2 * (c[k] - a[k]) - p[k];
}
/** Does ray from `p` along axis `k` in direction `dir` meet any of `tris` further than `eps`? */
const rayMeets = (tris, p, k, dir, eps = 0.02) => tris.some((t) => { const h = axisHit(t, p, k); return h !== null && h * dir > eps; });
/** INSIDE THE PROXY: walled on both sides (x), floored below and roofed above (y), each by a proxy face more than 2 cm off -
 *  the walk the proxy bounds (a chasm or a pit, floored by none, bounds no walk). */
const insideProxy = (proxy, p) => rayMeets(proxy, p, 1, 1) && rayMeets(proxy, p, 1, -1) && rayMeets(proxy, p, 0, 1) && rayMeets(proxy, p, 0, -1);
/** The lowest drawn surface over `p` (metres above it), or Infinity. */
function headroom(tris, p) {
  let best = Infinity;
  for (const t of tris) { const h = axisHit(t, p, 1); if (h !== null && h > 0.05 && h < best) best = h; }
  return best;
}
/** THE WALK (the law's, metres): each floor's prism to its ceiling (or a passage's headroom where open), each inner piece's
 *  top to THE FAST BUILD's 4.5 m over it, and each gap's flight between them (its two widths, a capsule's 0.35 m either side) -
 *  `[{ at, x0, x1, y0, y1, z0, z1, poly }]`, a point inside one strictly (2 cm) is where a body goes. */
function walkOf(law) {
  const out = [], R = 0.35, H = EG_FRAG_HEADROOM_CM.course / 100;
  law.floors.forEach((f, i) => {
    const xs = f.poly.map((p) => p[0] / 100), zs = f.poly.map((p) => p[1] / 100);
    out.push({ at: `floors[${i}]`, poly: f.poly, y0: f.y / 100, x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs), ceil: (x, z) => (egFragCeilAt(law, x * 100, z * 100, f.y) ?? f.y + EG_FRAG_HEADROOM_CM.passage) / 100 });
  });
  law.course.forEach((c, i) => {
    const s = egFragSwept(c).map((v) => v / 100), top = c.y / 100;
    out.push({ at: `course[${i}] (${c.kind})`, x0: s[0] - R, x1: s[3] + R, y0: top, y1: top + H, z0: s[2], z1: s[5] });
    const prev = law.course[i - 1], near = (c.z - c.d / 2 - c.gap) / 100, w = (q) => [(q.x - q.w / 2) / 100 - R, (q.x + q.w / 2) / 100 + R];
    const [a0, a1] = prev ? w(prev) : w(c), [b0, b1] = w(c), ya = prev ? prev.y / 100 : top;
    out.push({ at: `the gap before course[${i}]`, x0: Math.min(a0, b0), x1: Math.max(a1, b1), y0: Math.min(ya, top), y1: Math.max(ya, top) + H, z0: near, z1: (c.z - c.d / 2) / 100 });
    if (c.after > 0) out.push({ at: `the gap after course[${i}]`, x0: b0, x1: b1, y0: top, y1: top + H, z0: (c.z + c.d / 2) / 100, z1: (c.z + c.d / 2 + c.after) / 100 });
  });
  return out;
}
/** Is `p` strictly inside volume `v` (2 cm in from every face)? */
function inWalk(v, p) {
  const e = 0.02, [x, y, z] = p;
  if (!(x > v.x0 + e && x < v.x1 - e && z > v.z0 + e && z < v.z1 - e && y > v.y0 + e)) return false;
  if (!v.poly) return y < v.y1 - e;
  if (!egFragInPoly(v.poly, x * 100, z * 100)) return false;
  return y < v.ceil(x, z) - e;
}

test('EG-HERO (the Soul Cairn) WRITTEN AND BAKED BYTE FOR BYTE (section 11.6: "each fragment its own bake script and byte-for-byte test"): each scene the port writes is its committed .fbx bit for bit; its bake script\'s spec bakes it to the committed law half and mesh half bit for bit, and again to the same bytes; each half names its source and its sha256 (mutants: any of the scene\'s numbers moved; the spec\'s)', () => {
  for (const f of FRAGS) {
    const fbx = committed(f.fbx);
    assert.ok(f.write().equals(fbx), `${f.name}: the scene writes the committed .fbx`);
    const { law, mesh } = bakeFrag(fbx, f.spec);
    assert.equal(fragJson(law), committed(f.law).toString('utf8'), `${f.name}: the law half`);
    assert.equal(fragJson(mesh), committed(f.mesh).toString('utf8'), `${f.name}: the mesh half`);
    const again = bakeFrag(committed(f.fbx), f.spec);
    assert.equal(fragJson(again.law) + fragJson(again.mesh), fragJson(law) + fragJson(mesh), `${f.name}: a re-bake is the same bytes`);
    assert.equal(law.bake.source, f.fbx);
    assert.equal(law.bake.sha256, mesh.bake.sha256);
    assert.equal(mesh.bake.writer, 'port', 'written by the port, not a Blender');
  }
});

test('EG-HERO (the Soul Cairn) READ AND REGISTERED (section 11.5; net/eliteGates/egHeroFrags.js, world/eliteGates/egHeroFragModel.js): each law half sound to its reader, of its kit, band, class and reverb, a hero of its own (never the reference), registered and frozen, laid by its kit\'s halls (egHeroFragLaws); its mesh beside it of the same bake, its collider the proxy (mutants: a registry left without it; the variant the reference\'s; the class another)', () => {
  const want = { egheroOssuary: ['ossuary', 1, 'passage', 'ossuary', 'stoneroom'], egheroMistStair: ['mist', 1, 'shaft', 'mist-stair', 'cave'] };
  for (const f of FRAGS) {
    const { law } = baked(f);
    assert.deepEqual(egFragRecordFault(law), [], `${f.name}: the reader finds no fault`);
    assert.deepEqual([law.kit, law.band, law.class, law.variant, law.reverb], want[law.id]);
    assert.equal(law.reverb, EG_FRAGS[law.kit].reverb);
    assert.deepEqual(law.play, [], 'a passage and a shaft name no play');
    assert.ok(Object.isFrozen(EG_HERO_FRAGS[law.id]), `${f.name}: registered, frozen`);
    assert.equal(JSON.stringify(EG_HERO_FRAGS[law.id]), JSON.stringify(JSON.parse(committed(f.law).toString('utf8'))));
    assert.ok(egHeroFragLaws(law.kit).some((l) => l.id === law.id), `${f.name}: a hall of its kit may lay it`);
    const mesh = EG_HERO_FRAG_MESHES[law.id];
    assert.equal(mesh.bake.sha256, law.bake.sha256, `${f.name}: its mesh half beside its own bake`);
    assert.equal(egHeroFragCollider(law.id).length, law.cost.collider * 9, 'the collider the proxy alone');
  }
  assert.deepEqual(egHeroFragLaws('ossuary').map((l) => l.id), ['egheroOssuary']);
  assert.deepEqual(egHeroFragLaws('mist').map((l) => l.id), ['egheroMistStair']);
});

test('EG-HERO THE OSSUARY\'S ENVELOPE (net/eliteGates/egFragLaw.js egFragPassage(\'ossuary\') - laid where the code-built passage is): 6 m across and 28 m long, its mouth and its one exit 6 m by the kit\'s 5.6 m at the floor\'s height, its fight floors to the chasm\'s lips (zA, zB), each wholly under the kit\'s 5.6 m, the chasm crossed on three bone bridges (the kit\'s own piece, the Crumble\'s law - each crossed inside its delay), its two soul-wisps the kit\'s own clocks over its fight floors; every number the law\'s (mutants: the kit\'s numbers moved; a bridge too deep for the Crumble)', () => {
  const { law } = baked(OSS), P = egFragPassage('ossuary', () => 0.5);
  const box = (poly) => { const xs = poly.map((p) => p[0]), zs = poly.map((p) => p[1]); return [Math.min(...xs), Math.min(...zs), Math.max(...xs), Math.max(...zs)]; };
  assert.deepEqual(law.sockets, { in: { x: 0, y: 0, z: 0, yaw: 180, w: 2 * P.halfW, h: P.height }, out: [{ x: 0, y: P.yB, z: P.len, yaw: 0, w: 2 * P.halfW, h: P.height }] });
  assert.deepEqual(law.floors.map((f) => [f.y, f.fight, ...box(f.poly)]), [[0, 1, -P.halfW, P.zB, P.halfW, P.len], [0, 1, -P.halfW, 0, P.halfW, P.zA]]);
  assert.deepEqual(law.ceil.map((c) => c.y), [P.height, P.height]);
  assert.deepEqual(law.open, [[0, 1], [0, 3], [1, 1], [1, 3]], 'the far floor\'s lip and exit, the near floor\'s mouth and lip - the walls stay walls');
  assert.deepEqual(law.course.map((c) => c.kind), P.course.map((c) => c.k));
  assert.ok(law.course.every((c) => EG_FRAG_PIECES.ossuary.includes(c.kind)));
  assert.deepEqual(law.course.map((c) => [c.x, c.y, c.z, c.w, c.d, c.gap, c.after]), [[0, 0, 1090, 260, 240, 70, 0], [0, 0, 1400, 260, 240, 70, 0], [0, 0, 1710, 260, 240, 70, 70]]);
  assert.equal(law.course[0].z - law.course[0].d / 2 - law.course[0].gap, P.zA, 'the bridges leave from the near lip');
  assert.equal(law.course[2].z + law.course[2].d / 2 + law.course[2].after, P.zB, 'and land on the far one');
  for (const c of law.course) assert.ok(c.d / 100 / EG_SPAN_RUN_MPS + EG_CRUMBLE_SLACK_S <= EG_CRUMBLE_DELAY_S, 'a bone bridge crossed before it falls');
  assert.deepEqual(law.hazards.map((h) => [h.kind, h.period, h.y, h.path]), [['wisp', 11000, 120, [0, 2350, 200, 300]], ['wisp', 9000, 120, [0, 450, 200, 300]]]);
  assert.deepEqual(law.hazards.map((h) => h.period).sort(), P.hazards.map((h) => h.period).sort(), 'the kit\'s two clocks');
  for (const h of law.hazards) assert.ok(law.floors.some((f) => f.fight && egFragInPoly(f.poly, h.path[0], h.path[1]) && egFragInPoly(f.poly, h.path[0] + h.path[2], h.path[1] + h.path[3]) && egFragInPoly(f.poly, h.path[0] - h.path[2], h.path[1] - h.path[3])), 'a wisp drifts over a fight floor (it tethers only there)');
  assert.deepEqual(law.anchors, { rift: [], caster: [[240, 0, 2545], [-240, 0, 2155], [240, 0, 255], [-240, 0, 645]], lurker: [[-250, 0, 2730], [250, 0, 810]], niche: [[-240, 0, 255]], engine: [[230, 0, 2155]], hazard: [[0, 90, 2350], [0, 90, 450]] });
  assert.ok(EG_FRAGS.ossuary.engine === 'soulbell' && law.anchors.engine.length === 1, 'the soul-bell, the kit\'s engine');
  assert.deepEqual(law.alcoves, [{ x: -380, y: 90, z: 2545, seal: 'seam', side: -1, holds: 'page' }]);
  assert.deepEqual(law.lights, [[0, -310, 1400, 'band'], [0, 470, 2350, 'band'], [0, 470, 450, 'band']]);
  assert.deepEqual(law.box, [-635, -1520, 0, 635, 970, 2800], 'the block\'s root to the ribcage\'s crown, the mouth to the exit');
  assert.deepEqual([OSSUARY.LEN * 100, OSSUARY.ZA * 100, OSSUARY.ZB * 100, OSSUARY.CEIL * 100, OSSUARY.W * 100], [P.len, P.zA, P.zB, P.height, P.halfW]);
  assert.ok(OSSUARY_CROWN > OSSUARY.SPRING && OSSUARY.SPRING > OSSUARY.CEIL);
});

test('EG-HERO THE MIST STAIR\'S ENVELOPE (net/eliteGates/egFragLaw.js egFragShaft(\'mist\') - laid where the code-built shaft is): 8 m across, its rim EG_SHAFT_RIM_CM deep under EG_SHAFT_HEIGHT_CM, its flights each EG_SHAFT_FLIGHT_CM under the last and 2.4-2.8 m apart (the kit\'s gaps), three or four of them, a Drop inside EG_SHAFT_DROP_CM onto its 6 m landing, its foot EG_SHAFT_FOOT_CM long at the landing\'s height, the mist 3 m under the foot, its floors traversal ground (a shaft\'s blows land on none), every number the law\'s (mutants: the kit\'s numbers moved; a flight past THE ENVELOPE\'s step down)', () => {
  const { law } = baked(MIST), S = egFragShaft('mist', () => 0.5), yB = law.course[law.course.length - 1].y;
  assert.deepEqual(law.sockets, { in: { x: 0, y: 0, z: 0, yaw: 180, w: 2 * S.halfW, h: EG_SHAFT_HEIGHT_CM }, out: [{ x: 0, y: yB, z: 3300, yaw: 0, w: 2 * S.halfW, h: 460 }] });
  assert.deepEqual(law.floors.map((f) => [f.y, f.fight, f.poly]), [[yB, 0, [[400, 3000], [400, 3300], [-400, 3300], [-400, 3000]]], [0, 0, [[400, 0], [400, EG_SHAFT_RIM_CM], [-400, EG_SHAFT_RIM_CM], [-400, 0]]]]);
  assert.equal(law.sockets.out[0].z - (law.course[law.course.length - 1].z + 300), EG_SHAFT_FOOT_CM, 'the foot the kit\'s length past the landing');
  assert.deepEqual(law.ceil.map((c) => c.y - (c.y > 0 ? 0 : yB)), [460, EG_SHAFT_HEIGHT_CM], 'the foot\'s tunnel 4.6 m (the fast build\'s 4.5 m over the landing it touches), the rim\'s vault the kit\'s height');
  const ledges = law.course.filter((c) => c.kind === 'ledge'), drop = law.course[law.course.length - 1];
  assert.ok(law.course.every((c) => EG_SHAFT_PIECES.mist.includes(c.kind)) && drop.kind === 'drop');
  assert.ok(ledges.length >= 3 && ledges.length <= 4, 'three or four flights');
  ledges.forEach((c, i) => assert.equal((i ? ledges[i - 1].y : 0) - c.y, EG_SHAFT_FLIGHT_CM, `flight ${i}: a step down under a metre`));
  for (const c of law.course) assert.ok(c.gap >= 240 && c.gap <= 280, 'the kit\'s gaps');
  assert.ok(ledges.every((c, i) => c.x === (i % 2 ? 150 : -150)), 'the flights swing side to side');
  const fall = ledges[ledges.length - 1].y - drop.y;
  assert.ok(fall >= EG_SHAFT_DROP_CM[0] && fall <= EG_SHAFT_DROP_CM[1], `a Drop of ${fall} cm`);
  assert.deepEqual([drop.w, drop.d, drop.after], [600, 600, 0], 'the Drop\'s landing, left onto the foot');
  assert.equal(law.course[0].z - law.course[0].d / 2 - law.course[0].gap, EG_SHAFT_RIM_CM, 'the flights leave from the rim');
  assert.deepEqual(law.hazards.map((h) => [h.kind, h.y]), [['mist', yB - 300]]);
  assert.equal(law.hazards[0].y, S.hazards[0].y - S.yB + yB, 'the kit\'s line under its foot');
  assert.equal(yB, MIST_STAIR.FOOT * 100);
  assert.deepEqual(law.anchors, { rift: [], caster: [], lurker: [], niche: [], engine: [], hazard: [[0, -1400, 1650]] });
  assert.deepEqual(law.alcoves, [{ x: 455, y: 60, z: 150, seal: 'seam', side: 1, holds: 'lumen' }]);
  assert.deepEqual(law.lights, [[0, -1250, 1650, 'band'], [0, -430, 3150, 'band'], [0, 130, 1250, 'band'], [0, 450, 150, 'band']]);
  assert.deepEqual(law.box, [-852, -2132, 0, 850, 900, 3300], 'the crag\'s root to its rim, the mouth to the exit');
  assert.equal(MIST_STAIR.W * 100, S.halfW);
});

test('EG-HERO THE TIMED SOLVER\'S PROOF (section 10.5): each inner course proven (every window, no wait on a crumbling bone), its proof the solver\'s own crossing (the Ossuary 1.701 s, the Mist Stair 4.937 s, fastest and median), the shaft crossed inside EG_SHAFT_MAX_S, and every flight and gap inside THE ENVELOPE (a gap 2.4-3.2 m in the shaft, a step down under 1 m, a Drop at most 4.5 m) (mutants: a gap stretched past the span build\'s jump; the proof unasked)', () => {
  for (const f of FRAGS) {
    const { law } = baked(f), steps = egFragSteps(law), P = egSpanProof({ steps });
    assert.ok(P.ok, `${f.name}: ${P.why.join('; ')}`);
    const c = egRoadCross({ steps }, 0);
    assert.deepEqual(law.proof, { crossFast: Math.round(c.fast * 1000), crossSlow: Math.round(c.median * 1000), moves: c.n });
  }
  assert.deepEqual(baked(OSS).law.proof, { crossFast: 1701, crossSlow: 1701, moves: 4 });
  assert.deepEqual(baked(MIST).law.proof, { crossFast: 4937, crossSlow: 4937, moves: 6 });
  assert.ok(baked(MIST).law.proof.crossSlow / 1000 <= EG_SHAFT_MAX_S, 'a shaft inside 15 s');
  const m = baked(MIST).law;
  for (const [i, c] of m.course.entries()) {
    assert.ok(c.gap >= 240 && c.gap <= 320, `course[${i}]: a gap of ${c.gap} cm`);
    const down = (i ? m.course[i - 1].y : 0) - c.y;
    assert.ok(c.kind === 'drop' ? down <= 450 : down < 100, `course[${i}]: ${down} cm down`);
  }
});

test('EG-HERO THE BUDGET (section 11.9, EG_FRAG_BUDGET): each fragment at most 12,000 drawn triangles (the Ossuary 9,830, the Mist Stair 5,542 - both in the aimed 4,000-11,000), at most 12 draws (seven dress records each), a collider proxy of at most 3,000 triangles (20 and 18 - never the drawn mesh), at most four lights; its cost the mesh it carries; its art in the band\'s dress alone (mutants: a fifth light; a proxy of the drawn mesh)', () => {
  const want = { egheroOssuary: { tris: 9830, collider: 20, lights: 3, draws: 7 }, egheroMistStair: { tris: 5542, collider: 18, lights: 4, draws: 7 } };
  for (const f of FRAGS) {
    const { law, mesh } = baked(f);
    assert.deepEqual(law.cost, want[law.id]);
    for (const [k, max] of Object.entries(EG_FRAG_BUDGET)) assert.ok(law.cost[k] <= max, `${f.name}: ${k} ${law.cost[k]} inside ${max}`);
    assert.ok(law.cost.tris >= 4000 && law.cost.tris <= 11000, 'in the aimed range');
    assert.equal(law.cost.tris, mesh.indices.length / 3);
    assert.equal(law.cost.draws, mesh.subMeshes.length);
    assert.equal(law.cost.collider, mesh.collider.length / 9);
    assert.equal(law.cost.lights, law.lights.length);
    for (const s of mesh.subMeshes) assert.equal(EG_DRESS[s.material], s.record, `${f.name}: ${s.material} is the band's own record`);
    assert.deepEqual(mesh.subMeshes.map((s) => s.material), ['floor', 'brass', 'root', 'cobble', 'edge', 'molten', 'pillar']);
    assert.ok(law.cost.collider * 50 < law.cost.tris, 'the proxy, not the drawn mesh');
  }
});

test('EG-HERO THE EDGE LINE ON EVERY WALKABLE RIM (section 25.3: "a platform never lies about where it ends"): along every open edge of every floor - each mouth, each lip, each exit - the band\'s edge record runs gold at the floor\'s height, a hand\'s width in from the rim, end to end; and the walls carry none (mutants: a lip left unlined; a line off its floor)', () => {
  for (const f of FRAGS) {
    const { law, mesh } = baked(f), gold = trianglesOf(mesh, [EG_DRESS.edge]);
    assert.ok(gold.length >= 2 * law.open.length, `${f.name}: a strip a rim`);
    for (const [fi, e] of law.open) {
      const fl = law.floors[fi], a = fl.poly[e], b = fl.poly[(e + 1) % fl.poly.length], y = fl.y / 100;
      const dx = (b[0] - a[0]) / 100, dz = (b[1] - a[1]) / 100, len = Math.sqrt(dx * dx + dz * dz), nx = -dz / len, nz = dx / len;
      for (let s = 0.05; s <= len - 0.05 + 1e-9; s += 0.25) {
        const p = [a[0] / 100 + (dx * s) / len + nx * 0.07, y, a[1] / 100 + (dz * s) / len + nz * 0.07];
        const on = gold.some((t) => { const h = axisHit(t, [p[0], y - 1, p[2]], 1); return h !== null && h >= 1 && h <= 1.03; });
        assert.ok(on, `${f.name}: floors[${fi}] edge ${e} lined at ${s.toFixed(2)} m`);
      }
    }
    // gold lies only on the floors' rims: every gold vertex at a floor's height, over its open edge
    for (const t of gold) for (const p of t) assert.ok(law.floors.some((fl) => Math.abs(p[1] - fl.y / 100 - 0.01) < 1e-6), `${f.name}: an edge line at ${p[1]} m is on no floor`);
  }
});

test('EG-HERO NO DRAWN VERTEX INSIDE THE PROXY, NOTHING WHERE A BODY GOES (section 11.6: "no drawn vertex lies inside the proxy, and headroom is measured on the drawn mesh"): the proxy walls, floors and roofs the walk (each floor\'s middle a metre up is inside it) and no drawn vertex lies inside it; no drawn vertex stands in a floor\'s prism to its ceiling, on an inner piece\'s flight (THE FAST BUILD\'s 4.5 m over it, a capsule either side) or over a gap between them; and the drawn mesh keeps each floor\'s headroom (3.5 m in a passage and a shaft) and 4.5 m over every inner piece (mutants: a rib swung into the bridges\' flight; a pillar stood in the nave; the vault let down)', () => {
  const room = { egheroOssuary: [5.73, 6.2], egheroMistStair: [4.82, 5.51] };
  for (const f of FRAGS) {
    const { law, mesh } = baked(f), proxy = colliderOf(mesh), drawn = trianglesOf(mesh), walk = walkOf(law);
    for (const fl of law.floors) {
      const xs = fl.poly.map((p) => p[0] / 100), zs = fl.poly.map((p) => p[1] / 100);
      assert.ok(insideProxy(proxy, [(Math.min(...xs) + Math.max(...xs)) / 2, fl.y / 100 + 1, (Math.min(...zs) + Math.max(...zs)) / 2]), `${f.name}: the proxy bounds its floor`);
    }
    const P = mesh.positions;
    for (let i = 0; i < P.length; i += 3) {
      const p = [P[i], P[i + 1], P[i + 2]];
      assert.ok(!insideProxy(proxy, p), `${f.name}: a drawn vertex at [${p}] inside the proxy`);
      const v = walk.find((w) => inWalk(w, p));
      assert.ok(!v, `${f.name}: a drawn vertex at [${p}] in ${v?.at}`);
    }
    // the headroom on the drawn mesh: over each floor, and over each inner piece
    let floorMin = Infinity, pieceMin = Infinity;
    for (const fl of law.floors) {
      const xs = fl.poly.map((p) => p[0] / 100), zs = fl.poly.map((p) => p[1] / 100);
      for (const x of cuts([Math.min(...xs) + 0.1, Math.max(...xs) - 0.1], 0.5)) for (const z of cuts([Math.min(...zs) + 0.1, Math.max(...zs) - 0.1], 0.5)) floorMin = Math.min(floorMin, headroom(drawn, [x, fl.y / 100, z]));
    }
    for (const c of law.course) {
      for (const x of cuts([(c.x - c.w / 2) / 100, (c.x + c.w / 2) / 100], 0.4)) for (const z of cuts([(c.z - c.d / 2) / 100, (c.z + c.d / 2) / 100], 0.4)) pieceMin = Math.min(pieceMin, headroom(drawn, [x, c.y / 100, z]));
    }
    assert.ok(floorMin >= EG_FRAG_HEADROOM_CM[law.class] / 100, `${f.name}: ${floorMin} m over a floor`);
    assert.ok(pieceMin >= EG_FRAG_HEADROOM_CM.course / 100, `${f.name}: ${pieceMin} m over an inner piece`);
    assert.deepEqual([Math.round(floorMin * 100) / 100, Math.round(pieceMin * 100) / 100], room[law.id], `${f.name}: the drawn headroom`);
  }
});

test('EG-HERO THE KIT\'S PIECES (tools/egHeroKit.mjs - the Cairn\'s scenes\' shared shapes): the mirror winds a face back and mirrors its normals; a wound face faces where it is asked; the rows a surface is cut at meet every knot, evenly, either way; a walk strip runs along X or Y and refuses a slant (mutants: the mirror\'s winding kept; a wound face left; a cut short of its knot)', () => {
  const m = refFragMesh('t');
  mirrorX(m).face([[1, 0, 0], [2, 0, 0], [2, 1, 0]], 0, [[[1, 0, 0], [0, 0]], [[0, 1, 0], [1, 0]], [[0, 0, 1], [1, 1]]]);
  assert.deepEqual(m.faces.map((f) => f.map((i) => m.verts[i])), [[[-2, 1, 0], [-2, 0, 0], [-1, 0, 0]]]);
  assert.deepEqual(m.corner[0].map(([n]) => n), [[0, 0, 1], [0, 1, 0], [-1, 0, 0]]);
  const n = (pts) => { const [a, b, c] = pts; const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]]; return [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]; };
  const w = refFragMesh('w');
  faceTo(w, [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]], [0, 0, -1]);
  faceTo(w, [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]], [0, 0, 1]);
  assert.deepEqual(w.faces.map((f) => Math.sign(n(f.map((i) => w.verts[i]))[2])), [-1, 1]);
  assert.deepEqual(cuts([0, 1, 3], 1), [0, 1, 2, 3]);
  assert.deepEqual(cuts([0, 2.5], 1), [0, 2.5 / 3, 5 / 3, 2.5]);
  assert.deepEqual(cuts([0, -1], 0.5), [0, -0.5, -1]);
  const s = refFragMesh('s');
  walkStrip(s, [0, 1, 0], [0, 4, 0]); walkStrip(s, [-2, 4, 0], [0, 4, 0]);
  assert.deepEqual(s.verts, [[-0.1, 1, 0], [0.1, 1, 0], [0.1, 4, 0], [-0.1, 4, 0], [-2, 3.9, 0], [0, 3.9, 0], [0, 4.1, 0], [-2, 4.1, 0]]);
  assert.throws(() => walkStrip(s, [0, 0, 0], [1, 1, 0]), /neither along X nor along Y/);
});

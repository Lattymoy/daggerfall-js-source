// EG-HERO (2026-10-13, the owner: "You have to author the fragments"; bible/11-Multiplayer/Elite-Gates.md sections 10.5,
// 11.2, 11.4-11.9, 25.3): THE HAVOC WELLHEAD'S HERO FRAGMENTS - the Forge Gut (a passage), the Clan Pit and the Oblivion
// Caverns, deep (chambers), each a scene the port writes from numbers alone (tools/egHero*Scene.mjs, on tools/egHeroKit.mjs
// and the reference's writer), committed as the .fbx tools/fragBake.mjs bakes (tools/bakeEgHero*.mjs), registered in
// net/eliteGates/egHeroFrags.js and world/eliteGates/egHeroFragModel.js. Each is held to its bytes, to the reader, to its kit's code-built envelope
// and signature, to THE TIMED SOLVER, to its budget, to THE EDGE LINE on every walkable rim, and to an envelope no drawn
// vertex stands inside.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { bakeFrag, fragJson } from '../../tools/fragBake.mjs';
import { writeHeroForgeGutFbx, HERO_FORGE_GUT_FBX, FORGE_GUT } from '../../tools/egHeroForgeGutScene.mjs';
import { writeHeroClanPitFbx, HERO_CLAN_PIT_FBX, CLAN_PIT } from '../../tools/egHeroClanPitScene.mjs';
import { writeHeroDeepCavernsFbx, HERO_DEEP_CAVERNS_FBX, DEEP_CAVERNS } from '../../tools/egHeroDeepCavernsScene.mjs';
import { SPEC as FORGE_SPEC, LAW as FORGE_LAW, MESH as FORGE_MESH } from '../../tools/bakeEgHeroForgeGut.mjs';
import { SPEC as PIT_SPEC, LAW as PIT_LAW, MESH as PIT_MESH } from '../../tools/bakeEgHeroClanPit.mjs';
import { SPEC as DEEP_SPEC, LAW as DEEP_LAW, MESH as DEEP_MESH } from '../../tools/bakeEgHeroDeepCaverns.mjs';
import { EG_FRAGS, EG_PLAYS, EG_FRAG_PIECES, EG_FRAG_BUDGET, EG_FRAG_HEADROOM_CM, EG_SLAG_LANE_CM, EG_SLAG_STEP, egFragRecordFault, egFragSteps, egFragHazards, egHazardLawful, egFragInPoly, egFragArea2, egFragCeilAt, egFragSwept } from '../../src/net/eliteGates/egFragLaw.js';
import { egSpanProof, egRoadCross, EG_SLAG_CYCLE_S } from '../../src/net/eliteGates/egSpanLaw.js';
import { EG_HERO_FRAGS, egHeroFragLaws } from '../../src/net/eliteGates/egHeroFrags.js';
import { EG_HERO_FRAG_MESHES, egHeroFragModel, egHeroFragCollider } from '../../src/world/eliteGates/egHeroFragModel.js';
import { EG_BAND_ARCHIVES } from '../../src/world/eliteGates/pseudoArchives.js';
import { EG_DRESS } from '../../src/world/eliteGates/egBandArt.js';

const ROOT = new URL('../../', import.meta.url);
const committed = (rel) => readFileSync(new URL(rel, ROOT));
const HEROES = [
  { key: 'forge', write: writeHeroForgeGutFbx, fbx: HERO_FORGE_GUT_FBX, spec: FORGE_SPEC, lawPath: FORGE_LAW, meshPath: FORGE_MESH },
  { key: 'clanpit', write: writeHeroClanPitFbx, fbx: HERO_CLAN_PIT_FBX, spec: PIT_SPEC, lawPath: PIT_LAW, meshPath: PIT_MESH },
  { key: 'deep', write: writeHeroDeepCavernsFbx, fbx: HERO_DEEP_CAVERNS_FBX, spec: DEEP_SPEC, lawPath: DEEP_LAW, meshPath: DEEP_MESH },
].map((h) => ({ ...h, law: JSON.parse(committed(h.lawPath)), mesh: JSON.parse(committed(h.meshPath)) }));
const H = Object.fromEntries(HEROES.map((h) => [h.key, h]));

/** The drawn mesh's corners (cm, the fragment's frame) and its triangles of one sub-mesh (m). */
const cornersCm = (mesh) => Array.from({ length: mesh.positions.length / 3 }, (_, i) => [0, 1, 2].map((k) => mesh.positions[i * 3 + k] * 100));
function trisOf(mesh, material) {
  const s = mesh.subMeshes.find((m) => m.material === material), out = [];
  for (let t = s.startIndex; t < s.startIndex + s.primitiveCount * 3; t += 3) out.push([0, 1, 2].map((k) => mesh.indices[t + k]).map((i) => mesh.positions.slice(i * 3, i * 3 + 3)));
  return out;
}
/** The plan distance (cm) from (x, z) to segment a-b. */
function segDist(x, z, a, b) {
  const dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz, t = l2 ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / l2)) : 0;
  return Math.hypot(x - a[0] - t * dx, z - a[1] - t * dz);
}
/** The plan distance (cm) from (x, z) to polygon `poly` - nought inside it. */
const polyDist = (poly, x, z) => (egFragInPoly(poly, x, z) ? 0 : Math.min(...poly.map((p, i) => segDist(x, z, p, poly[(i + 1) % poly.length]))));
/** A floor's open edges that fall away - not running on into another floor at its height, not meeting a ramp. */
function fallEdges(law) {
  const out = [];
  for (const [fi, e] of law.open) {
    const f = law.floors[fi], p = f.poly[e], q = f.poly[(e + 1) % f.poly.length], mid = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
    if (law.floors.some((g, gi) => gi !== fi && g.y === f.y && [p, q, mid].every((c) => egFragInPoly(g.poly, c[0], c[1])))) continue;
    if (law.ramps.some((r) => [p, q].every((c) => r.poly.some((rc) => Math.abs(rc[1] - f.y) <= 1 && Math.hypot(rc[0] - c[0], rc[2] - c[1]) <= 2)))) continue;
    out.push({ fi, e, y: f.y, p, q });
  }
  return out;
}
/** The drawn corners strictly inside the walkable envelope: over a floor (2 cm in from its outline), 3 cm over it and 3 cm
 *  under its ceiling (its class's headroom where it is open to the sky) - and inside an inner piece's swept travel or the
 *  gaps between (its slab's 60 cm under its top to the fast build's 4.5 m over it). */
function insideEnvelope(law, mesh) {
  const bad = [], room = EG_FRAG_HEADROOM_CM[law.class];
  const boxes = [];
  law.course.forEach((c, i) => {
    const s = egFragSwept(c), lo = c.y - 65, hi = c.y + EG_FRAG_HEADROOM_CM.course, air = c.y - 5;   // a slab's travel; a flight's air over the gaps
    boxes.push([s[0], lo, s[2], s[3], hi, s[5]]);
    const prev = law.course[i - 1], z0 = c.z - c.d / 2 - c.gap, z1 = c.z - c.d / 2;
    const xs = prev ? [Math.min(s[0], egFragSwept(prev)[0]), Math.max(s[3], egFragSwept(prev)[3])] : [s[0], s[3]];
    boxes.push([xs[0], air, z0, xs[1], hi, z1]);
    if (c.after > 0) boxes.push([s[0], air, c.z + c.d / 2, s[3], hi, c.z + c.d / 2 + c.after]);
  });
  for (const [x, y, z] of cornersCm(mesh)) {
    for (const f of law.floors) {
      if (!(y > f.y + 3) || !egFragInPoly(f.poly, x, z) || f.poly.some((p, i) => segDist(x, z, p, f.poly[(i + 1) % f.poly.length]) < 2)) continue;
      const top = egFragCeilAt(law, x, z, f.y) ?? f.y + room;
      if (y < top - 3) bad.push(['floor', law.floors.indexOf(f), x, y, z]);
    }
    for (const b of boxes) if (x > b[0] + 1 && x < b[3] - 1 && y > b[1] + 1 && y < b[4] - 1 && z > b[2] + 1 && z < b[5] - 1) bad.push(['course', x, y, z]);
  }
  return bad;
}

test('EG-HERO (the Wellhead) WRITTEN AND BAKED BYTE FOR BYTE (section 11.6: "each fragment its own bake script and byte-for-byte test"): each scene the port writes is its committed .fbx bit for bit; its bake script\'s spec bakes it to the committed law half and mesh half bit for bit, and again; each half names its source and one sha256, written by the port\'s own writer (mutants: a scene\'s number moved; a spec\'s word)', () => {
  for (const h of HEROES) {
    const fbx = committed(h.fbx);
    assert.ok(h.write().equals(fbx), `${h.spec.id}: its scene writes the committed .fbx`);
    const { law, mesh } = bakeFrag(fbx, h.spec);
    assert.equal(fragJson(law), committed(h.lawPath).toString('utf8'), `${h.spec.id}: the law half`);
    assert.equal(fragJson(mesh), committed(h.meshPath).toString('utf8'), `${h.spec.id}: the mesh half`);
    const again = bakeFrag(committed(h.fbx), h.spec);
    assert.equal(fragJson(again.law) + fragJson(again.mesh), fragJson(law) + fragJson(mesh), `${h.spec.id}: a re-bake is the same bytes`);
    assert.equal(law.bake.source, h.fbx);
    assert.equal(law.bake.sha256, mesh.bake.sha256);
    assert.equal(mesh.bake.writer, 'port');
  }
});

test('EG-HERO (the Wellhead) THE SPECS AND THE REGISTRIES (sections 11.4-11.6): the Forge Gut a passage of `forge`, the Clan Pit a chamber of `clanpit` and the deep Caverns a chamber of `deep`, each the hero of its own name (never the reference) with a chamber\'s play `balcony`; each accepted by the reader, registered in net/eliteGates/egHeroFrags.js (and laid by egHeroFragLaws for its kit) with its mesh half in world/eliteGates/egHeroFragModel.js, drawn under the Wellhead\'s archive and colliding on its proxy (mutants: a law unregistered; a mesh of another bake; a play dropped)', () => {
  assert.deepEqual(HEROES.map((h) => [h.spec.id, h.spec.kit, h.spec.class, h.spec.variant, [...h.spec.play]]), [
    ['egheroForgeGut', 'forge', 'passage', 'forgegut', []],
    ['egheroClanPit', 'clanpit', 'chamber', 'clanpit', ['balcony']],
    ['egheroDeepCaverns', 'deep', 'chamber', 'deepcaverns', ['balcony']],
  ]);
  for (const h of HEROES) {
    const { law, mesh, spec } = h, F = EG_FRAGS[spec.kit];
    assert.deepEqual(egFragRecordFault(law), [], `${spec.id}: the reader finds no fault`);
    assert.deepEqual([law.band, law.reverb], [3, F.reverb], `${spec.id}: the Wellhead's, its kit's reverb`);
    assert.ok(F.classes.includes(law.class) && law.play.every((p) => EG_PLAYS.includes(p)));
    assert.equal(JSON.stringify(EG_HERO_FRAGS[spec.id]), JSON.stringify(law), `${spec.id}: registered as baked`);
    assert.ok(egHeroFragLaws(spec.kit).some((l) => l.id === spec.id), `${spec.id}: a hall of its kit may lay it`);
    assert.equal(EG_HERO_FRAG_MESHES[spec.id].bake.sha256, law.bake.sha256, `${spec.id}: its mesh half beside its law`);
    const model = egHeroFragModel(spec.id);
    assert.ok(model.subMeshes.every((s) => s.textureArchive === EG_BAND_ARCHIVES[3]), `${spec.id}: under the Wellhead's archive`);
    assert.deepEqual(model.subMeshes.map((s) => s.textureRecord), mesh.subMeshes.map((s) => EG_DRESS[s.material]));
    assert.equal(egHeroFragCollider(spec.id).length, law.cost.collider * 9, `${spec.id}: its proxy, never its drawn mesh`);
    assert.ok(law.cost.collider * 9 !== mesh.indices.length * 3);
  }
});

test('EG-HERO (the Wellhead) THE ENVELOPES (net/eliteGates/egFragLaw.js egFragPassage and egFragChamber as the halls call them): the Forge Gut\'s mouth and exit 8.4 m wide and 6.5 m high (its halfW 420, height 650), 31 m long (len 2800 + the slag\'s 300), its landings 6.8 m deep either side of a chasm crossed on two Rails and the slag\'s crust; the chambers\' fight floors a circle of R 16 m (the Deepway\'s) about the chamber\'s middle, their gates the court\'s 4 m bridge, 6 m high, the mouth on the box\'s -Z face and the exit on its +Z face (mutants: a mouth\'s width; the circle\'s radius; a box past an exit)', () => {
  const { forge, clanpit, deep } = Object.fromEntries(HEROES.map((h) => [h.key, h.law]));
  assert.deepEqual(forge.sockets, { in: { x: 0, y: 0, z: 0, yaw: 180, w: 840, h: 650 }, out: [{ x: 0, y: 0, z: 3100, yaw: 0, w: 840, h: 650 }] });
  assert.deepEqual(forge.floors, [{ y: 0, poly: [[420, 2420], [420, 3100], [-420, 3100], [-420, 2420]], fight: 1 }, { y: 0, poly: [[420, 0], [420, 680], [-420, 680], [-420, 0]], fight: 1 }]);
  assert.deepEqual(forge.ceil, [{ y: 650, poly: [[420, 0], [420, 3100], [-420, 3100], [-420, 0]] }]);
  assert.deepEqual([FORGE_GUT.halfW, FORGE_GUT.ceil, FORGE_GUT.len], [4.2, 6.5, 31]);
  for (const law of [clanpit, deep]) {
    assert.deepEqual(law.sockets, { in: { x: 0, y: 0, z: 0, yaw: 180, w: 400, h: 600 }, out: [{ x: 0, y: 0, z: 3600, yaw: 0, w: 400, h: 600 }] });
    const pit = law.floors.find((f) => f.fight && f.y === 0), r = pit.poly.map(([x, z]) => Math.hypot(x, z - 1800));
    assert.equal(Math.round(Math.max(...r)), law === clanpit ? 1811 : 1612, 'the gates\' corners (the Clan Pit\'s floor runs out to its mouth and exit, the deep Caverns\' to its gates\' floors)');
    assert.equal(r.filter((v) => Math.abs(v - 1600) <= 1).length >= 18, true, 'its rim on the circle of R 16');
    assert.deepEqual([law.box[2], law.box[5]], [0, 3600]);
  }
  assert.deepEqual([CLAN_PIT.R, CLAN_PIT.cy, DEEP_CAVERNS.R, DEEP_CAVERNS.cy], [16, 18, 16, 18]);
  for (const h of HEROES) assert.ok(h.law.box[2] >= -10 && h.law.box[5] - Math.max(...h.law.sockets.out.map((o) => o.z)) <= 10, `${h.spec.id}: nothing behind its mouth or past its exits`);
  assert.deepEqual(HEROES.map((h) => h.law.box), [[-986, -1665, 0, 1032, 1640, 3100], [-2250, -1410, 0, 2250, 1292, 3600], [-2750, -1523, 0, 2720, 2202, 3600]]);
});

test('EG-HERO (the Wellhead) THE FORGE GUT\'S COURSE AND ITS PROOF (sections 10.3, 10.5, 11.2): the kit\'s pieces (EG_FRAG_PIECES.forge) - two conveyors (Rails 3 by 3 m, 2 m of travel, a 6 s cycle, in step) and the cooling slag\'s crust (EG_SLAG_STEP) - each 2.8 m past what stands before it; THE TIMED SOLVER proves it (crossed in 3.38 s at best, 4.88 s at the median) and proves it whatever the slag\'s phase, every window at least 5.5 s in 12 and no wait past 2.7 s (mutants: a gap widened; the rails out of step; a period shortened)', () => {
  const law = H.forge.law;
  assert.ok(law.course.every((c) => EG_FRAG_PIECES.forge.includes(c.kind)));
  assert.deepEqual(law.course.map((c) => [c.kind, c.x, c.y, c.z, c.w, c.d, c.amp, c.period, c.phase, c.gap, c.after]), [
    ['rail', 0, 0, 1110, 300, 300, 200, 6000, 0, 280, 0], ['rail', 0, 0, 1690, 300, 300, 200, 6000, 0, 280, 0], ['slag', 0, 0, 2270, EG_SLAG_STEP.w, EG_SLAG_STEP.d, EG_SLAG_LANE_CM, EG_SLAG_CYCLE_S * 1000, 0, 280, 0],
  ]);
  assert.deepEqual(law.proof, { crossFast: 3382, crossSlow: 4882, moves: 4 });
  const steps = egFragSteps(law);
  assert.ok(egSpanProof({ steps }).ok);
  for (let ph = 0; ph < EG_SLAG_CYCLE_S * 1000; ph += 1000) {
    const at = egFragSteps({ ...law, course: law.course.map((c) => (c.kind === 'slag' ? { ...c, phase: ph } : c)) });
    const P = egSpanProof({ steps: at }), c = egRoadCross({ steps: at }, 0);
    assert.ok(P.ok, `the slag at phase ${ph} ms: ${P.why.join('; ')}`);
    assert.ok(c.median <= 1.45 * c.fast, `the slag at phase ${ph} ms: a median of ${c.median.toFixed(2)} s`);
  }
});

test('EG-HERO (the Wellhead) THE SIGNATURES (section 11.2): the Forge Gut\'s hammers - a disc of r 3 over each landing\'s two spots in turn, told 1.4 s - the hammer line over each conveyor\'s middle, and the slag\'s two lanes 4 m wide EG_SLAG_LANE_CM either side of the crossing, half a cycle apart and in the crust\'s own clock; the Clan Pit open to the sky, its dais 3.2 m up on two stairs where the Casters stand, the Honour Horn\'s ring of iron at r 6 about its floor\'s middle; the deep Caverns\' magma tide over the whole low floor, its two dry ledges 2.5 m up on four stairs, no point of the low floor more than 24 m from a stair (mutants: a lane\'s spout; a spot off its landing; the dais lowered; the ring\'s radius; the tide\'s reach)', () => {
  const forge = H.forge.law, laid = egFragHazards(forge);
  for (const hz of laid) assert.ok(egHazardLawful(hz).ok, `${hz.kind}: THE WIDTH RULE and THE WIND-UP FLOOR`);
  const by = (k) => forge.hazards.filter((h) => h.kind === k);
  for (const h of by('hammer')) {
    assert.equal(h.r, 300);
    for (const [x, z] of h.spots) assert.ok(forge.floors.some((f) => f.fight && egFragInPoly(f.poly, x, z)), `a hammer at (${x}, ${z}) on a landing`);
  }
  assert.deepEqual(by('hammer').map((h) => h.phase), [3000, 0], 'each landing its own clock');
  assert.deepEqual(by('hammerline')[0].spots, forge.course.filter((c) => c.kind === 'rail').map((c) => [c.x, c.z]), 'over each conveyor\'s middle');
  const crust = forge.course.find((c) => c.kind === 'slag'), lanes = by('slag');
  assert.deepEqual(lanes.map((h) => [h.sh[0], h.sh[2], h.w, h.y, h.phase]), [[EG_SLAG_LANE_CM, EG_SLAG_LANE_CM, 400, crust.y, crust.phase + (EG_SLAG_CYCLE_S * 1000) / 2], [-EG_SLAG_LANE_CM, -EG_SLAG_LANE_CM, 400, crust.y, crust.phase]], 'the east spout half a cycle behind the west');
  for (const h of lanes) assert.deepEqual([h.sh[1] - 200, h.sh[3] + 200], [crust.z - crust.d / 2, crust.z + crust.d / 2 + 150], 'from the crust\'s near edge onto 1.5 m of the far landing');
  // the Clan Pit
  const pit = H.clanpit.law, dais = pit.floors.find((f) => f.y > 0);
  assert.equal(pit.ceil, null, 'open to the burning sky');
  assert.deepEqual(pit.hazards, []);
  assert.ok(dais.fight && dais.y >= 300 && dais.y <= 400, 'a second fight floor 3-4 m up');
  assert.deepEqual(pit.ramps.map((r) => [r.y0, r.y1]), [[0, 320], [0, 320]]);
  assert.ok(pit.anchors.caster.length === 2 && pit.anchors.caster.every(([x, y, z]) => y === dais.y && egFragInPoly(dais.poly, x, z)), 'the Casters on the dais');
  const brass = new Set(trisOf(H.clanpit.mesh, 'brass').flat().filter((p) => p[1] === 0).map((p) => Math.round(Math.hypot(p[0], p[2] - 18) * 100)));
  assert.ok([585, 615].every((r) => brass.has(r)), 'the ring of iron 5.85-6.15 m about the pit\'s middle');
  // the deep Caverns
  const deep = H.deep.law, low = deep.floors.find((f) => f.fight && f.y === 0), tide = deep.hazards[0];
  assert.deepEqual(deep.hazards.map((h) => [h.kind, h.x, h.z, h.r, h.y]), [['tide', 0, 1800, 1600, 0]]);
  assert.ok(low.poly.every(([x, z]) => Math.hypot(x - tide.x, z - tide.z) <= tide.r + 15), 'the tide over the whole low floor (the gates\' slivers within 15 cm)');
  const ledges = deep.floors.filter((f) => f.y === 250);
  assert.ok(ledges.length === 2 && ledges.every((f) => f.fight && f.y - tide.y > 150), 'two dry floors 2.5 m up, out of the tide\'s bite');
  assert.equal(deep.ramps.length, 4);
  let far = 0;
  for (let x = -1600; x <= 1600; x += 50) for (let z = 0; z <= 3600; z += 50) if (egFragInPoly(low.poly, x, z)) far = Math.max(far, Math.min(...deep.ramps.map((r) => polyDist(r.poly.map((p) => [p[0], p[2]]), x, z))));
  assert.ok(far <= 2400 && 2400 / 697.5 + 1.5 <= 5, `the farthest point of the low floor ${far} cm from a stair, inside the tide's 5 s tell`);
  assert.equal(Math.round(far / 10), 145, 'the farthest 14.5 m');
  assert.deepEqual(deep.ceil.map((c) => c.y), [900, 600, 600], 'the cavern\'s clamp 9 m, its gates\' 6 m');
});

test('EG-HERO (the Wellhead) THE BUDGET (section 11.9, EG_FRAG_BUDGET): each fragment its triangles (4,000 to 11,000 aimed), its draws (a sub-mesh a dress record), its collider\'s proxy and its four lights at most - each said in its cost (mutants: a light past the cap; the proxy\'s floors not the law\'s)', () => {
  assert.deepEqual(HEROES.map((h) => h.law.cost), [{ tris: 8137, collider: 30, lights: 4, draws: 7 }, { tris: 5614, collider: 212, lights: 4, draws: 8 }, { tris: 4258, collider: 192, lights: 4, draws: 7 }]);
  for (const h of HEROES) {
    const { law, mesh } = h;
    for (const [k, max] of Object.entries(EG_FRAG_BUDGET)) assert.ok(law.cost[k] <= max, `${h.spec.id}: ${k}`);
    assert.ok(law.cost.tris >= 4000 && law.cost.tris <= 11000, `${h.spec.id}: ${law.cost.tris} triangles`);
    assert.equal(law.cost.draws, mesh.subMeshes.length);
    assert.equal(law.cost.tris, mesh.indices.length / 3);
    // the proxy's floors are the law's: at each floor's height, its triangles inside the floor cover its area
    const c = mesh.collider;
    for (const f of law.floors) {
      let area = 0;
      for (let t = 0; t < c.length; t += 9) {
        const ys = [c[t + 1], c[t + 4], c[t + 7]].map((v) => Math.round(v * 100));
        if (ys.some((y) => y !== f.y)) continue;
        const cx = ((c[t] + c[t + 3] + c[t + 6]) / 3) * 100, cz = ((c[t + 2] + c[t + 5] + c[t + 8]) / 3) * 100;
        if (!egFragInPoly(f.poly, cx, cz)) continue;
        area += Math.abs((c[t + 3] - c[t]) * (c[t + 8] - c[t + 2]) - (c[t + 6] - c[t]) * (c[t + 5] - c[t + 2])) / 2;
      }
      assert.ok(Math.abs(area * 1e4 - egFragArea2(f.poly) / 2) <= egFragArea2(f.poly) / 200, `${h.spec.id}: the proxy carries floor ${law.floors.indexOf(f)} whole`);
    }
  }
});

test('EG-HERO (the Wellhead) THE EDGE LINE ON EVERY WALKABLE RIM (section 25.3): every open edge a member could fall from - the mouths, the exits, the Forge Gut\'s lips over its chasm, the Clan Pit\'s dais, the deep Caverns\' rim over its lake, its ledges and its gates\' sides - carries the gold line its whole length, at its floor\'s height; an edge running on into another floor or onto a stair is no fall (mutants: a lip\'s line dropped; a rim\'s line short)', () => {
  const counts = [];
  for (const h of HEROES) {
    const lines = trisOf(h.mesh, 'edge'), falls = fallEdges(h.law);
    counts.push(falls.length);
    for (const { fi, e, y, p, q } of falls) {
      const len = Math.hypot(q[0] - p[0], q[1] - p[1]), n = Math.max(2, Math.ceil(len / 25));
      for (let k = 0; k <= n; k++) {
        const f = 0.02 + (0.96 * k) / n, x = (p[0] + (q[0] - p[0]) * f) / 100, z = (p[1] + (q[1] - p[1]) * f) / 100;
        const hit = lines.some((t) => t.every((v) => v[1] * 100 >= y - 1 && v[1] * 100 <= y + 3) && Math.min(...[0, 1, 2].map((i) => segDist(x * 100, z * 100, [t[i][0] * 100, t[i][2] * 100], [t[(i + 1) % 3][0] * 100, t[(i + 1) % 3][2] * 100]))) <= 4);
        assert.ok(hit, `${h.spec.id}: floor ${fi}'s edge ${e} has no gold line at (${x.toFixed(2)}, ${z.toFixed(2)})`);
      }
    }
  }
  assert.deepEqual(counts, [4, 6, 38], 'the falls: the Forge Gut\'s mouth, lips and exit; the Clan Pit\'s mouth and exit and the dais\'s front and sides; the deep Caverns\' rim (28), its ledges\' (eight) and its gates\' mouth and exit');
});

test('EG-HERO (the Wellhead) NO DRAWN VERTEX INSIDE THE ENVELOPE (section 11.6: "neither the camera nor the body ever sits inside visible rock"; section 11.8\'s headroom measured on the drawn mesh): no corner of the art stands over a floor between its plates and its ceiling (its class\'s headroom where it is open to the sky), nor inside an inner piece\'s travel or the gaps it is jumped across - the walls pushed outward only, the hammers, crucibles and stalactites over the clamp, the conveyors\' beds under their platforms (mutants: a rib\'s foot inside the wall\'s line; a hammer under the ceiling; a roller into a Rail\'s slab)', () => {
  for (const h of HEROES) assert.deepEqual(insideEnvelope(h.law, h.mesh).slice(0, 3), [], h.spec.id);
});

test('EG-HERO (the Wellhead) THE LAW\'S PLACES (sections 11.5, 11.7, 11.10): the walk graph never crosses a gap or the magma (every edge over a floor or a stair); a Rift-Yard\'s five rifts in each chamber; Lurkers in each; a Battlemage\'s niche, the Drop-Hammer\'s winch and the spouts in the Forge Gut, the Sluice beside the deep Caverns\' lake; one alcove each behind a false wall, to one side of the course; the lights the kit\'s own and the lava\'s (mutants: an edge over the chasm; an alcove on the line)', () => {
  for (const h of HEROES) {
    const { law } = h, { nodes, edges } = law.graph;
    for (const [a, b] of edges) {
      const A = nodes[a], B = nodes[b];
      for (let k = 0; k <= 20; k++) {
        const x = A[0] + ((B[0] - A[0]) * k) / 20, z = A[2] + ((B[2] - A[2]) * k) / 20;
        assert.ok(law.floors.some((f) => egFragInPoly(f.poly, x, z)) || law.ramps.some((r) => egFragInPoly(r.poly.map((p) => [p[0], p[2]]), x, z)), `${h.spec.id}: edge ${a}-${b} over nothing at (${x}, ${z})`);
      }
    }
    assert.equal(law.alcoves.length, 1);
    assert.ok(law.alcoves.every((a) => a.seal === 'seam' && a.x !== 0 && Math.sign(a.x) === a.side));
    assert.ok(law.lights.length <= 4 && law.lights.every((l) => ['band', 'lava'].includes(l[3])));
  }
  const a = Object.fromEntries(HEROES.map((h) => [h.key, h.law.anchors]));
  assert.deepEqual(Object.fromEntries(Object.entries(a).map(([k, v]) => [k, Object.fromEntries(Object.entries(v).map(([n, l]) => [n, l.length]))])), {
    forge: { rift: 0, caster: 0, lurker: 2, niche: 1, engine: 1, hazard: 2 },
    clanpit: { rift: 5, caster: 2, lurker: 3, niche: 0, engine: 0, hazard: 0 },
    deep: { rift: 5, caster: 2, lurker: 3, niche: 0, engine: 1, hazard: 0 },
  });
  assert.deepEqual(HEROES.map((h) => h.law.alcoves[0].holds), ['shard', 'page', 'lumen']);
});

test('EG-HERO (the Wellhead) WRITTEN FROM NUMBERS ALONE (tools/egHeroKit.mjs\'s rule): the three scenes and the Wellhead\'s shapes in the kit call no transcendental and no randomness - IEEE arithmetic and Math.sqrt, so the .fbx is the same bytes on every engine (mutants: a Math.hypot in a scene)', () => {
  const kit = readFileSync(new URL('tools/egHeroKit.mjs', ROOT), 'utf8'), block = kit.slice(kit.indexOf('// ── EG-HERO (2026-10-13), THE HAVOC WELLHEAD\'S SHAPES'));
  assert.ok(block.length > 6000, 'the Wellhead\'s block found');
  for (const [name, src] of [['the kit\'s block', block], ...['tools/egHeroForgeGutScene.mjs', 'tools/egHeroClanPitScene.mjs', 'tools/egHeroDeepCavernsScene.mjs'].map((f) => [f, readFileSync(new URL(f, ROOT), 'utf8')])]) {
    for (const bad of ['Math.sin', 'Math.cos', 'Math.tan', 'Math.atan', 'Math.pow', 'Math.exp', 'Math.log', 'Math.hypot', 'Math.random', 'Date.now', ') ** ']) assert.ok(!src.includes(bad), `${name} calls ${bad}`);
  }
});

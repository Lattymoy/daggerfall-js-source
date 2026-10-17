// EG6c (2026-10-12, bible/11-Multiplayer/Elite-Gates.md sections 10.5, 11.5 and 11.6): HERO FRAGMENTS - THE BAKE AND ONE
// REFERENCE FRAGMENT. tools/fragBake.mjs reads an authored fragment's Blender scene (tools/shipBake.mjs sceneObjects and
// fillFace, tools/fbxMesh.mjs layerReader and cornerWelder), welds its art's normals and UVs, writes a sub-mesh a dress
// record, and bakes its named markers to section 11.5's law record (net/eliteGates/egFragLaw.js), refused by its reader and proven by
// THE TIMED SOLVER. The reference fragment (tools/egRefFragScene.mjs - the port's own scene, no game data) is written and
// baked byte for byte, and every rule the bake keeps refuses a scene that breaks it - the scenes built by the reference's
// own writer, as a modeller's mistakes would arrive.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readFbx, nodeAt, childNamed, childrenNamed } from '../../tools/fbxRead.mjs';
import { bakeFrag, fragJson, fragMarker, fragPiece, assertFragSource, listFrag, FRAG_MARKERS, FRAG_REF_WRITER } from '../../tools/fragBake.mjs';
import { refFragScene, refFragMesh, writeRefFragFbx, REF_FRAG_FBX } from '../../tools/egRefFragScene.mjs';
import { SPEC, LAW, MESH } from '../../tools/bakeEgRefFrag.mjs';
import { EG_FRAG_ANCHORS, EG_FRAG_V } from '../../src/net/eliteGates/egFragLaw.js';
import { EG_DRESS } from '../../src/world/eliteGates/egBandArt.js';

const ROOT = new URL('../../', import.meta.url);
const committed = (rel) => readFileSync(new URL(rel, ROOT));
/** The reference scene with an edit made, written as the reference is. */
const sceneWith = (edit) => { const s = refFragScene(); edit(s); return writeRefFragFbx(s); };
/** Object `name` of scene `s` replaced by `m` (removed when none). */
const swap = (s, name, m = null) => { const i = s.findIndex((o) => o.name === name); assert.ok(i >= 0, `the scene has ${name}`); s.splice(i, 1, ...(m ? [m] : [])); };
const bake = (bytes, tree) => bakeFrag(bytes, SPEC, tree);
const lawOf = (bytes) => bake(bytes).law;

test('EG6c THE REFERENCE, WRITTEN AND BAKED BYTE FOR BYTE (section 11.6: "each fragment its own bake script and byte-for-byte test"): the scene the port writes is the committed .fbx, bit for bit; tools/bakeEgRefFrag.mjs\'s spec bakes it to the committed law half and mesh half, bit for bit, and again to the same bytes; each half names its source and its sha256 (mutants: a writer\'s number moved; a half\'s key order)', () => {
  const fbx = committed(REF_FRAG_FBX);
  assert.ok(writeRefFragFbx().equals(fbx), 'tools/egRefFragScene.mjs writes the committed scene');
  const { law, mesh } = bakeFrag(fbx, SPEC);
  assert.equal(fragJson(law), committed(LAW).toString('utf8'), 'the law half');
  assert.equal(fragJson(mesh), committed(MESH).toString('utf8'), 'the mesh half');
  const again = bakeFrag(committed(REF_FRAG_FBX), SPEC);
  assert.equal(fragJson(again.law) + fragJson(again.mesh), fragJson(law) + fragJson(mesh), 'a re-bake is the same bytes');
  assert.equal(law.bake.source, 'src/assets/egfrags/source/egRefFrag.fbx');
  assert.equal(law.bake.sha256, mesh.bake.sha256);
  assert.match(law.bake.sha256, /^[0-9a-f]{64}$/);
  assert.equal(mesh.bake.writer, 'port');
  assert.equal(fragJson({ a: 1, b: [2, 3] }), '{\n  "a": 1,\n  "b": [2,3]\n}\n', 'one key a line');
});

test('EG6c EVERY MARKER KIND (section 11.6\'s list, and section 11.5\'s record whole): the reference names every marker the bake reads and every anchor kind, and its law half carries each - its sockets, floors (fight and traversal), ramp, ceilings, open edges (an open marker\'s and a floor running on into another\'s), walk graph, anchors, hazards (a lane inset to its capsule, a disc\'s spots), inner course (gaps and the ground after it), alcove, lights, cost, proof and box (mutants: a marker kind misread; an edge left a wall; a lane\'s ends not drawn in)', () => {
  const scene = refFragScene();
  const kinds = new Set(scene.map((o) => fragMarker(o.name)?.kind).filter(Boolean));
  assert.deepEqual([...kinds].sort(), [...FRAG_MARKERS].sort(), 'every marker kind stands in the reference');
  assert.deepEqual([...new Set(scene.map((o) => fragMarker(o.name)).filter((m) => m?.kind === 'anchor').map((m) => m.of))].sort(), [...EG_FRAG_ANCHORS].sort());
  const law = lawOf(committed(REF_FRAG_FBX));
  assert.equal(law.v, EG_FRAG_V);
  assert.deepEqual([law.id, law.kit, law.band, law.class, law.variant, law.play, law.reverb], ['egRefFrag', 'caverns', 0, 'passage', 'reference', [], 'cave']);
  assert.deepEqual(law.sockets, { in: { x: 0, y: 0, z: 0, yaw: 180, w: 400, h: 400 }, out: [{ x: 225, y: 150, z: 3000, yaw: 0, w: 150, h: 400 }, { x: -100, y: 0, z: 3000, yaw: 0, w: 300, h: 400 }] });
  assert.deepEqual(law.floors, [
    { y: 150, poly: [[300, 2500], [300, 3000], [150, 3000], [150, 2500]], fight: 1 },
    { y: 0, poly: [[300, 2100], [300, 3000], [-300, 3000], [-300, 2100]], fight: 1 },
    { y: 0, poly: [[300, 150], [300, 900], [-300, 900], [-300, 150]], fight: 1 },   // two faces, one outline
    { y: 0, poly: [[300, 0], [300, 150], [-300, 150], [-300, 0]], fight: 0 },
  ]);
  assert.deepEqual(law.ramps, [{ poly: [[300, 0, 2250], [300, 150, 2500], [150, 150, 2500], [150, 0, 2250]], y0: 0, y1: 150 }]);
  // the balcony's stair top, exit and drop; the far floor's lip and exit; the near floor's lip and its edge onto the
  // threshold (runs on); the threshold's mouth and its edge onto the near floor (runs on) - the walls stay walls
  assert.deepEqual(law.open, [[0, 1], [0, 2], [0, 3], [1, 1], [1, 3], [2, 1], [2, 3], [3, 1], [3, 3]]);
  assert.deepEqual(law.ceil, [{ y: 600, poly: [[300, 1700], [300, 3000], [-300, 3000], [-300, 1700]] }, { y: 600, poly: [[300, 0], [300, 1300], [-300, 1300], [-300, 0]] }]);
  assert.deepEqual(law.graph, { nodes: [[225, 150, 2750, 50], [-150, 0, 2700, 50], [0, 0, 2170, 50], [0, 0, 830, 50], [0, 0, 75, 50], [0, 0, 500, 50], [225, 0, 2200, 50]], edges: [[0, 6], [1, 2], [1, 6], [2, 6], [3, 5], [4, 5]] });
  assert.deepEqual(law.anchors, { rift: [[-285, 100, 600]], caster: [[225, 150, 2850]], lurker: [[-250, 0, 2800], [250, 0, 300]], niche: [[-250, 0, 2400]], engine: [[0, 0, 2600]], hazard: [[260, 0, 2150]] });
  assert.deepEqual(law.hazards, [
    { kind: 'basalt', x: 0, y: 0, z: 0, w: 0, r: 250, ring: 0, period: 0, phase: 700, sh: null, spots: [[50, 400], [-50, 650]], lanes: null, path: null },
    { kind: 'fall', x: 0, y: 0, z: 0, w: 120, r: 0, ring: 0, period: 0, phase: 1500, sh: [-240, 840, 240, 840], spots: null, lanes: null, path: null },
    { kind: 'surge', x: 0, y: 0, z: 0, w: 400, r: 0, ring: 0, period: 8000, phase: 2000, sh: [-100, 2350, -100, 2750], spots: null, lanes: null, path: null },
  ]);
  assert.deepEqual(law.course, [
    { kind: 'ledge', x: 0, y: 0, z: 1100, w: 240, d: 200, amp: 0, period: 0, phase: 0, beat: 0, gap: 100, after: 0 },
    { kind: 'drift', x: 0, y: 0, z: 1520, w: 300, d: 240, amp: 100, period: 5000, phase: 900, beat: 0, gap: 200, after: 0 },
    { kind: 'ledge', x: 0, y: 0, z: 1900, w: 240, d: 200, amp: 0, period: 0, phase: 0, beat: 0, gap: 160, after: 100 },
  ]);
  assert.deepEqual(law.alcoves, [{ x: -400, y: 0, z: 500, seal: 'seam', side: -1, holds: 'shard' }]);
  assert.deepEqual(law.lights, [[0, 400, 2700, 'band'], [0, 400, 400, 'band'], [0, 100, 1500, 'lava']]);
  assert.deepEqual(law.cost, { tris: 128, collider: 18, lights: 3, draws: 7 });
  assert.deepEqual(law.proof, { crossFast: 2012, crossSlow: 2012, moves: 4 });
  assert.deepEqual(law.box, [-450, -400, 0, 350, 660, 3000], 'the niche behind the west wall to the vault\'s top, the magma to the exits');
});

test('EG6c THE FRAME AND THE ART (section 11.6): a scene point (X, Y, Z) is the fragment\'s (X, Z, Y) about the foot of the mouth - a mirror, every triangle wound back through it so (b - a) x (c - a) faces out along its own normals; the art welded on its authored triple (a floor\'s two faces share their edge, a smooth post keeps its UV seam); one sub-mesh a dress record, lowest first; the collider the proxy alone (mutants: the mirror\'s winding kept; the normals not swapped; a sub-mesh out of order)', () => {
  const { mesh } = bake(committed(REF_FRAG_FBX));
  const P = mesh.positions, N = mesh.normals, I = mesh.indices;
  assert.equal(P.length, N.length);
  assert.equal(mesh.uvs.length / 2, P.length / 3);
  let out = 0;
  for (let t = 0; t < I.length; t += 3) {
    const [a, b, c] = [I[t], I[t + 1], I[t + 2]].map((i) => [P[i * 3], P[i * 3 + 1], P[i * 3 + 2]]);
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const vn = [0, 1, 2].map((k) => N[I[t] * 3 + k] + N[I[t + 1] * 3 + k] + N[I[t + 2] * 3 + k]);
    if (n[0] * vn[0] + n[1] * vn[1] + n[2] * vn[2] > 0) out++;
  }
  assert.equal(out, I.length / 3, 'every triangle faces out along its normals');
  assert.deepEqual(mesh.subMeshes.map((s) => [s.material, s.record, s.startIndex, s.primitiveCount]), [['floor', 0, 0, 8], ['brass', 1, 24, 44], ['root', 2, 156, 24], ['cobble', 31, 228, 4], ['edge', 32, 240, 4], ['molten', 33, 252, 2], ['pillar', 56, 258, 42]]);
  for (const s of mesh.subMeshes) assert.equal(EG_DRESS[s.material], s.record);
  const verts = (s) => new Set(I.slice(s.startIndex, s.startIndex + s.primitiveCount * 3));
  // the floor record: the near and far floors' two faces each - 4 corners a floor, not 8
  assert.equal(verts(mesh.subMeshes[0]).size, 12, 'two floors of two faces each, their shared edges welded (6 + 6)');
  // the posts: eight smooth sides (nine columns - the seam split - of two rows) and a flat top of eight, two posts
  assert.equal(verts(mesh.subMeshes[1]).size, 2 * (9 * 2 + 8), 'a smooth post welds round itself and keeps its seam');
  // the far floor's corner (-3, 21, 0) in Blender stands at (-3, 0, 21), its normal up
  const at = [];
  for (let i = 0; i < P.length; i += 3) if (P[i] === -3 && P[i + 1] === 0 && P[i + 2] === 21 && N[i + 1] === 1) at.push(i / 3);
  assert.equal(at.length, 1, 'the far floor\'s corner, up');
  // a wall's inner face: the west wall's +X face (Blender +X) faces +x
  assert.ok([...verts(mesh.subMeshes[6])].some((i) => P[i * 3] === -3 && N[i * 3] === 1 && N[i * 3 + 1] === 0 && N[i * 3 + 2] === 0), 'the west wall faces into the passage');
  assert.deepEqual([mesh.bounds.min, mesh.bounds.max], [[-4.5, -4, 0], [3.5, 6.6, 30]]);
  assert.equal(mesh.collider.length, 18 * 9, 'the proxy\'s 18 triangles, never the drawn 128');
  assert.deepEqual(mesh.collider.slice(0, 9), [-3, 0, 0, 3, 0, 9, 3, 0, 0], 'the proxy\'s floor, wound back through the mirror: (b - a) x (c - a) is (0, 54, 0), up');
  assert.deepEqual(mesh.origin, [0, 0, 0]);
  // a NON-UNIFORM scale (Mac's unapplied one): the Stair three times as tall - its normals the inverse transpose of its
  // placement (tools/shipBake.mjs sceneObjects `normal`), so every flat face's normal still stands square to it
  const bytes = committed(REF_FRAG_FBX), tree = readFbx(bytes);
  const stair = childrenNamed(nodeAt(tree.nodes, 'Objects'), 'Model').find((m) => m.props[1].startsWith('Stair'));
  childrenNamed(childNamed(stair, 'Properties70'), 'P').find((r) => r.props[0] === 'Lcl Scaling').props.splice(4, 3, 100, 100, 300);
  const tall = bake(bytes, tree).mesh, cob = tall.subMeshes.find((s) => s.material === 'cobble');
  let square = 0;
  for (let t = cob.startIndex; t < cob.startIndex + cob.primitiveCount * 3; t += 3) {
    const [a, b, c] = [0, 1, 2].map((k) => tall.indices[t + k]).map((i) => tall.positions.slice(i * 3, i * 3 + 3));
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]], l = Math.hypot(...n);
    const vn = tall.normals.slice(tall.indices[t] * 3, tall.indices[t] * 3 + 3);
    if ((n[0] * vn[0] + n[1] * vn[1] + n[2] * vn[2]) / l > 0.9999) square++;
  }
  assert.equal(square, cob.primitiveCount, 'the stretched stair\'s normals square to its faces');
  const ys = [...new Set(tall.indices.slice(cob.startIndex, cob.startIndex + cob.primitiveCount * 3))].map((i) => tall.positions[i * 3 + 1]);
  assert.deepEqual([Math.min(...ys), Math.max(...ys)], [-1.5, 3], 'the stair stretched three times about its own middle (0.75 m up)');
});

test('EG6c THE WRITER: the bake reads Blender 5.1\'s exports (tools/shipBake.mjs assertBlenderFill - its cut is the one Mac saw) and the port\'s own reference writer by its name, and refuses any other, naming it (mutants: the reference writer refused; any writer let through)', () => {
  const tree = readFbx(committed(REF_FRAG_FBX));
  assert.equal(assertFragSource(tree), 'port');
  const rows = childrenNamed(childNamed(nodeAt(tree.nodes, 'FBXHeaderExtension', 'SceneInfo'), 'Properties70'), 'P');
  const set = (app, version) => { for (const r of rows) { if (/ApplicationName$/.test(r.props[0])) r.props[4] = app; if (/ApplicationVersion$/.test(r.props[0])) r.props[4] = version; } };
  set('Blender (stable FBX IO)', '5.1.1');
  assert.equal(assertFragSource(tree), 'blender');
  set('Blender (stable FBX IO)', '5.0.1');
  assert.throws(() => assertFragSource(tree), /Blender 5\.0\.1/);
  set('Maya', '2025');
  assert.throws(() => assertFragSource(tree), /written by Maya/);
  set(FRAG_REF_WRITER, '1');
  rows.find((r) => r.props[0] === 'LastSaved|ApplicationName').props[4] = 'Maya';
  assert.throws(() => assertFragSource(tree), /not Blender/, 'both the writer and the last to save it');
});

test('EG6c THE MARKER NAMES (the grammar Mac names his markers by - tools/fragBake.mjs\'s header): each kind\'s words, a label of letters, digits, _ and -, Blender\'s .001 let be; a hazard\'s and an inner piece\'s clock words where the law leaves them free, never where it fixes them; art is any other name; a name it cannot read is refused, never taken for art (mutants: a word list widened; a clock word let through; the copy suffix kept)', () => {
  assert.equal(fragMarker('Floor_Near'), null, 'art');
  assert.equal(fragMarker('flooring.a'), null, 'art - the first word is a marker\'s or nothing');
  assert.deepEqual(fragMarker('floor.fight.near'), { kind: 'floor', fight: 1, label: 'near' });
  assert.deepEqual(fragMarker('floor.lip-2.001'), { kind: 'floor', fight: 0, label: 'lip-2' });
  assert.deepEqual(fragMarker('socket.in'), { kind: 'socket', out: 0, label: 'in' });
  assert.deepEqual(fragMarker('socket.out.low_road'), { kind: 'socket', out: 1, label: 'low_road' });
  assert.deepEqual(fragMarker('anchor.caster.b'), { kind: 'anchor', of: 'caster', label: 'b' });
  assert.deepEqual(fragMarker('light.moon.a'), { kind: 'light', of: 'moon', label: 'a' });
  assert.deepEqual(fragMarker('alcove.jump.page.a'), { kind: 'alcove', seal: 'jump', holds: 'page', label: 'a' });
  assert.deepEqual(fragMarker('hazard.wisp.a.per9000.ph300'), { kind: 'hazard', of: 'wisp', label: 'a', clock: { per: 9000, ph: 300 } });
  assert.deepEqual(fragMarker('course.drift.b.amp100.per5000.ph900.002'), { kind: 'course', of: 'drift', label: 'b', clock: { amp: 100, per: 5000, ph: 900 } });
  assert.deepEqual(fragMarker('course.moon.m.beat1200'), { kind: 'course', of: 'moon', label: 'm', clock: { beat: 1200 } });
  assert.deepEqual(fragMarker('edge.x'), { kind: 'edge', label: 'x' });
  for (const [name, why] of [
    ['floor', /a floor marker is 2 words/], ['floor.fight', /a floor marker is 3 words/], ['floor.a.b', /a floor marker is 2 words/], ['floor.a b', /no label/],
    ['socket.side', /socket\.in or socket\.out/], ['socket.in.x', /2 words/], ['anchor.boss.a', /"boss" is not one of rift/], ['light.sun.a', /"sun" is not one of band/],
    ['alcove.door.page.a', /"door" is not one of seam/], ['alcove.seam.gold.a', /"gold" is not one of lumen/], ['hazard.flame.a', /"flame" is not one of/],
    ['hazard.wisp.a', /a wisp says its cycle/], ['hazard.fall.a.amp100', /"amp100" is not one of per<n>, ph<n>/], ['hazard.fall.a.ph100.ph200', /"ph" said twice/],
    ['course.hover.a', /"hover" is not one of/], ['course.drift.a.amp100', /a drift says its per<n>/], ['course.rail.a.per4000', /a rail says its amp<n>/],
    ['course.drum.a.amp150.per5000', /"per5000" is not one of amp<n>, ph<n>/], ['course.ledge.a.amp5', /"amp5": a ledge says no clock words/], ['course.slag.a.per20000', /"per20000" is not one of ph<n>/],
    ['course.pend.a', /a pend says its per<n>/], ['node.a.b', /a node marker is 2 words/],
  ]) assert.throws(() => fragMarker(name), why, name);
});

test('EG6c AN INNER PIECE\'S CLOCK (section 10.3 - every piece at its own timing, NOTHING GETS FASTER): a piece\'s top and footprint snapped whole about its middle; its name\'s clock; a Drum rolling at the law\'s EG_DRUM_MPS whatever its travel, a Moon branch\'s beams every EG_MOON_EVERY_S, a slag crossing\'s two spouts every EG_SLAG_CYCLE_S EG_SLAG_LANE_CM either side - net/eliteGates/egFragLaw.js egFragPassage\'s own (mutants: a drum\'s roll at its name\'s pace; a moon\'s period nought; the slag\'s lanes unspread)', () => {
  assert.deepEqual(fragPiece(fragMarker('course.drift.b.amp100.per5000.ph900'), [-150, -80, 1400, 151, 0, 1640]), { kind: 'drift', x: 1, y: 0, z: 1520, w: 302, d: 240, amp: 100, period: 5000, phase: 900, beat: 0, gap: 0, after: 0 });
  assert.equal(fragPiece(fragMarker('course.drum.d.amp150'), [-150, -80, 0, 150, 0, 300]).period, 3000, '4 x 1.5 m at 2.0 m/s');
  assert.equal(fragPiece(fragMarker('course.drum.d.amp100.ph300'), [-150, -80, 0, 150, 0, 300]).period, 2000);
  assert.deepEqual(['period', 'beat', 'phase'].map((k) => fragPiece(fragMarker('course.moon.m.ph500.beat1200'), [-140, 0, 0, 140, 50, 220])[k]), [4000, 1200, 500]);
  assert.deepEqual(['amp', 'period'].map((k) => fragPiece(fragMarker('course.slag.s.ph100'), [-200, 0, 0, 200, 0, 300])[k]), [205, 20000]);
  assert.deepEqual(['amp', 'period', 'beat'].map((k) => fragPiece(fragMarker('course.beat.t.beat1800'), [-150, 0, 0, 150, 0, 260])[k]), [0, 0, 1800]);
});

test('EG6c THE ART AND THE OUTLINES REFUSED BY NAME: art wearing anything but its band\'s dress, or carrying no normals or no UV map; a floor not flat, not one outline, or with a hole; a socket not upright across the course, or two mouths; an edge that misses a node or meets one at both ends; an open marker that opens nothing; an alcove on the course\'s line; a hazard not in its kind\'s shape (a lane not a rectangle, two lanes where one is said, spots of two sizes) (mutants: each refusal\'s test)', () => {
  const R = refFragMesh;
  const cases = [
    [(s) => swap(s, 'Magma', R('Magma', ['lava']).level(-3, 9, 3, 21, -4)), /Magma polygon #0: it wears "lava"/],
    [(s) => swap(s, 'Magma', R('Magma', []).level(-3, 9, 3, 21, -4)), /Magma polygon #0: it wears no material/],
    [(s) => swap(s, 'floor.threshold', R('floor.threshold').face([[-3, 0, 0], [3, 0, 0], [3, 1.5, 0.05], [-3, 1.5, 0.05]])), /floor\.threshold: not flat/],
    [(s) => swap(s, 'floor.fight.far', R('floor.fight.far').level(-3, 21, 3, 25, 0).level(-3, 26, 3, 30, 0)), /floor\.fight\.far: not one outline/],
    [(s) => { const ring = R('floor.fight.far'); for (const [x0, x1] of [[-3, -1], [-1, 1], [1, 3]]) for (const [z0, z1] of [[21, 24], [24, 27], [27, 30]]) if (x0 !== -1 || z0 !== 24) ring.level(x0, z0, x1, z1, 0); swap(s, 'floor.fight.far', ring); }, /floor\.fight\.far: not one outline \(4 corners in another loop\)/],
    [(s) => swap(s, 'floor.fight.far', R('floor.fight.far').level(-3, 21, 0, 25, 0).level(0, 25, 3, 30, 0)), /floor\.fight\.far: not one outline \(a corner at 0,0,2500 cm meets 4 edges of it\)/],
    [(s) => swap(s, 'hazard.fall.lip.ph1500', R('hazard.fall.lip.ph1500').face([[-3, 7.8, 0], [3, 7.8, 0], [2.5, 9, 0], [-2.5, 9, 0]])), /hazard\.fall\.lip\.ph1500: not a rectangle$/],
    [(s) => s.push(R('node.extra').disc(0, 5.3, 0, 0.5)), /an end of it meets 2 nodes/],
    [(s) => swap(s, 'socket.out.main', R('socket.out.main').level(-2.5, 29.5, 0.5, 30, 0)), /socket\.out\.main: a socket stands upright across the course/],
    [(s) => s.push(R('socket.in.001').across(-2, 2, 0, 0, 4)), /one mouth \(socket\.in\) and this scene has 2/],
    [(s) => swap(s, 'edge.lipnear', R('edge.lipnear').strip([0, 5, 0], [0, 7.5, 0], 0.2)), /edge\.lipnear: an end of it meets 0 nodes/],
    [(s) => swap(s, 'edge.lipnear', R('edge.lipnear').strip([0, 4.85, 0], [0, 5.15, 0], 0.2)), /edge\.lipnear: both its ends on one node/],
    [(s) => s.push(R('open.nothing').box(-0.1, 4, -0.05, 0.1, 4.2, 0.05)), /open\.nothing: opens no floor's edge/],
    [(s) => swap(s, 'alcove.seam.shard.west', R('alcove.seam.shard.west').box(-0.5, 4.4, 0, 0.5, 5.6, 2.2)), /an alcove stands to one side of the course/],
    [(s) => swap(s, 'hazard.fall.lip.ph1500', R('hazard.fall.lip.ph1500').face([[-3, 7.8, 0], [3, 7.8, 0], [0, 9, 0]])), /hazard\.fall\.lip\.ph1500: not a rectangle \(3 corners\)/],
    [(s) => swap(s, 'hazard.surge.channel.per8000.ph2000', R('hazard.surge.channel.per8000.ph2000').level(-3, 21.5, 1, 25, 0).level(-3, 26, 1, 29.5, 0)), /a surge is one sh \(2 parts\)/],
    [(s) => swap(s, 'hazard.basalt.near.ph700', R('hazard.basalt.near.ph700').disc(0.5, 4, 0, 2.5).disc(-0.5, 6.4, 0, 2.3)), /its parts are not one size \(250, 230 cm\)/],
    [(s) => swap(s, 'hazard.basalt.near.ph700', R('hazard.basalt.near.ph700').level(-2, 2, 2, 5, 0)), /not a disc \(400 by 300 cm\)/],
  ];
  for (const [edit, why] of cases) assert.throws(() => bake(sceneWith(edit)), why, String(why));
  assert.throws(() => bakeFrag(committed(REF_FRAG_FBX), { ...SPEC, kit: 'nope' }), /kit nope: no such fragment \(net\/eliteGates\/egFragLaw\.js EG_FRAGS\)/);
  // a material Blender copied (`molten.001`) is still its record
  const copied = bake(sceneWith((s) => swap(s, 'Magma', R('Magma', ['molten.001']).level(-3, 9, 3, 21, -4)))).mesh;
  assert.deepEqual(copied.subMeshes.find((m) => m.record === EG_DRESS.molten), { material: 'molten', record: 33, startIndex: 252, primitiveCount: 2 });
  // art with no normals, or no UV map: the export's layers taken out of the parsed tree
  for (const [layer, why] of [['LayerElementNormal', /Magma: art carries no normals/], ['LayerElementUV', /Magma: art carries no UV map/]]) {
    const bytes = committed(REF_FRAG_FBX), tree = readFbx(bytes);
    const geo = childrenNamed(nodeAt(tree.nodes, 'Objects'), 'Geometry').find((g) => g.props[1].startsWith('Magma'));
    geo.children = geo.children.filter((c) => c.name !== layer);
    assert.throws(() => bake(bytes, tree), why);
  }
});

test('EG6c THE CEILING CLAMP AT BAKE TIME (sections 10.5, 11.7 and 11.8): a passage\'s floor keeps 3.5 m under its ceiling and a ceiling 4.5 m over every inner piece, so the clamp never cuts a proven flight short - 4.4 m over the first ledge is refused and 4.5 m stands; a floor half under a ceiling is refused (it is clamped to one ceiling or open to the sky); a balcony\'s 3.4 m refused (mutants: the course\'s headroom unasked; the class\'s headroom; half under let through)', () => {
  const R = refFragMesh;
  const ceil = (z, y1 = 13) => (s) => swap(s, 'ceil.near', R('ceil.near').level(-3, 0, 3, y1, z, 0, true));
  assert.throws(() => bake(sceneWith(ceil(4.4))), /course\[0\] \(ledge\): the ceiling 440 cm over its top - the clamp would cut a proven flight short/);
  assert.equal(lawOf(sceneWith(ceil(4.5))).ceil[1].y, 450, 'the fast build\'s 4.5 m stands');
  assert.throws(() => bake(sceneWith(ceil(3.4))), /floors\[2\]: 340 cm of headroom where a passage keeps 350/);
  assert.throws(() => bake(sceneWith(ceil(6, 5))), /floors\[2\] stands half under a ceiling/);
  assert.throws(() => bake(sceneWith((s) => swap(s, 'ceil.far', R('ceil.far').level(-3, 17, 3, 30, 4.9, 0, true)))), /floors\[0\]: 340 cm of headroom/, 'the balcony, 1.5 m up');
  // the sky over the whole fragment: no ceiling, nothing clamped
  const open = lawOf(sceneWith((s) => { swap(s, 'ceil.near'); swap(s, 'ceil.far'); }));
  assert.equal(open.ceil, null, 'open to the sky');
});

test('EG6c VOLUMES STAND APART AT BAKE TIME (section 11.5): the box holds every drawn vertex, every marker and every inner piece\'s travel; the mouth is its -Z face and the exits its +Z face, so a laying that keeps boxes 2 m apart joins the course at the sockets - anything behind the mouth or past an exit is refused; a course with no ground after it, or none before it, refused; an inner course THE TIMED SOLVER does not prove refused (mutants: the box short of a drift\'s swing; a socket off its face let be; the proof unasked)', () => {
  const R = refFragMesh;
  const swing = lawOf(sceneWith((s) => swap(s, 'course.drift.b.amp100.per5000.ph900', R('course.drift.b.amp300.per5000.ph900').box(-1.5, 14, -0.8, 1.5, 16.4, 0))));
  assert.equal(swing.box[0], -450, 'the niche still the west end');
  assert.equal(swing.box[3], 450, 'a 3 m swing reaches 4.5 m east of the course - past the walls - and the box holds it');
  assert.throws(() => bake(sceneWith((s) => swap(s, 'Niche', R('Niche', ['pillar']).box(-4.5, -0.5, 0, -3.5, 1, 2.2)))), /the mouth is not the box's -Z face \(the box runs 50 cm behind it\)/);
  assert.throws(() => bake(sceneWith((s) => swap(s, 'Magma', R('Magma', ['molten']).level(-3, 9, 3, 31, -4)))), /sockets\.out\[0\]: not on the box's \+Z face \(100 cm short of it\)/);
  assert.throws(() => bake(sceneWith((s) => s.push(R('course.ledge.z').box(-1.2, 30.5, -0.8, 1.2, 31, 0)))), /course\.ledge: no ground after it to land on/);
  assert.throws(() => bake(sceneWith((s) => s.push(R('course.ledge.z').box(-1.2, -2, -0.8, 1.2, -1, 0)))), /course\.ledge: nothing before it to leave from/);
  assert.throws(() => bake(sceneWith((s) => swap(s, 'course.ledge.c'))), /egRefFrag: its inner course is not proven - 1>ground: a window of 0\.00 s/);
  assert.throws(() => bake(sceneWith((s) => s.push(R('light.band.x').box(0, 26, 3, 0.2, 26.2, 3.2), R('light.band.y').box(0, 20, 3, 0.2, 20.2, 3.2)))), /cost\.lights: 5 past the fragment's budget of 4/);
  assert.throws(() => bake(sceneWith((s) => swap(s, 'hazard.surge.channel.per8000.ph2000', R('hazard.surge.channel.per8000.ph2000').level(-2.9, 21.5, 1, 29.5, 0)))), /hazards\[2\]: surge: narrower than 4 m/, 'THE WIDTH RULE, at bake time');
});

test('EG6c EVERY HAZARD\'S SHAPE (net/eliteGates/egFragLaw.js EG_HAZARD_SHAPES - the generator\'s own): the cascade\'s shelves (one rectangle each, falling along +Y, each lane its capsule), a wisp\'s path (its swing\'s rectangle, its cycle said), the mist\'s line, the tide\'s disc, the Eclipse\'s ring (its havens\' reach in the box), the hammers\' spots and a spill\'s lane - each baked to its kind\'s fields and held to its law (mutants: a shape\'s branch misread; the cascade unordered; the ring taken for a reach)', () => {
  const R = refFragMesh;
  const law = lawOf(sceneWith((s) => s.push(
    R('hazard.cascade.shelves.ph300').level(-3, 26, 3, 30, 0).level(-3, 21.5, 3, 25.5, 0),
    R('hazard.wisp.ghost.per9000').level(-2, 2, 2, 8, 1.2),
    R('hazard.mist.below.ph200').level(-3, 9, 3, 21, -3),
    R('hazard.tide.pool').disc(0, 25.5, 0, 2.5),
    R('hazard.eclipse.moon').disc(0, 25, 0, 2),
    R('hazard.hammer.drop').disc(0, 26.5, 0, 3).disc(0, 23.5, 0, 3),
    R('hazard.slag.spill').level(-3, 22, 1, 29, 0),
  )));
  const by = Object.fromEntries(law.hazards.map((h) => [h.kind, h]));
  const blank = { x: 0, y: 0, z: 0, w: 0, r: 0, ring: 0, period: 0, phase: 0, sh: null, spots: null, lanes: null, path: null };
  assert.deepEqual(by.cascade, { ...blank, kind: 'cascade', w: 400, phase: 300, lanes: [[-100, 2350, 100, 2350], [-100, 2800, 100, 2800]] }, 'the near shelf first');
  assert.deepEqual(by.wisp, { ...blank, kind: 'wisp', y: 120, period: 9000, path: [0, 500, 200, 300] });
  assert.deepEqual(by.mist, { ...blank, kind: 'mist', y: -300, phase: 200 });
  assert.deepEqual(by.tide, { ...blank, kind: 'tide', x: 0, z: 2550, r: 250 });
  assert.deepEqual(by.eclipse, { ...blank, kind: 'eclipse', x: 0, z: 2500, ring: 200 });
  assert.deepEqual(by.hammer, { ...blank, kind: 'hammer', r: 300, spots: [[0, 2350], [0, 2650]] });
  assert.deepEqual(by.slag, { ...blank, kind: 'slag', w: 400, sh: [-100, 2400, -100, 2700] });
  assert.deepEqual(law.box.slice(0, 1).concat(law.box.slice(3, 4)), [-500, 500], 'the Eclipse\'s havens reach 5 m from its middle, and the box holds them');
});

test('EG6c THE BAKE\'S TOLERANCES: an open marker opens an edge within EG_FRAG_SOCKET_TOL_CM (10 cm) of it and no further; an edge strip\'s end meets a node within a metre of its height and no further; a mouth stands exactly in its own middle however its width rounds; an opening\'s snapped width that reaches past the scene\'s points widens the box with it (mutants: the open marker\'s reach; the node\'s height; the box without the sockets)', () => {
  const R = refFragMesh;
  assert.deepEqual(lawOf(sceneWith((s) => swap(s, 'open.lipnear', R('open.lipnear').box(-2.95, 8.85, -0.05, 2.95, 8.95, 0.05)))).open, lawOf(committed(REF_FRAG_FBX)).open, '5 cm short of the lip, it still opens it');
  assert.throws(() => bake(sceneWith((s) => swap(s, 'open.lipnear', R('open.lipnear').box(-3.1, 8.7, -0.05, 3.1, 8.88, 0.05)))), /open\.lipnear: opens no floor's edge/, '12 cm short');
  assert.throws(() => bake(sceneWith((s) => swap(s, 'open.lipnear', R('open.lipnear').box(-3.1, 8.95, 0.12, 3.1, 9.05, 0.2)))), /open\.lipnear: opens no floor's edge/, '12 cm over the floor');
  assert.deepEqual(lawOf(sceneWith((s) => swap(s, 'edge.lipnear', R('edge.lipnear').strip([0, 5, 0.9], [0, 8.3, 0.9], 0.2)))).graph.edges, lawOf(committed(REF_FRAG_FBX)).graph.edges, 'a strip 0.9 m over its nodes still joins them');
  assert.throws(() => bake(sceneWith((s) => swap(s, 'edge.lipnear', R('edge.lipnear').strip([0, 5, 1.1], [0, 8.3, 1.1], 0.2)))), /edge\.lipnear: an end of it meets 0 nodes/, '1.1 m over them, it does not');
  const odd = lawOf(sceneWith((s) => swap(s, 'socket.in', R('socket.in').across(-2.005, 2.005, 0, 0, 4))));
  assert.deepEqual([odd.sockets.in.x, odd.sockets.in.w], [0, 402], 'a mouth 4.01 m wide stands in its own middle');
  const wide = lawOf(sceneWith((s) => swap(s, 'socket.out.balcony', R('socket.out.balcony').across(1.5, 3.51, 30, 1.5, 5.5, 0, true))));
  assert.deepEqual([wide.sockets.out[0].x, wide.sockets.out[0].w, wide.box[3]], [251, 202, 352], 'its snapped width past the walls, and the box with it');
});

test('EG6c THE --list: every object as the bake reads it - a marker and what it says, art and what it wears, a name it cannot read said so (mutants: art listed as a marker)', () => {
  const lines = listFrag(sceneWith((s) => s.push(refFragMesh('hazard.flame.a').level(0, 1, 1, 2, 0))));
  assert.match(lines.find((l) => l.startsWith('Floor_Near')), /art: floor, pillar {2}3 faces$/);
  assert.match(lines.find((l) => l.startsWith('floor.fight.near')), /floor \(fight\) {2}2 faces$/);
  assert.match(lines.find((l) => l.startsWith('anchor.rift.west')), /anchor rift {2}6 faces$/);
  assert.match(lines.find((l) => l.startsWith('hazard.flame.a')), /REFUSED: hazard\.flame\.a: "flame" is not one of/);
});

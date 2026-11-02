// EG6c (2026-10-12, bible/11-Multiplayer/Elite-Gates.md sections 10.5, 11.5, 11.6 and 11.9): A BAKED FRAGMENT'S LAW HALF,
// READ - net/eliteGates/egFragLaw.js's reader (egFragRecordFault) and the queries a laying asks of a record (the ceiling over a point,
// two volumes apart, its course as a hall's steps, its hazards as a hall's), the registries a baked fragment is laid from
// (net/eliteGates/egHeroFrags.js, world/eliteGates/egHeroFragModel.js) and the mesh kit's `mesh`. Every fixture is the reference fragment's
// committed record and mesh as tools/fragBake.mjs minted them (TEST THE SHAPE THE PRODUCER MINTS); each rule is pinned by
// the one fault that breaks it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  egFragRecordFault, egFragCeilAt, egFragApart, egFragBoxAt, egFragSwept, egFragSteps, egFragHazards, egFragInPoly, egFragArea2, egFragHazardPlan,
  egHazardParts, egHazardLawful, EG_FRAG_APART_CM, EG_FRAG_HEADROOM_CM, EG_FRAG_BUDGET, EG_FRAG_SOCKET_TOL_CM, EG_HAZARD_SHAPES, EG_HAZARDS,
} from '../../../src/net/eliteGates/egFragLaw.js';
import { egSpanProof, egRoadCross } from '../../../src/net/eliteGates/egSpanLaw.js';
import { EG_HERO_FRAGS, EG_HERO_REFERENCE, egHeroFragLaws, egHeroFragRegistry } from '../../../src/net/eliteGates/egHeroFrags.js';
import { EG_HERO_FRAG_MESHES, egHeroFragInto, egHeroFragModel, egHeroFragCollider, egHeroFragMeshes } from '../../../src/world/eliteGates/egHeroFragModel.js';
import { createMeshKit } from '../../../src/world/eliteGates/meshKit.js';
import { EG_BAND_ARCHIVES } from '../../../src/world/eliteGates/pseudoArchives.js';

const read = (rel) => JSON.parse(readFileSync(new URL(`../../../${rel}`, import.meta.url), 'utf8'));
const LAW = read('src/assets/egfrags/egRefFrag.law.json');
const MESH = read('src/assets/egfrags/egRefFrag.mesh.json');
/** The reference's record with one fault made (`edit` changes a deep copy). */
const faulted = (edit) => { const r = structuredClone(LAW); edit(r); return egFragRecordFault(r); };
const refuses = (edit, why, what) => assert.ok(faulted(edit).some((f) => why.test(f)), `${what}: ${JSON.stringify(faulted(edit))}`);

test('EG6c THE READER (section 11.5): the reference\'s record is sound, and each rule refuses the one fault that breaks it - the version, whole numbers, the kit\'s band, class and reverb, a chamber\'s play, the volume, the mouth and the exits on its faces, the openings\' height, the floors, ramps and open edges, the walk graph on its ground, the anchors\' places, the hazards\' shapes and law, the course along +Z, the alcoves, the lights, the budget and the proof (mutants: each rule\'s test)', () => {
  assert.deepEqual(egFragRecordFault(LAW), []);
  assert.deepEqual(egFragRecordFault({ ...LAW, v: 2 }), ['not a fragment record of version 1']);
  assert.deepEqual(egFragRecordFault(null), ['not a fragment record of version 1']);
  const cases = [
    [(r) => { r.floors[0].y = 150.5; }, /record\.floors\[0\]\.y: 150\.5 is not whole/, 'a float'],
    [(r) => { r.kit = 'nope'; }, /kit nope: no such fragment/, 'the kit'],
    [(r) => { r.band = 1; }, /band 1: caverns is band 0's/, 'the band'],
    [(r) => { r.class = 'tube'; }, /class tube: caverns is passage, chamber, shaft/, 'the class'],
    [(r) => { r.reverb = 'quarry'; }, /reverb quarry: caverns's is cave/, 'the reverb'],
    [(r) => { r.play = ['dance']; }, /play \["dance"\]: not among balcony, arch, surge, engine/, 'a play'],
    [(r) => { r.class = 'chamber'; }, /a chamber names its play/, 'a chamber with no play'],
    [(r) => { r.class = 'chamber'; r.play = ['arch']; for (const f of r.floors) f.fight = 0; }, /a chamber with no fight floor/, 'a chamber\'s fight floor'],
    [(r) => { r.box[3] = r.box[0]; }, /box: not a volume/, 'the box'],
    [(r) => { r.sockets.in.yaw = 0; }, /sockets\.in: the mouth stands at the origin facing -Z/, 'the mouth\'s facing'],
    [(r) => { r.sockets.in.x = 1; }, /sockets\.in: the mouth stands at the origin/, 'the mouth\'s place'],
    [(r) => { r.box[2] = -EG_FRAG_SOCKET_TOL_CM - 1; }, /the mouth is not the box's -Z face \(the box runs 11 cm behind it\)/, 'behind the mouth'],
    [(r) => { r.sockets.out = []; }, /sockets\.out: no exit/, 'no exit'],
    [(r) => { r.sockets.out[0].yaw = 180; }, /sockets\.out\[0\]: an exit faces \+Z/, 'an exit\'s facing'],
    [(r) => { r.sockets.out[1].z = 3000 - EG_FRAG_SOCKET_TOL_CM - 1; }, /sockets\.out\[1\]: not on the box's \+Z face \(11 cm short of it\)/, 'an exit off its face'],
    [(r) => { r.sockets.out[1].h = 349; }, /sockets\.out\[1\]: 300 by 349 cm - an opening at least 350 cm high/, 'a crouch'],
    [(r) => { r.sockets.in.w = 0; }, /sockets\.in: 0 by 400 cm/, 'a mouth with no width'],
    [(r) => { r.floors = []; }, /^no floor$/, 'no floor'],
    [(r) => { r.floors[1].poly.reverse(); }, /floors\[1\]: not a counter-clockwise polygon/, 'a floor wound backward'],
    [(r) => { r.floors[1].poly = r.floors[1].poly.slice(0, 2); }, /floors\[1\]: not a counter-clockwise polygon/, 'a floor of two corners'],
    [(r) => { r.ramps[0].poly.reverse(); }, /ramps\[0\]: not a counter-clockwise polygon/, 'a ramp wound backward'],
    [(r) => { r.ramps[0].y1 = 140; }, /ramps\[0\]: rises from 0 to 140 over corners that say otherwise/, 'a ramp\'s rise'],
    [(r) => { r.ramps[0].y0 = 150; }, /ramps\[0\]: rises from 150 to 150/, 'a ramp that does not rise'],
    [(r) => { r.ramps[0].poly = r.ramps[0].poly.map((p) => [p[0], 0, p[2]]); r.ramps[0].y1 = 0; }, /ramps\[0\]: rises from 0 to 0/, 'a ramp flat at every corner'],
    [(r) => { r.open.push([9, 0]); }, /open\[9\]: floor 9 has no edge 0/, 'an open edge of no floor'],
    [(r) => { r.open.push([0, 4]); }, /open\[9\]: floor 0 has no edge 4/, 'an open edge past a floor\'s'],
    [(r) => { r.ceil[0].poly.reverse(); }, /a ceiling is not a counter-clockwise polygon/, 'a ceiling wound backward'],
    [(r) => { r.graph.nodes[0][3] = 0; }, /graph\.nodes\[0\]: no reach/, 'a node with no reach'],
    [(r) => { r.graph.nodes[1][1] = 51; }, /graph\.nodes\[1\] stands on no floor and no ramp/, 'a node in the air'],
    [(r) => { r.graph.nodes[2][2] = 1500; }, /graph\.nodes\[2\] stands on no floor and no ramp/, 'a node over the chasm'],
    [(r) => { r.graph.edges[0] = [6, 0]; }, /graph\.edges\[0\]: \[6,0\] is not two nodes, lowest first/, 'an edge backward'],
    [(r) => { r.graph.edges[0] = [0, 7]; }, /graph\.edges\[0\]: \[0,7\] is not two nodes/, 'an edge to no node'],
    [(r) => { r.graph.edges.push([0, 6]); }, /graph\.edges\[6\]: twice/, 'an edge twice'],
    [(r) => { r.anchors.boss = []; }, /anchors\.boss: no such place/, 'an unknown place'],
    [(r) => { r.anchors.lurker[0][2] = 3001; }, /anchors\.lurker stands outside the fragment's box/, 'an anchor outside'],
    [(r) => { r.hazards[0].kind = 'flame'; }, /hazards\[0\]: no hazard flame/, 'an unknown hazard'],
    [(r) => { r.hazards[0].sh = [0, 400, 0, 600]; }, /hazards\[0\] \(basalt\): not said as its spots/, 'a hazard in another\'s shape'],
    [(r) => { r.hazards[2].sh = null; }, /hazards\[2\] \(surge\): not said as its sh/, 'a lane with no line'],
    [(r) => { r.hazards[2].w = 390; }, /hazards\[2\]: surge: narrower than 4 m/, 'THE WIDTH RULE'],
    [(r) => { r.hazards[0].r = 190; }, /hazards\[0\]: basalt: narrower than 4 m/, 'THE WIDTH RULE on a disc'],
    [(r) => { r.hazards[1].sh[2] = 500; }, /hazards\[1\] \(fall\) stands outside the fragment's box/, 'a hazard outside'],
    [(r) => { r.course[1].gap = -1; }, /course\[1\] \(drift\): its size, gap or ground after it/, 'a negative gap'],
    [(r) => { r.course[2].w = 0; }, /course\[2\] \(ledge\): its size/, 'a piece of no width'],
    [(r) => { r.course[2].after = -1; }, /course\[2\] \(ledge\): its size, gap or ground after it/, 'a negative ground after'],
    [(r) => { r.course[1].z = 1150; }, /course\[1\] \(drift\): stands over the piece before it/, 'the course out of order'],
    [(r) => { r.course[1].amp = 351; }, /course\[1\] \(drift\) stands outside the fragment's box/, 'a swing past the box'],
    [(r) => { r.course[2].z = 2950; }, /course\[2\] \(ledge\) stands outside the fragment's box/, 'a piece past the box\'s far end'],
    [(r) => { r.alcoves[0].seal = 'door'; }, /alcoves\[0\]: a door seal holding shard on side -1/, 'an alcove\'s seal'],
    [(r) => { r.alcoves[0].holds = 'gold'; }, /alcoves\[0\]: a seam seal holding gold/, 'an alcove\'s keep'],
    [(r) => { r.alcoves[0].side = 0; }, /alcoves\[0\]: a seam seal holding shard on side 0/, 'an alcove\'s side'],
    [(r) => { r.alcoves[0].x = -451; }, /alcoves\[0\] stands outside the fragment's box/, 'an alcove outside'],
    [(r) => { r.lights[0][3] = 'sun'; }, /lights\[0\]: no light sun/, 'a light\'s kind'],
    [(r) => { r.lights[0][1] = 661; }, /lights\[0\] stands outside the fragment's box/, 'a light outside'],
    [(r) => { r.cost.tris = EG_FRAG_BUDGET.tris + 1; }, /cost\.tris: 12001 past the fragment's budget of 12000/, 'the drawn budget'],
    [(r) => { r.cost.collider = EG_FRAG_BUDGET.collider + 1; }, /cost\.collider: 3001 past/, 'the collider\'s budget'],
    [(r) => { r.cost.draws = EG_FRAG_BUDGET.draws + 1; }, /cost\.draws: 13 past/, 'the draws\' budget'],
    [(r) => { r.cost.draws = -1; }, /cost\.draws: -1 past/, 'a cost below nought'],
    [(r) => { r.cost.lights = 2; }, /cost\.lights: 2 where it carries 3/, 'the lights counted'],
    [(r) => { r.lights.push([0, 300, 1000, 'band'], [0, 300, 2000, 'band']); r.cost.lights = 5; }, /cost\.lights: 5 past the fragment's budget of 4/, 'the lights\' budget'],
    [(r) => { r.proof.crossSlow = r.proof.crossFast - 1; }, /proof: .* is not a crossing's bounds/, 'a median under the fastest'],
    [(r) => { r.proof.moves = 0; }, /proof: .* is not a crossing's bounds/, 'a course with no moves'],
    [(r) => { r.proof = null; }, /proof: null is not a crossing's bounds/, 'no proof'],
  ];
  for (const [edit, why, what] of cases) refuses(edit, why, what);
  // a node on the stair stands on its ramp; one over it on nothing
  assert.deepEqual(faulted((r) => { r.graph.nodes.push([225, 75, 2375, 50]); }), [], 'a node on the stair');
  refuses((r) => { r.graph.nodes.push([225, 260, 2375, 50]); }, /graph\.nodes\[7\] stands on no floor and no ramp/, 'a node over the stair');
  // the bounds, met exactly, stand
  assert.deepEqual(faulted((r) => { r.box[2] = -EG_FRAG_SOCKET_TOL_CM; r.sockets.out[1].z = 3000 - EG_FRAG_SOCKET_TOL_CM; r.sockets.out[1].h = 350; r.hazards[2].w = 400; r.cost.tris = EG_FRAG_BUDGET.tris; r.graph.nodes[1][1] = 50; }), []);
  assert.deepEqual(faulted((r) => { r.course = []; r.proof = { crossFast: 0, crossSlow: 0, moves: 0 }; }), [], 'a fragment with no inner course proves nothing');
});

test('EG6c THE CEILING CLAMP (sections 10.5, 11.7 and 11.8), read: the ceiling over a point is the lowest standing above it whose outline holds it, edges its own - null under the open sky; a floor wholly under a ceiling keeps its class\'s headroom (a passage 3.5 m, a chamber 6 m), a ramp a passage\'s, an inner piece the fast build\'s 4.5 m over all its travel; a floor half under one is refused; every number exact at its bound (mutants: a ceiling below counted; the open sky clamped; the class\'s headroom; the course\'s; the half-under rule)', () => {
  assert.deepEqual(EG_FRAG_HEADROOM_CM, { passage: 350, chamber: 600, shaft: 350, course: 450 });
  assert.equal(egFragCeilAt(LAW, 0, 1100, 0), 600);
  assert.equal(egFragCeilAt(LAW, 0, 1500, 0), null, 'the burning sky over the chasm');
  assert.equal(egFragCeilAt(LAW, 300, 1300, 0), 600, 'the ceiling\'s edge its own');
  assert.equal(egFragCeilAt(LAW, 0, 1100, 600), null, 'nothing over the vault');
  assert.equal(egFragCeilAt({ ceil: [{ y: 900, poly: [[-100, 0], [100, 0], [100, 100], [-100, 100]] }, { y: 500, poly: [[-100, 0], [100, 0], [100, 100], [-100, 100]] }] }, 0, 50, 0), 500, 'the lowest over it');
  assert.equal(egFragCeilAt({ ceil: null }, 0, 0, 0), null);
  const near = (y) => (r) => { r.ceil[1].y = y; };
  refuses(near(449), /course\[0\] \(ledge\): the ceiling 449 cm over its top/, 'the first ledge under 4.5 m');
  assert.deepEqual(faulted(near(450)), [], '4.5 m over the first ledge stands');
  refuses(near(349), /floors\[2\]: 349 cm of headroom where a passage keeps 350/, 'a passage\'s floor');
  refuses((r) => { r.ceil[0].y = 499; }, /floors\[0\]: 349 cm of headroom/, 'the balcony, 1.5 m up');
  refuses((r) => { r.ceil[1].poly = [[300, 0], [300, 500], [-300, 500], [-300, 0]]; }, /floors\[2\] stands half under a ceiling/, 'half under');
  refuses((r) => { r.ceil[1].poly = [[-300, 0], [300, 0], [300, 1300], [50, 1300], [50, 850], [-50, 850], [-50, 1300], [-300, 1300]]; }, /floors\[2\] stands half under a ceiling/, 'a ceiling notched over the middle of a floor\'s edge, its corners all under it');
  refuses((r) => { r.ramps[0].poly[1][1] = 151; r.ramps[0].y1 = 151; r.ceil[0].y = 500; }, /ramps\[0\]: 349 cm of headroom at a corner, under 350/, 'a ramp\'s top');
  refuses((r) => { r.class = 'chamber'; r.play = ['balcony']; }, /floors\[0\]: 450 cm of headroom where a chamber keeps 600/, 'a chamber\'s 6 m');
  // a drift's swing under a ceiling: its travel's corners asked, not only its middle
  refuses((r) => { r.ceil.push({ y: 400, poly: [[220, 1300], [400, 1300], [400, 1700], [220, 1700]] }); r.box[3] = 400; }, /course\[1\] \(drift\): the ceiling 400 cm over its top/, 'a ceiling over the swing\'s far end');
  // no ceiling at all: the sky over everything, nothing clamped
  assert.deepEqual(faulted((r) => { r.ceil = null; }), []);
});

test('EG6c VOLUMES STAND APART (section 11.5): two boxes are apart when one stands at least EG_FRAG_APART_CM (2 m) clear of the other along some axis - exactly 2 m stands, 1.99 m is refused, along each of x, y and z and either way; a record\'s box laid where its origin is; an inner piece\'s swept box its travel (a Drift\'s and a spill\'s across, a Rail\'s and a Drum\'s along, a Pendulum\'s weight over its gap, a Sink\'s fall) (mutants: the margin; an axis forgotten; a travel unswept)', () => {
  assert.equal(EG_FRAG_APART_CM, 200);
  const B = LAW.box, size = [B[3] - B[0], B[4] - B[1], B[5] - B[2]];
  assert.deepEqual(egFragBoxAt(LAW, 100, 200, 300), [B[0] + 100, B[1] + 200, B[2] + 300, B[3] + 100, B[4] + 200, B[5] + 300]);
  for (let k = 0; k < 3; k++) for (const s of [1, -1]) {
    const off = (gap) => { const o = [0, 0, 0]; o[k] = s * (size[k] + gap); return egFragBoxAt(LAW, ...o); };
    assert.equal(egFragApart(B, off(200)), true, `2 m apart along axis ${k}, ${s}`);
    assert.equal(egFragApart(B, off(199)), false, `1.99 m along axis ${k}, ${s}`);
    assert.equal(egFragApart(off(199), B), false, 'either way round');
  }
  assert.equal(egFragApart(B, B), false, 'a box is not apart from itself');
  assert.equal(egFragApart(B, egFragBoxAt(LAW, 0, 0, size[2] + 50), 50), true, 'the margin is the caller\'s to ask');
  const piece = { x: 0, y: 100, z: 1000, w: 200, d: 300, amp: 150, gap: 250 };
  assert.deepEqual(egFragSwept({ ...piece, kind: 'ledge' }), [-100, 100, 850, 100, 100, 1150]);
  assert.deepEqual(egFragSwept({ ...piece, kind: 'drift' }), [-250, 100, 850, 250, 100, 1150]);
  assert.deepEqual(egFragSwept({ ...piece, kind: 'slag' }), [-250, 100, 850, 250, 100, 1150]);
  assert.deepEqual(egFragSwept({ ...piece, kind: 'rail' }), [-100, 100, 700, 100, 100, 1300]);
  assert.deepEqual(egFragSwept({ ...piece, kind: 'drum' }), [-100, 100, 700, 100, 100, 1300]);
  assert.deepEqual(egFragSwept({ ...piece, kind: 'pend' }), [-410, 100, 600, 410, 100, 1150], 'the weight\'s reach and half over the gap before it');
  assert.deepEqual(egFragSwept({ ...piece, kind: 'sink' }), [-100, -200, 850, 100, 100, 1150], 'a Sink gone 3 m down');
  // the record's box holds the reference's drift at the ends of its swing, and the hazards' plans
  const drift = egFragSwept(LAW.course[1]);
  assert.ok(drift[0] >= B[0] && drift[3] <= B[3]);
  assert.deepEqual(egFragHazardPlan(LAW.hazards[2]), [-300, 2150, 100, 2950], 'the surge\'s capsule - its rectangle as drawn');
  assert.deepEqual(egFragHazardPlan(LAW.hazards[0]), [-300, 150, 300, 900], 'the basalt\'s two discs');
  assert.equal(egFragHazardPlan({ kind: 'mist', y: -300 }), null, 'the mist is a line, not a place');
  assert.deepEqual(egFragHazardPlan({ kind: 'tide', x: 100, z: 200, r: 300 }), [-200, -100, 400, 500]);
  assert.deepEqual(egFragHazardPlan({ kind: 'eclipse', x: 0, z: 0, ring: 900 }), [-1200, -1200, 1200, 1200], 'the ring and its havens\' reach');
  assert.deepEqual(egFragHazardPlan({ kind: 'wisp', path: [0, 500, 200, 150] }), [-200, 350, 200, 650]);
  assert.deepEqual(egFragHazardPlan({ kind: 'cascade', w: 400, lanes: [[-300, 250, 300, 250], [-300, 650, 300, 650]] }), [-500, 50, 500, 850]);
});

test('EG6c THE RECORD AS A HALL READS IT: the inner course as a hall spec\'s steps (metres and seconds - net/eliteGates/egLaw.js\'s own conversion, a Moon\'s beat the beams\' origin along the hall) laid at an origin, which THE TIMED SOLVER proves to the record\'s own proof; the hazards as a hall spec\'s, lawful, their parts on the shared clock where the record put them; the polygons\' own arithmetic (mutants: a unit lost; the origin not added; a moon\'s beat in seconds)', () => {
  const steps = egFragSteps(LAW, 10, 2, 100);
  assert.deepEqual(steps[1], { i: 1, kind: 'drift', span: 0, x: 10, y: 2, z: 115.2, w: 3, d: 2.4, amp: 1, period: 5, phase: 0.9, beat: 0, gap: 2, road: 0, kit: 'caverns', after: 0 });
  assert.equal(steps[2].after, 1);
  assert.equal(egFragSteps({ kit: 'gloam', course: [{ kind: 'moon', x: 0, y: 0, z: 500, w: 280, d: 220, amp: 0, period: 4000, phase: 500, beat: 1200, gap: 200, after: 0 }] }, 0, 0, 30)[0].beat, 42, 'a Moon\'s beat the beams\' origin, along the hall');
  assert.equal(egFragSteps({ kit: 'caverns', course: [{ kind: 'beat', x: 0, y: 0, z: 500, w: 300, d: 260, amp: 0, period: 0, phase: 0, beat: 1800, gap: 200, after: 0 }] })[0].beat, 1.8, 'a Beat\'s beat in seconds');
  const P = egSpanProof({ steps: egFragSteps(LAW) });
  assert.deepEqual(P, { ok: true, why: [] });
  const c = egRoadCross({ steps: egFragSteps(LAW) }, 0);
  assert.deepEqual([Math.round(c.fast * 1000), Math.round(c.median * 1000), c.n], [LAW.proof.crossFast, LAW.proof.crossSlow, LAW.proof.moves], 'the record\'s proof is the solver\'s');
  const hz = egFragHazards(LAW, 10, 2, 100);
  assert.deepEqual(hz[2], { kind: 'surge', i: 2, x: 10, z: 100, y: 2, period: 8, phase: 2, w: 4, r: 0, ring: 0, sh: [9, 123.5, 9, 127.5], spots: null, lanes: null, path: null });
  assert.deepEqual(hz[0].spots, [[10.5, 104], [9.5, 106.5]]);
  for (const h of egFragHazards(LAW)) assert.ok(egHazardLawful(h).ok, h.kind);
  // the basalt's spots fall in turn on the shared clock: told 1.2 s before each falls, the first spot first
  const L = EG_HAZARDS.basalt, at = (t) => egHazardParts(egFragHazards(LAW)[0], t);
  const live = (L.period - L.live) / 1000 - 0.7;   // its phase is 0.7 s
  assert.deepEqual(at(live + 0.01).map((p) => [p.st, p.sh]), [['live', ['d', 0.5, 4, 2.5]]]);
  assert.deepEqual(at(live + L.period / 1000 + 0.01).map((p) => [p.st, p.sh]), [['live', ['d', -0.5, 6.5, 2.5]]]);
  assert.deepEqual(egFragHazards({ hazards: [{ kind: 'wisp', x: 0, y: 120, z: 0, w: 0, r: 0, ring: 0, period: 9000, phase: 0, sh: null, spots: null, lanes: null, path: [0, 500, 200, 150] }, { kind: 'cascade', x: 0, y: 0, z: 0, w: 400, r: 0, ring: 0, period: 0, phase: 0, sh: null, spots: null, lanes: [[-300, 250, 300, 250]], path: null }] }).map((h) => [h.path, h.lanes, h.y, h.period]), [[[0, 5, 2, 1.5], null, 1.2, 9], [null, [[-3, 2.5, 3, 2.5]], 0, 0]]);
  assert.equal(egFragArea2([[0, 0], [100, 0], [100, 100], [0, 100]]), 20000, 'counter-clockwise, twice its area');
  assert.equal(egFragArea2([[0, 0], [0, 100], [100, 100], [100, 0]]), -20000);
  const sq = [[0, 0], [100, 0], [100, 100], [0, 100]];
  assert.deepEqual([egFragInPoly(sq, 50, 50), egFragInPoly(sq, 100, 50), egFragInPoly(sq, 0, 0), egFragInPoly(sq, 101, 50), egFragInPoly(sq, 50, -1), egFragInPoly(sq, 50, 100)], [true, true, true, false, false, true]);
  const ell = [[0, 0], [200, 0], [200, 100], [100, 100], [100, 200], [0, 200]];
  assert.deepEqual([egFragInPoly(ell, 150, 150), egFragInPoly(ell, 50, 150), egFragInPoly(ell, 150, 50), egFragInPoly(ell, -50, 150)], [false, true, true, false], 'a floor that turns a corner - and a point whose line crosses it twice');
  assert.deepEqual(Object.keys(EG_HAZARD_SHAPES).sort(), Object.keys(EG_HAZARDS).sort(), 'every hazard kind has its shape');
});

test('EG6c WHERE A BAKED FRAGMENT IS REGISTERED (section 11.6): its law in net/eliteGates/egHeroFrags.js, held to the reader at import and frozen; its mesh in world/eliteGates/egHeroFragModel.js beside its law (the same bake); the reference laid by no hall; its pictures its band\'s archive (world/eliteGates/pseudoArchives.js - no number of its own); its mesh through the one mesh kit (world/eliteGates/meshKit.js `mesh`), moved to where it is laid with its own normals and UVs, packed with the hall\'s code-built shapes; its collider the proxy (mutants: the reference laid; a mesh unmoved; normals or UVs not carried; another band\'s archive)', () => {
  assert.deepEqual(Object.keys(EG_HERO_FRAGS), ['egRefFrag', 'egheroOssuary', 'egheroMistStair', 'egheroGloam', 'egheroEclipse', 'egheroCaverns', 'egheroStacks', 'egheroColonnade', 'egheroForgeGut', 'egheroClanPit', 'egheroDeepCaverns'], 'the reference first, then every band\'s heroes (EG-HERO - PIN MOVED: each band\'s own test pins its heroes)');
  assert.ok(Object.isFrozen(EG_HERO_FRAGS) && Object.isFrozen(EG_HERO_FRAGS.egRefFrag));
  assert.equal(JSON.stringify(EG_HERO_FRAGS.egRefFrag), JSON.stringify(LAW));
  assert.equal(EG_HERO_REFERENCE, 'reference');
  assert.deepEqual(egHeroFragLaws('caverns').filter((l) => l.variant === EG_HERO_REFERENCE || l.id === 'egRefFrag'), [], 'the reference stands in; no hall lays it');
  const hero = { ...LAW, id: 'macCavern', variant: 'hero' }, other = { ...LAW, id: 'macStacks', kit: 'stacks', variant: 'hero' };
  assert.deepEqual(egHeroFragLaws('caverns', { egRefFrag: LAW, macCavern: hero, macStacks: other }), [hero], 'a hero of its kit, the reference left out');
  assert.equal(EG_HERO_FRAG_MESHES.egRefFrag.bake.sha256, LAW.bake.sha256);
  assert.throws(() => egHeroFragRegistry([{ ...LAW, id: 'bad', band: 2 }]), /bad's law half is refused - band 2: caverns is band 0's/, 'a record with a fault never registers');
  assert.throws(() => egHeroFragMeshes([{ ...MESH, id: 'stray' }]), /stray's mesh half has no law half/);
  assert.throws(() => egHeroFragMeshes([{ ...MESH, band: 1 }]), /egRefFrag's mesh half has no law half of its bake/);
  assert.throws(() => egHeroFragMeshes([{ ...MESH, bake: { ...MESH.bake, sha256: '0' } }]), /egRefFrag's mesh half has no law half of its bake/, 'a mesh of another bake');
  assert.deepEqual(Object.keys(egHeroFragMeshes([MESH])), ['egRefFrag']);
  const model = egHeroFragModel('egRefFrag');
  assert.deepEqual(model.subMeshes.map((s) => [s.textureArchive, s.textureRecord, s.startIndex, s.primitiveCount]), MESH.subMeshes.map((s) => [EG_BAND_ARCHIVES[0], s.record, s.startIndex, s.primitiveCount]), 'the Galleries\' archive, a sub-mesh a dress record');
  assert.equal(model.positions.length, MESH.indices.length * 3);
  assert.ok(model.indices instanceof Uint32Array);
  // every corner carried whole: its place, its normal, its UV (to single precision)
  const v0 = MESH.indices[0], f4 = (v) => Math.round(v * 1e4) / 1e4;
  for (let k = 0; k < MESH.indices.length; k++) {
    const v = MESH.indices[k];
    assert.deepEqual([...model.positions.slice(k * 3, k * 3 + 3)].map(f4), MESH.positions.slice(v * 3, v * 3 + 3), `corner ${k}'s place`);
    assert.deepEqual([...model.normals.slice(k * 3, k * 3 + 3)].map(f4), MESH.normals.slice(v * 3, v * 3 + 3), `corner ${k}'s normal`);
    assert.deepEqual([...model.uvs.slice(k * 2, k * 2 + 2)].map(f4), MESH.uvs.slice(v * 2, v * 2 + 2).map(f4), `corner ${k}'s UV`);
  }
  // laid where the hall puts it, beside the hall's own shapes in one kit
  const kit = createMeshKit().box(0, [0, 0, 0], [1, 1, 1]);
  const before = kit.vertexCount;
  egHeroFragInto(kit, 'egRefFrag', [10, 2, 100]);
  assert.equal(kit.vertexCount - before, MESH.indices.length);
  const packed = kit.pack(EG_BAND_ARCHIVES[0]), floor = packed.subMeshes.find((s) => s.textureRecord === 0);
  assert.equal(floor.primitiveCount, 12 + MESH.subMeshes[0].primitiveCount, 'the box and the fragment\'s floor in one bucket');
  const i0 = (floor.startIndex + 36) * 3;
  assert.deepEqual([...packed.positions.slice(i0, i0 + 3)], [MESH.positions[v0 * 3] + 10, MESH.positions[v0 * 3 + 1] + 2, MESH.positions[v0 * 3 + 2] + 100]);
  // a slice of a baked mesh: `start` and `count`
  const part = createMeshKit().mesh(5, MESH, { start: MESH.subMeshes[1].startIndex, count: 2 });
  assert.equal(part.vertexCount, 6);
  const v1 = MESH.indices[MESH.subMeshes[1].startIndex];
  assert.deepEqual([...part.pack(1).positions.slice(0, 3)].map((x) => Math.round(x * 1e4) / 1e4), MESH.positions.slice(v1 * 3, v1 * 3 + 3));
  const col = egHeroFragCollider('egRefFrag', [1, 2, 3]);
  assert.equal(col.length, LAW.cost.collider * 9);
  assert.deepEqual([...col.slice(0, 3)], [MESH.collider[0] + 1, MESH.collider[1] + 2, MESH.collider[2] + 3]);
});

test('EG6c THE READER IS LAW: its section of net/eliteGates/egFragLaw.js decides in whole centimetres and calls no float trigonometry, no root, no clock and no Math.random (section 9\'s banned functions, swept) (mutants: a root in the reader)', () => {
  const src = readFileSync(new URL('../../../src/net/eliteGates/egFragLaw.js', import.meta.url), 'utf8');
  const reader = src.slice(src.indexOf('// ── EG6c: A BAKED FRAGMENT\'S RECORD'));
  assert.ok(reader.length > 8000, 'the reader found');
  for (const bad of ['Math.sin', 'Math.cos', 'Math.tan', 'Math.atan', 'Math.random', 'Math.sqrt', 'Math.hypot', 'Math.pow', 'Math.exp', 'Math.log', 'Date.now', 'performance.now']) assert.ok(!reader.includes(bad), `the reader calls ${bad}`);
});

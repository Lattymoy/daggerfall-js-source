// EG-LOOK (2026-10-15, Mac: "Literally everything, and no band aids"; bible/11-Multiplayer/Elite-Gates-Look.md section 2):
// THE GROUND (world/eliteGates/egGround.js, laid into the circle's one mesh by world/eliteGates/egHall.js buildEgCircleModel) - the law's floors,
// walls and vaults dressed as the Battlemages' academy. The laws, not the pixels: the Hour's island unchanged unless asked
// and the Spire's discs without its gear teeth; the collider (egCircleColliderTris) byte for byte what it was; the floors cut
// into their regions in their own plane (no gap, no overlap, no decal), the inlay worn in one zone of its picture a region;
// no visual larger than the law (nothing new over a floor's top inside it, every wall out from its collider's plane, every
// vault over the ceiling, a door inside its posts, a vignette inside its box); every piece of it an occluder; the kits' own
// forms; the records the band's, one draw each; one seed, one set of bytes, the swap's worker's the same; the triangles
// measured.
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { realmIsland, buildRealmModel, packRealmFaces, SD_ISLAND_SIDES, SD_REALM_ARCHIVE, SD_REALM_BRASS_RECORD } from '../../../src/world/superDungeon/sdRealm.js';
import { faces } from '../../../src/world/gate/gateModel.js';
import { buildEgCircleModel, egCircleColliderTris, egToDungeon, egHeroMeshSeam, egInHeroBox, egIsleDisc, egWallFoot, EG_DOOR } from '../../../src/world/eliteGates/egHall.js';
import { egCircleBuild } from '../../../src/world/eliteGates/egCircleParts.js';
import { egCircleSpecs, egBandOfCircle } from '../../../src/net/eliteGates/egLaw.js';
import { egBandArchive, EG_DRESS, EG_KIT_MAP } from '../../../src/world/eliteGates/egBandArt.js';
import { EG_KIT_RECORD, EG_KIT_STYLE } from '../../../src/world/eliteGates/egKit.js';
import {
  egDiscFloor, egPassage, egPassageGrid, egRingArcade, egLongWalls, egTierBenches, egDoorway, egVignette, egKitInto, egArchCurve, egVaultOpen,
  EG_GROUND_RECORD, EG_GROUND_RECORDS, EG_FLOOR_LOOK, EG_WALL, EG_VAULT, EG_ARCADE, EG_VIGNETTE_BOX, EG_GROUND_SIGILS, EG_ROCK,
} from '../../../src/world/eliteGates/egGround.js';
import { egLawSeam } from '../../../src/net/eliteGates/egLaw.js';

// PIN MOVED (THE ASCENT - THE ROOMS, LAW 9 - 2026-10-16): these pins measure spec law 8's halls - drawn where no law is named
// (net/eliteGates/egLaw.js egLawSeam - a test's seam, never a breach's: a breach draws its own law), the dress, the camera and the client
// as they were written over law 8's ground; LAW 9's dress is THE DRESS slice's (Elite-Gates-Ascent.md section 8) and its
// ground test/net/eliteGates/law9_rooms.test.js's
egLawSeam(8);

const R = EG_GROUND_RECORD;
/** Every triangle of faces `f` (or a packed model) as [record, [a, b, c]] - its corners in the dungeon's frame. */
const trisOfFaces = (f) => { const out = []; for (const [rec, g] of f.byRec) for (let i = 0; i < g.p.length; i += 9) out.push([rec, [[g.p[i], g.p[i + 1], g.p[i + 2]], [g.p[i + 3], g.p[i + 4], g.p[i + 5]], [g.p[i + 6], g.p[i + 7], g.p[i + 8]]], [[g.uv[(i / 3) * 2], g.uv[(i / 3) * 2 + 1]], [g.uv[(i / 3) * 2 + 2], g.uv[(i / 3) * 2 + 3]], [g.uv[(i / 3) * 2 + 4], g.uv[(i / 3) * 2 + 5]]]]); return out; };
const area = ([a, b, c]) => { const u = [b[0] - a[0], b[2] - a[2]], v = [c[0] - a[0], c[2] - a[2]]; return Math.abs(u[0] * v[1] - u[1] * v[0]) / 2; };
/** A hall-frame point of hall `spec` from a dungeon one. */
const local = (spec, p) => { const o = egToDungeon(spec, 0, 0, 0); return [p[0] - o[0], p[1], p[2] - o[2]]; };
/** The pieces a build lays, each laid into its own faces (the occluder's view of them). */
const pieces = (build) => { const out = []; build((b) => { const f = faces(); egKitInto(f, b); out.push(trisOfFaces(f)); }); return out; };
/** A circle's packed model, its triangles by index with their owner piece (or -1). */
function owned(m) {
  const own = new Int32Array(m.indices.length / 3).fill(-1);
  m.occluders.forEach((o, i) => { for (const [, at, n] of o.r) for (let k = 0; k < n; k++) own[at / 3 + k] = i; });
  return own;
}
const recOfTri = (m) => { const out = new Int32Array(m.indices.length / 3); for (const sm of m.subMeshes) for (let k = 0; k < sm.primitiveCount; k++) out[sm.startIndex / 3 + k] = sm.textureRecord; return out; };
const vtx = (m, j) => [m.positions[m.indices[j] * 3], m.positions[m.indices[j] * 3 + 1], m.positions[m.indices[j] * 3 + 2]];
/** Plan distance from hall point `l` to ramp `r`'s centre line (net/eliteGates/egLaw.js `ramps`: a to b). */
const toSeg = (l, r) => { const dx = r.bx - r.ax, dz = r.bz - r.az, t = Math.max(0, Math.min(1, ((l[0] - r.ax) * dx + (l[2] - r.az) * dz) / (dx * dx + dz * dz || 1))); return Math.hypot(l[0] - r.ax - t * dx, l[2] - r.az - t * dz); };

// ── THE RIMS ────────────────────────────────────────────────────────────────────────────────────────────────────
test('EG-LOOK HALLS THE RIMS (Elite-Gates-Look.md section 2; world/superDungeon/sdRealm.js realmIsland): the Hour\'s island laid as it always was by default (its options asked or not, the Hour whole byte for byte); `teeth: false` lays no brass past the rim and `floor: false` no floor; every disc of the Spire\'s circles in every band without the Hour\'s gear teeth - no brass under or out past a rim where the teeth stood - its rim\'s lip and its edge line where they were (mutants: the teeth on by default off; the Spire\'s discs toothed; the floor laid anyway)', () => {
  const lay = (o) => { const f = faces(); realmIsland(f, 3, 4, 9, 4, o); return JSON.stringify([...f.byRec].map(([r, g]) => [r, g.p, g.uv])); };
  assert.equal(lay({ y: 2, bands: 3 }), lay({ y: 2, bands: 3, teeth: true, floor: true }), 'the default is the Hour\'s');
  const hour = buildRealmModel();
  assert.equal(createHash('sha256').update(Buffer.from(hour.positions.buffer)).update(Buffer.from(hour.uvs.buffer)).digest('hex').slice(0, 16), HOUR_HASH, 'the Hour whole, byte for byte');
  const bare = faces();
  realmIsland(bare, 0, 0, 6, 4, { teeth: false, floor: false });
  const T = trisOfFaces(bare);
  assert.ok(T.every(([, c]) => c.every((p) => Math.hypot(p[0] - 25.6, p[2] - 25.6) <= 6 + 0.005)), 'no tooth past the rim');
  assert.ok(!T.some(([rec]) => rec === 4), 'no floor laid');
  assert.equal(T.filter(([rec]) => rec === SD_REALM_BRASS_RECORD).length, SD_ISLAND_SIDES * 6, 'the brass lip whole: its top and its two sides');
  for (const c of [1, 6, 11, 16]) {
    const m = buildEgCircleModel(7, c, 0), rec = recOfTri(m);
    for (const spec of egCircleSpecs(7, c, 0)) for (const d of spec.discs) {
      if (egIsleDisc(spec, d)) continue;
      const ctr = egToDungeon(spec, d.x, d.y, d.z);
      for (let j = 0; j < m.indices.length; j += 3) {
        if (rec[j / 3] !== R.metal) continue;
        const ps = [0, 1, 2].map((k) => vtx(m, j + k));
        assert.ok(!ps.every((p) => { const r = Math.hypot(p[0] - ctr[0], p[2] - ctr[2]); return r > d.r + 0.01 && r < d.r + 0.3 && p[1] < d.y + 0.15 && p[1] > d.y - 0.5; }) || !ps.some((p) => p[1] < d.y - 0.2), `circle ${c}: brass where a tooth stood`);   // a tooth reached under the rim
      }
    }
  }
});
/** The Hour's island model's bytes (positions and uvs) - unchanged by EG-LOOK. */
const HOUR_HASH = 'e3880995d328e25c';

// ── THE LAW UNTOUCHED ───────────────────────────────────────────────────────────────────────────────────────────
test('EG-LOOK HALLS THE LAW UNTOUCHED (Elite-Gates-Look.md section 2: "the law\'s surfaces exactly where they are"): the collider (world/eliteGates/egHall.js egCircleColliderTris) over 64 circles and grounds byte for byte what it was before the academy was laid - its hash the one measured on the scaffold before (mutants: a wall\'s plane moved; the door\'s posts grown)', () => {
  const h = createHash('sha256');
  for (const seed of [7, 99]) for (let c = 1; c <= 16; c++) for (const geo of [0, 2]) { const t = egCircleColliderTris(seed, c, geo); h.update(Buffer.from(t.buffer, t.byteOffset, t.byteLength)); }
  assert.equal(h.digest('hex'), COLLIDER_HASH);
});
/** The collider's bytes over seeds 7 and 99, circles 1-16, grounds 0 and 2 - measured on the scaffold (a08673797) and here. */
const COLLIDER_HASH = 'b8820f60621e288df2e3a5e9aa550a5b09b593a7bc1727b30ff24952ed5f403d';

// ── THE FLOORS ──────────────────────────────────────────────────────────────────────────────────────────────────
test('EG-LOOK HALLS THE FLOORS CUT INTO REGIONS (section 2): every court\'s and plate\'s top laid in its own plane at its own height - no decal - covering its rim\'s 48-gon exactly (no gap, no overlap: its area the gon\'s); a running border of inlay a metre in from every plate\'s and court\'s rim; each court\'s great mosaic of its band\'s sigil inside its frame (the star, the gem, the crescent, Dagon\'s sigil); the arrival plate\'s gold ring where it lay, and its compass of inlay pointing down the course; every inlay triangle worn in one zone of its picture (EG_KIT_MAP: accent v [0, .5), metal [.5, 1]) (mutants: a region over the floor; a cell left out; the border dropped; the sigil\'s figure unlaid; the compass turned; a figure across the zones)', () => {
  const B = EG_FLOOR_LOOK.border;
  for (const c of [1, 6, 11, 16]) {
    const band = egBandOfCircle(c), sigil = EG_KIT_STYLE[band].sigil;
    let courts = 0;
    for (const spec of egCircleSpecs(7, c, 0)) for (const d of spec.discs) {
      if (egIsleDisc(spec, d)) continue;
      const f = faces();
      egDiscFloor(f, spec, d, d.role === 'court' ? R.arena : R.floor, band);
      const T = trisOfFaces(f), ctr = egToDungeon(spec, d.x, d.y, d.z);
      assert.ok(T.every(([, cs]) => cs.every((p) => Math.abs(p[1] - ctr[1]) < 1e-9)), `circle ${c} ${d.role}: its top in its own plane`);
      const gon = (SD_ISLAND_SIDES / 2) * d.r * d.r * Math.sin((2 * Math.PI) / SD_ISLAND_SIDES), got = T.reduce((s, [, cs]) => s + area(cs), 0);
      assert.ok(Math.abs(got - gon) < 1e-6 * gon + 1e-6, `circle ${c} ${d.role}: the gon covered once (${got} of ${gon})`);
      const rOf = (p) => Math.hypot(p[0] - ctr[0], p[2] - ctr[2]);
      const inlay = T.filter(([rec]) => rec === R.inlay);
      for (const [, , uv] of inlay) { const lo = Math.min(...uv.map((q) => q[1])), hi = Math.max(...uv.map((q) => q[1])); assert.ok(hi - lo <= 0.5 + 1e-9 && (hi <= 0.5 + 1e-9 || lo >= 0.5 - 1e-9), `circle ${c} ${d.role}: an inlay region within one zone of its picture`); }
      if (['arrive', 'end', 'court', 'bastion', 'balcony'].includes(d.role) && d.r >= EG_FLOOR_LOOK.minBorder) {
        const ring = d.role === 'arrive' ? [d.r - 1.2, d.r - 1.2 + 0.35] : [d.r - B.in - B.band, d.r - B.in];
        assert.ok(inlay.some(([, cs]) => cs.every((p) => rOf(p) >= ring[0] - 1e-6 && rOf(p) <= ring[1] + 1e-6)), `circle ${c} ${d.role}: its border of inlay a metre in from its rim`);
      }
      if (d.role === 'court') {
        courts++;
        const ri = Math.max(EG_FLOOR_LOOK.mosaic.min, Math.min(EG_FLOOR_LOOK.mosaic.max, EG_FLOOR_LOOK.mosaic.k * d.r));
        const fig = inlay.filter(([, cs]) => cs.every((p) => rOf(p) < ri - 1e-6));
        assert.ok(fig.length > 0, `circle ${c}: the court's ${sigil} in its mosaic`);
        // the figure's own shape: the sigil's cut answers each of its regions, laid here as the inlay
        const cut = EG_GROUND_SIGILS[sigil](ri), probe = cut.at(Math.PI / 2 + 0.01);
        assert.ok(probe.b.length >= 4 && probe.b.every((v, i) => i === 0 || v >= probe.b[i - 1] - 1e-9), `${sigil}: its breakpoints rising`);
        assert.ok(inlay.some(([, cs]) => cs.every((p) => Math.abs(rOf(p) - ri - EG_FLOOR_LOOK.frame.fillet - EG_FLOOR_LOOK.frame.band / 2) < EG_FLOOR_LOOK.frame.band / 2 + 1e-6)), `circle ${c}: the mosaic's frame`);
      }
      if (d.role === 'arrive') {
        const gold = T.filter(([rec]) => rec === R.edge);
        assert.ok(gold.length > 0 && gold.every(([, cs]) => cs.every((p) => rOf(p) >= d.r - 1.4 - 1e-6 && rOf(p) <= d.r - 1.2 + 1e-6)), 'the gather\'s gold ring where it lay, in the floor');
        // the compass: its inlay reaching furthest down the course (+z), its north point
        const reach = (dir) => Math.max(...inlay.filter(([, cs]) => cs.every((p) => rOf(p) < EG_FLOOR_LOOK.compass.north + 0.01)).flatMap(([, cs]) => cs.map((p) => (p[0] - ctr[0]) * dir[0] + (p[2] - ctr[2]) * dir[1])));
        assert.ok(reach([0, 1]) > EG_FLOOR_LOOK.compass.north - 0.05 && reach([0, -1]) < EG_FLOOR_LOOK.compass.cardinal + 0.05 && reach([1, 0]) < EG_FLOOR_LOOK.compass.cardinal + 0.05, 'the compass points down the course');
      }
    }
    assert.ok(courts > 0, `circle ${c}: a court`);
  }
});

// ── NO VISUAL LARGER THAN THE LAW ───────────────────────────────────────────────────────────────────────────────
test('EG-LOOK HALLS NO VISUAL LARGER THAN THE LAW (section 2, Elite-Gates.md section 11.6): a passage\'s every vertex out from its walls\' planes or over its ceiling (never in the walk under it); a chamber\'s arcade outward of its collider\'s ring of 32 sides, its long walls out from theirs; the door\'s pilasters inside their posts\' boxes; a vignette inside its box; and over the whole circle no piece rises over a floor\'s top inside that floor but the door in its posts (mutants: a wall face in the walk; the cornice under the ceiling; the arcade inside its ring; a pilaster past its post; a vignette past its box)', () => {
  const eps = 1e-4;
  for (const [seed, c] of [[7, 1], [7, 2], [77, 1], [7, 6], [7, 8], [7, 11], [7, 16], [7, 17], [7, 18], [7, 20]]) {
    const band = egBandOfCircle(c);
    for (const spec of egCircleSpecs(seed, c, 0)) {
      for (const q of spec.caves) {
        const yTop = Math.max(q.y, q.yB ?? q.y) + q.height;
        const P = pieces((piece) => egPassage(spec, q, { runs: [[[q.z0, q.z1]], [[q.z0, q.z1]]], cuts: [[], []], foot: egWallFoot(q), band, piece }));
        assert.ok(P.length > 0, `${q.kit}: laid`);
        for (const T of P) for (const [, cs] of T) for (const p of cs) {
          const l = local(spec, p);
          if (l[2] < q.z0 - eps || l[2] > q.z1 + eps || q.open) continue;
          assert.ok(Math.abs(l[0] - q.x) >= q.halfW - eps || l[1] >= yTop - eps, `seed ${seed} circle ${c} ${q.kit}: a vertex in the walk at [${l.map((v) => v.toFixed(2))}]`);
        }
        if (q.open) for (const T of P) for (const [, cs] of T) for (const p of cs) { const l = local(spec, p); if (l[2] >= q.z0 && l[2] <= q.z1 && l[1] > q.y + eps) assert.ok(Math.abs(l[0] - q.x) >= q.halfW - eps, `${q.kit}: a column on the walk`); }
      }
      for (const d of spec.deco ?? []) {
        if (d.t === 'wall') {
          const n = EG_ARCADE.sides, inside = (l) => { for (let k = 0; k < n; k++) { const a = ((k + 0.5) / n) * Math.PI * 2, along = (l[0] - d.x) * Math.sin(a) + (l[2] - d.z) * Math.cos(a); if (along >= d.r * Math.cos(Math.PI / n) - eps) return false; } return true; };
          for (const T of pieces((piece) => egRingArcade(spec, d, band, piece))) for (const [, cs] of T) for (const p of cs) assert.ok(!inside(local(spec, p)), `circle ${c}: the arcade inside its ring`);
        }
        if (d.t === 'hall') for (const T of pieces((piece) => egLongWalls(spec, d, band, piece))) for (const [, cs] of T) for (const p of cs) assert.ok(Math.abs(local(spec, p)[0] - d.x) >= d.hw - eps, 'a long wall in the hall');
      }
      for (const d of spec.discs) if (d.role === 'end') {
        for (const T of pieces((piece) => egDoorway(spec, d, EG_DOOR, band, piece))) for (const [, cs] of T) for (const p of cs) {
          const l = local(spec, p);
          if (l[1] >= d.y + EG_DOOR.h - eps) continue;
          assert.ok(Math.abs(Math.abs(l[0] - d.x) - EG_DOOR.halfW) <= EG_DOOR.post / 2 + eps && Math.abs(l[2] - d.z) <= EG_DOOR.post / 2 + eps, `circle ${c}: the door past its posts at [${l.map((v) => v.toFixed(2))}]`);
        }
      }
      for (const v of spec.vignettes ?? []) {
        const f = faces();
        egKitInto(f, (k) => egVignette(k, spec, v));
        for (const [, cs] of trisOfFaces(f)) for (const p of cs) { const l = local(spec, p); assert.ok(Math.abs(l[0] - v.x) <= EG_VIGNETTE_BOX.x + eps && Math.abs(l[2] - v.z) <= EG_VIGNETTE_BOX.z + eps && l[1] >= v.y - eps && l[1] <= v.y + EG_VIGNETTE_BOX.h + eps, `circle ${c} ${v.t}: past its box`); }
      }
    }
    // the whole circle: no piece rises over a floor's top inside it (heroes are their own; the door stands in its posts)
    const m = buildEgCircleModel(seed, c, 0), own = owned(m);
    for (const spec of egCircleSpecs(seed, c, 0)) for (const d of spec.discs) {
      if (egIsleDisc(spec, d) || egInHeroBox(spec, d.x, d.z)) continue;
      const ctr = egToDungeon(spec, d.x, d.y, d.z), arches = (spec.deco ?? []).filter((q) => q.t === 'arch');
      for (let j = 0; j < m.indices.length; j += 3) {
        if (own[j / 3] < 0) continue;
        for (let k = 0; k < 3; k++) {
          const p = vtx(m, j + k), l = local(spec, p);
          if (Math.hypot(p[0] - ctr[0], p[2] - ctr[2]) >= d.r - 0.36 || p[1] <= d.y + eps || p[1] >= d.y + EG_DOOR.h - eps) continue;
          const post = d.role === 'end' && Math.abs(Math.abs(l[0] - d.x) - EG_DOOR.halfW) <= EG_DOOR.post / 2 + eps && Math.abs(l[2] - d.z) <= EG_DOOR.post / 2 + eps;
          const arm = arches.some((q) => Math.abs(l[2] - q.z) <= 0.4 + eps && Math.abs(l[0] - q.x) >= q.w / 2 - eps);   // a chokepoint's arms: the law's own boxes
          const ramp = (spec.ramps ?? []).some((r) => toSeg(l, r) <= r.hw + 0.6) || spec.discs.some((o) => o !== d && o.y > d.y + 0.5 && Math.hypot(l[0] - o.x, l[2] - o.z) < o.r + 0.6);   // a stair or a raised floor of the law over it
          const lore = (spec.vignettes ?? []).some((v) => Math.abs(l[0] - v.x) <= EG_VIGNETTE_BOX.x + eps && Math.abs(l[2] - v.z) <= EG_VIGNETTE_BOX.z + eps);   // a vignette: the law's own box
          assert.ok(post || arm || ramp || lore, `seed ${seed} circle ${c}: a piece over the ${d.role}'s top at [${l.map((v) => v.toFixed(2))}]`);
        }
      }
    }
  }
});

// ── EVERY PIECE AN OCCLUDER ─────────────────────────────────────────────────────────────────────────────────────
test('EG-LOOK HALLS EVERY PIECE AN OCCLUDER (EG-ZN, section 2): every triangle of the academy - its ashlar, its shafts, its mouldings, its voussoirs - is a piece the camera dithers, never the ground; the heroes\' baked meshes aside, their own (mutants: a passage\'s pieces unmarked; a chamber\'s arcade unmarked; the door unmarked)', () => {
  const was = egHeroMeshSeam({});
  try {
    for (const [seed, c] of [[7, 1], [7, 2], [7, 6], [7, 11], [7, 16], [7, 18], [7, 20], [77, 1]]) {
      const m = buildEgCircleModel(seed, c, 0), own = owned(m), rec = recOfTri(m);
      let n = 0;
      for (let t = 0; t < own.length; t++) if ([R.wall, R.shaft, R.moulding, R.voussoir].includes(rec[t])) { n++; assert.ok(own[t] >= 0, `seed ${seed} circle ${c}: a triangle of record ${rec[t]} left out of the occluders`); }
      assert.ok(n > 1000, `seed ${seed} circle ${c}: the academy laid (${n})`);
    }
  } finally { egHeroMeshSeam(was); }
});

// ── THE KITS' OWN FORMS ─────────────────────────────────────────────────────────────────────────────────────────
test('EG-LOOK HALLS THE KITS\' OWN FORMS (section 2): a vault\'s voussoir rib over every pilaster of its passage and one or two bays broken open to the sky; the Stacks\' bookcases in their bays behind the plane; the Ossuary\'s loculi and the Forge\'s hearths in the wall; the Thicket\'s trunks rising past the wall\'s top outside it; the Colonnade\'s columns beside the walk; the Caverns\' rock pushed out by noise, never in; the door\'s keystone carrying the sigil (mutants: the ribs left out; no bay broken; the bookcases left out; the loculi left out; the hearths left out; the trunks left out; the columns left out; the rock flat; the sigil left off)', () => {
  const kits = new Map();
  for (const [seed, c] of [[7, 1], [7, 2], [77, 1], [7, 6], [7, 11], [7, 16], [7, 17]]) {
    const band = egBandOfCircle(c);
    for (const spec of egCircleSpecs(seed, c, 0)) for (const q of spec.caves) {
      const T = pieces((piece) => egPassage(spec, q, { runs: [[[q.z0, q.z1]], [[q.z0, q.z1]]], cuts: [[], []], foot: egWallFoot(q), band, piece })).flat();
      const L = T.map(([r, cs]) => [r, cs.map((p) => local(spec, p))]), yTop = Math.max(q.y, q.yB ?? q.y) + q.height, k = q.kit + (q.open ? '/open' : '');
      const d = (p) => Math.abs(p[0] - q.x) - q.halfW;   // out from the walls' planes
      const has = (fn) => L.some(([r, cs]) => fn(r, cs));
      const seen = kits.get(k) ?? kits.set(k, {}).get(k), all = (n, v) => { seen[n] = (seen[n] ?? true) && v; };   // true of every passage of its kit
      if (!q.open && q.kit !== 'caverns' && q.kit !== 'deep' && q.kit !== 'gloam' && !q.tube) {
        const grid = egPassageGrid(q);
        all('ribs', grid.every((z) => has((r, cs) => r === R.voussoir && cs.every((p) => Math.abs(p[2] - z) <= EG_WALL.pil / 2 + 1e-4 && p[1] > yTop))));
        // the barrel's crown over a bay: its ashlar (or its back) over the crown's two segments, near the middle
        const C = egArchCurve(EG_KIT_STYLE[egBandOfCircle(c)].arch, q.halfW + EG_WALL.cornice[EG_WALL.cornice.length - 1][0], 0, EG_VAULT.m), lo = C[EG_VAULT.m / 2 - 1];
        const crown = (z) => has((r, cs) => { const m = [0, 1, 2].map((a) => (cs[0][a] + cs[1][a] + cs[2][a]) / 3); return r === R.wall && Math.min(cs[0][2], cs[1][2], cs[2][2]) < z + 0.3 && Math.max(cs[0][2], cs[1][2], cs[2][2]) > z - 0.3 && m[1] > yTop + EG_WALL.corniceH + lo[1] - 1e-6 && Math.abs(m[0] - q.x) < Math.abs(lo[0]) / 2; });
        const open = egVaultOpen(spec, q, grid.length - 1);
        if (grid.length - 1 >= 4) all('open', open.length >= 1 && open.length <= 2 && open.every((b) => !crown((grid[b] + grid[b + 1]) / 2)) && crown((grid[0] + grid[1]) / 2));
      }
      if (q.kit === 'stacks') all('books', has((r, cs) => r === R.root && cs.every((p) => d(p) > 0 && p[1] > q.y && p[1] < q.y + 3.1)));
      if (q.kit === 'ossuary') all('loculi', has((r, cs) => r === R.root && cs.every((p) => d(p) >= EG_WALL.proud - 1e-4 && p[1] > q.y + 0.4 && p[1] < q.y + 1.4)));
      if (q.kit === 'forge') all('hearth', has((r, cs) => r === R.molten && cs.every((p) => d(p) > EG_WALL.proud + 0.2)));
      if (q.kit === 'gloam') all('trunks', has((r, cs) => r === R.root && cs.some((p) => p[1] > yTop + 5) && cs.every((p) => d(p) > EG_WALL.thick)));
      if (q.open) all('columns', has((r, cs) => r === R.shaft && cs.every((p) => d(p) > 0.3 && p[1] > q.y)));
      // the Caverns: the cave's own face pushed out by its noise (short of its shell, EG_ROCK.shell behind), never in
      if (q.kit === 'caverns' || q.kit === 'deep') { all('rock', has((r, cs) => r === R.root && cs.every((p) => d(p) > 0.15 && d(p) < EG_ROCK.shell - 0.05 && p[1] < yTop))); all('flush', L.every(([, cs]) => cs.every((p) => p[2] < q.z0 - 1e-4 || p[2] > q.z1 + 1e-4 || d(p) >= -1e-4 || p[1] >= yTop - 1e-4))); }
    }
  }
  const want = { stacks: ['ribs', 'open', 'books'], ossuary: ['ribs', 'open', 'loculi'], forge: ['ribs', 'open', 'hearth'], gloam: ['trunks'], 'colonnade/open': ['columns'], caverns: ['rock', 'flush'], deep: ['rock', 'flush'] };
  for (const [k, need] of Object.entries(want)) for (const n of need) assert.equal(kits.get(k)?.[n], true, `${k}: ${n}`);
  // the door: its keystone's sigil in the band's metal, at the arch's crown over the posts
  for (const c of [1, 6, 11, 16]) {
    const spec = egCircleSpecs(7, c, 0)[0], d = spec.discs.find((q) => q.role === 'end');
    const T = pieces((piece) => egDoorway(spec, d, EG_DOOR, egBandOfCircle(c), piece)).flat();
    const crown = d.y + EG_DOOR.h + EG_DOOR.halfW + EG_DOOR.post / 2;
    assert.ok(T.some(([r, cs]) => r === R.metal && cs.every((p) => { const l = local(spec, p); return Math.abs(l[0] - d.x) < 0.2 && Math.abs(l[1] - crown) < 0.5; })), `circle ${c}: the keystone's sigil`);
    assert.ok(T.some(([r]) => r === R.voussoir), `circle ${c}: the arch's voussoirs`);
  }
});

// ── THE RECORDS, THE BYTES ──────────────────────────────────────────────────────────────────────────────────────
test('EG-LOOK HALLS THE RECORDS AND THE BYTES (sections 2 and 8): every circle in every band one sub-mesh a record, every one in its band\'s archive - the kit\'s never in the Hour\'s, whose 60-78 are the Steps\' - its records the ground\'s (EG_GROUND_RECORDS, at most twelve); the same seed the same bytes, the swap\'s worker\'s build (world/eliteGates/egCircleParts.js egCircleBuild) the same model and occluders; the moulding laid in its bands, the walls\' ashlar worn v up (mutants: the kit left in the Hour\'s archive; a record outside the ground\'s; the walls worn v down)', () => {
  for (const c of [1, 4, 6, 9, 11, 14, 16, 19]) {
    const m = buildEgCircleModel(7, c, 0), A = egBandArchive(egBandOfCircle(c));
    assert.ok(m.subMeshes.length <= EG_GROUND_RECORDS.length && new Set(m.subMeshes.map((s) => s.textureRecord)).size === m.subMeshes.length);
    for (const sm of m.subMeshes) { assert.equal(sm.textureArchive, A, `circle ${c} record ${sm.textureRecord}`); assert.notEqual(sm.textureArchive, SD_REALM_ARCHIVE); assert.ok(EG_GROUND_RECORDS.includes(sm.textureRecord), `circle ${c}: record ${sm.textureRecord}`); }
  }
  for (const [seed, c] of [[7, 2], [99, 13]]) {
    const a = buildEgCircleModel(seed, c, 0), b = buildEgCircleModel(seed, c, 0), w = egCircleBuild({ seed, c, geo: 0 }).model;
    for (const k of ['positions', 'normals', 'uvs', 'indices']) { assert.deepEqual(b[k], a[k], `seed ${seed} circle ${c}: ${k} the same`); assert.deepEqual(w[k], a[k], `the worker's ${k}`); }
    assert.deepEqual(w.subMeshes, a.subMeshes); assert.deepEqual(w.occluders, a.occluders);
  }
  // the moulding's faces in its bands (EG_KIT_MAP): a cornice's every v inside one band; the walls' v rising with height
  const spec = egCircleSpecs(7, 6, 0).find((s) => s.caves.some((q) => q.kit === 'ossuary')), q = spec.caves.find((k) => k.kit === 'ossuary');
  const T = pieces((piece) => egPassage(spec, q, { runs: [[[q.z0, q.z1]], [[q.z0, q.z1]]], cuts: [[], []], foot: egWallFoot(q), band: 1, piece })).flat();
  const bands = Object.values(EG_KIT_MAP[EG_KIT_RECORD.moulding].bands);
  for (const [r, , uv] of T) if (r === R.moulding) { const vs = uv.map((p) => p[1]), lo = Math.min(...vs), hi = Math.max(...vs); assert.ok(bands.some(([b0, b1]) => lo >= b0 - 1e-9 && hi <= b1 + 1e-9) || (lo >= 0 && hi <= bands[2][1] + 1e-9), 'a moulding face inside its band'); }
  const walls = T.filter(([r, cs]) => r === R.wall && Math.abs(cs[0][0] - cs[1][0]) < 1e-9 && Math.abs(cs[0][0] - cs[2][0]) < 1e-9);
  assert.ok(walls.length > 0 && walls.every(([, cs, uv]) => [0, 1, 2].every((i) => [0, 1, 2].every((j) => cs[i][1] - cs[j][1] < 1e-6 || uv[i][1] > uv[j][1]))), 'the ashlar worn v up the wall');
});

// ── THE BUDGET, MEASURED ────────────────────────────────────────────────────────────────────────────────────────
test('EG-LOOK HALLS THE TRIANGLES, MEASURED (Elite-Gates-Look.md section 10; Elite-Gates.md section 11.9): over 60 circles (seeds 7, 99 and 12345, circles 1 to 20, heroes aside - their baked meshes are their own budget) the ground a mean and a worst measured here, every circle under the hall\'s 50,000 whole; the Spire\'s first circle of each band its own number (the Hour\'s rims, 576 triangles a disc, are a third and more of it) (mutants: the teeth back; the vault\'s coffers doubled)', () => {
  const was = egHeroMeshSeam({});
  try {
    let n = 0, sum = 0, worst = 0;
    for (const seed of [7, 99, 12345]) for (let c = 1; c <= 20; c++) { const t = buildEgCircleModel(seed, c, 0).indices.length / 3; n++; sum += t; worst = Math.max(worst, t); assert.ok(t <= 50000, `seed ${seed} circle ${c}: ${t}`); }
    assert.deepEqual([Math.round(sum / n), worst], BUDGET_MEAN_WORST);
    assert.deepEqual([1, 6, 11, 16].map((c) => buildEgCircleModel(7, c, 0).indices.length / 3), BUDGET_FIRSTS);
  } finally { egHeroMeshSeam(was); }
});
/** The ground's triangles: the mean and the worst over the 60, and seed 7's first circle of each band (heroes aside). */
const BUDGET_MEAN_WORST = [32648, 46648];
const BUDGET_FIRSTS = [24034, 32408, 28486, 34310];
void EG_DRESS; void EG_VAULT; void egArchCurve; void egTierBenches; void packRealmFaces; void egCircleColliderTris;

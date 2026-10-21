// EG-LOOK (2026-10-15, Mac: "Literally everything, and no band aids"; bible/11-Multiplayer/Elite-Gates-Look.md "What was
// wrong" - "The span pieces wore the Steps' clock faces"): THE SPANS' PIECES AS THE ACADEMY TORN (world/eliteGates/egPlatformModel.js,
// world/eliteGates/egPlatformArt.js, scenes/eliteGates/egSpan.js, scenes/eliteGates/egPieceBatch.js). The law each piece keeps: its top the collider's own
// rectangle and nothing of it over that top inside its footprint; THE EDGE LINE round its rim; its cornice under the strip and
// within the Hour's teeth's reach; its foundation under the top, its strata by depth; its column outside the footprint and
// the leap's corridor; nothing of it into another floor of its hall; its collider untouched. The tells kept: a Beat the Steps'
// dial set in the band's stone, dissolving whole; a Crumble the Steps' own box and chunks in the band's flags cracking. No
// Hour's clock on any other piece; every piece in its band's archive. The batch: a kind of many models, a circle's kinds a
// handful. Deterministic, pure, and lighter on a phone.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { EG_PIECE_LOOK, EG_CORNICE, EG_RISER_COURSE, egCornice, egCorniceReach, egPiecePlan, egSegmentPlan, egPieceSeed, egPieceModel, egBeatModel, egRiserModel, egDropLookModel, egIsleModel, egCrumbleModels } from '../../../src/world/eliteGates/egPlatformModel.js';
import { EG_CRUMBLE_TELL_RECORDS, EG_BEAT_STONE_RECORDS, egCrumbleArt, egBeatStoneArt } from '../../../src/world/eliteGates/egPlatformArt.js';
import { egBandArchive, egTellArchive, egBandArtOf, EG_DRESS, EG_KIT_MAP } from '../../../src/world/eliteGates/egBandArt.js';
import { EG_KIT_RECORD } from '../../../src/world/eliteGates/egKit.js';
import { buildStepModel, buildCrumbleChunks, stepTris, stepBox, SD_BEAT_DISSOLVE } from '../../../src/world/superDungeon/sdStepsModel.js';
import { SD_STEPS_RECORD, SD_STEPS_ATLAS, SD_STEPS_GLOW, SD_STEP_BEVEL, crackDistance, SD_CRACK_STAGES } from '../../../src/world/superDungeon/sdStepsArt.js';
import { SD_STEP_THICK, SD_RISER_H, SD_CRUMBLE_SIZE, SD_BEAT_SOLID, SD_BEAT_BLINK } from '../../../src/world/superDungeon/sdSteps.js';
import { SD_BEAT_OUT_STAGE_S } from '../../../src/scenes/superDungeon/sdSteps.js';
import { SD_REALM_ARCHIVE, SD_ISLAND_SIDES } from '../../../src/world/superDungeon/sdRealm.js';
import { SD_HALL_ATLAS_RECORD, SD_HALL_GLOW_RECORD } from '../../../src/world/superDungeon/sdHallArt.js';   // FIELD BUGS 2026-10-20f ORRERY-STONES: an Athenaeum's stones, the Hour's own
import { BAYER4 } from '../../../src/world/superDungeon/sdPixelKit.js';
import { createEgSpan, egSlabTris, egDropTris, EG_SPAN_KINDS_MAX, EG_SPAN_MOVERS } from '../../../src/scenes/eliteGates/egSpan.js';
import { createEgPieceBatch, EG_BATCH_HIDE_Y } from '../../../src/scenes/eliteGates/egPieceBatch.js';
import { egCircleSpecs, egBandOfCircle, EG_STEP } from '../../../src/net/eliteGates/egLaw.js';
import { egLawSeam } from '../../../src/net/eliteGates/egLaw.js';

// PIN MOVED (THE ASCENT - THE ROOMS, LAW 9 - 2026-10-16): these pins measure spec law 8's halls - drawn where no law is named
// (net/eliteGates/egLaw.js egLawSeam - a test's seam, never a breach's: a breach draws its own law), the dress, the camera and the client
// as they were written over law 8's ground; LAW 9's dress is THE DRESS slice's (Elite-Gates-Ascent.md section 8) and its
// ground test/net/eliteGates/law9_rooms.test.js's
egLawSeam(8);

const T = SD_STEP_THICK, L = EG_PIECE_LOOK, E = 1e-4;
const SEEDS = [7, 99, 12345];
/** Every triangle of a model: its corners, its record and archive. */
function trisOf(m) {
  const out = [];
  for (const sm of m.subMeshes) for (let i = sm.startIndex; i < sm.startIndex + sm.primitiveCount * 3; i += 3) {
    const v = [0, 1, 2].map((k) => [...m.positions.subarray(m.indices[i + k] * 3, m.indices[i + k] * 3 + 3)]);
    const uv = [0, 1, 2].map((k) => [...m.uvs.subarray(m.indices[i + k] * 2, m.indices[i + k] * 2 + 2)]);
    out.push({ v, uv, rec: sm.textureRecord, arch: sm.textureArchive });
  }
  return out;
}
const inside = (p, w, d, pad = 1e-3) => Math.abs(p[0]) < w / 2 - pad && Math.abs(p[2]) < d / 2 - pad;
/** A lone step in an empty hall (a still slab's plan with nothing about it), by kind and band. */
const lone = (kind, o = {}) => { const S = EG_STEP[kind], s = { kind, i: 0, x: 0, y: 0, z: 0, w: S.w / 100, d: S.d / 100, amp: 0, kit: '', ...o }; return { spec: { discs: [], bands: [], lanes: [], caves: [], steps: [s], heroes: [] }, s }; };
/** A piece's model by its kind (the spans' own choice - scenes/eliteGates/egSpan.js modelOf). */
const modelFor = (band, plan) => (plan.kind === 'beat' ? egBeatModel(band, plan) : plan.kind === 'riser' ? egRiserModel(band, plan) : plan.kind === 'drop' ? egDropLookModel(band, plan, 7.5, { w: 2.4, h: 3 }) : egPieceModel(band, plan));
const KINDS = ['still', 'ledge', 'gust', 'vent', 'pend', 'sink', 'moon', 'drift', 'rail', 'drum', 'beat', 'riser', 'drop'];
/** Every circle's steps with their plans and models (a sample: three seeds, circles 1-20, every fourth piece). */
function* everyPiece({ every = 4, lite = false } = {}) {
  let n = 0;
  for (const seed of SEEDS) for (let c = 1; c <= 20; c++) {
    const band = egBandOfCircle(c);
    for (const spec of egCircleSpecs(seed, c, 0)) for (const s of spec.steps) {
      if (s.kind === 'slag' || s.kind === 'crumble' || s.kind === 'bone' || n++ % every) continue;
      const B = ['drift', 'beat', 'riser'].includes(s.kind) ? stepBox(s.kind) : { w: s.w, d: s.d };
      const plan = egPiecePlan(spec, s, { seed: egPieceSeed(seed, c, spec.h, s.i), lite, band, w: B.w, d: B.d });
      yield { seed, c, band, spec, s, plan, model: modelFor(band, plan) };
    }
  }
}

test('EG-LOOK THE PIECE\'S TOP IS THE LAW\'S (Elite-Gates-Look.md "the top you see is the top you stand on"; Elite-Gates.md section 10.3): over every band\'s pieces of three seeds\' twenty circles, nothing of a piece stands over its top inside its footprint (a Drop\'s walls are the collider\'s own boxes); its top covers the footprint whole; its cornice\'s every face out of the footprint lies under the edge line\'s strip and within the Hour\'s teeth\'s reach; THE EDGE LINE\'s strip runs every side of its rim (a Beat\'s the dial\'s own line); a Riser\'s run-up face never stands out of its box (mutants: a cornice over the top; a cornice past its reach; a column in the footprint; the riser\'s cut out of the box)', () => {
  let n = 0;
  for (const { band, plan, model, s } of everyPiece()) {
    n++;
    const w = plan.w, d = plan.d, tris = trisOf(model);
    for (const t of tris) {
      const c = [0, 1, 2].map((k) => (t.v[0][k] + t.v[1][k] + t.v[2][k]) / 3);
      const walls = s.kind === 'drop' && t.rec !== EG_DRESS.floor && t.rec !== EG_DRESS.edge && (Math.abs(c[0]) > w / 2 - 1e-3 || c[2] > d / 2 - 1e-3);
      if (!walls) for (const p of [...t.v, c]) assert.ok(!(p[1] > 0.005 && inside(p, w, d)), `${s.kind} band ${band}: a face over the top inside its footprint at ${p}`);
      if (t.rec === EG_KIT_RECORD.moulding && s.kind !== 'drop') for (const p of t.v) {
        const out = Math.max(Math.abs(p[0]) - w / 2, Math.abs(p[2]) - d / 2);
        assert.ok(out <= L.reach + E, `${s.kind}: its cornice ${out} out`);
        if (out > 0.01) assert.ok(p[1] <= L.corniceTop + E, `${s.kind}: its cornice over the strip's foot at ${p}`);
      }
    }
    // the top covers the footprint (a Beat's dial is inset by its bezel - the Steps' own)
    if (s.kind !== 'beat') {
      let area = 0;
      for (const t of tris) if (t.rec === EG_DRESS.floor || t.rec === EG_DRESS.cobble) if (t.v.every((p) => Math.abs(p[1]) < 1e-6)) { const a = [t.v[1][0] - t.v[0][0], t.v[1][2] - t.v[0][2]], b = [t.v[2][0] - t.v[0][0], t.v[2][2] - t.v[0][2]]; area += Math.abs(a[0] * b[1] - a[1] * b[0]) / 2; }
      assert.ok(Math.abs(area - w * d) < 1e-3, `${s.kind}: its top ${area} of ${w * d}`);
      // THE EDGE LINE on every side: its strip 0.02 m out, 4 mm over the top to 5 cm under
      const edge = tris.filter((t) => t.rec === EG_DRESS.edge);
      for (const [nx, nz] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) assert.ok(edge.some((t) => t.v.every((p) => Math.abs(p[0] * nx + p[2] * nz - ((nx ? w : d) / 2 + L.edge.out)) < 1e-4 && p[1] <= L.edge.top + E && p[1] >= L.edge.foot - E)), `${s.kind}: its edge line on side ${nx},${nz}`);
    } else assert.ok(tris.some((t) => t.arch === SD_REALM_ARCHIVE && t.rec === SD_STEPS_RECORD.beat[0] && t.v.every((p) => Math.abs(p[1]) < 1e-6)), 'a Beat\'s top its dial');
    if (s.kind === 'riser') for (const t of tris) for (const p of t.v) if (p[1] > -plan.body + E && Math.abs(p[0]) < w / 2 - E) assert.ok(p[2] >= -d / 2 - E, `the run-up face out of its box at ${p}`);
  }
  assert.ok(n > 200, `${n} pieces`);
  // the cornices themselves: their first face flush, their reach the Hour's teeth's at most, their last back on the body
  for (const C of EG_CORNICE) {
    const P = C.profile;
    assert.deepEqual(P[0], [0, 0]); assert.equal(P[P.length - 1][0], 0);
    assert.ok(egCorniceReach(P) <= L.reach && P.every((p) => p[0] === 0 || p[1] <= L.corniceTop + E), `${C.name}: under the strip and within reach`);
    assert.equal(C.bands.length, P.length - 1, `${C.name}: a moulding band a face`);
    assert.ok(C.bands.every((b) => EG_KIT_MAP[EG_KIT_RECORD.moulding].bands[b]), `${C.name}: the picture's own bands`);
  }
  assert.ok(EG_RISER_COURSE.cut > 0, 'a riser\'s cut into its stone');
});

test('EG-LOOK THE FOUNDATION, THE COLUMN AND THE HANGING THING (Elite-Gates-Look.md sections 1 and 3.1, at a piece\'s size): under the top and inside the footprint the foundation hangs to its plan\'s depth and never further, its strata the kit\'s found by depth over its whole (the Hour\'s root mapping - EG_KIT_MAP); a column stands out of the footprint on a long side, clear of the leap\'s corridor, from under the top to a broken stub over it - an open span\'s still slabs alone (never a Gust\'s, a Drift\'s, a carriage\'s or a fragment\'s); a carriage rides two runners over its track and hangs nothing into it; the band\'s hanging thing within its depth (mutants: the strata a fixed depth; a column on a Gust; the head room ignored; a carriage off its runners; a hanging thing past its depth)', () => {
  let cols = 0, hangs = 0;
  for (const { band, plan, model, s } of everyPiece({ every: 2 })) {
    const w = plan.w, d = plan.d, tris = trisOf(model);
    let lo = 0;
    for (const t of tris) for (let k = 0; k < 3; k++) {
      const p = t.v[k];
      if (inside(p, w, d, -1e-3)) lo = Math.min(lo, p[1]);
      if (t.rec === EG_KIT_RECORD.found && inside(p, w, d, 0.02) && p[1] < -0.05) assert.ok(t.uv[k][1] >= -p[1] / plan.strata - 1e-3, `${s.kind} band ${band}: its strata by depth (${t.uv[k][1]} at ${p[1]} of ${plan.strata})`);
    }
    assert.ok(lo >= -plan.depth - 0.12 - 1e-3, `${s.kind}: hangs ${-lo} under a ${plan.depth} plan`);
    if (EG_SPAN_MOVERS.includes(s.kind) && s.kind !== 'drift' && s.kind !== 'moon') {
      assert.ok(lo >= -T - 0.1, `${s.kind}: a carriage over its track (${lo})`);
      // its two runners of the band's metal along it, over the gold track's two lines (world/eliteGates/egLook.js EG_TRACK - w / 2 - 0.2 out)
      const run = tris.filter((t) => t.rec === EG_DRESS.brass).flatMap((t) => t.v);
      for (const sx of [-1, 1]) assert.ok(run.some((p) => Math.abs(p[0] - sx * (w / 2 - 0.2)) <= 0.07 + 1e-4 && p[1] < -T + 0.02 && p[2] < -d / 2 + 0.2) && run.some((p) => Math.abs(p[0] - sx * (w / 2 - 0.2)) <= 0.07 + 1e-4 && p[2] > d / 2 - 0.2), `${s.kind}: its runner on side ${sx}`);
    }
    if (plan.column) {
      cols++;
      assert.ok(['still', 'ledge', 'vent', 'pend', 'sink'].includes(s.kind) && !s.kit, `${s.kind} ${s.kit}: a column only on an open span's still slab`);
      const shaft = tris.filter((t) => t.rec === EG_KIT_RECORD.shaft).flatMap((t) => t.v);
      assert.ok(shaft.length && shaft.every((p) => !inside(p, w, d, -0.02) && Math.abs(p[2]) <= d / 2 - L.column.clear + 1e-6), `${s.kind}: its column out of the footprint, clear of the corridor`);
      assert.ok(Math.max(...shaft.map((p) => p[1])) > 0.1 && Math.min(...shaft.map((p) => p[1])) < -0.5, 'from under the top to a stub over it');
    }
    if (plan.hang) hangs++;
    if (s.kind === 'gust' || EG_SPAN_MOVERS.includes(s.kind) || s.kit) assert.equal(plan.column, null, `${s.kind}: no column`);
  }
  assert.ok(cols > 5 && hangs > 5, `${cols} columns, ${hangs} hanging things`);
  // the head room: a floor 3 m under a piece's plan holds its foundation to 3 - EG_PIECE_LOOK.head under its top
  const { spec, s } = lone('still');
  spec.discs.push({ x: 0, z: 0, r: 4, y: -3 });
  const plan = egPiecePlan(spec, s, { seed: 5 });
  assert.ok(plan.depth <= Math.max(T, 3 - L.head) + 1e-9, `over a floor: ${plan.depth}`);
  assert.ok(egPiecePlan(lone('still').spec, lone('still').s, { seed: 5 }).depth >= L.depth.span[0], 'over the void: deep');
  assert.ok(egPiecePlan(lone('ledge', { kit: 'caverns' }).spec, lone('ledge', { kit: 'caverns' }).s, { seed: 5 }).depth <= L.depth.frag[1] + 1e-9, 'in a fragment: short');
});

test('EG-LOOK THE CORNICE WHERE IT MAY RUN (Elite-Gates-Look.md section 3.2 at a piece\'s size): off a Riser\'s run-up face, a Drop\'s walled sides and a carriage\'s ends (it travels to within EG_RAIL_CLEAR of what it meets), and off a side another floor abuts (a Beat run into its Riser, gap nought) - flush there, the body behind it; a break on a side is the body behind it too (mutants: the abutting side corniced; the Drop\'s walls corniced; a carriage\'s ends corniced)', () => {
  assert.deepEqual(egPiecePlan(lone('riser').spec, lone('riser').s, {}).cornice, [false, true, true, true]);
  assert.deepEqual(egPiecePlan(lone('drop').spec, lone('drop').s, {}).cornice, [true, false, false, false]);
  for (const k of ['rail', 'drum']) assert.deepEqual(egPiecePlan(lone(k).spec, lone(k).s, {}).cornice, [false, true, false, true], k);
  assert.deepEqual(egPiecePlan(lone('still').spec, lone('still').s, {}).cornice, [true, true, true, true]);
  // a Beat with its Riser flush against its far side, the Riser 2.3 m up
  const { spec, s } = lone('beat'), r = { kind: 'riser', i: 1, x: 0, y: SD_RISER_H, z: 2.6, w: 3, d: 2.6, amp: 0, kit: '' };
  spec.steps.push(r);
  assert.deepEqual(egPiecePlan(spec, s, {}).cornice, [true, true, false, true], 'the Beat\'s far side flush');
  // in the circles: every Beat run into a Riser
  let seen = 0;
  for (const seed of SEEDS) for (let c = 1; c <= 20; c++) for (const sp of egCircleSpecs(seed, c, 0)) for (const st of sp.steps) {
    if (st.kind !== 'riser') continue;
    const before = sp.steps.find((q) => q !== st && Math.abs(q.z + q.d / 2 - (st.z - st.d / 2)) < 1e-6 && Math.abs(q.x - st.x) < 1);
    if (!before) continue;
    seen++;
    assert.equal(egPiecePlan(sp, before, { band: egBandOfCircle(c) }).cornice[2], false, `circle ${c}: the ${before.kind} under the Riser flush`);
  }
  assert.ok(seen > 0, 'a Beat run into its Riser');
  // a segment: a Falling Wall's walk corniced along its sides, a tube's floor bare
  assert.deepEqual(egSegmentPlan('wall', 3, 2).cornice, [false, true, false, true]);
  assert.deepEqual(egSegmentPlan('tube', 3, 2).cornice, [false, false, false, false]);
});

test('EG-LOOK NOTHING POKES THROUGH ANOTHER FLOOR (Elite-Gates-Look.md section 3 - "nothing of it pokes through another floor of the hall"): over three seeds\' twenty circles, no part of a piece at its rest (a Drift at either end of its swing, a carriage at either end of its travel) stands inside another floor\'s plan between a slab\'s depth under its top and a body\'s height over it - discs, bands, lanes, passages\' floors, other pieces and a hero\'s floors (mutants: the head room ignored; the abutting side corniced)', () => {
  const hit = (spec, me, x, y, z) => {
    for (const q of spec.discs ?? []) if (Math.hypot(x - q.x, z - q.z) < q.r - 0.05 && y > (q.y ?? 0) - T && y < (q.y ?? 0) + 2) return `disc at ${q.x},${q.z}`;
    for (const b of spec.bands ?? []) if (Math.abs(x - b.x) < b.halfW - 0.05 && z > b.z0 + 0.05 && z < b.z1 - 0.05 && y > b.y - T && y < b.y + 2) return 'a band';
    for (const q of spec.steps) if (q !== me && q.kind !== 'slag' && Math.abs(x - q.x) < q.w / 2 - 0.05 && Math.abs(z - q.z) < q.d / 2 - 0.05 && y > q.y - T && y < q.y + 2) return `step ${q.i} (${q.kind})`;
    for (const cv of spec.caves ?? []) for (const [z0, z1, yy] of [[cv.z0, cv.zA ?? cv.z1, cv.y], [cv.zB ?? cv.z1, cv.z1, cv.yB ?? cv.y]]) if (Math.abs(x - cv.x) < cv.halfW - 0.05 && z > z0 + 0.05 && z < z1 - 0.05 && y > yy - T && y < yy + 2) return 'a passage floor';
    return null;
  };
  let n = 0;
  for (const { spec, s, model } of everyPiece({ every: 3 })) {
    const swing = s.kind === 'drift' ? [-s.amp, s.amp] : [0], slide = s.kind === 'rail' || s.kind === 'drum' ? [-s.amp, s.amp] : [0];
    for (const dx of swing) for (const dz of slide) for (let i = 0; i < model.positions.length; i += 3) {
      if (s.kind === 'drop' && (Math.abs(model.positions[i]) > s.w / 2 + 1e-4 || model.positions[i + 2] > s.d / 2 + 1e-4)) continue;   // its walls: the collider's own boxes
      const x = s.x + dx + model.positions[i], y = s.y + model.positions[i + 1], z = s.z + dz + model.positions[i + 2];
      const why = hit(spec, s, x, y, z);
      assert.equal(why, null, `circle ${spec.h} ${s.kind} ${s.i}: into ${why} at ${x.toFixed(2)},${y.toFixed(2)},${z.toFixed(2)}`);
      n++;
    }
  }
  assert.ok(n > 10000);
});

test('EG-LOOK THE COLLIDER IS THE LAW\'S (Elite-Gates.md section 10 - stepTris, egSlabTris, egDropTris): a circle\'s spans stand every step, segment and crust in the collider with the same triangles they stood with before the look - a Drift\'s, a Beat\'s, a Riser\'s and a Crumble\'s the Steps\' own box, a still piece\'s its slab, a Drop\'s its walled landing (mutants: none of the look reaches the collider)', () => {
  for (const [seed, c] of [[7, 1], [7, 6], [7, 11], [7, 16], [99, 3], [12345, 8]]) {
    const added = new Map(), col = { addMesh: (key, positions) => { added.set(key, Float32Array.from(positions)); }, removeBucket: () => {} };
    const span = createEgSpan({ renderer: null, seed, c }), draws = [];
    span.stand({ dynamicDraws: draws, collider: col });
    for (const spec of egCircleSpecs(seed, c, 0)) for (const s of spec.steps) {
      if (s.kind === 'slag') continue;
      const want = ['drift', 'beat', 'riser'].includes(s.kind) ? stepTris(s.kind).positions : s.kind === 'crumble' || s.kind === 'bone' ? stepTris('crumble').positions : s.kind === 'drop' ? egDropTris(s.w, s.d).positions : egSlabTris(s.w, s.d).positions;
      assert.deepEqual([...added.get(`eg:step:${spec.h}:${s.i}`)], [...want], `circle ${c} ${s.kind} ${s.i}`);
    }
    span.clear();
  }
});

test('EG-LOOK NO HOUR\'S CLOCK BUT A BEAT\'S, EVERY PIECE IN ITS BAND\'S DRESS (Elite-Gates-Look.md "The span pieces wore the Steps\' clock faces"): over every band\'s circles every mesh the spans make wears its band\'s archive or its tell archive - the Hour\'s own only for a Beat\'s dial (its frames the Steps\' pictures) and the waystones\', the vane\'s and the grit\'s parts; never the Steps\' drift deck, riser rack or crumble basalt (mutants: a Drift the Steps\' deck; a Crumble the Hour\'s basalt)', () => {
  const steps = new Set([SD_STEPS_RECORD.drift, SD_STEPS_RECORD.riser, ...SD_STEPS_RECORD.crumble, SD_STEPS_RECORD.falter, ...SD_STEPS_RECORD.beat.slice(1)]);
  for (const seed of [7, 99]) for (let c = 1; c <= 20; c++) {
    const band = egBandOfCircle(c), made = [];
    const R = { createMesh: (m) => { made.push(m); return { subMeshes: m.subMeshes }; }, destroyMesh: () => {}, updateMeshVertices: () => {} };
    const span = createEgSpan({ renderer: R, seed, c });
    span.stand({ dynamicDraws: [], collider: null });
    // PIN MOVED (FIELD BUGS 2026-10-20f ORRERY-STONES, scenes/eliteGates/egOrrery.js): an Athenaeum's stones are the Hour's Orrery's own -
    // their dials, kingdoms' reliefs and hands wear the Hour's hall pictures (world/superDungeon/sdHallArt.js), and only theirs; their brass
    // the band's
    const athenaeum = egCircleSpecs(seed, c).some((q) => q.kind === 'athenaeum'), hall = [SD_HALL_ATLAS_RECORD, SD_HALL_GLOW_RECORD.brass];
    for (const m of made) for (const sm of m.subMeshes) {
      if (sm.textureArchive === SD_REALM_ARCHIVE) {
        assert.ok(!steps.has(sm.textureRecord), `circle ${c}: the Steps' record ${sm.textureRecord}`);
        assert.ok([SD_STEPS_RECORD.beat[0], SD_STEPS_RECORD.parts, SD_STEPS_RECORD.partsDark, ...(athenaeum ? hall : [])].includes(sm.textureRecord), `circle ${c}: the Hour's record ${sm.textureRecord}`);
      } else assert.ok(sm.textureArchive === egBandArchive(band) || sm.textureArchive === egTellArchive(band), `circle ${c}: archive ${sm.textureArchive} record ${sm.textureRecord}`);
    }
    // a dial only on a Beat's kind
    const dial = made.filter((m) => m.subMeshes.some((sm) => sm.textureArchive === SD_REALM_ARCHIVE && sm.textureRecord === SD_STEPS_RECORD.beat[0]));
    assert.equal(dial.length, span.marks.beats.length, `circle ${c}: a dial a beat's kind`);
    span.clear();
  }
});

test('EG-LOOK A BEAT\'S DIAL IN THE BAND\'S STONE, DISSOLVING WHOLE (Elite-Gates.md section 10.3 - the Beat\'s tell: "the last 0.4 s white ... dissolving"; world/eliteGates/egBandArt.js EG_BEAT_TELL_RECORDS): its dial, bezel and line the Steps\' own picture (every frame and warning the law\'s), its stone the band\'s moulding and strata alone - and those dissolve with it, each stage keeping exactly the cells the dial\'s does, dark, cut out; its warning\'s map carries its stone\'s stage beside its dial\'s (mutants: the stone left solid; a stone stage kept whole)', () => {
  for (let band = 0; band < 4; band++) {
    const plan = egPiecePlan(lone('beat').spec, lone('beat').s, { seed: 11, band, w: 3, d: 2.6 }), m = egBeatModel(band, plan);
    const recs = new Set(m.subMeshes.map((sm) => `${sm.textureArchive}_${sm.textureRecord}`));
    assert.deepEqual([...recs].sort(), [`${SD_REALM_ARCHIVE}_${SD_STEPS_RECORD.beat[0]}`, ...EG_BEAT_STONE_RECORDS.map((q) => `${egBandArchive(band)}_${q.rec}`)].sort(), `band ${band}: its dial and its stone alone`);
    const art = new Map(egBeatStoneArt(band));
    for (const q of EG_BEAT_STONE_RECORDS) {
      const [, base] = egBandArtOf(band, q.rec);
      for (const [list, keeps] of [[q.warn, SD_BEAT_DISSOLVE.keep], [q.back, SD_BEAT_DISSOLVE.keep.slice(0, 3)]]) list.forEach((rec, k) => {
        const a = art.get(rec), W = a.albedo.width;
        let kept = 0, want = 0, lit = 0;
        for (let y = 0; y < a.albedo.height; y++) for (let x = 0; x < W; x++) {
          const i = (y * W + x) * 4, on = BAYER4[((Math.floor(y / 3) & 3) << 2) | (Math.floor(x / 3) & 3)] < keeps[k];
          if (a.albedo.colors[i + 3] > 0) kept++;
          if (on) { want++; assert.equal(a.albedo.colors[i], base.albedo.colors[i]); }
          lit += a.emission.colors[i] + a.emission.colors[i + 1] + a.emission.colors[i + 2];
        }
        assert.equal(kept, want, `band ${band} record ${q.rec} stage ${k}: the dither's cells`);
        assert.equal(lit, 0, 'stone does not glow');
      });
    }
  }
  // on the screen: a Beat's warning maps its dial and its stone
  let found = null;
  for (let c = 1; c <= 20 && !found; c++) if (egCircleSpecs(7, c, 0).some((s) => s.steps.some((q) => q.kind === 'beat' && q.beat === 0))) found = c;
  const up = [], R = { createMesh: (m) => ({ subMeshes: m.subMeshes }), destroyMesh: () => {}, updateMeshVertices: () => {}, uploadTexture: (a, rec, img, o) => up.push({ a, rec, o }), uploadEmissionTexture: () => {} };
  const span = createEgSpan({ renderer: R, seed: 7, c: found }), band = egBandOfCircle(found);
  span.stand({ dynamicDraws: [], collider: null });
  span.ride(SD_BEAT_SOLID - SD_BEAT_BLINK + 1.5 * SD_BEAT_OUT_STAGE_S, 0.016, null, false);   // its warning's second stage
  const map = span.marks.beats.find((b) => b.kind === 'beat@0').map;
  for (const q of EG_BEAT_STONE_RECORDS) assert.ok(map.get(`${egBandArchive(band)}_${q.rec}`) === `${egTellArchive(band)}_${q.warn[1]}`, `its ${q.rec} dissolving at its second stage`);
  assert.ok(EG_BEAT_STONE_RECORDS.every((q) => [...q.warn, ...q.back].every((rec) => up.some((u) => u.a === egTellArchive(band) && u.rec === rec && u.o?.cutout))), 'its stone\'s stages up, cut out');
  span.clear();
});

test('EG-LOOK A CRUMBLE\'S STAGES IN THE BAND\'S FLAGS (Elite-Gates.md section 10.3 - "three crack stages, and the rewind as it returns"): its rest, its stages and its chunks the Steps\' own geometry (its cracks where it breaks), worn under the band\'s tell archive; its top the band\'s floor picture itself where no crack runs, its cracks the Steps\' own widths lit as the Steps\' light them, wider and brighter stage by stage; its chunks the Steps\' (two on a phone) (mutants: the stages one record; the top the Hour\'s basalt)', () => {
  const box = buildStepModel('crumble');
  for (let band = 0; band < 4; band++) {
    const M = egCrumbleModels(band, 4), arch = egTellArchive(band);
    for (const [m, rec] of [[M.rest, EG_CRUMBLE_TELL_RECORDS[0]], ...M.stages.map((q, k) => [q, EG_CRUMBLE_TELL_RECORDS[k + 1]])]) {
      assert.deepEqual([...m.positions], [...box.positions], 'the Steps\' own box');
      assert.deepEqual(m.subMeshes.map((sm) => [sm.textureArchive, sm.textureRecord]), [[arch, rec]]);
    }
    const chunks = buildCrumbleChunks(4);
    M.chunks.forEach((q, j) => { assert.deepEqual([...q.model.positions], [...chunks[j].model.positions]); assert.deepEqual(q.at, chunks[j].at); assert.equal(q.model.subMeshes[0].textureRecord, EG_CRUMBLE_TELL_RECORDS[3]); });
    assert.equal(egCrumbleModels(band, 2).chunks.length, 2, 'two on a phone');
    // the pictures: the band's floor between the cracks, the cracks' light growing stage by stage
    const floor = egBandArtOf(band, EG_DRESS.floor)[1].albedo, A = SD_STEPS_ATLAS, [x0, y0, w] = A.top;
    let lastLit = -1;
    for (let n = 0; n < 4; n++) {
      const art = egCrumbleArt(band, n);
      let same = 0, open = 0, lit = 0;
      for (let y = 0; y < w; y++) for (let x = 0; x < w; x++) {
        const mx = ((x + 0.5) / w - 0.5) * (SD_CRUMBLE_SIZE.w - 2 * SD_STEP_BEVEL), mz = ((y + 0.5) / w - 0.5) * (SD_CRUMBLE_SIZE.d - 2 * SD_STEP_BEVEL), [dm, db] = crackDistance(mx, mz), S = SD_CRACK_STAGES[n];
        const i = ((y0 + y) * A.w + x0 + x) * 4, e = art.emission.colors[i] + art.emission.colors[i + 1] + art.emission.colors[i + 2];
        if (Math.min(dm, db * (S.branch ? 1.4 : 2.2)) >= S.lip + 0.02) { open++; const fu = (((mx / 2 + 0.5) % 1) + 1) % 1, fv = (((mz / 2 + 0.5) % 1) + 1) % 1, j = (Math.floor(fv * floor.height) * floor.width + Math.floor(fu * floor.width)) * 4; if ([0, 1, 2].every((k) => Math.abs(art.albedo.colors[i + k] - floor.colors[j + k]) <= 24)) same++; }
        lit += e;
      }
      assert.ok(same / open > 0.95, `band ${band} stage ${n}: the band's floor between the cracks (${same} of ${open})`);
      assert.ok(lit > lastLit, `stage ${n}: its cracks brighter`);
      lastLit = lit;
    }
    assert.ok(SD_STEPS_GLOW.crack[3] > SD_STEPS_GLOW.crack[0]);
  }
});

test('EG-LOOK GRATH\'S ISLES WITHOUT TEETH (Elite-Gates-Look.md section 2 - "the Spire\'s discs lose the gear teeth"; Elite-Gates.md section 13.3): an isle is the court\'s plates laid flat on the law\'s own 48 sides, THE EDGE LINE\'s strip round its rim, the band\'s cornice under it and its stone down into the magma - nothing over its top, nothing out of its rim but under the strip and within the teeth\'s reach; the spans stand each where it stands and drop it as the relay says (mutants: the strip inside the rim; a tooth\'s height kept)', () => {
  for (let band = 0; band < 4; band++) {
    const r = 11, m = egIsleModel(band, r), tris = trisOf(m);
    assert.deepEqual(m.subMeshes.map((sm) => sm.textureRecord), [EG_DRESS.arena, EG_DRESS.edge, EG_KIT_RECORD.moulding, EG_KIT_RECORD.found]);
    assert.ok(m.subMeshes.every((sm) => sm.textureArchive === egBandArchive(band)));
    for (const t of tris) for (const p of t.v) {
      const rr = Math.hypot(p[0], p[2]);
      assert.ok(p[1] <= L.edge.top + E, `band ${band}: nothing over its top (${p[1]})`);
      assert.ok(rr <= r + L.reach + E, `band ${band}: within the teeth's reach (${rr - r})`);
      if (t.rec === EG_KIT_RECORD.moulding && rr > r * 1.002 + 1e-3) assert.ok(p[1] <= L.corniceTop + E, 'its cornice under the strip');
      if (t.rec === EG_DRESS.edge) assert.ok(rr >= r, 'its strip out of the rim');
    }
    const top = tris.filter((t) => t.rec === EG_DRESS.arena);
    assert.equal(top.length, SD_ISLAND_SIDES, 'the law\'s 48 sides');
    for (const t of top) for (const p of t.v) assert.ok(Math.abs(p[1]) < 1e-6 && (Math.hypot(p[0], p[2]) < 1e-6 || Math.abs(Math.hypot(p[0], p[2]) - r) < 1e-4));
  }
  // the spans' isles: their draw where the disc stands
  const span = createEgSpan({ renderer: { createMesh: (m) => ({ subMeshes: m.subMeshes, model: m }), destroyMesh: () => {} }, seed: 7, c: 1 }), draws = [];
  span.stand({ dynamicDraws: draws, collider: null });
  const isles = draws.filter((d) => d.sphere);
  assert.ok(isles.length >= 3);
  for (const d of isles) assert.ok(d.gpu.model.subMeshes.some((sm) => sm.textureRecord === EG_KIT_RECORD.moulding), 'its cornice');
  span.clear();
});

test('EG-LOOK A KIND OF MANY MODELS (scenes/eliteGates/egPieceBatch.js): each copy wears its own model - its own vertex run in its kind\'s mesh, its own cull sphere - the kind a sub-mesh a record over every copy that wears it (in the order its copies first wear them); a copy written where its slot stands it, a hidden one put away; the batch\'s measure counts every copy\'s triangles (mutants: every copy its kind\'s first model; the runs laid at the first model\'s length)', () => {
  const R = { made: [], createMesh: (m) => { const g = { model: m, subMeshes: m.subMeshes, positions: Float32Array.from(m.positions) }; R.made.push(g); return g; }, updateMeshVertices: (g, p) => g.positions.set(p), destroyMesh: () => {} };
  const quad = (rec, s, y = 0) => ({ positions: new Float32Array([-s, y, -s, s, y, -s, s, y, s, -s, y, s]), normals: new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0]), uvs: new Float32Array(8), indices: new Uint32Array([0, 1, 2, 0, 2, 3]), subMeshes: [{ textureArchive: 9, textureRecord: rec, startIndex: 0, primitiveCount: 2 }] });
  const two = { positions: new Float32Array([0, 0, 0, 1, 0, 0, 1, 0, 1, 0, 5, 0, 1, 5, 0, 1, 5, 1]), normals: new Float32Array(18), uvs: new Float32Array(12), indices: new Uint32Array([0, 1, 2, 3, 4, 5]), subMeshes: [{ textureArchive: 9, textureRecord: 3, startIndex: 0, primitiveCount: 1 }, { textureArchive: 9, textureRecord: 7, startIndex: 3, primitiveCount: 1 }] };
  const A = quad(7, 1), B = two;
  const slot = (x) => { const m = new Float32Array(16); m[0] = m[5] = m[10] = m[15] = 1; m[12] = x; return { object: { matrix: m }, hidden: false }; };
  const batch = createEgPieceBatch({ renderer: R }), s = [slot(0), slot(10), slot(20)];
  batch.add('k', A, s[0]); batch.add('k', B, s[1]); batch.add('k', A, s[2]);
  const draws = [];
  batch.build(draws);
  const g = R.made[0];
  assert.deepEqual(g.subMeshes.map((q) => [q.textureRecord, q.primitiveCount]), [[7, 2 + 1 + 2], [3, 1]], 'a sub-mesh a record, every copy that wears it');
  assert.equal(g.model.positions.length, (4 + 6 + 4) * 3, 'each copy its own run');
  batch.cull(null);
  assert.deepEqual(batch.copyVertex('k', 1, 3), [10, 5, 0], 'the second copy its own model, at its slot');
  assert.deepEqual(batch.copyVertex('k', 2, 0), [19, 0, -1], 'the third after it');
  assert.deepEqual(batch.copyAt('k', 1), [10, 0, 0]);
  assert.equal(batch.stats().tris, 2 + 2 + 2);
  assert.deepEqual(batch.kinds(), [{ key: 'k', copies: 3, models: 2, subs: 2, turns: false }]);
  s[1].hidden = true;
  batch.cull(null);
  assert.equal(batch.copyVertex('k', 1, 5)[1], EG_BATCH_HIDE_Y, 'put away');
  assert.deepEqual(batch.copyVertex('k', 2, 0), [19, 0, -1], 'its neighbour where it was');
  batch.clear();
});

test('EG-LOOK A CIRCLE\'S KINDS A HANDFUL, ITS TRIANGLES MEASURED (tools/spireLabProbe.mjs: "the pieces in a handful of draws" - kinds at most 16; Elite-Gates-Look.md section 10): over three seeds\' twenty circles the spans stand at most EG_SPAN_KINDS_MAX batch kinds and at most 48 GL draws; every band\'s first circle stands its pieces under 15,000 triangles, a phone\'s fewer; the stand the same bytes every time (mutants: a kind a piece; the lite tier ignored)', () => {
  const fake = () => { const made = []; return { made, createMesh: (m) => { made.push(m); return { subMeshes: m.subMeshes }; }, destroyMesh: () => {}, updateMeshVertices: () => {} }; };
  let worst = 0;
  for (const seed of SEEDS) for (let c = 1; c <= 20; c++) {
    const span = createEgSpan({ renderer: fake(), seed, c, lite: false });
    span.stand({ dynamicDraws: [], collider: null });
    span.ride(1000, 0.016, null, false); span.cull(null, null);
    const st = span.batchStats();
    worst = Math.max(worst, st.kinds);
    assert.ok(st.kinds <= EG_SPAN_KINDS_MAX && st.glDraws <= 48, `seed ${seed} circle ${c}: ${st.kinds} kinds, ${st.glDraws} GL draws`);
    span.clear();
  }
  assert.ok(worst >= 7, `the worst circle ${worst} kinds`);
  for (const c of [1, 6, 11, 16]) {
    const tris = (lite) => { const R = fake(), span = createEgSpan({ renderer: R, seed: 7, c, lite }); span.stand({ dynamicDraws: [], collider: null }); const n = R.made.reduce((a, m) => a + m.indices.length / 3, 0); span.clear(); return { n, R }; };
    const d = tris(false), l = tris(true);
    assert.ok(d.n < 15000, `circle ${c}: ${d.n} triangles`);
    assert.ok(l.n < d.n, `circle ${c}: a phone's ${l.n} under ${d.n}`);
    const again = tris(false);
    assert.equal(again.R.made.length, d.R.made.length);
    again.R.made.forEach((m, k) => assert.deepEqual([...m.positions], [...d.R.made[k].positions], `circle ${c}: the same bytes`));
  }
});

test('EG-LOOK EACH PIECE ITS OWN, AND PURE (the swap\'s worker\'s law - common brief): two pieces of a kind lay different stone (their seeds), the same seed the same bytes; the builders import no scene, renderer or screen; the spans\' pieces in the dress the band\'s tops and cornices name (mutants: one seed for every piece)', () => {
  const { spec, s } = lone('still'), a = egPieceModel(0, egPiecePlan(spec, s, { seed: egPieceSeed(7, 1, 0, 1) })), b = egPieceModel(0, egPiecePlan(spec, s, { seed: egPieceSeed(7, 1, 0, 2) }));
  assert.notDeepEqual([...a.positions], [...b.positions], 'two pieces, two stones');
  assert.deepEqual([...egPieceModel(0, egPiecePlan(spec, s, { seed: egPieceSeed(7, 1, 0, 1) })).positions], [...a.positions], 'the same seed, the same bytes');
  assert.notEqual(egPieceSeed(7, 1, 0, 1), egPieceSeed(7, 1, 0, 2)); assert.notEqual(egPieceSeed(7, 1, 0, 1), egPieceSeed(7, 2, 0, 1)); assert.notEqual(egPieceSeed(7, 1, 0, 1), egPieceSeed(99, 1, 0, 1));
  for (const f of ['src/world/eliteGates/egPlatformModel.js', 'src/world/eliteGates/egPlatformArt.js']) {
    const src = readFileSync(new URL(`../../../${f}`, import.meta.url), 'utf8');
    for (const m of src.matchAll(/^import .* from '([^']+)';/gm)) assert.ok(/^(?:\.\/|\.\.\/(?!\.\.\/)|\.\.\/\.\.\/net\/)/.test(m[1]), `${f}: imports ${m[1]}`);   // the world layer's and the law's alone (EG-FILE: from world/eliteGates/)
  }
  // every kind's piece in every band: the band's flags on top, the kit's moulding and found under it
  for (let band = 0; band < 4; band++) for (const kind of KINDS) {
    const L0 = lone(kind), B = ['drift', 'beat', 'riser'].includes(kind) ? stepBox(kind) : { w: L0.s.w, d: L0.s.d }, plan = egPiecePlan(L0.spec, L0.s, { seed: 3, band, w: B.w, d: B.d }), m = modelFor(band, plan);
    const recs = new Set(m.subMeshes.filter((sm) => sm.textureArchive === egBandArchive(band)).map((sm) => sm.textureRecord));
    assert.ok(recs.has(EG_KIT_RECORD.moulding) && recs.has(EG_KIT_RECORD.found), `band ${band} ${kind}: its cornice and its strata`);
    if (kind !== 'beat') assert.ok(recs.has(EG_DRESS.floor) && recs.has(EG_DRESS.edge), `band ${band} ${kind}: its flags and its edge line`);
    if (kind === 'riser') assert.ok(recs.has(EG_DRESS.pillar), 'a riser\'s ashlar');
  }
  // a lite cornice: three faces at the same reach, no spikes
  for (let band = 0; band < 4; band++) { const C = egCornice(band, true); assert.equal(C.profile.length, 4); assert.equal(egCorniceReach(C.profile), egCorniceReach(egCornice(band).profile)); assert.equal(C.spikes, null); }
  assert.ok(T > 0);
});

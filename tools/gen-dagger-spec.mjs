// DAGGER_SPEC v2 generator (C6k resculpt): the FULL spec from the
// classic-body measurement set. Depth stays the ONE documented
// front-view assumption (DEPTH ratios below); the knee split sanity-
// clamps to [0.38, 0.62] of hip->plant (a window-edge minimum is a
// detection artefact, not anatomy). Regenerate, never hand-edit.
// Usage: ARENA2_PATH=... node tools/gen-dagger-spec.mjs
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const M = JSON.parse(execFileSync('node', [resolve(ROOT, 'tools/body-measure.mjs'), '00', '0'], { env: process.env }));
const R = M.rig;
const TORSO_DEPTH = 0.7;   // rz = rx * DEPTH (front-view sprite carries no depth)
const PELVIS_DEPTH = 0.575; // Voxlight pelvis rz/rx, kept

const HALF = M.unit / 2;
// PER-ROW SLABS: each pixel row is painted ONLY by its own interval -
// a centre-to-centre prism rasterizes both boundary rows and bleeds
// its neighbour's wider interval through the diagonal (the gap fills
// Mac circled). A slab = two entries at the row's top/bottom edges;
// consecutive slabs with identical intervals merge, differing ones
// carry brk so the loft never bridges the change. This IS the pixel
// semantics: sprites are slabs.
const capRows = (rows) => {
  const out = [];
  for (const r of rows) {
    const prev = out[out.length - 1];
    if (prev && prev.cx === r.cx && prev.rx === r.rx) {
      prev.y = +(r.y + HALF).toFixed(4); // extend the running slab
      continue;
    }
    out.push({ ...r, y: +(r.y - HALF).toFixed(4), brk: !!out.length });
    out.push({ ...r, y: +(r.y + HALF).toFixed(4) });
  }
  return out;
};
const markBreaks = (rows) => rows; // superseded: slabs carry brk at every interval change

const prof = [...M.torsoProfile].sort((a, b) => a.yRig - b.yRig);
// Pelvis depth taper (shared by the trunk rows and the relief plates):
// the trunk's depth blends into the leg depth over the hip band.
const depthK = (y) => y >= 1.16 ? TORSO_DEPTH : TORSO_DEPTH + (0.45 - TORSO_DEPTH) * Math.min(1, (1.16 - y) / 0.13);
const frontAt = (y) => {
  let tz = 0.105; // below the trunk: thigh-front level
  for (const t of prof) if (Math.abs(t.yRig - y) < 0.02) return t.halfW * depthK(y);
  for (const r of M.hairRows) if (Math.abs(r.y - y) < 0.01) return r.halfW * 0.6; // the hair/traps loft surface above the armpit
  return tz;
};
const hipsHalf = prof[0].halfW;
const armpitHalf = prof[prof.length - 1].halfW;
// The trace carries its own centres - the contrapposto lean is DATA.
// No synthetic below-crotch row: the torso trace ends at the real
// crotch row (a synthetic hips row extended the trunk into the traced
// leg gap and blotched the groin).
const rows = capRows([
  // Pelvis depth taper: the trunk's depth blends into the LEG depth
  // over the hip band (y 1.16 -> the trunk's bottom) so the pelvis
  // does not shelf over the thigh tops - the front view is unchanged
  // (rz is the front-free dimension).
  ...prof.map((t) => ({ y: t.yRig, cx: t.centerRig, rx: t.halfW, rz: +(t.halfW * depthK(t.yRig)).toFixed(4) })),
  { y: R.shoulderY, cx: prof[prof.length - 1].centerRig, rx: +(armpitHalf * 0.95).toFixed(4), rz: +(armpitHalf * 0.95 * TORSO_DEPTH).toFixed(4) },
]);

const plant = 0.06;
const reach = R.pelvisY - plant;
let kneeFrac = (R.pelvisY - R.kneeY) / reach;
const kneeClamped = kneeFrac < 0.38 || kneeFrac > 0.62;
if (kneeClamped) kneeFrac = 0.53;

const headScale = +(R.headW / 0.214).toFixed(4);
const headLift = +(R.headTopY - 1.62 - 0.28 * headScale).toFixed(4);
// Arm skeleton from the measured BARS (the split-band arm runs):
// joint under the deltoid, elbow at the merge boundary between the
// upper band (right arm visible) and forearm band (left arm visible),
// wrist at the left bar's bottom. Classic's forearm is LONGER than
// its upper arm - the elbow rides high.
const AB = M.armBars;
const shoulderJx = +(((Math.abs(AB.left.cxTop) + Math.abs(AB.right.cxTop)) / 2 - 0.02)).toFixed(4);
const shoulderJy = +(R.armpitY - 0.02).toFixed(4);
const elbowY = +(((AB.right.yBot + AB.left.yTop) / 2)).toFixed(4);
const upper = +((shoulderJy - elbowY)).toFixed(4);
const fore = +Math.hypot(Math.abs(AB.left.cxBot) - shoulderJx, elbowY - AB.left.yBot).toFixed(4);

const spec = {
  pelvis: {
    y0: +(R.pelvisY - 0.14).toFixed(4), y1: +(R.pelvisY + 0.02).toFixed(4),
    rx0: +(hipsHalf * 0.9).toFixed(4), rz0: +(hipsHalf * 0.9 * PELVIS_DEPTH).toFixed(4),
    rx1: hipsHalf, rz1: +(hipsHalf * PELVIS_DEPTH).toFixed(4),
  },
  chest: {
    y0: +(R.pelvisY - 0.06).toFixed(4), y1: R.armpitY,
    rx0: hipsHalf, rz0: +(hipsHalf * TORSO_DEPTH).toFixed(4),
    rx1: armpitHalf, rz1: +(armpitHalf * TORSO_DEPTH).toFixed(4),
  },
  upperChest: { y1: R.shoulderY, rx1: +(armpitHalf * 0.95).toFixed(4), rz1: +(armpitHalf * 0.95 * TORSO_DEPTH).toFixed(4) },
  neck: { y0: +(R.shoulderY - 0.03).toFixed(4), z0: 0.011, y1: 1.61, z1: 0.014, rx0: 0.104, rz0: 0.088, rx1: 0.065, rz1: 0.065 },
  deltoid: {
    x0: +(R.shoulderHalfSpan - 0.0945 - 0.07).toFixed(4), y0: +(R.shoulderY + 0.02).toFixed(4),
    x1: +(R.shoulderHalfSpan - 0.0945).toFixed(4), y1: +(R.shoulderY - 0.075).toFixed(4),
    rU0: 0.0738, rV0: 0.09, rU1: 0.0801, rV1: 0.0945,
  },
  hipX: R.hipX,
  pelvisY: R.pelvisY,
  leg: {
    thigh: +(reach * kneeFrac).toFixed(4), calf: +(reach * (1 - kneeFrac)).toFixed(4),
    thighR: +((R.thighW / 2) / 0.115).toFixed(4), calfR: +((R.calfW / 2) / 0.0827).toFixed(4),
  },
  head: { scale: headScale, lift: headLift },
  arm: {
    shoulderX: shoulderJx, shoulderY: shoulderJy,
    upper, fore, r: +((AB.right.halfW) / 0.076).toFixed(4), rFore: +((AB.left.halfW) / 0.073).toFixed(4),
  },
  handScale: 2.2, // fit against the silhouette gate: the classic fist is 14px on a 10px forearm (chunky pixel-art hands); peak of the sweep 1.3-2.3
  foot: { ankleH: 0.05, footL: 0.16 },
  // Exact raster mapping: the traces were measured IN sprite columns -
  // rig x = (col - headCx) * unit, rig y = (feetRow - row + 0.5) * unit.
  // The metric registers by THIS, not by centroid estimation.
  // +0.5 col / -0.5 row: measured centres are (a+b)/2 but pixel block
  // [a..b] centres at (a+b+1)/2, and row centres must land ON the
  // sampler's k+0.5 points - without these the whole model sits half a
  // pixel up-left and center-sampling rims every edge (blue left, red
  // right - Mac's screenshot exactly).
  traceMap: { u: M.unit, colOffset: +(M.headCxCol + 0.5).toFixed(3), rowTop: M.rows.top - 0.5 },
  torsoRows: rows,
  // Leg ROW TRACE: per-row lofts keyed by side sign (neg = rig -x =
  // image left = the sprite's weight leg). Depth rounder than the
  // trunk (legs are near-cylindrical). The trace carries the stance.
  legRows: {
    neg: markBreaks(capRows(M.legRows.weight.map((r) => ({ y: r.y, cx: r.cx, rx: r.rx, rz: +(r.rx * 0.85).toFixed(4) })).sort((a, b) => a.y - b.y))),
    pos: markBreaks(capRows(M.legRows.free.map((r) => ({ y: r.y, cx: r.cx, rx: r.rx, rz: +(r.rx * 0.85).toFixed(4) })).sort((a, b) => a.y - b.y))),
  },
  // Arm ROW TRACE: per-row lofts, neg = image-left slack arm, pos =
  // image-right tucked arm. Arms are round: rz = rx * 0.9. The trace
  // carries the fists (wider bottom rows) - handScale retires under
  // paperdoll builds.
  armRows: {
    neg: markBreaks(capRows(M.armRows.left.map((r) => ({ y: r.y, cx: r.cx, rx: r.rx, rz: +(r.rx * 0.9).toFixed(4) })).sort((a, b) => a.y - b.y))),
    pos: markBreaks(capRows(M.armRows.right.map((r) => ({ y: r.y, cx: r.cx, rx: r.rx, rz: +(r.rx * 0.9).toFixed(4) })).sort((a, b) => a.y - b.y))),
  },
  // Tucked-hand OVERLAY: additive geometry only (a subset of the
  // sprite run - the union and the torso emission are untouched).
  // Rides in front of the hip; cz is the flush/proud knob.
  armOverlay: capRows(M.armOverlay.map((r) => {
    // Ride the torso surface: cz from the trunk's own depth at this
    // height (front of the wedge sits half-proud of the hip).
    const rz = +(r.rx * 0.9).toFixed(4);
    return { y: r.y, cx: r.cx, rx: r.rx, rz, cz: +Math.max(0, frontAt(r.y) - rz * 0.5).toFixed(4) };
  }).sort((a, b) => a.y - b.y)),
  // TORSO/GROIN RELIEF: interior bright islands as thin plates riding
  // the front surface - the drawn pec/ab/navel highlights become form.
  // lift scales brightness-over-median; a subset of the run, so the
  // silhouette is untouched by construction.
  torsoRelief: M.torsoRelief.flatMap((r) => {
    const base = { cx: r.cx, rx: r.rx, rz: 0.012, cz: +(frontAt(r.y) - 0.006 + r.lift * 0.3).toFixed(4) };
    return [{ ...base, y: +(r.y - HALF).toFixed(4), brk: true }, { ...base, y: +(r.y + HALF).toFixed(4) }];
  }),
  // Exact single-run rows: hair + traps + deltoid mass fused, per the
  // sprite. Depth ratio shallower than the trunk (hair hugs the head).
  hairRows: capRows(M.hairRows.map((r) => ({ y: r.y, cx: r.cx, rx: r.halfW, rz: +(r.halfW * 0.6).toFixed(4) })).sort((a, b) => a.y - b.y)),
};
const body = `// DAGGER_SPEC v2 (Characters C6k resculpt) - GENERATED by
// tools/gen-dagger-spec.mjs from tools/body-measure.mjs over
// ${M.source}. EVERY dimension derives from the classic body:
// per-row torso loft (${rows.length} rows, depth = rx * ${TORSO_DEPTH} - the one
// documented front-view assumption), head scale/lift solved from the
// crown (${R.headW} wide topping ${R.headTopY}), shoulders at ${R.shoulderY},
// arms ${R.armW} thick reaching wrist ${R.wristY}, legs split at the
// ${kneeClamped ? 'SANITY-CLAMPED 0.53 knee (window-edge minimum rejected)' : 'measured knee'}
// with thighR/calfR radius ratios from the measured widths.
// Acceptance: test/silhouette.test.js (front IoU vs the sprite mask).
// Do not hand-edit; regenerate.
export const DAGGER_SPEC = ${JSON.stringify(spec, null, 1).replace(/"/g, "'")};
`;
writeFileSync(resolve(ROOT, 'src/characters/daggerBodySpec.js'), body);
console.log('DAGGER_SPEC v2:', rows.length, 'torso rows | head s', headScale, 'lift', headLift, '| knee', kneeClamped ? 'clamped 0.53' : kneeFrac.toFixed(3), '| armR', spec.arm.r, 'legR', spec.leg.thighR, spec.leg.calfR);

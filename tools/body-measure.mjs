// FULL-BODY measurement of the classic paperdoll body (C6k resculpt
// foundation). Every dimension the voxel model needs, pose-corrected:
//   - torso width per row about the DRIFTING centreline (contrapposto
//     lean tracked row to row); where an arm merges into the torso,
//     subtract the arm's thickness measured from the SPLIT side at
//     that row (both merged -> subtract both nearest arm widths)
//   - head rows + width + centre, neck pinch row + width
//   - shoulder row (max span) + deltoid extent
//   - arm thickness per split row, wrist row
//   - leg thickness per row, knee = width minimum mid-leg, ankle, foot
// Output: rig-unit measurement JSON (unit = 1.922 / body rows) - the
// input to SPEC v2 (full body incl. head/arms) upstream.
// Usage: ARENA2_PATH=... node tools/body-measure.mjs [race] [gender]
import { readFileSync } from 'node:fs';
import { ImgFile } from '../src/formats/imgFile.js';
import { DFPalette } from '../src/formats/dfPalette.js';

const A = process.env.ARENA2_PATH;
const race = process.argv[2] ?? '00';
const gender = process.argv[3] ?? '0';
const pal = new DFPalette();
pal.load(readFileSync(`${A}/ART_PAL.COL`), 'ART_PAL.COL');
const img = new ImgFile();
img.load(readFileSync(`${A}/BODY${race}I${gender}.IMG`), `BODY${race}I${gender}.IMG`, pal);
const { width: W, height: H, data } = img.getDFBitmap();

const rows = [];
for (let y = 0; y < H; y++) {
  const runs = []; let s = -1;
  for (let x = 0; x <= W; x++) {
    const on = x < W && data[y * W + x] !== 0;
    if (on && s < 0) s = x;
    if (!on && s >= 0) { runs.push([s, x - 1]); s = -1; }
  }
  rows.push(runs);
}
const width = (r) => r[1] - r[0] + 1;
const mid = (r) => (r[0] + r[1]) / 2;

let top = 0; while (!rows[top].length) top++;
let feet = H - 1; while (!rows[feet].length) feet--;
const RIG_H = 1.922;
const u = RIG_H / (feet - top + 1);
const yRig = (row) => +((feet - row + 0.5) * u).toFixed(4);

// Crotch = the TORSO SPLIT: first row where two similar-width runs
// (|wA-wB| <= 8) overlap the previous torso span with the previous
// torso centre strictly between their centres. Arm separations fail
// the symmetry test (torso vs arm widths differ wildly); the tracked
// centreline can sit a pixel onto the weight leg at the split, so the
// between-centres test replaces any exact gap-straddle.
let torsoRun0 = rows[top][0];
let crotch = -1;
for (let y = top + 1; y <= feet; y++) {
  const r = rows[y];
  if (!r.length) continue;
  const prev = torsoRun0, prevCx = mid(prev);
  const inside = r.filter((run) => run[1] >= prev[0] && run[0] <= prev[1]);
  if (inside.length >= 2) {
    inside.sort((a, b) => a[0] - b[0]);
    for (let i = 0; i + 1 < inside.length; i++) {
      const A = inside[i], B = inside[i + 1];
      if (Math.abs(width(A) - width(B)) <= 8 && mid(A) < prevCx && mid(B) > prevCx) { crotch = y; break; }
    }
    if (crotch >= 0) break;
  }
  // Track the torso: the inside run nearest the previous centre.
  let best = inside.length ? inside[0] : r[0], bd = Infinity;
  for (const run of (inside.length ? inside : r)) {
    const d = prevCx >= run[0] && prevCx <= run[1] ? 0 : Math.min(Math.abs(prevCx - run[0]), Math.abs(prevCx - run[1]));
    if (d < bd) { bd = d; best = run; }
  }
  torsoRun0 = best;
}

// Shoulder row: max span above the first arm separation.
let armpit = crotch;
for (let y = top; y < crotch; y++) if (rows[y].length >= 2) { armpit = y; break; }
let shoulder = top, shoulderSpan = 0;
for (let y = top; y <= armpit; y++) {
  if (!rows[y].length) continue;
  const span = rows[y][rows[y].length - 1][1] - rows[y][0][0] + 1;
  if (span > shoulderSpan) { shoulderSpan = span; shoulder = y; }
}
// Head: the crown rows before the silhouette widens into hair/
// shoulders (this sprite has NO separable neck pinch - hair merges it;
// measured as headBottom = first row wider than 1.5x the crown).
const crownW = width(rows[top][0]);
let headBottom = top;
for (let y = top; y <= shoulder; y++) {
  if (rows[y].length !== 1) break;
  if (width(rows[y][0]) > crownW * 1.5) break;
  headBottom = y;
}
let headW = 0, headCx = 0, headN = 0;
for (let y = top; y <= headBottom; y++) {
  headW = Math.max(headW, width(rows[y][0]));
  headCx += mid(rows[y][0]); headN++;
}
headCx /= Math.max(1, headN);
const neckSeparable = false; // hair-merged on BODY00 - recorded, not invented

// Torso profile + arm thickness, tracked centreline.
let cx = mid(rows[shoulder].length ? rows[shoulder][rows[shoulder].length > 1 ? 1 : 0] : rows[shoulder][0]);
const torsoRaw = [];   // { y, w, merged: 0|1|2 arms merged, center }
const armW = [];       // { y, w } from split arm runs
for (let y = armpit; y < crotch; y++) {
  const r = rows[y];
  if (!r.length) continue;
  let torso = r[0], bd = Infinity;
  for (const run of r) {
    const d = cx >= run[0] && cx <= run[1] ? 0 : Math.min(Math.abs(cx - run[0]), Math.abs(cx - run[1]));
    if (d < bd) { bd = d; torso = run; }
  }
  cx = mid(torso);
  const merged = 3 - r.length; // 3 runs = 0 merged, 2 = 1, 1 = 2
  torsoRaw.push({ y, w: width(torso), merged, center: cx });
  for (const run of r) if (run !== torso) armW.push({ y, w: width(run) });
}
const armAt = (y) => {
  let best = null, bd = Infinity;
  for (const a of armW) { const d = Math.abs(a.y - y); if (d < bd) { bd = d; best = a; } }
  return best ? best.w : 0;
};
const meanArmW = armW.reduce((s, a) => s + a.w, 0) / Math.max(1, armW.length);
const torso = torsoRaw.map((t) => ({
  yRig: yRig(t.y),
  halfW: +(((t.w - t.merged * (armAt(t.y) + 1)) / 2) * u).toFixed(4),
  centerRig: +(((t.center - headCx)) * u).toFixed(4), // lean vs head centre
  merged: t.merged,
}));

// Legs: crotch down to the ANKLE (run width collapse < 5px or the
// two-run structure ending) - foot rows are excluded from thigh/knee/
// calf measurement.
const legs = { weight: [], free: [] };
for (let y = crotch; y <= feet; y++) {
  // The two WIDEST runs are the legs (hands/props are narrow slivers).
  const r = [...rows[y]].sort((a, b) => width(b) - width(a)).slice(0, 2)
    .sort((a, b) => a[0] - b[0]);
  if (r.length < 2 || width(r[0]) < 5 || width(r[1]) < 5) break;
  legs.weight.push({ y, w: width(r[0]), cx: mid(r[0]) });
  legs.free.push({ y, w: width(r[1]), cx: mid(r[1]) });
}
// The foot flares gradually - the ANKLE is the last width minimum in
// the bottom 40%; truncate both series there.
const truncAtAnkle = (leg) => {
  if (leg.length < 10) return leg;
  let ai = leg.length - 1;
  for (let i = Math.floor(leg.length * 0.6); i < leg.length; i++) {
    if (leg[i].w <= leg[ai].w) ai = i;
  }
  return leg.slice(0, ai + 1);
};
legs.weight = truncAtAnkle(legs.weight);
legs.free = truncAtAnkle(legs.free);
const kneeOf = (leg) => {
  if (leg.length < 9) return null;
  const a = Math.floor(leg.length * 0.3), b = Math.ceil(leg.length * 0.75);
  let best = a;
  for (let i = a; i < b; i++) if (leg[i].w < leg[best].w) best = i;
  return leg[best];
};
const kneeW = kneeOf(legs.weight), kneeF = kneeOf(legs.free);
const thighW = Math.max(...legs.weight.slice(0, Math.ceil(legs.weight.length / 3)).map((l) => l.w));
const hipXpx = legs.weight.length > 2 && legs.free.length > 2
  ? Math.abs(legs.free[2].cx - legs.weight[2].cx) / 2 : 0;
const kneeIdx = kneeW ? legs.weight.findIndex((l) => l.y === kneeW.y) : Math.floor(legs.weight.length / 2);
const calfW = Math.max(...legs.weight.slice(kneeIdx).map((l) => l.w));

// Wrist: the last split-arm row.
const wristRow = armW.length ? Math.max(...armW.map((a) => a.y)) : armpit;

const out = {
  source: `BODY${race}I${gender}.IMG`, W, H, unit: +u.toFixed(5),
  rows: { top, headBottom, shoulder, armpit, crotch, feet, wristRow },
  rig: {
    height: RIG_H,
    headTopY: yRig(top), headBottomY: yRig(headBottom), headW: +(headW * u).toFixed(4), neckSeparable,
    shoulderY: yRig(shoulder), shoulderHalfSpan: +((shoulderSpan / 2) * u).toFixed(4),
    armpitY: yRig(armpit), pelvisY: yRig(crotch),
    armW: +(meanArmW * u).toFixed(4), wristY: yRig(wristRow), hipX: +(hipXpx * u).toFixed(4),
    thighW: +(thighW * u).toFixed(4), kneeW: kneeW ? +(kneeW.w * u).toFixed(4) : null,
    kneeY: kneeW ? yRig(kneeW.y) : null, calfW: +(calfW * u).toFixed(4),
    ankleY: legs.weight.length ? yRig(legs.weight[legs.weight.length - 1].y) : null,
  },
  torsoProfile: torso,
};
console.log(JSON.stringify(out, null, 1));

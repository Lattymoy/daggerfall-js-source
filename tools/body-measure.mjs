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
function torsoRun(runs, cx) {
  let best = runs[0], bd = Infinity;
  for (const r of runs) {
    const d = cx >= r[0] && cx <= r[1] ? 0 : Math.min(Math.abs(cx - r[0]), Math.abs(cx - r[1]));
    if (d < bd) { bd = d; best = r; }
  }
  return best;
}
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

// ONE PARTITION: each row armpit..crotch-1 splits into
// [left arm][torso][right arm] at EXACT shared edges - split rows give
// the edge from the runs themselves; merged rows interpolate the torso
// edge from that side's split-row samples. torsoProfile and armRows
// both emit from this partition, so the lofts TILE with no seam and
// no overlap (adjacent pixel intervals share the boundary).
let cx = mid(rows[shoulder].length ? rows[shoulder][rows[shoulder].length > 1 ? 1 : 0] : rows[shoulder][0]);
const midX = (W - 1) / 2;
const edgeSamples = { left: [], right: [] };
const rowParts = [];
for (let y = armpit; y < crotch; y++) {
  const r = rows[y];
  if (!r.length) continue;
  const t = torsoRun(r, cx);
  cx = mid(t);
  const part = { y, t, arm: {} };
  for (const run of r) {
    if (run === t) continue;
    if (mid(run) < mid(t)) { part.arm.left = run; edgeSamples.left.push({ y, x: t[0] }); }
    else { part.arm.right = run; edgeSamples.right.push({ y, x: t[1] }); }
  }
  rowParts.push(part);
}
// Interior seam: the artists separate the tucked arm from the torso
// with a darker shading line. Per merged row, the seam = the min-
// luminance column near the previous row's inner edge (continuity
// window +-2), seeded by the last SPLIT row's exact edge.
const lum = (i) => { const c = pal.get(i); return 0.299 * c.r + 0.587 * c.g + 0.114 * c.b; };
const edgeAt = (samples, y) => {
  if (!samples.length) return null;
  let lo = null, hi = null;
  for (const s0 of samples) {
    if (s0.y <= y && (!lo || s0.y > lo.y)) lo = s0;
    if (s0.y >= y && (!hi || s0.y < hi.y)) hi = s0;
  }
  if (!lo) return hi.x;
  if (!hi) return lo.x;
  if (hi.y === lo.y) return lo.x;
  return lo.x + (hi.x - lo.x) * (y - lo.y) / (hi.y - lo.y);
};
const torso = [];
const armRows = { left: [], right: [] };
const px = data;
let mergedCounts = [0, 0, 0];
// PASS 1: per-row arm intervals. Split rows: the run's own edges.
// Merged rows: the interior SEAM (the artist's dark separator line),
// traced BIDIRECTIONALLY from the nearest split row's exact edge with
// a stay-put prior and a hug-the-anchor clamp - the left arm's merged
// band sits ABOVE its first split row, so upward tracing is required.
for (const name of ['left', 'right']) {
  const idxSplit = [];
  rowParts.forEach((part, i) => { if (part.arm[name]) idxSplit.push(i); });
  if (!idxSplit.length) continue;
  for (const i of idxSplit) {
    const r = rowParts[i].arm[name];
    rowParts[i].armInt = rowParts[i].armInt || {};
    rowParts[i].armInt[name] = [r[0], r[1], false];
  }
  const traceFrom = (i0, dir) => {
    let prev = rowParts[i0].arm[name];
    let seam = name === 'left' ? prev[1] : prev[0];
    const anchor = seam;
    for (let i = i0 + dir; i >= 0 && i < rowParts.length; i += dir) {
      const part = rowParts[i];
      if (part.arm[name]) return; // reached another seed; its own trace covers onward
      const { y, t } = part;
      let best = null, bl = Infinity;
      for (let x = seam - 2; x <= seam + 2; x++) {
        if (x <= t[0] || x >= t[1] || Math.abs(x - anchor) > 5) continue;
        const score = (0.299 * pal.get(px[y * W + x]).r + 0.587 * pal.get(px[y * W + x]).g + 0.114 * pal.get(px[y * W + x]).b) + 18 * Math.abs(x - seam);
        if (score < bl) { bl = score; best = x; }
      }
      if (best == null) return;
      seam = best;
      part.armInt = part.armInt || {};
      part.armInt[name] = name === 'left' ? [t[0], seam, true] : [seam, t[1], true];
    }
  };
  traceFrom(idxSplit[0], -1);              // upward from the first seed
  traceFrom(idxSplit[idxSplit.length - 1], 1); // downward from the last
}
// PASS 2: emit - the torso tiles against the traced arm intervals.
for (const part of rowParts) {
  const { y, t } = part;
  let le, re, merged = 0;
  const L = part.armInt?.left, R2 = part.armInt?.right;
  if (part.arm.left) le = t[0];
  else { const e = edgeAt(edgeSamples.left, y); le = e == null ? t[0] : Math.round(e); merged++; }
  if (part.arm.right) re = t[1];
  else { const e = edgeAt(edgeSamples.right, y); re = e == null ? t[1] : Math.round(e); merged++; }
  if (L && L[1] >= le) le = L[1] + 1;
  else if (!part.arm.left) le = t[0]; // merged, no seam found: the torso owns to the run edge (the union must tile)
  if (R2 && R2[0] <= re) re = R2[0] - 1;
  else if (!part.arm.right) re = t[1];
  mergedCounts[merged]++;
  torso.push({
    yRig: yRig(y),
    halfW: +(((re - le + 1) / 2) * u).toFixed(4),
    centerRig: +((((le + re) / 2) - headCx) * u).toFixed(4),
    merged,
  });
  for (const [name, I] of [['left', L], ['right', R2]]) {
    if (!I) continue;
    armRows[name].push({
      y: yRig(y),
      cx: +((((I[0] + I[1]) / 2) - headCx) * u).toFixed(4),
      rx: +(((I[1] - I[0] + 1) / 2) * u).toFixed(4),
      merged: I[2],
    });
  }
}

// Legs: crotch down to the ANKLE (run width collapse < 5px or the
// two-run structure ending) - foot rows are excluded from thigh/knee/
// calf measurement.
const legs = { weight: [], free: [] };
{
  const first = [...rows[crotch]].sort((a, b) => width(b) - width(a)).slice(0, 2).sort((a, b) => a[0] - b[0]);
  const span = { weight: first[0], free: first[1] };
  for (let y = crotch; y <= feet; y++) {
    let alive = false;
    for (const name of ['weight', 'free']) {
      if (!span[name]) continue;
      let best = null, bo = 0;
      for (const run of rows[y]) {
        const o = Math.min(run[1], span[name][1]) - Math.max(run[0], span[name][0]) + 1;
        if (o > bo) { bo = o; best = run; }
      }
      if (!best || width(best) < 3) { span[name] = null; continue; }
      span[name] = best;
      legs[name].push({ y, w: width(best), cx: mid(best) });
      alive = true;
    }
    if (!alive) break;
  }
}
// Full series snapshot for the ROW TRACE (the trace runs to the real
// bottom of the leg pixels; only the knee/calf STATS want the ankle
// truncation - the foot flare is real geometry the trace must carry).
const fullLegs = { weight: legs.weight.slice(), free: legs.free.slice() };
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
// Leg ROW TRACE: per-row centre + half-width for each leg, crotch to
// ankle, in rig units about the head centreline - the paperdoll legs
// build as lofts through these (geometry + stance in one; the trace
// IS the pose).
const legRows = {};
for (const [name, leg] of [['weight', fullLegs.weight], ['free', fullLegs.free]]) {
  legRows[name] = leg.map((r) => ({
    y: yRig(r.y),
    cx: +((r.cx - headCx) * u).toFixed(4),
    rx: +((r.w / 2) * u).toFixed(4),
  }));
}

const hipXpx = legs.weight.length > 2 && legs.free.length > 2
  ? Math.abs(legs.free[2].cx - legs.weight[2].cx) / 2 : 0;
const kneeIdx = kneeW ? legs.weight.findIndex((l) => l.y === kneeW.y) : Math.floor(legs.weight.length / 2);
const calfW = Math.max(...legs.weight.slice(kneeIdx).map((l) => l.w));

// Wrist: the last split-arm row.
const splitRows = rowParts.filter((p) => p.arm.left || p.arm.right).map((p) => p.y);
const wristRow = splitRows.length ? Math.max(...splitRows) : armpit;

// Arm BARS from the partition's split rows (median width + top/bottom
// centres per side) - the arm-skeleton generator's input.
const barStats = (name) => {
  const b = rowParts.filter((p) => p.arm[name]).map((p) => ({ y: p.y, cx: mid(p.arm[name]), w: width(p.arm[name]) }));
  if (b.length < 4) return null;
  b.sort((p, q) => p.y - q.y);
  const ws = b.map((r) => r.w).sort((p, q) => p - q);
  const top = b[0], bot = b[b.length - 1];
  return {
    yTop: yRig(top.y), yBot: yRig(bot.y),
    cxTop: +(((top.cx - headCx)) * u).toFixed(4),
    cxBot: +(((bot.cx - headCx)) * u).toFixed(4),
    halfW: +((ws[(ws.length / 2) | 0] / 2) * u).toFixed(4),
  };
};
const armBars = { left: barStats('left'), right: barStats('right') };

// Hand tails: the fist can run past wristRow (its last row sits at
// the crotch). Extend each arm through runs contiguous with its last
// interval until none overlap.
for (const name of ['left', 'right']) {
  const list = armRows[name];
  if (!list.length) continue;
  let last = rowParts[rowParts.length - 1];
  let prev = null;
  // recover the last emitted pixel interval for this side
  for (let y = wristRow + 1; y <= feet; y++) {
    const lastRow = list[list.length - 1];
    const lc = (lastRow.cx / u) + headCx, lr = lastRow.rx / u;
    const lo = lc - lr + 0.5, hi = lc + lr - 0.5;
    let hitRun = null;
    for (const run of rows[y]) {
      if (run[1] >= lo - 1 && run[0] <= hi + 1 && width(run) <= lr * 2 + 3) { hitRun = run; break; }
    }
    if (!hitRun) break;
    list.push({
      y: yRig(y),
      cx: +(((hitRun[0] + hitRun[1]) / 2 - headCx) * u).toFixed(4),
      rx: +((width(hitRun) / 2) * u).toFixed(4),
    });
  }
}

// Head/hair/shoulder mass: rows above the armpit are SINGLE-RUN -
// the silhouette there is exact (hair + traps + deltoids fused).
const hairRows = [];
for (let y = top; y < armpit; y++) {
  if (rows[y].length !== 1) continue;
  hairRows.push({ y: yRig(y), halfW: +((width(rows[y][0]) / 2) * u).toFixed(4), cx: +((mid(rows[y][0]) - headCx) * u).toFixed(4) });
}

const out = {
  source: `BODY${race}I${gender}.IMG`, W, H, unit: +u.toFixed(5), headCxCol: +headCx.toFixed(3),
  rows: { top, headBottom, shoulder, armpit, crotch, feet, wristRow },
  rig: {
    height: RIG_H,
    headTopY: yRig(top), headBottomY: yRig(headBottom), headW: +(headW * u).toFixed(4), neckSeparable,
    shoulderY: yRig(shoulder), shoulderHalfSpan: +((shoulderSpan / 2) * u).toFixed(4),
    armpitY: yRig(armpit), pelvisY: yRig(crotch),
    armW: armBars.right ? +(armBars.right.halfW * 2).toFixed(4) : 0, wristY: yRig(wristRow), hipX: +(hipXpx * u).toFixed(4),
    thighW: +(thighW * u).toFixed(4), kneeW: kneeW ? +(kneeW.w * u).toFixed(4) : null,
    kneeY: kneeW ? yRig(kneeW.y) : null, calfW: +(calfW * u).toFixed(4),
    ankleY: legs.weight.length ? yRig(legs.weight[legs.weight.length - 1].y) : null,
  },
  torsoProfile: torso,
  hairRows,
  armBars,
  legRows,
  armRows,
};
console.log(JSON.stringify(out, null, 1));

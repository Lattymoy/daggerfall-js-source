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
// The drawn CROTCH LINE: the artist divides the thighs inside the
// merged pelvis rows. Walk up from the first 2-run row's gap centre
// while the dark line holds contrast (<= 0.92 of local median, one
// gap row tolerated, re-admitted if the line resumes). Band rows
// leave the trunk and join the LEGS as two thigh-top intervals split
// at the seam - the union tiles, the 1:1 pin is safe by construction.
const crotchBand = new Map();
{
  const lum = (i) => { const c = pal.get(i); return 0.299 * c.r + 0.587 * c.g + 0.114 * c.b; };
  const r2 = [...rows[crotch]].filter((r) => width(r) > 4);
  if (r2.length >= 2) {
    let seam = ((r2[0][1] + r2[1][0]) / 2) | 0;
    let misses = 0;
    let pend = [];
    for (let y = crotch - 1; y >= armpit; y--) {
      const cand = [];
      for (let x = seam - 2; x <= seam + 2; x++) if (data[y * W + x]) cand.push({ x, l: lum(data[y * W + x]) });
      if (!cand.length) break;
      let best = null, bl = Infinity;
      for (const { x, l } of cand) { const sc = l + 18 * Math.abs(x - seam); if (sc < bl) { bl = sc; best = { x, l }; } }
      const wide = [];
      for (let x = seam - 8; x <= seam + 8; x++) if (data[y * W + x]) wide.push(lum(data[y * W + x]));
      const med = wide.sort((a, b) => a - b)[(wide.length / 2) | 0];
      seam = best.x;
      if (best.l > med * 0.92) {
        if (++misses > 1) break;
        pend.push([y, best.x]);
        continue;
      }
      misses = 0;
      for (const [py, px2] of pend) crotchBand.set(py, px2);
      pend = [];
      crotchBand.set(y, best.x);
    }
  }
}
const crotchLegs = { weight: [], free: [] }; // image-left = weight leg
const torso = [];
const armRows = { left: [], right: [] };
let mergedCounts = [0, 0, 0];
for (const part of rowParts) {
  const { y, t, arm } = part;
  let le, re, merged = 0;
  if (arm.left) le = t[0];
  else { const e = edgeAt(edgeSamples.left, y); le = e == null ? t[0] : Math.round(e); merged++; }
  if (arm.right) re = t[1];
  else { const e = edgeAt(edgeSamples.right, y); re = e == null ? t[1] : Math.round(e); merged++; }
  mergedCounts[merged]++;
  part.trunkInt = [le, re];
  if (crotchBand.has(y)) { // the trunk ends where the drawn thighs begin - these rows join the LEGS; arms on the same rows emit normally below
    const sc = crotchBand.get(y);
    crotchLegs.weight.push({ y: yRig(y), cx: +((((le + sc) / 2) - headCx) * u).toFixed(4), rx: +(((sc - le + 1) / 2) * u).toFixed(4) });
    crotchLegs.free.push({ y: yRig(y), cx: +((((sc + 1 + re) / 2) - headCx) * u).toFixed(4), rx: +(((re - sc) / 2) * u).toFixed(4) });
  } else torso.push({
    yRig: yRig(y),
    halfW: +(((re - le + 1) / 2) * u).toFixed(4),
    centerRig: +((((le + re) / 2) - headCx) * u).toFixed(4),
    merged,
  });
  // Arms tile against the torso edges: split rows use the arm run's
  // own outer edge; merged rows run from the combined run's outer edge
  // to the shared torso edge.
  // SPLIT rows: the arm run's OWN edges (the gap between arm and
  // torso is real there). MERGED rows: outer edge .. shared torso
  // edge (tiles the torso, no gap exists).
  const sides = [
    arm.left ? ['left', arm.left[0], arm.left[1]] : ['left', t[0], le - 1],
    arm.right ? ['right', arm.right[0], arm.right[1]] : ['right', re + 1, t[1]],
  ];
  for (const [name, a, b] of sides) {
    const lo = Math.min(a, b), hi2 = Math.max(a, b);
    const w = hi2 - lo + 1;
    if (w < 1 || (name === 'left' && lo > le - 1) || (name === 'right' && hi2 < re + 1)) continue;
    armRows[name].push({
      y: yRig(y),
      cx: +((((lo + hi2) / 2) - headCx) * u).toFixed(4),
      rx: +((w / 2) * u).toFixed(4),
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
  legRows[name] = crotchLegs[name].concat(leg.map((r) => ({
    y: yRig(r.y),
    cx: +((r.cx - headCx) * u).toFixed(4),
    rx: +((r.w / 2) * u).toFixed(4),
  })));
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

// TUCKED-HAND OVERLAY (additive only - the proven torso/arm emission
// above is untouched). Walk the interior seam down from the right
// arm's last split row across the merged band: per row, the min-
// luminance column near the previous seam (stay-put prior +18/px,
// +-5 clamp to the split-band exit edge). Emit [seam..runOuter] rows;
// a subset of the sprite run cannot change the silhouette union.
// RIGHT FOREARM + HAND: the reference draws it as the BRIGHT skin
// cluster (the raised form catches light: ramp indices 69-71 against
// the hip's darker 73-78, with idx-35 highlights on the thumb),
// descending from the elbow and resting on the hip. Track the
// contiguous bright run per row: seed = the last split row's arm run;
// window = previous interval +-2; bright = luminance >= local median
// + 8; min width 2; one gap row tolerated. The cluster's own end IS
// the hand's drawn bottom.
const armOverlay = [];
const overlayCols = new Map();
{
  const lum = (i) => { const c = pal.get(i); return 0.299 * c.r + 0.587 * c.g + 0.114 * c.b; };
  let lastSplit = -1;
  rowParts.forEach((part, i) => { if (part.arm.right) lastSplit = i; });
  if (lastSplit >= 0) {
    let lo = rowParts[lastSplit].arm.right[0], hi = rowParts[lastSplit].arm.right[1];
    let misses = 0;
    for (let i = lastSplit + 1; i < rowParts.length; i++) {
      const { y, t, arm } = rowParts[i];
      if (arm.right) break;
      const w0 = Math.max(t[0] + 1, lo - 2), w1 = Math.min(t[1], hi + 2);
      // Brightness reference = the FLANKING hip skin (outside the
      // tracked window), not the window itself - a window centred on
      // the hand is mostly hand and its own median starves the test.
      const flank = [];
      for (let x = t[0] + 1; x < w0; x++) if (data[y * W + x]) flank.push(lum(data[y * W + x]));
      for (let x = w1 + 1; x < t[1]; x++) if (data[y * W + x]) flank.push(lum(data[y * W + x]));
      if (!flank.length) for (let x = t[0] + 1; x < t[1]; x++) if (data[y * W + x]) flank.push(lum(data[y * W + x]));
      if (!flank.length) break;
      const med = flank.sort((p, q) => p - q)[(flank.length / 2) | 0];
      // longest contiguous bright run in the window
      let bLo = -1, bHi = -1, cLo = -1;
      for (let x = w0; x <= w1 + 1; x++) {
        const bright = x <= w1 && data[y * W + x] && lum(data[y * W + x]) >= med + 8;
        if (bright && cLo < 0) cLo = x;
        if (!bright && cLo >= 0) {
          if (x - cLo > bHi - bLo) { bLo = cLo; bHi = x - 1; }
          cLo = -1;
        }
      }
      if (bLo < 0 || bHi - bLo + 1 < 2) {
        if (++misses > 1) break;
        continue;
      }
      misses = 0;
      lo = bLo; hi = bHi;
      overlayCols.set(y, [lo, hi]);
      armOverlay.push({
        y: yRig(y),
        cx: +((((lo + hi) / 2) - headCx) * u).toFixed(4),
        rx: +(((hi - lo + 1) / 2) * u).toFixed(4),
      });
    }
  }
}

// TORSO/GROIN RELIEF: on the lit sprite, INTERIOR bright islands are
// raised form (pec tops, abs, navel highlights). The light comes from
// the upper right, so flank columns carry rim light - only runs whose
// BOTH ends sit >= 2px inside the trunk interval qualify (rim light
// self-excludes); the hand's traced columns are excluded explicitly.
// Each island becomes a thin additive plate: lift ~ brightness over
// the row median. A subset of the run - the silhouette is untouched.
const torsoRelief = [];
const rawIslands = [];
{
  const lum = (i) => { const c = pal.get(i); return 0.299 * c.r + 0.587 * c.g + 0.114 * c.b; };
  for (const part of rowParts) {
    if (!part.trunkInt) continue;
    const { y } = part;
    const [le, re] = part.trunkInt;
    const hand = overlayCols.get(y);
    const ok = (x) => data[y * W + x] && !(hand && x >= hand[0] && x <= hand[1]);
    const ls = [];
    for (let x = le; x <= re; x++) if (ok(x)) ls.push(lum(data[y * W + x]));
    if (ls.length < 6) continue;
    const med = ls.sort((p, q) => p - q)[(ls.length / 2) | 0];
    let cLo = -1;
    for (let x = le; x <= re + 1; x++) {
      const bright = x <= re && ok(x) && lum(data[y * W + x]) >= med + 8;
      if (bright && cLo < 0) cLo = x;
      if (!bright && cLo >= 0) {
        const cHi = x - 1;
        if (cHi - cLo + 1 >= 2 && cLo >= le + 2 && cHi <= re - 2) {
          let m = 0;
          for (let k = cLo; k <= cHi; k++) m += lum(data[y * W + k]);
          m /= cHi - cLo + 1;
          rawIslands.push({ row: y, lo: cLo, hi: cHi, lift: Math.min(0.2, (m - med) / 255) });
        }
        cLo = -1;
      }
    }
  }
}

// UPPER-TORSO RELIEF: the shoulder/trap/collar band (headBottom ..
// armpit-1) rides the hairRows loft with no interior form - same
// interior-island rule over the single run's own edges; the head rows
// stay out (face highlights are not plates).
{
  const lum = (i) => { const c = pal.get(i); return 0.299 * c.r + 0.587 * c.g + 0.114 * c.b; };
  // The FACE box (measured: crown width about the head centreline,
  // the head's own row span) is excluded - headPieces owns the face;
  // hair-strand and trap highlights outside it emit normally.
  const faceRowMax = top + Math.round(0.24 / u);
  const faceL = headCx - (headW / 2 + 1), faceR = headCx + (headW / 2 + 1);
  for (let y = headBottom; y < armpit; y++) {
    if (rows[y].length !== 1) continue;
    const [le, re] = rows[y][0];
    const ls = [];
    for (let x = le; x <= re; x++) if (data[y * W + x]) ls.push(lum(data[y * W + x]));
    if (ls.length < 6) continue;
    const med = ls.sort((p, q) => p - q)[(ls.length / 2) | 0];
    let cLo = -1;
    for (let x = le; x <= re + 1; x++) {
      const bright = x <= re && data[y * W + x] && lum(data[y * W + x]) >= med + 8;
      if (bright && cLo < 0) cLo = x;
      if (!bright && cLo >= 0) {
        const cHi = x - 1;
        const onFace = y <= faceRowMax && cHi >= faceL && cLo <= faceR;
        if (!onFace && cHi - cLo + 1 >= 2 && cLo >= le + 2 && cHi <= re - 2) {
          let m = 0;
          for (let k = cLo; k <= cHi; k++) m += lum(data[y * W + k]);
          m /= cHi - cLo + 1;
          rawIslands.push({ row: y, lo: cLo, hi: cHi, lift: Math.min(0.2, (m - med) / 255) });
        }
        cLo = -1;
      }
    }
  }
}

// STRANDS: chain islands across rows by pixel-interval overlap - the
// drawn forms (a pec, a strand of hair) are vertical shapes, not
// per-row speckle. Within a strand the loft bridges continuously and
// the lift takes a 3-row average; single-row strands are dropped
// (denoise). Strand starts carry brk.
{
  rawIslands.sort((a, b) => a.row - b.row);
  const strands = [];
  const open = []; // { rows: [...], lastRow, lo, hi }
  for (const isl of rawIslands) {
    let best = null, bo = 0;
    for (const st of open) {
      if (st.lastRow !== isl.row - 1 || st.claimed === isl.row) continue;
      const o = Math.min(st.hi, isl.hi) - Math.max(st.lo, isl.lo) + 1;
      if (o > bo) { bo = o; best = st; }
    }
    if (best) {
      best.rows.push(isl);
      best.lastRow = isl.row; best.lo = isl.lo; best.hi = isl.hi; best.claimed = isl.row;
    } else {
      const st = { rows: [isl], lastRow: isl.row, lo: isl.lo, hi: isl.hi, claimed: isl.row };
      open.push(st);
      strands.push(st);
    }
  }
  for (const st of strands) {
    if (st.rows.length < 2) continue; // speckle
    const L = st.rows.map((r) => r.lift);
    for (let i = 0; i < st.rows.length; i++) {
      const isl = st.rows[i];
      const sm = (L[Math.max(0, i - 1)] + L[i] + L[Math.min(L.length - 1, i + 1)]) / 3;
      torsoRelief.push({
        y: yRig(isl.row),
        cx: +((((isl.lo + isl.hi) / 2) - headCx) * u).toFixed(4),
        rx: +(((isl.hi - isl.lo + 1) / 2) * u).toFixed(4),
        lift: +sm.toFixed(4),
        nb: i === 0,
      });
    }
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
  armOverlay,
  torsoRelief,
};
console.log(JSON.stringify(out, null, 1));

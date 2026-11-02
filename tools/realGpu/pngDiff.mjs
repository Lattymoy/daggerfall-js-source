// REAL-GPU PROBE's reader: how much two same-size screenshots differ (SHOT=1's per-phase pictures), and where - an A/B's
// check that a change moved no pixel but what moves between any two runs (the wind, the townsfolk, a swaying flat).
// Run:  node tools/realGpu/pngDiff.mjs a.png b.png [tolerance=8]
import { readFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { isMain } from '../lib/isMain.mjs';

/** The largest channel difference of each pixel of two same-size RGBA images. */
export function channelDiffs(a, b) {
  if (a.width !== b.width || a.height !== b.height)
    throw new Error(`pngDiff: ${a.width}x${a.height} against ${b.width}x${b.height}`);
  const diffs = new Uint8Array(a.width * a.height);
  for (let p = 0, i = 0; p < diffs.length; p++, i += 4) {
    diffs[p] = Math.max(
      Math.abs(a.data[i] - b.data[i]),
      Math.abs(a.data[i + 1] - b.data[i + 1]),
      Math.abs(a.data[i + 2] - b.data[i + 2]),
    );
  }
  return diffs;
}

/** The share of pixels differing past `tolerance` and past 64, the mean channel difference, and the share past
 *  `tolerance` in each eighth of the height, top first. */
export function pngDiff(a, b, tolerance = 8) {
  const diffs = channelDiffs(a, b);
  const bands = new Array(8).fill(0);
  let over = 0;
  let big = 0;
  let sum = 0;
  for (let p = 0; p < diffs.length; p++) {
    sum += diffs[p];
    if (diffs[p] > 64) big++;
    if (diffs[p] <= tolerance) continue;
    over++;
    bands[Math.min(7, Math.floor(Math.floor(p / a.width) / (a.height / 8)))]++;
  }
  const pct = (n, of) => +((100 * n) / of).toFixed(3);
  return {
    width: a.width,
    height: a.height,
    overPct: pct(over, diffs.length),
    bigPct: pct(big, diffs.length),
    meanDiff: +(sum / diffs.length).toFixed(2),
    bandsPct: bands.map((n) => pct(n, diffs.length / 8)),
  };
}

if (isMain(import.meta.url)) {
  const [a, b, tolerance = 8] = process.argv.slice(2);
  if (!a || !b) throw new Error('pngDiff: name two PNGs');
  const r = pngDiff(PNG.sync.read(readFileSync(a)), PNG.sync.read(readFileSync(b)), Number(tolerance));
  console.log(
    `${r.width}x${r.height}: ${r.overPct}% of pixels differ by more than ${tolerance}, ${r.bigPct}% by more than 64, mean channel diff ${r.meanDiff}; by eighth of the height (top first): ${r.bandsPct.map((v) => `${v}%`).join(' ')}`,
  );
}

// REAL-GPU PROBE's reader: a picture of where two screenshots differ - the differing pixels red over a darkened copy of
// the first, so a reader can tell the wind and the townsfolk from a real change.
// Run:  node tools/realGpu/pngMask.mjs a.png b.png out.png [tolerance=8]
import { readFileSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { isMain } from '../lib/isMain.mjs';
import { channelDiffs } from './pngDiff.mjs';

/** The mask image: a pixel differing past `tolerance` red, every other pixel the first picture's at a quarter. */
export function pngMask(a, b, tolerance = 8) {
  const diffs = channelDiffs(a, b);
  const mask = new PNG({ width: a.width, height: a.height });
  for (let p = 0, i = 0; p < diffs.length; p++, i += 4) {
    const differs = diffs[p] > tolerance;
    mask.data[i] = differs ? 255 : a.data[i] >> 2;
    mask.data[i + 1] = differs ? 40 : a.data[i + 1] >> 2;
    mask.data[i + 2] = differs ? 40 : a.data[i + 2] >> 2;
    mask.data[i + 3] = 255;
  }
  return mask;
}

if (isMain(import.meta.url)) {
  const [a, b, out, tolerance = 8] = process.argv.slice(2);
  if (!a || !b || !out) throw new Error('pngMask: name two PNGs and the mask to write');
  writeFileSync(
    out,
    PNG.sync.write(pngMask(PNG.sync.read(readFileSync(a)), PNG.sync.read(readFileSync(b)), Number(tolerance))),
  );
}

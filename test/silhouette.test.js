import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { buildBody, BARE_PLUGS } from '../src/characters/rewrite/body.js';
import { silhouetteIoU } from '../src/characters/silhouetteIoU.js';
import { PAPERDOLL_POSE } from '../src/characters/paperdollPose.js';
import { DAGGER_SPEC } from '../src/characters/daggerBodySpec.js';
import { ImgFile } from '../src/formats/imgFile.js';
import { DFPalette } from '../src/formats/dfPalette.js';

const ARENA2 = process.env.ARENA2_PATH;
const skipReal = !ARENA2 || !existsSync(ARENA2)
  ? 'ARENA2_PATH not set or missing - real-data validation skipped'
  : false;

// THE RESCULPT ACCEPTANCE GATE (C6k): the rebuilt model's front
// silhouette against the classic sprite mask, as a NUMBER. Alignment
// is centroid-x + feet-anchored y so the metric measures SHAPE, not
// registration. Floor = first honest measurement minus margin; it
// only ratchets UP.
test('silhouette: front IoU vs the classic body mask', { skip: skipReal }, () => {
  const pal = new DFPalette();
  pal.load(readFileSync(join(ARENA2, 'ART_PAL.COL')), 'ART_PAL.COL');
  const img = new ImgFile();
  img.load(readFileSync(join(ARENA2, 'BODY00I0.IMG')), 'BODY00I0.IMG', pal);
  const bmp = img.getDFBitmap();
  const { width: W, height: H, data } = bmp;

  const faces = buildBody(
    { loco: 'stand', hold: 'idle', phase: 0, weapon: 'none', paperdoll: PAPERDOLL_POSE },
    BARE_PLUGS, DAGGER_SPEC);
  const { iou, inter, union, modelArea } = silhouetteIoU(faces, bmp);
  console.log(`silhouette IoU = ${iou.toFixed(4)} (intersection ${inter}, union ${union})`);
  // Floor = fit 0.8673 minus margin; ratchets UP only.
  assert.ok(iou >= 0.84, `IoU ${iou.toFixed(4)} below the floor`);
  // Inside the lines (Mac): model spill beyond the sprite outline is
  // capped - excess pixels vs sprite area.
  let spriteN = 0;
  for (const v of data) if (v) spriteN++;
  const excess = (modelArea - inter) / spriteN;
  assert.ok(excess <= 0.12, `excess ${(excess * 100).toFixed(1)}% of sprite area above the 12% ceiling`);
});

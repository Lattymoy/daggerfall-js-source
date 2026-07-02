import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { WINDOW_STYLES, windowEmissionRGB } from '../src/render/windowEmission.js';
import { isExteriorWindow } from '../src/world/climateSwaps.js';
import { TextureFile } from '../src/formats/textureFile.js';
import { DFPalette } from '../src/formats/dfPalette.js';

const ARENA2 = process.env.ARENA2_PATH;
const skipReal = !ARENA2 || !existsSync(ARENA2)
  ? 'ARENA2_PATH not set or missing - real-data validation skipped'
  : false;

test('window: MaterialReader style constants verbatim', () => {
  // Color32 and intensity exactly as DFU MaterialReader defaults.
  assert.deepEqual(WINDOW_STYLES.day, { color: [89, 154, 178], intensity: 0.5 });
  assert.deepEqual(WINDOW_STYLES.night, { color: [255, 182, 56], intensity: 0.8 });
  assert.deepEqual(WINDOW_STYLES.fog, { color: [117, 117, 117], intensity: 0.5 });
  assert.deepEqual(WINDOW_STYLES.custom, { color: [200, 0, 200], intensity: 1.0 });

  // Applied emission = color/255 * intensity (ChangeWindowEmissionColor).
  const night = windowEmissionRGB('night');
  assert.ok(Math.abs(night[0] - 0.8) < 1e-6);
  assert.ok(Math.abs(night[1] - (182 / 255) * 0.8) < 1e-6);
  assert.ok(Math.abs(night[2] - (56 / 255) * 0.8) < 1e-6);

  // Unknown styles fall back to day, DFU's GetMaterial default.
  assert.deepEqual(Array.from(windowEmissionRGB('nope')), Array.from(windowEmissionRGB('day')));
});

test('window: real emission masks pin glass texel counts', { skip: skipReal }, () => {
  const pal = new DFPalette();
  pal.load(new Uint8Array(readFileSync(join(ARENA2, 'ART_PAL.COL'))), 'ART_PAL.COL');
  const load = (archive) => {
    const name = `TEXTURE.${String(archive).padStart(3, '0')}`;
    const t = new TextureFile();
    t.load(new Uint8Array(readFileSync(join(ARENA2, name))), name, pal);
    return t;
  };

  const countMask = (t, record) => {
    const mask = t.getWindowColors32(t.getDFBitmap(record, 0));
    let n = 0;
    for (let i = 0; i < mask.colors.length; i += 4) if (mask.colors[i + 3] === 255) n++;
    return n;
  };

  // Temperate window records carry palette-index-0xff glass, pinned.
  assert.equal(isExteriorWindow(312, 3), true);
  assert.equal(countMask(load(312), 3), 638);
  assert.equal(isExteriorWindow(358, 3), true);
  assert.equal(countMask(load(358), 3), 1440);
  // Some window-table records genuinely have no glass texels in the data.
  assert.equal(isExteriorWindow(309, 3), true);
  assert.equal(countMask(load(309), 3), 0);
  // Non-window record produces an empty mask by table, not by accident.
  assert.equal(isExteriorWindow(302, 1), false);
});

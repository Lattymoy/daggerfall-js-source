// AUDIT 24 (the full-codebase parity sweep), the two format findings
// whose harnesses live nowhere else.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseBiog, DEFAULT_BACKSTORIES_START } from '../src/formats/biogFile.js';
import { CifRciFile } from '../src/formats/cifRciFile.js';

test('audit24 formats: the BIOG # id parses like int.TryParse, all-or-nothing', () => {
  // BiogFile.cs:74 - `if (!int.TryParse(value, out backstoryId))` falls
  // back to defaultBackstoriesStart + classIndex. TryParse rejects the
  // WHOLE string unless it parses cleanly; parseInt takes the leading
  // digits and answers a number for every one of these.
  const biog = (first) => parseBiog(`${first}\nQuestion?\nA\n`, 7);
  assert.equal(biog('#4116').backstoryId, 4116, 'a clean id is taken');
  assert.equal(biog('# 4116 ').backstoryId, 4116, 'NumberStyles.Integer allows surrounding white');
  assert.equal(biog('#-3').backstoryId, -3, 'and a sign');
  const fallback = DEFAULT_BACKSTORIES_START + 7;
  for (const bad of ['#4116abc', '#0x10', '#12.5', '#', '#abc', '#4 116', '#99999999999']) {
    assert.equal(biog(bad).backstoryId, fallback, `${bad} falls back`);
  }
});

test('audit24 formats: a 1-frame weapon-anim record answers (0,0), not undefined', () => {
  // ReadWeaponCif sets only Header.FrameCount over a default
  // ImgFileHeader STRUCT (CifRciFile.cs:456), so Width/Height/XOffset/
  // YOffset are 0 - and GetSize/GetOffset's frameCount <= 1 arms
  // (:223-226, :240-243) hand those zeros back. The port's record
  // carried no such keys, so the arms answered undefined and any
  // arithmetic on them NaN.
  const src = readFileSync(new URL('../src/formats/cifRciFile.js', import.meta.url), 'utf8');
  assert.match(src, /header: \{ frameCount, width: 0, height: 0, xOffset: 0, yOffset: 0 \}/,
    'the mint carries the struct defaults');
  const f = Object.create(CifRciFile.prototype);
  f._records = [{ header: { frameCount: 1, width: 0, height: 0, xOffset: 0, yOffset: 0 } }];
  assert.deepEqual(f.getSize(0), { width: 0, height: 0 });
  assert.deepEqual(f.getOffset(0), { x: 0, y: 0 });
  assert.equal(Number.isNaN(f.getSize(0).width + 1), false, 'and the arithmetic is a number');
});

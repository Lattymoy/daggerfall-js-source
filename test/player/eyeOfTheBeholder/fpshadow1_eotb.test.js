// FP-SHADOW1 (2026-10-10, Mac: "when i look up i see my eye of the beholder skin"): Eye Of The Beholder's first-person
// billboard honours its visibility - 2 drawn, 1 ("Shadows Only", the default) to the shadow maps alone, 0 nothing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../../../src/player/eyeOfTheBeholder/eotbBody.js', import.meta.url), 'utf8');

test('FP-SHADOW1: in first person only "visible" draws the body; "Shadows Only" records it for the shadows alone; third person draws as before (mutant: draw always)', () => {
  assert.match(src, /if \(!FP \|\| cfg\.visibility === 2\) renderer\.drawBillboards\(\[batch\], camRight, bbUp\);/, 'drawn in third person, or in first person when the setting says visible');
  assert.match(src, /else if \(cfg\.visibility === 1\) renderer\.recordShadowBillboards\?\.\(\[batch\], camRight, bbUp\);/, 'Shadows Only: the shadow record and nothing on screen');
  assert.equal((src.match(/renderer\.drawBillboards\(\[batch\]/g) ?? []).length, 1, 'no second, ungated draw of the body');
  assert.match(src, /visibility: s\['Graphics\.FirstPersonBillboard'\] \?\? 1,/, 'Shadows Only is still the default');
});

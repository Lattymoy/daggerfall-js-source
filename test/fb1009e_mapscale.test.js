// FIELD BUGS 2026-10-09e - MAP-SCALE, the Discord's "Desktop client in-game map icons and text too small on high
// resolutions": "playing this game on a monitor greater than 1080P will result in text and icons being way to small for
// the eye to comfortably see. Is there any way to fix this other than changing my desktop resolution?" - "For the record
// I'm using a 2k monitor".
//
// The held map inked its names and glyphs in fixed paper pixels and its chrome in fixed CSS pixels, on a paper fitted
// to the screen: at 1440p the paper grew by a third and nothing on it did. THE MAP'S SCALE (ui/mapScale.js) inks the
// sheet on the fitted paper over the scale, at full device resolution, and zooms the chrome by the same - Auto the
// screen's height over 1080, or the player's own choice on the Interface tab's Maps row. The window's half is pinned in
// test/heldmap.test.js (MAP-SCALE). `01-Overview/Field-Bugs-2026-10-09e.md`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  mapUiScale, mapScaleLabel, nextMapScale, MAP_SCALE_BASE_H, MAP_SCALE_MIN, MAP_SCALE_MAX, MAP_SCALE_CHOICES,
} from '../src/ui/mapScale.js';
import { PREF_DEFAULTS } from '../src/systems/uiPrefs.js';
import { CATEGORIES } from '../src/ui/settingsMap.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('MAP-SCALE law: Auto is the screen\'s height over 1080 to the twentieth - 1 at 1080p and under (a phone, a laptop as they were), 1.35 at the report\'s 1440p, 2 at 4K and past it; a choice of the player\'s own stands, held to 0.75-2; anything else is Auto', () => {
  assert.equal(MAP_SCALE_BASE_H, 1080);
  assert.deepEqual([MAP_SCALE_MIN, MAP_SCALE_MAX], [0.75, 2]);
  assert.deepEqual([360, 720, 900, 1080].map((h) => mapUiScale(h)), [1, 1, 1, 1]);
  assert.equal(mapUiScale(1440), 1.35, '2560 x 1440');
  assert.equal(mapUiScale(1200), 1.1, '1920 x 1200');
  assert.deepEqual([mapUiScale(2160), mapUiScale(2880), mapUiScale(4320)], [2, 2, 2]);
  assert.deepEqual([undefined, null, 'auto', 'big', 0, -1, NaN].map((p) => mapUiScale(1440, p)), [1.35, 1.35, 1.35, 1.35, 1.35, 1.35, 1.35]);
  assert.deepEqual([0.5, 0.75, 1, 1.25, 2, 3, '1.5'].map((p) => mapUiScale(900, p)), [0.75, 0.75, 1, 1.25, 2, 2, 1.5]);
  assert.equal(mapUiScale(undefined), 1, 'no screen: as it was');
  assert.equal(PREF_DEFAULTS.mapScale, 'auto', 'Auto until the player chooses');
});

test('MAP-SCALE row: Auto then the fixed scales, a range held at its ends; the word says what Auto is on this screen', () => {
  assert.deepEqual([...MAP_SCALE_CHOICES], ['auto', 0.75, 1, 1.25, 1.5, 1.75, 2]);
  assert.equal(nextMapScale('auto', 1), 0.75);
  assert.equal(nextMapScale(1.25, 1), 1.5);
  assert.equal(nextMapScale(1.25, -1), 1);
  assert.equal(nextMapScale('auto', -1), 'auto', 'held at the start');
  assert.equal(nextMapScale(2, 1), 2, 'held at the end');
  assert.equal(nextMapScale(1.3, 1), 0.75, 'a stray value walks from Auto');
  assert.equal(mapScaleLabel('auto', 1440), 'Auto (1.35×)');
  assert.equal(mapScaleLabel('auto', 900), 'Auto (1.00×)');
  assert.equal(mapScaleLabel(1.5, 1440), '1.50×');
  const menu = read('src/ui/enhancedMenu.js');
  assert.match(menu, /row\.dataset\.opt = 'mapScale'; row\.dataset\.pref = 'mapScale';/);
  assert.match(menu, /const next = nextMapScale\(getPref\('mapScale'\), dir\);\s*\n\s*setPref\('mapScale', next\);/);
  assert.match(menu, /out\.push\(hudScaleRow\(\)\);\s*\n\s*out\.push\(mapScaleRow\(\)\);/, 'on the Interface card, under the HUD\'s');
  const maps = CATEGORIES.find((t) => t.id === 'interface').sections.find((s) => s.id === 'maps');
  assert.equal(maps.items[0], 'port:mapScale', 'first under Maps');
});

test('MAP-SCALE by source: the window reads the scale at every layout (a choice takes the next frame), keys the layout on it, inks on the paper over it and the pointer and the card come back over it; every viewport-relative bound in the zoomed chrome is divided by it', () => {
  const src = read('src/ui/heldMap.js');
  assert.match(src, /const k = mapUiScale\(vh, getPref\('mapScale'\)\);\s*\n\s*root\.style\.setProperty\?\.\('--hm-ui', String\(k\)\);\s*\n\s*const key = `\$\{vw\}x\$\{vh\}@\$\{dpr\}\|\$\{inset\}\|\$\{this\._lane\}\|\$\{k\}`;/);
  assert.match(src, /this\._paper = \{ w: pw \/ k, h: ph \/ k, dpr: dpr \* k, k \};/);
  assert.match(src, /c\.ink\.width = Math\.max\(1, Math\.round\(pw \* dpr\)\);/, 'the backing is the fitted sheet\'s device pixels');
  // every rule whose selector names a held-map class (the innermost rules, so a media block's own are read), each
  // viewport-relative length in its body
  let rules = 0;
  for (const file of ['src/ui/enhancedStyle.js', 'src/ui/enhancedPlusStyle.js']) {
    for (const [, sel, body] of read(file).matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      if (!/\.hm[a-z]/.test(sel) || /\.hm(stage|ink|sprite|hands)\b/.test(sel)) continue;
      for (const m of body.matchAll(/[\d.]+v[wh]\b[^;]*/g)) {
        rules++;
        assert.match(m.input.slice(Math.max(0, m.index - 6), m.index + m[0].length), /calc\([\d.]+v[wh] \/ var\(--hm-ui, 1\)/, `${file}: ${sel.trim()} - ${m[0]}`);
      }
    }
  }
  assert.ok(rules >= 10, `${rules} bounds read`);
});

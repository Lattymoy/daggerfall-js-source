import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { bladeInset } from '../src/ui/enhancedHud.js';
import { PREF_DEFAULTS } from '../src/systems/uiPrefs.js';

// ═══ FOEBAR1 (2026-09-17): THE BLADE FACE OF THE TARGET BAR ═════════
//
// Mac, from a friend's two pictures: "implement these as alternate
// versions of the enemy health bar we have implemented". A twin-bladed
// shape with a skull hub - the dark one the empty bar, the red one the
// fill - drawn in place of the plain track under the compass when
// prefs.foeBarStyle is 'blade', the fill clipped in from both tips
// toward the hub by the health lost. The pictures are one crop of both
// 1000x1000 originals (their union alpha box, 981x130), so they register
// pixel for pixel. tools/foebar1Probe.mjs draws it in Chromium.

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');
const pngSize = (p) => { const b = readFileSync(join(root, p)); return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) }; };

test('FOEBAR1: the inset law - half of what is lost comes off each tip, full is 0, empty is 50, and the fraction is clamped', () => {
  assert.equal(bladeInset(100), 0);
  assert.equal(bladeInset(50), 25);
  assert.equal(bladeInset(25), 37.5);
  assert.equal(bladeInset(0), 50, 'the two clips meet at the hub');
  assert.equal(bladeInset(140), 0, 'over full is full');
  assert.equal(bladeInset(-30), 50, 'under empty is empty');
});

test('FOEBAR1: the two pictures are one crop, the pref defaults to the plain bar, and the HUD, the sheet and the menu carry the face', () => {
  const empty = pngSize('src/ui/assets/foe-blade-empty.png'), full = pngSize('src/ui/assets/foe-blade-full.png');
  assert.deepEqual(empty, { w: 981, h: 130 }, 'the empty picture is the union alpha crop');
  assert.deepEqual(full, empty, 'and the fill is the same crop, so the two register');
  assert.equal(PREF_DEFAULTS.foeBarStyle, 'bar', 'the plain bar is what a player has until they choose');
  const hud = read('src/ui/enhancedHud.js');
  assert.match(hud, /const foeBlade = el\('div', 'hud-foeblade'\);\s*\n\s*const foeBladeEmpty = el\('i', 'hud-bladeempty'\);\s*\n\s*const foeBladeFull = el\('i', 'hud-bladefull'\);\s*\n\s*foeBladeEmpty\.style\.backgroundImage = `url\("\$\{BLADE_EMPTY_URL\}"\)`;\s*\n\s*foeBladeFull\.style\.backgroundImage = `url\("\$\{BLADE_FULL_URL\}"\)`;\s*\n\s*foeBlade\.append\(foeBladeEmpty, foeBladeFull\);\s*\n\s*foe\.append\(foeName, foeTrack, foeBlade\);/, 'two pictures under the one track, built once, their URLs the module\'s');
  assert.match(hud, /const BLADE_EMPTY_URL = new URL\('\.\/assets\/foe-blade-empty\.png', import\.meta\.url\)\.href;\s*\n\s*const BLADE_FULL_URL = new URL\('\.\/assets\/foe-blade-full\.png', import\.meta\.url\)\.href;/, 'module-relative, the workers\' pattern - vite bundles it with the page\'s base; public/ is the root alone and the game runs at /play/');
  assert.match(hud, /const blade = getPref\('foeBarStyle'\) === 'blade';\s*\n\s*if \(last\.foeStyle !== blade\) \{ last\.foeStyle = blade; parts\.foe\.classList\.toggle\('blade', blade\); \}\s*\n\s*if \(blade\) clipInset\(parts\.foeBladeFull, 'foeBlade', bladeInset\(foePct\)\);/, 'the pref picks the face each draw, written only when it changes; the clip follows the same fraction the plain fill takes');
  assert.match(hud, /width\(parts\.foeFill, 'foeFill', foePct\);/, 'the plain fill is untouched');
  assert.match(hud, /const v = `inset\(0 \$\{side\.toFixed\(2\)\}% 0 \$\{side\.toFixed\(2\)\}%\)`;\s*\n\s*if \(last\[key\] === v\) return;\s*\n\s*last\[key\] = v;\s*\n\s*node\.style\.clipPath = v;/, 'clipped in from both sides, written only when it changes');
  const css = read('src/ui/enhancedStyle.js');
  assert.match(css, /\.hud-foe\.blade \.hud-foetrack \{ display: none; \}/, 'the plain track hides under the blade');
  assert.match(css, /\.hud-foeblade \{ display: none; position: relative; width: min\(360px, 54vw\); aspect-ratio: 981 \/ 130; \}/, 'the blade keeps the crop\'s aspect');
  assert.match(css, /\.hud-foe\.blade \.hud-foeblade \{ display: block; \}/);
  assert.match(css, /\.hud-bladeempty, \.hud-bladefull \{ position: absolute; inset: 0; display: block;\s*\n\s*background-position: center; background-size: 100% 100%; background-repeat: no-repeat; \}/, 'the sheet sizes the pictures and names none - the URLs are the module\'s');
  assert.doesNotMatch(css, /foe-blade-(?:empty|full)\.png/, 'no picture URL in the sheet');
  assert.match(css, /\.hud-bladeempty \{ opacity: 0\.72; \}/, 'FOEBAR1b: the drained bar is slightly see-through, the fill is not');
  assert.doesNotMatch(css, /\.hud-bladefull \{[^}]*opacity/, 'the fill stays solid red');
  const menu = read('src/ui/enhancedMenu.js');
  assert.match(menu, /const blade = getPref\('foeBarStyle'\) === 'blade';[\s\S]{0,900}?setPref\('foeBarStyle', blade \? 'bar' : 'blade'\); render\(\);/, 'the Interface card offers the two faces as a two-way row');
  assert.match(menu, /el\('button', 'act rowact', blade \? 'Blade' : 'Bar'\)/, 'whose button names the OTHER option');
});

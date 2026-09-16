// HC1 - THE HORSE AND CART, AUDITED FOR PLAY (2026-09-14, Mac: "audit
// the horse and cart ensuring it works properly ingame and the sprites
// actually show").
//
// They did not show, on the deployed site, ever - and for three
// separate reasons at three separate seams, each of which passed every
// pin around it:
//   1. THE DIET. TR2's riding sprites are MRED00I0.CFA and MRED01I0.CFA,
//      and dataSource.KEEP never kept a .CFA: the browser's ARENA2 store
//      never held them, the network arm 404s in production, and
//      loadRidingArt failed into a console warning. AUDIT 18 F2's pin
//      re-derives the fetch list from every name src/ carries - by an
//      extension list that did not include CFA. The dev server, which
//      serves the folder whole, hid it (the F2 shape exactly).
//   2. THE ONE PLACE. U53 made setTransportModeHere the one place the
//      mode changes; TR3 loaded the art on the T-key pick alone. Three
//      other paths set the mode - a loaded save on horseback, the Test
//      Room's ride out, the ship's landing - nulled the art, and loaded
//      nothing: the speed, the bob and the hoof loop, and no horse.
//   3. THE MANIFEST. A stored set that predates the fix has no CFA and
//      no reason to re-ingest; the diet's own rule is to bump MANIFEST_V
//      so stale sets auto-wipe to the picker.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { KEEP } from '../src/scenes/dataSource.js';
import { HORSE_TEXTURE, CART_TEXTURE, ridingTextureName } from '../src/systems/riding.js';
import { TRANSPORT_MODES } from '../src/systems/transport.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

test('HC1: both riding sprites survive BOTH diets - the horse and cart can be seen on a phone too', () => {
  for (const name of [HORSE_TEXTURE, CART_TEXTURE, ridingTextureName(TRANSPORT_MODES.Horse), ridingTextureName(TRANSPORT_MODES.Cart)]) {
    assert.match(name, /\.CFA$/);
    assert.ok(KEEP(name, false), `desktop diet keeps ${name}`);
    assert.ok(KEEP(name, true), `lean diet keeps ${name}`);
  }
  assert.ok(KEEP('X.CFA', true), 'the kind rides wholesale, as GFX and BSS do - a future CFA reader is covered');
  // the manifest version moved, so a stored set from before the fix re-ingests
  assert.match(read('src/scenes/dataSource.js'), /const MANIFEST_V = 10;\s*\/\/ v10 = the sets missing the \.CFA riding sprites \(HC1/);
  // and the F2 pin can SEE the kind now, so the next dropped kind fails there rather than here
  assert.match(read('test/audit18.test.js'), /\|GFX\|VID\|DAT\|CEL\|CFA\|BSS\)\)'\/g;/, 'the name regex lists CFA (and BSS, which U45 kept but the regex never scanned)');
});

test('HC1: the art loads in the ONE place the mode changes, so every path to a saddle draws the mount', () => {
  // MAC-K3 moved that one place out of `scenes/world.js` and into
  // `player/mountRig.js`, because `scenes/exterior.js` had no transport
  // surface at all and copying one in would have been two laws.
  const rig = read('src/player/mountRig.js');
  const at = rig.indexOf('function setMode(mode) {');
  const fn = rig.slice(at, rig.indexOf('\n  }', at));
  assert.match(fn, /art = null;/, 'the old mount\'s art is dropped on every change (U53)');
  assert.match(fn, /if \(isRiding\(mode\)\) \{\s*loadRidingArt\(fetchBytes, palette, renderer, mode\)/, 'and the new mount\'s loads right there');
  assert.match(fn, /\.then\(\(a\) => \{ if \(player\.transportMode === mode\) art = a; \}\)/, 'a dismount or a swap mid-load keeps what the mode says');
  // the T-key pick no longer carries its own copy of the load
  const pick = rig.slice(rig.indexOf('onMode: (mode) => {'), rig.indexOf('    },', rig.indexOf('onMode: (mode) => {')));
  assert.ok(!/loadRidingArt/.test(pick), 'the pick sets the mode and nothing else');
  // ONE LOAD SITE IN THE PORT, derived - not one per host
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  const sites = [];
  const walk = (dir) => {
    for (const e of readdirSync(join(root, dir), { withFileTypes: true })) {
      if (e.isDirectory()) walk(`${dir}/${e.name}`);
      else if (e.name.endsWith('.js')) {
        const n = (readFileSync(join(root, `${dir}/${e.name}`), 'utf8').match(/loadRidingArt\(/g) ?? []).length;
        if (n) sites.push([`${dir}/${e.name}`, n]);
      }
    }
  };
  walk('src');
  assert.deepEqual(sites.filter(([f]) => !f.endsWith('riding.js')), [['src/player/mountRig.js', 1]], 'ONE load site');

  // the three paths that used to leave a rider with no horse all go
  // through the one place, still
  const w = read('src/scenes/world.js');
  assert.match(w, /const setTransportModeHere = \(mode\) => mountRig\?\.setMode\(mode\);/);
  assert.match(w, /if \(pose\.transport != null\) setTransportModeHere\(pose\.transport\);/, 'a loaded save on horseback');
  assert.match(w, /setTransportModeHere\(TRANSPORT_MODES\.Horse\);\s*\n\s*console\.log\(`\[testroom\] ride out/, 'the Test Room\'s ride out');
  assert.match(w, /playerEntity\.boardShipPosition = t\.boardShipPosition;\s*\n\s*setTransportModeHere\(t\.mode\);/, 'the ship\'s landing');
});

test('HC1/MAC-K3: the draw - under the HUD, on EVERY outdoor host, hidden while paused, lifted over the large HUD', () => {
  const rig = read('src/player/mountRig.js');
  assert.match(rig, /if \(art && isRiding\(player\.transportMode\) && !ridePaused\) \{[\s\S]{0,600}?renderer\.drawScreenQuad\(art\.frames\[r\.frame\], rect\);/, 'drawn from the animator\'s frame');
  assert.match(rig, /const rect = ridingRect\(canvasOf\(\), art, horseOffsetHeight\(\)\);/, 'at DFU\'s rect, over the large HUD when it asks');

  // THE LINE THIS PIN USED TO END ON, and why MAC-K3 exists:
  //
  //   assert.ok(!/loadRidingArt|RidingAnimator/.test(read('src/scenes/exterior.js')),
  //     'the fixed-city dev host draws no mount - it is not a door a
  //      player rides through');
  //
  // It is a door a player rides through. Mac, 2026-09-15: "T to mount
  // not working outside interiors." The premise was true once and had
  // gone stale, and a pin standing on a stale premise is worse than no
  // pin: it made the missing host look deliberate.
  //
  // So: every host that loads the HUD art and owns a motor outdoors
  // draws its mount, and the two indoor hosts refuse the key.
  for (const h of ['exterior', 'world']) {
    const src = read(`src/scenes/${h}.js`);
    assert.match(src, /loadHud\(\{ fetchBytes, ImgFile, palette, renderer \}\)\.then\(\(a\) => \{ hudArt = a; \}\)/,
      `${h}.js: the HUD art loads on both skins, so the 'if (hudArt)' gate is "art loaded", not "classic skin"`);
    assert.match(src, /createMountRig\(\{/, `${h}.js is outdoors and must have a mount`);
    assert.match(src, /mountRig[?.]*\.frame\(dt\)/, `${h}.js must run its mount's frame`);
  }
  for (const f of ['src/scenes/worldModes.js', 'src/scenes/dungeonContext.js']) {
    assert.match(read(f), /CANNOT_CHANGE_INDOORS/, `${f}: the T key refuses indoors`);
    assert.ok(!read(f).includes('createMountRig('), `${f}: and builds no mount, because you cannot ride indoors`);
  }
});

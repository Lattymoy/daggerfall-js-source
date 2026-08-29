// MWFIX - THE ATTACH FLOW'S THREE DEFECTS, each pinned at the shape
// that let it happen. Reported from retail: "in the enhanced settings
// you're unable to upload by pressing the button", and "instead the
// upload appears for a split second when starting a new game and then
// appears after creating your character, and after uploading does not
// work at all". Three separate faults, one report.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { ASSET_PICKER_Z } from '../src/scenes/dataSource.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const rd = (p) => readFileSync(join(ROOT, p), 'utf8');

/** Every z-index literal in src/, with where it came from. */
function zIndexLiterals() {
  const out = [];
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, e.name);
      if (e.isDirectory()) { walk(full); continue; }
      if (!e.name.endsWith('.js')) continue;
      const src = readFileSync(full, 'utf8');
      for (const m of src.matchAll(/z-index:\s*(\d+)/g)) {
        out.push({ file: full.slice(ROOT.length + 1), z: Number(m[1]) });
      }
    }
  };
  walk(join(ROOT, 'src'));
  return out;
}

test('MWFIX 1: the asset picker OUTRANKS every overlay in src/ - the gate, not an eyeballed number', () => {
  // THE DEFECT: the picker stood at 11 while the enhanced shell that
  // opens it stands at 12, so "Attach data" built a full-screen modal
  // BEHIND an opaque pane. Measured in a real browser before the fix:
  // document.elementFromPoint at the file input's own centre answered
  // a shell element, and the input was not the hit target.
  const all = zIndexLiterals();
  assert.ok(all.length > 5, `the sweep found the landscape (${all.length} literals)`);
  const above = all.filter((x) => x.z >= ASSET_PICKER_Z);
  assert.deepEqual(above, [],
    `nothing may stand at or above the picker (${ASSET_PICKER_Z}); found: ${above.map((x) => `${x.file}=${x.z}`).join(', ')}`);
  // and the shell it is opened from is genuinely below it
  const shell = all.find((x) => x.file === 'src/ui/enhancedMenu.js');
  assert.ok(shell && shell.z < ASSET_PICKER_Z, 'the enhanced shell sits below the picker it opens');
  // the literal is GONE from the picker - it reads the constant
  const ds = rd('src/scenes/dataSource.js');
  assert.match(ds, /z-index:\$\{ASSET_PICKER_Z\}/, 'the overlay takes the constant, so the gate above governs it');
});

test('MWFIX 2: the picker can ALWAYS be closed - the leak was a modal with one unreachable exit', () => {
  // THE DEFECT: `ui.remove()` fired only on the Close button, which sat
  // under the same pane that hid the picker. So the overlay was never
  // removed and its promise never resolved - it lingered in the DOM and
  // surfaced whenever nothing higher was mounted: the "split second" at
  // New Game (shell down, chargen not yet up), then again after chargen.
  const ds = rd('src/scenes/dataSource.js');
  const fn = ds.slice(ds.indexOf('async function pickAssetFolder'));
  const body = fn.slice(0, fn.indexOf('\n}\n') + 3);
  assert.match(body, /const close = \(\) => \{/, 'one close path');
  assert.match(body, /if \(closed\) return;/, 'idempotent - whichever exit fires first wins');
  assert.match(body, /e\.key === 'Escape'/, 'Escape closes it');
  assert.match(body, /if \(e\.target === ui\) close\(\)/, 'so does the backdrop, never the card');
  assert.match(body, /globalThis\.removeEventListener\('keydown', onKey, true\)/, 'and the key listener leaves with it');
  // THREE distinct exits, each reaching the one close path (the button
  // passes it by reference; the other two call it)
  assert.match(body, /globalThis\.addEventListener\('keydown', onKey, true\)/, 'exit 1: the key listener is armed, where the shell listens (see MWFIX 2b)');
  assert.match(body, /ui\.addEventListener\('click', \(e\) => \{ if \(e\.target === ui\) close\(\); \}\)/, 'exit 2: the backdrop');
  assert.match(body, /querySelector\('#adone'\)\.addEventListener\('click', close\)/, 'exit 3: the button, by reference');
  // and every one of them resolves, so the caller's await cannot hang
  assert.match(body, /resolve\(count\);/, 'closing resolves rather than hanging the await');
});

test('MWFIX 2b: the picker OWNS THE KEYBOARD while it is up - found by the probe, not the suite', () => {
  // The node pins above proved Escape was WIRED. The live probe proved
  // it did not WORK: the enhanced shell takes keydown on `globalThis`
  // in CAPTURE and stops what it takes (enhancedMenu.js), so it
  // reached Escape first and walked its own back stack while the
  // picker stayed up. Same target, same phase, and the shell
  // registered first - so the picker cannot win by ordering. It says
  // it is up, and the shell yields, which is the shell's OWN stated
  // law ("a modal overlay owns its input") applied to the modal it
  // opened.
  const ds = rd('src/scenes/dataSource.js');
  assert.match(ds, /export const assetPickerOpen = \(\) => _pickerOpen;/, 'the picker publishes that it is up');
  assert.match(ds, /_pickerOpen = true;/, 'set when it mounts');
  assert.match(ds, /_pickerOpen = false;/, 'and cleared on the ONE close path');
  assert.match(ds, /globalThis\.addEventListener\('keydown', onKey, true\)/, 'it listens where the shell listens');
  assert.match(ds, /globalThis\.removeEventListener\('keydown', onKey, true\)/, 'and leaves cleanly');

  const em = rd('src/ui/enhancedMenu.js');
  assert.match(em, /if \(assetPickerOpen\(\)\) return;/, 'the shell yields to it');
  // the yield is BEFORE the shell consumes the key
  const fn = em.slice(em.indexOf('function onKey(e) {'));
  const yieldAt = fn.indexOf('assetPickerOpen()');
  const stopAt = fn.indexOf('e.stopPropagation()');
  assert.ok(yieldAt > 0 && stopAt > yieldAt, 'and yields before it stops propagation, or the picker never sees the key');
});

// MWFIX 3's pin is ABSENT ON PURPOSE. It held the weapon rig to
// rebuilding its first-person view when data is attached or the
// preference toggled - a real law, and it goes back the moment that rig
// does. Pinning it now would assert a mechanism no code has, which is
// the mirror image of the mistake this whole effort is recovering from.

test('MWFIX2: the mesh-viewer link resolves to the SITE ROOT, from the game as well as the menu', () => {
  // THE DEFECT: the build puts every extra page at the site root
  // (vite.config's rollup inputs) and the game one directory down at
  // /play/, so a bare relative 'mw-viewer.html' asked for
  // /play/mw-viewer.html and 404'd. It worked from menu.html, which is
  // why it shipped.
  const em = rd('src/ui/enhancedMenu.js');
  assert.match(em, /window\.open\(sitePage\('mw-viewer\.html'\), '_blank'\)/, 'the link goes through the resolver');
  assert.ok(!em.includes("window.open('mw-viewer.html'"), 'and the bare relative form is gone');
  assert.match(em, /const sitePage = \(page\) => \{/, 'which has a home and states its reasoning');

  // the law itself, exercised over both doors AND both deploy shapes -
  // `base: './'` promises the same build serves from a project path and
  // from the apex domain, so neither may hard-code a leading slash
  const sitePage = (href, page) => {
    const dir = new URL('.', href);
    const root = /\/play\/$/.test(dir.pathname) ? new URL('..', dir) : dir;
    return new URL(page, root).href;
  };
  const cases = [
    ['https://daggerfalljs.dev/play/', 'https://daggerfalljs.dev/mw-viewer.html'],
    ['https://daggerfalljs.dev/menu.html', 'https://daggerfalljs.dev/mw-viewer.html'],
    ['https://x.github.io/repo/play/', 'https://x.github.io/repo/mw-viewer.html'],
    ['https://x.github.io/repo/menu.html', 'https://x.github.io/repo/mw-viewer.html'],
  ];
  for (const [from, want] of cases) {
    assert.equal(sitePage(from, 'mw-viewer.html'), want, `from ${from}`);
  }
  // and the page it points at is a REAL build input, not a hope
  assert.match(rd('vite.config.js'), /mwViewer: 'mw-viewer\.html'/, 'the viewer is built at the root');
});

test('MWFIX: the classic sprite path is the ONLY path, and fpsWeapon never hears of the layer', () => {
  const rig = rd('src/combat/weaponRig.js');
  // Stronger than the pin this replaces. That one allowed a 3D view and
  // required the sprite to be its else; today there is no view at all, so
  // the sprite draw must stand unconditional and the rig must carry no
  // reference to the removed layer. When the rig returns this reverts to
  // the else-of-an-active-view form.
  assert.match(rig, /const art = c && artFor\(playerWeapon\.weapon\);/, 'the sprite draw is unconditional');
  for (const gone of ['mwView', 'createMwFpView', 'mwFp']) {
    assert.ok(!rig.includes(gone), `weaponRig must not mention ${gone} while the layer is absent`);
  }
  assert.ok(!rd('src/combat/fpsWeapon.js').includes('mwFp'), 'and fpsWeapon.js never learns about the 3D layer');
});

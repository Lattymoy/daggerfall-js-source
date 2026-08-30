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

test('MWFIX 3 (restored at MW-D8): the rig watches the attach GENERATION, not a one-shot read', () => {
  // ABSENT UNTIL NOW, on purpose: it held the weapon rig to rebuilding
  // its first-person view when data is attached, and pinning it while no
  // code had the mechanism would have asserted a mechanism no code has.
  // MW-D8 built the arm, so the law is real again and the pin returns.
  //
  // THE DEFECT IT GUARDS: the reverted rig read hasStoredMorrowind() ONCE
  // at construction, so attaching data to a running game changed nothing
  // until a reload - which is what the report "after uploading does not
  // work at all" actually was.
  const rig = rd('src/combat/weaponRig.js');
  assert.match(rig, /morrowindDataGeneration\(\)/, 'the rig polls the generation');
  assert.match(rig, /let _mwGen = morrowindDataGeneration\(\);/, 'seeded once');
  assert.match(rig, /const fpRecheck = \(\) => \{[\s\S]{0,240}?if \(g === _mwGen\) return;[\s\S]{0,200}?fpArm\.unload\(\);/,
    'and compares it every frame, dropping a stale arm when it moves');
  assert.match(rig, /fpRecheck\(\);/, 'the check is actually called');
  // It drops rather than rebuilds ON PURPOSE: the parse is seconds long
  // and synchronous, so it belongs behind a button, not in a frame.
  assert.ok(!/fpRecheck[\s\S]{0,200}fpArm\.build/.test(rig),
    'and it does NOT start a multi-second parse from inside the frame loop');
});

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
  // THE RIG HAS RETURNED, so this is the else-of-an-active-view form the
  // previous version named as its own successor: "When the rig returns
  // this reverts to the else-of-an-active-view form."
  //
  // AND IT IS STRICTLY STRONGER THAN WHAT IT REPLACES. That pin was a
  // grep for one literal, so it could not see the condition its own label
  // claimed - an arm branch inserted above it passed unchanged. This
  // asserts the ORDER and the RETURN, so both mutations it was blind to
  // now fail: an arm branch with no `return` (both composite, a weapon
  // sprite pasted over a pair of hands), and a sprite draw hoisted above
  // the branch.
  assert.match(rig,
    /if \(fpArm\.active\(\)\) \{ fpArm\.draw\(c\); return; \}\s*const art = c && artFor\(playerWeapon\.weapon\);/,
    'an inactive arm falls STRAIGHT THROUGH to the sprite, and an active one returns so the two never both draw');
  // and the branch must name a module the file actually imports, or it is
  // a literal that satisfies a regex and does nothing.
  assert.match(rig, /import \{ fpArm(?:, [\w$, ]+)? \} from '\.\/fpArm\.js';/,
    'the arm branch is wired to a real module (MW-D19 widened the import list)');
  for (const gone of ['mwView', 'createMwFpView', 'mwFp']) {
    assert.ok(!rig.includes(gone), `weaponRig must not mention ${gone} while the layer is absent`);
  }
  assert.ok(!rd('src/combat/fpsWeapon.js').includes('mwFp'), 'and fpsWeapon.js never learns about the 3D layer');
});

test('MW-D9g: LEARNING the archive count is not a data change - the boot must not unload the arm', async () => {
  // THE DEFECT, reported by Mac as "it says built, now what do I do" and
  // then "still not working" twice over. Nothing about his archives.
  //
  //   scenes/shared.js boots a host and STARTS registerMorrowindData()
  //     without waiting for it (it is IndexedDB, it is async);
  //   createWeaponRig latches morrowindDataGeneration() SYNCHRONOUSLY in
  //     the same host setup, so the latch is always taken BEFORE the
  //     count lands;
  //   _mwCount started at -1, so the first count ALWAYS differed from it
  //     - even an empty store went -1 -> 0 - and bumped the generation;
  //   the rig's first frame saw the bump and called fpArm.unload().
  //
  // Every host boot therefore threw away any arm the player had already
  // built. Building from the main menu before starting a game - which is
  // what the player was told to do - could not survive to the first
  // frame. Measured through the real rig in a real browser
  // (tools/mwRigProbe.mjs): built and drawing 5346 changed pixels, then
  // reason "unloaded" on the frame after boot.
  const ds = await import('../src/scenes/dataSource.js');
  const before = ds.morrowindDataGeneration();
  // An EMPTY store, twice. Nothing has changed, so nothing may move.
  await ds.registerMorrowindData().catch(() => 0);
  const afterFirst = ds.morrowindDataGeneration();
  await ds.registerMorrowindData().catch(() => 0);
  const afterSecond = ds.morrowindDataGeneration();
  assert.equal(afterFirst, before, 'the FIRST count is not a change - it is the count arriving');
  assert.equal(afterSecond, before, 'and a second identical count is not one either');

  // The generation still has to move on a REAL change, which is the
  // whole reason MWFIX 3 put it there. The guard is the only thing
  // between the two behaviours, so it is stated exactly.
  const src = readFileSync(join(ROOT, 'src/scenes/dataSource.js'), 'utf8');
  assert.match(src, /if \(_mwCount >= 0 && next !== _mwCount\) \{ _mwGeneration\+\+;/,
    'a KNOWN count that differs still bumps; an unknown one never does');
  assert.match(src, /let _mwCount = -1;/, '-1 is "not counted yet", and it must stay distinguishable from 0');
});

test('MW-D9g: the rig unloads on a CHANGE only, and the arm survives an unchanged poll', async () => {
  // The other half of the same law, at the consumer. A rig that unloads
  // whenever it re-reads the counter is the bug wearing the other face.
  const rig = readFileSync(join(ROOT, 'src/combat/weaponRig.js'), 'utf8');
  const body = rig.slice(rig.indexOf('const fpRecheck'), rig.indexOf('// AUDIT 17e F17 / THE FOUR HOSTS RULE'));
  assert.match(body, /if \(g === _mwGen\) return;/, 'an unchanged generation returns before touching the arm');
  assert.match(body, /_mwGen = g;\s*\n\s*fpArm\.unload\(\);/, 'and the latch moves BEFORE the unload, so one change unloads once');
});

test('MW-D19: the rig hands the worn item to the arm every frame, in machine order', () => {
  const rig = rd('src/combat/weaponRig.js');
  // The classic sprite already re-reads the equip slot per frame
  // (syncWorn); the Morrowind arm rides the same read or it is a
  // snapshot again. Sheathe state first (it is the cheaper compare and
  // the reference's updateWeaponState reads stance before weapon), the
  // swap next, the tick last so a swapped arm poses its OWN clip.
  assert.match(rig,
    /fpArm\.setWeapon\(playerWeapon\.weapon, \{ hasAmmo: hasDaggerfallArrows\(entity\?\.items\) \}\);/,
    'the swap seam reads the same worn item the sprite does, ammo included');
  const sheatheAt = rig.indexOf('fpArm.setSheathed(');
  const swapAt = rig.indexOf('fpArm.setWeapon(');
  const tickAt = rig.indexOf('fpArm.update(dt)');
  assert.ok(sheatheAt >= 0 && sheatheAt < swapAt, 'sheathe state before the swap');
  assert.ok(swapAt < tickAt, 'and the swap before the tick');
  // ONE home for the arrow test - the rig's own guard rides the export.
  assert.match(rig, /hasDaggerfallArrows\(entity\.items\)/, 'the bow guard rides the same export');
  assert.ok(!/templateIndex === 131/.test(rig), 'no third literal copy of the arrow template');
});

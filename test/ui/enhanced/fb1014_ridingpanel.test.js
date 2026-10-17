// HUD-SADDLE (FIELD BUGS 2026-10-14, Discord: "Riding Window is not able to be edited in the HUD Editor (Alt+U)" - and
// "the horse care toggle in the settings menu doesn't seem to work"; bible/01-Overview/bugs/Field-Bugs-2026-10-14-riding-panel.md).
//
// THE RIDING PANEL IS A HUD PIECE. The saddle panel (ui/enhanced/enhancedSaddle.js, STEED-UI) shipped ten days after HUD-MOVE
// (ui/hud/hudLayout.js) and never joined its registry, so Alt+U framed the compass, the boss bar, the target bar and the
// temperature plate and left the panel under them with no frame: nothing could move it, size it or turn it off. Driven
// over a page that answers the selectors HUD-MOVE asks (descendants among them - the panel's bar stands inside its
// whole-screen layer) with the real sweep, the real panel and the real editor's key and handles.
//
// THE SWITCH. Horse care's tile was traced to every reader and found sound; Mac's word on it (2026-10-15) made it tiers
// on the one key, each player's own online - HORSE-TIERS, pinned end to end by test/systems/horsetiers.test.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  HUD_PIECES, HUD_LAYOUT_CSS, HUD_LAYOUT_PREF, HUD_LOCK_PREF, sweepHudLayout, tickHudLayout, setHudLocked, resetHudLayout,
} from '../../../src/ui/hud/hudLayout.js';
import { drawEnhancedSaddle, hideEnhancedSaddle, buildSaddlePreview, ENHANCED_SADDLE_ID } from '../../../src/ui/enhanced/enhancedSaddle.js';
import { getPref, setPref } from '../../../src/systems/uiPrefs.js';
import { fakePage, withHudPage } from '../../hudPage.mjs';

const SRC = fileURLToPath(new URL('../../../src/', import.meta.url));
const rd = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');

/** The enhanced skin, a layout, a fresh HUD-MOVE (test/hudPage.mjs); the saddle panel taken down after. */
const withPage = (layout, fn) => withHudPage(layout, fn, { teardown: hideEnhancedSaddle });

/** A saddle's read as the host hands it the panel (scenes/saddleHost.js read). */
const S = (o = {}) => ({
  mode: 'Horse', name: 'Shadow', wagonName: '', speed: 0, galloping: false,
  horse: { breath: 1, winded: false, hunger: 'Fed', hungerKey: 'fed', fedHours: 8, full: false, tier: 'Familiar', bond: 45, tierAt: 35, next: { name: 'Trusting', at: 55 } },
  wagon: null, oats: 16, apples: 0, kits: 0, load: null, near: true, wagonNear: true, cargo: null, view: true, hcc: true, ...o,
});
const barOf = (root) => root.children.find((c) => c.className === 'saddlepanel-bar');
const ride = (doc, o) => drawEnhancedSaddle({ saddle: S(o) }, {}, { doc });

test('HUD-SADDLE THE PIECE: the riding panel\'s bar is a HUD-MOVE piece, and a panel built when its rider mounts stands where the player put it - moved, sized or turned off - from its first frame, with no sweep between; a reset puts it back (mutants: no piece; the build\'s placing dropped)', async () => {
  const piece = HUD_PIECES.find((p) => p.id === 'saddle');
  assert.deepEqual({ ...piece }, { id: 'saddle', sel: '.saddlepanel .saddlepanel-bar', name: 'Riding panel', ghost: 'saddle' });
  assert.ok(HUD_LAYOUT_CSS.includes('.saddlepanel .saddlepanel-bar[data-hm],'), 'the editor\'s sheet moves and scales it');
  await withPage({ saddle: { x: 120, y: 340, s: 0.8 } }, (doc) => {
    const root = ride(doc);
    assert.equal(root.id, ENHANCED_SADDLE_ID);
    const bar = barOf(root);
    assert.equal(bar.attrs['data-hm'], 'saddle', 'marked as its piece');
    assert.deepEqual([bar.style.props['--hmx'], bar.style.props['--hmy'], bar.style.props['--hms']], ['120px', '340px', '0.8'], 'at the saved place and size the moment it is built');
    assert.ok(bar.hasAttribute('data-hm-moved'));
    // the frames after keep it there: the panel's own painting never writes the piece's place
    ride(doc, { speed: 10, galloping: true }); ride(doc, { horse: null });
    assert.deepEqual([bar.style.props['--hmx'], bar.style.props['--hmy']], ['120px', '340px']);
    resetHudLayout();
    assert.deepEqual([bar.style.props['--hmx'], bar.style.props['--hms'], bar.hasAttribute('data-hm-moved')], [undefined, undefined, false], 'Reset: the sheet\'s own place');
  });
  await withPage({ saddle: { off: true } }, (doc) => {
    const bar = barOf(ride(doc));
    assert.ok(bar.hasAttribute('data-hm-off'), 'turned off in the editor: off the screen in play from its first frame');
    assert.ok(HUD_LAYOUT_CSS.includes('[data-hm-off]:not([data-hm-edit]) { visibility: hidden !important; }'));
    // dismounted and mounted again: a new panel, placed again
    hideEnhancedSaddle();
    assert.ok(barOf(ride(doc)).hasAttribute('data-hm-off'));
  });
});

test('HUD-SADDLE THE EDITOR: Alt+U frames the riding panel with its name, its X turns it off (saved, hidden once locked) and on again, the lock takes the frame away (mutants: no piece; the X saving nothing)', async () => {
  await withPage(null, async (doc) => {
    tickHudLayout(doc, 0);   // the HUD's first frame starts HUD-MOVE
    const bar = barOf(ride(doc));
    assert.equal(bar.hasAttribute('data-hm-edit'), false, 'locked (the default): no frame');
    doc.fire('keydown', { code: 'KeyU', altKey: true, target: doc.body });
    assert.equal(getPref(HUD_LOCK_PREF), false, 'Alt+U: the editor opens');
    assert.ok(bar.hasAttribute('data-hm-edit'), 'framed');
    assert.equal(bar.attrs['data-hm-name'], 'Riding panel');
    const handles = doc.getElementById('hud-layout-handles');
    const tag = handles.children.find((h) => h.tagName === 'B' && h.textContent === 'Riding panel');
    assert.ok(tag, 'its name over its corner');
    const x = handles.children.find((h) => h.attrs['data-hm-handle'] === 'off' && h._hmNode === bar);
    assert.ok(x, 'its X');
    doc.fire('pointerdown', { target: x, button: 0, clientX: 0, clientY: 0 });
    assert.deepEqual(getPref(HUD_LAYOUT_PREF), { saddle: { off: true } }, 'saved');
    assert.ok(bar.hasAttribute('data-hm-off'));
    doc.fire('keydown', { code: 'KeyU', altKey: true, target: doc.body });
    assert.equal(getPref(HUD_LOCK_PREF), true, 'Alt+U again: locked');
    assert.deepEqual([bar.hasAttribute('data-hm-edit'), bar.hasAttribute('data-hm-off')], [false, true], 'in play: off, and no frame');
    setHudLocked(false);
    const x2 = doc.getElementById('hud-layout-handles').children.find((h) => h.attrs['data-hm-handle'] === 'off' && h._hmNode === bar);
    doc.fire('pointerdown', { target: x2, button: 0, clientX: 0, clientY: 0 });
    assert.equal(getPref(HUD_LAYOUT_PREF), null, 'on again: nothing left to save');
    assert.equal(bar.hasAttribute('data-hm-off'), false);
  });
});

test('HUD-SADDLE THE PREVIEW: with the editor open and nobody riding, the riding panel stands as a preview - the panel\'s own face, named a preview, its bar the piece - and the real one takes its place on a mount; locked, no preview stands; built apart from the live panel, at a finger\'s place on a touch device (mutants: no ghost; the stand-in read as a real panel; the preview mounted as the live panel; the preview never a finger\'s)', async () => {
  await withPage(null, async (doc) => {
    setPref(HUD_LOCK_PREF, false);
    tickHudLayout(doc, 0);   // the HUD's first frame starts HUD-MOVE on this page
    const ghosts = () => doc.querySelectorAll('.saddlepanel[data-hm-ghost="saddle"]');
    for (let i = 0; i < 200 && !ghosts().length; i++) { sweepHudLayout(doc); await new Promise((r) => setTimeout(r, 5)); }   // the previews' hosts load on first need
    assert.equal(ghosts().length, 1, 'one preview');
    const g = ghosts()[0];
    const bar = barOf(g);
    assert.ok(bar.hasAttribute('data-hm-edit') && bar.attrs['data-hm'] === 'saddle', 'its bar is the piece the drags move');
    assert.equal(bar.querySelector('.saddlepanel-name').textContent, 'Riding panel (preview)');
    assert.deepEqual(bar.querySelectorAll('.saddlepanel-meter').map((m) => m.attrs['data-key']), ['breath', 'hunger', 'bond'], 'the panel\'s own meters');
    assert.deepEqual(bar.querySelectorAll('.saddlepanel-btn').map((b) => b.attrs['data-act']), ['feed', 'stable', 'dismount']);
    assert.equal(doc.getElementById(ENHANCED_SADDLE_ID), null, 'the live panel\'s slot stays empty');
    sweepHudLayout(doc);
    assert.equal(ghosts().length, 1, 'the next sweep keeps the one preview - not a second');
    // a rider mounts: the real panel, framed, and the preview gone
    const real = barOf(ride(doc));
    assert.equal(ghosts().length, 0, 'the real panel takes its place');
    assert.equal(g.parentElement, null, 'the whole stand-in leaves, not its bar alone');
    assert.ok(real.hasAttribute('data-hm-edit'));
    // dismounted, the preview again; locked, none
    hideEnhancedSaddle();
    sweepHudLayout(doc);
    assert.equal(ghosts().length, 1);
    setHudLocked(true);
    assert.equal(ghosts().length, 0, 'locked: no preview');
  });
  // the preview alone: built, not put on the page (HUD-MOVE puts it there); at a finger's place where the hosts' touch
  // layer stands (ui/touch/touch.js attachTouch asks isTouchDevice, and the panel's `touch` is that layer)
  const doc = fakePage();
  const p = buildSaddlePreview(doc);
  assert.deepEqual([p.className, p.parentElement, p.id], ['saddlepanel', null, '']);
  const phone = fakePage();
  phone.defaultView.location = { search: '?touch=on' };
  assert.equal(buildSaddlePreview(phone).className, 'saddlepanel touch');
});

test('HUD-SADDLE THE FOUR HOSTS: the panel has one builder, and it places itself - world.js and exterior.js, the hosts that ride, draw it only through the one glue; worldModes.js (interiors) and dungeonContext.js (dungeons) stand no transport and draw none; the sweep that frames it is the HUD\'s, which every host draws (mutant: the build\'s placing dropped)', () => {
  const files = [];
  const walk = (dir) => { for (const f of readdirSync(dir)) { const p = join(dir, f); if (statSync(p).isDirectory()) walk(p); else if (f.endsWith('.js')) files.push(p); } };
  walk(SRC);
  const rel = (p) => p.slice(SRC.length);
  assert.deepEqual(files.filter((p) => /className = 'saddlepanel(-bar)?'/.test(readFileSync(p, 'utf8'))).map(rel), ['ui/enhanced/enhancedSaddle.js'], 'one builder');
  assert.deepEqual(files.filter((p) => readFileSync(p, 'utf8').includes('drawEnhancedSaddle(')).map(rel).sort(), ['scenes/saddleHost.js', 'ui/enhanced/enhancedSaddle.js'], 'one glue draws it');
  for (const host of ['world.js', 'exterior.js']) assert.match(rd(`src/scenes/${host}`), /import \{ createSaddleHost \} from '\.\/saddleHost\.js';/, `${host}: rides, through the glue`);
  for (const host of ['worldModes.js', 'dungeonContext.js']) assert.ok(!/saddleHost|enhancedSaddle/.test(rd(`src/scenes/${host}`)), `${host}: no transport - named, not wired`);
  const saddle = rd('src/ui/enhanced/enhancedSaddle.js');
  assert.match(saddle, /import \{ placeHudPieces \} from '\.\.\/hud\/hudPlacer\.js';/);
  assert.ok(!saddle.includes("from '../hud/hudLayout.js'"), 'through the leaf, not the editor and its previews\' hosts');
  assert.match(saddle, /doc\.body\.append\(host\);\n {4}placeHudPieces\(doc\);/, 'placed the moment it is put on the page');
  assert.match(rd('src/ui/enhanced/enhancedHud.js'), /import \{ tickHudLayout, hudArranging \} from '\.\.\/hud\/hudLayout\.js';/, 'the HUD every host draws seats the sweep');   // PIN MOVED (THE MERGE of main: AUDIT UICALM-FIRM1 imports hudArranging beside the sweep)
});

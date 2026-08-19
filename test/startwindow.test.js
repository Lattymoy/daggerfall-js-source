// U21: THE MAIN MENU. DaggerfallStartWindow.cs, verbatim.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { StartWindow, START_BUTTONS, START_IMG } from '../src/ui/startWindow.js';
import { NATIVE_W, NATIVE_H, nativeMetrics } from '../src/ui/nativePanel.js';
import { ImgFile } from '../src/formats/imgFile.js';
import { DFPalette } from '../src/formats/dfPalette.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const ARENA2 = process.env.ARENA2_PATH;
const skipReal = !ARENA2 || !existsSync(ARENA2) ? 'no ARENA2_PATH' : false;

// ---------------------------------------------------------------------------
// The geometry. The button LABELS are painted into PICK03I0 and DFU lays
// invisible click rects over them (DaggerfallStartWindow.cs:50/:55/:60), so a
// drifted rect puts the words and the hit box in different places - the exact
// failure AUDIT 2026-08-17d found across the native windows.
// ---------------------------------------------------------------------------

test('U21: the three button rects are DFU\'s, to the pixel', () => {
  assert.deepEqual(START_BUTTONS.load, [72, 45, 147, 15], 'DaggerfallStartWindow.cs:50');
  assert.deepEqual(START_BUTTONS.newGame, [72, 99, 147, 15], ':55');
  assert.deepEqual(START_BUTTONS.exit, [125, 145, 41, 15], ':60');
  // All three must sit inside the virtual screen, or they are unclickable.
  for (const [name, [x, y, w, h]] of Object.entries(START_BUTTONS)) {
    assert.ok(x >= 0 && y >= 0 && x + w <= NATIVE_W && y + h <= NATIVE_H, `${name} is off-panel`);
  }
});

test('U21: every button answers a click, and only inside its own rect', () => {
  const win = new StartWindow(null);
  for (const [name, [x, y, w, h]] of Object.entries(START_BUTTONS)) {
    // all four corners and the centre resolve to this button
    assert.equal(win.hitNative(x, y), name, `${name} top-left`);
    assert.equal(win.hitNative(x + w - 1, y + h - 1), name, `${name} bottom-right`);
    assert.equal(win.hitNative(x + (w >> 1), y + (h >> 1)), name, `${name} centre`);
    // and one pixel outside each edge does NOT
    assert.notEqual(win.hitNative(x - 1, y), name, `${name} leaks left`);
    assert.notEqual(win.hitNative(x, y - 1), name, `${name} leaks up`);
    assert.notEqual(win.hitNative(x + w, y), name, `${name} leaks right`);
    assert.notEqual(win.hitNative(x, y + h), name, `${name} leaks down`);
  }
  // The gaps between the buttons are dead, as they are in DFU.
  assert.equal(win.hitNative(160, 5), null, 'the title strip is not a button');
  assert.equal(win.hitNative(160, 80), null, 'between Load and New Game');
});

test('U21: a press records the action; a miss records nothing', () => {
  const canvas = { width: NATIVE_W, height: NATIVE_H };
  const m = nativeMetrics(canvas);
  const at = ([x, y, w, h]) => [m.ox + (x + (w >> 1)) * m.s, m.oy + (y + (h >> 1)) * m.s];

  const win = new StartWindow(null);
  assert.equal(win.action, null);
  assert.equal(win.click(canvas, ...at(START_BUTTONS.newGame)), 'newGame');
  assert.equal(win.action, 'newGame');

  const w2 = new StartWindow(null);
  assert.equal(w2.click(canvas, ...at(START_BUTTONS.load)), 'load');
  assert.equal(w2.action, 'load');

  // A miss returns null and leaves the action unset - but the caller
  // still treats it as consumed, so it cannot reach a pointer lock.
  const w3 = new StartWindow(null);
  assert.equal(w3.click(canvas, m.ox + 160 * m.s, m.oy + 5 * m.s), null);
  assert.equal(w3.action, null);
});

test('U21: clicks off the letterboxed panel hit nothing', () => {
  // A wide canvas letterboxes the 320x200 panel; the bars are not the menu.
  const canvas = { width: NATIVE_W * 3, height: NATIVE_H * 2 };
  const win = new StartWindow(null);
  assert.equal(win.hit(canvas, 2, 2), null, 'top-left bar');
  assert.equal(win.hit(canvas, canvas.width - 2, canvas.height - 2), null, 'bottom-right bar');
});

// ---------------------------------------------------------------------------
// The art. PICK03I0 is PALETTIZED - its 768 palette bytes follow the image and
// ImgFile._readPalette writes INTO the palette it is handed, so it must get
// its own. Handing it the shared ART_PAL would repaint every other screen
// (the U18 / AUDIT 17k law).
// ---------------------------------------------------------------------------

test('U21: PICK03I0 is a full-screen palettized IMG on its OWN palette', { skip: skipReal }, () => {
  const shared = new DFPalette();
  shared.load(new Uint8Array(readFileSync(join(ARENA2, 'ART_PAL.COL'))), 'ART_PAL.COL');
  const before = shared.get(1);

  const own = new DFPalette();
  const img = new ImgFile();
  img.load(new Uint8Array(readFileSync(join(ARENA2, START_IMG))), START_IMG, own);
  const bmp = img.getDFBitmap();

  assert.equal(bmp.width, NATIVE_W, 'the menu fills the virtual screen');
  assert.equal(bmp.height, NATIVE_H);
  assert.equal(bmp.data.length, NATIVE_W * NATIVE_H);
  // It really did read an embedded palette, not the caller's.
  assert.notDeepEqual(own.get(1), before, 'PICK03I0 carries its own palette');
  // And the shared palette is untouched - the whole point of the rule.
  assert.deepEqual(shared.get(1), before, 'ART_PAL must survive the menu load');
});

// ---------------------------------------------------------------------------
// The boot seam. ?shot and the dev scenes MUST bypass the menu: the shot
// pipeline and the 25 probes in tools/ drive fixed vantages, and a menu in
// front of them would block every one.
// ---------------------------------------------------------------------------

test('U21: the bare URL reaches the menu, and ?shot bypasses it', () => {
  const main = readFileSync(join(root, 'src/main.js'), 'utf8');
  assert.match(main, /runMenu\(canvas, renderer, status\)/, 'the bare URL must reach the menu');
  assert.match(main, /params\.has\('shot'\)\s*\|\|\s*params\.has\('nomenu'\)/,
    '?shot must bypass the menu or every probe in tools/ blocks');
  // The bypass has to come BEFORE the menu, or it does not bypass anything.
  assert.ok(main.indexOf("params.has('shot')") < main.indexOf('runMenu('),
    'the ?shot bypass must precede the menu');
});

test('U21: LOAD reuses the host quickLoad rather than a second loader', () => {
  const dungeon = readFileSync(join(root, 'src/scenes/dungeon.js'), 'utf8');
  assert.match(dungeon, /params\.has\('load'\)/, 'the host must honour the menu\'s load flag');
  assert.match(dungeon, /ctx\.quickLoad\(/, 'and load through the context, not a copy');
  assert.match(dungeon, /loadedPos \?\? ctx\.startSpawn\(\)/,
    'a loaded game resumes where it was saved, not at the start marker');
  // No second loader anywhere in the menu path.
  const menu = readFileSync(join(root, 'src/scenes/menu.js'), 'utf8');
  assert.equal(/restorePlayer\(/.test(menu), false, 'the menu must not restore a save itself');
});

// ---------------------------------------------------------------------------
// U21b: the chargen parent panel, in the HOST's space.
//
// DaggerfallBaseWindow.cs:40 paints parentPanel.BackgroundColor black behind
// the 320x200 native panel. The port painted it at (0,0,realW,realH) from
// INSIDE the overlay's draw - but the dungeon host sets a letterbox offset
// before calling overlays (dungeonContext drawOverlay), so the backdrop landed
// down-right by the margin and left the top and left strips showing the host's
// 60% dim over the pale Iliac Bay sky. Measured on the live app at 1400x900:
// the left strip read (57,75,97) - the sky at 40% - and (0,0,0) after the fix.
// ---------------------------------------------------------------------------

const fakeRenderer = (offset) => {
  const quads = [];
  return {
    quads,
    screenOffset: offset,
    gl: { drawingBufferWidth: 1400, drawingBufferHeight: 900 },
    drawScreenQuad: (tex, rect, uv, color) => quads.push({ rect, color }),
  };
};

test('U21b: the chargen backdrop subtracts the host letterbox offset', async () => {
  const { drawMenuBackdrop, MENU_BACKDROP } = await import('../src/ui/chargenArt.js');

  // The dungeon host's shape: a 1400x900 canvas at scale 4 letterboxes the
  // 320x200 panel, so the offset is (60, 50).
  const offsetR = fakeRenderer([60, 50]);
  drawMenuBackdrop(offsetR);
  assert.equal(offsetR.quads.length, 1);
  assert.deepEqual(offsetR.quads[0].rect, { x: -60, y: -50, w: 1400, h: 900 },
    'the backdrop must land on the real canvas origin, not the panel origin');
  assert.deepEqual(offsetR.quads[0].color, MENU_BACKDROP, 'and it is OPAQUE black');
  assert.equal(MENU_BACKDROP[3], 1, 'DaggerfallBaseWindow.cs:40 is black, not a dim');

  // The exterior hosts pass the real canvas with NO offset - unchanged.
  const plainR = fakeRenderer([0, 0]);
  drawMenuBackdrop(plainR);
  assert.deepEqual(plainR.quads[0].rect, { x: 0, y: 0, w: 1400, h: 900 });

  // A renderer that has never had an offset set must not throw.
  const bareR = { ...fakeRenderer(undefined), screenOffset: undefined };
  bareR.quads = []; bareR.drawScreenQuad = (t, rect, uv, c) => bareR.quads.push({ rect, color: c });
  drawMenuBackdrop(bareR);
  assert.deepEqual(bareR.quads[0].rect, { x: 0, y: 0, w: 1400, h: 900 });
});

test('U21b: the renderer reports its screen offset', async () => {
  // The getter is what makes the backdrop correct in both host shapes.
  const { Renderer } = await import('../src/render/renderer.js');
  const r = Object.create(Renderer.prototype);
  assert.deepEqual(r.screenOffset, [0, 0], 'defaults to no offset');
  r.setScreenOffset(60, 50);
  assert.deepEqual(r.screenOffset, [60, 50]);
  r.setScreenOffset(0, 0);
  assert.deepEqual(r.screenOffset, [0, 0]);
});

// ---------------------------------------------------------------------------
// U21c: THE TITLE SCREEN. A deliberate departure (Ledger A), not a port -
// classic's TITL00I0 is read and pinned but DFU does not draw it either, so
// this shows OUR branding as DFU shows its own. The rules that matter are
// that it never traps the boot, and that the logo is placed by arithmetic
// rather than by eye.
// ---------------------------------------------------------------------------

test('U21c: a missing logo means NO title screen, never a trapped boot', async () => {
  const { loadLogo, TitleScreen } = await import('../src/ui/titleScreen.js');

  // No document at all (node): resolves null rather than throwing.
  assert.equal(await loadLogo('logo.png', undefined), null);
  // A 404 resolves null too - absent art is not an error.
  const orig = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: false });
  try {
    assert.equal(await loadLogo('logo.png', { createElement: () => ({}) }), null);
  } finally { globalThis.fetch = orig; }

  // And a screen with no logo declares itself undrawable, which is the
  // signal the boot uses to skip straight to the menu.
  assert.equal(new TitleScreen(null).drawable, false);
  assert.equal(new TitleScreen({ kind: 'logo', tex: {}, width: 8, height: 4 }).drawable, true);
});

test('U21c: the logo is centred, aspect-preserved, and never fills the screen', async () => {
  const { logoRect, LOGO_MAX_WIDTH } = await import('../src/ui/titleScreen.js');

  // A wide banner (the logo is ~3:1) on a 1400x900 canvas.
  const r = logoRect(1400, 900, 2000, 650);
  assert.ok(r.w <= Math.round(1400 * LOGO_MAX_WIDTH), 'never wider than the cap');
  assert.ok(r.h < 900, 'and it fits vertically');
  // Aspect preserved to within a rounded pixel.
  assert.ok(Math.abs(r.w / r.h - 2000 / 650) < 0.01, `aspect drifted: ${r.w}x${r.h}`);
  // Centred on both axes.
  assert.equal(r.x, Math.round((1400 - r.w) / 2));
  assert.equal(r.y, Math.round((900 - r.h) / 2));

  // A TALL logo must be bound by height, not width - the naive
  // width-only fit would run it off the top and bottom.
  const tall = logoRect(1400, 900, 400, 3000);
  assert.ok(tall.h <= Math.round(900 * LOGO_MAX_WIDTH), 'a tall logo is height-bound');
  assert.ok(tall.y >= 0 && tall.y + tall.h <= 900, 'and stays on screen');

  // Degenerate input is refused rather than dividing by zero.
  assert.equal(logoRect(1400, 900, 0, 0), null);
});

test('U21c: the title screen paints opaque black behind the logo', async () => {
  const { TitleScreen } = await import('../src/ui/titleScreen.js');
  const quads = [];
  const renderer = { drawScreenQuad: (tex, rect, uv, color) => quads.push({ tex, rect, color }) };
  const canvas = { width: 1400, height: 900 };

  const rect = new TitleScreen({ kind: 'logo', tex: 'LOGO', width: 2000, height: 650 }).draw(renderer, canvas);
  assert.equal(quads.length, 2, 'backdrop then logo');
  assert.deepEqual(quads[0].rect, { x: 0, y: 0, w: 1400, h: 900 }, 'the backdrop is the whole canvas');
  assert.deepEqual(quads[0].color, [0, 0, 0, 1], 'and it is OPAQUE black - no scene shows through');
  assert.equal(quads[1].tex, 'LOGO');
  assert.deepEqual(quads[1].rect, rect);
});

// ---------------------------------------------------------------------------
// U21c (second pass, after Mac sent the artwork): the logo is NOT classic art
// and must not be drawn as if it were. Every screen quad in this port takes a
// 1-BIT cutout - discard a<0.5, then force alpha to 1 - because classic art IS
// a 1-bit cutout: palette index 0 is transparent and every other index is
// fully opaque. The logo has anti-aliased gold serifs and a soft shadow under
// the dagger, so that threshold would jag the edges and cut the shadow to a
// silhouette; and it is a high-resolution banner drawn at a non-integer scale,
// where NEAREST aliases. Both are OPT-IN, so these pins also prove the classic
// law is still the default for everything else.
// ---------------------------------------------------------------------------

test('U21c: the logo draws ALPHA-BLENDED, where classic art keeps the cutout', async () => {
  const { TitleScreen } = await import('../src/ui/titleScreen.js');
  const quads = [];
  const renderer = {
    drawScreenQuad: (tex, rect, uv, color, opts) => quads.push({ tex, opts }),
  };
  new TitleScreen({ kind: 'logo', tex: 'LOGO', width: 2000, height: 650 })
    .draw(renderer, { width: 1400, height: 900 });

  assert.equal(quads[1].tex, 'LOGO');
  assert.equal(quads[1].opts?.blend, true, 'the logo opts INTO alpha blending');

  // The backdrop - and every other quad in the port - does not.
  assert.notEqual(quads[0].opts?.blend, true, 'the solid backdrop takes no texture blend');

  // And the opt-in really is opt-in: the shader keeps the discard on the
  // default path, so no classic art path changed. Read the source rather
  // than a GL context, which the suite has none of.
  const src = readFileSync('src/render/renderer.js', 'utf8');
  assert.match(src, /uBlendTex == 1/, 'the blended arm exists in the shader');
  assert.match(src, /if \(t\.a < 0\.5\) discard;/, 'and the 1-bit cutout is still the ELSE');
  assert.match(src, /opts\.blend \? 1 : 0/, 'gated on the caller, not on the texture');
});

test('U21c: the logo uploads LINEAR/CLAMP, where classic art stays NEAREST/REPEAT', async () => {
  const { runTitle } = await import('../src/scenes/menu.js');

  const saved = {
    fetch: globalThis.fetch,
    bitmap: globalThis.createImageBitmap,
    raf: globalThis.requestAnimationFrame,
    doc: globalThis.document,
    add: globalThis.addEventListener,
    remove: globalThis.removeEventListener,
  };
  const uploads = [];
  try {
    globalThis.fetch = async () => ({ ok: true, blob: async () => 'BLOB' });
    globalThis.createImageBitmap = async () => ({ width: 2000, height: 650 });
    // ONE frame only - the loop re-arms itself, so calling every
    // callback would recurse until the stack gave out.
    let frames = 0;
    globalThis.requestAnimationFrame = (fn) => { if (frames++ === 0) fn(); return 0; };
    globalThis.document = {
      createElement: () => ({
        getContext: () => ({
          drawImage: () => {},
          getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
        }),
      }),
    };
    let onKey = null;
    globalThis.addEventListener = (type, fn) => { if (type === 'keydown') onKey = fn; };
    globalThis.removeEventListener = () => {};

    const canvas = { width: 1400, height: 900, addEventListener: () => {}, removeEventListener: () => {} };
    const renderer = {
      uploadTexture: (a, r, px, opts) => { uploads.push({ a, r, px, opts }); return 'TEX'; },
      beginFrame: () => {},
      drawScreenQuad: () => {},
    };

    const done = runTitle(canvas, renderer, () => {});
    // Let loadLogo's awaits settle, then advance the screen as a key would.
    for (let i = 0; i < 8; i++) await Promise.resolve();
    assert.equal(typeof onKey, 'function', 'the title screen listens for a key');
    onKey();
    assert.equal(await done, true, 'and a key advances it');
  } finally {
    globalThis.fetch = saved.fetch;
    globalThis.createImageBitmap = saved.bitmap;
    globalThis.requestAnimationFrame = saved.raf;
    globalThis.document = saved.doc;
    globalThis.addEventListener = saved.add;
    globalThis.removeEventListener = saved.remove;
  }

  assert.equal(uploads.length, 1, 'the logo uploads exactly once');
  assert.deepEqual(uploads[0].opts, { smooth: true },
    'and it asks for LINEAR/CLAMP - NEAREST would alias a banner drawn at a non-integer scale');
  assert.equal(uploads[0].px.width, 2000);
  assert.equal(uploads[0].px.colors.length, 2000 * 650 * 4, 'RGBA, one byte a channel');

  // smooth is OPT-IN: the default is still the classic law, so no game
  // art path changed. The suite has no GL context, so read the source.
  const rendSrc = readFileSync('src/render/renderer.js', 'utf8');
  assert.match(rendSrc, /opts\.smooth \? gl\.CLAMP_TO_EDGE : gl\.REPEAT/, 'wrap is opt-in');
  assert.match(rendSrc, /opts\.smooth \? gl\.LINEAR : gl\.NEAREST/, 'and so is the filter');
});

// ---------------------------------------------------------------------------
// U21d: THE FALLBACK IS CLASSIC'S OWN TITLE, not a placeholder.
//
// public/logo.png is ours and may simply not be there. Rather than showing
// nothing, the screen falls back to TITL00I0.IMG - the Daggerfall wordmark
// over the box art, which this port already reads byte-exact and which comes
// out of the user's own ARENA2 at runtime, so there is nothing to ship and
// nothing to install. Classic drew its title here; drawing it here is the
// least surprising thing to do while our own art is missing.
//
// The two are drawn by DIFFERENT laws, and that is the point: TITL00I0 is
// 320x200 palettized game art (native panel, integer scale, 1-bit cutout,
// NEAREST) and our logo is high-resolution art with real partial alpha
// (fitted, blended, smoothed). Each law is wrong for the other's art.
// ---------------------------------------------------------------------------

test('U21d: with no logo the title falls back to CLASSIC art, on the native panel', async () => {
  const { TitleScreen, loadTitleArt, TITLE_IMG } = await import('../src/ui/titleScreen.js');
  const { nativeMetrics } = await import('../src/ui/nativePanel.js');

  assert.equal(TITLE_IMG, 'TITL00I0.IMG');

  // No document (node) means no logo, so loadTitleArt must reach for the IMG.
  let asked = null;
  const art = await loadTitleArt({
    renderer: {},
    fetchBytes: async (name) => { asked = name; throw new Error('absent'); },
    doc: undefined,
  });
  assert.equal(asked, TITLE_IMG, 'it asked for classic art when ours was missing');
  assert.equal(art, null, 'and a missing IMG too is still no title screen, never a throw');

  // The native arm draws on the native panel, NOT through logoRect.
  const quads = [];
  const drawn = [];
  const renderer = {
    drawScreenQuad: (tex, rect, uv, color, opts) => quads.push({ tex, rect, color, opts }),
    drawImgSub: () => {},
  };
  const canvas = { width: 1400, height: 900 };
  const nativeArt = { tex: 'TITL', w: 320, h: 200 };
  const screen = new TitleScreen({ kind: 'native', art: nativeArt });
  assert.equal(screen.drawable, true);

  // drawImg routes through drawScreenQuad; the backdrop is quad 0 either way.
  const m = screen.draw(renderer, canvas);
  assert.deepEqual(m, nativeMetrics(canvas), 'it returns the NATIVE metrics, not a logo rect');
  assert.equal(quads[0].tex, null, 'backdrop first');
  assert.deepEqual(quads[0].rect, { x: 0, y: 0, w: 1400, h: 900 });

  // The classic art must NOT take the logo's blend/smooth opt-ins - it is a
  // 1-bit cutout like every other classic screen, and blending it would let
  // its index-0 pixels ghost instead of dropping out.
  for (const q of quads.slice(1)) {
    assert.notEqual(q.opts?.blend, true, 'classic art keeps the cutout');
  }
  void drawn;
});

test('U21d: OUR logo still wins when it is present', async () => {
  const { loadTitleArt } = await import('../src/ui/titleScreen.js');

  const saved = { fetch: globalThis.fetch, bitmap: globalThis.createImageBitmap };
  try {
    globalThis.fetch = async () => ({ ok: true, blob: async () => 'BLOB' });
    globalThis.createImageBitmap = async () => ({ width: 2000, height: 650 });
    const doc = {
      createElement: () => ({
        getContext: () => ({
          drawImage: () => {},
          getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
        }),
      }),
    };
    let askedForImg = false;
    const art = await loadTitleArt({
      renderer: {},
      fetchBytes: async () => { askedForImg = true; throw new Error('should not be reached'); },
      uploadLogo: () => 'OURTEX',
      doc,
    });
    assert.equal(art.kind, 'logo', 'ours wins');
    assert.equal(art.tex, 'OURTEX');
    assert.equal(art.width, 2000);
    assert.equal(askedForImg, false, 'and classic art is never even fetched');
  } finally {
    globalThis.fetch = saved.fetch;
    globalThis.createImageBitmap = saved.bitmap;
  }
});

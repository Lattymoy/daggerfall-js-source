// WW3 (2026-09-14, Mac's live crash on daggerfalljs.dev):
//
//     TypeError: can't access property "buffer", l is undefined
//       k@renderer.js            <- asBytes
//       uploadTexture@renderer.js
//       ...@weaponRig-*.js       <- the widget's texture load
//
// THE WIDGET'S TEXTURE DOOR HANDED THE WRONG SHAPE. `weaponWidgetImage`
// converted a decoded PNG with `toColor32Order`, which answers the port's
// bottom-up ORDER in a decoded PNG's `{ width, height, data }`, and
// weaponWidget.js handed that straight to `renderer.uploadTexture`, which
// reads `color32.colors`. Undefined, and `asBytes` died on `.buffer` -
// three frames down, naming neither the texture nor the cure, on the first
// frame a player's attached bundle actually carried (WW1 shipped the door
// against a bundle nobody had attached in a test, so no pin ever ran the
// door's answer into the upload - this file is that pin).
//
// `formats/color32Order.js` had already written the trap down in the open:
// `toColor32` is the same conversion "handed back in the shape the upload
// path reads", and its doc says a decoded PNG's `{ data }` "is NOT that
// shape - `color32.colors` would be `undefined` and `asBytes` would throw".
// The door takes `toColor32` now; the upload path names the fault instead
// of dying inside a helper; and the site's `catch (() => {})`, which would
// have swallowed this forever had it not reached the page, says so.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Renderer, asBytes, color32Bytes } from '../src/render/renderer.js';
import { toColor32, toColor32Order } from '../src/formats/color32Order.js';
import {
  setWeaponWidgetSources, clearWeaponWidgetSources, weaponWidgetImage, widgetTextureName,
} from '../src/combat/weaponWidgetAssets.js';
import { WEAPON_MATERIALS } from '../src/characters/weapons.js';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

/** The audit39/glstate Proxy precedent, with texImage2D's pixels recorded. */
function stubRenderer() {
  const uploads = [];
  const gl = new Proxy({}, {
    get: (o, k) => {
      if (k === 'getProgramParameter' || k === 'getShaderParameter') return () => true;
      if (k === 'getUniformLocation' || k === 'getAttribLocation') return () => ({});
      if (typeof k === 'string' && k.startsWith('create')) return () => ({});
      if (k === 'texImage2D') return (...a) => uploads.push({ width: a[3], height: a[4], pixels: a[8] });
      if (k === 'drawingBufferWidth' || k === 'drawingBufferHeight') return 320;
      if (typeof k === 'string' && k.toUpperCase() === k) return 1;   // GL enums
      return () => {};
    },
  });
  const r = new Renderer({ getContext: () => gl, clientWidth: 320, clientHeight: 200, width: 320, height: 200 });
  const before = uploads.length;   // the constructor uploads its own 1x1 black texture first
  return { r, uploads, since: () => uploads.slice(before), last: () => uploads.at(-1) };
}

/** decodePng is the browser's (createImageBitmap + OffscreenCanvas). Its two
 *  globals, just deep enough to hand back one known raster TOP row first -
 *  so the door's own decode runs here exactly as it runs in the page. */
function withPngDecoder(raster, body) {
  const { width, height, data } = raster;
  const had = [globalThis.createImageBitmap, globalThis.OffscreenCanvas];
  globalThis.createImageBitmap = async () => ({ width, height, close() {} });
  globalThis.OffscreenCanvas = class {
    constructor(w, h) { this.width = w; this.height = h; }
    getContext() { return { drawImage() {}, getImageData: (x, y, w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(data) }) }; }
  };
  return (async () => { try { return await body(); } finally { [globalThis.createImageBitmap, globalThis.OffscreenCanvas] = had; } })();
}

// one 1x2 picture, TOP row first as every PNG-shaped door hands it over:
// the top row red, the bottom row blue - so the flip is visible in the bytes
const TOP_FIRST = { width: 1, height: 2, data: new Uint8Array([255, 0, 0, 255, 0, 0, 255, 255]) };
const BOTTOM_UP = [0, 0, 255, 255, 255, 0, 0, 255];   // what the GL must receive

test('WW3 the crash, executed: the door\'s answer goes into the real uploadTexture and the picture reaches the GL bottom-up - the path that threw on Mac\'s machine, from the loose PNG through decodePng to texImage2D', async () => {
  const name = widgetTextureName('WEAPON04.CIF', 0, 0, WEAPON_MATERIALS.Elven);
  assert.equal(name, 'w_WEAPON04.CIF_0-0_Elven');
  try {
    assert.equal(setWeaponWidgetSources([`${name}.png`], async () => new Uint8Array([137, 80, 78, 71])), 1, 'the loose PNG is registered');
    const img = await withPngDecoder(TOP_FIRST, () => weaponWidgetImage(name));
    assert.ok(img, 'the door answers a picture');
    // THE CONTRACT, both halves: the SHAPE uploadTexture reads, and the port's bottom-up ORDER
    assert.deepEqual(Object.keys(img).sort(), ['colors', 'height', 'width'], 'the door answers { width, height, colors } - never a decoded PNG\'s { data }');
    assert.equal(img.width, 1); assert.equal(img.height, 2);
    assert.equal(img.data, undefined, 'and carries no `data` to be handed on by mistake');
    // ...into the REAL upload path, on the audit39 gl stub. This is the call
    // that threw: `uploadTexture('img', `ww:${name}`, img)`, weaponWidget.js.
    const { r, since, last } = stubRenderer();
    const tex = r.uploadTexture('img', `ww:${name}`, img);
    assert.ok(tex, 'uploaded, no throw');
    assert.equal(since().length, 1, 'one upload, the widget\'s');
    assert.equal(last().width, 1); assert.equal(last().height, 2);
    assert.deepEqual([...last().pixels], BOTTOM_UP, 'row 0 of the buffer is the picture\'s BOTTOM row (the port\'s texel convention)');
    assert.equal(r.uploadTexture('img', `ww:${name}`, img), tex, 'memoized by key, as the widget leans on');
  } finally { clearWeaponWidgetSources(); }
});

test('WW3 the regression, executed: the shape the door used to answer still throws at the upload - and the error now names the key, what it got and the cure, where a TypeError three frames down named nothing', () => {
  const old = toColor32Order(TOP_FIRST);   // exactly what the door answered before
  assert.deepEqual(Object.keys(old).sort(), ['data', 'height', 'width'], 'the ORDER function\'s shape - right order, wrong shape');
  assert.equal(old.colors, undefined, 'the undefined `asBytes` died on');
  assert.throws(() => asBytes(old.colors), TypeError, 'the bare helper still dies as it did on the page');
  const { r } = stubRenderer();
  assert.throws(() => r.uploadTexture('img', 'ww:regression', old), (e) => {
    assert.ok(!(e instanceof TypeError), 'not a TypeError out of a helper any more');
    assert.match(e.message, /uploadTexture\(img, ww:regression\)/, 'the caller and the texture');
    assert.match(e.message, /carries no `colors`/, 'the key that was missing');
    assert.match(e.message, /\{ width, height, data \}/, 'what it got instead');
    assert.match(e.message, /toColor32 \(formats\/color32Order\.js\)/, 'the cure, by name');
    return true;
  });
  // the same guard on the emission upload, which reads `colors` the same way
  assert.throws(() => stubRenderer().r.uploadEmissionTexture(210, 0, old), /uploadEmissionTexture\(210, 0\).*carries no `colors`/s);
  // and the guard is a GUARD, not a gate: a good image still uploads
  const { r: r2, since, last } = stubRenderer();
  r2.uploadEmissionTexture(210, 0, toColor32(TOP_FIRST));
  assert.equal(since().length, 1);
  assert.deepEqual([...last().pixels], BOTTOM_UP);
  assert.deepEqual([...color32Bytes(toColor32(TOP_FIRST), 'x')], BOTTOM_UP, 'the helper itself, executed');
  for (const bad of [null, undefined, {}, { width: 1, height: 1 }]) assert.throws(() => color32Bytes(bad, 'x'), /carries no `colors`/);
});

test('WW3 the door and the site: the widget converts with toColor32 in both arms and holds no toColor32Order; the load failure is said out loud, as the rig\'s neighbours say theirs', () => {
  const door = rd('src/combat/weaponWidgetAssets.js');
  assert.match(door, /import \{ toColor32 \} from '\.\.\/formats\/color32Order\.js';/);
  assert.ok(!/toColor32Order/.test(door.replace(/^\s*\*.*$/gm, '')), 'not in the code - the trap is named in the comment only');
  assert.equal((door.match(/toColor32\(/g) ?? []).length, 2, 'both arms: the bundle\'s texture and the loose PNG');
  assert.match(door, /try \{ return toColor32\(tex\.rgba\(\)\); \}/, 'the bundle arm');
  assert.match(door, /return toColor32\(await decodePng\(bytes\)\);/, 'the loose arm');
  assert.match(door, /`\{ width, height, colors \}` RGBA in the port's\n \*  color32 \(bottom-up\) order, the SHAPE renderer\.uploadTexture reads/, 'the door says which shape it answers');
  const site = rd('src/combat/weaponWidget.js');
  assert.match(site, /\}\)\.catch\(\(e\) => console\.warn\('\[weapon widget\] texture load failed', name, e\)\);/, 'no bare swallow');
  assert.ok(!/\.catch\(\(\) => \{\}\)/.test(site), 'and none left anywhere in the widget');
  // the one home the fix leans on, unchanged
  const conv = rd('src/formats/color32Order.js');
  assert.match(conv, /`color32\.colors` would be `undefined` and\n \* `asBytes` would throw on the first swapped record/, 'the trap this crash walked into, written down before it happened');
});

test('WW3 records: the widget page, the ledger row and the testing row', () => {
  assert.match(rd('bible/05-Combat/Weapon-Widget.md'), /^## WW3 - THE TEXTURE DOOR'S SHAPE \(2026-09-14, Mac's live crash\)/m);
  assert.match(rd('bible/01-Overview/Port-Ledger.md'), /WW3 \(2026-09-14\): the mod's own textures reached the GL/);
  assert.match(rd('bible/09-Testing/Testing.md'), /^\| ww3_widgettexture\.test\.js \| \d+ \| WW3/m);
});

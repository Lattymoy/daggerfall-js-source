// TEX1 (2026-09-14) - ONE SHAPE FOR EVERY TEXTURE DOOR, and the crash that
// proved the class.
//
// Mac's page died on daggerfalljs.dev with
//
//     CRASH / unhandled rejection
//     TypeError: can't access property "buffer", l is undefined
//       k@renderer.js (asBytes) <- uploadTexture <- .../weaponRig-*.js
//
// and the third frame, `Ii/ue/e.texturesLoading`, is in the SHIPPED bundle
// where no source file carries the name: it is HANDHELD TORCHES'
// `w.texturesLoading` (the `ht:` upload key beside it in the minified
// chunk, both mods sharing the weaponRig chunk). Its door answered
// `toColor32Order`'s `{ width, height, data }` - a decoded PNG's shape -
// and `uploadTexture` reads `color32.colors`, so `asBytes` died on
// `.buffer`; and because NOTHING awaits `w.texturesLoading`, the throw
// escaped as an unhandled rejection and took the page down with it.
//
// FOUR doors had walked into the same trap: handheld torches (live, the
// crash), dropped torches (the same mod, uploading albedo AND emission),
// the weapon widget (WW3, latent - its `catch (() => {})` would have eaten
// it), and seasons (which re-wrapped at its two upload sites instead, so it
// worked and taught the wrong lesson). The trap is that
// `formats/color32Order.js` exports TWO conversions - `toColor32Order`
// (the flip, in a PNG's shape) and `toColor32` (the flip, in the shape the
// upload path reads) - and the tempting name is the wrong one.
//
// THE CLASS IS CLOSED BY CONSTRUCTION: every door converts with
// `toColor32`, no module under src/ imports `toColor32Order` at all, and
// the pin below says so. The upload path names the fault when a fifth
// door ever gets it wrong, and neither torch load can take the page down
// again: both fail to a console line and draw nothing, which is the mod
// running without its sprites - what it already does when the files are
// missing.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Renderer } from '../src/render/renderer.js';
import { toColor32, toColor32Order } from '../src/formats/color32Order.js';
import { createHandheldTorches, readTorchSettings, HANDHELD_TORCHES_VENDOR } from '../src/systems/handheldTorches.js';
import { MOD_SETTINGS } from '../src/systems/modSettings.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const rd = (p) => readFileSync(join(root, p), 'utf8');

/** The audit39 Proxy gl, with texImage2D's pixels recorded. */
function stubRenderer() {
  const uploads = [];
  const gl = new Proxy({}, {
    get: (o, k) => {
      if (k === 'getProgramParameter' || k === 'getShaderParameter') return () => true;
      if (k === 'getUniformLocation' || k === 'getAttribLocation') return () => ({});
      if (typeof k === 'string' && k.startsWith('create')) return () => ({});
      if (k === 'texImage2D') return (...a) => uploads.push({ width: a[3], height: a[4], pixels: a[8] });
      if (k === 'drawingBufferWidth' || k === 'drawingBufferHeight') return 320;
      if (typeof k === 'string' && k.toUpperCase() === k) return 1;
      return () => {};
    },
  });
  const r = new Renderer({ getContext: () => gl, clientWidth: 320, clientHeight: 200, width: 320, height: 200 });
  const before = uploads.length;   // the constructor's own 1x1 black texture
  return { r, since: () => uploads.slice(before) };
}

/** console.warn, captured. */
function withWarn(body) {
  const had = console.warn; const lines = [];
  console.warn = (...a) => lines.push(a.map(String).join(' '));
  return (async () => { try { return { out: await body(), lines }; } finally { console.warn = had; } })();
}

/** The handheld-torches component, just enough of the host to mount it. */
function torchRig(renderer, loadSprite) {
  // the mod's whole settings store, as the HT1 rig builds it, with the sprite module on
  const store = { ...Object.fromEntries(Object.entries(MOD_SETTINGS[HANDHELD_TORCHES_VENDOR].keys).map(([k, d]) => [k, d.default])), 'Modules.Sprite': true };
  const h = createHandheldTorches({
    settings: () => readTorchSettings(() => store), audio: null, say: () => {}, rolls: () => 0.5,
    torches: () => null, handedness: () => false, loadSprite,
  });
  const entity = { items: [], equip: { slots: {} }, lightSource: null, stats: { speed: 50, strength: 50 }, activeEffects: [] };
  const ctx = {
    renderer, canvas: { width: 640, height: 400 }, entity, machine: { state: 'Idle' }, sheathed: false, usingRightHand: true,
    castPlaying: false, spellArmed: false, thirdPerson: false, climbing: false, swimming: false, transformedLycanthrope: false,
    motion: { grounded: true, standing: true, speedRatio: 1, baseSpeed: 1, localVel: [0, 0, 0] }, look: [0, 0], swingHeld: false, cursorActive: false,
    camera: () => ({ pos: [0, 1.7, 0], feet: [0, 0, 0], yaw: 0, pitch: 0, forward: [0, 0, 1], right: [1, 0, 0], up: [0, 1, 0] }),
    collider: () => null, keyDown: () => false, sheathWeapons: () => {},
  };
  return { h, ctx, frame: () => { h.update(0.016, ctx); h.lateUpdate(0.016, ctx); } };
}

// a 1x2 picture as every PNG-shaped door decodes it: TOP row first
const TOP_FIRST = { width: 1, height: 2, data: new Uint8Array([255, 0, 0, 255, 0, 0, 255, 255]) };
const BOTTOM_UP = [0, 0, 255, 255, 255, 0, 0, 255];   // what the GL must receive

test('TEX1 the crash, executed: the torch door\'s answer goes into the REAL uploadTexture - the path that died on Mac\'s machine, now uploading the picture bottom-up instead of throwing', async () => {
  const { r, since } = stubRenderer();
  const rig = torchRig(r, async (record, frame) => (record === 0 && frame < 2 ? toColor32(TOP_FIRST) : null));
  rig.frame();
  await rig.h._w.texturesLoading;
  assert.equal(rig.h._w.textures.length, 2, 'both frames uploaded, no throw');
  assert.equal(since().length, 2);
  for (const up of since()) {
    assert.deepEqual([up.width, up.height], [1, 2]);
    assert.deepEqual([...up.pixels], BOTTOM_UP, 'row 0 of the buffer is the picture\'s BOTTOM row');
  }
  assert.deepEqual(rig.h._w.textures.map((t) => [t.width, t.height]), [[1, 2], [1, 2]]);
});

test('TEX1 the unhandled rejection, executed: a door that answers the OLD shape can no longer take the page down - the load warns, the mod draws nothing, and the promise RESOLVES', async () => {
  const { r, since } = stubRenderer();
  const rig = torchRig(r, async (record, frame) => (record === 0 && frame < 2 ? toColor32Order(TOP_FIRST) : null));   // a decoded PNG's { data }
  const { lines } = await withWarn(async () => {
    rig.frame();
    // THE POINT: this await must not reject. Before TEX1 the throw inside
    // `w.texturesLoading` escaped to main.js's unhandledrejection handler,
    // which is the CRASH overlay Mac photographed.
    await assert.doesNotReject(() => rig.h._w.texturesLoading);
  });
  assert.equal(since().length, 0, 'nothing reached the GL');
  assert.deepEqual(rig.h._w.textures, [], 'and the mod runs without its sprites, as it does when the files are missing');
  assert.equal(rig.h._w.currentTexture, null);
  assert.equal(lines.length, 1, 'one console line, not a dead page');
  assert.match(lines[0], /\[handheld torches\] the sprites would not load/);
  assert.match(lines[0], /carries no `colors`/, 'and it names the fault: the upload path\'s own sentence');
  assert.match(lines[0], /uploadTexture\(img, ht:/, 'with the caller and the texture key');
});

test('TEX1 every door converts at the door: no module under src/ imports toColor32Order, so the shape cannot be got wrong again', () => {
  const walk = (dir) => readdirSync(join(root, dir), { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : e.name.endsWith('.js') ? [join(dir, e.name)] : []));
  const importers = walk('src').filter((f) => f !== 'src/formats/color32Order.js' && /import[^;]*\btoColor32Order\b[^;]*from/.test(rd(f)));
  assert.deepEqual(importers, [], 'the flip-only conversion has ONE home and no importers - every door takes toColor32');
  // ...and each door is there, converting, by name
  // HT3: the two SCREEN sprites keep their rows (toScreenOrder); their
  // world neighbours still flip. Both are the same SHAPE, which is what
  // TEX1 is about - what changed is which way up, not what it answers.
  assert.match(rd('src/systems/handheldTorches.js'), /return toScreenOrder\(await decodePng\(bytes\)\);/, 'handheld torches (the crash), rows kept');
  assert.match(rd('src/scenes/droppedTorches.js'), /return toColor32\(await decodePng\(new Uint8Array\(await res\.arrayBuffer\(\)\)\)\);/, 'dropped torches');
  assert.match(rd('src/combat/weaponWidgetAssets.js'), /return toScreenOrder\(await decodePng\(bytes\)\);/, 'the weapon widget (WW3), rows kept');
  assert.match(rd('src/combat/weaponWidgetAssets.js'), /try \{ return toColor32\(tex\.rgba\(\)\); \}/, '...and its BUNDLE arm still flips, because Unity stores bottom-up');
  assert.match(rd('src/systems/seasonsIliacBayAssets.js'), /const image = toColor32\(await decode\(bytes\)\);/, 'seasons');
  assert.match(rd('src/systems/textureReplacement.js'), /toColor32\(await decode\(bytes\)\)/, 'M-TEX, which had it right all along');
  // the seasons re-wrap at the two upload sites is gone - H4's own law
  for (const host of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    assert.match(rd(host), /renderer\.uploadTexture\(archive, rkey, img, \{ mips: false, variant: '' \}\);/, `${host}: the door's answer, handed over whole`);
    assert.ok(!/colors: img\.data/.test(rd(host)), `${host}: no re-wrap at the site`);
  }
  // the contract each torch door documents is the one it answers
  assert.match(rd('src/systems/handheldTorches.js'), /loadSprite\(record, frame\) -> Promise<\{width, height, colors\} \| null>/);
  assert.match(rd('src/systems/seasonsIliacBayAssets.js'), /`\{ width, height, colors \}` RGBA in getColor32 \(bottom-up\) order/);
});

test('TEX1 neither torch load can escape again: both catch, and the dropped-torch record fails EMPTY so the draw no-ops', () => {
  const ht = rd('src/systems/handheldTorches.js');
  assert.match(ht, /\}\)\(\)\.catch\(\(e\) => console\.warn\('\[handheld torches\] the sprites would not load', e\)\);/, 'the promise nothing awaits cannot reject');
  const dt = rd('src/scenes/droppedTorches.js');
  assert.match(dt, /try \{\s*\n\s*for \(let f = 0; f < 16; f\+\+\) \{/, 'the upload loop is guarded');
  assert.match(dt, /\} catch \(e\) \{\s*\n\s*console\.warn\('\[dropped torches\] the sprites would not load', e\);\s*\n\s*\}\s*\n\s*const entry = \{ count, size \};/, 'and still records an entry - count 0');
  assert.match(dt, /if \(d\.dead \|\| !entry\?\.count \|\| !renderer\?\.createBillboardBatch\) return;/, 'which build already no-ops on');
});

test('TEX1 records: the arc note on both torch pages, the ledger row, the WW3 correction and the testing row', () => {
  assert.match(rd('bible/06-Systems/Handheld-Torches.md'), /^## TEX1 - THE SPRITE DOOR'S SHAPE, AND MAC'S CRASH \(2026-09-14\)/m);
  assert.match(rd('bible/01-Overview/Port-Ledger.md'), /\*\*ONE SHAPE FOR EVERY TEXTURE DOOR \(TEX1, 2026-09-14\)\*\*/);
  // WW3's record said the crash was the widget's; it was the torches'. Corrected in place.
  assert.match(rd('bible/05-Combat/Weapon-Widget.md'), /the crash itself was HANDHELD TORCHES'/);
  assert.match(rd('bible/09-Testing/Testing.md'), /^\| tex1_texturedoors\.test\.js \| \d+ \| TEX1/m);
});

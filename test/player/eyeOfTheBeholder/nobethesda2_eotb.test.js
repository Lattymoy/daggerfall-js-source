// NO-BETHESDA2 (2026-10-31, the owner: "ensuring they are not implemented"): EYE OF THE BEHOLDER'S DAGGERFALL PICTURES,
// REBUILT. 2869 of the mod's 3035 sprites are TEXTURE records exactly (tools/classicDerive.mjs). They are carried as
// specs (vendor/eye-of-the-beholder/derived.json) and built from the player's ARENA2 (eotbSprite.js); the author's own
// 166 stay files. Pinned on TEXTURE files and palettes made here, so CI needs no ARENA2. The last pin builds every spec
// from the real data when ARENA2_PATH is set.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, basename } from 'node:path';

import {
  derivedSpriteUrl, isDerivedSprite, derivedSpriteSpec, eotbSpriteUrl, spriteCount, decodeSprite, buildDerivedSprite,
  worldOrderColors, spriteFor, lookedPixels, riderSpareOf,
} from '../../../src/player/eyeOfTheBeholder/eotbSprite.js';
import { createEotbBody } from '../../../src/player/eyeOfTheBeholder/eotbBody.js';
import { createEotbArt } from '../../../src/net/peer/peerRiders.js';
import { spriteBodyOf } from '../../../src/ui/profileBody.js';
import { skinCard, derivedImageUrl } from '../../../src/ui/skinCard.js';
import { RIDER_MASKS } from '../../../src/player/eyeOfTheBeholder/eotbRiderMasks.js';
import { keepOnlyInMemory } from '../../../src/scenes/dataSource.js';
import { classicRecordRgba } from '../../../src/formats/derivedTexture.js';
import { createClassicPictures } from '../../../src/formats/classicPictures.js';
import { TextureFile } from '../../../src/formats/textureFile.js';
import { DFPalette } from '../../../src/formats/dfPalette.js';
import { horseLookCode } from '../../../src/systems/horse/horseCoats.js';
import { setModSetting, _resetModSettings } from '../../../src/systems/modSettings.js';
import { EOTB_DERIVED, eotbHas } from '../../../tools/lib/eotbPictures.mjs';

const ROOT = new URL('../../../', import.meta.url).pathname;
const DIR = join(ROOT, 'vendor/eye-of-the-beholder');
const MANIFEST = JSON.parse(readFileSync(join(DIR, 'eyeofthebeholder.dfmod.json'), 'utf8')).Files
  .filter((f) => /\.png$/i.test(f)).map((f) => basename(f).replace(/\.png$/i, ''));
const FILES = readdirSync(join(DIR, 'Textures'), { recursive: true }).filter((n) => /\.png$/i.test(n)).map((n) => basename(n).replace(/\.png$/i, ''));
const SPECS = Object.keys(EOTB_DERIVED);

test('NO-BETHESDA2: every picture the mod names is a file or a spec - never both, never neither - and nothing else stands there', () => {
  assert.equal(MANIFEST.length, 3035, 'the bundle ships 3035 sprites');
  assert.equal(SPECS.length, 2869, 'the ones that are Daggerfall\'s own records, rebuilt');
  assert.equal(FILES.length, 166, 'the author\'s own, carried');
  const files = new Set(FILES), specs = new Set(SPECS), named = new Set(MANIFEST);
  assert.deepEqual(MANIFEST.filter((n) => files.has(n) && specs.has(n)), [], 'never both');
  assert.deepEqual(MANIFEST.filter((n) => !files.has(n) && !specs.has(n)), [], 'never neither');
  assert.deepEqual([...files, ...specs].filter((n) => !named.has(n)), [], 'and nothing the bundle never shipped');
  for (const [k, s] of Object.entries(EOTB_DERIVED)) {
    assert.ok(Array.isArray(s.from) && s.from.length === 3 && s.from.every(Number.isInteger), `${k}: [archive, record, frame]`);
    assert.ok(['PAL.PAL', 'ART_PAL.COL'].includes(s.pal), `${k}: the palette its copy was drawn in`);
  }
  assert.equal(eotbHas('112364_0-0'), true, 'a spec');
  assert.equal(eotbHas('112364_10-0'), true, 'a file');
  assert.equal(eotbHas('112364_0-1'), false, 'the idle has no second frame');
});

test('NO-BETHESDA2: a derived key\'s URL is a marker naming its spec; in node, as the glob, the specs are not taken', () => {
  assert.equal(derivedSpriteUrl('112364_0-0'), 'DF:112364_0-0');
  assert.equal(isDerivedSprite('DF:112364_0-0'), true);
  assert.equal(isDerivedSprite('/assets/112364_10-0.png'), false);
  assert.deepEqual(derivedSpriteSpec('DF:112364_0-0'), EOTB_DERIVED['112364_0-0']);
  assert.equal(derivedSpriteUrl('112364_10-0'), null, 'an author\'s own file is a file');
  assert.equal(derivedSpriteUrl('LA:male:x:15-0:lll'), null);
  assert.equal(eotbSpriteUrl('112364_0-0'), null, 'node: no glob, no specs');
  assert.equal(spriteCount(), 0);
});

test('NO-BETHESDA2: a derived key decodes through the build path - its spec built, the rows turned to the world\'s order; a build that fails rejects', async () => {
  const asked = [];
  const top = new Uint8Array([1, 2, 3, 255, 4, 5, 6, 255, 7, 8, 9, 255, 10, 11, 12, 0]);   // 2x2, top row first
  const build = async (spec) => { asked.push(spec); return { width: 2, height: 2, data: top.slice() }; };
  const px = await decodeSprite('DF:112382_0-0', { build });
  assert.deepEqual(asked, [EOTB_DERIVED['112382_0-0']], 'the spec derived.json names');
  assert.equal(px.width, 2); assert.equal(px.height, 2);
  assert.deepEqual([...px.colors], [...worldOrderColors({ width: 2, height: 2, data: top }).colors], 'bottom row first, as a decoded PNG');
  await assert.rejects(decodeSprite('DF:112382_0-0', { build: async () => { throw new Error('TEXTURE.495: missing'); } }), /missing/);
  await assert.rejects(decodeSprite('DF:999_0-0', { build }), /no spec/);
});

test('NO-BETHESDA2: the builds are paced - a few milliseconds a task - and one that fails costs only itself', async () => {
  const spin = (ms) => { const t = performance.now(); while (performance.now() - t < ms); };
  let done = 0, seenByTimer = -1;
  const build = async (spec) => { spin(2); if (spec.from[1] === 3) throw new Error('bad'); done++; return { width: 1, height: 1, data: new Uint8Array(4) }; };
  setTimeout(() => { seenByTimer = done; }, 0);
  const keys = SPECS.filter((k) => k.startsWith('112364_')).slice(0, 20);
  const all = await Promise.allSettled(keys.map((k) => buildDerivedSprite(`DF:${k}`, build)));
  assert.ok(seenByTimer >= 0 && seenByTimer < keys.length, `a task ran between the builds (${seenByTimer} of ${keys.length} done by then)`);
  const failed = keys.filter((k, i) => all[i].status === 'rejected');
  assert.deepEqual(failed, keys.filter((k) => EOTB_DERIVED[k].from[1] === 3));
});

// ── the real reader, end to end, on made-up ARENA2 files in the data source's memory ─────────────────────────────────
/** A TEXTURE file of `n` single-frame uncompressed records, each `w`x`h`, rows on the format's 256-byte stride. */
function textureFile(n, w, h, pixel) {
  const at = [];
  let size = 26 + 20 * n;
  for (let r = 0; r < n; r++) { at.push(size); size += 28 + 256 * h; }
  const bytes = new Uint8Array(size), v = new DataView(bytes.buffer);
  v.setInt16(0, n, true);
  for (let r = 0; r < n; r++) {
    v.setInt32(26 + 20 * r + 2, at[r], true);
    v.setInt16(at[r] + 4, w, true); v.setInt16(at[r] + 6, h, true);
    v.setUint32(at[r] + 14, 28, true);
    v.setUint16(at[r] + 20, 1, true);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) bytes[at[r] + 28 + y * 256 + x] = pixel(r, x, y);
  }
  return bytes;
}
const paletteBytes = (k) => { const b = new Uint8Array(768); for (let i = 1; i < 256; i++) { b[i * 3] = i; b[i * 3 + 1] = (i * k) & 255; b[i * 3 + 2] = 255 - i; } return b; };
const W = 6, H = 9;
const FAKE = {
  'TEXTURE.481': textureFile(20, W, H, (r, x, y) => (x === 0 ? 0 : 1 + ((r * 13 + x * 7 + y * 3) % 250))),
  'PAL.PAL': paletteBytes(5),
  'ART_PAL.COL': paletteBytes(3),
};
for (const [name, bytes] of Object.entries(FAKE)) keepOnlyInMemory(name, bytes);
/** What the build should draw for `key`: its record in its palette, on the world's rows. */
function expected(key) {
  const { from: [a, r, f], pal } = EOTB_DERIVED[key];
  const t = new TextureFile(); t.load(FAKE[`TEXTURE.${a}`], `TEXTURE.${a}`, null);
  const p = new DFPalette(); p.load(FAKE[pal], pal);
  return worldOrderColors(classicRecordRgba(t.getDFBitmap(r, f), p));
}
const renderer = () => ({
  uploads: [],
  uploadTexture(archive, rec, img) { this.uploads.push({ archive, rec, img }); },
  createBillboardBatch(archive, rec, size) { return { archive, rec, size, origin: [0, 0, 0] }; },
  destroyBillboardBatch() {}, drawBillboards() {},
});
const settle = () => new Promise((res) => setTimeout(res, 30));
/** Waits, a tick at a time, until `fn` answers something (two seconds at most). */
async function until(fn) {
  for (let t = 0; t < 200; t++) { const v = fn(); if (v) return v; await new Promise((res) => setTimeout(res, 10)); }
  return fn();
}

test('NO-BETHESDA2: the session\'s reader draws a derived sprite from the player\'s own files - in the palette its spec names, for the body, the peers and the profile', async () => {
  _resetModSettings();
  setModSetting('eye-of-the-beholder', 'Graphics.LayeredGear', 0);   // the mod's own sets, not Layered Gearing
  assert.equal(EOTB_DERIVED['112364_0-0'].pal, 'ART_PAL.COL'); assert.equal(EOTB_DERIVED['112364_1-0'].pal, 'PAL.PAL');
  for (const key of ['112364_0-0', '112364_1-0']) {
    const px = await decodeSprite(`DF:${key}`);
    assert.deepEqual([px.width, px.height], [W, H]);
    assert.deepEqual([...px.colors], [...expected(key).colors], `${key}: the record, in ${EOTB_DERIVED[key].pal}`);
  }
  const front = spriteFor('Idle', 0, 0, { onFoot: 0 });
  assert.equal(front.key, '112364_0-0');
  // the peers' store, its own decode
  const pr = renderer(), art = createEotbArt({ renderer: pr, urlFor: derivedSpriteUrl });
  assert.equal(art.ensure(front), null, 'asked');
  const got = await until(() => art.ensure(front));
  assert.deepEqual(got && [got.w, got.h], [W, H], 'up');
  assert.deepEqual([...pr.uploads[0].img.colors], [...expected('112364_0-0').colors]);
  // the body's preload, its own decode
  const br = renderer(), body = createEotbBody({ count: () => 1, urlFor: derivedSpriteUrl });
  body.attach(br, () => ({}));
  const up = await until(() => br.uploads.find((u) => u.archive === 112364 && u.rec === '0-0'));
  assert.ok(up, 'the body uploaded the idle\'s front');
  assert.deepEqual([...up.img.colors], [...expected('112364_0-0').colors]);
  // the profile's stage
  const staged = await spriteBodyOf({ onFoot: 0 }, { urlOf: derivedSpriteUrl });
  assert.deepEqual([staged.width, staged.height, staged.key], [W, H, '112364_0-0']);
  assert.deepEqual([...staged.colors], [...expected('112364_0-0').colors]);
  _resetModSettings();
});

test('NO-BETHESDA2: the skin card draws a derived tile from the built picture, made an image URL once a key; a file\'s URL is its own at once', async () => {
  const el = (tag) => { const n = { tag, children: [], className: '', attrs: {}, src: '', textContent: '', append(...cs) { n.children.push(...cs); }, setAttribute(k, v) { n.attrs[k] = v; } }; return n; };
  const imgs = (n, out = []) => { if (n.tag === 'img') out.push(n); for (const c of n.children) imgs(c, out); return out; };
  let encoded = 0;
  const encode = async (img) => { encoded++; return `blob:${img.width}x${img.height}`; };
  const sets = () => ({ foot: [{ index: 0, name: 'A', key: '112364_0-0', url: 'DF:112364_0-0' }], horse: [{ index: 0, name: 'B', key: 'k', url: '/assets/k.png' }], layered: [] });
  _resetModSettings();
  setModSetting('eye-of-the-beholder', 'Graphics.LayeredGear', 0);
  const card = skinCard({ createElement: el }, { sets, imageUrl: (u) => derivedImageUrl(u, { encode }) });
  const [foot, horse] = imgs(card.root);
  assert.equal(horse.src, '/assets/k.png', 'a file at once');
  assert.equal(foot.src, '', 'a derived picture a moment later');
  assert.equal(await until(() => foot.src), `blob:${W}x${H}`);
  card.paint();
  await settle();
  assert.equal(imgs(card.root)[0].src, `blob:${W}x${H}`);
  assert.equal(encoded, 1, 'made once, whatever the repaints');
  _resetModSettings();
});

test('NO-BETHESDA2: a derived mounted picture keeps its rider spared - the masks are keyed by the sprite, not its URL', async () => {
  const [w, h] = RIDER_MASKS['112382_0-0'].split(':')[0].split('x').map(Number);
  const data = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) data.set([139, 90, 43, 255], i * 4);   // a bay's warm, everywhere
  const img = await decodeSprite('DF:112382_0-0', { build: async () => ({ width: w, height: h, data }) });
  const s = spriteFor('IdleHorse', 0, 0, { onHorse: 0, horse: horseLookCode({ coat: 3, pattern: 0, legs: 0, seed: 1 }) });
  assert.equal(s.key, '112382_0-0');
  const spare = riderSpareOf(RIDER_MASKS, s.key, img.width, img.height);
  assert.ok(spare && spare.some(Boolean), 'the mask holds this picture at the size it is built');
  const dyed = lookedPixels(s, img, RIDER_MASKS).colors, was = img.colors;
  const view = new Uint32Array(dyed.buffer, dyed.byteOffset, w * h);
  const moved = [...spare.keys()].filter((i) => spare[i] && view[i] !== was[i]);
  assert.deepEqual(moved, [], 'not one of his pixels dyed');
  assert.ok([...spare.keys()].some((i) => !spare[i] && view[i] !== was[i]), 'and the horse\'s were');
});

test('NO-BETHESDA2: every spec builds from the player\'s own TEXTURE file, at the spec\'s size or its record\'s; every mounted picture at its rider mask\'s', { skip: !process.env.ARENA2_PATH && 'ARENA2_PATH not set' }, async () => {
  const A2 = /** @type {string} */ (process.env.ARENA2_PATH);
  const cp = createClassicPictures(async (name) => readFileSync(join(A2, name)));
  const sizes = new Map();
  for (const [key, spec] of Object.entries(EOTB_DERIVED)) {
    const rec = await cp.picture(spec.from[0], spec.from[1], spec.from[2], spec.pal);
    assert.ok(rec, `${key}: TEXTURE.${spec.from[0]} record ${spec.from[1]} frame ${spec.from[2]} is in the player's data`);
    const built = await cp.build(spec);
    assert.deepEqual([built.width, built.height], spec.size ?? [rec.width, rec.height], key);
    let drawn = 0;
    for (let i = 3; i < built.data.length; i += 4) if (built.data[i]) drawn++;
    assert.ok(drawn > 0, `${key}: something drawn`);
    sizes.set(key, `${built.width}x${built.height}`);
  }
  for (const [key, m] of Object.entries(RIDER_MASKS)) assert.equal(sizes.get(key), m.split(':')[0], `${key}: the rider mask is the built picture's`);
});

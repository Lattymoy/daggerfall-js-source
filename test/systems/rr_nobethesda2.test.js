// NO-BETHESDA2 (2026-10-31; the owner: "ensuring they are not implemented"): the Roleplay & Realism pictures that are
// Daggerfall's own records are built from the player's ARENA2 by their specs, never carried. CI has no ARENA2, so the
// wiring is pinned with a fake reader. With ARENA2_PATH every spec is built and held to the pictures the mods shipped,
// by a digest of their RGBA taken before the files left the tree.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClassicPictures } from '../../src/formats/classicPictures.js';
import { setTextureDeriveContext, textureDeriveContext, clearVendorTextures, preloadTextureRecord, decodedTextureTopDown } from '../../src/systems/textureReplacement.js';
import { installRoleplayRealismItems, _resetRoleplayRealismItems, rriDerivedSpecs, rriDerivedPicture } from '../../src/systems/roleplayRealismItems/rriInstall.js';
import { RRI_SPRITES, RRI_DERIVED } from '../../src/systems/roleplayRealismItems/rriIndex.js';
import { installRoleplayRealismArt, _resetRoleplayRealismArt, RR_DERIVED, RR_BUTTON_RECORDS } from '../../src/systems/roleplayRealism/rrVariants.js';
import { drawMessageBox, registerButtonArt, _setMessageBoxArtForTests } from '../../src/ui/messageBox.js';
import { setModSetting, _resetModSettings } from '../../src/systems/modSettings.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const rd = (p) => readFileSync(join(ROOT, p), 'utf8');
const ARENA2 = process.env.ARENA2_PATH;

/** A fake classic reader: every spec it is asked to build, and one picture for all. */
function fakeArt() {
  const asked = [];
  const pic = { width: 3, height: 2, data: Uint8Array.from({ length: 24 }, (_, i) => (i % 4 === 3 ? 255 : i * 10)) };
  return { asked, pic, art: { build: async (spec) => { asked.push(spec); return pic; } } };
}
/** The door builds only while a pipeline is up; its own context must never be the one asked. */
async function withDeriveContext(fn) {
  const prior = textureDeriveContext();
  setTextureDeriveContext({ classicRgba: async () => { throw new Error('the door\'s ART_PAL context was asked'); } });
  try { await fn(); } finally { setTextureDeriveContext(prior); }
}

test('NO-BETHESDA2 RRI: a derived sprite is built from its spec through the classic reader and never fetched; a file is still fetched', async () => {
  _resetModSettings(); clearVendorTextures(); _resetRoleplayRealismItems();
  const fetched = [];
  const { asked, pic, art } = fakeArt();
  try {
    await withDeriveContext(async () => {
      assert.equal(installRoleplayRealismItems({ fetchBytes: async (n) => { fetched.push(n); return new Uint8Array([1]); }, art }), 280);
      const specs = await rriDerivedSpecs();
      assert.deepEqual(Object.keys(specs), [...RRI_DERIVED], 'the lazy listing is the one the index names');
      assert.ok(await preloadTextureRecord(522, 10, 0, 'Mask', null), 'the helmet mask answers');
      assert.deepEqual(asked, [specs['522_10-0_Mask']], 'built from its own spec');
      const got = decodedTextureTopDown(522, 10, 0, 'Mask', null);
      assert.deepEqual([got.width, got.height, [...got.rgba]], [3, 2, [...pic.data]], 'the built picture is what the door draws');
      assert.deepEqual(fetched, [], 'no file is asked for a derived picture');
      assert.ok(await preloadTextureRecord(522, 10, 0, 'Albedo', null, { decode: async () => pic }));
      assert.deepEqual(fetched, ['522_10-0'], 'the authors\' own helmet is still a file');
      await assert.rejects(rriDerivedPicture('522_10-0', art), /no spec/, 'a file\'s name has no spec');
    });
  } finally { clearVendorTextures(); _resetRoleplayRealismItems(); _resetModSettings(); }
});

test('NO-BETHESDA2 RR: 197_4-0, 197_5-0 and the seventeen buttons are built through the classic reader; the authors\' five are fetched', async () => {
  _resetModSettings(); clearVendorTextures(); _resetRoleplayRealismArt();
  setModSetting('roleplay-realism', 'variantNpcs', true);
  setModSetting('roleplay-realism', 'RefinedTraining.refinedTraining', true);
  const fetched = [], uploads = [];
  const { asked, pic, art } = fakeArt();
  try {
    await withDeriveContext(async () => {
      assert.equal(installRoleplayRealismArt({ fetchBytes: async (n) => { fetched.push(n); return new Uint8Array([1]); }, art }), 7);
      for (const r of [4, 5]) assert.ok(await preloadTextureRecord(197, r), `197_${r}-0`);
      assert.deepEqual(asked, [RR_DERIVED['197_4-0'], RR_DERIVED['197_5-0']]);
      assert.ok(await preloadTextureRecord(197, 0, 0, 'Albedo', null, { decode: async () => pic }));
      assert.deepEqual(fetched, ['197_0-0'], 'only the authors\' own keeper is a file');
      // the training window's button: the message box uploads the built picture, never a fetched one
      const renderer = { drawScreenQuad() {}, setScreenScissor() {}, clearScreenScissor() {}, uploadTexture: (kind, key, c) => { uploads.push({ key, ...c }); return `tex:${key}`; } };
      _setMessageBoxArtForTests({ slices: Array(9).fill('slice'), buttons: new Map(), renderer });
      const box = { x: 0, y: 0, w: 66, h: 66, textW: 0, rows: [], buttons: [{ button: 21, rect: [0, 0, 32, 16] }] };
      drawMessageBox(renderer, { ox: 0, oy: 0, s: 1 }, { fnt: {} }, box);
      for (let i = 0; i < 20 && !uploads.length; i++) await new Promise((r) => setTimeout(r, 0));
      assert.deepEqual(asked.at(-1), RR_DERIVED['BUTTONS.RCI_21-0']);
      assert.equal(uploads.length, 1);
      assert.deepEqual([uploads[0].key, uploads[0].width, uploads[0].height], ['buttons:21', 3, 2]);
      assert.deepEqual([...new Uint8Array(uploads[0].colors.buffer, 0, 24)], [...pic.data], 'the built picture is the button');
      assert.deepEqual(fetched, ['197_0-0']);
      assert.ok(RR_BUTTON_RECORDS.every((r) => RR_DERIVED[`BUTTONS.RCI_${r}-0`]?.rci === 'BUTTONS.RCI'), 'every button is a BUTTONS.RCI record\'s spec');
    });
  } finally {
    _setMessageBoxArtForTests(null);
    for (const r of RR_BUTTON_RECORDS) registerButtonArt(r, null);
    clearVendorTextures(); _resetRoleplayRealismArt(); _resetModSettings();
  }
});

/** A picture's RGBA with every clear pixel zeroed (the colour under a cutout never draws), by its size. */
const digestOf = (p) => {
  const d = Buffer.from(p.data);
  for (let i = 0; i < d.length; i += 4) if (!d[i + 3]) d.fill(0, i, i + 4);
  return `${p.width}x${p.height}:${createHash('sha256').update(d).digest('hex')}`;
};
/** Taken from the mods' own PNGs (HEAD before NO-BETHESDA2) - and the rebuilt pictures gave the same. */
const SHIPPED = {
  'vendor/roleplay-realism/derived-art.json': 'ddac68c744cfdcfac860c3bece88a919ec765c86f5b247c09bbe7fb610395be6',
  'vendor/roleplay-realism-items/derived-art.json': '20163f43fef9ab321c186359aa95d8e8ec622cc3304d2c4f69c9d63d355c3136',
};

test('NO-BETHESDA2 with ARENA2: every spec builds at its picture\'s size, and the pictures are the ones the mods shipped', { skip: !ARENA2 && 'ARENA2_PATH not set' }, async () => {
  const art = createClassicPictures(async (n) => readFileSync(join(ARENA2, n)));
  for (const [listing, digest] of Object.entries(SHIPPED)) {
    const specs = JSON.parse(rd(listing));
    const h = createHash('sha256');
    for (const name of Object.keys(specs).sort()) {
      const p = RRI_SPRITES[name] ? await rriDerivedPicture(name, art) : await art.build(specs[name]);
      if (RRI_SPRITES[name]) assert.deepEqual([p.width, p.height], RRI_SPRITES[name].slice(0, 2), name);
      if (name.startsWith('BUTTONS.RCI_')) assert.deepEqual([p.width, p.height], [32, 16], name);
      h.update(`${name}=${digestOf(p)}\n`);
    }
    assert.equal(h.digest('hex'), digest, `${listing}: rebuilt from ARENA2, the pictures are the mod's own copies exactly`);
  }
});

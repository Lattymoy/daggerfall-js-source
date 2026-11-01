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
import { installRoleplayRealismItems, _resetRoleplayRealismItems } from '../../src/systems/roleplayRealismItems/rriInstall.js';
import { RRI_SPRITES } from '../../src/systems/roleplayRealismItems/rriIndex.js';
import { DYE_COLORS } from '../../src/characters/dyes.js';
import { installRoleplayRealismArt, _resetRoleplayRealismArt, RR_DERIVED, RR_BUTTON_RECORDS } from '../../src/systems/roleplayRealism/rrVariants.js';
import { rrWeekButtonPicture } from '../../src/systems/roleplayRealism/rrKeeperArt.js';   // OWN-WORK4: our week button
import { drawMessageBox, registerButtonArt, _setMessageBoxArtForTests } from '../../src/ui/messageBox.js';
import { setModSetting, _resetModSettings } from '../../src/systems/modSettings.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const rd = (p) => readFileSync(join(ROOT, p), 'utf8');
const ARENA2 = process.env.ARENA2_PATH;

/** A fake classic reader: every spec it is asked to build, and one picture for all. */
function fakeArt() {
  const asked = [];
  const pic = { width: 3, height: 2, data: Uint8Array.from({ length: 24 }, (_, i) => (i % 4 === 3 ? 255 : i * 10)) };
  // OWN-WORK4 AUDIT: the keepers read the player's records as palette indices - a made-up person, 20 x 40
  const person = { width: 20, height: 40, data: new Uint8Array(800).fill(0x72) };
  return { asked, pic, art: { build: async (spec) => { asked.push(spec); return pic; }, bitmap: async () => person, palette: async () => ({ get: (i) => ({ r: i, g: i, b: i }) }) } };
}
/** The door builds only while a pipeline is up; its own context must never be the one asked. */
async function withDeriveContext(fn) {
  const prior = textureDeriveContext();
  setTextureDeriveContext({ classicRgba: async () => { throw new Error('the door\'s ART_PAL context was asked'); } });
  try { await fn(); } finally { setTextureDeriveContext(prior); }
}

test('NO-BETHESDA2 RRI, OWN-WORK4: all 280 pictures are ours, built over their classic records - the helmet\'s masks and the Dwarven helmets too; no derived spec is built and nothing is fetched', async () => {
  _resetModSettings(); clearVendorTextures(); _resetRoleplayRealismItems();
  const fetched = [], pictured = [];
  const { asked, pic, art } = fakeArt();
  const ownArt = { ...art, picture: async (archive, record) => { pictured.push(`${archive}_${record}`); return pic; } };
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url) => { fetched.push(String(url)); throw new Error('no fetch in this pin'); };
  try {
    await withDeriveContext(async () => {
      assert.equal(installRoleplayRealismItems({ art: ownArt }), 280);
      assert.ok(await preloadTextureRecord(522, 10, 0, 'Mask', null), 'the helmet mask answers');
      assert.ok(await preloadTextureRecord(522, 10, 0, 'Albedo', null));
      assert.ok(await preloadTextureRecord(522, 10, 0, 'Albedo', DYE_COLORS.Dwarven));
      assert.deepEqual(pictured, ['245_27', '245_27', '245_27'], 'the mask, the cap and the Dwarven cap: ours, over the classic helm');
      assert.equal(decodedTextureTopDown(522, 10, 0, 'Albedo', DYE_COLORS.Dwarven).width, RRI_SPRITES['522_10-0_Dwarven'][0], 'at the picture\'s own size');
      assert.deepEqual(asked, [], 'no derived spec is built');
      assert.deepEqual(fetched, [], 'no file is asked');
    });
  } finally { globalThis.fetch = realFetch; clearVendorTextures(); _resetRoleplayRealismItems(); _resetModSettings(); }
});

test('NO-BETHESDA2 RR: 197_4-0 is built through the classic reader; OWN-WORK4: the week button is painted and (AUDIT) our six keepers are put together from the player\'s own people, nothing is fetched', async () => {
  _resetModSettings(); clearVendorTextures(); _resetRoleplayRealismArt();
  setModSetting('roleplay-realism', 'variantNpcs', true);
  setModSetting('roleplay-realism', 'RefinedTraining.refinedTraining', true);
  const fetched = [], uploads = [];
  const { asked, art } = fakeArt();
  try {
    await withDeriveContext(async () => {
      const realFetch = globalThis.fetch;
      globalThis.fetch = async (u) => { fetched.push(String(u)); throw new Error('no fetch'); };
      try {
        assert.equal(installRoleplayRealismArt({ art }), 7);
        for (const r of [4, 5]) assert.ok(await preloadTextureRecord(197, r), `197_${r}-0`);
        assert.deepEqual(asked, [RR_DERIVED['197_4-0']], 'only the edit-free spec is built; 197_5-0 is ours (it carried the author\'s paint)');
        assert.equal(decodedTextureTopDown(197, 5, 0, 'Albedo', null).width, 67, 'our keeper at the 182_1 keeper\'s aspect, Daggerfall\'s own height');
        assert.ok(await preloadTextureRecord(197, 0, 0, 'Albedo', null, { decode: async () => assert.fail('our keeper is no file') }));
        assert.equal(decodedTextureTopDown(197, 0, 0, 'Albedo', null).width, 79, 'our keeper, at the classic keeper\'s aspect');
      } finally { globalThis.fetch = realFetch; }
      assert.deepEqual(fetched, [], 'nothing is a file');
      // the training window's button: the message box uploads our picture, never a fetched one
      const renderer = { drawScreenQuad() {}, setScreenScissor() {}, clearScreenScissor() {}, uploadTexture: (kind, key, c) => { uploads.push({ key, ...c }); return `tex:${key}`; } };
      _setMessageBoxArtForTests({ slices: Array(9).fill('slice'), buttons: new Map(), renderer });
      const box = { x: 0, y: 0, w: 66, h: 66, textW: 0, rows: [], buttons: [{ button: 21, rect: [0, 0, 32, 16] }] };
      drawMessageBox(renderer, { ox: 0, oy: 0, s: 1 }, { fnt: {} }, box);
      for (let i = 0; i < 20 && !uploads.length; i++) await new Promise((r) => setTimeout(r, 0));
      assert.equal(asked.length, 1, 'no button is built from a spec');
      assert.equal(uploads.length, 1);
      assert.deepEqual([uploads[0].key, uploads[0].width, uploads[0].height], ['buttons:21', 32, 16]);
      assert.deepEqual([...new Uint8Array(uploads[0].colors.buffer)], [...rrWeekButtonPicture().data], 'our week button is the button');
      assert.deepEqual(fetched, []);
      assert.ok(Object.keys(RR_DERIVED).every((n) => !n.startsWith('BUTTONS.RCI_')), 'no button spec: the relabelled ones carried the author\'s letters');
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
  'src/systems/roleplayRealism/rrDerivedArt.json': 'ab1479d4bc22f9b2a204176837efd1c0cc892116fc9d6a7aae0124f170183bd3',   // OWN-WORK4: 197_4-0 alone, the edit-free spec
};

test('NO-BETHESDA2 with ARENA2: every spec builds at its picture\'s size, and the pictures are the ones the mods shipped', { skip: !ARENA2 && 'ARENA2_PATH not set' }, async () => {
  const art = createClassicPictures(async (n) => readFileSync(join(ARENA2, n)));
  for (const [listing, digest] of Object.entries(SHIPPED)) {
    const specs = JSON.parse(rd(listing));
    const h = createHash('sha256');
    for (const name of Object.keys(specs).sort()) {
      const p = await art.build(specs[name]);
      if (name.startsWith('BUTTONS.RCI_')) assert.deepEqual([p.width, p.height], [32, 16], name);
      h.update(`${name}=${digestOf(p)}\n`);
    }
    assert.equal(h.digest('hex'), digest, `${listing}: rebuilt from ARENA2, the pictures are the mod's own copies exactly`);
  }
});

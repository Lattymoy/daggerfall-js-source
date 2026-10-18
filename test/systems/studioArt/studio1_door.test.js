// STUDIO1 (2026-10-17, bible/07-Rendering/Studio-Art.md, Mac of trashBattery's "a centralized location for you and I to
// put 2d art assets": "We need to build what trash is talking about"): THE STUDIO'S PICTURES REACH THE GAME.
//
//   D1  a picture's name: its artist (the first folder), what it replaces (DFU's name before any `--` label), refused
//       when it names nothing; one picture a key, the first path's
//   D2  the vendor tier: the studio's picture holds its key against art registered after it AND before it (a ship's
//       painted stand-in, through her real registration), taking what the archive is (a stand-in, an offset) from it;
//       worn with Replace Game Artwork off; a player's own loose pick still answers first
//   D3  the install: the listing read once, every picture registered, the port's own archives decoded at once (so a
//       host's door finds them synchronously) and Daggerfall's left to their archive's load; no listing, nothing - and
//       never a throw
//   D4  the rows: color32 order (the wagons' door) and top-down (the yards', the port's, the monument's)
//   D5  wearPainted: the painted picture with no studio picture, the studio's in its place, and - the install still on
//       its way - the painted one first and the studio's handed again, late, when it lands
//   D6  the doors: the caravan's room wears the studio's picture of the record each live record shows (built or a
//       paint's), through its real producer; and every host that paints its own goes through wearPainted in its rows
//
// The pictures are the test's own, written as PNG by tools/pngIO.mjs: no game data (Port-Doctrine).
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { writePng, readPng } from '../../../tools/pngIO.mjs';
import { setValue } from '../../../src/systems/settings/settings.js';
import {
  addVendorTextures, clearVendorTextures, clearTextureReplacements, setTextureReplacements, hasTextureReplacement,
  decodedTexture, preloadTextureArchive, isVendorArchive, vendorTextureStandIn, setTextureDeriveContext, setBundleTextures,
} from '../../../src/systems/textureReplacement.js';
import {
  studioFile, studioEntries, studioUrl, installStudioArt, paintedReplacement, wearPainted, studioLanded, studioWorn,
  _resetStudioArt, STUDIO_INDEX,
} from '../../../src/systems/studioArt/studioArt.js';
import { LAST_CLASSIC_TEXTURE_ARCHIVE } from '../../../src/formats/textureFile.js';
import { registerGalleonArt, _resetGalleonArt, GALLEON_ARCHIVE, TEX as GALLEON_TEX } from '../../../src/world/ships/galleonArt.js';
import { paintCaravanRoom, caravanRoomPictures } from '../../../src/scenes/caravanRoom.js';
import { WAGON_ARCHIVE, TEX as WAGON_TEX, lookRecord } from '../../../src/world/wagonArt.js';

const decode = async (bytes) => readPng(bytes);
/** A picture of the test's own: `w` x `h`, every texel `rgb`, its top row white (so the rows' order shows). */
function picture(w, h, rgb) {
  const data = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) { const top = i < w; data.set(top ? [255, 255, 255, 255] : [...rgb, 255], i * 4); }
  return writePng({ width: w, height: h, data });
}
/** A served studio: `files` path -> PNG bytes; the listing names `listed` (all of them unless said). `gate` holds every
 *  answer until it is opened (a slow network). Real Responses (AUDIT STUDIO1 E8 - TEST THE SHAPE THE PRODUCER MINTS): a
 *  miss is a page, not a missing method. */
function served(files, { listed = Object.keys(files), index = true, gate = null } = {}) {
  const asked = [];
  const fetch = async (url) => {
    asked.push(url);
    if (gate) await gate;
    if (url === studioUrl(STUDIO_INDEX) && index) return new Response(JSON.stringify({ studio: 1, files: listed }), { status: 200 });
    for (const [path, bytes] of Object.entries(files)) if (url === studioUrl(path)) return new Response(Uint8Array.from(bytes), { status: 200 });
    return new Response('<!doctype html>not here', { status: 404 });
  };
  return { fetch, asked };
}
function reset() {
  _resetStudioArt(); clearVendorTextures(); clearTextureReplacements(); setBundleTextures([]); _resetGalleonArt();
  setValue('Enhancements', 'AssetInjection', 'True');
  setTextureDeriveContext({ classicRgba: async () => null });   // a pipeline's, as the game's is up (her stand-ins are built through it)
}
const red = (c32) => [c32.colors[0], c32.colors[1], c32.colors[2]];

test('STUDIO1 D1: a picture\'s name - its artist, what it replaces before any `--` label, and nothing for a name that names nothing; one picture a key', () => {
  assert.deepEqual(studioFile('trashBattery/wagons/38181_1-0--cart-side.png'), {
    path: 'trashBattery/wagons/38181_1-0--cart-side.png', artist: 'trashBattery', label: 'cart-side',
    archive: 38181, record: 1, frame: 0, map: 'Albedo', dye: null, key: '38181_1-0',
  });
  const dyed = studioFile('Redclaw/233_5-0_Iron.png');
  assert.equal(dyed.key, '233_5-0_Iron');
  assert.equal(dyed.label, null);
  assert.equal(studioFile('Redclaw/003_5-2_Normal--a-wall.PNG').key, '3_5-2_Normal', 'the archive unpadded in the key, the map read, the extension any case');
  assert.equal(studioFile('Redclaw/38181_1-0--two--dashes.png').label, 'two--dashes', 'the label is everything after the first `--`');
  for (const bad of ['38181_1-0.png', 'a/38181_1-0--.png', 'a/../38181_1-0.png', 'a//38181_1-0.png', 'a/cart.png', 'a/38181_1-0.jpg', 'a/38181_1--0.png', '', null]) {
    assert.equal(studioFile(bad), null, `${bad} names nothing`);
  }
  const worn = studioEntries(['b/38181_1-0.png', 'a/38181_1-0--mine.png', 'a/nothing.png', 7, 'a/38181_2-0.png']);
  assert.deepEqual(worn.map((e) => e.path), ['a/38181_1-0--mine.png', 'a/38181_2-0.png'], 'the first path in order keeps a key; a name that names nothing is dropped');
});

test('STUDIO1 D2: the studio\'s picture holds its key on the vendor tier - over a ship\'s painted stand-in registered before it or after it (her real registration), taking what the archive is from it; worn with Replace Game Artwork off; a player\'s own pick answers first', async () => {
  reset();
  try {
    const deck = GALLEON_TEX.deck;
    const studio = [{ archive: GALLEON_ARCHIVE, record: deck, studio: true, fileName: 'studio:a/deck.png', load: async () => picture(4, 4, [200, 10, 10]) }];
    // the studio first, her stand-ins after: her registration does not take the key back, and makes the archive hers
    assert.equal(addVendorTextures(studio), 1);
    assert.equal(isVendorArchive(GALLEON_ARCHIVE), false, 'a studio picture alone says nothing of what the archive is');
    assert.ok(registerGalleonArt(addVendorTextures) > 0);
    assert.equal(isVendorArchive(GALLEON_ARCHIVE), true, 'her stand-ins make the archive a stand-in, the studio\'s key with them');
    await preloadTextureArchive(GALLEON_ARCHIVE, { decode });
    assert.deepEqual(red(decodedTexture(GALLEON_ARCHIVE, deck)), [200, 10, 10], 'her deck is the studio\'s');
    assert.notDeepEqual(red(decodedTexture(GALLEON_ARCHIVE, GALLEON_TEX.trim)), [200, 10, 10], 'her other pictures are her own');
    // AUDIT STUDIO1 A2: the stand-in answers the size of the picture the studio's covers (her painted 64), and hands the
    // studio's own texels at their own size
    assert.deepEqual(vendorTextureStandIn(GALLEON_ARCHIVE).getSize(deck), { width: 64, height: 64 }, 'the stand-in measures what the studio covers');
    assert.deepEqual(vendorTextureStandIn(GALLEON_ARCHIVE).getBox(deck), { width: 64, height: 64 });
    assert.equal(vendorTextureStandIn(GALLEON_ARCHIVE).getDFBitmap(deck).width, 4, '...and draws the studio\'s own picture');
    // her stand-ins first, the studio after: the studio's takes the key, and keeps the stand-in mark
    reset();
    registerGalleonArt(addVendorTextures);
    addVendorTextures([{ archive: GALLEON_ARCHIVE, record: GALLEON_TEX.trim, studio: true, fileName: 'studio:a/trim.png', load: async () => picture(4, 4, [10, 200, 10]) }]);
    await preloadTextureArchive(GALLEON_ARCHIVE, { decode });
    assert.deepEqual(red(decodedTexture(GALLEON_ARCHIVE, GALLEON_TEX.trim)), [10, 200, 10]);
    assert.equal(isVendorArchive(GALLEON_ARCHIVE), true, 'her archive still a stand-in, the studio\'s trim with it');
    // an offset (a worn stand-in's place on the doll) is taken from what is displaced or registered after
    addVendorTextures([{ archive: 560, record: 0, standIn: true, offset: { x: 3, y: 4 }, load: async () => picture(2, 2, [1, 2, 3]) }]);
    addVendorTextures([{ archive: 560, record: 0, studio: true, load: async () => picture(2, 2, [4, 5, 6]) }]);
    addVendorTextures([{ archive: 561, record: 0, studio: true, load: async () => picture(2, 2, [4, 5, 6]) }]);
    addVendorTextures([{ archive: 561, record: 0, standIn: true, offset: { x: 7, y: 8 }, load: async () => picture(2, 2, [1, 2, 3]) }]);
    assert.deepEqual(vendorTextureStandIn(560).getOffset(0), { x: 3, y: 4 });
    assert.equal(isVendorArchive(560), true, 'the studio\'s picture over the only stand-in of its archive keeps the archive a stand-in');
    assert.deepEqual(vendorTextureStandIn(561).getOffset(0), { x: 7, y: 8 });
    assert.equal(isVendorArchive(561), true);
    // the gate: the studio is the game's own art, worn with Replace Game Artwork off
    setValue('Enhancements', 'AssetInjection', 'False');
    assert.equal(hasTextureReplacement(GALLEON_ARCHIVE, GALLEON_TEX.trim), true);
    assert.deepEqual(red(decodedTexture(GALLEON_ARCHIVE, GALLEON_TEX.trim)), [10, 200, 10]);
    // AUDIT STUDIO1 D3: a texture mod a player attaches (the bundle tier) is drawn under it, Replace Game Artwork on
    setValue('Enhancements', 'AssetInjection', 'True');
    setBundleTextures([{ archive: GALLEON_ARCHIVE, record: GALLEON_TEX.trim, fileName: 'mod.dfmod:trim', src: 'mod.dfmod@1:trim', image: async () => readPng(picture(4, 4, [200, 200, 10])) }]);
    await preloadTextureArchive(GALLEON_ARCHIVE, { decode });
    assert.deepEqual(red(decodedTexture(GALLEON_ARCHIVE, GALLEON_TEX.trim)), [10, 200, 10], 'the studio over an attached mod');
    // a player's own loose pick answers first, as it does over every picture of the port's
    setTextureReplacements([`${GALLEON_ARCHIVE}_${GALLEON_TEX.trim}-0.png`], async () => picture(4, 4, [10, 10, 200]));
    await preloadTextureArchive(GALLEON_ARCHIVE, { decode });
    assert.deepEqual(red(decodedTexture(GALLEON_ARCHIVE, GALLEON_TEX.trim)), [10, 10, 200]);
  } finally { reset(); }
});

test('STUDIO1 D3: the install reads the listing once, registers every picture, decodes the port\'s own archives at once and leaves Daggerfall\'s to their archive\'s load; no listing is nothing, and it never throws', async () => {
  reset();
  try {
    const files = { 'trashBattery/38181_1-0--cart-side.png': picture(8, 8, [90, 20, 20]), 'Redclaw/233_5-0.png': picture(8, 8, [20, 90, 20]) };
    const s = served(files, { listed: [...Object.keys(files), 'Redclaw/notes.png'] });
    const first = installStudioArt({ fetch: s.fetch, decode });
    assert.equal(installStudioArt({ fetch: s.fetch, decode }), first, 'once');
    assert.equal(await first, 2);
    assert.equal(s.asked.filter((u) => u === studioUrl(STUDIO_INDEX)).length, 1, 'the listing asked once');
    assert.deepEqual(studioWorn().map((e) => e.key), ['233_5-0', '38181_1-0']);
    assert.ok(WAGON_ARCHIVE > LAST_CLASSIC_TEXTURE_ARCHIVE && 233 <= LAST_CLASSIC_TEXTURE_ARCHIVE);
    await studioLanded();   // AUDIT STUDIO1 A3: the registration answers first; the port's own pictures decode after it
    assert.deepEqual(red(paintedReplacement(WAGON_ARCHIVE, 1)), [90, 20, 20], 'the port\'s own: decoded by the install');
    assert.equal(paintedReplacement(WAGON_ARCHIVE, 2), null, 'a record the studio has no picture of');
    assert.equal(hasTextureReplacement(233, 5), true, 'Daggerfall\'s record registered');
    assert.equal(decodedTexture(233, 5), null, '...and decoded with its archive, not by the install');
    assert.equal(s.asked.includes(studioUrl('Redclaw/233_5-0.png')), false, 'its bytes not fetched yet');
    await preloadTextureArchive(233, { decode });
    assert.deepEqual(red(decodedTexture(233, 5)), [20, 90, 20]);
    await studioLanded();
    // no listing served (a page off a plain static server): nothing, and the game as it was
    reset();
    assert.equal(await installStudioArt({ fetch: served(files, { index: false }).fetch, decode }), 0);
    assert.equal(hasTextureReplacement(WAGON_ARCHIVE, 1), false);
    reset();
    assert.equal(await installStudioArt({ fetch: async () => { throw new Error('offline'); }, decode }), 0, 'a network that fails costs the art, never the boot');
    reset();
    const broken = served({ 'a/38181_3-0.png': new Uint8Array([1, 2, 3]) });
    assert.equal(await installStudioArt({ fetch: broken.fetch, decode }), 1, 'a picture that will not decode is registered...');
    await studioLanded();
    assert.equal(paintedReplacement(WAGON_ARCHIVE, 3), null, '...and the painted one is worn');
  } finally { reset(); }
});

test('STUDIO1 D4: the rows - color32 order for the wagons\' door (row 0 the picture\'s bottom), top-down for the yards\', the port\'s and the monument\'s', async () => {
  reset();
  try {
    await installStudioArt({ fetch: served({ 'a/38221_0-0.png': picture(2, 3, [40, 50, 60]) }).fetch, decode });
    await studioLanded();
    const up = paintedReplacement(38221, 0);
    const down = paintedReplacement(38221, 0, { topDown: true });
    const row = (img, y) => [...img.colors.subarray(y * img.width * 4, y * img.width * 4 + 3)];
    assert.deepEqual([up.width, up.height, down.width, down.height], [2, 3, 2, 3]);
    assert.deepEqual(row(down, 0), [255, 255, 255], 'top-down: the white row first');
    assert.deepEqual(row(up, 2), [255, 255, 255], 'color32: the white row last');
    assert.deepEqual(row(up, 0), [40, 50, 60]);
  } finally { reset(); }
});

test('STUDIO1 D5: wearPainted - painted with no studio picture, the studio\'s in its place, and the studio\'s handed again (late) when an install still on its way lands', async () => {
  reset();
  try {
    const puts = [];
    const put = (p, how) => puts.push([p, how]);
    wearPainted(WAGON_ARCHIVE, 4, () => 'painted', put);
    assert.deepEqual(puts, [['painted', { replaced: false, late: false }]], 'no install asked: the painted picture, once');
    // landed: the studio's at once, the painted one never painted
    puts.length = 0;
    await installStudioArt({ fetch: served({ 'a/38181_4-0.png': picture(2, 2, [70, 7, 7]) }).fetch, decode });
    await studioLanded();
    let painted = 0;
    wearPainted(WAGON_ARCHIVE, 4, () => { painted++; return 'painted'; }, put);
    assert.equal(painted, 0);
    assert.deepEqual(puts.map(([p, h]) => [red(p), h]), [[[70, 7, 7], { replaced: true, late: false }]]);
    // on its way: painted now, the studio's when it lands
    reset();
    puts.length = 0;
    let open;
    const gate = new Promise((r) => { open = r; });
    const install = installStudioArt({ fetch: served({ 'a/38181_4-0.png': picture(2, 2, [70, 7, 7]) }, { gate }).fetch, decode });
    wearPainted(WAGON_ARCHIVE, 4, () => 'painted', put);
    wearPainted(WAGON_ARCHIVE, 5, () => 'painted 5', put);
    assert.deepEqual(puts, [['painted', { replaced: false, late: false }], ['painted 5', { replaced: false, late: false }]]);
    open();
    await install;
    await studioLanded();
    await new Promise((r) => setImmediate(r));
    assert.equal(puts.length, 3, 'record 5 has no studio picture: nothing more for it');
    assert.deepEqual([red(puts[2][0]), puts[2][1]], [[70, 7, 7], { replaced: true, late: true }]);
  } finally { reset(); }
});

test('STUDIO1 D6: the doors - the caravan\'s room wears the studio\'s picture of the record each live record shows (built, or its paint\'s), through its real producer; every host that paints its own goes through wearPainted in its rows', async () => {
  reset();
  try {
    const paint = lookRecord(WAGON_TEX.roomSide, 2);
    await installStudioArt({ fetch: served({ [`a/${WAGON_ARCHIVE}_${WAGON_TEX.roomFloor}-0.png`]: picture(2, 2, [11, 22, 33]), [`a/${WAGON_ARCHIVE}_${paint}-0.png`]: picture(2, 2, [44, 55, 66]) }).fetch, decode });
    await studioLanded();
    const look = { w: 2 };
    const ups = new Map();
    paintCaravanRoom({ uploadTexture: (a, r, c, o) => ups.set(r, [c, o]), evictTexture() {} }, look);
    const live = new Map(caravanRoomPictures(look).map(([rec, , from]) => [from, rec]));
    assert.deepEqual(red(ups.get(live.get(WAGON_TEX.roomFloor))[0]), [11, 22, 33], 'the built floor: the studio\'s');
    assert.deepEqual(red(ups.get(live.get(paint))[0]), [44, 55, 66], 'the walls\' second paint: the studio\'s picture of that paint');
    assert.deepEqual(ups.get(live.get(paint))[1], { cutout: true }, 'the wall keeps its glass a cut-out');
    assert.equal(ups.size, caravanRoomPictures(look).length, 'every live record up');
    const studioUp = [...ups.values()].filter(([c]) => [[11, 22, 33], [44, 55, 66]].some((x) => String(red(c)) === String(x))).length;
    assert.equal(studioUp, 2, 'and only those two the studio\'s');
  } finally { reset(); }
  const read = (f) => readFileSync(new URL(`../../../src/${f}`, import.meta.url), 'utf8');
  assert.match(read('scenes/horseCartPool.js'), /wearPainted\(WAGON_ARCHIVE, rec, \(\) => toColor32\([^\n]*\), \(c32, \{ late \}\) => \{\n\s+if \(late\) renderer\.releaseTexture\?\.\(WAGON_ARCHIVE, rec\);\n\s+renderer\.uploadTexture\(WAGON_ARCHIVE, rec, c32, opts\);\n\s+\}\);/, 'the wagons: color32, the painted one let go when the studio\'s lands');
  for (const [f, A] of [['scenes/merchantYardsHost.js', 'YARD'], ['scenes/lefayMonumentHost.js', 'LEFAY']]) {
    assert.match(read(f), new RegExp(`wearPainted\\(${A}_ARCHIVE, rec, [^\\n]*\\(pic, \\{ late \\}\\) => \\{ if \\(late\\) renderer\\.releaseTexture\\?\\.\\(${A}_ARCHIVE, rec\\); renderer\\.uploadTexture\\?\\.\\(${A}_ARCHIVE, rec, pic\\); \\}, \\{ topDown: true \\}\\);`), `${f}: top-down, let go when late`);
  }
  const port = read('scenes/portHost.js');
  assert.match(port, /if \(late\) \{ renderer\.releaseTexture\?\.\(PORT_ARCHIVE, rec\); if \(how\?\.glows\) renderer\.evictEmissionTexture\?\.\(`\$\{PORT_ARCHIVE\}_\$\{rec\}`\); \}/, 'the port: its picture and its glow let go when late');
  assert.match(port, /renderer\.uploadEmissionTexture\?\.\(PORT_ARCHIVE, rec, replaced \? art : pic, OWN_LIGHT\);/, 'the beacon\'s glow is the studio\'s picture where it is the studio\'s');
  assert.match(port, /\}, \{ topDown: true \}\);\n\s+\} while \(artAt < PORT_PAINTERS\.length/, 'the port: top-down');
  assert.match(read('world/wagonModels.js'), /await studioLanded\(\);[^\n]*\n\s+const pics = new Map\(wagonArt\(\)\.map\(\(\[rec, pic\]\) => \[rec, paintedReplacement\(WAGON_ARCHIVE, rec\) \?\? toColor32/, 'the wagon\'s icon: drawn once, after the studio lands, in its pictures');
  assert.match(read('scenes/caravanRoom.js'), /out\.push\(\[lookRecord\(rec, CARAVAN_LIVE_CHOICE\), painted\?\.get\(rec\) \?\? built\.get\(rec\), painted\?\.has\(rec\) \? lookRecord\(rec, i\) : rec\]\)/);
  const shared = read('scenes/shared.js');
  assert.match(shared, /const studio = installStudioArt\(\)\.catch\(\(\) => 0\);/, 'every host\'s one bootstrap installs the studio');
});

// THE CLASS SKINS, OURS. Each class frame is the player's own classic sheet frame,
// dyed and marked by its class's scheme (player/classSkinArt.js); the pack's 1,683 pictures are gone. Pinned on palettes
// and TEXTURE files made here, so CI needs no ARENA2; the last pin builds every class frame from the real data when
// ARENA2_PATH is set.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  CLASS_LOOKS, OUTER_SLOT, SLOT_OF_RAMP, CLASS_INSIGNIA, CLASS_FIGURE, TRANSPARENT, NONE, CLOTH, DRAPE, METAL, SKIN,
  paletteTables, paintClassFrame, rampBlend, classSkinPicture, regionsOf, torsoOf, BARE_SHEETS, TORSO_HALF,
} from '../../src/player/classSkinArt.js';
import { CLASS_SKINS, classSkinLabel, classRecordScale } from '../../src/player/classSkins.js';
import { decodeSprite, buildDerivedSprite, worldOrderColors } from '../../src/player/eyeOfTheBeholder/eotbSprite.js';
import { derivedImageUrl } from '../../src/ui/skinCard.js';
import { keepOnlyInMemory } from '../../src/scenes/dataSource.js';
import { createClassicPictures } from '../../src/formats/classicPictures.js';
import { classicRecordRgba } from '../../src/formats/derivedTexture.js';
import { TextureFile } from '../../src/formats/textureFile.js';
import { DFPalette } from '../../src/formats/dfPalette.js';

const ROOT = new URL('../../', import.meta.url).pathname;
/** A palette of 256 colours, each its own: red is the index. */
const paletteBytes = () => { const b = new Uint8Array(768); for (let i = 0; i < 256; i++) { b[i * 3] = i; b[i * 3 + 1] = (i * 37) & 255; b[i * 3 + 2] = 255 - i; } return b; };
const PALETTE = (() => { const p = new DFPalette(); p.load(paletteBytes(), 'ART_PAL.COL'); return p; })();
const TABLES = paletteTables(PALETTE);
const rgb = (i) => [PALETTE.getRed(i), PALETTE.getGreen(i), PALETTE.getBlue(i)];
/** A classic-shaped picture `w` x `h`, top row first, from a palette index per pixel (0 clear). */
function picture(w, h, indexAt) {
  const data = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = indexAt(x, y), o = (y * w + x) * 4;
    if (!i) continue;
    data.set([...rgb(i), 255], o);
  }
  return { width: w, height: h, data };
}
const at = (pic, x, y) => [...pic.data.subarray((y * pic.width + x) * 4, (y * pic.width + x) * 4 + 4)];
/** A standing figure 40 wide and 110 tall: a skin head, a cloth trunk, drape legs, a metal band, a shadow pixel. */
const FIGURE = picture(40, 112, (x, y) => {
  if (x < 8 || x >= 32 || y < 2) return 0;
  if (y < 20) return 0x24;   // the head, skin
  if (y === 40 && x === 20) return 0xd9;   // a shadow inside the cloth
  if (y < 60) return 0x84;   // the trunk, the teal cloth
  if (y < 64) return 0x74;   // a metal band
  return 0xc4;   // the legs, the olive drape
});

test('OWN-WORK4: a palette\'s ramps are read by what a class sheet paints in them - cloth, drape, metal and skin; the rest stays', () => {
  assert.deepEqual(SLOT_OF_RAMP, { 2: SKIN, 4: SKIN, 5: METAL, 6: CLOTH, 7: METAL, 8: CLOTH, 10: DRAPE, 12: DRAPE });
  assert.equal(TABLES.slot[0x84], CLOTH); assert.equal(TABLES.slot[0x64], CLOTH);
  assert.equal(TABLES.slot[0xc4], DRAPE); assert.equal(TABLES.slot[0xa4], DRAPE);
  assert.equal(TABLES.slot[0x74], METAL); assert.equal(TABLES.slot[0x54], METAL);
  assert.equal(TABLES.slot[0x24], SKIN); assert.equal(TABLES.slot[0x44], SKIN);
  for (const i of [0x14, 0x34, 0x94, 0xb4, 0xd9, 0xe4, 0xf4]) assert.equal(TABLES.slot[i], NONE, `0x${i.toString(16)}: the shadows, the wood, the spells - never dyed`);
  assert.equal(TABLES.index.get((0x84 << 16) | (rgb(0x84)[1] << 8) | rgb(0x84)[2]), 0x84, 'a colour back to its index');
  for (const slot of [CLOTH, DRAPE, METAL, SKIN]) {
    const tones = [...TABLES.tone].filter((_, i) => i > 0 && i < 255 && TABLES.slot[i] === slot);
    assert.equal(Math.min(...tones), 0, `slot ${slot}: its darkest is 0`);
    assert.equal(Math.max(...tones), 1, `slot ${slot}: its lightest is 1`);
  }
  assert.deepEqual(rampBlend([[0, 0, 0], [100, 200, 50]], 0.5), [50, 100, 25], 'a ramp is blended between its stops');
  assert.deepEqual(rampBlend([[0, 0, 0], [100, 200, 50]], 2), [100, 200, 50], 'and held at its ends');
});

test('OWN-WORK4: a frame is dyed by its scheme - the outer garment\'s ramp by the sheet, the inner the other, the metal its own; skin, shadow and clear untouched', () => {
  const look = CLASS_LOOKS['Daggerfall Adventurer'];   // no marks: the dye alone
  const onDrape = paintClassFrame(FIGURE, TABLES, look, { outer: DRAPE });
  const onCloth = paintClassFrame(FIGURE, TABLES, look, { outer: CLOTH });
  assert.deepEqual(at(onDrape, 20, 80), [...rampBlend(look.outer, TABLES.tone[0xc4]), 255], 'the drape is the outer garment on a sheet whose hood is olive');
  assert.deepEqual(at(onDrape, 20, 30), [...rampBlend(look.inner, TABLES.tone[0x84]), 255], 'and the cloth the inner');
  assert.deepEqual(at(onCloth, 20, 30), [...rampBlend(look.outer, TABLES.tone[0x84]), 255], 'swapped on a sheet whose hood is teal');
  assert.deepEqual(at(onDrape, 20, 61), [...rampBlend(look.metal, TABLES.tone[0x74]), 255], 'the metal');
  assert.deepEqual(at(onDrape, 20, 10), [...rgb(0x24), 255], 'skin untouched');
  assert.deepEqual(at(onDrape, 20, 40), [...rgb(0xd9), 255], 'a shadow untouched');
  assert.deepEqual(at(onDrape, 2, 50), [0, 0, 0, 0], 'clear stays clear');
  assert.deepEqual([onDrape.width, onDrape.height], [40, 112], 'the classic frame\'s size: the sizes and anchors the sprite code reads');
  assert.notEqual(onDrape.data, FIGURE.data, 'a new raster - the classic one is not written');
  assert.deepEqual(at(FIGURE, 20, 80), [...rgb(0xc4), 255]);
});

test('OWN-WORK4: every class reads as itself - one scheme a class, every sheet\'s outer garment known, and no two classes painted alike', () => {
  const names = [...new Set(CLASS_SKINS.map((s) => s.name))];
  assert.deepEqual(Object.keys(CLASS_LOOKS).sort(), [...names].sort(), 'one scheme a class, none spare');
  for (const s of CLASS_SKINS) assert.ok([CLOTH, DRAPE].includes(OUTER_SLOT[s.from]), `${classSkinLabel(s)}: TEXTURE.${s.from}'s outer garment`);
  assert.deepEqual([489, 490].map((from) => OUTER_SLOT[from]), [CLOTH, DRAPE], 'the woman\'s hood is her teal, the man\'s his olive');
  for (const [name, look] of Object.entries(CLASS_LOOKS)) {
    assert.ok(Object.isFrozen(look), name);
    for (const ramp of [look.outer, look.inner, look.metal]) assert.ok(Array.isArray(ramp) && ramp.length >= 5, `${name}: a ramp of five stops or more`);
    if (look.sign) assert.ok(CLASS_INSIGNIA[look.sign.glyph], `${name}: its insignia is drawn`);
  }
  for (const glyph of Object.values(CLASS_INSIGNIA)) assert.ok(glyph.length === 7 && glyph.every((row) => row.length === 7 && /^[#o.]+$/.test(row)));
  // the same frame under each scheme, front and back: no two alike
  const painted = Object.entries(CLASS_LOOKS).map(([name, look]) => [name, Buffer.from([0, 4].flatMap((view) => [...paintClassFrame(FIGURE, TABLES, look, { view }).data])).toString('base64')]);
  for (let i = 0; i < painted.length; i++) for (let j = i + 1; j < painted.length; j++) assert.notEqual(painted[i][1], painted[j][1], `${painted[i][0]} and ${painted[j][0]}`);
});

test('OWN-AUDIT: a cloth\'s near-black steps join the garment nearest them - a robe\'s hem shaded in the olive is the robe\'s, a glove\'s own dark stays the glove\'s', () => {
  // a robe of teal (0x84) whose hem rows are the olive's darkest (0xce), a lit olive glove (0xc4) beside it with a dark
  // olive strip on its inner edge, and lit olive legs below a gap holding one teal darkest (0x8e)
  const robe = picture(40, 112, (x, y) => {
    if (y < 2) return 0;
    if (x >= 32 && x < 36 && y >= 50 && y <= 60) return x < 34 && y >= 58 ? 0xce : 0xc4;
    if (x < 8 || x >= 32) return 0;
    if (y < 20) return 0x24;
    if (y < 90) return 0x84;
    if (y < 96) return 0xce;
    if (y < 100) return 0;
    return x === 20 && y === 108 ? 0x8e : 0xc4;
  });
  assert.deepEqual([0xce, 0x8e, 0xcc, 0x84, 0xc4].map((i) => TABLES.tail[i]), [1, 1, 0, 0, 0], 'steps 13-15 of a cloth ramp alone');
  const look = CLASS_LOOKS['Daggerfall Adventurer'];   // no marks: the dye alone
  const painted = paintClassFrame(robe, TABLES, look, { outer: CLOTH });
  const toneOf = (slot, i) => { const [lo, hi] = TABLES.span[slot]; return Math.max(0, Math.min(1, (TABLES.light[i] - lo) / (hi - lo))); };
  assert.deepEqual(at(painted, 20, 93), [...rampBlend(look.outer, toneOf(CLOTH, 0xce)), 255], 'the hem is the robe\'s, at its own light');
  assert.deepEqual(at(painted, 32, 59), [...rampBlend(look.inner, TABLES.tone[0xce]), 255], 'the glove\'s dark edge, the robe one pixel off and the glove two: the glove\'s');
  assert.deepEqual(at(painted, 20, 108), [...rampBlend(look.inner, toneOf(DRAPE, 0x8e)), 255], 'a teal darkest far inside the olive legs: the legs\'');
});

/** A bare figure 60 wide and 112 tall, as TEXTURE.482 draws one: a metal helmet, a skin torso lit above (0x22) and
 *  darker below (0x28), arms of skin apart from it, an olive loincloth, skin legs and teal boots. */
const BARE = picture(60, 112, (x, y) => {
  if (y >= 2 && y <= 14 && x >= 24 && x <= 36) return 0x74;
  if (y >= 15 && y <= 44 && x >= 18 && x <= 42) return y < 30 ? 0x22 : 0x28;
  if (y >= 18 && y <= 60 && ((x >= 7 && x <= 12) || (x >= 48 && x <= 53))) return 0x24;
  if (y >= 45 && y <= 60 && x >= 24 && x <= 36) return 0xc4;
  if (y >= 61 && y <= 100 && ((x >= 20 && x <= 28) || (x >= 32 && x <= 40))) return 0x24;
  if (y >= 101 && y <= 111 && ((x >= 20 && x <= 28) || (x >= 32 && x <= 40))) return 0x84;
  return 0;
});

test('OWN-AUDIT: TEXTURE.482\'s bare figure is clothed - its torso found from the loincloth\'s top to two rows under the helmet, about the hips\' middle, the arms left bare (mutants: the waist misread, arms clothed)', () => {
  assert.deepEqual(BARE_SHEETS, [482]);
  const torso = torsoOf(regionsOf(BARE, TABLES, CLASS_FIGURE), TABLES, 60, 112, { loin: DRAPE, view: 0 });
  assert.deepEqual([torso.top, torso.waist], [16, 45], 'from two rows under the helmet to the loincloth\'s top');
  const [from, to] = torso.span[30];
  assert.ok(from <= 18 && to >= 42, `the torso across (${from}-${to})`);
  assert.ok(from > 12 && to < 48, 'and not the arms');
  assert.equal(torso.span[15], null, 'nothing above the neck');
  assert.deepEqual(TORSO_HALF[0], TORSO_HALF[4], 'the back as wide as the front');
  assert.ok(TORSO_HALF[2][1] < TORSO_HALF[1][1] && TORSO_HALF[1][1] < TORSO_HALF[0][1], 'the side narrowest');
});

test('OWN-AUDIT: the acrobat, the bounty hunter and the Dark Brotherhood each wear their own garment on a bare sheet - a motley jerkin, a leather harness, a dark wrapped tunic - lit by the flesh under it; skin elsewhere stays; a class with none, or a sheet that is not bare, is unchanged (mutants: the garment unworn, unlit, two garments alike, every sheet bare)', async () => {
  const torsoMean = (pic) => { const sum = [0, 0, 0]; let n = 0; for (let y = 16; y < 43; y++) for (let x = 22; x <= 38; x++) { const o = (y * 60 + x) * 4; sum[0] += pic.data[o]; sum[1] += pic.data[o + 1]; sum[2] += pic.data[o + 2]; n++; } return sum.map((v) => v / n); };
  const worn = {};
  for (const name of ['Acrobat', 'Bounty Hunter', 'Dark Brotherhood']) {
    const look = CLASS_LOOKS[name];
    assert.ok(['motley', 'harness', 'wrap'].includes(look.garment?.kind), `${name}: a garment`);
    const bare = paintClassFrame(BARE, TABLES, look, { outer: DRAPE, view: 0 });
    const clothed = paintClassFrame(BARE, TABLES, look, { outer: DRAPE, view: 0, bare: true });
    assert.deepEqual(at(bare, 20, 20), [...rgb(0x22), 255], `${name}: no garment off a bare sheet`);
    assert.notDeepEqual(at(clothed, 20, 20), [...rgb(0x22), 255], `${name}: its torso clothed`);
    assert.deepEqual(at(clothed, 10, 50), [...rgb(0x24), 255], `${name}: its arm bare`);
    assert.deepEqual(at(clothed, 24, 80), [...rgb(0x24), 255], `${name}: its leg bare`);
    const lit = paintClassFrame(BARE, TABLES, { outer: look.outer, inner: look.inner, metal: look.metal, garment: { ...look.garment, kind: 'plain' } }, { outer: DRAPE, view: 0, bare: true });
    assert.ok(at(lit, 30, 20).slice(0, 3).reduce((a, b) => a + b) > at(lit, 30, 40).slice(0, 3).reduce((a, b) => a + b), `${name}: lit as the flesh under it`);
    worn[name] = torsoMean(paintClassFrame(BARE, TABLES, { outer: look.outer, inner: look.inner, metal: look.metal, garment: look.garment }, { outer: DRAPE, view: 0, bare: true }));
  }
  const names = Object.keys(worn);
  for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) {
    const d = Math.hypot(...worn[names[i]].map((v, k) => v - worn[names[j]][k]));
    assert.ok(d > 45, `${names[i]} and ${names[j]}: their garments read apart (${d.toFixed(0)})`);
  }
  assert.deepEqual(paintClassFrame(BARE, TABLES, CLASS_LOOKS.Healer, { outer: CLOTH, view: 0, bare: true }), paintClassFrame(BARE, TABLES, CLASS_LOOKS.Healer, { outer: CLOTH, view: 0 }), 'a class with no garment');
  const read = async () => BARE, palette = async () => PALETTE;
  assert.deepEqual(await classSkinPicture('1523_15-0', { picture: read, palette }), paintClassFrame(BARE, TABLES, CLASS_LOOKS.Acrobat, { outer: DRAPE, view: 0, bare: true }), 'the acrobat on TEXTURE.482: clothed');
  assert.deepEqual(await classSkinPicture('1524_15-0', { picture: read, palette }), paintClassFrame(BARE, TABLES, CLASS_LOOKS.Acrobat, { outer: DRAPE, view: 0 }), 'the acrobat on TEXTURE.483: her own outfit');
});

test('OWN-WORK4: the marks are drawn on the frame\'s own regions - an insignia on the breast and the back, never the side; a hem; a belt on clothes alone; a shield on the left arm', () => {
  const ink = (pic, colour) => { let n = 0; for (let i = 0; i < pic.data.length; i += 4) if (pic.data[i] === colour[0] && pic.data[i + 1] === colour[1] && pic.data[i + 2] === colour[2] && pic.data[i + 3]) n++; return n; };
  const acolyte = CLASS_LOOKS['Dark Acolyte'];
  const skullInk = CLASS_INSIGNIA.skull.join('').split('').filter((c) => c === '#').length;
  for (const view of [0, 1, 3, 4]) assert.equal(ink(paintClassFrame(FIGURE, TABLES, acolyte, { view, outer: CLOTH }), acolyte.sign.colour), skullInk, `view ${view}: the skull`);
  assert.equal(ink(paintClassFrame(FIGURE, TABLES, acolyte, { view: 2, outer: CLOTH }), acolyte.sign.colour), 0, 'the side: none');
  // its centre: the trunk's middle, 69% up from the feet (111) - the figure's columns 8..31
  const front = paintClassFrame(FIGURE, TABLES, acolyte, { view: 0, outer: CLOTH });
  assert.deepEqual(at(front, 20, Math.round(111 - 0.69 * CLASS_FIGURE)).slice(0, 3), acolyte.sign.colour, 'the skull\'s middle on the breast');
  // the trim: a robe's last two rows over the clear (its hem) and its column beside a bare arm (a cuff); not the
  // silhouette's sides, not the cloth over the metal band
  const robe = picture(40, 112, (x, y) => (y < 2 || x < 8 || x >= 36 || y > 100 ? 0 : y < 20 || (x >= 32 && (y < 30 || y > 60)) ? (x >= 32 ? 0 : 0x24) : x >= 32 ? 0x24 : 0x84));
  const trimmed = paintClassFrame(robe, TABLES, acolyte, { view: 2, outer: CLOTH });
  const bone = rampBlend(acolyte.trim.ramp, 0.35 + 0.65 * TABLES.tone[0x84]), black = rampBlend(acolyte.outer, TABLES.tone[0x84]);
  assert.deepEqual([100, 99, 98].map((y) => at(trimmed, 20, y).slice(0, 3)), [bone, bone, black], 'the hem, two rows');
  assert.deepEqual([31, 30].map((x) => at(trimmed, x, 45).slice(0, 3)), [bone, black], 'the cuff beside the arm');
  assert.deepEqual(at(trimmed, 8, 45).slice(0, 3), black, 'the silhouette\'s side: no trim');
  assert.deepEqual(at(front, 12, 59).slice(0, 3), black, 'the cloth over the metal band: no hem');
  // the belt: only on the clothes, at the waist
  const monk = CLASS_LOOKS.Monk;
  const belted = paintClassFrame(FIGURE, TABLES, monk, { outer: CLOTH });
  const waist = Math.round(111 - 0.53 * CLASS_FIGURE);
  assert.deepEqual(at(belted, 20, waist).slice(0, 3), rampBlend(monk.belt, 0.2 + 0.65 * TABLES.tone[0x84]), 'the rope at the waist');
  const bare = picture(40, 112, (x, y) => (x < 8 || x >= 32 || y < 2 ? 0 : 0x24));   // a figure all skin
  assert.deepEqual(paintClassFrame(bare, TABLES, monk, { outer: CLOTH }).data, bare.data, 'no clothes, no belt');
  // the shield: the shielded healer alone, its face toward the front, its back behind
  const plain = paintClassFrame(FIGURE, TABLES, CLASS_LOOKS.Healer, { view: 0, outer: CLOTH });
  const shielded = paintClassFrame(FIGURE, TABLES, CLASS_LOOKS['Healer with Shield'], { view: 0, outer: CLOTH });
  let differ = 0, right = 0;
  for (let i = 0; i < plain.data.length; i += 4) if (plain.data[i] !== shielded.data[i] || plain.data[i + 3] !== shielded.data[i + 3]) { differ++; if ((i / 4) % 40 > 20) right++; }
  assert.ok(differ > 150, `a shield of ${differ} pixels`);
  assert.ok(right > differ * 0.6, 'on the image\'s right: the figure\'s left arm, seen from the front');
  assert.equal(Object.values(CLASS_LOOKS).filter((look) => look.shield).length, 1);
});

test('OWN-WORK4: a class key builds from its own classic record - the sheet, record and frame it names - and fails as a missing picture does', async () => {
  const asked = [];
  const read = async (archive, record, frame) => { asked.push([archive, record, frame]); return FIGURE; };
  const palette = async () => PALETTE;
  const built = await classSkinPicture('1528_20-4', { picture: read, palette });
  assert.deepEqual(asked, [[485, 20, 4]], 'the female healer: TEXTURE.485, her cast\'s fifth frame');
  assert.deepEqual(built, paintClassFrame(FIGURE, TABLES, CLASS_LOOKS.Healer, { outer: CLOTH, view: 0 }));
  await classSkinPicture('1541_8-6', { picture: read, palette });
  assert.deepEqual(asked.at(-1), [477, 8, 6], 'the sorceress: TEXTURE.477, record 8\'s seventh');
  // Her short record is marked at its own figure's height
  const short = await classSkinPicture('1524_16-0', { picture: read, palette });
  assert.deepEqual(short, paintClassFrame(FIGURE, TABLES, CLASS_LOOKS.Acrobat, { outer: DRAPE, view: 1, height: CLASS_FIGURE * classRecordScale(1524, 16) }));
  assert.notDeepEqual(short, paintClassFrame(FIGURE, TABLES, CLASS_LOOKS.Acrobat, { outer: DRAPE, view: 1 }), 'not at the group\'s 110');
  await assert.rejects(classSkinPicture('1523_15-0', { picture: async () => null, palette }), /TEXTURE\.482 record 15 frame 0: not in the player's data/);
  await assert.rejects(classSkinPicture('112364_0-0', { picture: read, palette }), /no class skin/);
  await assert.rejects(classSkinPicture('1523_15-0', { picture: read, palette: async () => { throw new Error('ART_PAL.COL: missing'); } }), /missing/);
});

test('OWN-WORK4: nothing of the pack is read - our code names no vendored picture', () => {
  for (const f of ['src/player/classSkinArt.js', 'src/player/classSkins.js', 'src/player/eyeOfTheBeholder/eotbSprite.js']) {
    assert.doesNotMatch(readFileSync(join(ROOT, f), 'utf8'), /class-skins|skins\.json/, f);
  }
});

// ── the real door, end to end, on made-up ARENA2 files in the data source's memory ─────────────────────────────────
/** A TEXTURE file of `n` single-frame uncompressed records, each `w`x`h`, rows on the format's 256-byte stride. */
function textureFile(n, w, h, pixel) {
  const starts = [];
  let size = 26 + 20 * n;
  for (let r = 0; r < n; r++) { starts.push(size); size += 28 + 256 * h; }
  const bytes = new Uint8Array(size), v = new DataView(bytes.buffer);
  v.setInt16(0, n, true);
  for (let r = 0; r < n; r++) {
    v.setInt32(26 + 20 * r + 2, starts[r], true);
    v.setInt16(starts[r] + 4, w, true); v.setInt16(starts[r] + 6, h, true);
    v.setUint32(starts[r] + 14, 28, true);
    v.setUint16(starts[r] + 20, 1, true);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) bytes[starts[r] + 28 + y * 256 + x] = pixel(r, x, y);
  }
  return bytes;
}
const FAKE = {
  'TEXTURE.482': textureFile(25, 12, 30, (r, x, y) => (x === 0 ? 0 : [0x84, 0xc4, 0x74, 0x24, 0xd9][(x + y + r) % 5])),
  'ART_PAL.COL': paletteBytes(),
};
for (const [name, bytes] of Object.entries(FAKE)) keepOnlyInMemory(name, bytes);

test('OWN-WORK4: the body\'s, the peers\' and the card\'s one door builds a class frame from the player\'s own TEXTURE file, on the world\'s rows', async () => {
  const t = new TextureFile(); t.load(FAKE['TEXTURE.482'], 'TEXTURE.482', null);
  const want = paintClassFrame(classicRecordRgba(t.getDFBitmap(17, 0), PALETTE), TABLES, CLASS_LOOKS.Acrobat, { outer: DRAPE, view: 2, bare: true });
  const px = await decodeSprite('DF:1523_17-0');
  assert.deepEqual([px.width, px.height], [12, 30]);
  assert.deepEqual([...px.colors], [...worldOrderColors(want).colors], 'our acrobat, bottom row first, as a decoded PNG');
  assert.deepEqual(await buildDerivedSprite('1523_17-0'), want, 'a bare key too');
  assert.equal(await derivedImageUrl('DF:1523_17-0', { encode: async (p) => `blob:${p.width}x${p.height}` }), 'blob:12x30', 'the Skin card\'s picture');
  await assert.rejects(decodeSprite('DF:1536_15-0'), /TEXTURE\.490/, 'a sheet the player\'s data lacks fails as a missing picture');
  await assert.rejects(decodeSprite('DF:1523_25-0'), /no spec/, 'a record the sheet has not');
});

test('OWN-WORK4: every class frame of every skin builds from the player\'s own sheet, at its record\'s size, dyed', { skip: !process.env.ARENA2_PATH && 'ARENA2_PATH not set' }, async () => {
  const A2 = /** @type {string} */ (process.env.ARENA2_PATH);
  const cp = createClassicPictures(async (name) => readFileSync(join(A2, name)));
  const real = new DFPalette(); real.load(new Uint8Array(readFileSync(join(A2, 'ART_PAL.COL'))), 'ART_PAL.COL');
  const palette = async () => real, read = (archive, record, frame) => cp.picture(archive, record, frame);
  let frames = 0;
  for (const s of CLASS_SKINS) {
    let changed = 0;
    for (let record = 0; record < s.frames.length; record++) {
      for (let frame = 0; frame < s.frames[record]; frame++) {
        const classic = await read(s.from, record, frame);
        const ours = await classSkinPicture(`${s.archive}_${record}-${frame}`, { picture: read, palette });
        assert.deepEqual([ours.width, ours.height], [classic.width, classic.height], `${s.archive}_${record}-${frame}`);
        let lost = 0, grown = 0;
        for (let i = 3; i < ours.data.length; i += 4) { if (classic.data[i] && !ours.data[i]) lost++; if (!classic.data[i] && ours.data[i]) grown++; }
        assert.equal(lost, 0, `${s.archive}_${record}-${frame}: nothing of the figure lost`);
        if (!CLASS_LOOKS[s.name].shield) assert.equal(grown, 0, `${s.archive}_${record}-${frame}: the silhouette kept - only a shield is drawn past it`);
        for (let i = 0; i < ours.data.length; i += 4) if (ours.data[i] !== classic.data[i] || ours.data[i + 1] !== classic.data[i + 1] || ours.data[i + 2] !== classic.data[i + 2]) changed++;
        frames++;
      }
    }
    assert.ok(changed > s.frames.length * 300, `${classSkinLabel(s)}: dyed (${changed} pixels)`);
  }
  assert.equal(frames, 1691);
});

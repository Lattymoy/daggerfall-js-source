// DF-LOOK (2026-10-15, bible/01-Overview/DF-Art.md, Mac: "we recently took away custom textures for certain models. Is
// there any way to revert those changes and instead make those textures more daggerfall-esq"; asked, every model DF-ART
// dressed, "Palette + grain"): the port's own painted pictures back, grained and snapped to the player's ART_PAL.COL at
// every door they go up through.
//
//   L1  no palette, painted as painted - the picture itself
//   L2  every opaque texel a palette colour, never index 0's (a record's clear texel)
//   L3  alpha untouched: a clear texel byte for byte, a half-clear one's alpha kept - a cut-out keeps its holes
//   L4  the grain: bounded, the same every time, its seed's own, in 2 x 2 clumps
//   L5  hue weighed above light: a red goes to the palette's red, not to the grey nearer its lightness
//   L6  the port rows' shape (`colors`) kept
//   L7  the pipeline hands over its palette (scenes/dataPipeline.js), and its absence takes the look off
//   L8  every door lays it on: the ships' stand-ins (a night twin with its day record's grain), the town's hangings,
//       the caravan's room - each through its real producer - and the wagons, the wagon's icon, the yards, the port
//       and the monument by their upload lines
//
// The palettes here are the test's own ramps: no game data (Port-Doctrine).
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DF_GRAIN, dfLook, dfLookOn, lookSeed, nearestIndex, oklab, setDfLookPalette } from '../../src/world/dfLook.js';
import { createDataPipeline } from '../../src/scenes/dataPipeline.js';
import { registerGalleonArt, galleonArt, _resetGalleonArt, GALLEON_ARCHIVE, GALLEON_NIGHT, TEX } from '../../src/world/ships/galleonArt.js';
import { townPictureEntries, TOWN_PICTURES, TOWN_PICTURE_ARCHIVE } from '../../src/world/townPictures.js';
import { paintCaravanRoom, caravanRoomPictures } from '../../src/scenes/caravanRoom.js';
import { WAGON_ARCHIVE, LOOK_RECORD_STRIDE } from '../../src/world/wagonArt.js';
import { toColor32 } from '../../src/formats/color32Order.js';

const CLEAR = [255, 0, 255];   // index 0's colour, and no other's
/** A palette of the test's own: index 0 CLEAR, then a grey ramp and red, green and blue ramps. */
function rampPalette() {
  const rgb = [CLEAR];
  for (let k = 0; k < 64; k++) rgb.push([k * 4, k * 4, k * 4]);
  for (let k = 0; k < 64; k++) rgb.push([k * 4, k, k >> 1]);
  for (let k = 0; k < 64; k++) rgb.push([k >> 1, k * 4, k]);
  for (let k = 0; k < 63; k++) rgb.push([k, k >> 1, k * 4]);
  return paletteOf(rgb);
}
const paletteOf = (rgb) => ({ getRed: (i) => (rgb[i] ?? CLEAR)[0], getGreen: (i) => (rgb[i] ?? CLEAR)[1], getBlue: (i) => (rgb[i] ?? CLEAR)[2], rgb });
const flat = (w, h, rgba) => ({ width: w, height: h, data: Uint8Array.from({ length: w * h * 4 }, (_, i) => rgba[i % 4]) });
const light = (d, i) => 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];

test('DF-LOOK L1: with no palette set (no pipeline up, a test\'s) a picture goes up as painted - the picture itself, untouched', () => {
  setDfLookPalette(null);
  assert.equal(dfLookOn(), false);
  const pic = flat(4, 4, [120, 80, 40, 255]);
  assert.equal(dfLook(pic, 7), pic);
});

test('DF-LOOK L2: every opaque texel comes out a colour of the palette - never index 0\'s, a record\'s clear texel, not even for a texel painted exactly that colour (mutants: the palette ignored, index 0 allowed)', () => {
  const pal = rampPalette();
  setDfLookPalette(pal);
  try {
    const colours = new Set(pal.rgb.slice(1).map((c) => c.join(',')));
    const pics = [galleonArt().find(([r]) => r === TEX.castle0)[1], flat(8, 8, [...CLEAR, 255]), flat(8, 8, [200, 150, 90, 255])];
    for (const pic of pics) {
      const out = dfLook(pic, 3);
      assert.notEqual(out, pic, 'a new picture');
      for (let i = 0; i < out.data.length; i += 4) {
        const c = [...out.data.subarray(i, i + 3)].join(',');
        assert.ok(colours.has(c), `texel ${i / 4}: ${c} is a palette colour`);
        assert.notEqual(c, CLEAR.join(','), `texel ${i / 4}: never index 0's`);
      }
    }
    assert.ok(galleonArt().some(([, p]) => !p.data.every((v, i) => v === dfLook(p, 1).data[i])), 'the painting changed by it');
  } finally { setDfLookPalette(null); }
});

test('DF-LOOK L3: alpha is never touched - a clear texel comes out byte for byte as it went in, a half-clear one keeps its alpha - so a cut-out keeps its holes (mutants: alpha made whole, a clear texel snapped)', () => {
  setDfLookPalette(rampPalette());
  try {
    const pic = flat(4, 2, [90, 60, 30, 255]);
    pic.data.set([12, 34, 56, 0], 0); pic.data.set([200, 100, 50, 128], 4); pic.data.set([7, 8, 9, 0], 20);
    const out = dfLook(pic, 11);
    assert.deepEqual([...out.data.subarray(0, 4)], [12, 34, 56, 0], 'a clear texel as it was');
    assert.deepEqual([...out.data.subarray(20, 24)], [7, 8, 9, 0], 'and another');
    assert.equal(out.data[7], 128, 'a half-clear texel\'s alpha kept');
    for (let i = 3; i < out.data.length; i += 4) assert.equal(out.data[i], pic.data[i], `texel ${(i - 3) / 4}: its alpha`);
  } finally { setDfLookPalette(null); }
});

test('DF-LOOK L4: THE GRAIN - a flat colour comes out grained, every texel within DF_GRAIN of it (and the ramp\'s step); the same picture and seed give the same bytes, another seed other grain; and it comes in 2 x 2 clumps - texels of one block nearer each other than texels either side of a block\'s edge (mutants: no grain, the grain the picture\'s alone, a seed off the clock, the clumps dropped)', () => {
  setDfLookPalette(rampPalette());
  try {
    const pic = flat(64, 64, [128, 128, 128, 255]);
    const a = dfLook(pic, lookSeed(38131, 3)), b = dfLook(pic, lookSeed(38131, 3)), c = dfLook(pic, lookSeed(38131, 4));
    assert.ok(Buffer.from(a.data).equals(Buffer.from(b.data)), 'the same bytes every time');
    assert.ok(!Buffer.from(a.data).equals(Buffer.from(c.data)), 'another record, other grain');
    const seen = new Set();
    for (let i = 0; i < a.data.length; i += 4) {
      seen.add(a.data[i]);
      // the grain's two halves (DF_GRAIN either way), the lookup's 6-bit cell (2) and the ramp's step (2)
      assert.ok(Math.abs(light(a.data, i) - 128) <= DF_GRAIN + 4 + 1e-9, `texel ${i / 4}: within the grain of its colour`);
    }
    assert.ok(seen.size >= 4, `grained: ${seen.size} shades of one flat grey`);
    // the clumps: |a - b| between horizontal neighbours inside a 2 x 2 block, against across a block's edge
    let inside = 0, across = 0, ni = 0, na = 0;
    for (let y = 0; y < 64; y++) for (let x = 0; x < 63; x++) {
      const d = Math.abs(a.data[(y * 64 + x) * 4] - a.data[(y * 64 + x + 1) * 4]);
      if (x % 2 === 0) { inside += d; ni++; } else { across += d; na++; }
    }
    assert.ok(inside / ni < 0.8 * (across / na), `clumped: ${(inside / ni).toFixed(2)} inside a block, ${(across / na).toFixed(2)} across`);
  } finally { setDfLookPalette(null); }
});

test('DF-LOOK L5: HUE WEIGHED ABOVE LIGHT - a dark red goes to the palette\'s red though a grey stands nearer its lightness, so an oxblood strake stays red and a sail canvas (mutant: the hue weighed as light is)', () => {
  const rgb = [CLEAR, [84, 84, 84], [210, 60, 30]];
  const lab = new Float32Array(256 * 3);
  rgb.forEach((c, i) => lab.set(oklab(...c), i * 3));
  for (let i = rgb.length; i < 256; i++) lab.set(oklab(...CLEAR), i * 3);
  const [L] = oklab(140, 40, 30);
  assert.ok(Math.abs(oklab(84, 84, 84)[0] - L) < Math.abs(oklab(210, 60, 30)[0] - L), 'the grey the nearer in lightness');
  assert.equal(nearestIndex(lab, 140, 40, 30), 2, 'the red');
  assert.equal(nearestIndex(lab, 90, 90, 90), 1, 'and a grey its grey');
});

test('DF-LOOK L6: the port rows\' pictures (world/portArt.js, merchantYardArt.js, lefayArt.js: `colors`) come out in their own shape, looked', () => {
  setDfLookPalette(rampPalette());
  try {
    const rows = { width: 2, height: 2, colors: Uint8Array.from([200, 100, 50, 255, 10, 20, 30, 255, 0, 0, 0, 0, 90, 90, 90, 255]) };
    const out = dfLook(rows, 5);
    assert.ok(out.colors instanceof Uint8Array && out.data === undefined, 'colors in, colors out');
    assert.deepEqual([out.width, out.height], [2, 2]);
    assert.deepEqual([...out.colors.subarray(8, 12)], [0, 0, 0, 0], 'its clear texel kept');
    assert.ok(!Buffer.from(out.colors).equals(Buffer.from(rows.colors)), 'looked');
  } finally { setDfLookPalette(null); }
});

test('DF-LOOK L7: THE PIPELINE HANDS OVER ITS PALETTE - a data pipeline built over a palette lays the look on in that palette\'s colours, and one built over none takes it off (mutant: the hand-over dropped)', () => {
  const renderer = { uploadTexture() {}, uploadEmissionTexture() {}, createMesh: (m) => ({ mesh: m }) };
  const fetch = async (n) => { throw new Error(`no ${n} here`); };
  const pal = paletteOf([CLEAR, [40, 40, 40], [160, 160, 160]]);
  setDfLookPalette(null);
  createDataPipeline({ renderer, arch: null, palette: pal, fetch });
  try {
    assert.equal(dfLookOn(), true, 'on');
    const out = dfLook(flat(4, 4, [150, 150, 150, 255]), 1);
    for (let i = 0; i < out.data.length; i += 4) assert.deepEqual([...out.data.subarray(i, i + 3)], [160, 160, 160], 'its own palette\'s colour');
    createDataPipeline({ renderer, arch: null, palette: null, fetch });
    assert.equal(dfLookOn(), false, 'off with none');
  } finally { setDfLookPalette(null); }
});

test('DF-LOOK L8: EVERY DOOR LAYS IT ON - the galleon\'s stand-ins build her pictures looked (a night twin with its day record\'s grain, whole), the town\'s hangings theirs, the caravan\'s room uploads its looked by its built record\'s seed; and the wagons\' pool, the wagon\'s icon, the yards, the port and the monument upload through dfLook (mutants: a door left painted)', async () => {
  setDfLookPalette(rampPalette());
  try {
    // the galleon's stand-ins
    _resetGalleonArt();
    const added = [];
    registerGalleonArt((entries) => { added.push(...entries); return entries.length; });
    const painted = new Map(galleonArt());
    const deck = await added.find((e) => e.record === TEX.deck).build();
    assert.ok(Buffer.from(deck.data).equals(Buffer.from(dfLook(painted.get(TEX.deck), lookSeed(GALLEON_ARCHIVE, TEX.deck)).data)), 'her deck looked');
    const [day, twin] = Object.entries(GALLEON_NIGHT)[0].map(Number);
    const night = await added.find((e) => e.record === twin).build();
    assert.ok(Buffer.from(night.data).equals(Buffer.from(dfLook(painted.get(day), lookSeed(GALLEON_ARCHIVE, day)).data)), 'her stern\'s night twin: the slice whole, looked with its grain');
    _resetGalleonArt();
    // the town's hangings
    const entries = townPictureEntries(() => true);
    for (const r of [0, 17, TOWN_PICTURES.length - 1]) {
      const got = await entries[r].build();
      const want = dfLook(await TOWN_PICTURES[r].draw(), lookSeed(TOWN_PICTURE_ARCHIVE, r));
      assert.ok(Buffer.from(got.data ?? got.colors).equals(Buffer.from(want.data ?? want.colors)), `hanging ${r} looked`);
    }
    // the caravan's room
    const ups = [];
    paintCaravanRoom({ uploadTexture: (a, r, c) => ups.push([a, r, c]), evictTexture() {} }, null);
    const pics = new Map(caravanRoomPictures(null));
    assert.ok(ups.length > 0 && ups.length === pics.size);
    for (const [a, r, c] of ups) {
      assert.equal(a, WAGON_ARCHIVE);
      assert.ok(Buffer.from(c.colors).equals(Buffer.from(toColor32(dfLook(pics.get(r), lookSeed(WAGON_ARCHIVE, r % LOOK_RECORD_STRIDE))).colors)), `room record ${r} looked`);
    }
  } finally { setDfLookPalette(null); }
  // the doors that upload as their hosts run: each upload line goes through dfLook
  const read = (f) => readFileSync(new URL(`../../src/${f}`, import.meta.url), 'utf8');
  const doors = [
    // STUDIO1: each door paints through wearPainted (systems/studioArt/studioArt.js) - the look laid on the painted picture
    ['scenes/horseCartPool.js', /wearPainted\(WAGON_ARCHIVE, rec, \(\) => toColor32\(dfLook\(pic, lookSeed\(WAGON_ARCHIVE, rec % LOOK_RECORD_STRIDE\)\)\), \(c32, \{ late \}\) => \{\n[^\n]*\n\s+renderer\.uploadTexture\(WAGON_ARCHIVE, rec, c32, opts\);/],
    ['world/wagonModels.js', /toColor32\(dfLook\(pic, lookSeed\(WAGON_ARCHIVE, rec\)\)\)/],
    ['scenes/merchantYardsHost.js', /wearPainted\(YARD_ARCHIVE, rec, \(\) => dfLook\(art, lookSeed\(YARD_ARCHIVE, rec\)\), \(pic, \{ late \}\) => \{ if \(late\) renderer\.releaseTexture\?\.\(YARD_ARCHIVE, rec\); renderer\.uploadTexture\?\.\(YARD_ARCHIVE, rec, pic\); \}/],
    ['scenes/portHost.js', /wearPainted\(PORT_ARCHIVE, rec, \(\) => dfLook\(pic, lookSeed\(PORT_ARCHIVE, rec\)\), \(art, \{ replaced, late \}\) => \{[\s\S]{0,400}?renderer\.uploadTexture\?\.\(PORT_ARCHIVE, rec, art, /],
    ['scenes/lefayMonumentHost.js', /wearPainted\(LEFAY_ARCHIVE, rec, \(\) => dfLook\(art, lookSeed\(LEFAY_ARCHIVE, rec\)\), \(pic, \{ late \}\) => \{ if \(late\) renderer\.releaseTexture\?\.\(LEFAY_ARCHIVE, rec\); renderer\.uploadTexture\?\.\(LEFAY_ARCHIVE, rec, pic\); \}/],
  ];
  for (const [f, re] of doors) assert.match(read(f), re, `${f}: its pictures go up looked`);
  for (const [f, re] of [['scenes/merchantYardsHost.js', /uploadTexture\?\.\(YARD_ARCHIVE, rec, art\)/], ['scenes/portHost.js', /uploadTexture\?\.\(PORT_ARCHIVE, rec, pic,/], ['scenes/lefayMonumentHost.js', /uploadTexture\?\.\(LEFAY_ARCHIVE, rec, art\)/]]) {
    assert.doesNotMatch(read(f), re, `${f}: no painted upload beside it`);
  }
});

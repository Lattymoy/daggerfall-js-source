// OWN-WORK4 (2026-10-31; the owner: "A proper 1 to 1 recreation for everything"): OUR OWN DIVERSE WEAPONS ART,
// combat/diverseWeapons/diverseWeaponsArt.js. Each frame is the player's classic frame reshaped by our look and coloured
// by our metal law, the hand and arm left as Daggerfall's. Pins on made-up frames: the metal law as a literal table and
// its mapping by light, each shape rule (a blade shortened, lengthened, widened, bent, chiselled and grooved; one bit
// of an axe; a staff's rings), Scale2x, the name reader and the file reader. With ARENA2_PATH: every name of the set
// builds at the box the game draws it in, the unshaped looks keep every non-metal pixel Daggerfall's, and the icons.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  METAL_RAMPS, metalRampAt, metalLut, bladeAxis, reshapeBlade, singleBit, staffBands, paintWeaponFrame, paintIcon, scale2x, unspeckle, FULLER, GROOVE_PART,
  parseOwnName, createOwnWeaponArt, FULLER_SHADE,
} from '../../../src/combat/diverseWeapons/diverseWeaponsArt.js';
import { LOOKS, OWN_FILES, shapeOf, ICON_RECORDS, DIVERSE_WEAPONS_METALS } from '../../../src/combat/diverseWeapons/diverseWeaponsIndex.js';
import { CifRciFile } from '../../../src/formats/cifRciFile.js';
import { TextureFile, texName } from '../../../src/formats/textureFile.js';
import { DFPalette } from '../../../src/formats/dfPalette.js';

/** A made-up palette: the metal swatch a ramp of greys by index, every other index its own colour. */
const PAL = { get: (i) => (i >= 0x70 && i <= 0x7f ? { r: (i - 0x70) * 16, g: (i - 0x70) * 16, b: (i - 0x70) * 16 } : { r: i, g: 7, b: 255 - i }) };
const W = 40, H = 80, TIP = 10;
/** A blade up from the frame's bottom edge to y = TIP at x = 20, nine wide at the base to one at the tip, its left
 *  edge a darker shade. */
function blade() {
  const data = new Uint8Array(W * H);
  for (let y = TIP; y < H; y++) {
    const half = Math.round(((y - TIP) / (H - TIP)) * 4);
    for (let x = 20 - half; x <= 20 + half; x++) data[y * W + x] = x === 20 - half ? 0x72 : 0x7a;
  }
  return data;
}
const metalCount = (idx) => idx.reduce((n, i) => n + (i >= 0x70 && i <= 0x7f ? 1 : 0), 0);
const topRow = (idx) => { for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (idx[y * W + x]) return { y, x }; return null; };
const widest = (idx) => { let m = 0; for (let y = 0; y < H; y++) { let n = 0; for (let x = 0; x < W; x++) if (idx[y * W + x]) n++; m = Math.max(m, n); } return m; };

test('OWN-WORK4 law: our metal ramps as designed, and a swatch shade lands on its ramp by its own light - the darkest on the shadow, the lightest on the light', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(METAL_RAMPS)), {
    Iron: [[34, 30, 28], [104, 97, 90], [180, 171, 160]],
    Steel: [[36, 42, 52], [126, 136, 150], [228, 236, 244]],
    Silver: [[62, 64, 74], [170, 174, 186], [252, 252, 255]],
    Elven: [[54, 48, 16], [162, 148, 70], [246, 236, 172]],
    Dwarven: [[58, 32, 12], [170, 110, 48], [252, 214, 140]],
    Mithril: [[36, 52, 70], [128, 162, 190], [228, 244, 255]],
    Adamantium: [[24, 36, 34], [84, 112, 106], [178, 208, 198]],
    Ebony: [[8, 6, 14], [46, 38, 64], [130, 118, 174]],
    Orcish: [[22, 32, 14], [74, 98, 50], [160, 186, 110]],
    Daedric: [[22, 4, 4], [94, 20, 18], [234, 94, 62]],
    chaos: [[40, 8, 56], [152, 40, 172], [246, 198, 66]],
  });
  for (const m of DIVERSE_WEAPONS_METALS) assert.ok(METAL_RAMPS[m], `${m}: a law of its own`);
  const r = METAL_RAMPS.Daedric;
  assert.deepEqual(metalRampAt(r, 0), r[0]); assert.deepEqual(metalRampAt(r, 0.5), r[1]); assert.deepEqual(metalRampAt(r, 1), r[2]);
  assert.deepEqual(metalRampAt([[0, 0, 0], [100, 100, 100], [200, 0, 0]], 0.75), [150, 50, 50], 'the light half between middle and light');
  const lut = metalLut(PAL, r);
  assert.equal(lut.length, 16);
  assert.deepEqual(lut[0], r[0], 'the darkest shade: the shadow');
  assert.deepEqual(lut[15], r[2], 'the lightest: the light');
});

test('OWN-WORK4 shapes: a long blade read off its metal - its axis from the base on the frame edge to the narrow tip', () => {
  const ax = bladeAxis(blade(), W, H);
  assert.ok(Math.abs(ax.axisX) < 0.05 && ax.axisY < -0.99, 'the axis points up, base to tip');
  assert.ok(Math.abs(ax.len - (H - 1 - TIP)) <= 1, `its length ${ax.len}`);
  assert.ok(Math.abs(ax.midX + ax.centre(ax.lo + ax.len / 2) * ax.normX - 20) < 0.6, 'the centre line on the blade');
  assert.equal(bladeAxis(new Uint8Array(W * H).fill(0x7a, 0, 5), W, H), null, 'a sliver is not reshaped');
  const stub = new Uint8Array(W * H);
  for (let y = 30; y < 42; y++) for (let x = 14; x < 24; x++) stub[y * W + x] = 0x7a;
  assert.equal(bladeAxis(stub, W, H), null, 'nor a blade seen end on, no longer than twice its width');
});

test('OWN-WORK4 shapes: shortened, lengthened and widened, bent, chiselled, grooved - each the rule\'s own, the source untouched', () => {
  const src = blade(), before = Uint8Array.from(src);
  const same = reshapeBlade(src, W, H, {});
  assert.deepEqual([...same.idx], [...src], 'no rule: the frame as it was');
  const short = reshapeBlade(src, W, H, { length: 0.45 }).idx;
  assert.ok(topRow(short).y > TIP + 0.5 * (H - TIP), `shortened toward its base: the tip at ${topRow(short).y}`);
  assert.ok(metalCount(short) < 0.75 * metalCount(src));
  const long = reshapeBlade(src, W, H, { length: 1.25, width: 1.3 }).idx;
  assert.ok(topRow(long).y < TIP, 'lengthened past the old tip');
  assert.ok(widest(long) > widest(src), 'and widened');
  const bent = reshapeBlade(src, W, H, { curve: 0.12 }).idx;
  assert.ok(topRow(bent).x >= 20 + 6, `bent toward the tip: the point at x ${topRow(bent).x}`);
  const flat = reshapeBlade(src, W, H, { length: 0.45 }).idx, chisel = reshapeBlade(src, W, H, { length: 0.45, tip: 'chisel' }).idx;
  assert.ok(metalCount(chisel) < metalCount(flat) && topRow(chisel).y > topRow(flat).y, 'the chisel cuts the point');
  const { idx, fuller } = reshapeBlade(src, W, H, { fuller: true });
  assert.deepEqual([...idx], [...src], 'a groove changes no outline');
  const grooved = [...fuller.keys()].filter((p) => fuller[p]);
  assert.ok(grooved.length > 15 && grooved.every((p) => Math.abs((p % W) - 20) <= 1), 'the groove runs down the middle');
  assert.deepEqual([...src], [...before]);
});

test('OWN-WORK4 shapes: a dagger\'s blade alone - redrawn behind the hand that holds it, the pommel past the fist no part of it', () => {
  const src = blade();
  for (let y = 60; y < 66; y++) for (let x = 14; x <= 26; x++) src[y * W + x] = 0x30; // the fist across the blade
  for (let y = 72; y < 75; y++) for (let x = 19; x <= 21; x++) src[y * W + x] = 0x75; // the pommel below it
  src[55 * W + 24] = 0x30; // a finger beside the blade's foot, where the broader blade reaches
  const ax = bladeAxis(src, W, H);
  assert.equal(ax.mask[73 * W + 20], 0, 'the pommel is not blade');
  assert.equal(ax.mask[40 * W + 20], 1);
  assert.ok(ax.axisY < -0.99 && Math.abs(ax.midY + (ax.lo + ax.len) * ax.axisY - TIP) < 1.5, 'the axis runs up the blade to its tip');
  const held = bladeAxis(src, W, H, { held: true });
  assert.ok(held.axisY < -0.99, 'held: the base is the end in the hand');
  const { idx, fuller } = reshapeBlade(src, W, H, { width: 1.5, fuller: true, only: true });
  for (let p = 0; p < src.length; p++) if (src[p] === 0x30) assert.equal(idx[p], 0x30, 'the hand is untouched');
  assert.ok(idx[55 * W + 23] >= 0x70, 'the blade broadened up to the finger, and behind it');
  for (let y = 72; y < 75; y++) assert.equal(idx[y * W + 20], 0x75, 'and the pommel stays where it was');
  assert.equal(fuller[73 * W + 20], 0, 'ungrooved');
  assert.ok(widest(idx.map((i) => (i >= 0x70 && i <= 0x7f ? i : 0)).subarray(0, 55 * W)) > widest(src.subarray(0, 55 * W)), 'the blade broadened');
});

test('OWN-WORK4 shapes: an axe keeps one bit; a staff takes its rings in shaft widths from the tip', () => {
  const axe = new Uint8Array(W * H);
  for (let y = 20; y < 27; y++) for (let x = 5; x <= 35; x++) axe[y * W + x] = 0x78;
  for (let y = 27; y < H; y++) for (let x = 19; x <= 21; x++) axe[y * W + x] = 0x30;
  const one = singleBit(axe, W, H);
  assert.equal(one[22 * W + 6], 0, 'the left bit is gone');
  assert.equal(one[22 * W + 34], 0x78, 'the right bit stays');
  assert.equal(one[22 * W + 20], 0x78, 'and the socket');
  assert.equal(one[40 * W + 20], 0x30, 'the haft is not touched');
  const staff = new Uint8Array(W * H);
  for (let y = 10; y < H; y++) for (let x = 18; x <= 22; x++) staff[y * W + x] = 0x30;
  for (let x = 18; x <= 22; x++) { staff[8 * W + x] = 0x78; staff[9 * W + x] = 0x78; }
  const rings = staffBands(staff, W, H, [[2, 3]]);
  const ringRows = [...new Set([...rings.keys()].filter((p) => rings[p]).map((p) => Math.floor(p / W)))];
  assert.deepEqual(ringRows, [18, 19, 20, 21, 22], 'two to three shaft widths (5 px) below the capped tip at y 8');
  assert.equal(rings[9 * W + 20], 0, 'the cap is metal already');
});

test('OWN-WORK4 AUDIT: the axe\'s bit is the haft\'s right, read base to head, so a swing keeps the same one - upside down, end on, and through an enchantment\'s glow', () => {
  const axe = (haft) => { const d = new Uint8Array(W * H); for (let y = 20; y < 27; y++) for (let x = 5; x <= 35; x++) d[y * W + x] = 0x78; haft(d); return d; };
  // upside down: the haft above the head, so its right is the screen's left
  const flipped = new Uint8Array(W * H);
  for (let y = 53; y < 60; y++) for (let x = 5; x <= 35; x++) flipped[y * W + x] = 0x78;
  for (let y = 0; y < 53; y++) for (let x = 19; x <= 21; x++) flipped[y * W + x] = 0x30;
  const down = singleBit(flipped, W, H);
  assert.equal(down[56 * W + 34], 0, 'upside down, the screen\'s right bit goes');
  assert.equal(down[56 * W + 6], 0x78, 'and the left stays');
  // end on: a stub across the head's foot stands upright under it
  const stub = singleBit(axe((d) => { for (let y = 27; y < 31; y++) for (let x = 14; x <= 26; x++) d[y * W + x] = 0x30; }), W, H);
  assert.equal(stub[22 * W + 5], 0, 'end on, the left bit goes');
  assert.equal(stub[22 * W + 34], 0x78, 'the right stays');
  assert.equal(stub[22 * W + 20], 0x78, 'and the socket');
  // a glow beside the head is not haft: with the palette the haft is its wood alone
  const PAL3 = { get: (i) => (i >= 0x70 && i <= 0x7f ? { r: 128, g: 128, b: 128 } : i === 0x30 ? { r: 120, g: 70, b: 30 } : { r: 90, g: 140, b: 250 }) };
  const glow = axe((d) => {
    for (let y = 27; y < H; y++) for (let x = 19; x <= 21; x++) d[y * W + x] = 0x30;
    for (let y = 4; y < 20; y++) for (let x = 24; x <= 39; x++) d[y * W + x] = 0x40;
  });
  assert.equal(singleBit(glow, W, H, PAL3)[22 * W + 8], 0, 'the left bit goes, the glow no part of the haft');
  assert.equal(singleBit(glow, W, H, PAL3)[22 * W + 30], 0x78);
});

test('OWN-WORK4 AUDIT: a widened blade carries what hugs it out whole, and a pixel the move strands goes - a lone spark stays', () => {
  const src = new Uint8Array(W * H);
  for (let y = 10; y < H; y++) for (let x = 18; x <= 22; x++) src[y * W + x] = 0x7a;
  for (let y = 20; y < 60; y++) src[y * W + 28] = 0x30; // a glow's line, three past the blade's edge
  const { idx } = reshapeBlade(src, W, H, { width: 2 });
  const line = [];
  for (let p = 0; p < idx.length; p++) if (idx[p] === 0x30) line.push(p % W);
  assert.equal(line.length, 40, 'the line whole');
  assert.ok(line.every((x) => x === 30), `moved out by the edge's own growth, not scaled with it (${[...new Set(line)]})`);
  const before = new Uint8Array(25);
  for (const p of [7, 11, 12, 13]) before[p] = 1; // a plus round pixel 12
  before[4] = 1; // a spark alone in the corner
  const out = new Uint8Array(25), from = new Int32Array(25).fill(-1);
  out[0] = 1; from[0] = 12; // moved from the plus, and left alone
  out[24] = 1; from[24] = 4; // moved from the spark
  unspeckle(out, from, before, 5, 5);
  assert.equal(out[0], 0, 'a piece of a line the move stranded goes');
  assert.equal(out[24], 1, 'a spark alone in the source stays');
});

test('OWN-WORK4 AUDIT: a fuller is a groove - its wall on the light\'s side in shadow, its floor darker than the blade, its far wall lit toward the ramp\'s light (mutants: a band; the light\'s side turned; the lit wall unlit)', () => {
  const src = new Uint8Array(W * H);
  for (let y = TIP; y < H; y++) for (let x = 14; x <= 26; x++) src[y * W + x] = 0x7a; // a broad blade up the frame, 13 wide
  const { fuller } = reshapeBlade(src, W, H, { fuller: true });
  // the blade points up, so the light (upper left) falls on its left: the left wall is the shadowed one
  assert.deepEqual([17, 18, 19, 20, 21, 22, 23].map((x) => fuller[40 * W + x]),
    [0, GROOVE_PART.wall, GROOVE_PART.wall, GROOVE_PART.floor, GROOVE_PART.lit, GROOVE_PART.lit, 0]);
  const pic = paintWeaponFrame({ width: W, height: H, data: src }, PAL, 'LONGSWORD', 'Iron');
  const lum = (x) => { const o = (40 * W + x) * 4; return pic.data[o] + pic.data[o + 1] + pic.data[o + 2]; };
  assert.ok(lum(18) < lum(20) && lum(20) < lum(16) && lum(16) < lum(22), `shadow ${lum(18)} < floor ${lum(20)} < blade ${lum(16)} < lit wall ${lum(22)}`);
  assert.ok(FULLER.FLOOR < FULLER.GROOVE && FULLER.GROOVE < 0.5, 'a groove narrower than half the blade');
});

test('OWN-WORK4 colour: the frame painted - clear and the mask clear, the metal by our law, a groove shaded, a ring by the ramp, every other pixel Daggerfall\'s', () => {
  const bm = { width: 4, height: 1, data: new Uint8Array([0, 0xff, 0x7f, 0x30]) };
  const pic = paintIcon(bm, PAL, 'Ebony');
  assert.deepEqual([...pic.data], [0, 0, 0, 0, 0, 0, 0, 0, ...METAL_RAMPS.Ebony[2], 255, 0x30, 7, 255 - 0x30, 255]);
  const frame = paintWeaponFrame({ width: W, height: H, data: blade() }, PAL, 'LONGSWORD', 'Iron');
  const lut = metalLut(PAL, METAL_RAMPS.Iron);
  const groove = [...metalLut(PAL, METAL_RAMPS.Iron)[0x7a - 0x70]].map((c) => Math.round(c * FULLER_SHADE));
  assert.deepEqual([...frame.data.subarray((40 * W + 20) * 4, (40 * W + 20) * 4 + 4)], [...groove, 255], 'the longsword\'s fuller, shaded');
  assert.deepEqual([...frame.data.subarray((70 * W + 17) * 4, (70 * W + 17) * 4 + 4)], [...lut[0x72 - 0x70], 255], 'its edge, by our law');
  const wab = paintWeaponFrame({ width: W, height: 12, data: (() => { const d = new Uint8Array(W * 12); for (let y = 2; y < 12; y++) for (let x = 18; x <= 22; x++) d[y * W + x] = 0x30 + y; return d; })() }, PAL, 'WABBAJACK', 'Iron');
  assert.ok(wab.data[3 + (11 * W + 20) * 4] === 255, 'a staff painted');
});

test('OWN-WORK4 Scale2x: the double-size idle - twice the size, a flat picture flat, a corner rounded and never blurred', () => {
  const px = (r, g, b, a = 255) => [r, g, b, a];
  const flat = { width: 2, height: 2, data: new Uint8Array([...px(5, 6, 7), ...px(5, 6, 7), ...px(5, 6, 7), ...px(5, 6, 7)]) };
  const big = scale2x(flat);
  assert.deepEqual([big.width, big.height], [4, 4]);
  assert.ok([...big.data].every((v, i) => v === flat.data[i % 4]));
  // a diagonal: A on the top-left triangle, B elsewhere - the corner pixel of the B centre takes A where EPX says
  const A = px(1, 1, 1), B = px(9, 9, 9), O = [...A, ...A, ...B, ...A, ...B, ...B, ...B, ...B, ...B];
  const out = scale2x({ width: 3, height: 3, data: new Uint8Array(O) });
  const at = (x, y) => [...out.data.subarray((y * 6 + x) * 4, (y * 6 + x) * 4 + 4)];
  assert.deepEqual(at(2, 2), A, 'the centre\'s top-left takes the edge it meets');
  assert.deepEqual(at(3, 3), B, 'its bottom-right keeps the centre');
  assert.ok(out.data.every((v) => v === 1 || v === 9 || v === 255), 'no colour a picture did not have');
});

test('OWN-WORK4 names: our reader of an asked name - the file, its look and base, record and frame, the metal, the idle\'s double size', () => {
  assert.deepEqual(parseOwnName('KATANAMAGIC.CIF_3-4_Daedric'), { wide: false, file: 'KATANAMAGIC.CIF', look: 'KATANA', base: 'WEAPO104.CIF', record: 3, frame: 4, metal: 'Daedric' });
  assert.deepEqual(parseOwnName('w_WARAXE.CIF_0-0_Iron'), { wide: true, file: 'WARAXE.CIF', look: 'WARAXE', base: 'WEAPON08.CIF', record: 0, frame: 0, metal: 'Iron' });
  assert.equal(parseOwnName('w_WARAXE.CIF_1-0_Iron'), null, 'a double-size idle is record 0 alone');
  assert.equal(parseOwnName('LONGBOW.CIF_0-6_Iron').frame, 6);
  assert.equal(parseOwnName('LONGBOW.CIF_0-7_Iron'), null, 'past the bow\'s seven');
  assert.equal(parseOwnName('MACE.CIF_0-1_Iron'), null, 'the idle is one frame');
  assert.equal(parseOwnName('MACE.CIF_7-0_Iron'), null);
  assert.equal(parseOwnName('MACE.CIF_1-0_Glass'), null); assert.equal(parseOwnName('MACE.CIF_1-0'), null);
  assert.equal(parseOwnName('WEAPON04.CIF_1-0_Iron'), null); assert.equal(parseOwnName(null), null);
  for (const [file, { look, base }] of Object.entries(OWN_FILES)) {
    assert.equal(base, file.includes('MAGIC') ? LOOKS[look].magic : LOOKS[look].plain, file);
    assert.ok(parseOwnName(`${file}_0-0_Steel`), file);
  }
});

test('OWN-WORK4 reader: each file read once and shared, a failed read forgotten so the next ask reads again', async () => {
  let fails = 1;
  const asked = [];
  const art = createOwnWeaponArt(async (n) => { asked.push(n); if (fails-- > 0) throw new Error(`${n}: not yet`); return new Uint8Array(776); });
  await assert.rejects(art.frame('MACE.CIF_1-0_Iron'));
  await assert.rejects(art.frame('MACE.CIF_1-0_Iron'), /no records/, 'read again, and a file of no records is refused');
  assert.equal(await art.frame('NOT.CIF_1-0_Iron'), null, 'not our name: nothing read');
  assert.ok(asked.filter((n) => n === 'WEAPON05.CIF').length === 2);
});

const ARENA2 = process.env.ARENA2_PATH;
const UNSHAPED = new Set(Object.entries(LOOKS).filter(([, l]) => !l.blade && !l.head && !l.bands).map(([n]) => n));

test('OWN-WORK4 (ARENA2): every name of the set builds at the box the game draws it in - the unshaped looks Daggerfall\'s pixel for pixel but the metal; the long blades differ by their rule; the icons', { skip: !ARENA2 && 'ARENA2_PATH not set' }, async () => {
  const file = (n) => new Uint8Array(readFileSync(join(ARENA2, n)));
  const art = createOwnWeaponArt(async (n) => file(n));
  const pal = new DFPalette(); pal.load(file('ART_PAL.COL'), 'ART_PAL.COL');
  const cifs = new Map(), cif = (n) => { if (!cifs.has(n)) { const c = new CifRciFile(); c.load(file(n), n, null); cifs.set(n, c); } return cifs.get(n); };
  const metal = 'Orcish', lut = metalLut(pal, METAL_RAMPS[metal]);
  let built = 0;
  const drawn = {};
  for (const [name, { look, base }] of Object.entries(OWN_FILES)) {
    const c = cif(base);
    shapeOf(name).forEach((n, r) => assert.equal(c.getFrameCount(r), n, `${base} record ${r}: the frames the set names`));
    for (const [r, n] of shapeOf(name).entries()) {
      for (let f = 0; f < n; f++) {
        const pic = await art.frame(`${name}_${r}-${f}_${metal}`), bm = c.getDFBitmap(r, f);
        assert.deepEqual([pic.width, pic.height], [bm.width, bm.height], `${name} ${r}-${f}: the classic record's box`);
        built++;
        let px = 0;
        for (let p = 0; p < bm.data.length; p++) if (pic.data[p * 4 + 3]) px++;
        drawn[`${name}_${r}-${f}`] = px;
        if (!UNSHAPED.has(look) || LOOKS[look].ramp) continue;
        for (let p = 0; p < bm.data.length; p++) {
          const i = bm.data[p], got = pic.data.subarray(p * 4, p * 4 + 4);
          const want = !i ? [0, 0, 0, 0] : i >= 0x70 && i <= 0x7f ? [...lut[i - 0x70], 255] : [pal.get(i).r, pal.get(i).g, pal.get(i).b, 255];
          if (got[0] !== want[0] || got[1] !== want[1] || got[2] !== want[2] || got[3] !== want[3]) assert.fail(`${name} ${r}-${f} pixel ${p}: ${[...got]} for ${want}`);
        }
      }
    }
    const wide = await art.frame(`w_${name}_0-0_${metal}`), idle = c.getDFBitmap(0, 0);
    assert.deepEqual([wide.width, wide.height], [idle.width * 2, idle.height * 2], `${name}: the idle at double size`);
  }
  assert.equal(built, 35 * 31 + 2 * 7);
  // the long blades by their rule, against the longsword on the same frames (the strikes, where the blade is whole)
  const sum = (look) => [1, 2, 3, 4, 5, 6].reduce((n, r) => n + [0, 1, 2].reduce((m, f) => m + drawn[`${look}.CIF_${r}-${f}`], 0), 0);
  assert.ok(sum('TANTO') < 0.7 * sum('LONGSWORD'), 'the tanto is short');
  assert.ok(sum('SHORTSWORD') < sum('LONGSWORD'), 'the short sword shorter');
  assert.ok(sum('BROADSWORD') > sum('LONGSWORD') && sum('CLAYMORE') > sum('LONGSWORD'), 'the broadsword and the claymore broader');
  assert.ok(sum('KATANA') < sum('LONGSWORD'), 'the katana narrow');
  // the icons: the classic record's box, the metal by our law, the rest Daggerfall's, the mask clear
  for (const [archive, n] of Object.entries(ICON_RECORDS)) {
    const t = new TextureFile(); t.load(file(texName(archive)), texName(archive), null);
    for (let r = 0; r < n; r++) {
      const pic = await art.icon(Number(archive), r, metal), bm = t.getDFBitmap(r, 0);
      assert.deepEqual([pic.width, pic.height], [bm.width, bm.height], `${archive}_${r}`);
      const p = bm.data.findIndex((i) => i >= 0x70 && i <= 0x7f);
      if (p >= 0) assert.deepEqual([...pic.data.subarray(p * 4, p * 4 + 3)], lut[bm.data[p] - 0x70], `${archive}_${r}: the metal by our law`);
    }
  }
  const wab = await art.icon(432, 25, 'chaos');
  assert.ok(wab && wab.width > 0, 'the Wabbajack\'s icon');
});

// EG-ZH (2026-10-12, Mac: "I said I want everything"; bible/11-Multiplayer/Elite-Gates.md sections 11.6, 25.1 and 25.8):
// THE ART. DAGGERFALL'S OWN FIRE (formats/baseImageFile.js getFireWallColors32 - DFU's BaseImageFile.cs, verbatim, on
// Unity's Color32.Lerp and its Color -> Color32 in single precision; world/emissiveTextures.js FIRE_WALL_COLOR and
// FIRE_WALL_SCALE, TextureReader.cs:312/:315), driven on synthetic bytes - Daggerfall's data is not here - through a
// TextureFile's own palette and getColor32; both upload arms of scenes/dataPipeline.js taking it for TEXTURE.356 over the
// classic albedo and never on a stand-in. THE CAVERNS' FIRE FALLS dressed in it (world/eliteGates/egHall.js egFireFallFlames, drawn by
// scenes/eliteGates/egFight.js while each burns, its frames at the billboards' rate). THE WEIR KEY'S OWN PICTURE (world/eliteGates/egKeyArt.js)
// under the Spire's held block (world/eliteGates/pseudoArchives.js EG_ARCH_BLOCK.key), on the key's row and on the texture door as its
// archive's stand-in, where TEXTURE.211 record 50 stood.
import '../../modsOff.js';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { unityColor32, unityColor32Lerp } from '../../../src/formats/baseImageFile.js';
import { TextureFile } from '../../../src/formats/textureFile.js';
import { FIRE_WALLS_ARCHIVE, FIRE_WALL_COLOR, FIRE_WALL_SCALE, isEmissive } from '../../../src/world/emissiveTextures.js';
import { egFireFallFlames, EG_FIRE_FALL, egHallCentre } from '../../../src/world/eliteGates/egHall.js';
import { egHallOf } from '../../../src/net/eliteGates/egLaw.js';
import { egHazardParts } from '../../../src/net/eliteGates/egFragLaw.js';
import { createEgFight } from '../../../src/scenes/eliteGates/egFight.js';
import { EG_FIGHT_EMPTY } from '../../../src/net/eliteGates/egLink.js';
import { GENERAL_FPS } from '../../../src/render/flatAnimation.js';
import { egKeyArt, egKeyTexel, WEIR_KEY_ART, EG_KEY_ART_SIZE, EG_KEY_OUTLINE, registerWeirKeyArt } from '../../../src/world/eliteGates/egKeyArt.js';
import { EG_BAND_RAMPS } from '../../../src/world/eliteGates/egBandArt.js';
import { EG_ARCH_ARCHIVES, EG_ARCH_BLOCK, pseudoArchiveOwner } from '../../../src/world/eliteGates/pseudoArchives.js';
import { WEIR_KEY_ROW, weirKeys } from '../../../src/systems/eliteGates/weirKey.js';
import { inventoryItemImage } from '../../../src/systems/item/itemTemplates.js';
import { isVendorArchive, vendorRecordCount, vendorTextureStandIn, setTextureDeriveContext, preloadTextureRecord, decodedTexture } from '../../../src/systems/textureReplacement.js';
import { CELL_W, SLOT_H } from '../../../src/ui/item/itemScroller.js';
import { createDataPipeline } from '../../../src/scenes/dataPipeline.js';
import { addVendorTextures } from '../../../src/systems/textureReplacement.js';
import { egGive8 } from '../../egGive8.mjs';

// PIN MOVED (THE ASCENT - THE ROOMS, LAW 9 - 2026-10-16): these pins were written on spec law 8's ground (its courses along +z
// from the plate, its courts and its lords where law 8 lays them) and stand on it still - the halls they read are law 8's,
// given as a breach of law 8's are given to a client (test/egGive8.mjs); LAW 9's own ground is test/net/eliteGates/law9_height.test.js's and
// test/net/eliteGates/law9_rooms.test.js's. Given before every test (a client that leaves its breach forgets them)
beforeEach(() => {
  egGive8(3, [1]);
});

const rd = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');

test('EG-ZH UNITY\'S COLOUR LAW (formats/baseImageFile.js): Color -> Color32 rounds each clamped channel times 255f half to even, a Color of three opaque; Color32.Lerp clamps t and truncates a + (b - a) * t in single precision - the fire walls\' 0.706, 0.271, 0.086 are 180, 69 and 22; a red of 180 lerped 0.3f toward 0 is 126 (in doubles on 0.3f it would be 125), toward 255 is 202 (rounded it would be 203) (mutants: half up; a double\'s sum; rounding the lerp; t unclamped)', () => {
  assert.deepEqual(unityColor32(FIRE_WALL_COLOR), [180, 69, 22, 255]);
  assert.deepEqual(unityColor32([0, 1, 2, -1]), [0, 255, 255, 0], 'clamped');
  assert.deepEqual(unityColor32([2.5 / 255, 3.5 / 255, 0.5 / 255]), [2, 4, 0, 255], 'half to even: 2.5 is 2, 3.5 is 4, 0.5 is 0');
  assert.equal(unityColor32Lerp(180, 0, 0.3), 126, 'single precision: 180 + (-54.0000038f) is 126f');
  assert.equal(unityColor32Lerp(180, 255, 0.3), 202, 'truncated, never rounded');
  assert.equal(unityColor32Lerp(255, 0, 0.3), 178, 'an albedo\'s cut-out alpha');
  assert.equal(unityColor32Lerp(69, 9, 0.3), 51);
  assert.equal(unityColor32Lerp(10, 200, 2), 200, 't clamped to 1');
  assert.equal(unityColor32Lerp(10, 200, -1), 10, '...and to 0');
  assert.deepEqual([FIRE_WALLS_ARCHIVE, FIRE_WALL_SCALE], [356, 0.3]);
  assert.deepEqual([...FIRE_WALL_COLOR], [0.706, 0.271, 0.086], 'TextureReader.cs:312 - the dim frame\'s average');
  assert.ok(isEmissive(356, 0) && !isEmissive(356, 1) && isEmissive(356, 2) && isEmissive(356, 3), 'the table\'s three, unchanged');
});

test('EG-ZH GetFireWallColors32 ON SYNTHETIC BYTES: a TextureFile\'s own palette and getColor32 make the albedo of a made bitmap (a cut-out index among them), and every texel of the emission is Color32.Lerp(the fire\'s neutral, that texel, 0.3f) over width x height - pinned byte for byte against DFU\'s arithmetic (mutants: the albedo\'s own colours; the scale; the neutral unconverted; a texel skipped)', () => {
  const pal = new Uint8Array(768);
  const set = (i, r, g, b) => { pal[i * 3] = r; pal[i * 3 + 1] = g; pal[i * 3 + 2] = b; };
  set(0, 0, 0, 0); set(1, 255, 255, 255); set(2, 255, 120, 30); set(3, 10, 9, 220);
  const t = new TextureFile();
  assert.equal(t.palette.load(pal), true);
  const bitmap = { width: 2, height: 2, data: new Uint8Array([0, 1, 2, 3]) };
  const albedo = t.getColor32(bitmap, 0);   // index 0 cut out
  const fire = t.getFireWallColors32(albedo.colors, albedo.width, albedo.height, FIRE_WALL_COLOR, FIRE_WALL_SCALE);
  assert.deepEqual([fire.width, fire.height, fire.colors.length], [2, 2, 16]);
  const want = [];
  for (let i = 0; i < 4; i++) for (let c = 0; c < 4; c++) want.push(unityColor32Lerp([180, 69, 22, 255][c], albedo.colors[i * 4 + c], 0.3));
  assert.deepEqual([...fire.colors], want);
  // the rows as getColor32 laid them (bottom-up): row 0 of the albedo is the bitmap's second row (indices 2, 3)
  assert.deepEqual([...fire.colors.slice(0, 8)], [202, 84, 24, 255, 129, 51, 81, 255], 'index 2 (255, 120, 30) and index 3 (10, 9, 220)');
  assert.deepEqual([...fire.colors.slice(8, 16)], [126, 48, 15, 178, 202, 124, 91, 255], 'the cut-out black (alpha 0) and the white');
});

test('EG-ZH THE FIRE WALLS\' UPLOAD (scenes/dataPipeline.js): both arms - a record\'s and a frame\'s - take GetFireWallColors32 for TEXTURE.356 over the CLASSIC albedo (a pack\'s picture over it lights from the reference texture, as TextureReader does), never on a stand-in, and every other emissive record still reuses its albedo (mutants: the arm skipped again; the swap\'s colours lit; a stand-in lit)', () => {
  const S = rd('src/scenes/dataPipeline.js');
  assert.match(S, /import \{ isEmissive, FIRE_WALLS_ARCHIVE, FIRE_WALL_COLOR, FIRE_WALL_SCALE \} from '\.\.\/world\/emissiveTextures\.js';/);
  assert.match(S, /if \(archive === FIRE_WALLS_ARCHIVE\) \{ if \(!t\.vendor\) \{ const classic = swap \? t\.getColor32\(bitmap, opaque \? -1 : 0\) : color32;[^\n]*\n\s*else renderer\.uploadEmissionTexture\(archive, record, color32, \{ white: true, replacement \}\);/);
  assert.match(S, /} else if \(isEmissive\(archive, record\) && !t\.vendor\) \{\n\s*\/\/ EG-ZH[^\n]*\n\s*const classic = swapFrame \? t\.getColor32\(bitmap, 0\) : color32;\n\s*renderer\.uploadEmissionTexture\(archive, key, t\.getFireWallColors32\(classic\.colors, classic\.width, classic\.height, FIRE_WALL_COLOR, FIRE_WALL_SCALE\), \{ white: true, replacement \}\);/);
  assert.equal((S.match(/archive !== FIRE_WALLS_ARCHIVE\) \{/g) ?? []).length, 1, 'the frame\'s arm keeps its albedo arm for every other archive');
  assert.ok(!/isEmissive\(archive, record\) && archive !== FIRE_WALLS_ARCHIVE\) \{\n\s*\/\/ AUDIT 39 F49/.test(S), 'the record\'s arm no longer skips the fire walls');
});

test('EG-ZH THE FIRE WALLS THROUGH THE REAL PIPELINE (scenes/dataPipeline.js, synthetic bytes): a made TEXTURE.356 stood in the pipeline\'s own archive table - record 0 uploads its albedo and an emission map that is GetFireWallColors32 of its classic albedo, white; a frame\'s upload the same under its composite key; record 1 (not emissive) no emission; a pack\'s picture over record 2 uploads as the albedo while the emission still lights from the classic record; another archive\'s emissive record still its albedo (mutants: the swap lit; a frame unlit; the arm thrown on a swap)', async () => {
  const pal = new Uint8Array(768);
  for (let i = 0; i < 256; i++) { pal[i * 3] = i; pal[i * 3 + 1] = (i * 7) & 255; pal[i * 3 + 2] = 255 - i; }
  const t = new TextureFile();
  assert.equal(t.palette.load(pal), true);
  t._recordCount = 4;
  const bm = (r, f = 0) => ({ width: 2, height: 2, data: new Uint8Array([r * 16 + f, 40 + r, 200, 255 - r]) });
  t.getDFBitmap = (r, f) => bm(r, f);
  const ups = [], emis = [];
  const renderer = { uploadTexture: (a, r, c, o) => { ups.push({ a, r, c, o }); return {}; }, uploadEmissionTexture: (a, k, c, o) => { emis.push({ a, k, c, o }); return {}; } };
  const p = createDataPipeline({ renderer, arch: null, palette: t.palette, fetch: async () => { throw new Error('no ARENA2 here'); } });
  p.textureFiles.set(356, t);
  const fireOf = (albedo) => { const out = []; for (let i = 0; i < albedo.colors.length; i++) out.push(unityColor32Lerp([180, 69, 22, 255][i % 4], albedo.colors[i], 0.3)); return out; };
  p.uploadRecord(356, 0, { opaque: true });
  const albedo0 = t.getColor32(bm(0), -1);
  assert.deepEqual([...ups.at(-1).c.colors], [...albedo0.colors], 'the albedo as ever');
  assert.equal(emis.length, 1);
  assert.deepEqual([emis[0].a, emis[0].k, emis[0].o.white], [356, 0, true]);
  assert.deepEqual([...emis[0].c.colors], fireOf(albedo0), 'the emission GetFireWallColors32 of it');
  p.uploadRecord(356, 1, { opaque: true });
  assert.equal(emis.length, 1, 'record 1 is not emissive: none');
  p.uploadRecordFrame(356, 3, 2);
  assert.deepEqual([emis.at(-1).k, emis.at(-1).o.white], ['3#2', true], 'a frame under its composite key');
  assert.deepEqual([...emis.at(-1).c.colors], fireOf(t.getColor32(bm(3, 2), 0)), 'over the frame\'s own albedo');
  // a pack's picture over record 2: the albedo is the pack's, the light the classic record's
  const pack = { width: 2, height: 2, data: new Uint8Array(16).fill(77) };
  addVendorTextures([{ archive: 356, record: 2, frame: 0, fileName: 'egz-356-2', build: async () => pack }]);
  const { preloadTextureRecord: pre } = await import('../../../src/systems/textureReplacement.js');
  assert.ok(await pre(356, 2), 'the pack\'s picture decoded');
  p.uploadRecord(356, 2, { opaque: true });
  assert.deepEqual([...ups.at(-1).c.colors], new Array(16).fill(77), 'the pack\'s picture as the albedo');
  assert.equal(ups.at(-1).o.replacement, true);
  assert.deepEqual([...emis.at(-1).c.colors], fireOf(t.getColor32(bm(2), -1)), 'the light from the classic record');
  assert.equal(emis.at(-1).o.replacement, true);
  // a stand-in has no reference texture (TextureReader.cs:309 `hasReferenceTexture`): its picture uploads, nothing is lit
  const n = emis.length;
  t.vendor = true;
  p.uploadRecord(356, 2, { opaque: true });
  assert.equal(emis.length, n, 'a stand-in: no light');
  delete t.vendor;
  setTextureDeriveContext(null);
});

test('EG-ZH THE CAVERNS\' FIRE FALLS DRESSED (world/eliteGates/egHall.js egFireFallFlames): Daggerfall\'s own TEXTURE.356 record 0; each fall\'s flames stand on its line across the passage, 2 m wide each and evenly spaced, as tall as the passage it crosses, their feet on its floor; any other hazard none (mutants: a flame off the line; the passage\'s height unread; another hazard dressed)', () => {
  assert.deepEqual({ ...EG_FIRE_FALL }, { archive: 356, record: 0, w: 2, h: 4 });
  const spec = egHallOf(3, 2, 0), hz = spec.hazards.find((q) => q.kind === 'fall'), cave = spec.caves[0];
  const F = egFireFallFlames(spec, hz);
  const [x0, z0, x1] = hz.sh, n = Math.round((x1 - x0) / 2);
  assert.equal(F.at.length, n);
  assert.equal(F.w, (x1 - x0) / n);
  assert.equal(F.h, cave.height, 'as tall as its passage');
  for (const [k, p] of F.at.entries()) assert.deepEqual(p, [x0 + (x1 - x0) * ((k + 0.5) / n), hz.y, z0], `flame ${k} on the line`);
  assert.equal(egFireFallFlames(spec, spec.hazards.find((q) => q.kind !== 'fall')), null);
  assert.equal(egFireFallFlames(spec, { kind: 'fall', sh: [0, 1] }), null);
  assert.equal(egFireFallFlames({ caves: [] }, { kind: 'fall', sh: [0, 5, 4, 5], y: 2 }).h, 4, 'no passage: the default height');
});

test('EG-ZH THE FIRE FALLS IN THE FIGHT (scenes/eliteGates/egFight.js): TEXTURE.356 asked once; a fall burning stands its flames among the frame\'s batches - one batch a fall, its frame the clock\'s at the billboards\' rate, each frame uploaded once through the pipeline\'s frame door (the fire walls\' arm lights it); told, or quiet, none; no data, no flames and nothing thrown; freed on a new hall and on the way out (mutants: drawn while told; a batch a frame; the frame clock frozen; never freed)', async () => {
  const seed = 3, spec = egHallOf(seed, 2, 0), hz = spec.hazards.find((q) => q.kind === 'fall');
  const centre = egHallCentre(spec);
  const ph = (hz.phase ?? 0) * 1000;
  const live = 50_000 + 4000 - (((50_000 + ph) % 5000) + 5000) % 5000 + 0;   // a moment of a cycle's live part
  let t = live;
  const st = () => egHazardParts(hz, t / 1000).find((p) => p.st)?.st ?? 'quiet';
  assert.equal(st(), 'live', 'a burning moment');
  const E = { b: '0123456789abcdef', h: 2, seed, geo: 0, sg: 'trial', end: null, hw: 1, fight: { ...EG_FIGHT_EMPTY, h: 2 }, co: [] };
  const made = [], freed = [], ups = [], asked = [];
  const renderer = { textures: new Set(), createBillboardBatch: (a, r, size, at) => { const b = { a, r, size, at }; made.push(b); return b; }, destroyBillboardBatch: (b) => freed.push(b) };
  const fight = createEgFight({ link: { state: () => E }, now: () => t, renderer, getTexture: async (a) => { asked.push(a); return { recordCount: 4, getFrameCount: (r) => (r === 0 ? 4 : 1) }; },
    uploadRecordFrame: (a, r, f) => { ups.push([a, r, f]); renderer.textures.add(`${a}_${r}#${f}`); }, feet: () => null, player: () => null });
  fight.frame(); fight.frame();
  await new Promise((r) => setTimeout(r, 0));
  fight.frame();
  assert.deepEqual(asked, [356], 'asked once, never again while it is on its way');
  assert.equal(made.length, 1, 'one batch for the fall');
  const b = made[0], F = egFireFallFlames(spec, hz);
  assert.equal(b.a, 356); assert.deepEqual(b.size, { w: F.w, h: F.h }); assert.deepEqual(b.at, F.at); assert.deepEqual(b.origin, centre);
  assert.ok(fight.batches().includes(b), 'among the frame\'s batches');
  const frameAt = (ms) => Math.floor((ms / 1000) * GENERAL_FPS) % 4;
  assert.equal(b.record, `0#${frameAt(t)}`);
  t += 1000 / GENERAL_FPS; fight.frame();
  assert.equal(b.record, `0#${frameAt(t)}`, 'the next frame, at the billboards\' rate');
  fight.frame();
  assert.equal(made.length, 1, 'kept, never one a frame');
  assert.equal(new Set(ups.map((u) => u.join(':'))).size, ups.length, 'each frame uploaded once');
  assert.ok(ups.every(([a, r]) => a === 356 && r === 0));
  // the fall quiet, then told: no flames
  while (st() === 'live') t += 100;
  fight.frame();
  assert.ok(!fight.batches().includes(b), 'quiet: not drawn');
  while (st() !== 'tell') t += 100;
  fight.frame();
  assert.ok(!fight.batches().includes(b), 'told, not yet burning: not drawn');
  assert.equal(fight.state().fires, 1);
  fight.leave();
  assert.ok(freed.includes(b), 'freed on the way out');
  assert.equal(fight.state().fires, 0);
  // no data: nothing drawn, nothing thrown
  const made2 = [];
  t = live;
  const quiet = createEgFight({ link: { state: () => E }, now: () => t, renderer: { textures: new Set(), createBillboardBatch: (...a) => { made2.push(a); return {}; } }, getTexture: async () => { throw new Error('no ARENA2'); }, uploadRecordFrame: () => {}, feet: () => null, player: () => null });
  quiet.frame(); await new Promise((r) => setTimeout(r, 0)); quiet.frame(); quiet.frame();
  assert.equal(made2.length, 0);
});

test('EG-ZH THE WEIR KEY\'S OWN PICTURE (world/eliteGates/egKeyArt.js): the same pixels every call, 32 x 22 inside an item\'s cell; a bow ringing a blue stone, a shaft, a collar and a two-step bit; every opaque texel the Galleries\' gold leaf, its Battlemage blue, the stone\'s glint or the outline, the rest clear; outlined all round; lit from the top-left (mutants: a part dropped; the outline gone; the ground left opaque; the light from below)', () => {
  const a = egKeyArt(), b = egKeyArt();
  assert.deepEqual([...a.colors], [...b.colors], 'the same pixels every call');
  assert.deepEqual([a.width, a.height], [EG_KEY_ART_SIZE.w, EG_KEY_ART_SIZE.h]);
  assert.deepEqual({ ...EG_KEY_ART_SIZE }, { w: 32, h: 22 });
  assert.ok(a.width <= CELL_W - 4 && a.height <= SLOT_H - 4, 'inside an item list\'s cell, never enlarged');
  const px = (x, y) => [...a.colors.slice((y * a.width + x) * 4, (y * a.width + x) * 4 + 4)];
  const key = (c) => c.slice(0, 3).join(',');
  const gold = new Set(EG_BAND_RAMPS[0].metal.map((c) => c.join(','))), blue = new Set([...EG_BAND_RAMPS[0].accent.map((c) => c.join(',')), '168,196,240']);
  let golds = 0, stones = 0, outlines = 0;
  for (let y = 0; y < a.height; y++) {
    for (let x = 0; x < a.width; x++) {
      const c = px(x, y), k = egKeyTexel(x, y);
      if (k === 'gold') { assert.ok(gold.has(key(c)) && c[3] === 255, `gold at ${x},${y}`); golds++; }
      else if (k === 'stone') { assert.ok(blue.has(key(c)) && c[3] === 255, `stone at ${x},${y}`); stones++; }
      else if (c[3] === 255) { assert.equal(key(c), EG_KEY_OUTLINE.join(','), `outline at ${x},${y}`); outlines++; }
      else assert.deepEqual(c, [0, 0, 0, 0], `clear at ${x},${y}`);
    }
  }
  assert.ok(golds > 120 && stones > 25 && outlines > 60, `${golds} gold, ${stones} stone, ${outlines} outline`);
  assert.equal(egKeyTexel(7, 10), 'stone', 'the bow\'s heart'); assert.equal(egKeyTexel(1, 10), 'gold', 'its ring');
  assert.equal(egKeyTexel(20, 10), 'gold', 'the shaft'); assert.equal(egKeyTexel(15, 7), 'gold', 'the collar');
  assert.equal(egKeyTexel(23, 15), 'gold', 'the bit\'s first step'); assert.equal(egKeyTexel(28, 18), 'gold', 'and its second');
  assert.equal(egKeyTexel(20, 15), null, 'between them clear');
  for (let y = 0; y < a.height; y++) for (let x = 0; x < a.width; x++) {
    if (!egKeyTexel(x, y)) continue;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (nx >= 0 && ny >= 0 && nx < a.width && ny < a.height && !egKeyTexel(nx, ny)) assert.equal(px(nx, ny)[3], 255, `outlined at ${nx},${ny}`); }
  }
  const luma = (c) => c[0] * 0.3 + c[1] * 0.59 + c[2] * 0.11;
  assert.ok(luma(px(20, 9)) > luma(px(20, 11)), 'the shaft\'s top lit, its underside a step down');
});

test('EG-ZH THE KEY\'S PICTURE, KEPT AND DRAWN: under the Spire\'s held block\'s second number (the page\'s "the arch, the key and the beacon" - 38281, 38282, 38283), registered as the block\'s; the key\'s row and every Weir Key\'s list icon name it, not TEXTURE.211 record 50; on the texture door as its archive\'s stand-in - one record, its picture decoded the key\'s, rows bottom-up as every upload (mutants: the row left on the Talisman; the stand-in unregistered; the block moved)', async () => {
  assert.deepEqual({ ...EG_ARCH_BLOCK }, { arch: 38281, key: 38282, beacon: 38283 });
  assert.equal(EG_ARCH_BLOCK.key, EG_ARCH_ARCHIVES.from + 1);
  assert.deepEqual({ ...WEIR_KEY_ART }, { archive: 38282, record: 0 });
  assert.equal(pseudoArchiveOwner(38282).name, 'EG_ARCH_ARCHIVES', 'inside the registered block');
  assert.match(pseudoArchiveOwner(38282).what, /the Weir Key \(38282, painted - world\/eliteGates\/egKeyArt\.js\)/);
  assert.deepEqual([WEIR_KEY_ROW.worldTextureArchive, WEIR_KEY_ROW.worldTextureRecord], [38282, 0]);
  const img = inventoryItemImage(weirKeys(3));
  assert.deepEqual([img.archive, img.record], [38282, 0], 'a list draws the key\'s own');
  assert.ok(isVendorArchive(38282), 'the archive is its stand-in');
  assert.equal(vendorRecordCount(38282), 1);
  assert.equal(registerWeirKeyArt(() => 99), 0, 'registered once');
  setTextureDeriveContext({});
  const got = await preloadTextureRecord(38282, 0);
  assert.ok(got, 'decoded');
  const art = egKeyArt(), row = art.width * 4;
  assert.deepEqual([got.width, got.height], [32, 22]);
  assert.deepEqual([...got.colors.slice(0, row)], [...art.colors.slice((art.height - 1) * row)], 'its bottom row first (color32 order)');
  assert.deepEqual(decodedTexture(38282, 0, 0, 'Albedo', 7) && decodedTexture(38282, 0, 0, 'Albedo', 7).width, 32, 'a dye asks the same picture (the port\'s own art takes none)');
  assert.deepEqual(vendorTextureStandIn(38282).getSize(0), { width: 32, height: 22 }, 'the shell measures it, as the icon doors ask');
  setTextureDeriveContext(null);
  assert.ok(!/worldTextureArchive: 211/.test(rd('src/systems/eliteGates/weirKey.js')), 'the Talisman\'s picture gone');
});

// ARN3 (2026-10-26; Mac: "We were instructed to remove Dagger Exapanded Enemy textures. Is there any way to retain it
// but also oblige the creators request?", then "let's do arena") - THE ENEMY EXPANSION WITHOUT ITS AUTHORS' ART.
// The stand-ins table (dexStandIns.js) against the mod's own tables; the classic copies' record law and the repaints'
// frames (unpainted.json); TES: Arena's sprites in the mod's layout (dexArena.js) - mirrored into Daggerfall's facing,
// scaled to the height the authors' art stood at, in place of the copies once the player's Arena is read; and the
// store and the picker that bring Arena in. The corpus halves read the real data when ARENA2_PATH / TES_ARENA_PATH
// name it (`sh tools/fetch-data.sh`, `sh tools/fetch-arena.sh`).
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEX_ART } from '../../../src/systems/enemyExpansion/dexArt.js';
import { DEX_TABLE_TEXT } from '../../../src/systems/enemyExpansion/dexTableText.js';
import { readCsvTable, parseCsInt } from '../../../src/systems/enemyExpansion/dexCsv.js';
import { DEX_STAND_INS, DEX_CORPSE_RECORDS, DEX_UNPAINTED, PERSON_CORPSE, classicCorpseOf, classicRecordOf, classicStandInEntries } from '../../../src/systems/enemyExpansion/dexStandIns.js';
import { DEX_CLASSIC_FRAMES } from '../../../src/systems/enemyExpansion/dexClassicFrames.js';
import { arenaSourceOf, arenaPicture, visibleHeight, dexArenaEntries, registerDexArenaArt, TES_ARENA_XML_VENDOR } from '../../../src/systems/enemyExpansion/dexArena.js';
import { installDexSprites, _resetDexSprites, ARENA_HOLD_MS } from '../../../src/systems/enemyExpansion/dexSprites.js';
import { addVendorTextures, removeVendorTextures, clearVendorTextures, vendorFrameCount, textureTiersSettled } from '../../../src/systems/textureReplacement.js';
import { unregisterBillboardXml, billboardXmlScale } from '../../../src/world/billboardXml.js';
import { DFPalette } from '../../../src/formats/dfPalette.js';
import { TesArenaBsa } from '../../../src/formats/tesArena/tesArenaBsa.js';
import { TesArenaCfaFile } from '../../../src/formats/tesArena/tesArenaCfa.js';
import { loadTesArenaPalette } from '../../../src/formats/tesArena/tesArenaPalette.js';
import { countClassicFrames, classicFramesText } from '../../../tools/dexStandInFrames.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const rd = (p) => readFileSync(join(ROOT, p), 'utf8');
const ARENA2 = process.env.ARENA2_PATH && existsSync(join(process.env.ARENA2_PATH, 'ART_PAL.COL')) ? process.env.ARENA2_PATH : null;
const TES_ARENA = process.env.TES_ARENA_PATH && existsSync(join(process.env.TES_ARENA_PATH, 'GLOBAL.BSA')) ? process.env.TES_ARENA_PATH : null;
const layouts = () => Object.fromEntries(Object.entries(DEX_ART).map(([a, art]) => [a, art.frames]));
const table = (name) => readCsvTable(DEX_TABLE_TEXT[`${name}.csv`]);

test('ARN3 the stand-ins are exactly the archives the authors\' art was in, each drawn from a classic archive (Arena\'s too for the creatures it has), and the corpse records are the mod\'s own tables\'', () => {
  const theirs = Object.entries(DEX_ART).filter(([, a]) => a.from !== 'derived').map(([a]) => Number(a));
  assert.deepEqual(Object.keys(DEX_STAND_INS).map(Number), theirs);
  for (const [a, s] of Object.entries(DEX_STAND_INS)) {
    assert.ok(DEX_CLASSIC_FRAMES[s.classic], `${a}: TEXTURE.${s.classic} is counted (tools/dexStandInFrames.mjs)`);
    if (s.arena) assert.ok(s.height > 0, `${a}: the height Arena's ${s.arena} is scaled to`);
  }
  assert.deepEqual(Object.entries(DEX_STAND_INS).filter(([, s]) => s.arena).map(([a, s]) => `${a}:${s.arena}`), [
    '1600:GOBLIN', '1601:LIZARD', '1602:HOM', '1605:SKELE', '1607:LIZARD', '1611:MEDUSA', '1612:WOLF0', '1613:WOLF0', '1614:HOUND',
    '1615:SWOLF0', '1618:TROLL', '1622:WRAITH', '1623:GHOST', '1624:SPIDER', '1625:ICE', '1626:GHOUL', '1627:DEAMON', '1628:PAT',
    '1629:IRON', '1630:GHOUL', '1631:STONE',
  ], 'twenty-one archives in Arena\'s own sprites');
  // the corpse records: every table row whose corpse archive is its own texture's archive, and no other
  const want = {};
  for (const name of ['MonsterBase.mdb', 'ClassBase.mdb']) {
    const t = table(name);
    for (const r of t.rows) {
      for (const [ac, rc] of [['CorpseTextureArchive', 'CorpseTextureRecord'], ['FemaleCorpseTextureArchive', 'FemaleCorpseTextureRecord']]) {
        const ca = t.column(ac), cr = t.column(rc);
        if (ca == null || !r.tokens[ca]) continue;
        const archive = parseCsInt(r.tokens[ca]);
        if (DEX_ART[archive]) want[archive] = parseCsInt(r.tokens[cr]);
      }
    }
  }
  assert.deepEqual(DEX_CORPSE_RECORDS, Object.fromEntries(Object.entries(want).sort(([x], [y]) => x - y)));
});

test('ARN3 a classic copy\'s record law: its own record where the sprite has it; a ranged or spell record it lacks its attack at the same facing, a hurt or idle one its move\'s (mutants: the facing lost; a hurt from the attack)', () => {
  const lamia = DEX_CLASSIC_FRAMES[297];   // fifteen records: move, attack, hurt
  assert.equal(lamia.length, 15);
  assert.equal(classicRecordOf(7, lamia), 7);
  assert.equal(classicRecordOf(12, lamia), 12, 'its own hurt');
  assert.equal(classicRecordOf(17, lamia), 2, 'no idle: its move at the same facing');
  assert.equal(classicRecordOf(23, lamia), 8, 'no spell: its attack at the same facing');
  assert.equal(classicRecordOf(30, lamia), null);
});

/** A fake pipeline context: every classic record is a 2x2 picture, its scale -80. */
const asked = [];
const ctx = { classicRgba: async (a, r, f) => { asked.push([a, r, f]); return { width: 2, height: 2, data: new Uint8Array(16) }; }, classicScale: async () => ({ width: -80, height: -80 }) };

test('ARN3 the classic copies: a repaint\'s pictures from the frames it was painted over, at the mod\'s own counts and xml; another creature\'s at its own counts and record scale; the corpse from the classic creature\'s corpse', async () => {
  const hunter = classicStandInEntries(1504, DEX_ART[1504].frames);
  assert.deepEqual(DEX_ART[1504].frames.map((_, r) => hunter.filter((e) => e.record === r).length), DEX_ART[1504].frames, 'the Bounty Hunter keeps the mod\'s layout');
  asked.length = 0;
  const pic = await hunter.find((e) => e.record === 20 && e.frame === 3).build(ctx);
  assert.deepEqual(asked, [DEX_UNPAINTED['1504_20-3'].from]);
  assert.equal(pic.scale, undefined, 'its xml sizes it');
  const goblin = classicStandInEntries(1600, DEX_ART[1600].frames);
  const orc = DEX_CLASSIC_FRAMES[262];
  assert.deepEqual([0, 5, 12, 17].map((r) => goblin.filter((e) => e.record === r).length), [orc[0], orc[5], 1, 1], 'the Orc\'s own frames');
  asked.length = 0;
  const body = await goblin.find((e) => e.record === DEX_CORPSE_RECORDS[1600]).build(ctx);
  assert.deepEqual([asked[0], body.scale], [[...classicCorpseOf(262), 0], { width: -80, height: -80 }], 'the Orc\'s corpse, at its record\'s scale');
  assert.deepEqual(classicCorpseOf(262), [96, 2]);
  assert.deepEqual(classicCorpseOf(491), PERSON_CORPSE, 'no classic creature wears it: a dead man');
  // the Knight Rider's set is derived but for its corpse
  const rider = classicStandInEntries(1500, DEX_ART[1500].frames);
  assert.deepEqual(rider.map((e) => `${e.record}-${e.frame}`), ['20-0']);
  asked.length = 0;
  await rider[0].build(ctx);
  assert.deepEqual(asked, [[380, 1, 0]]);
});

test('ARN3 unpainted.json: every repaint picture maps to a frame of the very sprite it was painted over, but the riders\' new attack drawings and their corpse', () => {
  const byArchive = {};
  for (const [name, spec] of Object.entries(DEX_UNPAINTED)) {
    const a = Number(name.split('_')[0]);
    (byArchive[a] ??= []).push(name);
    assert.deepEqual(Object.keys(spec), ['from']);
    const [src, rec, frame] = spec.from;
    assert.equal(src, DEX_STAND_INS[a].classic, `${name}: TEXTURE.${DEX_STAND_INS[a].classic}`);
    assert.ok(frame < DEX_CLASSIC_FRAMES[src][rec], `${name}: ${src}_${rec}-${frame} is a frame of it`);
  }
  assert.deepEqual(Object.keys(byArchive).map(Number), [1504, 1505, 1509, 1511, 1512, 1530, 1531, 1532, 1533, 1609]);
  const unmapped = (a) => DEX_ART[a].frames.flatMap((n, r) => Array.from({ length: n }, (_, f) => `${r}`).filter((_, f) => !DEX_UNPAINTED[`${a}_${r}-${f}`]));
  assert.deepEqual([...new Set(unmapped(1530))], ['5', '6', '20']);
  assert.deepEqual([...new Set(unmapped(1531))], ['5', '6', '9']);
  for (const a of [1532, 1533]) assert.deepEqual([...new Set(unmapped(a))], ['5', '9']);
  for (const a of [1504, 1505, 1509, 1511, 1512, 1609]) assert.deepEqual(unmapped(a), [], `${a}: every picture`);
});

test('ARN3 THE CLASSIC COUNTS ARE THE DATA\'S (ARENA2): dexClassicFrames.js is what tools/dexStandInFrames.mjs writes off the player\'s files', { skip: !ARENA2 && 'ARENA2_PATH not set' }, () => {
  assert.equal(rd('src/systems/enemyExpansion/dexClassicFrames.js'), classicFramesText(countClassicFrames(ARENA2)));
});

test('ARN3 Arena\'s layout: the walk, the front\'s attack (a turned facing\'s first four steps), a look aside for hurt, the first frame idle, the death\'s last frame the corpse (mutants: the attack from a side file; the corpse the first death frame)', () => {
  const counts = { 1: 12, 2: 8, 3: 8, 4: 8, 5: 8, 6: 3 };
  assert.deepEqual(arenaSourceOf(0, counts, 20), { file: 1, frames: [0, 1, 2, 3, 4, 5] });
  assert.deepEqual(arenaSourceOf(3, counts, 20), { file: 4, frames: [0, 1, 2, 3, 4, 5] });
  assert.deepEqual(arenaSourceOf(5, counts, 20), { file: 1, frames: [8, 9, 10, 11] }, 'Arena attacks facing you');
  assert.deepEqual(arenaSourceOf(7, counts, 20), { file: 3, frames: [0, 1, 2, 3] });
  assert.deepEqual(arenaSourceOf(12, counts, 20), { file: 3, frames: [6] });
  assert.deepEqual(arenaSourceOf(19, counts, 20), { file: 5, frames: [0] });
  assert.deepEqual(arenaSourceOf(20, counts, 20), { file: 6, frames: [2] });
  assert.deepEqual(arenaSourceOf(20, counts, 25), { file: 1, frames: [8, 9, 10, 11] }, 'a ranged or spell record: the attack');
  assert.equal(arenaSourceOf(30, counts, 20), null);
  const homunculus = { 1: 12, 2: 6, 3: 6, 4: 6, 5: 6, 6: 3 };
  assert.deepEqual(arenaSourceOf(11, homunculus, 15), { file: 2, frames: [0] }, 'a file with no look aside: its first frame');
  assert.deepEqual(arenaSourceOf(15, homunculus, 15), { file: 6, frames: [2] }, 'the corpse record before the idle');
});

test('ARN3 an Arena picture is mirrored into Daggerfall\'s facing, index 0 clear; a creature\'s height is the rows it draws on', () => {
  const palette = new DFPalette();
  palette.fill(0, 0, 0);
  palette.paletteBuffer[3 * 5] = 255;   // index 5 red
  const file = { width: 3, height: 3, frames: [Uint8Array.of(0, 0, 0, 5, 0, 0, 0, 0, 0)] };
  const pic = arenaPicture(file, 0, palette);
  assert.deepEqual([...pic.data.subarray(12, 24)], [0, 0, 0, 0, 0, 0, 0, 0, 255, 0, 0, 255], 'the left pixel is drawn on the right');
  assert.equal(visibleHeight(file), 1);
  assert.equal(visibleHeight({ width: 1, height: 4, frames: [Uint8Array.of(0, 1, 0, 1)] }), 3, 'top to bottom, the gap between counted');
});

test('ARN3 the player\'s Arena read: nothing attached leaves the classic copies standing; attached, its sprites take their archives and the xml their scale (mutant: the copies never removed)', async () => {
  let removed = 0, added = 0, xml = 0;
  const deps = { layouts: layouts(), add: (e) => { added += e.length; return e.length; }, remove: () => { removed++; }, xml: () => { xml++; } };
  assert.equal(await registerDexArenaArt({ ...deps, files: async () => null }), 0);
  assert.deepEqual([removed, added, xml], [0, 0, 0], 'no Arena: nothing moves');
  // the install waits for the read a bounded while, and a read that throws costs Arena's sprites, never the install
  clearVendorTextures(); _resetDexSprites();
  let release = null;
  installDexSprites({ arena: () => new Promise((r) => { release = r; }) });
  assert.ok(textureTiersSettled(), 'an archive\'s first load waits for the read');
  while (!release) await Promise.resolve();
  release(0);
  await textureTiersSettled();
  assert.equal(textureTiersSettled(), null, 'and no longer once it is read');
  clearVendorTextures(); _resetDexSprites();
  installDexSprites({ arena: async () => { throw new Error('a store that will not read'); } });
  await textureTiersSettled();
  assert.ok(vendorFrameCount(1628, 0) > 0, 'the copies stand');
  clearVendorTextures(); _resetDexSprites(); unregisterBillboardXml('daggerfall-enemy-expansion');
  assert.ok(ARENA_HOLD_MS >= 1000 && ARENA_HOLD_MS <= 10000);
  // a door that drops an archive's copies before Arena's are added
  addVendorTextures([{ archive: 9901, record: 0, frame: 0, standIn: true, build: async () => null }, { archive: 9902, record: 0, frame: 0, standIn: true, build: async () => null }]);
  assert.equal(removeVendorTextures((e) => e.archive === 9901), 1);
  assert.equal(vendorFrameCount(9902, 0), 1);
  clearVendorTextures();
});

test('ARN3 THE CORPUS (Arena 1.06): every Arena archive of the table is drawn in full in the mod\'s layout, mirrored, at the authors\' height, and registers over the copies', { skip: !TES_ARENA && 'TES_ARENA_PATH not set' }, async (t) => {
  t.after(() => { clearVendorTextures(); _resetDexSprites(); unregisterBillboardXml('daggerfall-enemy-expansion'); unregisterBillboardXml(TES_ARENA_XML_VENDOR); });
  const bsaBytes = new Uint8Array(readFileSync(join(TES_ARENA, 'GLOBAL.BSA'))), palBytes = new Uint8Array(readFileSync(join(TES_ARENA, 'PAL.COL')));
  const bsa = new TesArenaBsa(bsaBytes), palette = loadTesArenaPalette(palBytes);
  const { entries, scales } = dexArenaEntries(bsa, palette, layouts());
  const arena = Object.entries(DEX_STAND_INS).filter(([, s]) => s.arena).map(([a]) => Number(a));
  assert.deepEqual([...new Set(entries.map((e) => e.archive))], arena, 'all twenty-one');
  for (const a of arena) {
    DEX_ART[a].frames.forEach((n, r) => assert.ok(!n || entries.some((e) => e.archive === a && e.record === r && e.frame === 0), `${a}_${r}-0`));
    const s = DEX_STAND_INS[a];
    const front = new TesArenaCfaFile().load(bsa.get(`${s.arena}1.CFA`), `${s.arena}1.CFA`);
    const file = { width: front.header.widthUncompressed, height: front.header.height, frames: front.frames };
    assert.ok(Math.abs(visibleHeight(file) * scales[a][0][1] - s.height) < 1e-9, `${a} stands ${s.height} tall`);
  }
  // the Minotaur's front attack, frame 2: PAT1.CFA's frame 10, mirrored
  const e = entries.find((x) => x.archive === 1628 && x.record === 5 && x.frame === 2);
  const pic = await e.build();
  const cfa = new TesArenaCfaFile().load(bsa.get('PAT1.CFA'), 'PAT1.CFA');
  const { widthUncompressed: w } = cfa.header, src = cfa.frames[10];
  for (let i = 0; i < src.length; i++) {
    const x = i % w, y = (i - x) / w, idx = src[y * w + (w - 1 - x)];
    assert.equal(pic.data[i * 4 + 3], idx ? 255 : 0);
    if (idx) { assert.equal(pic.data[i * 4], palette.getRed(idx)); break; }
  }
  // registered over the copies
  clearVendorTextures(); _resetDexSprites();
  installDexSprites({ arena: (deps) => registerDexArenaArt({ ...deps, files: async () => ({ bsa: bsaBytes, pal: palBytes }) }) });
  await textureTiersSettled();
  assert.equal(vendorFrameCount(1628, 0), 6, 'the walk\'s six - the Daedroth\'s copy is gone');
  assert.equal(vendorFrameCount(1628, 5), 4, 'the attack\'s four');
  assert.deepEqual(billboardXmlScale(1628, 0), { x: scales[1628][0][0], y: scales[1628][0][1] });
  assert.equal(vendorFrameCount(1603, 0), DEX_CLASSIC_FRAMES[258][0], 'a creature Arena does not have keeps its copy');
});

test('ARN2 the store and the picker: TES: Arena is an asset store of its own, kept apart from ARENA2, and the pick keeps its two files (by source)', () => {
  const d = rd('src/scenes/dataSource.js');
  assert.match(d, /const TES_ARENA_STORE = 'tesarena';/);
  assert.match(d, /const ASSET_STORES = \[[^\]]*\bTES_ARENA_STORE\b[^\]]*\];/);
  assert.match(d, /export const TES_ARENA_FILES = Object\.freeze\(\['GLOBAL\.BSA', 'PAL\.COL'\]\);/);
  assert.match(d, /storeAssets\(TES_ARENA_STORE, files, \(base\) => TES_ARENA_FILES\.includes\(base\.toUpperCase\(\)\)/);
  assert.doesNotMatch(d.slice(d.indexOf('export async function clearStoredData'), d.indexOf('async function storeAssets')), /TES_ARENA_STORE/, 'an ARENA2 re-pick keeps it');
  const m = rd('src/ui/enhanced/enhancedMenu.js');
  assert.match(m, /ds\.pickTesArenaFiles\(\)/, 'the packs card attaches it');
  assert.match(m, /d\.clearStoredTesArena\(\)/, 'and removes it');
});

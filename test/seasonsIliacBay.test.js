// SIB1 - SEASONS OF THE ILIAC BAY (RosyTheRascal), ported 1:1, and the
// reader that lets the player's own copy of the mod in.
//
// The mod's script is a compiled DLL; its behaviour was read off the
// IL and is restated in systems/seasonsIliacBay.js method by method.
// The pins here hold that restatement to the IL's tables and checks,
// the size law, the state machine and its events, then the door: LZ4
// blocks and DXT blocks against hand-built vectors, and the UnityFS +
// SerializedFile reader against a bundle BUILT HERE - the real bundle
// carries the mod's textures, which the doctrine keeps out of the
// repository, so the reader's pin writes its own container (the same
// layout, header for header, that the reference extraction of the
// real one verified 374 of 374 assets byte for byte against).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { lz4BlockDecompress } from '../src/formats/lz4.js';
import { dxtDecode } from '../src/formats/dxt.js';
import { readUnityBundle, readUnityFs, readSerializedFile, COMMON_STRINGS, TEXTURE_FORMAT, parseUnityVersion, usesNewArchiveFlags } from '../src/formats/unityBundle.js';
import {
  SEASONS_MOD, NO_INSTALLED_SEASON, BILLBOARD_SCALE, managedArchivesForSeason, archivePrefix, PREFIX_FOLDER,
  parseRecordFromFilename, filesForPrefix, seasonalRecordSet, seasonalBillboardSize, atlasKey, SeasonHelper,
} from '../src/systems/seasonsIliacBay.js';
import {
  seasonsAssetKey, setSeasonsSources, clearSeasonsSources, seasonsSourcesCount, loadSeasonsTextures, seasonsInstalled,
  bundleManifest, DFMOD_KEY_PREFIX, LOOSE_KEY_PREFIX,
} from '../src/systems/seasonsIliacBayAssets.js';
import { SEASONS } from '../src/systems/gameDate.js';
import { scaledBillboardSize } from '../src/world/rmbFlats.js';
import { MOD_SETTINGS } from '../src/systems/modSettings.js';
import { CREDITS } from '../src/ui/credits.js';
import { textureStoreKey } from '../src/scenes/dataSource.js';
import { textureEntry } from '../src/systems/textureReplacement.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

// ═══ the script's tables ════════════════════════════════════════════════

test('SIB1: GetManagedArchivesForSeason - the four woodland sets below Summer, the three snow sets in Winter, nothing in Summer', () => {
  assert.deepEqual(managedArchivesForSeason(SEASONS.Fall), [504, 506, 508, 510]);
  assert.deepEqual(managedArchivesForSeason(SEASONS.Spring), [504, 506, 508, 510]);
  assert.deepEqual(managedArchivesForSeason(SEASONS.Summer), []);
  assert.deepEqual(managedArchivesForSeason(SEASONS.Winter), [505, 507, 509]);
  // the IL's `ble.un 1` is UNSIGNED: -1 (NoInstalledSeason) is a huge
  // unsigned value and falls through to the Winter test, which fails
  assert.equal(NO_INSTALLED_SEASON, -1);
  assert.deepEqual(managedArchivesForSeason(NO_INSTALLED_SEASON), [], 'a negative season manages nothing (the switch, not a signed range)');
  assert.deepEqual(managedArchivesForSeason(-7), []);
});

test('SIB1: ArchiveForSeason - the eleven prefixes, and null everywhere else', () => {
  const table = [
    [SEASONS.Winter, 505, 'K'], [SEASONS.Winter, 507, 'F'], [SEASONS.Winter, 509, 'C'],
    [SEASONS.Fall, 504, 'I'], [SEASONS.Fall, 506, 'D'], [SEASONS.Fall, 508, 'A'], [SEASONS.Fall, 510, 'G'],
    [SEASONS.Spring, 504, 'J'], [SEASONS.Spring, 506, 'E'], [SEASONS.Spring, 508, 'B'], [SEASONS.Spring, 510, 'H'],
  ];
  for (const [season, archive, prefix] of table) assert.equal(archivePrefix(season, archive), prefix, `${season}/${archive}`);
  // Summer manages nothing; Winter's mountains (511) and the unwooded
  // sets (500-503) have no seasonal art; a snow archive in Fall is null
  for (const a of [500, 501, 502, 503, 504, 505, 511]) assert.equal(archivePrefix(SEASONS.Summer, a), null);
  assert.equal(archivePrefix(SEASONS.Winter, 511), null);
  assert.equal(archivePrefix(SEASONS.Fall, 505), null);
  assert.equal(archivePrefix(SEASONS.Spring, 507), null);
  // every prefix has a folder in the manifest, and the folders are the
  // manifest's own (the vendored manifest names each one)
  const manifest = JSON.parse(read('vendor/seasons-iliac-bay/seasons-of-the-iliac-bay.dfmod.json'));
  const folders = new Set(manifest.Files.map((f) => f.split('/').slice(-2, -1)[0]));
  for (const [prefix, folder] of Object.entries(PREFIX_FOLDER)) {
    assert.ok(folders.has(folder), `${folder} is a manifest folder`);
    const inFolder = manifest.Files.filter((f) => f.includes(`/${folder}/`));
    assert.ok(inFolder.length >= 32, `${folder} carries a season's records`);
    for (const f of inFolder) assert.ok(parseRecordFromFilename(f, prefix) >= 0, `${f} parses under ${prefix}`);
  }
  assert.equal(manifest.ModTitle, SEASONS_MOD.title);
  assert.equal(manifest.GUID, SEASONS_MOD.guid);
  assert.equal(manifest.ModVersion, SEASONS_MOD.version);
  assert.equal(manifest.ModAuthor, SEASONS_MOD.author);
});

test('SIB1: ParseRecordFromFilename - prefix (case-blind) then an Int32, or -1', () => {
  assert.equal(parseRecordFromFilename('K11.png', 'K'), 11);
  assert.equal(parseRecordFromFilename('Textures/TempW/k11.PNG', 'K'), 11);
  assert.equal(parseRecordFromFilename('J0.PNG', 'J'), 0);
  assert.equal(parseRecordFromFilename('K.png', 'K'), -1, 'an empty number does not parse');
  assert.equal(parseRecordFromFilename('KX.png', 'K'), -1);
  assert.equal(parseRecordFromFilename('K11.png', 'J'), -1, 'another prefix');
  assert.equal(parseRecordFromFilename('SeasonHelper.cs', 'S'), -1, 'the manifest\'s one script does not parse either');
  assert.equal(parseRecordFromFilename('K 7.png', 'K'), 7, 'Int32.TryParse takes surrounding whitespace');
  assert.equal(parseRecordFromFilename('K\t7 .png', 'K'), 7, '.NET whitespace: tab, space');
  assert.equal(parseRecordFromFilename('K\u00a07.png', 'K'), -1, 'but not the no-break space, which JavaScript\'s trim() would take');
  assert.equal(parseRecordFromFilename('K\u30007.png', 'K'), -1);
  assert.equal(parseRecordFromFilename('K99999999999.png', 'K'), -1, 'out of Int32');
  assert.deepEqual(filesForPrefix(['a/K1.png', 'b/J1.png', 'c/k2.PNG', 'SeasonHelper.cs'], 'K'), ['a/K1.png', 'c/k2.PNG']);
});

// ═══ TryBuildSeasonalAtlas's checks and the size law ═════════════════════

const tex = (name, w = 8, h = 8) => ({ name, width: w, height: h, image: { width: w, height: h, data: new Uint8Array(w * h * 4) } });
const fullSet = (prefix, n, from = 0) => Array.from({ length: n - from }, (_, i) => tex(`${prefix}${i + from}.png`, 10 + i, 20 + i));

test('SIB1: seasonalRecordSet - n >= 2, records 1..n-1 all present, slot 0 holds record 1, a later duplicate wins', () => {
  assert.equal(seasonalRecordSet('K', 505, 33, []).ok, false);
  assert.match(seasonalRecordSet('K', 505, 33, []).reason, /No textures found for prefix 'K' and TEXTURE\.505/);
  assert.match(seasonalRecordSet('K', 505, 1, [tex('K1.png')]).reason, /TEXTURE\.505 has invalid record metadata/);
  const missing = seasonalRecordSet('K', 505, 33, fullSet('K', 33).filter((t) => t.name !== 'K7.png'));
  assert.equal(missing.ok, false);
  assert.equal(missing.reason, 'SeasonHelper: Missing K7.png for TEXTURE.505. Atlas replacement was skipped so stock billboard batching remains valid.');
  // record 0 need not exist - slot 0 takes record 1
  const ok = seasonalRecordSet('K', 505, 33, fullSet('K', 33, 1));
  assert.equal(ok.ok, true);
  assert.equal(ok.records.length, 33);
  assert.equal(ok.records[0].name, 'K1.png');
  assert.equal(ok.records[1].name, 'K1.png');
  assert.equal(ok.records[32].name, 'K32.png');
  // extra records past n are ignored; an archive shorter than the set is fine
  const short = seasonalRecordSet('J', 504, 5, fullSet('J', 38));
  assert.equal(short.ok, true);
  assert.equal(short.records.length, 5);
  // the dictionary indexer: last write wins
  const dup = seasonalRecordSet('K', 505, 3, [tex('K1.png', 1, 1), tex('K2.png', 2, 2), tex('k2.png', 9, 9)]);
  assert.equal(dup.records[2].width, 9);
});

test('SIB1: the size law - (w, h) * 3.1f with a zero scale through GetScaledBillboardSize', () => {
  assert.equal(BILLBOARD_SCALE, Math.fround(3.1));
  const s = seasonalBillboardSize(79, 156);   // TempW's K1, the tall winter pine
  const expect = scaledBillboardSize({ width: Math.fround(79 * BILLBOARD_SCALE), height: Math.fround(156 * BILLBOARD_SCALE) }, { width: 0, height: 0 });
  assert.deepEqual(s, expect);
  assert.ok(Math.abs(s.w - 79 * 3.1 * 0.025) < 1e-4 && Math.abs(s.h - 156 * 3.1 * 0.025) < 1e-4);
  // 3.1x the classic size of the same texels
  const classic = scaledBillboardSize({ width: 79, height: 156 }, { width: 0, height: 0 });
  assert.ok(Math.abs(s.w / classic.w - 3.1) < 1e-6);
});

// ═══ SeasonHelper's state machine ═══════════════════════════════════════

function makeHelper({ season = SEASONS.Winter, counts = {}, sets = {} } = {}) {
  const log = { warns: [], refreshes: 0, loads: [], counts: [] };
  const state = { season };
  const helper = new SeasonHelper({
    currentSeason: () => state.season,
    recordCount: async (archive) => { log.counts.push(archive); return counts[archive] ?? 33; },
    load: async (prefix) => { log.loads.push(prefix); return sets[prefix] ?? fullSet(prefix, 33, 1); },
    refresh: () => { log.refreshes++; },
    warn: (m) => log.warns.push(m),
  });
  return { helper, log, state };
}

test('SIB1: ApplyCurrentSeason - installs once per season, forces on demand, refreshes after every install', async () => {
  const { helper, log, state } = makeHelper();
  assert.equal(helper.installedSeason, NO_INSTALLED_SEASON);
  assert.equal(await helper.apply(false), true);
  assert.equal(helper.installedSeason, SEASONS.Winter);
  assert.deepEqual(log.loads, ['K', 'F', 'C']);
  assert.deepEqual(log.counts, [505, 507, 509]);
  assert.equal(log.refreshes, 1);
  assert.equal(helper.generation, 1);
  // the same season again: nothing
  assert.equal(await helper.apply(false), false);
  assert.equal(log.refreshes, 1);
  // forced: the season is forgotten and re-installed from the CACHED
  // atlases (no second load), and the batches refresh again
  assert.equal(await helper.apply(true), true);
  assert.deepEqual(log.loads, ['K', 'F', 'C']);
  assert.equal(log.refreshes, 2);
  assert.equal(helper.generation, 2);
  // the cache answers for a managed archive and record, at the mod's size
  const hit = helper.lookup(505, 5);
  assert.equal(hit.texture.name, 'K5.png');
  assert.deepEqual(hit.size, seasonalBillboardSize(hit.texture.width, hit.texture.height));
  assert.equal(helper.lookup(505, 0).texture.name, 'K1.png', 'slot 0 is record 1');
  assert.equal(helper.lookup(504, 5), null, 'a summer archive is not managed in winter');
  assert.equal(helper.lookup(505, 40), null, 'past the archive');
  assert.equal(helper.manages(505), true);
  assert.equal(helper.manages(504), false);
  // Summer: every vanilla atlas goes back, nothing installs
  state.season = SEASONS.Summer;
  assert.equal(await helper.apply(false), true);
  assert.equal(helper.lookup(505, 5), null);
  assert.equal(helper.installedSeason, SEASONS.Summer);
  // Fall loads the four summer-woodland prefixes
  state.season = SEASONS.Fall;
  await helper.apply(false);
  assert.deepEqual(log.loads.slice(3), ['I', 'D', 'A', 'G']);
  assert.equal(helper.lookup(504, 3).texture.name, 'I3.png');
  // and back to Winter without loading again
  state.season = SEASONS.Winter;
  await helper.apply(false);
  assert.deepEqual(log.loads.slice(7), []);
  assert.equal(helper.lookup(505, 5).texture.name, 'K5.png');
  assert.equal(helper.seasonalAtlasByKey.has(atlasKey(SEASONS.Winter, 505)), true);
});

test('SIB1: a failed build warns with the mod\'s words, leaves the archive vanilla, and is retried next install', async () => {
  const sets = { K: fullSet('K', 33, 1).filter((t) => t.name !== 'K7.png') };
  const { helper, log } = makeHelper({ sets });
  await helper.apply(false);
  assert.equal(helper.lookup(505, 5), null, '505 stays vanilla');
  assert.equal(helper.lookup(507, 5).texture.name, 'F5.png', 'the other archives still install');
  assert.deepEqual(log.warns, ['SeasonHelper: Missing K7.png for TEXTURE.505. Atlas replacement was skipped so stock billboard batching remains valid.']);
  assert.equal(helper.seasonalAtlasByKey.has(atlasKey(SEASONS.Winter, 505)), false, 'only a SUCCESSFUL build is cached');
  await helper.apply(true);
  assert.deepEqual(log.loads, ['K', 'F', 'C', 'K'], 'the failed prefix loads again, the cached ones do not');
  // an archive that cannot be read at all
  const { helper: h2, log: l2 } = makeHelper({ counts: { 507: 0 } });
  await h2.apply(false);
  assert.match(l2.warns[0], /Could not load the native atlas metadata for TEXTURE\.507/);
  assert.equal(h2.lookup(507, 1), null);
  // ...or whose reader REJECTS (a hosted ARENA2 over a bad network): the
  // same warning, the same next archive, the install never half-done
  const h3 = new SeasonHelper({
    currentSeason: () => SEASONS.Winter,
    recordCount: async (a) => { if (a === 505) throw new Error('TEXTURE.505: 503'); return 33; },
    load: async (prefix) => fullSet(prefix, 33, 1), refresh: () => {}, warn: (m) => l2.warns.push(m),
  });
  assert.equal(await h3.apply(false), true);
  assert.match(l2.warns.at(-1), /Could not load the native atlas metadata for TEXTURE\.505/);
  assert.equal(h3.lookup(505, 1), null);
  assert.equal(h3.lookup(507, 1).texture.name, 'F1.png', 'the archives after it still installed');
});

test('SIB1: the events - load forces and re-applies next frame, travel forces and refreshes when the terrains end', async () => {
  const { helper, log } = makeHelper();
  await helper.onLoad();
  assert.equal(log.refreshes, 1);
  assert.equal(await helper.tick(), false, 'RefreshSeasonAfterLoad: the unforced apply finds the season installed');
  assert.equal(helper.tick(), null, 'and runs once');
  await helper.onPostFastTravel();
  assert.equal(log.refreshes, 2, 'the forced apply refreshed');
  assert.equal(helper.refreshNatureBatchesAfterTravel, true);
  assert.equal(helper.onUpdateTerrainsEnd(), true);
  assert.equal(log.refreshes, 3, 'OnUpdateTerrainsEnd refreshes once more');
  assert.equal(helper.onUpdateTerrainsEnd(), false, 'and the flag is spent');
  assert.equal(await helper.onNewMonth(), false);
  assert.equal(await helper.onTerrainInstantiated(), false);
  // two applies racing: the second waits for the first, then finds it installed
  const { helper: h2, log: l2 } = makeHelper();
  const [a, b] = await Promise.all([h2.apply(false), h2.apply(false)]);
  assert.deepEqual([a, b], [true, false]);
  assert.deepEqual(l2.loads, ['K', 'F', 'C']);
});

// ═══ the door: LZ4 blocks ═══════════════════════════════════════════════

test('SIB1: LZ4 block - literals, matches, overlapping matches, long lengths, and refusals', () => {
  const dec = (arr, n) => Buffer.from(lz4BlockDecompress(new Uint8Array(arr), n)).toString('latin1');
  // literals only: token 0x50 = 5 literals, no match (last sequence)
  assert.equal(dec([0x50, ...Buffer.from('hello')], 5), 'hello');
  // "abcd" then a match of offset 4, length 4 (nibble 0 + MIN_MATCH)
  assert.equal(dec([0x40, ...Buffer.from('abcd'), 4, 0], 8), 'abcdabcd');
  // overlapping: "a" then offset 1, length 4 + 3 -> "aaaaaaaa"
  assert.equal(dec([0x13, 0x61, 1, 0], 8), 'aaaaaaaa');
  // long literal run: 15 + 5 = 20 literals
  const twenty = 'abcdefghijklmnopqrst';
  assert.equal(dec([0xf0, 5, ...Buffer.from(twenty)], 20), twenty);
  // long match: 4 literals, offset 4, length 15 + 255 + 1 + 4 = 275
  const out = dec([0x4f, ...Buffer.from('wxyz'), 4, 0, 255, 1], 4 + 275);
  assert.equal(out.length, 279);
  assert.equal(out.slice(0, 12), 'wxyzwxyzwxyz');
  assert.throws(() => lz4BlockDecompress(new Uint8Array([0x40, 0x61, 0x62, 0x63, 0x64, 9, 0]), 8), /offset outside/);
  assert.throws(() => lz4BlockDecompress(new Uint8Array([0x50, 0x61]), 5), /run past/);
  assert.throws(() => lz4BlockDecompress(new Uint8Array([0x10, 0x61]), 5), /filled 1 of 5/);
});

// ═══ the door: DXT blocks ═══════════════════════════════════════════════

test('SIB1: DXT1 and DXT5 blocks decode to the documented palettes', () => {
  // DXT1: c0 = pure red (0xF800), c1 = pure blue (0x001F); c0 > c1 so
  // the four-colour mode: [red, blue, 2/3 red + 1/3 blue, 1/3 red + 2/3 blue].
  // Selectors: row bits 00 01 10 11 for x = 0..3 -> 0b11100100 = 0xE4
  const block = new Uint8Array([0x00, 0xf8, 0x1f, 0x00, 0xe4, 0xe4, 0xe4, 0xe4]);
  const px = dxtDecode(block, 4, 4, false);
  const at = (x, y) => [...px.subarray((y * 4 + x) * 4, (y * 4 + x) * 4 + 4)];
  assert.deepEqual(at(0, 0), [255, 0, 0, 255]);
  assert.deepEqual(at(1, 0), [0, 0, 255, 255]);
  assert.deepEqual(at(2, 0), [170, 0, 85, 255]);
  assert.deepEqual(at(3, 0), [85, 0, 170, 255]);
  // c0 <= c1: three-colour mode with selector 3 transparent
  const block3 = new Uint8Array([0x1f, 0x00, 0x00, 0xf8, 0xe4, 0xe4, 0xe4, 0xe4]);
  const px3 = dxtDecode(block3, 4, 4, false);
  assert.deepEqual([...px3.subarray(8, 12)], [127, 0, 127, 255]);
  assert.equal(px3[15], 0, 'selector 3 is transparent in three-colour mode');
  // DXT5: alpha endpoints 255 and 0 (a0 > a1: the 8-entry ramp), all
  // selectors 0 (a0) on the first row... the 48 selector bits are little-
  // endian 3-bit fields; texel 1 takes 7 (a1 = 0), texel 2 takes 2 (5/7).
  const alpha = new Uint8Array([255, 0, 0b00001000, 0b00000001, 0, 0, 0, 0]);   // texel 0 = 0 (a0), texel 1 = 1 (a1), texel 2 = 4 (ramp entry 4)
  // 48 selector bits, little-endian, 3 per texel: texel0 = bits 0-2, texel1 = bits 3-5 (001 = a1), texel2 = bits 6-8 (byte0 bits 6,7 = 00, byte1 bit 0 = 1 -> 100 = entry 4)
  const d5 = new Uint8Array(16);
  d5.set(alpha, 0);
  d5.set(block, 8);
  const p5 = dxtDecode(d5, 4, 4, true);
  assert.equal(p5[3], 255, 'texel 0: a0');
  assert.equal(p5[7], 0, 'texel 1: a1');
  assert.equal(p5[11], Math.trunc((4 * 255 + 3 * 0) / 7), 'texel 2: ramp entry 4 = (4*a0 + 3*a1)/7');
  assert.deepEqual([...p5.subarray(0, 3)], [255, 0, 0], 'the colour block rides underneath');
  assert.throws(() => dxtDecode(new Uint8Array(8), 8, 8, false), /bytes for/);
});

// ═══ the door: a UnityFS bundle built here ═══════════════════════════════

/** A byte writer with both endiannesses. */
class W {
  constructor() { this.parts = []; this.len = 0; }
  push(u8) { this.parts.push(u8); this.len += u8.length; return this; }
  bytes() { const out = new Uint8Array(this.len); let o = 0; for (const p of this.parts) { out.set(p, o); o += p.length; } return out; }
  u8(v) { return this.push(new Uint8Array([v & 255])); }
  u16(v, le) { const b = new Uint8Array(2); new DataView(b.buffer).setUint16(0, v, le); return this.push(b); }
  i16(v, le) { const b = new Uint8Array(2); new DataView(b.buffer).setInt16(0, v, le); return this.push(b); }
  u32(v, le) { const b = new Uint8Array(4); new DataView(b.buffer).setUint32(0, v >>> 0, le); return this.push(b); }
  i32(v, le) { const b = new Uint8Array(4); new DataView(b.buffer).setInt32(0, v, le); return this.push(b); }
  f32(v, le) { const b = new Uint8Array(4); new DataView(b.buffer).setFloat32(0, v, le); return this.push(b); }
  i64(v, le) { const b = new Uint8Array(8); new DataView(b.buffer).setBigInt64(0, BigInt(v), le); return this.push(b); }
  cstr(s) { return this.push(new Uint8Array([...Buffer.from(s, 'utf8'), 0])); }
  align(n = 4) { while (this.len % n) this.u8(0); return this; }
  str(s, le) { const b = Buffer.from(s, 'utf8'); this.i32(b.length, le); this.push(new Uint8Array(b)); return this.align(4); }
}

/** A type tree as nested nodes [type, name, size, align, typeFlags, children]. */
const N = (type, name, size, align = false, typeFlags = 0, children = []) => ({ type, name, size, align, typeFlags, children });
const STRING = (name) => N('string', name, -1, false, 0, [N('Array', 'Array', -1, true, 1, [N('int', 'size', 4), N('char', 'data', 1)])]);
const TEXTURE2D_TREE = N('Texture2D', 'Base', -1, false, 0, [
  STRING('m_Name'), N('int', 'm_ForcedFallbackFormat', 4), N('bool', 'm_DownscaleFallback', 1, true),
  N('int', 'm_Width', 4), N('int', 'm_Height', 4), N('int', 'm_CompleteImageSize', 4), N('int', 'm_TextureFormat', 4),
  N('int', 'm_MipCount', 4), N('bool', 'm_IsReadable', 1), N('bool', 'm_IgnoreMasterTextureLimit', 1), N('bool', 'm_IsPreProcessed', 1),
  N('bool', 'm_StreamingMipmaps', 1, true), N('int', 'm_StreamingMipmapsPriority', 4, true), N('int', 'm_ImageCount', 4), N('int', 'm_TextureDimension', 4),
  N('GLTextureSettings', 'm_TextureSettings', 24, false, 0, [N('int', 'm_FilterMode', 4), N('int', 'm_Aniso', 4), N('float', 'm_MipBias', 4), N('int', 'm_WrapU', 4), N('int', 'm_WrapV', 4), N('int', 'm_WrapW', 4)]),
  N('int', 'm_LightmapFormat', 4), N('int', 'm_ColorSpace', 4),
  N('TypelessData', 'image data', -1, true, 1, [N('int', 'size', 4), N('UInt8', 'data', 1)]),
  N('StreamingInfo', 'm_StreamData', -1, false, 0, [N('unsigned int', 'offset', 4), N('unsigned int', 'size', 4), STRING('path')]),
]);
const TEXTASSET_TREE = N('TextAsset', 'Base', -1, false, 0, [STRING('m_Name'), STRING('m_Script')]);

/** Write a type tree blob (SerializedFile 21: 32-byte nodes), using the
 *  COMMON table for every name it knows and a local buffer for the rest. */
function treeBlob(tree, le) {
  const flat = [];
  const walk = (n, level) => { flat.push({ ...n, level }); for (const c of n.children) walk(c, level + 1); };
  walk(tree, 0);
  const common = new Map([...COMMON_STRINGS].map(([k, v]) => [v, k]));
  const local = new W();
  const localOff = new Map();
  const off = (s) => {
    if (common.has(s)) return (0x80000000 | common.get(s)) >>> 0;
    if (!localOff.has(s)) { localOff.set(s, local.len); local.cstr(s); }
    return localOff.get(s);
  };
  const w = new W();
  w.i32(flat.length, le);
  const strings = new W();
  const offsets = flat.map((n) => [off(n.type), off(n.name)]);
  w.i32(local.len, le);
  flat.forEach((n, i) => {
    w.u16(1, le).u8(n.level).u8(n.typeFlags).u32(offsets[i][0], le).u32(offsets[i][1], le)
      .i32(n.size, le).i32(i, le).i32(n.align ? 0x4000 : 0, le).i64(0n, le);
  });
  w.push(local.bytes());
  void strings;
  return w.bytes();
}

/** A Texture2D object body (LE) as the tree above lays it out. */
function texture2dBody(name, width, height, format, data) {
  const le = true;
  const w = new W();
  w.str(name, le).i32(0, le).u8(0).align(4).i32(width, le).i32(height, le).i32(data.length, le).i32(format, le).i32(1, le)
    .u8(0).u8(0).u8(0).u8(0).align(4).i32(0, le).align(4).i32(1, le).i32(2, le)
    .i32(0, le).i32(1, le).f32(0, le).i32(1, le).i32(1, le).i32(1, le)
    .i32(0, le).i32(1, le)
    .i32(data.length, le).push(data).align(4)
    .u32(0, le).u32(0, le).str('', le);
  return w.bytes();
}
function textAssetBody(name, text) {
  return new W().str(name, true).str(text, true).bytes();
}

/** One SerializedFile (version 21, little-endian data) holding the objects. */
function serializedFile(objects) {
  const le = true;
  const meta = new W();
  meta.cstr('2019.4.40f1').i32(5, le).u8(1);
  const types = [[28, TEXTURE2D_TREE], [49, TEXTASSET_TREE]];
  meta.i32(types.length, le);
  for (const [classId, tree] of types) {
    meta.i32(classId, le).u8(0).i16(-1, le).push(new Uint8Array(16)).push(treeBlob(tree, le)).i32(0, le);
  }
  // object bodies, each 8-aligned in the data area
  const bodies = [];
  let at = 0;
  for (const o of objects) { at = (at + 7) & ~7; bodies.push({ ...o, start: at }); at += o.body.length; }
  meta.i32(objects.length, le);
  bodies.forEach((o, i) => { meta.align(4); meta.i64(BigInt(1000 + i), le).u32(o.start, le).u32(o.body.length, le).i32(o.typeIndex, le); });
  meta.i32(0, le).i32(0, le).i32(0, le).cstr('');   // scripts, externals, ref types, user info
  const metaBytes = meta.bytes();
  const headerLen = 20;
  let dataOffset = headerLen + metaBytes.length;
  dataOffset = (dataOffset + 15) & ~15;
  const fileSize = dataOffset + at;
  const f = new W();
  f.u32(metaBytes.length, false).u32(fileSize, false).u32(21, false).u32(dataOffset, false).u8(0).push(new Uint8Array(3));
  f.push(metaBytes);
  while (f.len < dataOffset) f.u8(0);
  for (const o of bodies) { while (f.len < dataOffset + o.start) f.u8(0); f.push(o.body); }
  return f.bytes();
}

/** Literals-only LZ4 encoding: a valid block for any input. */
function lz4Literals(src) {
  const w = new W();
  let n = src.length;
  const token = Math.min(n, 15);
  w.u8(token << 4);
  if (token === 15) { n -= 15; while (n >= 255) { w.u8(255); n -= 255; } w.u8(n); }
  w.push(src);
  return w.bytes();
}

/** The UnityFS container around one CAB, with the block info and the
 *  block either stored or LZ4-wrapped. */
function unityFs(cab, { lz4 = false, cabName = 'CAB-test' } = {}) {
  const block = lz4 ? lz4Literals(cab) : cab;
  const info = new W();
  info.push(new Uint8Array(16)).i32(1, false).u32(cab.length, false).u32(block.length, false).u16(lz4 ? 2 : 0, false);
  info.i32(1, false).i64(0n, false).i64(BigInt(cab.length), false).u32(4, false).cstr(cabName);
  const infoBytes = info.bytes();
  const infoBlock = lz4 ? lz4Literals(infoBytes) : infoBytes;
  const h = new W();
  h.cstr('UnityFS').u32(7, false).cstr('5.x.x').cstr('2019.4.40f1');
  const sizeAt = h.len;
  h.i64(0n, false).u32(infoBlock.length, false).u32(infoBytes.length, false).u32(0x40 | (lz4 ? 2 : 0), false).align(16);
  h.push(infoBlock).push(block);
  const out = h.bytes();
  new DataView(out.buffer).setBigInt64(sizeAt, BigInt(out.length), false);
  return out;
}

const RGBA_2x2 = new Uint8Array([
  // Unity stores the BOTTOM row first: row 0 here is the bottom row
  10, 11, 12, 13, 20, 21, 22, 23,
  30, 31, 32, 33, 40, 41, 42, 43,
]);
const DXT5_4x4 = new Uint8Array([255, 0, 0, 0, 0, 0, 0, 0, 0x00, 0xf8, 0x1f, 0x00, 0x00, 0x00, 0x00, 0x00]);   // opaque red block

function testBundle({ lz4 = false, manifest = null } = {}) {
  const objects = [
    { typeIndex: 0, body: texture2dBody('K1', 2, 2, TEXTURE_FORMAT.RGBA32, RGBA_2x2) },
    { typeIndex: 0, body: texture2dBody('K2', 4, 4, TEXTURE_FORMAT.DXT5, DXT5_4x4) },
    { typeIndex: 1, body: textAssetBody('Seasons.dfmod', JSON.stringify(manifest ?? {
      ModTitle: SEASONS_MOD.title, GUID: SEASONS_MOD.guid, Files: ['Assets/Mods/Textures/TempW/K1.png', 'Assets/Mods/Textures/TempW/K2.png'],
    })) },
  ];
  return unityFs(serializedFile(objects), { lz4 });
}

test('SIB1: the UnityFS reader - header, stored and LZ4 blocks, the type tree with common strings, Texture2D and TextAsset', () => {
  for (const lz4 of [false, true]) {
    const bytes = testBundle({ lz4 });
    const fs = readUnityFs(bytes);
    assert.equal(fs.signature, 'UnityFS');
    assert.equal(fs.version, 7);
    assert.equal(fs.files.length, 1);
    assert.equal(fs.files[0].path, 'CAB-test');
    const b = readUnityBundle(bytes);
    assert.equal(b.assets.length, 1);
    assert.equal(b.assets[0].version, 21);
    assert.equal(b.assets[0].littleEndian, true);
    assert.equal(b.assets[0].unityVersion, '2019.4.40f1');
    assert.deepEqual(b.assets[0].types.map((t) => t.classId), [28, 49]);
    assert.deepEqual(b.textures.map((t) => t.name), ['K1', 'K2']);
    const k1 = b.textures[0].rgba();
    assert.deepEqual([k1.width, k1.height], [2, 2]);
    // flipped: the top row of the image is the LAST row Unity stored
    assert.deepEqual([...k1.data.subarray(0, 8)], [30, 31, 32, 33, 40, 41, 42, 43]);
    assert.deepEqual([...k1.data.subarray(8, 16)], [10, 11, 12, 13, 20, 21, 22, 23]);
    const k2 = b.textures[1].rgba();
    assert.equal(k2.width, 4);
    assert.deepEqual([...k2.data.subarray(0, 4)], [255, 0, 0, 255], 'the DXT5 block decodes through the same door');
    assert.equal(b.textures[1].format, TEXTURE_FORMAT.DXT5);
    assert.equal(b.textAssets.length, 1);
    assert.equal(bundleManifest(b).GUID, SEASONS_MOD.guid);
    assert.ok(b.textAssets[0].bytes instanceof Uint8Array, 'a text asset keeps its bytes (a DLL rides in one)');
  }
  // the type tree's names came through BOTH tables: 'm_Name' is a
  // common string, 'm_ForcedFallbackFormat' is local
  const tree = readUnityBundle(testBundle()).assets[0].types[0].node;
  assert.equal(tree.type, 'Texture2D');
  assert.deepEqual(tree.children.slice(0, 2).map((c) => c.name), ['m_Name', 'm_ForcedFallbackFormat']);
  assert.equal(COMMON_STRINGS.get(427), 'm_Name');
  // refusals
  assert.throws(() => readUnityFs(new Uint8Array([...Buffer.from('UnityWeb'), 0, 0, 0, 0, 6])), /not a UnityFS archive/);
  // a corrupt array count is refused before it is allocated: patch the
  // first Texture2D's name length to 2^31 - 1
  {
    const cab = readUnityFs(testBundle()).files[0].bytes;
    const sf = readSerializedFile(cab, 'CAB-test');
    const dv = new DataView(cab.buffer, cab.byteOffset, cab.byteLength);
    dv.setInt32(sf.objects[0].byteStart, 0x7fffffff, true);
    assert.throws(() => sf.objects[0].read(), /exceeds the .* bytes that remain|past the end/, 'refused by the bound, never allocated');
  }
  // a raw texture whose data is short is corrupt, not a darker picture
  {
    const short = readUnityBundle(unityFs(serializedFile([{ typeIndex: 0, body: texture2dBody('S', 4, 4, TEXTURE_FORMAT.RGBA32, new Uint8Array(8)) }])));
    assert.throws(() => short.textures[0].rgba(), /8 bytes for 4x4/);
  }
  const lzma = testBundle();
  lzma[lzma.indexOf(0x40, 30)] = 0x41;   // flags: compression 1 = LZMA
  assert.throws(() => readUnityFs(lzma), /LZMA/);
  assert.deepEqual(parseUnityVersion('2019.4.40f1'), [2019, 4, 40]);
  assert.equal(usesNewArchiveFlags([2019, 4, 40]), false);
  assert.equal(usesNewArchiveFlags([2020, 3, 34]), true);
  assert.equal(usesNewArchiveFlags([2021, 3, 1]), false);
  assert.equal(usesNewArchiveFlags([2023, 1, 0]), true);
});

// ═══ the registry over the pick ═════════════════════════════════════════

test('SIB1: seasonsAssetKey - the .dfmod whole, the eleven folders\' PNGs by folder, nothing else', () => {
  assert.equal(seasonsAssetKey('Seasons of the Iliac Bay/seasons of the iliac bay.dfmod'), `${DFMOD_KEY_PREFIX}seasons of the iliac bay.dfmod`);
  assert.equal(seasonsAssetKey('Mods/Dynamic Skies.DFMOD'), null, 'another mod\'s bundle is not stored - a whole Mods folder is gigabytes, and a bundle is decompressed whole to be read');
  assert.equal(seasonsAssetKey('Mods/SEASONS OF THE ILIAC BAY.dfmod'), `${DFMOD_KEY_PREFIX}seasons of the iliac bay.dfmod`, 'the mod\'s own, case-blind');
  // THE PICK'S ONE DECISION, over File-like objects: a browser File's
  // `name` is the bare basename, so a mod PNG is decided by its
  // webkitRelativePath - deciding on the name alone drops every one
  const deps = { textureEntry, seasonsAssetKey };
  assert.equal(textureStoreKey({ name: 'K11.png', webkitRelativePath: 'Seasons of the Iliac Bay/Textures/TempW/K11.png' }, deps), `${LOOSE_KEY_PREFIX}TempW/K11.png`);
  assert.equal(textureStoreKey({ name: '003_5-0.png', webkitRelativePath: 'pack/003_5-0.png' }, deps), '003_5-0.png', 'a DFU-named PNG keys by name wherever it sits');
  assert.equal(textureStoreKey({ name: 'seasons of the iliac bay.dfmod', webkitRelativePath: 'Mods/seasons of the iliac bay.dfmod' }, deps), `${DFMOD_KEY_PREFIX}seasons of the iliac bay.dfmod`);
  assert.equal(textureStoreKey({ name: 'K11.png' }, deps), null, 'no path, no folder, not ours');
  assert.equal(textureStoreKey({ name: 'readme.txt', webkitRelativePath: 'Seasons of the Iliac Bay/Textures/TempW/readme.txt' }, deps), null);
  assert.equal(seasonsAssetKey('Seasons of the Iliac Bay/Textures/TempW/K11.png'), `${LOOSE_KEY_PREFIX}TempW/K11.png`);
  assert.equal(seasonsAssetKey('x\\y\\hillss\\E3.PNG'), `${LOOSE_KEY_PREFIX}hillss/E3.PNG`, 'folders match case-blind, keep their spelling');
  assert.equal(seasonsAssetKey('Textures/Other/K11.png'), null);
  assert.equal(seasonsAssetKey('504_1-0.png'), null, 'a DFU-named replacement is the other registry\'s');
  assert.equal(seasonsAssetKey('TempW/readme.txt'), null);
});

test('SIB1: the registry - a bundle answers over its manifest\'s file list, loose folders answer without one, nothing else answers', async () => {
  const bytes = testBundle();
  const store = new Map([
    [`${DFMOD_KEY_PREFIX}seasons of the iliac bay.dfmod`, bytes],
    ['003_5-0.png', new Uint8Array([1])],
  ]);
  const load = async (name) => store.get(name) ?? null;
  assert.equal(setSeasonsSources([...store.keys()], load), 1);
  assert.equal(seasonsSourcesCount(), 1);
  assert.equal(await seasonsInstalled(), true);
  const k = await loadSeasonsTextures('K');
  assert.deepEqual(k.map((t) => [t.name, t.width, t.height]), [['K1.png', 2, 2], ['K2.png', 4, 4]]);
  assert.deepEqual([...k[0].image.data.subarray(0, 4)], [30, 31, 32, 33]);
  assert.deepEqual(await loadSeasonsTextures('J'), [], 'a prefix the manifest does not carry');
  // another mod's bundle is not this mod
  const other = testBundle({ manifest: { ModTitle: 'Dynamic Skies', GUID: 'x', Files: ['a/K1.png'] } });
  setSeasonsSources([`${DFMOD_KEY_PREFIX}other.dfmod`], async () => other);
  assert.equal(await seasonsInstalled(), false);
  assert.deepEqual(await loadSeasonsTextures('K'), []);
  // the same registration again keeps the opened bundle; a different
  // one drops it (the boot seam registers on every host boot)
  let opens = 0;
  const counting = async (name) => { opens++; return store.get(name) ?? null; };
  setSeasonsSources([...store.keys()], counting);
  await seasonsInstalled();
  assert.equal(opens, 1);
  setSeasonsSources([...store.keys()], counting);
  await seasonsInstalled();
  assert.equal(opens, 1, 'an unchanged registration does not re-open the bundle');
  setSeasonsSources([...store.keys(), `${LOOSE_KEY_PREFIX}TempW/K9.png`], counting);
  await seasonsInstalled();
  assert.equal(opens, 2, 'a changed one does');
  // loose folders, decoded by the injected decoder
  const loose = new Map([[`${LOOSE_KEY_PREFIX}TempW/K1.png`, new Uint8Array([7])], [`${LOOSE_KEY_PREFIX}TempW/K2.png`, new Uint8Array([8])], [`${LOOSE_KEY_PREFIX}TempS/J1.png`, new Uint8Array([9])]]);
  setSeasonsSources([...loose.keys()], async (n) => loose.get(n));
  assert.equal(await seasonsInstalled(), true);
  const decode = async (b) => ({ width: b[0], height: b[0] * 2, data: new Uint8Array(b[0] * b[0] * 8) });
  const got = await loadSeasonsTextures('K', { decode });
  assert.deepEqual(got.map((t) => [t.name, t.width, t.height]), [['K1.png', 7, 14], ['K2.png', 8, 16]]);
  clearSeasonsSources();
  assert.equal(seasonsSourcesCount(), 0);
  assert.equal(await seasonsInstalled(), false);
});

// ═══ the hosts, the pick, the settings, the credits, the vendor tree ═════

test('SIB1: both climate hosts take the cache\'s answer for a flat, and the streaming host hears every event the script subscribes', () => {
  const world = read('src/scenes/world.js');
  const exterior = read('src/scenes/exterior.js');
  for (const [name, src] of [['world.js', world], ['exterior.js', exterior]]) {
    assert.match(src, /new SeasonHelper\(\{/, `${name} builds the helper`);
    assert.match(src, /seasons\??\.lookup\(archive, record\)/, `${name} asks the cache per flat`);
    assert.match(src, /renderer\.createBillboardBatch\(archive, rkey, sib\.size, centers\)/, `${name} draws the seasonal record at the mod's size`);
    assert.match(src, /modSetting\('seasons-iliac-bay', 'Enabled'\)/, `${name} honours the switch`);
    assert.match(src, /await seasonsInstalled\(\)/, `${name} is inert without the player's copy`);
    assert.match(src, /seasonValue\(dateFromClassicMinutes\(/, `${name} reads DFU's four-valued season`);
  }
  // the streaming host: the five subscriptions, in the seams they belong to
  assert.match(world, /seasons\.onLoad\(\)/, 'SaveLoadManager.OnLoad at boot');
  assert.match(world, /seasons\.onTerrainInstantiated\(\)/, 'DaggerfallTerrain.OnInstantiateTerrain per pixel');
  assert.match(world, /seasons\.onNewMonth\(\)/, 'WorldTime.OnNewMonth off the day poll');
  assert.match(world, /seasons\.onPostFastTravel\(\)/, 'DaggerfallTravelPopUp.OnPostFastTravel at the teleport');
  assert.match(world, /seasons\.onUpdateTerrainsEnd\(\)/, 'StreamingWorld.OnUpdateTerrainsEnd once the destination stands');
  assert.match(world, /seasons\.tick\(\)/, 'RefreshSeasonAfterLoad the frame after');
  assert.match(world, /_seasonsGen: seasons\?\.generation/, 'a pixel remembers the install it was built under');
  assert.match(world, /p\._seasonsGen !== seasons\.generation\) \{ _reskinPending = true/, 'refresh tears down only what stands on an older install');
  // the pick and the boot registration
  const ds = read('src/scenes/dataSource.js');
  assert.match(ds, /textureStoreKey\(f, deps\)/, 'the texture pick decides every file through the one exported decision');
  assert.match(ds, /storeAssets\(TEXTURE_STORE, keyed\.map\(\(\[f\]\) => f\), \(\) => true, \(f\) => keyOf\.get\(f\)\)/, 'and storeAssets does not re-decide on the basename');
  assert.match(ds, /setSeasonsSources\(names, loadTextureFile\)/, 'and registers them');
  assert.match(read('src/scenes/shared.js'), /setSeasonsSources\(names, loadTextureFile\)/, 'the boot registers them on the same seam');
  // the switch and the credit
  assert.equal(MOD_SETTINGS['seasons-iliac-bay'].keys.Enabled.default, true);
  const row = CREDITS.mods.find((m) => m.title === 'Seasons of the Iliac Bay');
  assert.ok(row, 'a credits row');
  assert.equal(row.author, 'RosyTheRascal');
  assert.deepEqual([...row.vendor], ['seasons-iliac-bay']);
});

test('SIB1: the vendor tree carries the manifest and the record, and NO raster - the textures are the player\'s to supply', () => {
  const tracked = execFileSync('git', ['ls-files', 'vendor/seasons-iliac-bay'], { cwd: root, encoding: 'utf8' }).split('\n').filter(Boolean);
  assert.deepEqual([...tracked].sort(), ['vendor/seasons-iliac-bay/README.md', 'vendor/seasons-iliac-bay/seasons-of-the-iliac-bay.dfmod.json'],
    'the folder holds the manifest and the record and nothing else');
  const readme = read('vendor/seasons-iliac-bay/README.md');
  assert.match(readme, /permission/i);
  assert.match(readme, /re-shaded sprite|silhouette/i, 'the README says why the textures are not here');
  assert.ok(existsSync(join(root, 'bible/07-Rendering/Seasons-Iliac-Bay.md')), 'the bible page');
});

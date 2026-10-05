// BET1 (2026-10-05, the owner: "This is the next mod I would like to integrate") - BETONY RESTORED 1.1.3 (Cliffworms).
//
// Held here: the vendored files against the shipped manifest (the readme's permission, Flat Replacer's six rules, the
// textures directory exactly the pictures carried - the author's own pixel for pixel, the rebuilt specs, the re-shades
// named and not carried); the pack (the 25 new places whole on no base, the fourteen blocks as edits, the manifest's
// order - which is the order a region's new places take their indices in - and a bad order refused); the door, case-
// blind as DFU's AssetBundle is; the script off its IL (Lord Mogref's faction under 1432 with its record's 1532, the
// street people's law, the three events, the latch the world-data loader set standing over the switch, BET-FIX's quest-
// away person kept down); the pictures on the texture door (Kamer's animated patrons, the `also` layers of a rebuilt
// shelf, a record rebuilt off its own archive while that archive loads); Flat Replacer's portraits; Betony's roads;
// the DET pieces the blocks place, stood in; the hosts' wiring - and, with ARENA2_PATH set, every pack file rebuilt
// sha256 for sha256 from the player's own BSA files, the region's new indices off the player's MAPS.BSA, the thirteen
// rebuilt pictures the AUTHOR'S (their hashes pinned, the pictures never carried), and every model and flat the blocks
// place classic, stood in, or one of the two named that nothing stands.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import zlib from 'node:zlib';

import { readPng } from '../tools/pngIO.mjs';
import { dfuWorldDataName } from '../tools/worldDataPackBuild.mjs';
import {
  BETONY_VENDOR, betonyLoaded, LORD_MOGREF_FACTION_KEY, LORD_MOGREF_FACTION, BETONY_NPC_FLAGS, betonyNpcShown, updateExteriorNpcs,
  createBetonyEvents, installBetonyRestored, installBetonyArt, _resetBetonyRestored, BETONY_OWN_ART, BETONY_DERIVED, BETONY_RESHADED,
  BETONY_XML, BETONY_NPC_STAND_INS, BETONY_NPC_ARCHIVE, flatReplacerPortraits, CUSTOM_PORTRAIT_FIRST, setBetonyPortraitProbe,
  withBetonyRoads, BETONY_ROADS, createBetonyLocationType, BETONY_PORTRAIT_FILE, BETONY_ARCHIVES,
} from '../src/systems/betonyRestored.js';
import { planNpcBatches, npcStandTurn, exteriorNpcRecord, collectExteriorNpcs } from '../src/characters/exteriorNpcs.js';
import { isLayoutPack, worldDataPacksMissing } from '../src/scenes/modWorldData.js';
import { PORTRAIT_ARCHIVE } from '../src/ui/nativeTalk.js';
import { openWorldDataPack, packFileSha256 } from '../src/formats/worldDataPack.js';
import {
  registerWorldDataAsset, registerWorldDataPack, installWorldDataReplacement, bindWorldDataBlocks, _resetWorldDataReplacement,
  getDFBlockReplacementData, getDFRegionAdditionalLocationData, worldDataVendorCarries, quietLocationOverrides, assetKey,
} from '../src/formats/worldDataReplacement.js';
import { clearWorldDataVariants } from '../src/systems/worldDataVariants.js';
import { blockToDfuJson } from '../src/formats/worldDataJson.js';
import { registerCustomFaction, customFactions, _resetCustomFactions } from '../src/formats/factionFile.js';
import { addCustomFactions } from '../src/systems/factionRep.js';
import { LOCATION_TYPES, MapsFile } from '../src/formats/mapsFile.js';
import { DAWN_HOUR, DUSK_HOUR } from '../src/systems/gameDate.js';
import { setModSetting, latchModLoaded, modLatchedOn, MOD_SETTINGS, _resetModSettings } from '../src/systems/modSettings.js';
import { ONLINE_ROOM_MOD_KEYS } from '../src/systems/onlineLane.js';
import { CREDITS } from '../src/ui/credits.js';
import { setValue, resetToDefaults } from '../src/systems/settings.js';
import {
  addVendorTextures, clearVendorTextures, setTextureDeriveContext, preloadTextureArchive, decodedTexture, vendorTextureStandIn,
  isVendorArchive, hasTextureReplacement, vendorFrameCount, decodedTextureTopDown, setBundleTextures, preloadTextureRecord,
} from '../src/systems/textureReplacement.js';
import { buildDerivedPicture, composeDerivedPicture, deriveSpec, classicRecordRgba } from '../src/formats/derivedTexture.js';
import { billboardXmlScale, unregisterBillboardXml } from '../src/world/billboardXml.js';
import { detailedShipsArtOn, installDetailedShipsArt, _resetDetailedShipsArt, DETAILED_SHIPS_VENDOR } from '../src/systems/detailedShips.js';
import { DET_BETONY_MODELS, DET_TOWN_FLATS, DET_FLAT_DRAWINGS, DET_MODELS, DET_TOWN_MODELS, installDetStandIns, detStandInsOn, _resetDetStandIns } from '../src/world/detStandIns.js';
import { TOWN_PICTURE_ARCHIVE, PICTURE } from '../src/world/townPictures.js';
import { STAND_IN_SPRITES } from '../src/world/standInSprites.js';
import { hasCustomModel, customModelFor, _resetCustomModels } from '../src/world/customModels.js';
import { flatFaceOverride, _resetFlatFaceOverrides } from '../src/characters/staticNpc.js';
import { createDataPipeline } from '../src/scenes/dataPipeline.js';
import { DFPalette } from '../src/formats/dfPalette.js';
import { BlocksFile } from '../src/formats/blocksFile.js';
import { Arch3dFile } from '../src/formats/arch3dFile.js';
import { TextureFile } from '../src/formats/textureFile.js';
import { tinyRmb, fakeBlocks } from './wd3Fakes.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const VENDOR = join(ROOT, 'vendor/betony-restored');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const ARENA2 = process.env.ARENA2_PATH;
const HAVE_ARENA2 = !!ARENA2 && ['BLOCKS.BSA', 'MAPS.BSA', 'ARCH3D.BSA'].every((f) => existsSync(join(ARENA2, f)));
const MANIFEST = JSON.parse(read('vendor/betony-restored/betony-restored.dfmod.json'));
const packJson = () => JSON.parse(zlib.gunzipSync(readFileSync(join(VENDOR, 'WorldDataPack/betony-restored.pack.json.gz'))).toString('utf8'));
const U = 0.025;

/** A picture's pixels with every clear pixel zeroed, hashed with its size (test/ds1_detailedShips.test.js's measure). */
function pictureHash({ width, height, data }) {
  const d = new Uint8Array(data);
  for (let i = 0; i < width * height; i++) if (d[i * 4 + 3] === 0) d.fill(0, i * 4, i * 4 + 4);
  return createHash('sha256').update(Buffer.from([width & 255, width >> 8, height & 255, height >> 8])).update(d).digest('hex');
}
/** The thirteen pictures the pack rebuilds from classic records, as pictureHash names the AUTHOR'S (measured off the
 *  shipped bundle, `betony restored.dfmod`). */
const AUTHOR_DERIVED = Object.freeze({
  '218_5-0': ['23x39', '0f7468481b68f906f9b59642f635f2be3d789e0a37cdd24a905059279b11b839'],
  '540_2-0': ['13x29', '2c587c471ac18889cdfcde50df0904f9463514963f6f3d4feda797c333cd6d4e'],
  '540_3-0': ['9x19', 'bc50389ac520ae999f7c317446976a11e8d3de83723901ce3fc70d08439defe7'],
  '540_4-0': ['15x21', 'c393899d4153a0510191b28530ead267dbda5b66c71cc9476be8015763fa7050'],
  '540_5-0': ['27x47', '0053992d31e1a8541e8594dfebcc05f873a007378a76cdd726cfbc471033bf63'],
  '540_11-0': ['29x61', 'ed6df715b39988ab6ca8a3b4daba3f8eb9b24d8eaf4de386439f10aa11bb4633'],
  '540_16-0': ['13x54', 'aba0d237c30f1186c5a7368f8eb558b9960139d9a806ab03b3b1c1f09473eeca'],
  '540_17-0': ['13x50', '5e9c4c77566676f83645ec04c347aa358bf2e4bdf7d7cb51db04197ae83630b7'],
  '540_18-0': ['16x55', 'b9392cda3543f7839c67d7fa75213c77853d7817943a7fd76693088336fc0d49'],
  '540_19-0': ['41x93', '823148365d4a09f7486b09b19574bb9ad52905e372943c8c238fbabd229de4e1'],
  '540_20-0': ['16x86', '6e07661d99bc733b8fcebf0c5602a3dbd566ddbcfc10106f98a582c828ed8c5d'],
  '1210_13-0': ['42x26', '82b12f58b5a69e6477630285e3e3a70abf538e0b921cd428eda27e81662331f7'],
  '1210_16-0': ['42x26', '6853fb007f5f99ab9b9351adff6beea9355eb2dafd345b207a92e19467ae2c7e'],
});
/** Every `name:pictureHash` line of the author's 66 own pictures, hashed in BETONY_OWN_ART's order (the same bundle). */
const AUTHOR_OWN_AGGREGATE = '345b036451efb708f77774c039be4b398a4e40a057c2fffba20fb4b23a4730a0';

const synthetic = (w, h, seed = 1) => {
  const data = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) { data[i * 4] = (i * 7 + seed) & 255; data[i * 4 + 1] = (i * 13 + seed) & 255; data[i * 4 + 2] = (i * 29 + seed) & 255; data[i * 4 + 3] = (i + seed) % 3 ? 255 : 0; }
  return { width: w, height: h, data };
};
function resetAll() {
  _resetBetonyRestored(); _resetDetailedShipsArt(); _resetDetStandIns(); _resetCustomModels(); clearVendorTextures(); _resetCustomFactions();
  unregisterBillboardXml(BETONY_VENDOR); unregisterBillboardXml(DETAILED_SHIPS_VENDOR); setTextureDeriveContext(null); _resetModSettings();
  _resetFlatFaceOverrides(); setBetonyPortraitProbe(null);
}
const quiet = (t) => { t.mock.method(console, 'log', () => {}); t.mock.method(console, 'warn', () => {}); };

// ---- the vendored mod ---------------------------------------------------------------------------------------------------
test('BET1 the vendored mod: the manifest, the readme and Flat Replacer\'s rules verbatim; the textures directory is exactly the pictures carried - 66 of the author\'s own (his pixels, pixel for pixel), the Mara statue\'s scale, 13 rebuilt specs, 7 re-shades named - and nothing of StarMadeKnight\'s, of Detailed Ships\' or of Basic Roads\'', () => {
  assert.deepEqual([MANIFEST.ModTitle, MANIFEST.ModVersion, MANIFEST.ModAuthor, MANIFEST.GUID], ['Betony Restored', '1.1.3', 'Cliffworms', '7fa973db-3079-4648-bb62-e2196bf7095b']);
  assert.deepEqual(MANIFEST.Dependencies.map((d) => [d.Name, d.IsPeer, d.Version]), [['daggerfall expanded textures', true, '1.2.0'], ['rmb resource pack', false, '0.3.0'], ['flat replacer', true, '0.2.18']]);
  const readme = read('vendor/betony-restored/Readme_BetonyRestored.txt');
  assert.ok(readme.includes('The mod may be distributed/translated without my authorization as long as I am credited as the author.'), 'the permission');
  assert.ok(read('vendor/betony-restored/README.md').replace(/\s+/g, ' ').includes('"This is the next mod I would like to integrate"'), 'the owner\'s words');
  // the textures: what is carried and nothing else
  const files = readdirSync(join(VENDOR, 'Textures')).sort();
  assert.deepEqual(files, [...BETONY_OWN_ART.map((n) => `${n}.png`), '1230_11-0.xml', 'derived.json', 'reshaded.json'].sort());
  assert.equal(BETONY_OWN_ART.length, 66);
  // AUDIT D1: the tool's listing of them - what test/doctrine.test.js lets stand under Textures/ - and the bundle it read
  const listing = JSON.parse(read('vendor/betony-restored/betony-restored.files.json'));
  assert.deepEqual([[...listing.Files].sort(), listing.Bundle, listing.BundleSha256], [files, 'Mods/betony restored.dfmod', '8d0c209c61278b92e5740820f1575c91138c5701a593cc70e1dd8e0d4a9533f5']);
  assert.ok(read('test/doctrine.test.js').includes("['vendor/betony-restored/Textures/',\n    { manifest: 'vendor/betony-restored/betony-restored.files.json',"), 'the doctrine\'s row reads it');
  assert.deepEqual(Object.keys(BETONY_DERIVED), Object.keys(AUTHOR_DERIVED));
  assert.deepEqual(BETONY_RESHADED, { '540_0-0': [210, 0, 2], '540_21-0': [210, 21, 4], '540_22-0': [210, 22], '540_24-0': [101, 6], '540_25-0': [101, 7], '540_26-0': [101, 8], '540_27-0': [101, 9] });
  // the scale, read back off the file
  const xml = read('vendor/betony-restored/Textures/1230_11-0.xml');
  assert.deepEqual([Number(/<scaleX>([\d.]+)</.exec(xml)[1]), Number(/<scaleY>([\d.]+)</.exec(xml)[1])], [...BETONY_XML[1230][11]]);
  assert.deepEqual(BETONY_XML, { 1230: { 11: [0.7, 0.7] } });
  // the author's own pictures, his pixels
  const agg = createHash('sha256');
  for (const name of BETONY_OWN_ART) agg.update(`${name}:${pictureHash(readPng(readFileSync(join(VENDOR, 'Textures', `${name}.png`))))}\n`);
  assert.equal(agg.digest('hex'), AUTHOR_OWN_AGGREGATE);
  // Flat Replacer's six rules: each a flat replacing itself, a portrait its one effect
  const rules = JSON.parse(read('vendor/betony-restored/FlatReplacements/BetonyRestoredFlatReplacements.json'));
  assert.equal(rules.length, 6);
  assert.ok(rules.every((r) => r.TextureArchive === r.ReplaceTextureArchive && r.TextureRecord === r.ReplaceTextureRecord && r.Regions[0] === -1 && r.FactionId === -1 && r.BuildingType === -1 && r.QualityMin === 1 && r.QualityMax === 20));
});

// ---- the pack ---------------------------------------------------------------------------------------------------------
test('BET1 the pack: 39 files - the 25 new places carried whole on no base (`[\'n\']`), the fourteen blocks edits of their classic namesakes - in the manifest\'s own order, which `names()` answers; an order that misses a file, names one twice or names a stranger refuses the pack', () => {
  const pack = packJson();
  assert.equal(pack.vendor, BETONY_VENDOR);
  const entries = Object.entries(pack.files).map(([n, e]) => [n, typeof e === 'string' ? JSON.parse(e) : e]);
  assert.equal(entries.length, 39);
  const places = entries.filter(([n]) => n.startsWith('locationnew-')), blocks = entries.filter(([n]) => n.endsWith('.RMB.json'));
  assert.equal(places.length, 25);
  assert.ok(places.every(([n, [, base]]) => /^locationnew-[A-Za-z]+-19\.json$/.test(n) && base.length === 1 && base[0] === 'n'), 'a new place is no classic location\'s edit');
  assert.deepEqual(blocks.map(([n, [, base]]) => [n, base[0], base[1]]).sort(), [
    ['MARKAA00BETONY.RMB.json', 'b', 'MARKAA00.RMB'], ['PALAAA00BETONY.RMB.json', 'b', 'PALAAA00.RMB'],
    ...Array.from({ length: 12 }, (_, k) => { const w = `WALLAA${String(k).padStart(2, '0')}`; return [`${w}BETONY.RMB.json`, 'b', `${w}.RMB`]; }),
  ].sort());
  // the order is the manifest's Files, as DFU's FindAssets walks them
  const want = MANIFEST.Files.map(dfuWorldDataName).filter(Boolean);
  assert.deepEqual(pack.order, want);
  const p = openWorldDataPack(pack, { blocks: fakeBlocks() });
  assert.deepEqual(p.names(), want);
  assert.notDeepEqual(want, Object.keys(pack.files), 'the order is not the files\' own - a pack without it would answer another');
  for (const bad of [want.slice(1), [...want.slice(1), want[1]], [...want.slice(1), 'locationnew-Nowhere-19.json']]) {
    assert.throws(() => openWorldDataPack({ ...pack, order: bad }, { blocks: fakeBlocks() }), /its order does not name every file once/);
  }
});

test('BET1 a new place rebuilds from nothing - every one of the 25 the author\'s file, sha256 for sha256, no MAPS.BSA asked; Betony City its 6 x 6 blocks and 311 buildings', async () => {
  const pack = packJson();
  const p = openWorldDataPack(pack, { blocks: fakeBlocks() });
  const maps = new Proxy({}, { get: (_, k) => { throw new Error(`MAPS.BSA asked for ${String(k)}`); } });
  for (const name of p.names().filter((n) => n.startsWith('locationnew-'))) {
    const json = p.rebuild(name, maps);
    assert.equal(await packFileSha256(json), p.sha256Of(name), name);
  }
  const city = p.rebuild('locationnew-Betony-19.json', maps);
  assert.deepEqual([city.Name, city.RegionIndex, city.MapTableData.LocationType, city.Exterior.ExteriorData.Width, city.Exterior.ExteriorData.Height, city.Exterior.BuildingCount], ['Betony', 19, 'TownCity', 6, 6, 311]);
  assert.ok(city.Exterior.ExteriorData.BlockNames.includes('MARKAA00Betony.RMB') && city.Exterior.ExteriorData.BlockNames.includes('PALAAA00Betony.RMB'), 'its grid names the marketplace and the palace');
});

// ---- the door -----------------------------------------------------------------------------------------------------------
function door() {
  _resetWorldDataReplacement(); clearWorldDataVariants(); resetToDefaults();
  setValue('Enhancements', 'AssetInjection', 'True');
  installWorldDataReplacement();
  bindWorldDataBlocks(fakeBlocks(tinyRmb(7, 'WALLAA00.RMB')));
}
test('BET1 the door is case-blind, as DFU\'s is (ModManager.TryGetAsset asks AssetBundle.Contains, and a bundle lowercases its names): the grid\'s `WALLAA00Betony.RMB` is the pack\'s `WALLAA00BETONY.RMB.json`', (t) => {
  quiet(t);
  door();
  assert.equal(assetKey('WALLAA00Betony.RMB.json'), 'wallaa00betony.rmb.json');
  assert.equal(registerWorldDataAsset('WALLAA00BETONY.RMB.json', blockToDfuJson(tinyRmb(7, 'WALLAA00BETONY.RMB')), () => true, { vendor: BETONY_VENDOR }), true);
  assert.equal(worldDataVendorCarries(BETONY_VENDOR, 'WALLAA00Betony.RMB.json'), true);
  const b = getDFBlockReplacementData(7, 'WALLAA00Betony.RMB');
  assert.ok(b?.rmbBlock, 'served under the grid\'s spelling');
  assert.equal(getDFBlockReplacementData(7, 'WALLAA01Betony.RMB'), null);
  // ...and FindAssets is NOT: DFU's Mod.FindAssetNames matches the suffix ordinal against the manifest's own spelling,
  // and the region's reader asks the asset's own name StartsWith("locationnew-")
  const cabin = openWorldDataPack(packJson(), { blocks: fakeBlocks() }).rebuild('locationnew-TheYeomfordCabin-19.json', null);
  for (const [file, name] of [['locationnew-Upper-19.JSON', 'Upper'], ['LOCATIONNEW-Shout-19.json', 'Shout'], ['locationnew-Fine-19.json', 'Fine']]) {
    registerWorldDataAsset(file, { ...cabin, Name: name, MapTableData: { ...cabin.MapTableData, MapId: cabin.MapTableData.MapId + name.length } }, () => true, { vendor: BETONY_VENDOR });
  }
  const region = { name: 'Betony', locationCount: 1, mapNames: ['Classic'], mapTable: [{ mapId: 1, locationId: 0 }], mapNameLookup: new Map([['Classic', 0]]), mapIdLookup: new Map([[1, 0]]) };
  assert.equal(getDFRegionAdditionalLocationData(19, region), true);
  assert.deepEqual(region.mapNames, ['Classic', 'Fine']);
  _resetWorldDataReplacement(); resetToDefaults();
});

test('BET1 the region\'s new places take their indices in the manifest\'s order - DFU\'s FindAssets walks a mod\'s files so - past region 19\'s own 25: Betony City is 34', (t) => {
  quiet(t);
  door();
  quietLocationOverrides(true);
  const p = openWorldDataPack(packJson(), { blocks: fakeBlocks() });
  assert.equal(registerWorldDataPack(p, () => true), 39);
  const names = Array.from({ length: 25 }, (_, i) => `Classic ${i}`);
  const region = { name: 'Betony', locationCount: 25, mapNames: [...names], mapTable: names.map((_, i) => ({ mapId: i + 1, locationId: 0 })), mapNameLookup: new Map(names.map((n, i) => [n, i])), mapIdLookup: new Map(names.map((_, i) => [i + 1, i])) };
  assert.equal(getDFRegionAdditionalLocationData(19, region), true);
  assert.equal(region.locationCount, 50);
  const order = p.names().filter((n) => n.startsWith('locationnew-')).map((n) => p.rebuild(n, null).Name);
  assert.deepEqual(region.mapNames.slice(25), order);
  assert.deepEqual([region.mapNames[25], region.mapNames[34], region.mapNames[49]], ['The Yeomford Cabin', 'Betony', 'Chestercester']);
  assert.equal(region.mapTable[34].mapId, 259119, 'Betony City at map pixel (119, 259)');
  _resetWorldDataReplacement(); resetToDefaults();
});

// ---- the script ---------------------------------------------------------------------------------------------------------
test('BET1 Lord Mogref (RegisterFactionIds, IL_0308-038d): registered under the key 1432 with the record\'s own id 1532 kept - the dictionary finds him by 1432, his parent (203) lists 1532, as DFU\'s RelinkChildren pushes the record\'s id; a record naming no id takes its key', () => {
  resetAll();
  assert.equal(LORD_MOGREF_FACTION_KEY, 1432);
  assert.deepEqual({ ...LORD_MOGREF_FACTION }, { id: 1532, parent: 203, type: 4, name: 'Lord Mogref', summon: -1, region: 20, power: 18, face: 405, race: 3, sgroup: 3, ggroup: -1, children: null });
  assert.equal(registerCustomFaction(LORD_MOGREF_FACTION_KEY, LORD_MOGREF_FACTION), true);
  assert.equal(registerCustomFaction(LORD_MOGREF_FACTION_KEY, LORD_MOGREF_FACTION), false, 'the key taken');
  assert.deepEqual([customFactions().get(1432).id, customFactions().get(1432).name, customFactions().has(1532)], [1532, 'Lord Mogref', false]);
  const dict = new Map([[203, { id: 203, parent: 0, name: 'Betony', children: [] }]]);
  addCustomFactions(dict);
  assert.equal(dict.get(1432).id, 1532);
  assert.deepEqual(dict.get(203).children, [1532]);
  assert.equal(registerCustomFaction(9999, { name: 'Nobody' }), true);
  assert.equal(registerCustomFaction(9998, { id: undefined, name: 'Undefined' }), true);
  assert.deepEqual([customFactions().get(9999).id, customFactions().get(9998).id], [9999, 9998]);
  resetAll();
});

test('BET1 Init: "Begin mod init", the faction, "Finished mod init", the pictures and the portraits - once, and only once the world-data loader has latched the mod (AUDIT B3): a host that reaches Init first is answered nothing - no faction of a mod whose pack then does not land, none in the save - and the loader\'s own call inits it; nothing while it is not loaded', (t) => {
  resetAll();
  const logs = [];
  t.mock.method(console, 'log', (...a) => logs.push(a.join(' ')));
  t.mock.method(console, 'warn', () => {});
  // the classic skin's splash: every Init before any world is read - the latch unanswered, the switch on
  setModSetting(BETONY_VENDOR, 'Enabled', true);
  assert.equal(modLatchedOn(BETONY_VENDOR), undefined);
  assert.equal(installBetonyRestored({ fetchBytes: async () => new Uint8Array(0) }), false, 'answered nothing');
  assert.deepEqual([modLatchedOn(BETONY_VENDOR), betonyLoaded(), customFactions().has(1432), logs.length], [undefined, false, false, 0], 'no latch of its own, no faction, no word');
  // ...then the loader: the pack did not land (a closed door, the network) - the mod is not loaded, and stays so
  latchModLoaded(BETONY_VENDOR, false);
  assert.equal(installBetonyRestored({ fetchBytes: async () => new Uint8Array(0) }), true);
  assert.equal(installBetonyRestored({ fetchBytes: async () => new Uint8Array(0) }), false, 'once');
  assert.deepEqual([betonyLoaded(), customFactions().has(1432), logs.length], [false, false, 0]);
  // the pack landed: the loader's call inits it - the faction, the two lines, once
  resetAll(); logs.length = 0;
  latchModLoaded(BETONY_VENDOR, true);
  assert.equal(installBetonyRestored({ fetchBytes: async () => new Uint8Array(0) }), true);
  assert.equal(installBetonyRestored({ fetchBytes: async () => new Uint8Array(0) }), false, 'once');
  assert.deepEqual([betonyLoaded(), customFactions().get(1432)?.id], [true, 1532]);
  assert.deepEqual(logs, ['Begin mod init: BetonyRestored', 'Finished mod init: BetonyRestored']);
  // the loader calls Init once its latch is set, whatever host boots it (scenes/modWorldData.js)
  const M = read('src/scenes/modWorldData.js');
  const latch = M.indexOf('if (on && door && !got) _missing.add(vendor);'), call = M.indexOf('    installBetonyRestored();\n');
  assert.ok(latch > 0 && call > latch && call < M.indexOf('return n + counts.reduce('), 'Init after every pack is latched, inside the load');
  resetAll();
});

test('BET1 UpdateExteriorNPCs\' law (IL_0409-049a): every flag combination, by day and by night, dry and raining - flags 1 hide by day, 2 by night, 4 in the rain', () => {
  assert.deepEqual({ ...BETONY_NPC_FLAGS }, { hideDay: 1, hideNight: 2, hideWeather: 4 });
  const table = [];
  for (let flags = 0; flags < 8; flags++) for (const isDay of [true, false]) for (const isRaining of [false, true]) table.push(betonyNpcShown(flags, isDay, isRaining) ? 1 : 0);
  // rows: flags 0..7; columns: day-dry, day-rain, night-dry, night-rain
  assert.deepEqual(table, [
    1, 1, 1, 1,   // 0
    0, 0, 1, 1,   // 1 hide by day
    1, 1, 0, 0,   // 2 hide by night
    0, 0, 1, 1,   // 3 the day bit wins (the IL tests it first)
    1, 0, 1, 0,   // 4 hide in the rain
    0, 0, 1, 0,   // 5 by day, and in the rain
    1, 0, 0, 0,   // 6 by night, and in the rain
    0, 0, 1, 0,   // 7
  ]);
});

test('BET1 UpdateExteriorNPCs over the street: nothing outside a town or with the player indoors; a billboard with no faction passed over; one a quest has placed elsewhere kept down whatever the hour (BET-FIX); the count of people changed', () => {
  const people = () => [
    { factionID: 1500, flags: 1, active: true },    // a trader who hides by day
    { factionID: 1501, flags: 2, active: true },    // one who hides by night
    { factionID: 0, flags: 1, active: true },       // no faction: no StaticNPC to set
    { factionID: 1502, flags: 0, active: false, questAway: true },   // placed away by a quest
    { factionID: 1503, flags: 4, active: false },   // one who hides in the rain
  ];
  const day = { locationType: LOCATION_TYPES.TownCity, inside: false, isDay: true, isRaining: false };
  let npcs = people();
  assert.equal(updateExteriorNpcs(npcs, { ...day, locationType: LOCATION_TYPES.DungeonKeep }), 0, 'not a town');
  assert.equal(updateExteriorNpcs(npcs, { ...day, inside: true }), 0, 'indoors');
  assert.deepEqual(npcs.map((p) => p.active), [true, true, true, false, false], 'untouched');
  assert.equal(updateExteriorNpcs(npcs, day), 2);
  assert.deepEqual(npcs.map((p) => p.active), [false, true, true, false, true]);
  assert.equal(updateExteriorNpcs(npcs, day), 0, 'nothing changed the second time');
  npcs = people();
  assert.equal(updateExteriorNpcs(npcs, { ...day, isDay: false, isRaining: true }), 1);
  assert.deepEqual(npcs.map((p) => p.active), [true, false, true, false, false], 'the night, raining: the quest\'s person stays down');
  for (const type of ['TownHamlet', 'TownVillage', 'HomeFarms', 'HomeWealthy', 'Tavern', 'ReligionTemple']) assert.equal(updateExteriorNpcs(people(), { ...day, locationType: LOCATION_TYPES[type] }), 2, type);
  assert.equal(updateExteriorNpcs(null, day), 0);
});

test('BET1 the three events (InitMod, IL_029a-02d9): WorldTime.OnDawn and OnDusk an hour\'s edge into 6 and 18 (a jump past them raises none), WeatherManager.OnWeatherChange; the first frame only remembers', () => {
  assert.deepEqual([DAWN_HOUR, DUSK_HOUR], [6, 18]);
  const ev = createBetonyEvents();
  assert.equal(ev.tick(5, 'Sunny'), false, 'the first call remembers');
  assert.equal(ev.tick(5, 'Sunny'), false);
  assert.equal(ev.tick(6, 'Sunny'), true, 'dawn');
  assert.equal(ev.tick(6, 'Sunny'), false, 'still six: no edge');
  assert.equal(ev.tick(12, 'Sunny'), false);
  assert.equal(ev.tick(12, 'Rain'), true, 'the weather changed');
  assert.equal(ev.tick(17, 'Rain'), false);
  assert.equal(ev.tick(18, 'Rain'), true, 'dusk');
  assert.equal(ev.tick(23, 'Rain'), false);
  assert.equal(ev.tick(7, 'Rain'), false, 'a jump from 23 to 7 raises no dawn');
  const first = createBetonyEvents();
  assert.equal(first.tick(6, 'Rain'), false, 'a game loaded at six raises nothing');
});

// ---- the pictures -----------------------------------------------------------------------------------------------------
test('BET1 the pictures: 89 on the door behind the mod\'s latch - 66 drawings, 13 rebuilt, 7 re-shades and the pack\'s 3 people stood in by classic records (both yielding to the player\'s own); 218_5 one record of Daggerfall\'s own archive, never its stand-in; the Mara statue\'s scale; Detailed Ships\' nine shared; DET\'s stand-ins on', async () => {
  resetAll();
  latchModLoaded(BETONY_VENDOR, true);
  setModSetting(DETAILED_SHIPS_VENDOR, 'Enabled', false);
  const fetched = [];
  assert.equal(installBetonyArt({ fetchBytes: async (n) => { fetched.push(n); return readFileSync(join(VENDOR, 'Textures', `${n}.png`)); } }), 66 + 13 + 7 + 3);
  assert.equal(installBetonyArt(), 0, 'once');
  for (const a of [540, 1200, 1210, 1230]) assert.equal(isVendorArchive(a), true, `${a} a mod archive`);
  assert.equal(isVendorArchive(218), false, 'TEXTURE.218 stays the player\'s - one record of it replaced');
  assert.equal(hasTextureReplacement(218, 5), true);
  assert.deepEqual(billboardXmlScale(1230, 11), { x: 0.7, y: 0.7 });
  assert.equal(detailedShipsArtOn(), true, 'Detailed Ships\' pictures answer to this mod too');
  assert.equal(detStandInsOn(), true);
  assert.equal(hasCustomModel(45078), true);
  // the people: a classic record, sized as it sizes itself, yielding
  assert.deepEqual({ ...BETONY_NPC_STAND_INS }, { 13: [183, 10], 14: [183, 5], 19: [182, 45] });
  assert.equal(BETONY_NPC_ARCHIVE, 1200);
  const asked = [];
  setTextureDeriveContext({
    classicRgba: async (a, r, f = 0) => { asked.push(`${a}_${r}-${f}`); return synthetic(6, 9, a + r); },
    classicScale: async (a, r) => (a === 183 && r === 5 ? { width: 20, height: 30 } : { width: 0, height: 0 }),
  });
  await preloadTextureArchive(1200, { decode: async (bytes) => { const p = readPng(bytes); return { ...p, data: new Uint8Array(p.data) }; } });
  const woman = decodedTexture(1200, 14);
  assert.deepEqual([woman.width, woman.height, woman.recordScale], [6, 9, { width: 20, height: 30 }]);
  assert.ok(asked.includes('183_5-0') && asked.includes('183_10-0') && asked.includes('182_45-0'));
  // off with the mod
  latchModLoaded(BETONY_VENDOR, false);
  assert.equal(hasTextureReplacement(218, 5), false);
  assert.equal(billboardXmlScale(1230, 11), null);
  assert.equal(detailedShipsArtOn(), false);
  assert.equal(hasCustomModel(45078), false);
  resetAll();
});

test('BET1 the stand-ins YIELD to the player\'s own picture of the record - a re-shaded light to an attached copy of the mod, the pack\'s person to an attached RMB Resource Pack - with Replace Game Artwork on; the mod\'s own drawings keep their place', async () => {
  resetAll();
  latchModLoaded(BETONY_VENDOR, true);
  setValue('Enhancements', 'AssetInjection', 'True');
  installBetonyArt({ fetchBytes: async (n) => readFileSync(join(VENDOR, 'Textures', `${n}.png`)) });
  setTextureDeriveContext({ classicRgba: async () => synthetic(4, 4), classicScale: async () => ({ width: 0, height: 0 }) });
  const decode = async (bytes) => { const p = readPng(bytes); return { ...p, data: new Uint8Array(p.data) }; };
  assert.equal((await preloadTextureRecord(540, 0, 0, 'Albedo', null, { decode }))?.width, 4, 'the classic record it re-shades, with no pick of the player\'s');
  setBundleTextures([
    { archive: 540, record: 0, fileName: 'betony restored.dfmod:540_0-0', image: async () => synthetic(5, 1) },
    { archive: 1200, record: 14, fileName: 'rmb resource pack.dfmod:1200_14-0', image: async () => synthetic(7, 1) },
    { archive: 1210, record: 14, fileName: 'x.dfmod:1210_14-0', image: async () => synthetic(9, 1) },
  ]);
  assert.equal((await preloadTextureRecord(540, 0, 0, 'Albedo', null, { decode }))?.width, 5, 'the player\'s own copy of the mod answers first');
  assert.equal((await preloadTextureRecord(1200, 14, 0, 'Albedo', null, { decode }))?.width, 7, 'the player\'s own pack answers first');
  assert.equal((await preloadTextureRecord(1210, 14, 0, 'Albedo', null, { decode }))?.width, 42, 'the author\'s own shelf keeps its place');
  setBundleTextures([]); resetToDefaults();
  resetAll();
});

test('BET1 Kamer\'s patrons animate: a vendor record\'s frames are its pictures 0, 1, 2 ... to the first missing one - 31 and 32 - and a still picture is one (the stand-in answered one for every record)', () => {
  resetAll();
  latchModLoaded(BETONY_VENDOR, true);
  installBetonyArt({ fetchBytes: async () => new Uint8Array(0) });
  assert.deepEqual([vendorFrameCount(1200, 53), vendorFrameCount(1200, 54), vendorFrameCount(1210, 14), vendorFrameCount(1230, 11)], [31, 32, 1, 1]);
  const t = vendorTextureStandIn(1200);
  assert.deepEqual([t.getFrameCount(53), t.getFrameCount(54), t.getFrameCount(14)], [31, 32, 1]);
  addVendorTextures([0, 1, 3].map((frame) => ({ archive: 9001, record: 0, frame, standIn: true, build: async () => synthetic(2, 2) })));
  assert.equal(vendorFrameCount(9001, 0), 2, 'up to the first missing frame');
  assert.equal(vendorFrameCount(9001, 7), 1, 'none registered: one');
  resetAll();
});

test('BET1 a rebuilt picture\'s `also` layers (WD2): further classic records laid over the first at their own spots, opaque pixels only, before the author\'s edits - and the spec round trip writes them; a layer named and not read is refused', async () => {
  const base = { width: 6, height: 4, data: new Uint8Array(6 * 4 * 4) };
  for (let i = 0; i < 24; i++) base.data.set([10, 20, 30, 255], i * 4);
  const cup = { width: 2, height: 2, data: new Uint8Array([200, 0, 0, 255, 0, 0, 0, 0, 200, 0, 0, 255, 200, 0, 0, 255]) };
  const spec = { from: [205, 1], also: [{ from: [200, 1], at: [3, 1] }], edits: [[0, 0, '00ff00ff']] };
  const pic = composeDerivedPicture(spec, base, [cup]);
  const px = (x, y) => [...pic.data.slice((y * 6 + x) * 4, (y * 6 + x) * 4 + 4)];
  assert.deepEqual([px(3, 1), px(4, 1), px(3, 2), px(4, 2), px(5, 3), px(0, 0)], [[200, 0, 0, 255], [10, 20, 30, 255], [200, 0, 0, 255], [200, 0, 0, 255], [10, 20, 30, 255], [0, 255, 0, 255]], 'the cup\'s clear pixel leaves the plank; the edit over all');
  assert.throws(() => composeDerivedPicture(spec, base, []), /1 further records named and 0 read/);
  const asked = [];
  const built = await buildDerivedPicture(spec, async (a, r, f) => { asked.push(`${a}_${r}-${f}`); return a === 200 ? cup : base; });
  assert.deepEqual(asked, ['205_1-0', '200_1-0']);
  assert.deepEqual([...built.data], [...pic.data]);
  const back = deriveSpec([205, 1], pic, base, [0, 0], [{ from: [200, 1], at: [3, 1], src: cup }]);
  assert.deepEqual(back, spec, 'the tool\'s half writes the layer and only the one edit');
  // the two shelves the pack carries are such pictures
  assert.ok(BETONY_DERIVED['1210_13-0'].also?.length > 0 && BETONY_DERIVED['1210_16-0'].also?.length > 0);
});

/** One-record TEXTURE archive, uncompressed, stride 256 (test/dyeicon.test.js's shape). */
function textureBytes(width, height, indices) {
  const recPos = 46, RECORD_HEADER = 28;
  const bytes = new Uint8Array(recPos + RECORD_HEADER + 256 * height);
  const v = new DataView(bytes.buffer);
  v.setInt16(0, 1, true);
  v.setInt32(28, recPos, true);
  v.setInt16(recPos + 4, width, true);
  v.setInt16(recPos + 6, height, true);
  v.setUint32(recPos + 10, 256 * height, true);
  v.setUint32(recPos + 14, RECORD_HEADER, true);
  v.setUint16(recPos + 20, 1, true);
  for (let y = 0; y < height; y++) bytes.set(indices.subarray(y * width, (y + 1) * width), recPos + RECORD_HEADER + y * 256);
  return bytes;
}
test('BET1 the pipeline: a picture rebuilt from a record of its OWN archive (the smokeless pot, 218_5, off TEXTURE.218) builds while that archive loads - it reads the file in hand and never awaits itself', async () => {
  resetAll();
  const palette = new DFPalette(); palette.makeGrayscale();
  addVendorTextures([{ archive: 218, record: 0, fileName: '218_0-0', build: (ctx) => buildDerivedPicture({ from: [218, 0], edits: [[0, 0, '00000000']] }, ctx.classicRgba) }]);
  const renderer = { uploadTexture() {}, uploadEmissionTexture() {}, createMesh: (m) => ({ mesh: m }) };
  const pipe = createDataPipeline({ renderer, arch: null, palette, fetch: async (n) => { if (n === 'TEXTURE.218') return textureBytes(2, 2, new Uint8Array([0x70, 0x7f, 0x65, 0x60])); throw new Error(`no ${n} here`); } });
  const t = await Promise.race([pipe.getTexture(218), new Promise((_, no) => setTimeout(() => no(new Error('TEXTURE.218 never published: the build awaited its own archive')), 2000))]);
  assert.equal(t.archive, 218);
  const d = decodedTextureTopDown(218, 0);
  assert.deepEqual([d.width, d.height], [2, 2]);
  assert.deepEqual([d.rgba[3], d.rgba[7]], [0, 255], 'the edit, and the record under it');
  resetAll();
});

// ---- Flat Replacer's portraits --------------------------------------------------------------------------------------------
test('BET1 Flat Replacer\'s six rules: the talk window\'s face for the custom people - Kamer\'s patrons Daggerfall\'s own faces (360, 243) while the mod is loaded; the RMB Resource Pack\'s four (TFAC00I0.RCI_1200014 ...) only while an attached mod carries the picture, else DFU\'s own pick', (t) => {
  quiet(t);
  resetAll();
  assert.equal(CUSTOM_PORTRAIT_FIRST, 503);
  assert.deepEqual(flatReplacerPortraits().map((p) => [p.archive, p.record, p.face, p.classic]), [[1200, 14, 1200014, false], [1200, 15, 1200015, false], [1200, 17, 1200017, false], [1200, 19, 1200019, false], [1200, 53, 360, true], [1200, 54, 243, true]]);
  assert.deepEqual(flatReplacerPortraits([{ TextureArchive: 1200, TextureRecord: 1, ReplaceTextureArchive: 1200, ReplaceTextureRecord: 2, FlatPortrait: 5 }, { TextureArchive: 1, TextureRecord: 1, ReplaceTextureArchive: 1, ReplaceTextureRecord: 1, FlatPortrait: -1 }]), [], 'a replacement of the picture, or no portrait: none');
  latchModLoaded(BETONY_VENDOR, true);
  installBetonyRestored({ fetchBytes: async () => new Uint8Array(0) });
  assert.deepEqual([flatFaceOverride(1200, 53), flatFaceOverride(1200, 54)], [360, 243]);
  assert.equal(flatFaceOverride(1200, 14), null, 'no mod carries 1200014');
  const asked = [];
  setBetonyPortraitProbe((file, face) => { asked.push(`${file}_${face}`); return face === 1200014; });
  assert.deepEqual([flatFaceOverride(1200, 14), flatFaceOverride(1200, 15)], [1200014, null]);
  assert.deepEqual(asked, ['TFAC00I0.RCI_1200014', 'TFAC00I0.RCI_1200015']);
  latchModLoaded(BETONY_VENDOR, false);
  assert.deepEqual([flatFaceOverride(1200, 53), flatFaceOverride(1200, 14)], [null, null], 'off with the mod');
  resetAll();
});

// ---- Betony's roads -------------------------------------------------------------------------------------------------------
test('BET1 Betony\'s roads: Hazelnut\'s arrays with the island\'s 7 road and 24 track pixels written in are the mod\'s own roadData and trackData, sha256 for sha256; the arrays handed in are never written', () => {
  const sha = (a) => createHash('sha256').update(a).digest('hex');
  const roads = new Uint8Array(readFileSync(join(ROOT, 'vendor/roads-hazelnut/roadData.bytes')));
  const tracks = new Uint8Array(readFileSync(join(ROOT, 'vendor/roads-hazelnut/trackData.bytes')));
  assert.deepEqual([roads.length, tracks.length], [500000, 500000]);
  assert.deepEqual([sha(roads), sha(tracks)], [BETONY_ROADS.roads.base, BETONY_ROADS.tracks.base]);
  assert.deepEqual([BETONY_ROADS.roads.pixels.length, BETONY_ROADS.tracks.pixels.length], [7, 24]);
  assert.ok([...BETONY_ROADS.roads.pixels, ...BETONY_ROADS.tracks.pixels].every(([i]) => { const x = i % 1000, y = Math.floor(i / 1000); return x >= 111 && x <= 126 && y >= 256 && y <= 270; }), 'every one on the island');
  const net = { roads, tracks, source: 'hazelnut', stats: { roadPixels: 1 } };
  const out = withBetonyRoads(net);
  assert.deepEqual([sha(out.roads), sha(out.tracks)], [BETONY_ROADS.roads.result, BETONY_ROADS.tracks.result]);
  assert.deepEqual([sha(roads), sha(tracks)], [BETONY_ROADS.roads.base, BETONY_ROADS.tracks.base], 'Basic Roads\' own untouched');
  assert.equal(out.stats.roadPixels, out.roads.reduce((n, v) => n + (v ? 1 : 0), 0));
  assert.deepEqual([out.source, out.stats.betony], ['hazelnut', true]);
  assert.equal(withBetonyRoads(null), null);
  assert.deepEqual(withBetonyRoads({ roads }), { roads }, 'no tracks: as it came');
});

// ---- the DET pieces the blocks place ---------------------------------------------------------------------------------------
const bounds = (model) => {
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < model.positions.length; i += 3) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], model.positions[i + k] / U); hi[k] = Math.max(hi[k], model.positions[i + k] / U); }
  return { lo: lo.map((v) => +v.toFixed(2)), hi: hi.map((v) => +v.toFixed(2)), tex: new Set(model.subMeshes.map((s) => `${s.textureArchive}_${s.textureRecord}`)) };
};
test('BET1 DET\'s pieces, stood in: the canopies 84 units wide and 47 deep, the high edge at the back 30 over the origin and the front fallen 0, 24 or 44 (Level, Mid Slope, Sloped), each set one of Daggerfall\'s awning cloths; the hanging hedge a slab of leaves 6 x 44 x 42 on its wall; Betony\'s tapestry and banner the port\'s drawn arms (38202_48, _49); none of the ids another table stands', () => {
  assert.deepEqual(Object.keys(DET_BETONY_MODELS).map(Number), [45012, 45048, 45078, 45079, 45080, 45104, 45105, 45106, 45107, 45108, 45117, 45131, 45132]);
  for (const id of Object.keys(DET_BETONY_MODELS)) assert.ok(!(id in DET_MODELS) && !(id in DET_TOWN_MODELS), id);
  const DROP = { 45078: 0, 45079: 24, 45080: 44, 45104: 0, 45106: 24, 45108: 44, 45105: 0, 45107: 24, 45131: 0, 45132: 24 };
  const CLOTH = { 45078: '49_6', 45079: '49_6', 45080: '49_6', 45104: '49_4', 45106: '49_4', 45108: '49_4', 45105: '49_5', 45107: '49_5', 45131: '49_2', 45132: '49_2' };
  for (const [id, drop] of Object.entries(DROP)) {
    const m = DET_BETONY_MODELS[id]();
    const cloth = m.subMeshes.find((s) => `${s.textureArchive}_${s.textureRecord}` === CLOTH[id]);
    assert.ok(cloth, `${id}: wears ${CLOTH[id]}`);
    const pts = [];
    for (let i = cloth.startIndex; i < cloth.startIndex + cloth.primitiveCount * 3; i++) { const v = m.indices[i] * 3; pts.push([m.positions[v], m.positions[v + 1], m.positions[v + 2]].map((c) => +(c / U).toFixed(2))); }
    const xs = pts.map((p) => p[0]), backY = pts.filter((p) => p[2] === -23.5).map((p) => p[1]), frontY = pts.filter((p) => p[2] === 23.5).map((p) => p[1]);
    assert.deepEqual([Math.min(...xs), Math.max(...xs)], [-42, 42], `${id}: 84 wide`);
    assert.deepEqual([...new Set(backY)], [30], `${id}: the back edge 30 up`);
    assert.deepEqual([Math.max(...frontY), Math.min(...frontY)], [30 - drop, 30 - drop - 7], `${id}: the front fallen ${drop}, a valance of 7 under it`);
  }
  const hedge = bounds(DET_BETONY_MODELS[45117]());
  assert.deepEqual([hedge.lo, [...hedge.tex]], [[-3, -22, -21], [`${TOWN_PICTURE_ARCHIVE}_${PICTURE.leaves}`]]);
  assert.deepEqual(hedge.hi.slice(1), [22, 22]);
  const tapestry = bounds(DET_BETONY_MODELS[45012]()), banner = bounds(DET_BETONY_MODELS[45048]());
  assert.ok(tapestry.tex.has(`${TOWN_PICTURE_ARCHIVE}_48`) && banner.tex.has(`${TOWN_PICTURE_ARCHIVE}_49`));
  assert.deepEqual([tapestry.lo[1], banner.lo[1]], [-54, -64], 'hanging from the origin, 1.35 m and 1.6 m');
});

test('BET1 DET\'s flats the blocks place, stood in: a Glen pony the brown horse at three quarters, the cart horses brown, the Wayrest chargers the black; grey poultry, resting rats, an ad stand and a bread pan drawn - every name a sprite, binary alpha', () => {
  assert.deepEqual([0, 2, 26, 29, 32].map((r) => [...DET_TOWN_FLATS[10010][r]]), [[201, 0, 0.75], [201, 0, 1], [201, 1, 1], [201, 1, 1], [201, 0, 1]]);
  assert.deepEqual([[10010, 8], [10010, 9], [10010, 37], [10010, 39], [10010, 41], [10025, 1], [10027, 2]].map(([a, r]) => [...DET_FLAT_DRAWINGS[a][r]]), [['grayRooster', 0], ['grayChicken', 0], ['brownRatResting', 0], ['brownRatResting', 0], ['brownRat', 0], ['adStand', 128], ['breadPan', -32]]);
  for (const n of ['grayRooster', 'grayChicken', 'brownRatResting', 'adStand', 'breadPan']) {
    const pic = STAND_IN_SPRITES[n]();
    assert.ok(pic.data.every((v, i) => i % 4 !== 3 || v === 0 || v === 255), n);
    assert.notDeepEqual([...pic.data], [...STAND_IN_SPRITES[n === 'grayRooster' ? 'brownRooster' : n === 'grayChicken' ? 'brownChicken' : 'brownRat']().data], `${n}: its own picture`);
  }
});

// ---- the switch, the room, the credit, the hosts ------------------------------------------------------------------------------
test('BET1 the switch, the room and the credit: Enabled on by default, read when the game loads; online the room\'s; Cliffworms credited with his readme\'s own terms', () => {
  assert.equal(MOD_SETTINGS[BETONY_VENDOR].keys.Enabled.default, true);
  assert.deepEqual({ ...ONLINE_ROOM_MOD_KEYS[BETONY_VENDOR] }, { Enabled: true });
  const c = CREDITS.mods.find((x) => x.vendor?.includes(BETONY_VENDOR));
  assert.deepEqual([c.title, c.version, c.author], ['Betony Restored', '1.1.3', 'Cliffworms']);
  assert.ok(c.terms.includes('as long as I am credited as the author'));
});

test('BET1 the hosts: world.js runs the update on the hour\'s and the weather\'s edges ABOVE its modal gate, on the location rect\'s entry and on the way out of a building (AUDIT B2), and as a pixel\'s people stand, after the quest\'s pass; its context pinned by value - the sticky location type (AUDIT A1), outside, the sky\'s hour, the weather word\'s rain; the host state declared before the start pixel stands; a re-stand queued and caught (AUDIT B7) over the stand\'s plan (AUDIT B4); Betony\'s roads; every host\'s boot installs the mod; exterior.js FLAGGED by name', () => {
  const world = read('src/scenes/world.js'), shared = read('src/scenes/shared.js'), mod = read('src/systems/betonyRestored.js');
  const tick = world.indexOf('    if (betonyLoaded()) {\n      betonyLocation.note(_musicLocationType());   // AUDIT A1: written only on a pixel with a location, never cleared\n      if (betonyEvents.tick(Math.floor(minuteNow() / 60), weather)) betonyStreetPeople();\n    }');
  assert.ok(tick > 0, 'the frame notes the pixel\'s location type and raises the edges');
  assert.ok(tick > world.indexOf('    questSyncTick();\n'), 'with the frame\'s other edges');
  assert.ok(world.includes("    return { locationType: betonyLocation.type(), inside: (modes?.mode ?? 'exterior') !== 'exterior', isDay: !isNight(minuteNow()), isRaining: weatherFlags(weather).raining };"), 'the context, by value');
  assert.equal((world.match(/betonyUpdateExteriorNpcs\(/g) ?? []).length, 2, 'the event walk and the stand');
  assert.ok(world.includes('      if (p.npcs?.length && betonyUpdateExteriorNpcs(p.npcs, ctx)) restandPixelNpcs(p);'));
  assert.ok(world.includes("    return standPixelNpcs(entry).catch((e) => console.error(`[betony] a pixel's street people did not stand again: ${e?.message ?? e}`));"), 'its failure said');
  assert.ok(world.includes('    const done = await npcStandTurn(entry);\n    try { await standPixelNpcsNow(entry); } finally { done(); }'), 'every stand of a pixel takes its turn, and gives it back failed or not');
  const stand = world.slice(world.indexOf('async function standPixelNpcs('), world.indexOf('function restrideTerrain('));
  const pass = stand.indexOf('entry.npcQuestPass = setupExteriorQuestStaticNpcs(entry.npcs, machine, betonyAwareHost);');
  const rule = stand.indexOf('    if (betonyLoaded()) betonyUpdateExteriorNpcs(entry.npcs, betonyContext());');
  const plan = stand.indexOf('    const plan = planNpcBatches(entry.npcs, entry.npcBatches);');
  assert.ok(pass > 0 && rule > pass && plan > rule, 'the quest\'s pass, then the hours and the rain, then the plan');
  assert.ok(stand.includes('    for (const [sig, b] of plan.free) {\n      entry.npcBatches.delete(sig);') && stand.includes('      entry.npcBatches.set(sig, batch);'), 'the gone freed, a new batch held by its signature');
  assert.ok(world.includes('      npcBatches: new Map(), npcStand: null, npcQuestPass: false,'), 'the pixel born with both (PERF-EXT10\'s shape law: nothing written on a batch after birth)');
  assert.ok(world.includes('    onTransitionExterior: () => { navalStow(); csaOnTransition(); navalTransition(); betonyStreetPeople(); },'), 'out of a building');
  assert.ok(world.includes('        betonyStreetPeople();   // BET1: PlayerGPS.OnEnterLocationRect'));
  assert.ok(world.includes('host.setActive = (active) => { pn.questAway = !active; setActive(active); };'));
  assert.ok(world.includes('if (his && betonyLoaded()) his = withBetonyRoads(his);'));
  // the host state is there before the start pixel's people stand - they take the mod's hours as they stand (a TDZ
  // before: the declaration sat beside the frame loop, 3,000 lines below the start pixel's build)
  const declared = world.indexOf('  const betonyLocation = createBetonyLocationType();'), startPixel = world.indexOf('const playerPixel = await awaitedBuild(first.px, first.py);');
  assert.ok(declared > 0 && startPixel > declared, 'declared before the start pixel stands');
  assert.ok(world.indexOf('  const betonyEvents = createBetonyEvents();') < startPixel);
  assert.ok(shared.includes('  installBetonyRestored();   // BET1') && shared.includes('setBetonyPortraitProbe(hasDfmodCifRci);'));
  assert.ok(mod.includes('exterior.js\n// (the bench) FLAGGED - it stands every street person of a record in one batch'));
});

test('BET1 AUDIT A1: the location type the mod reads is PlayerGPS\'s as DFU keeps it - TownCity before any location, written only on a pixel that has one, never cleared - so its update runs in the wilderness after a town, and not after a dungeon\'s pixel', () => {
  const loc = createBetonyLocationType();
  assert.equal(loc.type(), LOCATION_TYPES.TownCity, 'the enum\'s 0 before any location');
  assert.equal(loc.note(LOCATION_TYPES.None), LOCATION_TYPES.TownCity, 'a pixel with none writes nothing');
  assert.equal(loc.note(LOCATION_TYPES.DungeonKeep), LOCATION_TYPES.DungeonKeep);
  assert.equal(loc.note(LOCATION_TYPES.None), LOCATION_TYPES.DungeonKeep, 'never cleared');
  assert.equal(loc.note(null), LOCATION_TYPES.DungeonKeep);
  const ware = () => [{ factionID: 584, flags: 2, active: true }];   // hides by night
  const night = { inside: false, isDay: false, isRaining: false };
  let npcs = ware();
  assert.equal(updateExteriorNpcs(npcs, { ...night, locationType: loc.type() }), 0, 'after a dungeon\'s pixel: no town');
  loc.note(LOCATION_TYPES.TownVillage); loc.note(LOCATION_TYPES.None);
  assert.equal(updateExteriorNpcs(npcs, { ...night, locationType: loc.type() }), 1, 'in the wilderness after a village: the update runs');
  assert.equal(npcs[0].active, false);
  npcs = ware();
  assert.equal(updateExteriorNpcs(npcs, { ...night, locationType: createBetonyLocationType().type() }), 1, 'before any location: TownCity');
});

test('BET1 AUDIT B4: the stand\'s plan - one batch a drawn picture over the ACTIVE people (the away arm\'s person out of the draw); a group whose people are the same keeps its batch, a changed one is built again, a gone one freed', () => {
  const pn = (x, archive = 182, record = 3, active = true, extra = {}) => ({ x, y: 0, z: 5, textureArchive: archive, textureRecord: record, active, ...extra });
  const npcs = [pn(1), pn(2), pn(3, 184, 7), pn(4, 184, 7, false), pn(5, 1200, 13, true, { drawArchive: 183, drawRecord: 10 })];
  const first = planNpcBatches(npcs);
  assert.deepEqual(first.build.map((b) => [b.key, b.centers.length]), [['182_3', 2], ['184_7', 1], ['183_10', 1]], 'the inactive person out; the picture the build chose');
  assert.deepEqual([first.keep.size, first.free], [0, []]);
  const standing = new Map(first.build.map((b) => [b.sig, { name: b.key }]));
  const names = (m) => [...m.values()].map((b) => b.name);
  const same = planNpcBatches(npcs, standing);
  assert.deepEqual([names(same.keep), [...same.keep.keys()], same.build, same.free], [['182_3', '184_7', '183_10'], [...standing.keys()], [], []], 'nothing changed: nothing built, nothing freed');
  npcs[1].active = false;   // one of the 182_3 pair goes in
  npcs[3].active = true;    // the 184_7 pair is two again
  npcs[4].active = false;   // the 183_10 one gone
  const next = planNpcBatches(npcs, standing);
  assert.deepEqual([names(next.keep), next.build.map((b) => [b.key, b.centers.length]), next.free.map(([sig, b]) => [sig, b.name])], [[], [['182_3', 1], ['184_7', 2]], [...standing].map(([sig, b]) => [sig, b.name])]);
  npcs[1].active = true;    // and back: the 182_3 pair keeps its batch, the rest as they were
  const back = planNpcBatches(npcs, standing);
  assert.deepEqual([names(back.keep), back.build.map((b) => b.key), back.free.map(([, b]) => b.name)], [['182_3'], ['184_7'], ['184_7', '183_10']]);
  assert.notEqual(planNpcBatches([pn(1), pn(2)]).build[0].sig, planNpcBatches([pn(2), pn(1)]).build[0].sig, 'the centres in order are the signature');
});

/** world.js's own stand of a pixel's street people (standPixelNpcs and standPixelNpcsNow, as written), run over a host of
 *  the test's: one pixel, its pictures loading a moment late, a renderer that counts what stands. */
function worldStand({ loaded = false, ctx = null } = {}) {
  const w = read('src/scenes/world.js');
  const from = w.indexOf('  async function standPixelNpcs(entry) {'), to = w.indexOf('\n  // EV4: a built pixel crosses');
  assert.ok(from > 0 && to > from, 'the stand moved');
  const live = new Set();
  const host = {
    npcStandTurn, planNpcBatches, setupExteriorQuestStaticNpcs: () => true, betonyAwareHost: null, questBridge: null,
    betonyLoaded: () => loaded, betonyUpdateExteriorNpcs: updateExteriorNpcs, betonyContext: () => ctx,
    getTexture: (archive) => host.texture(archive),
    texture: async () => { await new Promise((r) => setTimeout(r, 2)); return { recordCount: 99 }; },
    pipeline: { uploadRecord() {}, uploadRecordFrame() {} }, billboardSize: () => ({ w: 1, h: 2 }), flatBatchAabb: () => null, armFlatAnim: () => {},
    renderer: {
      createBillboardBatch: (archive, record, size, centers) => { const b = { archive, record, centers: centers.map((c) => c.join(',')).join(' ') }; live.add(b); return b; },
      destroyBatch: (b) => { live.delete(b); },
    },
    built: new Map(),
  };
  host.renderer.destroyed = 0;
  const destroy = host.renderer.destroyBatch;
  host.renderer.destroyBatch = (b) => { host.renderer.destroyed++; destroy(b); };
  const names = Object.keys(host).filter((k) => k !== 'texture');
  const stand = new Function(...names, `${w.slice(from, to)}\nreturn standPixelNpcs;`)(...names.map((k) => host[k]));
  const pixel = (npcs) => {
    const entry = { px: 0, py: 0, npcs, batches: [], flatAnims: { remove() {} }, npcBatches: new Map(), npcStand: null, npcQuestPass: false };
    host.built.set('0,0', entry);
    return entry;
  };
  return { stand, pixel, live, host, drawn: (entry) => entry.batches.map((b) => b.centers) };
}
const streetPerson = (x, flags = 0) => ({ x, y: 0, z: 0, textureArchive: 182, textureRecord: 3, factionID: 584, flags, active: true });
/** A stand that never ends is a pin that never answers: each is given a second. */
const within = (p, what) => Promise.race([p, new Promise((_, no) => { setTimeout(() => no(new Error(what)), 1000).unref?.(); })]);

test('BET1 AUDIT B7: ONE STAND AT A TIME over a pixel\'s batches - a re-stand asked for while the pixel\'s own stand awaits its picture waits for it, and draws only the people of its own plan (the shipped stand drew both plans\' - the trader dusk took down stood on until the next edge); a stand that fails gives its turn back; one whose turn comes after its pixel\'s teardown touches nothing', async () => {
  const { stand, pixel, live, host, drawn } = worldStand();
  const entry = pixel([streetPerson(1), streetPerson(2)]);
  const own = stand(entry);
  await new Promise((r) => setTimeout(r, 0));   // the pixel's own stand has planned, and awaits its picture
  entry.npcs[1].active = false;                 // dusk takes a trader down...
  const again = stand(entry);                   // ...and the host stands the pixel again
  await within(Promise.all([own, again]), 'the two stands never finished');
  assert.deepEqual(drawn(entry), ['1,0,0'], 'the later stand\'s people alone');
  assert.deepEqual([live.size, entry.npcBatches.size], [1, 1], 'nothing standing that nothing holds');
  // the turn: two asked at once run one after the other
  const turnA = npcStandTurn(entry), turnB = npcStandTurn(entry);
  let bHas = false;
  turnB.then(() => { bHas = true; });
  const doneA = await turnA;
  await new Promise((r) => setTimeout(r, 1));
  assert.equal(bHas, false, 'the second waits for the first');
  doneA();
  (await within(turnB, 'the second turn never came'))();
  assert.equal(bHas, true);
  // a stand that fails still gives its turn back, and leaves nothing standing that the next cannot see
  host.texture = async () => { throw new Error('the picture would not load'); };
  entry.npcs[1].active = true;
  await assert.rejects(within(stand(entry), 'the failing stand never ended'), /would not load/);
  assert.deepEqual([drawn(entry), entry.npcBatches.size], [['1,0,0'], 1], 'the old batch still held');
  host.texture = async () => ({ recordCount: 99 });
  await within(stand(entry), 'the failed stand never gave its turn back');
  assert.deepEqual(drawn(entry), ['1,0,0 2,0,0'], 'the next stand ran, and freed what the failed one meant to');
  assert.deepEqual([live.size, entry.npcBatches.size], [1, 1]);
  // a stand whose turn comes after the pixel's teardown touches nothing (destroyPixel freed the pixel's batches)
  const first = stand(entry), second = stand(entry);   // two asked for at once
  for (const pn of entry.npcs) pn.active = false;      // everyone gone in: each would free the batch...
  host.built.delete('0,0');                            // ...but the pixel is torn down before either's turn
  const before = host.renderer.destroyed;
  await within(Promise.all([first, second]), 'the stands never finished');
  assert.equal(host.renderer.destroyed, before, 'nothing freed twice on a pixel already gone');
});

test('BET1 AUDIT B2: a pixel\'s people take the mod\'s hours and rain AS THEY STAND (Port-Ledger A, BET-FIX 2) - a market stood at night draws no one who hides by night, whatever the last edge left; the quest\'s word kept; nothing while the mod is not loaded', async () => {
  const night = { locationType: LOCATION_TYPES.TownCity, inside: false, isDay: false, isRaining: false };
  const market = () => [streetPerson(1, 1), streetPerson(2, 2), streetPerson(3, 2), { ...streetPerson(4, 1), questAway: true, active: false }];
  let w = worldStand({ loaded: true, ctx: night });
  let entry = w.pixel(market());
  await w.stand(entry);
  assert.deepEqual(w.drawn(entry), ['1,0,0'], 'the day trader alone - the night\'s two down, the quest\'s away person kept down');
  w = worldStand({ loaded: true, ctx: { ...night, isDay: true } });
  entry = w.pixel(market());
  await w.stand(entry);
  assert.deepEqual(w.drawn(entry), ['2,0,0 3,0,0'], 'by day the other two');
  w = worldStand({ loaded: false, ctx: night });
  entry = w.pixel(market());
  await w.stand(entry);
  assert.deepEqual(w.drawn(entry), ['1,0,0 2,0,0 3,0,0'], 'the mod not loaded: everyone as the layout left them');
});

test('BET1 AUDIT C1, C2: a pack of new places is no TOWN pack - online its missing pack refuses no home, hall or yard in any town (worldDataPacksMissing names the layout packs alone), its presence switches on none of the town mods\' stand-ins, and it quiets no location\'s line', () => {
  assert.deepEqual(['beautiful-villages', 'beautiful-cities', BETONY_VENDOR, 'roleplay-realism'].map(isLayoutPack), [true, true, false, false]);
  assert.deepEqual(worldDataPacksMissing(), [], 'none missing before any load');
  const M = read('src/scenes/modWorldData.js');
  assert.ok(M.includes('export const worldDataPacksMissing = () => [..._missing].filter(isLayoutPack);'));
  assert.ok(M.includes('const townPacksLive = () => { const pinned = vendorsPinnedIn(); return [..._packs.keys()].filter(isLayoutPack).some((v) => modLatchedOn(v) === true || pinned.has(v)); };'));
  assert.ok(M.includes('    if (isLayoutPack(vendor)) quietLocationOverrides(true);'));
});

test('BET1 AUDIT C3: under a case-blind key a loose file replaces one of its own spelling only, and FindAssets takes the first LIVE entry whose own spelling ends so - a higher-priority mod\'s `.JSON` hides no lower mod\'s `.json` new place', (t) => {
  quiet(t);
  door();
  const blockA = blockToDfuJson(tinyRmb(7, 'FOOAA00.RMB')), blockB = blockToDfuJson(tinyRmb(7, 'FOOAA00.RMB'));
  blockA.RmbBlock.SubRecords[0].Exterior.Block3dObjectRecords[0].XPos = 111; blockB.RmbBlock.SubRecords[0].Exterior.Block3dObjectRecords[0].XPos = 222;
  registerWorldDataAsset('FOOAA00.RMB.json', blockA);
  registerWorldDataAsset('fooaa00.rmb.json', blockB);
  const xOf = (b) => b?.rmbBlock?.subRecords?.[0]?.exterior?.block3dObjectRecords?.[0]?.xPos;
  assert.equal(xOf(getDFBlockReplacementData(7, 'FOOAA00.RMB')), 222, 'the later spelling answers the case-blind ask');
  _resetWorldDataReplacement(); door();
  registerWorldDataAsset('FOOAA00.RMB.json', blockA);
  registerWorldDataAsset('FOOAA00.RMB.json', blockB);
  assert.equal(xOf(getDFBlockReplacementData(7, 'FOOAA00.RMB')), 222, 'its own spelling again: replaced');
  // two loose files, one key: the `.JSON` beside it leaves the `.json` new place standing (it replaced it before)
  _resetWorldDataReplacement(); door(); quietLocationOverrides(true);
  const cabin = openWorldDataPack(packJson(), { blocks: fakeBlocks() }).rebuild('locationnew-TheYeomfordCabin-19.json', null);
  const region1 = () => ({ name: 'Betony', locationCount: 1, mapNames: ['Classic'], mapTable: [{ mapId: 1, locationId: 0 }], mapNameLookup: new Map([['Classic', 0]]), mapIdLookup: new Map([[1, 0]]) });
  registerWorldDataAsset('locationnew-Loose-19.json', { ...cabin, Name: 'Loose' });
  registerWorldDataAsset('locationnew-loose-19.JSON', { ...cabin, Name: 'Shout' });
  const loose = region1();
  assert.equal(getDFRegionAdditionalLocationData(19, loose), true);
  assert.deepEqual(loose.mapNames, ['Classic', 'Loose']);
  // the new places: two mods, one key, two spellings
  _resetWorldDataReplacement(); door(); quietLocationOverrides(true);
  registerWorldDataAsset('locationnew-Lo-19.JSON', { ...cabin, Name: 'Hi' }, () => true, { priority: 20, vendor: 'loud' });
  registerWorldDataAsset('locationnew-lo-19.json', { ...cabin, Name: 'Lo' }, () => true, { priority: 10, vendor: 'quiet' });
  const region = { name: 'Betony', locationCount: 1, mapNames: ['Classic'], mapTable: [{ mapId: 1, locationId: 0 }], mapNameLookup: new Map([['Classic', 0]]), mapIdLookup: new Map([[1, 0]]) };
  assert.equal(getDFRegionAdditionalLocationData(19, region), true);
  assert.deepEqual(region.mapNames, ['Classic', 'Lo']);
  _resetWorldDataReplacement(); resetToDefaults();
});

test('BET1 AUDIT C4: a vendor record\'s frames are the frames ANY tier answers - an attached mod\'s animation over a stand-in\'s still picture animates, as DFU imports frames until one is missing', () => {
  resetAll();
  setValue('Enhancements', 'AssetInjection', 'True');
  addVendorTextures([{ archive: 9002, record: 3, standIn: true, yields: true, build: async () => synthetic(2, 2) }]);
  assert.equal(vendorFrameCount(9002, 3), 1);
  setBundleTextures([1, 2, 3].map((frame) => ({ archive: 9002, record: 3, frame, fileName: `det.dfmod:9002_3-${frame}`, image: async () => synthetic(2, 2) })));
  assert.equal(vendorFrameCount(9002, 3), 4, 'the attached mod\'s frames 1-3 after the stand-in\'s 0');
  assert.equal(vendorTextureStandIn(9002).getFrameCount(3), 4);
  setValue('Enhancements', 'AssetInjection', 'False');
  assert.equal(vendorFrameCount(9002, 3), 1, 'Replace Game Artwork off: the stand-in\'s alone');
  setBundleTextures([]); resetToDefaults();
  resetAll();
});

test('BET1 AUDIT D7, D9: the portrait file is the talk window\'s CommonFaces; the street update over the records the producer mints (exteriorNpcRecord, as world.js stands them) - the gender repair\'s bit leaves the mod\'s three alone', () => {
  assert.equal(BETONY_PORTRAIT_FILE, PORTRAIT_ARCHIVE.CommonFaces);
  assert.deepEqual([...BETONY_ARCHIVES], [540, 1200, 1210, 1230]);
  const flats = [
    { x: 1, y: 0, z: 2, archive: 182, record: 3, factionID: 584, flags: 1, recordPosition: 7 },   // a trader who hides by day
    { x: 3, y: 0, z: 2, archive: 184, record: 7, factionID: 584, flags: 6, recordPosition: 8 },   // a ware: by night, in the rain
    { x: 5, y: 0, z: 2, archive: 205, record: 1, factionID: 0, flags: 1, recordPosition: 9 },     // no faction: no StaticNPC
  ];
  const people = collectExteriorNpcs(flats).map((f) => ({ ...exteriorNpcRecord(f, { gender: '2' }), active: true, questBehaviour: null, host: null }));
  assert.deepEqual(people.map((p) => p.flags), [33, 38], 'the repair\'s bit 32 on both, the mod\'s bits untouched');
  assert.equal(updateExteriorNpcs(people, { locationType: LOCATION_TYPES.TownCity, inside: false, isDay: true, isRaining: true }), 2);
  assert.deepEqual(people.map((p) => p.active), [false, false], 'by day the trader is down, and in the rain the ware');
});

// ---- with the player's data ---------------------------------------------------------------------------------------------------
function loadArena2() {
  const blocks = new BlocksFile(); assert.ok(blocks.load(new Uint8Array(readFileSync(join(ARENA2, 'BLOCKS.BSA')))));
  const maps = new MapsFile(); assert.ok(maps.load(new Uint8Array(readFileSync(join(ARENA2, 'MAPS.BSA'))), new Uint8Array(readFileSync(join(ARENA2, 'CLIMATE.PAK'))), new Uint8Array(readFileSync(join(ARENA2, 'POLITIC.PAK')))));
  const arch = new Arch3dFile(); assert.ok(arch.load(new Uint8Array(readFileSync(join(ARENA2, 'ARCH3D.BSA')))));
  const palette = new DFPalette(); palette.load(new Uint8Array(readFileSync(join(ARENA2, 'ART_PAL.COL'))));
  const files = new Map();
  const texture = (archive) => {
    if (!files.has(archive)) {
      const name = `TEXTURE.${String(archive).padStart(3, '0')}`;
      const t = new TextureFile();
      files.set(archive, existsSync(join(ARENA2, name)) && t.load(new Uint8Array(readFileSync(join(ARENA2, name))), name, palette) ? t : null);
    }
    return files.get(archive);
  };
  return { blocks, maps, arch, palette, texture };
}
/** What neither the port nor Daggerfall stands, and why (bible/03-World/Betony-Restored.md, "Not stood in"). */
const NOT_STOOD_IN = Object.freeze({ models: [45187, 52991], flats: [] });

test('BET1 with ARENA2: every one of the 39 files rebuilds the author\'s, sha256 for sha256, from the player\'s own BLOCKS.BSA; the region\'s new places 25-49 off the player\'s own MAPS.BSA, Betony City 34', { skip: HAVE_ARENA2 ? false : 'ARENA2_PATH not set' }, async (t) => {
  quiet(t);
  const { blocks, maps } = loadArena2();
  const p = openWorldDataPack(packJson(), { blocks });
  for (const name of p.names()) assert.equal(await packFileSha256(p.rebuild(name, maps)), p.sha256Of(name), name);
  resetToDefaults(); setValue('Enhancements', 'AssetInjection', 'True');
  _resetWorldDataReplacement(); clearWorldDataVariants(); installWorldDataReplacement(); bindWorldDataBlocks(blocks); quietLocationOverrides(true);
  registerWorldDataPack(p, () => true);
  const fresh = new MapsFile(); fresh.load(new Uint8Array(readFileSync(join(ARENA2, 'MAPS.BSA'))), new Uint8Array(readFileSync(join(ARENA2, 'CLIMATE.PAK'))), new Uint8Array(readFileSync(join(ARENA2, 'POLITIC.PAK'))));
  const region = fresh.getRegion(19);
  assert.equal(region.locationCount, 50);
  assert.deepEqual([region.mapNames[25], region.mapNames[34], region.mapNames[49]], ['The Yeomford Cabin', 'Betony', 'Chestercester']);
  assert.equal(region.mapTable[34].mapId, 259119);
  _resetWorldDataReplacement(); resetToDefaults();
});

test('BET1 with ARENA2: the thirteen rebuilt pictures are the AUTHOR\'S, pixel for pixel, out of the player\'s own TEXTURE files', { skip: HAVE_ARENA2 ? false : 'ARENA2_PATH not set' }, async () => {
  const { palette, texture } = loadArena2();
  const classicRgba = async (a, r, f = 0) => { const t = texture(a); const bm = t?.getDFBitmap(r, f); return bm?.width ? classicRecordRgba(bm, palette) : null; };
  for (const [name, spec] of Object.entries(BETONY_DERIVED)) {
    const pic = await buildDerivedPicture(spec, classicRgba);
    assert.deepEqual([`${pic.width}x${pic.height}`, pictureHash(pic)], AUTHOR_DERIVED[name], name);
  }
  for (const [name, from] of Object.entries(BETONY_RESHADED)) assert.ok(await classicRgba(from[0], from[1], from[2] ?? 0), `${name}'s classic stand-in ${from.join('_')} is the player's`);
  for (const from of Object.values(BETONY_NPC_STAND_INS)) assert.ok(await classicRgba(from[0], from[1]), `${from.join('_')} is the player's`);
});

test('BET1 with ARENA2: every model and flat the fourteen blocks place is Daggerfall\'s own, the mod\'s, stood in by the port, or one of the two named that nothing stands (as DFU without DET)', { skip: HAVE_ARENA2 ? false : 'ARENA2_PATH not set' }, (t) => {
  quiet(t);
  resetAll();
  latchModLoaded(BETONY_VENDOR, true);
  setModSetting(DETAILED_SHIPS_VENDOR, 'Enabled', false);
  installDetailedShipsArt({ fetchBytes: async () => new Uint8Array(0) });   // as every host's boot (scenes/shared.js): Detailed Ships' pictures on the door, behind their own gate
  installBetonyArt({ fetchBytes: async () => new Uint8Array(0) });
  installDetStandIns(betonyLoaded);
  const { blocks, maps, arch, texture } = loadArena2();
  const p = openWorldDataPack(packJson(), { blocks });
  const models = new Map(), flats = new Map();
  for (const name of p.names().filter((n) => n.endsWith('.RMB.json'))) {
    const rmb = p.rebuild(name, maps).RmbBlock;
    const add = (m, k) => m.set(k, (m.get(k) ?? 0) + 1);
    for (const s of rmb.SubRecords) for (const side of ['Exterior', 'Interior']) {
      for (const m of s[side].Block3dObjectRecords) add(models, m.ModelIdNum);
      for (const f of [...s[side].BlockFlatObjectRecords, ...s[side].BlockPeopleRecords]) add(flats, `${f.TextureArchive}_${f.TextureRecord}`);
    }
    for (const m of rmb.Misc3dObjectRecords) add(models, m.ModelIdNum);
    for (const f of rmb.MiscFlatObjectRecords) add(flats, `${f.TextureArchive}_${f.TextureRecord}`);
  }
  const missing = [], fmissing = [];
  let standIn = 0, fStandIn = 0;
  for (const id of models.keys()) { if (hasCustomModel(id)) standIn++; else if (arch.getRecordIndex(id) < 0) missing.push(id); }
  for (const k of flats.keys()) {
    const [a, r] = k.split('_').map(Number);
    if (hasTextureReplacement(a, r)) fStandIn++;
    else if (!(a <= 511 && texture(a) && r < texture(a).recordCount)) fmissing.push(k);
  }
  assert.deepEqual(missing.sort((a, b) => a - b), NOT_STOOD_IN.models);
  assert.deepEqual(fmissing.sort(), NOT_STOOD_IN.flats);
  assert.deepEqual([models.get(45187), models.get(52991)], [9, 23]);
  assert.deepEqual([models.size, standIn, flats.size, fStandIn], [437, 24, 343, 71], 'the models and the flats placed, and those stood in (DET\'s 24 models; the mod\'s, Detailed Ships\' and DET\'s 71 flats)');
  resetAll();
});

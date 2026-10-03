// WD3 (2026-10-01, Mac: "These are the next mods I'd like to implement (We have permission) and ensure this doesn't
// conflict or regress anything (For example housing customization)") - THE WORLD-DATA DOOR WITH TWO TOWN MODS ON IT
// (src/formats/worldDataReplacement.js, scenes/modWorldData.js), and the laws of Daggerfall's the two mods meet.
//
// Held here: a name two mods carry answers from the later-loaded mod (ModManager.TryGetAsset's reverse load order -
// Beautiful Cities' FIGHBM00 over Villages'), a switched-off mod never hiding the one under it and arrival order no
// part of it; a pack on the door (every name registered, each rebuilt only when asked, the asking reader handed to it,
// a file that will not rebuild said once and the classic standing); the door open online whatever Replace Game Artwork
// says; a pinned town served its layout (its location and the blocks its grid names, without a mod pinned out, with
// one pinned in, the cache passed only where the pin turns a carrier away); the town whose blocks are being read
// (MapsFile.getRmbBlockName notes it, a location read takes the note back); FldHeader.OtherNames kept (the Order of the
// Raven); the windmills (a served block's own 41600 is the mill, Kamer's placements stand only on Daggerfall's farm);
// Roleplay & Realism's Master Armorer keyed off the town's grid; the decor catalogue read past the door; the loader.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  registerWorldDataAsset, registerWorldDataPack, installWorldDataReplacement, bindWorldDataBlocks, _resetWorldDataReplacement,
  getDFBlockReplacementData, getDFLocationReplacementData, getDFRegionAdditionalLocationData, worldDataVendorCarries,
  quietLocationOverrides, blockFromJson, locationFromJson, latchWorldDataDoor,
} from '../src/formats/worldDataReplacement.js';
import { setLayoutPins, _resetLayoutPins } from '../src/systems/layoutPins.js';
import { makeLocationKey, readingLocationKeyOf, setLastLocationKeyTo, getLocationVariant, clearWorldDataVariants } from '../src/systems/worldDataVariants.js';
import { MapsFile } from '../src/formats/mapsFile.js';
import { blockToDfuJson, locationToDfuJson } from '../src/formats/worldDataJson.js';
import { setValue, resetToDefaults } from '../src/systems/settings.js';
import { WORLD_DATA_PRIORITY } from '../src/scenes/modWorldData.js';
import { layoutRmbBlock, WINDMILL_MODEL_ID } from '../src/world/rmbLayout.js';
import { rrMasterArmBuildingKey, rrMasterArmBuildingKeyIn, RR_ARMORER_BLOCK, RR_ARMORER_RECORD } from '../src/systems/rrQuestLine.js';
import { tinyRmb, fakeBlocks } from './wd3Fakes.mjs';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const BV = 'beautiful-villages', BC = 'beautiful-cities';
const LOC = JSON.parse(src('vendor/roleplay-realism/WorldData/locationnew-RRfort01-16.json'));
/** A location file: the fort's, renamed and laid out on `blockNames`. */
const locJson = (name, blockNames = ['FIGHBM00.RMB']) => {
  const j = structuredClone(LOC);
  j.Name = name; j.Exterior.ExteriorData.AnotherName = name; j.Exterior.ExteriorData.BlockNames = blockNames;
  j.Exterior.ExteriorData.Width = blockNames.length; j.Exterior.ExteriorData.Height = 1;
  return j;
};
/** A block file whose first model stands at `mark` - whose it is, read back off the block served. */
const blockJson = (name, mark) => { const j = blockToDfuJson(tinyRmb(7, name)); j.RmbBlock.SubRecords[0].Exterior.Block3dObjectRecords[0].XPos = mark; return j; };
const markOf = (b) => b?.rmbBlock?.subRecords?.[0]?.exterior?.block3dObjectRecords?.[0]?.xPos ?? null;
const CITY = makeLocationKey(17, 4), VILLAGE = makeLocationKey(17, 5);
const pin = (out = [], inn = []) => ({ out: new Set(out), in: new Set(inn), stamp: 'classic', why: 'house' });

function door() {
  _resetWorldDataReplacement(); clearWorldDataVariants(); resetToDefaults(); _resetLayoutPins();
  setValue('Enhancements', 'AssetInjection', 'True');
  installWorldDataReplacement();
  bindWorldDataBlocks(fakeBlocks(tinyRmb(7, 'FIGHBM00.RMB')));
}
const again = () => { _resetWorldDataReplacement({ assets: false }); clearWorldDataVariants(); bindWorldDataBlocks(fakeBlocks(tinyRmb(7, 'FIGHBM00.RMB'))); installWorldDataReplacement(); };
const quiet = (t) => t.mock.method(console, 'log', () => {});

test('WD3 the door: a name two mods carry answers from the mod loaded LATER - Beautiful Cities\' FIGHBM00 over Villages\', as ModManager.TryGetAsset walks the load order backwards; a mod switched off never hides the one under it, the order the files arrived in is no part of it, a mod\'s file registered again replaces its own, and WD1\'s files stand under both', (t) => {
  quiet(t);
  assert.deepEqual(WORLD_DATA_PRIORITY, { [BV]: 10, [BC]: 20 }, 'Beautiful Cities (DFU 1.1.1) loads after Beautiful Villages (DFU 1.0.0)');
  const on = { [BV]: true, [BC]: true };
  for (const order of [[BV, BC], [BC, BV]]) {
    door();
    for (const v of order) registerWorldDataAsset('FIGHBM00.RMB.json', blockJson('FIGHBM00.RMB', v === BV ? 111 : 222), () => on[v], { priority: WORLD_DATA_PRIORITY[v], vendor: v });
    on[BV] = on[BC] = true;
    assert.equal(markOf(getDFBlockReplacementData(7, 'FIGHBM00.RMB')), 222, `registered ${order.join(' then ')}: Cities answers`);
    on[BC] = false; again();
    assert.equal(markOf(getDFBlockReplacementData(7, 'FIGHBM00.RMB')), 111, 'Cities switched off: Villages\' file, not none');
    on[BV] = false; again();
    assert.equal(getDFBlockReplacementData(7, 'FIGHBM00.RMB'), null, 'both off: Daggerfall\'s own block');
  }
  on[BV] = on[BC] = true; again();
  registerWorldDataAsset('FIGHBM00.RMB.json', blockJson('FIGHBM00.RMB', 333), () => on[BC], { priority: WORLD_DATA_PRIORITY[BC], vendor: BC });
  assert.equal(markOf(getDFBlockReplacementData(7, 'FIGHBM00.RMB')), 333, 'a mod registering its file again replaces its own entry');
  on[BC] = false; again();
  assert.equal(markOf(getDFBlockReplacementData(7, 'FIGHBM00.RMB')), 111, '...and only its own');
  registerWorldDataAsset('FIGHBM00.RMB.json', blockJson('FIGHBM00.RMB', 444));
  again();
  assert.equal(markOf(getDFBlockReplacementData(7, 'FIGHBM00.RMB')), 111, 'a WD1 file (no mod named, priority 0) stands under both');
  on[BV] = false; again();
  assert.equal(markOf(getDFBlockReplacementData(7, 'FIGHBM00.RMB')), 444);
  assert.equal(worldDataVendorCarries(BC, 'FIGHBM00.RMB.json'), true);
  assert.equal(worldDataVendorCarries(BC, 'location-17-4.json'), false);
  assert.equal(worldDataVendorCarries('detailed-ships', 'FIGHBM00.RMB.json'), false);
});

/** A pack as formats/worldDataPack.js opens one, counting its rebuilds; `location-17-6.json` will not rebuild. */
function fakePack(vendor = BV) {
  const calls = [];
  return {
    calls, vendor, mod: { title: 'T', version: '1.4.2' },
    names: () => ['location-17-4.json', 'location-17-5.json', 'location-17-6.json', 'FIGHBM00.RMB.json'],
    rebuild(name, maps) {
      calls.push([name, maps]);
      if (name === 'location-17-6.json') throw new Error('world-data pack: beautiful-villages: location-17-6.json wants Aldleigh at 17/6, MAPS.BSA has Sentinel');
      return name.startsWith('location-') ? locJson(`Town ${name}`) : blockJson('FIGHBM00.RMB', 555);
    },
  };
}

test('WD3 a pack on the door: every name registered under its mod, each file rebuilt only when it is asked for - a region\'s scan for new locations passes a pack\'s seven thousand location files over unread; the reader that asks is handed to the pack; a file that will not rebuild on this player\'s data is said once and not served, and the classic location stands', (t) => {
  quiet(t);
  door();
  const said = [];
  t.mock.method(console, 'error', (m) => said.push(String(m)));
  const pack = fakePack();
  assert.equal(registerWorldDataPack(pack, () => true, { priority: 10 }), 4);
  assert.equal(registerWorldDataPack(null), 0);
  assert.equal(worldDataVendorCarries(BV, 'location-17-4.json'), true);
  assert.equal(worldDataVendorCarries(BV, 'location-17-9.json'), false);
  const region = { name: 'Daggerfall', locationCount: 1, mapNames: ['Daggerfall'], mapTable: [{ mapId: 1, locationId: 0 }], mapNameLookup: new Map([['Daggerfall', 0]]), mapIdLookup: new Map([[1, 0]]) };
  assert.equal(getDFRegionAdditionalLocationData(17, region), false);
  assert.deepEqual(pack.calls, [], 'no location file rebuilt to be passed over by the `locationnew-` filter');
  const maps = { readClassicLocation: () => null, marker: 'the asking reader' };
  const loc = getDFLocationReplacementData(17, 4, maps);
  assert.equal(loc.name, 'Town location-17-4.json');
  assert.deepEqual(pack.calls, [['location-17-4.json', maps]], 'rebuilt over the location as the asking reader holds it');
  assert.equal(getDFLocationReplacementData(17, 4, maps), loc, 'and kept');
  assert.equal(pack.calls.length, 1);
  assert.equal(getDFLocationReplacementData(17, 6, maps), null, 'a file that will not rebuild: Daggerfall\'s own location');
  assert.equal(said.length, 1);
  assert.match(said[0], /^\[worlddata\] location-17-6\.json \(beautiful-villages\): world-data pack: .*MAPS\.BSA has Sentinel - not served$/);
  // the same town pinned (asked fresh every time): still said once
  setLayoutPins(new Map([[makeLocationKey(17, 6), pin([], [BV])]]));
  assert.equal(getDFLocationReplacementData(17, 6, maps), null);
  assert.equal(getDFLocationReplacementData(17, 6, maps), null);
  assert.equal(said.length, 1, 'said once for the game, however often it is asked');
});

test('WD3 a pack\'s towns are counted once by the loader, not logged one by one - quietLocationOverrides hushes the override and new-block lines it would say seven thousand times', (t) => {
  door();
  const logged = [];
  t.mock.method(console, 'log', (m) => logged.push(String(m)));
  registerWorldDataPack(fakePack(), () => true, { priority: 10 });
  quietLocationOverrides(true);
  getDFLocationReplacementData(17, 4, null);
  assert.deepEqual(logged.filter((l) => /Found DFLocation override|Found a new DFBlock/.test(l)), []);
  quietLocationOverrides(false);
  getDFLocationReplacementData(17, 5, null);
  assert.equal(logged.filter((l) => /Found DFLocation override, region:17, index:5/.test(l)).length, 1, 'a WD1 file is still said, as DFU says it');
  _resetWorldDataReplacement();
});

test('WD3 the door is open ONLINE whatever Replace Game Artwork says - the ground is the room\'s; offline it is DFU\'s AssetInjection alone', (t) => {
  quiet(t);
  door();
  registerWorldDataAsset('FIGHBM00.RMB.json', blockJson('FIGHBM00.RMB', 222), () => true, { priority: 20, vendor: BC });
  setValue('Enhancements', 'AssetInjection', 'False');
  again();
  assert.equal(getDFBlockReplacementData(7, 'FIGHBM00.RMB'), null, 'offline, the switch off: DFU serves nothing');
  const had = Object.getOwnPropertyDescriptor(globalThis, 'location');
  globalThis.location = { search: '?online=1' };
  try {
    again();
    assert.equal(markOf(getDFBlockReplacementData(7, 'FIGHBM00.RMB')), 222, 'online: the room\'s town');
  } finally {
    if (had) Object.defineProperty(globalThis, 'location', had); else delete globalThis.location;
  }
  assert.match(src('src/formats/worldDataReplacement.js'), /export const worldDataDoorOpen = \(\) => _doorLatched \?\? \(assetInjectionOn\(\) \|\| isOnlinePage\(\)\);\nconst worldDataOn = worldDataDoorOpen;/);
  // AUDIT WD3 P3: latched for the game, as DFU reads AssetInjection at startup - a switch turned mid-game moves nothing
  again();
  assert.equal(latchWorldDataDoor(), false);
  setValue('Enhancements', 'AssetInjection', 'True');
  assert.equal(getDFBlockReplacementData(7, 'FIGHBM00.RMB'), null, 'shut for the game it was read shut in');
  again();
  assert.equal(latchWorldDataDoor(), true);
  setValue('Enhancements', 'AssetInjection', 'False');
  assert.equal(markOf(getDFBlockReplacementData(7, 'FIGHBM00.RMB')), 222, 'open for the game it was read open in - no holes punched in its towns');
  again();
  for (const fn of ['getDFRegionAdditionalLocationData', 'getDFLocationReplacementData', 'getDFBlockReplacementData', 'getBuildingReplacementData']) {
    const at = src('src/formats/worldDataReplacement.js').indexOf(`export function ${fn}(`);
    assert.match(src('src/formats/worldDataReplacement.js').slice(at, at + 400), /if \(!worldDataOn\(\)/, `${fn} asks the one gate`);
  }
  setValue('Enhancements', 'AssetInjection', 'True');
});

test('WD3 a pinned town is served its layout: its location without a mod pinned out (Daggerfall\'s own), with one pinned in though it is switched off - asked fresh each time; a pin that turns away no carrier of the file leaves the cache alone; the town next door is served as the switches stand', (t) => {
  quiet(t);
  door();
  let bvOn = true;
  const pack = fakePack();
  registerWorldDataPack(pack, () => bvOn, { priority: 10 });
  const rebuilds = (name) => pack.calls.filter(([n]) => n === name).length;
  assert.equal(getDFLocationReplacementData(17, 4, null).name, 'Town location-17-4.json');
  setLayoutPins(new Map([[CITY, pin([BC])]]));
  getDFLocationReplacementData(17, 4, null);
  assert.equal(rebuilds('location-17-4.json'), 1, 'a pin out of Cities, which carries no file of this town: the cached answer stands');
  setLayoutPins(new Map([[CITY, pin([BV])]]));
  assert.equal(getDFLocationReplacementData(17, 4, null), null, 'pinned out: the classic town, the cache passed');
  assert.equal(getDFLocationReplacementData(17, 5, null).name, 'Town location-17-5.json', 'the town next door: as the switches stand');
  bvOn = false; again();
  assert.equal(getDFLocationReplacementData(17, 5, null), null, 'switched off: classic');
  setLayoutPins(new Map([[VILLAGE, pin([], [BV])]]));
  const before = rebuilds('location-17-5.json');
  assert.equal(getDFLocationReplacementData(17, 5, null).name, 'Town location-17-5.json', 'pinned in: the village a house was bought in, though the mod is off');
  assert.equal(getDFLocationReplacementData(17, 5, null).name, 'Town location-17-5.json');
  assert.equal(rebuilds('location-17-5.json'), before + 2, 'a pinned town is the save\'s answer, never the cache\'s');
  assert.equal(getDFLocationReplacementData(17, 4, null), null, 'and only that town');
});

test('WD3 the blocks are read for the TOWN WHOSE GRID NAMED THEM: MapsFile.getRmbBlockName notes the town, a block read asks that town\'s pin; a location read, or the variants\' last location set, takes the note back', (t) => {
  quiet(t);
  door();
  registerWorldDataAsset('FIGHBM00.RMB.json', blockJson('FIGHBM00.RMB', 111), () => true, { priority: 10, vendor: BV });
  registerWorldDataAsset('FIGHBM00.RMB.json', blockJson('FIGHBM00.RMB', 222), () => true, { priority: 20, vendor: BC });
  const maps = new MapsFile();
  const city = { regionIndex: 17, locationIndex: 4, exterior: { exteriorData: { width: 2, blockNames: ['TEMPAAH0.RMB', 'FIGHBM00.RMB'] } } };
  assert.equal(maps.getRmbBlockName(city, 1, 0), 'FIGHBM00.RMB');
  assert.equal(readingLocationKeyOf(), CITY, 'the town whose block names are being read');
  setLayoutPins(new Map([[CITY, pin([BC])]]));
  assert.equal(markOf(getDFBlockReplacementData(7, 'FIGHBM00.RMB')), 111, 'the city keeps the layout its records were made in: Villages\' block');
  setLayoutPins(new Map([[CITY, pin([BC, BV])]]));
  assert.equal(getDFBlockReplacementData(7, 'FIGHBM00.RMB'), null, 'neither mod: Daggerfall\'s own');
  getLocationVariant(makeLocationKey(17, 9));
  assert.equal(readingLocationKeyOf(), makeLocationKey(17, 9), 'a location just read is the town its blocks come from');
  assert.equal(markOf(getDFBlockReplacementData(7, 'FIGHBM00.RMB')), 222, 'another town: as the switches stand');
  maps.getRmbBlockName(city, 1, 0);
  setLastLocationKeyTo(17, 12);
  assert.equal(readingLocationKeyOf(), makeLocationKey(17, 12));
  maps.getRmbBlockName({ exterior: { exteriorData: { width: 1, blockNames: ['FIGHBM00.RMB'] } } }, 0, 0);
  assert.equal(readingLocationKeyOf(), makeLocationKey(17, 12), 'a location the reader cannot place notes nothing');
});

test('WD3 a block served from JSON keeps FldHeader.OtherNames - RMBLayout\'s Order of the Raven (KRAVE01.HS2) fires in Beautiful Cities\' knightly blocks as in DFU - none where the file has none; and it says it came from world data', () => {
  const j = blockToDfuJson(tinyRmb(7, 'KNIGBM01.RMB'));
  assert.equal(j.RmbBlock.FldHeader.OtherNames, null);
  j.RmbBlock.FldHeader.OtherNames = ['KRAVE01.HS2', 'KRAVE02.HS2'];
  const b = blockFromJson(j, 7);
  assert.deepEqual(b.rmbBlock.fldHeader.otherNames, ['KRAVE01.HS2', 'KRAVE02.HS2']);
  j.RmbBlock.FldHeader.OtherNames.push('X');
  assert.equal(b.rmbBlock.fldHeader.otherNames.length, 2, 'a copy');
  assert.equal(b.fromWorldData, true);
  assert.deepEqual(blockToDfuJson(b).RmbBlock.FldHeader.OtherNames, ['KRAVE01.HS2', 'KRAVE02.HS2'], 'and written back as read');
  delete j.RmbBlock.FldHeader.OtherNames;
  assert.equal(blockFromJson(j, 7).rmbBlock.fldHeader.otherNames, null, 'RRFORT01 leaves it out: none');
});

test('WD3 a town WITH A DUNGEON served from JSON keeps its dungeon\'s RecordElement (LocationDungeon.RecordElement, a field DFU keeps) - Castle Daggerfall, Sentinel and Wayrest stand in Beautiful Cities\' towns, and every dungeon reader asks its header\'s LocationId (dungeonLayout.js, dungeonContext.js, save.js)', () => {
  const j = structuredClone(LOC);
  j.HasDungeon = true;
  j.Dungeon = { RecordElement: { Header: { X: 6782976, Y: 9371649, IsExterior: 0, Unknown2: 242, LocationId: 50027, IsInterior: 1, ExteriorLocationId: 50026, LocationName: 'Daggerfall' } },
    Header: { BlockCount: 1 }, Blocks: [{ X: 0, Z: 0, IsStartingBlock: true, BlockName: 'S0000999.RDB', BlockIndex: 0, BlockNumber: 999, BlockCharacter: 0 }] };
  const loc = locationFromJson(j);
  assert.deepEqual(loc.dungeon.recordElement.header, { alwaysOne1: 1, x: 6782976, y: 9371649, isExterior: 0, unknown1: 0, unknown2: 242, alwaysOne2: 1, locationId: 50027, isInterior: 1, exteriorLocationId: 50026, locationName: 'Daggerfall' });
  assert.deepEqual(locationFromJson(locationToDfuJson(loc)).dungeon.recordElement.header, loc.dungeon.recordElement.header, 'round trip through the writer');
  assert.equal(locationFromJson(LOC).dungeon.recordElement, null, 'a town without a dungeon has none');
});

test('WD3 the windmills: Kamer\'s mill is DFU\'s replacement of model 41600 wherever it stands - a 41600 a block\'s own records place is the mill on the enhanced skin with the Windmills switch, the classic model elsewhere; a block served from world data stands no Kamer placement of its own name, Daggerfall\'s farm does', () => {
  assert.equal(WINDMILL_MODEL_ID, 41600);
  const served = blockFromJson(blockToDfuJson(tinyRmb(7, 'FARMAA01.RMB')), 7);
  const ids = (out) => out.models.map((m) => m.modelIdNum);
  let out = layoutRmbBlock(served, { enhanced: true, windmills: true });
  assert.equal(out.windmills.length, 1, 'the block\'s own mill, and not Kamer\'s two placements on FARMAA01');
  assert.ok(!ids(out).includes(41600), 'the mill stands instead of the model');
  out = layoutRmbBlock(served, { enhanced: false, windmills: true });
  assert.deepEqual(out.windmills, []); assert.ok(ids(out).includes(41600), 'classic skin: the classic model');
  out = layoutRmbBlock(served, { enhanced: true, windmills: false });
  assert.deepEqual(out.windmills, []); assert.ok(ids(out).includes(41600), 'the mills switched off: the classic model');
  const classic = tinyRmb(7, 'FARMAA01.RMB');
  classic.rmbBlock.misc3dObjectRecords = [];
  out = layoutRmbBlock(classic, { enhanced: true, windmills: true });
  assert.ok(out.windmills.length >= 1, 'Daggerfall\'s own FARMAA01: Kamer\'s placements stand');
});

test('WD3 Roleplay & Realism\'s Master Armorer: the shop\'s key read off the town\'s grid - the classic key while ARMRAM03 stands in its classic cell (or the grid holds none), the cell it stands in now where a town mod moved it (record 14)', () => {
  const keys = [52, 18, 48].map((r) => [r, rrMasterArmBuildingKey(r)]);
  for (const [r, key] of keys) {
    assert.ok(key > 0, `region ${r}`);
    const cx = (key >> 16) & 0xff, cy = (key >> 8) & 0xff, w = 5, h = 5;
    const grid = (x, y) => { const g = new Array(w * h).fill('TVRNAL01.RMB'); if (x != null) g[y * w + x] = RR_ARMORER_BLOCK; return g; };
    const loc = (blockNames) => ({ regionIndex: r, exterior: { exteriorData: { width: w, blockNames } } });
    assert.equal(rrMasterArmBuildingKeyIn(loc(grid(cx, cy))), key, 'in its classic cell');
    const nx = (cx + 2) % w, ny = (cy + 1) % h;
    assert.equal(rrMasterArmBuildingKeyIn(loc(grid(nx, ny))), (nx << 16) + (ny << 8) + RR_ARMORER_RECORD, 'moved: where it stands now');
    assert.equal(rrMasterArmBuildingKeyIn(loc(grid(null))), key, 'no ARMRAM03 in the grid: the classic key');
    assert.equal(rrMasterArmBuildingKeyIn({ regionIndex: r }), key, 'no grid to read');
  }
  assert.equal(rrMasterArmBuildingKeyIn({ regionIndex: 17, exterior: { exteriorData: { width: 1, blockNames: [RR_ARMORER_BLOCK] } } }), rrMasterArmBuildingKey(17), 'a region with no master armorer: none');
  assert.match(src('src/systems/rrQuestLine.js'), /return \{ buildingKey: rrMasterArmBuildingKeyIn\(location\), name: RR_TEXT\.dharjenCustomArmor \};/);
});

test('WD3 the decor catalogue stays what DAGGERFALL furnishes - its blocks read past the door, so 1,400 redecorated interiors never join, renumber or leave it with a switch', () => {
  assert.match(src('src/systems/decorScan.js'), /const b = blocks\.readClassicBlock \? blocks\.readClassicBlock\(next\) : blocks\.getBlock\(next\);/);
});

test('WD3 the loader: each pack a URL the build emits (never a chunk), fetched only when its mod is loaded for the game - the switch read once and latched, a town never moving under the player; a pack a save\'s pins let in loaded switched off; the stand-ins installed when a pack opens; the rebuild spot-checked in the background', () => {
  const M = src('src/scenes/modWorldData.js');
  assert.match(M, /import\.meta\.glob\('\.\.\/\.\.\/vendor\/\*\/WorldDataPack\/\*\.pack\.json\.gz', \{ eager: true, query: '\?url', import: 'default' \}\)/);
  assert.match(M, /const door = latchWorldDataDoor\(\);/);
  assert.match(M, /const got = on && door \? await loadPackFrom\(vendor, url, \(\) => true\) : 0;\n {6}latchModLoaded\(vendor, got > 0\);\n {6}if \(on && door && !got\) _missing\.add\(vendor\);/, 'a closed door loads no pack and stamps none (AUDIT WD3 P2); a pack that did not load is a mod not loaded, and said (B1)');
  assert.match(M, /const counts = await Promise\.all\(Object\.entries\(globPacks\(\)\)\.map\(/, 'the packs fetched side by side (AUDIT WD3 B4)');
  assert.match(M, /signal: AbortSignal\.timeout\(PACK_FETCH_TIMEOUT_MS\)/, 'and never held for ever');
  assert.match(M, /if \(!name\.startsWith\('location-'\) && \(blocks\+\+ % 8\) !== 0\) return;/, 'one block in eight spot-checked');
  assert.match(src('src/formats/worldDataPack.js'), /if \(typeof globalThis\.process === 'undefined' \|\| !globalThis\.process\.versions\?\.node\) throw new Error\('this browser cannot inflate the pack \(no DecompressionStream\)'\);/, 'a browser never reaches for node:zlib');
  assert.match(M, /if \(!worldDataDoorOpen\(\)\) return false;/, 'and honours no pin into one');
  assert.match(M, /configureLayoutPins\(\{ vendorOn: \(v\) => modLatchedOn\(v\) === true, vendorVersion: \(v\) => _packs\.get\(v\)\?\.mod\?\.version \?\? '' \}\);/);
  assert.match(M, /_pending\.set\(vendor, loadPackFrom\(vendor, entry\[1\], \(\) => false\)\.finally\(\(\) => _pending\.delete\(vendor\)\)\);\n {2}return \(await _pending\.get\(vendor\)\) > 0;/, 'a pinned pack answers only where a pin lets it in, fetched once however many ask');
  assert.match(M, /const n = registerWorldDataPack\(pack, isOn, \{ priority: WORLD_DATA_PRIORITY\[vendor\] \?\? 0 \}\);\n(?: {4}\/\/.*\n) {4}installTownStandIns\(townPacksLive\);/);
  assert.match(M, /const townPacksLive = \(\) => \{ const pinned = vendorsPinnedIn\(\); return \[\.\.\._packs\.keys\(\)\]\.some\(\(v\) => modLatchedOn\(v\) === true \|\| pinned\.has\(v\)\); \};/, 'the stand-ins on while a town pack serves a town (AUDIT WD3 T2)');
  assert.match(M, /if \(name\.startsWith\('location-'\) && \(locations\+\+ % 64\) !== 0\) return;/, 'every block and one location in 64');
  assert.match(M, /console\.error\(`\[worlddata\] \$\{vendor\}: the pack did not load \(\$\{e\?\.message \?\? e\}\) - its towns stand classic`\);/);
});

test('WD3 a guild hall entry naming a guild this game carries none of (AUDIT WD3 G4) - faction 1000, the Archaeologists Guild\'s, on four of Beautiful Villages\' villages - draws for no hall: each hall takes its own guild\'s entry (Tulaedax: the Fighters\' hall 41, the Mages\' 40, where DFU without that mod handed the Fighters\' hall 1000 and the Mages\' 41)', async () => {
  const { mergeNamedBuildings, UNCARRIED_GUILD_FACTIONS } = await import('../src/systems/talkTopics.js');
  const { BUILDING_TYPES } = await import('../src/world/buildingNames.js');
  assert.deepEqual([...UNCARRIED_GUILD_FACTIONS], [1000]);
  const G = BUILDING_TYPES.GuildHall;
  const entry = (factionId, nameSeed) => ({ buildingType: G, factionId, nameSeed, sector: 0, locationId: 0, quality: 10 });
  const hall = () => ({ buildingType: G, factionId: 0, nameSeed: 0, sector: 0, locationId: 0, quality: 0 });
  const block = (name) => ({ name, dfBlock: { rmbBlock: { fldHeader: { numBlockDataRecords: 1, buildingDataList: [hall()] }, subRecords: [{}] } } });
  const fighters = block('FIGHBM00.RMB'), mages = block('MAGEBA03.RMB');
  const merged = mergeNamedBuildings([entry(1000, 29280), entry(41, 2214), entry(40, 32270)], [fighters, mages]);
  assert.deepEqual([merged.get(fighters)[0].factionId, merged.get(mages)[0].factionId], [41, 40]);
});

test('WD3 a town\'s buildings wear its LOCATION\'s climate, the terrain its pixel\'s (AUDIT WD3 G5) - DaggerfallLocation\'s ClimateUse.UseLocation; one and the same for every classic town, a world-data file\'s own for the towns it names another for', () => {
  const W = src('src/scenes/world.js');
  assert.match(W, /const townClimateBase = dfLocation\?\.climate\?\.climateType \?\? climateBase;/);
  assert.equal((W.match(/remapSubMeshes\([a-zA-Z]+\.subMeshes, texRemap, townClimateArchive, pipeline\)/g) ?? []).length, 3, 'every town mesh');
  assert.match(W, /getWindmillMeshes\(townClimateBase,/);
  assert.match(W, /recordIndex: placed\.recordIndex, climateBase: townClimateBase, season: INTERIOR_SEASON,/, 'and the interiors entered from them');
  assert.doesNotMatch(W, /texRemap, climateArchive, pipeline/);
});

// IT1 (2026-10-04): IMMERSIVE TRAVEL'S FOUR GATE BLOCKS - the author's edit of WALLAA08-11 as WD1 patches
// (vendor/immersive-travel/WorldDataPatches, tools/immersiveTravelPatches.mjs), and the LAYER that lays the carriage,
// its horses and its driver onto whichever of those blocks the door serves - Beautiful Cities' gates and its
// wall-and-farm composites too (world/immersiveTravelGates.js; the owner's "Add carriages to either").
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { registerWorldDataAsset, getDFBlockReplacementData, installWorldDataReplacement, _resetWorldDataReplacement, bindWorldDataBlocks } from '../../../src/formats/worldData/worldDataReplacement.js';
import { PATCH_FORMAT, rebuildWorldDataPatch } from '../../../src/formats/worldData/worldDataPatch.js';
import { canonicalJson } from '../../../src/formats/worldData/worldDataJson.js';
import { gateAppends, layGateRecords, installImmersiveTravelGates, IT_GATE_FILE } from '../../../src/world/immersiveTravelGates.js';
import { appendedEdit, appendedPatch, IT_GATE_BLOCKS } from '../../../tools/immersiveTravelPatches.mjs';
import { sha256Canonical } from '../../../tools/worldDataPatch.mjs';
import { setValue, resetToDefaults } from '../../../src/systems/settings/settings.js';
import { BlocksFile } from '../../../src/formats/blocksFile.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const DIR = join(ROOT, 'vendor/immersive-travel/WorldDataPatches');
const patchOf = (name) => JSON.parse(readFileSync(join(DIR, `${name}.json`), 'utf8'));
const PATCHES = IT_GATE_BLOCKS.map(patchOf);
/** RR3's vendored RRFORT01 - an author's own block, the stand-in for "another mod's gate" (no game data). */
const OTHER = JSON.parse(readFileSync(join(ROOT, 'vendor/roleplay-realism/WorldData/RRFORT01.RMB.json'), 'utf8'));

test('IT1 the four patches: WD1\'s format, each its gate block by name and index, the author\'s sha256, and nothing but records inserted past the header\'s classic counts - one driver in faction 8642 each', () => {
  assert.deepEqual(readdirSync(DIR).sort(), IT_GATE_BLOCKS.map((n) => `${n}.json`));
  const index = { 'WALLAA08.RMB': 5, 'WALLAA09.RMB': 6, 'WALLAA10.RMB': 725, 'WALLAA11.RMB': 8 };
  for (const p of PATCHES) {
    const name = p.rebuilds.replace(/\.json$/, '');
    assert.equal(p.format, PATCH_FORMAT);
    assert.deepEqual(p.base, { kind: 'block', block: name, index: index[name] });
    assert.match(p.sha256, /^[0-9a-f]{64}$/);
    const a = gateAppends(p);
    assert.equal(a.MiscFlatObjectRecords.filter((f) => f.FactionID === 8642).length, 1, `${name}: one driver`);
    assert.ok(a.Misc3dObjectRecords.some((m) => m.ModelIdNum === 41214), `${name}: the carriage`);
    // each insert at the header's classic count and on (2 models, 1 flat in all four); AUDIT IT1 G1 (PIN MOVED): after
    // the editor's round trip - 28 building slots removed and the two classic models' three scales
    const at = { Misc3dObjectRecords: 2, MiscFlatObjectRecords: 1 };
    for (const [, path] of p.ops.filter(([k]) => k === 'i')) assert.equal(path[2], at[path[1]]++, `${name}: ${path.join('.')} in order, past the classic records`);
    assert.equal(p.ops.filter(([k]) => k !== 'i').length, 28 + 6, `${name}: the round trip`);
  }
  assert.deepEqual(PATCHES.map((p) => p.ops.filter(([k]) => k === 'i').length), [6, 5, 7, 10]);
});

test('IT1 the tool\'s header-count edit: records past NumMisc3dObjectRecords / NumMiscFlatObjectRecords become inserts; a file that changed its subrecords or under-runs a count is refused', () => {
  const mod = { Name: 'WALLAA08.RMB', Index: 5, RmbBlock: { FldHeader: { NumBlockDataRecords: 1, NumMisc3dObjectRecords: 1, NumMiscFlatObjectRecords: 0 }, SubRecords: [{}], Misc3dObjectRecords: [{ m: 0 }, { m: 1 }], MiscFlatObjectRecords: [{ f: 0 }] } };   // no BuildingDataList and no scales: no round trip (AUDIT IT1 G1's own pins)
  assert.deepEqual(appendedEdit(mod), [['i', ['RmbBlock', 'Misc3dObjectRecords', 1], { m: 1 }], ['i', ['RmbBlock', 'MiscFlatObjectRecords', 0], { f: 0 }]]);
  const p = appendedPatch(mod);
  assert.equal(p.sha256, sha256Canonical(mod));
  assert.deepEqual(p.base, { kind: 'block', block: 'WALLAA08.RMB', index: 5 });
  assert.throws(() => appendedEdit({ ...mod, RmbBlock: { ...mod.RmbBlock, SubRecords: [{}, {}] } }), /changes its subrecords/);
  assert.throws(() => appendedEdit({ ...mod, RmbBlock: { ...mod.RmbBlock, FldHeader: { ...mod.RmbBlock.FldHeader, NumMisc3dObjectRecords: 5 } } }), /shorter than its header count/);
  // AUDIT IT1 G2 (PIN MOVED): an op the layer does not lay is the mod's own file's, passed over - never refused
  assert.deepEqual(gateAppends({ rebuilds: 'X', ops: [['s', ['RmbBlock', 'FldHeader', 'Name'], 'x']] }), { Misc3dObjectRecords: [], MiscFlatObjectRecords: [] });
});

test('IT1 the layer: the gate\'s records appended to whatever the door serves under the gate\'s name or a composite on it - never to the mod\'s own file, never with the mod off, never to another name', () => {
  assert.equal(IT_GATE_FILE.exec('WALLAA08.RMB.json')?.[1], 'WALLAA08');
  assert.equal(IT_GATE_FILE.exec('WALLAA11.FARMBA03.RMB.json')?.[1], 'WALLAA11');
  assert.equal(IT_GATE_FILE.exec('WALLAA07.RMB.json'), null);
  assert.equal(IT_GATE_FILE.exec('WALLAA12.FARMAA00.RMB.json'), null, 'Beautiful Cities\' own corners are not gates');
  const appends = gateAppends(PATCHES[0]);
  const laid = layGateRecords(OTHER, appends);
  assert.notEqual(laid, OTHER, 'a new document');
  assert.equal(OTHER.RmbBlock.MiscFlatObjectRecords.length, 4, 'the served one untouched');
  assert.equal(laid.RmbBlock.MiscFlatObjectRecords.length, 4 + appends.MiscFlatObjectRecords.length);
  assert.deepEqual(laid.RmbBlock.MiscFlatObjectRecords.slice(4), appends.MiscFlatObjectRecords);
  assert.deepEqual(laid.RmbBlock.Misc3dObjectRecords.slice(OTHER.RmbBlock.Misc3dObjectRecords?.length ?? 0), appends.Misc3dObjectRecords);
  assert.deepEqual(laid.RmbBlock.FldHeader, OTHER.RmbBlock.FldHeader, 'the header\'s counts as the editor leaves them - DFU lays out by the arrays');

  let on = true;
  resetToDefaults(); setValue('Enhancements', 'AssetInjection', 'True');
  _resetWorldDataReplacement(); installWorldDataReplacement();
  try {
    const own = structuredClone(OTHER);
    registerWorldDataAsset('WALLAA08.RMB.json', OTHER, null, { priority: 20, vendor: 'beautiful-cities' });
    registerWorldDataAsset('WALLAA08.FARMAA00.RMB.json', OTHER, null, { priority: 20, vendor: 'beautiful-cities' });
    registerWorldDataAsset('WALLAA09.RMB.json', own, null);   // as the mod's own patch serves it
    registerWorldDataAsset('WALLAA07.RMB.json', OTHER, null, { priority: 20, vendor: 'beautiful-cities' });
    assert.equal(installImmersiveTravelGates(PATCHES, [own], () => on), true);
    const driver = (b) => b.rmbBlock.miscFlatObjectRecords.filter((f) => f.factionID === 8642);
    assert.equal(driver(getDFBlockReplacementData(5, 'WALLAA08.RMB')).length, 1, 'Beautiful Cities\' gate carries the driver');
    assert.equal(driver(getDFBlockReplacementData(1780, 'WALLAA08.FARMAA00.RMB')).length, 1, 'and its composite on it');
    assert.equal(driver(getDFBlockReplacementData(6, 'WALLAA09.RMB')).length, 0, 'the mod\'s own file is never laid twice');
    assert.equal(driver(getDFBlockReplacementData(4, 'WALLAA07.RMB')).length, 0, 'another wall is not a gate');
    _resetWorldDataReplacement({ assets: false }); installWorldDataReplacement();
    on = false;
    assert.equal(driver(getDFBlockReplacementData(5, 'WALLAA08.RMB')).length, 0, 'the mod off: the gate as served');
  } finally { _resetWorldDataReplacement(); resetToDefaults(); }
});

test('IT1 by source: the loader reads the mod\'s patches into the layer it lays - after every patch is on the door', () => {
  const src = readFileSync(join(ROOT, 'src/scenes/modWorldData.js'), 'utf8');
  assert.match(src, /const onServed = vendor === 'immersive-travel' \? \(json\) => \{ itPatches\.push\(patch\); itOwn\.push\(json\); \} : null;/);
  assert.match(src, /installImmersiveTravelGates\(itPatches, itOwn, immersiveTravelLoaded\);/);   // AUDIT IT1 G3 (PIN MOVED): the mod loaded for the game
  assert.ok(src.indexOf('installImmersiveTravelGates(itPatches') > src.indexOf('registerWorldDataPatch(patch, '));
});

// With the player's own ARENA2 (Mac's machine): each patch, laid on the classic block, IS the author's file - the
// check the tool could not make without a BLOCKS.BSA (vendor/immersive-travel/README.md). A difference means the
// editor touched classic records too: run `node tools/immersiveTravelPatches.mjs <dfmod> <arena2>` for WD1's diff.
const ARENA2 = process.env.ARENA2_PATH ?? '';
test('IT1 with ARENA2_PATH: every gate patch rebuilds the author\'s file, sha256 for sha256', { skip: !existsSync(join(ARENA2, 'BLOCKS.BSA')) && 'no ARENA2_PATH' }, () => {
  const blocks = new BlocksFile();
  assert.ok(blocks.load(new Uint8Array(readFileSync(join(ARENA2, 'BLOCKS.BSA')))));
  for (const p of PATCHES) {
    const json = rebuildWorldDataPatch(p, blocks);
    assert.equal(sha256Canonical(json), p.sha256, `${p.rebuilds}: ${canonicalJson(json).length} canonical bytes`);
  }
});

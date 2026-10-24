#!/usr/bin/env node
// IT1 (2026-10-04): IMMERSIVE TRAVEL'S FOUR GATE BLOCKS, AS WD1 PATCHES.
//
// The mod ships WALLAA08-11.RMB whole, as DFU's World Data Editor writes
// them - Daggerfall's city-gate blocks with the author's carriage, horses
// and driver in them. A whole RMB block is game data, which this
// repository never carries (Port-Doctrine), so the port keeps the EDIT and
// rebuilds the block from the player's own BLOCKS.BSA at load
// (formats/worldData/worldDataPatch.js, scenes/modWorldData.js) - WD1's law.
//
//   node tools/immersiveTravelPatches.mjs <immersivetravel.dfmod> [arena2] [out dir]
//
// TWO WAYS TO THE EDIT, and the tool says which it took:
//
//   - WITH an ARENA2 (the second argument, or ARENA2_PATH): WD1's own
//     tool (tools/worldDataPatch.mjs makePatch) diffs each file against
//     the classic block and refuses a patch that does not rebuild the
//     author's file sha256 for sha256. That is the patch to ship.
//   - WITHOUT one (this repository's containers carry no ARENA2): the edit
//     read off the file alone. The editor appends what the author placed
//     and leaves the header's counts as the classic block had them
//     (NumMisc3dObjectRecords 2, NumMiscFlatObjectRecords 1 in all four -
//     World-Data-Patches.md: "Record counts in the headers are not kept in
//     step with the arrays"), so the records past those counts are the
//     author's: the carriage, its horses, the driver. The patch inserts
//     them at those indices. AUDIT IT1 G1: and the two round-trip changes
//     the editor makes to EVERY block it writes, which the file shows on
//     its own - BuildingDataList written at NumBlockDataRecords where the
//     classic block reads 32 slots (formats/blocksFile.js; Warm Ashes'
//     patches, diffed against a real BSA, remove the same 30 and 29), and a
//     scale of 1 on each model where the classic record has none
//     (formats/worldData/worldDataJson.js modelJson). Any other round-trip change to
//     the classic records (an automap byte, a rotation written as its
//     equivalent) it can only find against the classic block - so the
//     loader's sha256 check, and test/formats/worldData/it1_worlddata.test.js with
//     ARENA2_PATH set, are what say whether it rebuilds the author's file;
//     run this tool again with an ARENA2 to replace it with WD1's.
//
// The four files are read out of the shipped bundle (formats/unity/unityBundle.js)
// and parsed as FullSerializer writes them (`\0` is one of its escapes, and
// WALLAA11 carries one - plain JSON.parse refuses it).

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isMain } from './lib/isMain.mjs';
import { readUnityBundle } from '../src/formats/unity/unityBundle.js';
import { BlocksFile } from '../src/formats/blocksFile.js';
import { PATCH_FORMAT, rebuildWorldDataPatch } from '../src/formats/worldData/worldDataPatch.js';
import { parseFullSerializerJson } from './worldDataPackBuild.mjs';
import { makePatch, formatPatch, sha256Canonical } from './worldDataPatch.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
/** The four gate blocks the manifest names (immersive-travel.dfmod.json Files). */
export const IT_GATE_BLOCKS = Object.freeze(['WALLAA08.RMB', 'WALLAA09.RMB', 'WALLAA10.RMB', 'WALLAA11.RMB']);
/** The two arrays the author appended to, under the header field that still counts the classic block's. */
export const IT_APPENDED_ARRAYS = Object.freeze([
  Object.freeze(['Misc3dObjectRecords', 'NumMisc3dObjectRecords']),
  Object.freeze(['MiscFlatObjectRecords', 'NumMiscFlatObjectRecords']),
]);

/** AUDIT IT1 G1: the slots the classic reader gives every RMB's BuildingDataList (formats/blocksFile.js), whatever the
 *  block's count - the editor writes NumBlockDataRecords of them. */
export const CLASSIC_BUILDING_SLOTS = 32;
/** The three fields the editor writes on every model and the classic record leaves out (worldDataJson.js modelJson). */
const MODEL_SCALES = Object.freeze(['XScale', 'YScale', 'ZScale']);

/** The edit read off the author's file alone: the editor's round trip (AUDIT IT1 G1) and every record past the header's
 *  count, inserted where it stands. Throws when the file's shape says the author did more than append (a subrecord
 *  added, an array shorter than its count). */
export function appendedEdit(modJson) {
  const rmb = modJson?.RmbBlock;
  const header = rmb?.FldHeader;
  if (!rmb || !header) throw new Error(`immersive travel: ${modJson?.Name} is not an RMB block`);
  if (rmb.SubRecords.length !== header.NumBlockDataRecords) throw new Error(`immersive travel: ${modJson.Name} changes its subrecords - the header-count edit cannot carry it`);
  const ops = [];
  // AUDIT IT1 G1: the editor's round trip - the building slots past the count go, last first
  const slots = header.BuildingDataList;
  if (Array.isArray(slots)) for (let i = CLASSIC_BUILDING_SLOTS - 1; i >= slots.length; i--) ops.push(['r', ['RmbBlock', 'FldHeader', 'BuildingDataList', i]]);
  // ...and the classic models' scales, which the classic record does not carry
  for (let i = 0; i < Math.min(header.NumMisc3dObjectRecords ?? 0, rmb.Misc3dObjectRecords?.length ?? 0); i++) {
    for (const k of MODEL_SCALES) if (k in rmb.Misc3dObjectRecords[i]) ops.push(['s', ['RmbBlock', 'Misc3dObjectRecords', i, k], rmb.Misc3dObjectRecords[i][k]]);
  }
  for (const [array, count] of IT_APPENDED_ARRAYS) {
    const list = rmb[array];
    const classic = header[count];
    if (!Array.isArray(list) || !Number.isInteger(classic) || list.length < classic) throw new Error(`immersive travel: ${modJson.Name} ${array} is shorter than its header count`);
    for (let i = classic; i < list.length; i++) ops.push(['i', ['RmbBlock', array, i], list[i]]);
  }
  return ops;
}

/** The patch for one gate block without an ARENA2: the author's sha256, the classic block named by the file's own
 *  name and index, and the appended records. */
export function appendedPatch(modJson) {
  return {
    format: PATCH_FORMAT,
    rebuilds: `${modJson.Name}.json`,
    base: { kind: 'block', block: modJson.Name, index: modJson.Index },
    sha256: sha256Canonical(modJson),
    ops: appendedEdit(modJson),
  };
}

/** The four files out of the shipped bundle, parsed. */
export function readGateBlocks(bundleBytes) {
  const bundle = readUnityBundle(bundleBytes);
  const out = new Map();
  for (const name of IT_GATE_BLOCKS) {
    const t = bundle.textAssets.find((a) => a.name === name);
    if (!t) throw new Error(`immersive travel: the bundle carries no ${name}`);
    out.set(name, parseFullSerializerJson(new TextDecoder().decode(t.bytes)));
  }
  return out;
}

if (isMain(import.meta.url)) {
  const [bundlePath, arena2Arg, outArg] = process.argv.slice(2);
  if (!bundlePath) {
    console.error('usage: node tools/immersiveTravelPatches.mjs <immersivetravel.dfmod> [arena2] [out dir]');
    process.exit(1);
  }
  const arena2 = arena2Arg || process.env.ARENA2_PATH || '';
  const outDir = outArg ?? join(ROOT, 'vendor/immersive-travel/WorldDataPatches');
  mkdirSync(outDir, { recursive: true });
  const files = readGateBlocks(new Uint8Array(readFileSync(bundlePath)));
  let blocks = null;
  if (arena2 && existsSync(join(arena2, 'BLOCKS.BSA'))) {
    blocks = new BlocksFile();
    if (!blocks.load(new Uint8Array(readFileSync(join(arena2, 'BLOCKS.BSA'))))) throw new Error('BLOCKS.BSA did not load');
  }
  for (const [name, modJson] of files) {
    let patch, how;
    if (blocks) {
      // WD1's own: the diff against the classic block, checked to rebuild the author's file
      patch = makePatch(blocks, name, modJson);
      how = 'diffed against BLOCKS.BSA, rebuilds the author\'s file';
      const appended = appendedPatch(modJson);
      const same = sha256Canonical(rebuildWorldDataPatch(appended, blocks)) === appended.sha256;
      how += same ? ' (the header-count edit rebuilds it too)' : ' (the header-count edit does NOT - the editor changed classic records as well)';
    } else {
      patch = appendedPatch(modJson);
      how = 'the editor\'s round trip and the records past the header counts - NOT checked against a BLOCKS.BSA';
    }
    const out = join(outDir, `${name}.json`);
    const body = formatPatch(patch);
    writeFileSync(out, body);
    console.log(`  ${name}: ${patch.ops.length} ops, ${body.length} bytes - ${how} -> ${out}`);
  }
}

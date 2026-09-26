// WD1 (2026-09-25): A VENDORED WORLD-DATA PATCH, LAID BACK ON THE
// PLAYER'S CLASSIC BLOCK.
//
// The file a mod ships (a whole block, or a whole building record, as
// DFU's World Data Editor writes it) is vendored as the edit only
// (formats/worldDataJson.js says why; tools/worldDataPatch.mjs makes the
// patch). At load the port reads the classic block out of the player's
// own BLOCKS.BSA, serialises it the way the editor did, lays the edit on
// and hands the result to the world-data door under the file's DFU name
// (scenes/modWorldData.js) - from there it is the mod's file, served
// exactly as DFU's WorldDataReplacement serves it.
//
// A patch:
//   { format: 'dfe-worlddata-patch/1',
//     rebuilds: '<DFU file name>.json',
//     base: { kind: 'block', block: 'W0000000.RDB', index: 1016 }
//         | { kind: 'building', block: 'SHIPAA00.RMB', index: 390, record: 0 },
//     sha256: '<the shipped file, canonical form>',
//     ops: [...] }

import { blockToDfuJson, buildingToDfuJson, patchJson, canonicalJson, jsonAt } from './worldDataJson.js';

export const PATCH_FORMAT = 'dfe-worlddata-patch/1';

/**
 * The mod's file, rebuilt. Throws when the patch is not this format, the
 * player's BLOCKS.BSA does not hold the named block at the named index, or
 * an op does not land.
 * @param {object} patch
 * @param {{ getBlockName(i:number):string|null, readClassicBlock(i:number):object|null }} blocksFile
 * @returns {object} the DFU world-data JSON
 */
export function rebuildWorldDataPatch(patch, blocksFile) {
  if (patch?.format !== PATCH_FORMAT) throw new Error(`world-data patch: ${patch?.rebuilds ?? '?'} is not ${PATCH_FORMAT}`);
  const { base } = patch;
  const docs = new Map();
  const classicJson = (index, name) => {
    if (!docs.has(index)) {
      const got = blocksFile.getBlockName(index);
      if (name && got !== name) throw new Error(`world-data patch: ${patch.rebuilds} wants ${name} at block ${index}, BLOCKS.BSA has ${got}`);
      const b = blocksFile.readClassicBlock(index);
      if (!b) throw new Error(`world-data patch: block ${index} did not read`);
      docs.set(index, b);
    }
    return docs.get(index);
  };
  const dfBlock = classicJson(base.index, base.block);
  const start = base.kind === 'building' ? buildingToDfuJson(dfBlock, base.record) : blockToDfuJson(dfBlock);
  const serialised = new Map();
  const resolve = (ref) => {
    if (!serialised.has(ref.block)) serialised.set(ref.block, blockToDfuJson(classicJson(ref.block, null)));
    return jsonAt(serialised.get(ref.block), ref.path);
  };
  return patchJson(start, patch.ops, resolve);
}

/** sha256 of the canonical form, hex (WebCrypto in the browser, node's crypto under test). */
export async function canonicalSha256(json) {
  const bytes = new TextEncoder().encode(canonicalJson(json));
  const subtle = globalThis.crypto?.subtle;
  if (subtle) {
    const d = new Uint8Array(await subtle.digest('SHA-256', bytes));
    return [...d].map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  const { createHash } = await import('node:crypto');
  return createHash('sha256').update(bytes).digest('hex');
}

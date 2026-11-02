// @ts-check
// DELVE II (DLV5, bible/03-World/Delve-II.md section 8): the curated blocks on the world-data door - each made of its
// base when first read (formats/worldData/worldDataReplacement.js registerPortBlockOf, a castle's halls' way), behind no
// switch, as the port's own blocks are. Once, beside the town outline (scenes/modWorldData.js loadModWorldData). The base is
// BLOCKS.BSA's own (readClassicBlock - AUDIT DLV5-6: a mod's block of that name is not what its anchors were designed on).
import { registerPortBlockOf } from '../../formats/worldData/worldDataReplacement.js';
import { curatedBlockOf, curatedBlockName, CURATED_BLOCK_INDEX } from './curatedBlocks.js';
import { CURATED_RECORDS } from './curatedRecords.js';

/** Every record registered under its name and index; a record may be registered again (the lab's draft). */
export function installCuratedBlocks(records = CURATED_RECORDS) {
  for (const rec of records)
    registerPortBlockOf(
      curatedBlockName(rec.n),
      (blocksFile) => curatedBlockOf(blocksFile?.readClassicBlock?.(blocksFile.getBlockIndex(rec.base)) ?? null, rec),
      CURATED_BLOCK_INDEX + rec.n,
    );
  return records.length;
}

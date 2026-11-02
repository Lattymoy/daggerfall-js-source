// @ts-check
// FOUNDATION F1 (2026-10-30, bible/03-World/Foundation-Arc.md): A BLOCK NAME AS THE LAYOUT WOULD SERVE IT - the atlas's
// resolve. BLOCKS.BSA's alternate match first (BlocksFile.checkName); then a record of BLOCKS.BSA stands, and a name past
// it (an index the world-data door assigned) stands only where the door serves its content. Nothing is built to ask.
import { worldDataServesBlock } from '../../formats/worldData/worldDataReplacement.js';

/** The atlas's resolveBlock over a BlocksFile: the name it serves under, or '' where nothing would read.
 *  @param {{ checkName: (n: string) => string, getBlockIndex: (n: string) => number, count: number }} blocks */
export const servedBlockOf = (blocks) => (/** @type {string} */ name) => {
  const canon = blocks.checkName(name);
  if (!canon) return '';
  const i = blocks.getBlockIndex(canon);
  return i >= 0 && (i < blocks.count || worldDataServesBlock(canon)) ? canon : '';
};

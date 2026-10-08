#!/usr/bin/env node
// CARDS2 (2026-10-07, bible/11-Multiplayer/Tavern-Cards.md section 2): THE TAVERN FURNITURE CENSUS - every free-standing
// piece (an ARCH3D prop, 41000-43999) the tavern interiors of the player's own ARENA2 stand, with how many times and in
// how many blocks, and its size in metres (width x height x depth, unrotated). It is the measure world/cardTables.js's
// CARD_TABLE_MODELS waits on: a table is a piece about a metre or two across whose top stands at a table's height, and
// the census lists them so the eye can say which ids are tables.
//
//     node tools/cardTableCensus.mjs <arena2 folder>          (or ARENA2_PATH=... node tools/cardTableCensus.mjs)
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Arch3dFile } from '../src/formats/arch3dFile.js';
import { BlocksFile, BLOCK_TYPES } from '../src/formats/blocksFile.js';
import { BUILDING_TYPES } from '../src/world/buildingNames.js';
import { PROP_MODEL_TYPE } from '../src/world/interiorLayout.js';
import { GLOBAL_SCALE } from '../src/world/meshReader.js';
import { DECOR_FURNITURE_FIRST, DECOR_FURNITURE_LAST } from '../src/systems/decorCatalogue.js';
import { isCardTableModel } from '../src/world/cardTables.js';
import { isMain } from './lib/isMain.mjs';

/**
 * The tally, from blocks already read: `rmbs` is `[{name, buildingTypes: number[], interiors: [{modelIdNum,
 * objectType}][]}]` (one interior per building record), `sizeOf(id)` the model's size in metres or null. Answers the
 * rows, most-stood first: `{model, count, blocks, size, table}` (`table` - CARD_TABLE_MODELS holds it).
 */
export function tavernFurniture(rmbs, sizeOf) {
  const rows = new Map();
  for (const b of rmbs) {
    b.interiors.forEach((objs, r) => {
      if (b.buildingTypes[r] !== BUILDING_TYPES.Tavern) return;
      for (const o of objs ?? []) {
        if (o.objectType !== PROP_MODEL_TYPE || o.modelIdNum < DECOR_FURNITURE_FIRST || o.modelIdNum > DECOR_FURNITURE_LAST) continue;
        const row = rows.get(o.modelIdNum) ?? { model: o.modelIdNum, count: 0, blocks: new Set() };
        row.count++; row.blocks.add(b.name);
        rows.set(o.modelIdNum, row);
      }
    });
  }
  return [...rows.values()]
    .map((r) => ({ model: r.model, count: r.count, blocks: r.blocks.size, size: sizeOf(r.model), table: isCardTableModel(r.model) }))
    .sort((a, b) => b.count - a.count || a.model - b.model);
}

/** A model's size in metres: the reader's own box (Arch3dFile's `size`, DFU's), at GLOBAL_SCALE. */
const meshSize = (mesh) => (mesh?.size ? [mesh.size.x, mesh.size.y, mesh.size.z].map((v) => +(v * GLOBAL_SCALE).toFixed(2)) : null);

if (isMain(import.meta.url)) {
  const arena2 = process.argv[2] ?? process.env.ARENA2_PATH;
  if (!arena2) { console.error('usage: node tools/cardTableCensus.mjs <arena2 folder>'); process.exit(2); }
  const arch = new Arch3dFile();
  arch.load(new Uint8Array(readFileSync(join(arena2, 'ARCH3D.BSA'))));
  const blocks = new BlocksFile();
  blocks.load(new Uint8Array(readFileSync(join(arena2, 'BLOCKS.BSA'))));
  const rmbs = [];
  for (let b = 0; b < blocks.count; b++) {
    if (blocks.getBlockType(b) !== BLOCK_TYPES.Rmb) continue;
    const rmb = blocks.getBlock(b)?.rmbBlock;
    if (!rmb?.subRecords) continue;
    rmbs.push({
      name: blocks.getBlockName(b),
      buildingTypes: rmb.fldHeader.buildingDataList.map((d) => d?.buildingType),
      interiors: rmb.subRecords.map((s) => s?.interior?.block3dObjectRecords ?? []),
    });
  }
  const sizeOf = (id) => { const i = arch.getRecordIndex(id); return i === -1 ? null : meshSize(arch.getMesh(i)); };
  const rows = tavernFurniture(rmbs, sizeOf);
  console.log(`${rows.length} furniture models in the tavern interiors of ${rmbs.length} RMB blocks (size: width x height x depth, metres)`);
  for (const r of rows) console.log(`${r.model}\t${r.count} times in ${r.blocks} blocks\t${r.size ? r.size.join(' x ') : '?'}${r.table ? '\t<- a card table today' : ''}`);
}

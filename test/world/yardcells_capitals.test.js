// YARD-CELL (2026-10-26, bible/11-Multiplayer/Yard-Cells.md section 4.1) - WHAT A CAPITAL PAST THE BAY HOLDS, AGAINST
// THE BOUNDS THE YARDS AND THE HOMES ANSWER READ. The yards are kept a block at a time on the law that a block holds at
// most 32 building records (BLOCKS.BSA's list: net/yardCellLaw.js), and a yard stands only for a home its town's homes
// answer lists, at most HOME_TOWN_MAX. #1184 (TESA) builds capitals of the port's own blocks beside Daggerfall's, and
// cuts the Imperial City into slices, each its own location. This holds both bounds over every capital slice it builds.
//
// It runs where #1184's capitals are (world/tamrielCapitals.js) and ARENA2 is, and skips elsewhere: YARD-CELL landed on
// main before #1184, so on main it runs from the day #1184 merges. Measured on #1184's branch (4d8200b017, 2026-10-26):
// 7 capitals, 57 slices, 1,397 port blocks holding no building record; the most records in any block a slice lays 23
// (the Imperial City's TEMPAAD0.RMB); the densest slice the Imperial City's 18th - 794 buildings, 707 of them houses.
// Run there with the branch's own HOME_TOWN_MAX (512) it fails at the Imperial City's 16th slice (606 buildings) - the
// homes answer would have hidden its eastern homes' yards and doors; with YARD-CELL's 2,048 it passes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { HOME_TOWN_MAX } from '../../src/net/homeLaw.js';
import { BlocksFile } from '../../src/formats/blocksFile.js';
import { MapsFile } from '../../src/formats/mapsFile.js';

const CAPITALS_MODULE = new URL('../../src/world/tamrielCapitals.js', import.meta.url);
const ARENA2 = process.env.ARENA2_PATH;
const skip = !existsSync(fileURLToPath(CAPITALS_MODULE)) ? 'no capitals past the Bay in this tree (#1184 not merged)'
  : !ARENA2 || !existsSync(ARENA2) ? 'ARENA2_PATH not set or missing - real-data validation skipped' : false;
/** The records a block of Daggerfall's holds at most - BLOCKS.BSA's building list - which a yard cell is bounded by. */
const BLOCK_RECORDS_MAX = 32;

test('YARD-CELL every capital #1184 builds: no block a slice lays holds more than 32 building records (the port\'s own blocks none), and no slice more buildings than HOME_TOWN_MAX (mutant: none - the bound is the data\'s)', { skip }, async () => {
  const capitals = await import(CAPITALS_MODULE.href);
  const bytes = (n) => new Uint8Array(readFileSync(`${ARENA2}/${n}`));
  const blocks = new BlocksFile();
  blocks.load(bytes('BLOCKS.BSA'));
  const maps = new MapsFile();
  maps.load(bytes('MAPS.BSA'), bytes('CLIMATE.PAK'), bytes('POLITIC.PAK'));
  const rows = [];
  for (let region = 0; region < maps.regionCount; region++) {
    let count = 0;
    try { count = maps.baseLocationCount(region); } catch { continue; }
    for (let i = 0; i < count; i++) {
      try {
        const location = maps.getLocation(region, i);
        if (location) rows.push(location);
      } catch { /* a location the reader refuses stands no capital */ }
    }
  }
  const base = capitals.capitalBase(rows);
  const names = capitals.cityBlockNames(rows);
  for (const port of capitals.capitalPortBlocks()) {
    assert.deepEqual(port.json?.RmbBlock?.FldHeader?.BuildingDataList ?? [], [], `${port.name}: a port block holds no building`);
  }
  const blockOf = (name) => blocks.getBlockByName(name) ?? null;
  let slices = 0;
  capitals.CAPITALS.forEach((cap, k) => {
    const dims = capitals.capitalDims(cap);
    for (let s = 0; s < dims.w * dims.h; s++) {
      const location = capitals.synthesizeCapitalLocation({ cap, k, s }, { base, names, blockOf, px: 1000, py: 1000 });
      if (!location) continue;
      slices++;
      let buildings = 0;
      for (const name of location.exterior.exteriorData.blockNames) {
        const records = blockOf(name)?.rmbBlock?.fldHeader?.numBlockDataRecords ?? 0;
        assert.ok(records <= BLOCK_RECORDS_MAX, `${cap.name} slice ${s}: ${name} holds ${records} building records`);
        buildings += records;
      }
      assert.ok(buildings <= HOME_TOWN_MAX, `${cap.name} slice ${s}: ${buildings} buildings, past HOME_TOWN_MAX`);
    }
  });
  assert.ok(slices > 0, 'the capitals measured');
});

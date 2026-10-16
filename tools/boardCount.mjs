// NOTICE1b's MEASURE - BOARD-COUNT (PROF0 10.1: "Every seat and hub has one. A seat or hub whose blocks place no board
// gets one ... SEAT-COUNT counts them"). The Notice Board is a town's RUMOUR boards' (BOUNTY1 took every other one,
// systems/bounty/bountyBoard.js questBoardIndices), so a hub has a Notice Board wherever its blocks place at least one
// bulletin board. This walks MAPS.BSA and BLOCKS.BSA from the player's own ARENA2 exactly as the world host's boot pass
// does (the game's own rows, regionHubs.js pickRegionHubs), lays out every hub (world/locationLayout.js) and prints
// each: its region, its name, whether it is a capital, how many bulletin boards its blocks place, how many of them
// are bounty boards and how many rumour boards - and the hubs with none, which are NOTICE1b's whole list.
//
// It writes nothing to the tree; Mac runs it (the servers and this lane hold no ARENA2).
//
// Usage: ARENA2_PATH=/path/to/arena2 node tools/boardCount.mjs [--json]
import { readFileSync } from 'node:fs';
import { isMain } from './lib/isMain.mjs';
import { BlocksFile } from '../src/formats/blocksFile.js';
import { MapsFile } from '../src/formats/mapsFile.js';
import { layoutLocation } from '../src/world/locationLayout.js';
import { isBulletinBoard } from '../src/world/rmbLayout.js';
import { pickRegionHubs } from '../src/systems/region/regionHubs.js';
import { questBoardIndices } from '../src/systems/bounty/bountyBoard.js';

/**
 * A laid-out location's boards: every placed model the town sign wears (rmbLayout isBulletinBoard), and how BOUNTY1
 * splits them - pure over the layout's blocks, so a pin drives it without game data.
 * @param {Array<{ originX?: number, originZ?: number, layout?: { models?: Array<{ modelIdNum: number, matrix?: ArrayLike<number> }> } }>} blocks
 * @returns {{ boards: number, bounty: number, rumour: number }}
 */
export function boardTally(blocks) {
  const boxes = [];
  for (const b of blocks ?? []) {
    for (const m of b?.layout?.models ?? []) {
      if (!isBulletinBoard(m.modelIdNum)) continue;
      const x = (b.originX ?? 0) + (m.matrix?.[12] ?? 0), y = m.matrix?.[13] ?? 0, z = (b.originZ ?? 0) + (m.matrix?.[14] ?? 0);
      boxes.push({ box: [x, y, z, x, y, z] });
    }
  }
  const bounty = questBoardIndices(boxes).size;
  return { boards: boxes.length, bounty, rumour: boxes.length - bounty };
}

/** Every hub, with its boards (the game's own rows alone, as the boot pass collects them). */
export function hubBoards(maps, blocks) {
  const rows = [];
  for (let r = 0; r < maps.regionCount; r++) {
    const region = maps.getRegion(r);
    if (!region) continue;
    const base = maps.baseLocationCount(r);
    for (let l = 0; l < Math.min(base, region.locationCount); l++) {
      const loc = maps.getLocation(r, l);
      if (loc?.exterior?.exteriorData) rows.push(loc);
    }
  }
  const hubs = pickRegionHubs(rows, { regionNameOf: (r) => maps.getRegionName(r) });
  const byKey = new Map(rows.map((loc) => [`${loc.regionIndex}:${loc.locationIndex}`, loc]));
  const out = [];
  for (const hub of hubs.byRegion.values()) {
    const loc = byKey.get(`${hub.regionIndex}:${hub.locationIndex}`);
    let tally = { boards: -1, bounty: 0, rumour: 0 };   // -1: the layout failed - read it as "not measured", never as none
    try { if (loc) tally = boardTally(layoutLocation(loc, maps, blocks, { enhanced: false, windmills: false }).blocks); } catch { /* not measured */ }
    out.push({ region: hub.regionName, name: hub.name, capital: hub.capital, ...tally });
  }
  return out;
}

if (isMain(import.meta.url)) {
  const A2 = process.env.ARENA2_PATH;
  if (!A2) { console.error('ARENA2_PATH is not set - point it at your own arena2 folder.'); process.exit(2); }
  const bytes = (n) => new Uint8Array(readFileSync(`${A2}/${n}`));
  const blocks = new BlocksFile(); blocks.load(bytes('BLOCKS.BSA'));
  const maps = new MapsFile(); maps.load(bytes('MAPS.BSA'), bytes('CLIMATE.PAK'), bytes('POLITIC.PAK'));
  const hubs = hubBoards(maps, blocks);
  if (process.argv.includes('--json')) { console.log(JSON.stringify(hubs, null, 2)); process.exit(0); }
  for (const h of hubs) {
    console.log(`${h.region.padEnd(20)} ${h.name.padEnd(24)} ${h.capital ? 'capital' : '       '}  boards ${String(h.boards).padStart(2)}  bounty ${h.bounty}  rumour ${h.rumour}${h.boards < 0 ? '   (layout failed - not measured)' : h.rumour ? '' : '   <- NO NOTICE BOARD'}`);
  }
  const none = hubs.filter((h) => h.boards === 0);
  const failed = hubs.filter((h) => h.boards < 0);
  console.log(`\n${hubs.length} hubs; ${none.length} with no Notice Board${none.length ? `: ${none.map((h) => h.name).join(', ')}` : ''}${failed.length ? `; ${failed.length} not measured: ${failed.map((h) => h.name).join(', ')}` : ''}.`);
}

// SEAT-COUNT (bible/11-Multiplayer/Seats-Arc.md 3.1: "tools/seatCount.mjs ... walks MAPS.BSA from ARENA2_PATH exactly as
// the boot pass does and prints every seat (region, kingdom, name, tier, hub or not, whether its blocks place a bulletin
// board, the pixel) and the totals. It writes nothing to the tree; Mac runs it."). The seats are systems/town/townSeats.js
// deriveTownSeats over the game's own rows (the boot pass's, regionHubs.js pickRegionHubs's); each is laid out
// (world/locationLayout.js) and its bulletin boards tallied as BOARD-COUNT tallies a hub's (tools/boardCount.mjs), so a
// seat whose blocks place no Notice Board is named - PROF0 10.1's "a seat ... whose blocks place no board gets one".
//
// The economy is built so the count does not break it: every cost is per seat, and a guild's influence is capped per
// account (SEAT0 3.1). The count is recorded in Seats-Arc 14 when Mac has run it.
//
// Usage: ARENA2_PATH=/path/to/arena2 node tools/seatCount.mjs [--json]
import { readFileSync } from 'node:fs';
import { isMain } from './lib/isMain.mjs';
import { BlocksFile } from '../src/formats/blocksFile.js';
import { MapsFile } from '../src/formats/mapsFile.js';
import { layoutLocation } from '../src/world/locationLayout.js';
import { pickRegionHubs } from '../src/systems/region/regionHubs.js';
import { deriveTownSeats, seatTotals } from '../src/systems/town/townSeats.js';
import { boardTally } from './boardCount.mjs';

/** The game's own rows, as the world host's boot pass collects them (a mod's appended rows never count). */
export function baseRows(maps) {
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
  return rows;
}

/** Every seat with its boards, and the totals. `layout(loc)` lays a location out (the host's; a pin hands its own). */
export function countSeats(rows, { regionNameOf, layout = null } = {}) {
  const hubs = pickRegionHubs(rows, { regionNameOf });
  const seats = deriveTownSeats(rows, { regionNameOf, isHub: (k) => hubs.byMapId.has(k) });
  const byKey = new Map(rows.map((loc) => [loc.mapTableData?.mapId >>> 0, loc]));
  const out = seats.list.map((s) => {
    let tally = { boards: -1, bounty: 0, rumour: 0 };   // -1: not laid out, never "none"
    try { if (layout) tally = boardTally(layout(byKey.get(s.key)).blocks); } catch { /* not measured */ }
    return { ...s, regionName: regionNameOf ? regionNameOf(s.region) : String(s.region), ...tally };
  });
  return { seats: out, totals: seatTotals(seats.list) };
}

if (isMain(import.meta.url)) {
  const A2 = process.env.ARENA2_PATH;
  if (!A2) { console.error('ARENA2_PATH is not set - point it at your own arena2 folder.'); process.exit(2); }
  const bytes = (n) => new Uint8Array(readFileSync(`${A2}/${n}`));
  const blocks = new BlocksFile(); blocks.load(bytes('BLOCKS.BSA'));
  const maps = new MapsFile(); maps.load(bytes('MAPS.BSA'), bytes('CLIMATE.PAK'), bytes('POLITIC.PAK'));
  const { seats, totals } = countSeats(baseRows(maps), {
    regionNameOf: (r) => maps.getRegionName(r),
    layout: (loc) => layoutLocation(loc, maps, blocks, { enhanced: false, windmills: false }),
  });
  if (process.argv.includes('--json')) { console.log(JSON.stringify({ seats, totals }, null, 2)); process.exit(0); }
  for (const s of seats) {
    console.log(`${s.regionName.padEnd(20)} ${String(s.kingdom ?? '-').padEnd(10)} ${s.name.padEnd(24)} ${s.tier.padEnd(6)} ${s.isHub ? 'hub' : '   '}  (${s.pixel[0]},${s.pixel[1]})  boards ${String(s.boards).padStart(2)} rumour ${s.rumour}${s.boards < 0 ? '   (layout failed - not measured)' : s.rumour ? '' : '   <- NO NOTICE BOARD'}`);
  }
  const none = seats.filter((s) => s.boards === 0);
  console.log(`\n${totals.seats} seats: ${totals.crown} crown, ${totals.palace} palace; ${totals.hubs} of them hubs. By kingdom: ${Object.entries(totals.kingdoms).map(([k, n]) => `${k} ${n}`).join(', ')}.`);
  console.log(`${none.length} with no Notice Board${none.length ? `: ${none.map((s) => s.name).join(', ')}` : ''}.`);
}

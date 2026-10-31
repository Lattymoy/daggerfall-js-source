#!/usr/bin/env node
// DRAGON-CELL (bible/11-Multiplayer/Dwarven-Dragon.md section 2): how many of the cells a watch's omen may pick hold a town's
// ring - the ground a dragon may come down on - on the player's own ARENA2. The Bay's from the gate's own scan; past the Bay
// from every place the world stands there, the countryside's and the lairs' rolled (minutes). A cell holds ground where a
// pixel 2 to 4 (Chebyshev) from a city, hamlet or village lies in it - the scan's water and place tests left to the Bay's
// count, so the figure past the Bay is a ceiling.
//   ARENA2_PATH=... node tools/dragonCellProbe.mjs
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadWorldAtlas, rolledPlacesPastBay } from './atlasMeasure.mjs';
import { MapsFile, LOCATION_TYPES } from '../src/formats/mapsFile.js';
import { WoodsFile } from '../src/formats/woodsFile.js';
import { gateScanner } from '../src/systems/gate/gateSite.js';
import { WORLD_SALT } from '../src/world/spawnedDungeons.js';
import { WILD_REGION } from '../src/systems/wild/wildZone.js';
import { inBay } from '../src/world/tamriel/tamrielFrame.js';
import { DRAGON_CELL_PX, DRAGON_CELLS } from '../src/net/dragon/dragonLaw.js';

const A = process.env.ARENA2_PATH;
if (!A) { console.error('set ARENA2_PATH (sh tools/fetch-data.sh fetches it)'); process.exit(2); }
const rd = (n) => new Uint8Array(readFileSync(join(A, n)));
const cellOf = (x, y) => `${Math.floor(x / DRAGON_CELL_PX)},${Math.floor(y / DRAGON_CELL_PX)}`;
const inFrame = (x, y) => { const cx = Math.floor(x / DRAGON_CELL_PX), cy = Math.floor(y / DRAGON_CELL_PX); return cx >= DRAGON_CELLS.cx0 && cy >= DRAGON_CELLS.cy0 && cx < DRAGON_CELLS.cx0 + DRAGON_CELLS.cols && cy < DRAGON_CELLS.cy0 + DRAGON_CELLS.rows; };

const maps = new MapsFile(); maps.load(rd('MAPS.BSA'), rd('CLIMATE.PAK'), rd('POLITIC.PAK'));
const woods = new WoodsFile(); woods.load(rd('WOODS.WLD'));
const sc = gateScanner(maps, { spawnSalt: WORLD_SALT, heightAt: (x, y) => woods.getHeightMapValue(x, y) });
let scan; while (!(scan = sc.step(() => true)));
const bay = new Set();
for (const [r, list] of scan.byRegion) if (r !== WILD_REGION) for (const id of list) bay.add(cellOf(id % 1000, Math.floor(id / 1000)));

const t0 = Date.now();
const { places, tamriel } = await loadWorldAtlas(A, { served: true });
const TOWNS = new Set([LOCATION_TYPES.TownCity, LOCATION_TYPES.TownHamlet, LOCATION_TYPES.TownVillage]);
const listed = places.all().filter((p) => !inBay(p.px, p.py) && TOWNS.has(p.type));
const rolled = rolledPlacesPastBay(tamriel).filter((p) => TOWNS.has(p.type));
const past = new Set();
for (const t of [...listed, ...rolled]) {
  for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 2) continue;
    const x = t.px + dx, y = t.py + dy;
    if (!inBay(x, y) && inFrame(x, y)) past.add(cellOf(x, y));
  }
}
const all = DRAGON_CELLS.cols * DRAGON_CELLS.rows, ground = bay.size + past.size;
console.log({ frameCells: all, bayCells: bay.size, pastCells: past.size, listedTowns: listed.length, rolledTowns: rolled.length, groundShare: +(ground / all).toFixed(4), bayShareOfGround: +(bay.size / ground).toFixed(4), seconds: Math.round((Date.now() - t0) / 1000) });

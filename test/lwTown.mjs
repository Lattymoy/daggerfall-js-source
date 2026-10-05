// LW1/LW2 (bible/06-Systems/Living-World.md): A SYNTHETIC TOWN for the living world's pins - the producers' own
// inputs on a town with no game data: a CityNavigation grid of streets and building footprints, the buildings'
// summaries' columns (world/buildingSummaries.js), the doors' location-frame centres and normals (the streaming host's
// own mapping of its static doors).
import { CityNavigation, NAV_CELL } from '../src/world/cityNavigation.js';
import { BUILDING_TYPES } from '../src/world/buildingNames.js';

/** A town of 3x3 blocks: streets every 24 cells, a 12x12 building in each street block, its door on its south wall
 *  facing the street (normal -z); the first nine buildings are a town's trades, the rest houses. */
export function synthTown({ blocksW = 3, blocksH = 3, flipNormals = false } = {}) {
  const nav = new CityNavigation(blocksW, blocksH);
  const W = nav.width, H = nav.height;
  const set = (x, y, w) => { nav.grid[y * W + x] = (w << 4) & 0xff; };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) set(x, y, (x % 24 < 3 || y % 24 < 3) ? 15 : 12);
  const buildings = [], doors = [];
  const trades = [BUILDING_TYPES.Tavern, BUILDING_TYPES.Temple, BUILDING_TYPES.GeneralStore, BUILDING_TYPES.Armorer, BUILDING_TYPES.WeaponSmith,
    BUILDING_TYPES.Alchemist, BUILDING_TYPES.GuildHall, BUILDING_TYPES.Palace, BUILDING_TYPES.Bank];
  let key = 1000, i = 0;
  for (let by = 0; by < H / 24; by++) for (let bx = 0; bx < W / 24; bx++) {
    const x0 = bx * 24 + 6, y0 = by * 24 + 6;
    for (let y = y0; y < y0 + 12; y++) for (let x = x0; x < x0 + 12; x++) set(x, y, 0);
    const type = i < trades.length ? trades[i] : BUILDING_TYPES.House1 + (i % 4);
    buildings.push({ key, type, quality: 10 + (i % 8), factionId: 0 });
    doors.push({ key, x: (x0 + 6) * NAV_CELL, z: y0 * NAV_CELL, nx: 0, nz: flipNormals ? 1 : -1 });
    key++; i++;
  }
  return { nav, buildings, doors };
}

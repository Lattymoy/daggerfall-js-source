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

/** LW-STAND: A CLOSE-BUILT TOWN - the same grid with no open ground: the streets alone (three cells wide, every 24),
 *  each street block built solid to them - two buildings side by side, their doors on its south face onto the street.
 *  A stand drawn by geometry alone falls in a wall here, as it does in a real town's lanes. */
export function closeTown({ blocksW = 4, blocksH = 4 } = {}) {
  const nav = new CityNavigation(blocksW, blocksH);
  const W = nav.width, H = nav.height;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) nav.grid[y * W + x] = (x % 24 < 3 || y % 24 < 3) ? (15 << 4) & 0xff : 0;
  const buildings = [], doors = [];
  const trades = [BUILDING_TYPES.Tavern, BUILDING_TYPES.Temple, BUILDING_TYPES.GeneralStore, BUILDING_TYPES.Armorer, BUILDING_TYPES.WeaponSmith,
    BUILDING_TYPES.Alchemist, BUILDING_TYPES.GuildHall, BUILDING_TYPES.Palace, BUILDING_TYPES.Bank];
  let key = 1000, i = 0;
  for (let by = 0; by < H / 24; by++) for (let bx = 0; bx < W / 24; bx++) {
    for (const [x0, w] of [[bx * 24 + 3, 10], [bx * 24 + 13, 8]]) {
      const type = i < trades.length ? trades[i] : BUILDING_TYPES.House1 + (i % 4);
      buildings.push({ key, type, quality: 10 + (i % 8), factionId: 0 });
      doors.push({ key, x: (x0 + (w >> 1)) * NAV_CELL, z: (by * 24 + 3) * NAV_CELL, nx: 0, nz: -1 });
      key++; i++;
    }
  }
  return { nav, buildings, doors };
}

/** LW-WALLS: A WALLED CITY - a town of streets and buildings inside a ring of wall, the fields about it to the grid's
 *  edge, and a gate in the middle of each side: a passage through the wall that the gate's own footprint closes (the
 *  gate model's automap cells - every walled city of the game, its streets and its fields two components of the grid).
 *  The fields are the larger, as they are in 407 of the game's 410 cities. Streets every 25 cells inside (three wide);
 *  in each street block a building, its door on its south face onto the street, the first nine a town's trades and the
 *  rest houses; a farmhouse out in the fields, its door onto them. `walledPalace`: the palace stands in grounds of its
 *  own, walled about with its gate closed too - its door opens onto a third component. Cells are [x, y]; `box` the
 *  walls' inside, `passages` each gate's way through. */
export function walledTown({ walledPalace = false } = {}) {
  const nav = new CityNavigation(4, 4);
  const W = nav.width, H = nav.height;
  const fill = (x0, y0, x1, y1, w) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) nav.grid[y * W + x] = (w << 4) & 0xff; };
  fill(0, 0, W - 1, H - 1, 12);   // the fields
  fill(48, 48, 207, 207, 0);   // the wall, four cells thick - and the town inside it
  fill(52, 52, 203, 203, 12);
  for (let i = 0; i <= 150; i += 25) { fill(52 + i, 52, Math.min(54 + i, 203), 203, 15); fill(52, 52 + i, 203, Math.min(54 + i, 203), 15); }
  // the gates: a passage through the wall at the middle of each side, its middle two rows the gate's own footprint
  const passages = { s: [126, 48, 130, 51], n: [126, 204, 130, 207], w: [48, 126, 51, 130], e: [204, 126, 207, 130] };
  for (const [x0, y0, x1, y1] of Object.values(passages)) fill(x0, y0, x1, y1, 15);
  fill(124, 49, 132, 50, 0); fill(124, 205, 132, 206, 0); fill(49, 124, 50, 132, 0); fill(205, 124, 206, 132, 0);
  const buildings = [], doors = [];
  const trades = [BUILDING_TYPES.Tavern, BUILDING_TYPES.Temple, BUILDING_TYPES.GeneralStore, BUILDING_TYPES.Armorer, BUILDING_TYPES.WeaponSmith,
    BUILDING_TYPES.Alchemist, BUILDING_TYPES.GuildHall, BUILDING_TYPES.Palace, BUILDING_TYPES.Bank];
  let key = 1000, i = 0;
  for (let by = 0; by < 6; by++) for (let bx = 0; bx < 6; bx++) {
    const ox = 52 + bx * 25, oy = 52 + by * 25;
    const type = i < trades.length ? trades[i] : BUILDING_TYPES.House1 + (i % 4);
    // a palace in grounds of its own: a smaller house in them, walled about farther off than a door's reach (places.js
    // DOOR_REACH_M, DOOR_RING) - its door finds the grounds alone
    const [x0, y0, side] = walledPalace && type === BUILDING_TYPES.Palace ? [ox + 9, oy + 9, 6] : [ox + 7, oy + 7, 12];
    if (side === 6) { fill(ox + 4, oy + 4, ox + 19, oy + 19, 0); fill(ox + 5, oy + 5, ox + 18, oy + 18, 12); }
    fill(x0, y0, x0 + side - 1, y0 + side - 1, 0);
    buildings.push({ key, type, quality: 10 + (i % 8), factionId: 0 });
    doors.push({ key, x: (x0 + side / 2) * NAV_CELL, z: y0 * NAV_CELL, nx: 0, nz: -1 });
    key++; i++;
  }
  const farmhouse = 2000;
  fill(10, 10, 19, 17, 0);
  buildings.push({ key: farmhouse, type: BUILDING_TYPES.House1, quality: 8, factionId: 0 });
  doors.push({ key: farmhouse, x: 15 * NAV_CELL, z: 18 * NAV_CELL, nx: 0, nz: 1 });
  return { nav, buildings, doors, farmhouse, box: [52, 52, 203, 203], passages };
}

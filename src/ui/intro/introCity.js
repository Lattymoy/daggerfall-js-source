// @ts-check
// INTRO4 (2026-10-26, the owner: "Utilize the imperial city we have built for this"; bible/10-UI/UI-Arc.md INTRO4) - THE
// IMPERIAL CITY, AS THE FILM DRAWS IT. Everything here is the city TESA built (world/imperialCity.js, its canon wheel on
// City Isle in Lake Rumare at TS5's seven pixels; world/capitalImperial.js, its landmarks): the White-Gold Tower, the
// palace wall and the emperors' tombs, the city wall and its watch towers, the walls between the districts, the
// Colosseum, the Temple of the One, Talos's dragon, the Nine Divines, the Prison, the Arcane University, the Waterfront
// and Talos Bridge - their own meshes, built by their own builders. What the film cannot have is Daggerfall's city
// blocks (BLOCKS.BSA is the player's, and the front door runs before the picker), so where the plan
// (IMPERIAL_CITY_PLAN) lays one of Daggerfall's blocks by its trade, the film stands houses of that trade's size on that
// cell; where it lays a garden, trees. The ground is the city's own tile law (imperialTile) and its trees its own
// (imperialTree). Pure: built in the intro's worker (introBuildWorker.js), or here on a page without one.
import { IMPERIAL, IMPERIAL_CELLS, IMPERIAL_CITY_PLAN, imperialDistrictAt, imperialTile, imperialTree } from '../../world/imperialCity.js';
import {
  buildImperialTower, buildPalaceWall, buildEmperorsTombs, buildCityWall, buildDistrictWalls, buildColosseum, buildTempleOfTheOne,
  buildTalosStatue, buildNineDivines, buildImperialPrison, buildArcaneUniversity, buildWaterfront, buildTalosBridge,
} from '../../world/capitalImperial.js';
import { BLOCK_M, hash32 } from '../../world/spawnedDungeons.js';

/** The landmarks, in the order the film's mesh carries them. */
export const INTRO_LANDMARKS = Object.freeze([
  buildImperialTower, buildPalaceWall, buildEmperorsTombs, buildCityWall, buildDistrictWalls, buildColosseum, buildTempleOfTheOne,
  buildTalosStatue, buildNineDivines, buildImperialPrison, buildArcaneUniversity, buildWaterfront, buildTalosBridge,
]);

/** The film's salt for its own picks (houses, the woods past the lake). */
const SALT = 0x1a74;
const rand = (a, b, c) => hash32(SALT, a | 0, b | 0, c | 0) / 4294967296;

/** Every landmark merged into one mesh: positions and normals (metres, x east, y up, z south - the city's own frame,
 *  its middle on its ground), uvs, and each vertex's material - its picture's record (world/capitalShapes.js
 *  CAPITAL_ART), which the film's shader paints as that material. */
export function buildIntroLandmarks(builders = INTRO_LANDMARKS) {
  const meshes = builders.map((b) => b());
  let nv = 0, ni = 0;
  for (const m of meshes) { nv += m.positions.length / 3; ni += m.indices.length; }
  const positions = new Float32Array(nv * 3), normals = new Float32Array(nv * 3), uvs = new Float32Array(nv * 2), material = new Uint8Array(nv), indices = new Uint32Array(ni);
  let v = 0, i = 0;
  for (const m of meshes) {
    positions.set(m.positions, v * 3); normals.set(m.normals, v * 3); uvs.set(m.uvs, v * 2);
    for (const s of m.subMeshes) {
      for (let k = 0; k < s.primitiveCount * 3; k++) {
        const vi = m.indices[s.startIndex + k];
        indices[i + s.startIndex + k] = vi + v;
        material[v + vi] = s.textureRecord;
      }
    }
    v += m.positions.length / 3; i += m.indices.length;
  }
  return { positions, normals, uvs, material, indices };
}

/** EACH DISTRICT'S STONE AND ROOFS - the walls' colour and the roof's (an index into ROOFS). */
export const DISTRICT_LOOK = Object.freeze({
  'Market District': [[182, 162, 134], 0],
  'Arena District': [[198, 172, 128], 0],
  'Temple District': [[214, 208, 196], 1],
  'Talos Plaza District': [[166, 160, 150], 2],
  'Elven Gardens District': [[200, 200, 186], 3],
  'Waterfront District': [[152, 130, 102], 4],
  'Arcane University': [[192, 188, 204], 5],
  'City Isle': [[172, 162, 142], 4],
});
/** A cell no district names (the isle outside the walls). */
const ISLE_LOOK = Object.freeze([[172, 162, 142], 4]);
/** The roofs: terracotta, blue slate, dark slate, verdigris, weathered shingle, the University's slate. */
export const ROOFS = Object.freeze([[150, 74, 50], [72, 88, 108], [62, 68, 80], [86, 128, 110], [96, 82, 68], [60, 74, 116]]);
/** A building's shape. */
export const ROOF_GABLE = 0, ROOF_PYRAMID = 1, ROOF_FLAT = 2;

/** Floats a building carries: (x, z, w, d), (h, roof h, turned, seed), (wall r, g, b, roof index, roof kind, kind). */
export const BUILDING_FLOATS = 14;
/** The kinds of house the film stands: a house, a shop or tavern, a hall (a temple, a guild, a bank), a tower. */
export const HOUSE = 0, SHOP = 1, HALL = 2, TOWER = 3;
/** Each of Daggerfall's block kinds as the houses the film stands for it - its great building (none for a street of
 *  houses) and how tall its houses run. */
const TRADE = Object.freeze({
  RESI: { great: null, tall: [7, 12] },
  GENR: { great: [SHOP, 26, 20, 13], tall: [8, 13] },
  ARMR: { great: [SHOP, 24, 18, 12], tall: [8, 12] },
  ALCH: { great: [SHOP, 20, 16, 12], tall: [8, 12] },
  GEMS: { great: [SHOP, 18, 16, 12], tall: [8, 12] },
  BOOK: { great: [SHOP, 20, 16, 13], tall: [8, 12] },
  PAWN: { great: [SHOP, 18, 16, 11], tall: [7, 11] },
  TVRN: { great: [SHOP, 28, 20, 14], tall: [8, 13] },
  BANK: { great: [HALL, 32, 30, 16], tall: [9, 13] },
  TEMP: { great: [HALL, 26, 46, 19], tall: [8, 12] },
  LIBR: { great: [HALL, 30, 24, 16], tall: [8, 13] },
  FIGH: { great: [HALL, 30, 28, 15], tall: [8, 12] },
  MAGE: { great: [TOWER, 15, 15, 44], tall: [9, 14] },
  THIE: { great: [SHOP, 22, 18, 11], tall: [7, 10] },
});

/** The plan's cell (row, column) in the city's metres: its north-west corner. */
const cellCorner = (r, c) => [(c - IMPERIAL_CELLS / 2) * BLOCK_M, (r - IMPERIAL_CELLS / 2) * BLOCK_M];

/**
 * THE HOUSES on every cell the plan gives one of Daggerfall's blocks: the cell's streets round its edge, its lots in a
 * grid, the trade's great building on the first lot and houses on the rest, each a little turned off its lot, a yard
 * left open here and there; a garden cell is trees. Answers { buildings: Float32Array (BUILDING_FLOATS each), count,
 * gardens: [x, z][] } - deterministic in the plan.
 */
export function buildIntroDistricts(plan = IMPERIAL_CITY_PLAN) {
  const out = [], gardens = [];
  const push = (x, z, w, d, h, roofH, turned, seed, look, roofKind, kind) => {
    // a roof in four of the district's own, the rest weathered shingle or slate
    const roof = seed < 0.18 ? 4 : seed > 0.9 ? 2 : look[1];
    out.push(x, z, w, d, h, roofH, turned, seed, look[0][0] / 255, look[0][1] / 255, look[0][2] / 255, roof, roofKind, kind);
  };
  for (let r = 0; r < plan.length; r++) for (let c = 0; c < plan[r].length; c++) {
    const cell = plan[r][c];
    if (cell === 'L' || cell === 'O' || /^I/.test(cell)) continue;
    const [x0, z0] = cellCorner(r, c);
    if (cell === 'G') { gardens.push([x0, z0]); continue; }
    const trade = TRADE[cell] ?? TRADE.RESI;
    const look = DISTRICT_LOOK[imperialDistrictAt(x0 + BLOCK_M / 2, z0 + BLOCK_M / 2) ?? ''] ?? ISLE_LOOK;
    const street = 6, inner = BLOCK_M - street * 2, n = 3, lot = inner / n;
    for (let ly = 0; ly < n; ly++) for (let lx = 0; lx < n; lx++) {
      const k = ly * n + lx, seed = rand(r * 64 + c, k, 1);
      const cx = x0 + street + (lx + 0.5) * lot, cz = z0 + street + (ly + 0.5) * lot;
      if (k === 0 && trade.great) {
        const [kind, gw, gd, gh] = trade.great;
        // the great building stands across its corner of the cell, turned to its longer street
        const gx = x0 + street + Math.min(gw, inner) / 2 + 2, gz = z0 + street + Math.min(gd, inner) / 2 + 2;
        const roofKind = kind === TOWER ? ROOF_PYRAMID : kind === HALL && cell === 'BANK' ? ROOF_FLAT : ROOF_GABLE;
        push(gx, gz, gw, gd, gh, kind === TOWER ? gw * 1.1 : Math.min(gw, gd) * 0.42, 0, seed, look, roofKind, kind);
        if (cell === 'TEMP') push(gx + gw / 2 + 5, gz - gd / 2 + 6, 9, 9, 34, 11, 0, rand(r, c, 7), look, ROOF_PYRAMID, TOWER);   // its bell tower
        continue;
      }
      if (trade.great && trade.great[1] > lot && ((lx <= 1 && ly <= 1) || (trade.great[2] > lot * 1.6 && lx <= 1 && ly <= 2))) continue;   // under the great one
      if (seed < 0.1) continue;   // a yard
      const w = lot * (0.55 + rand(r, c, k * 3) * 0.32), d = lot * (0.55 + rand(r, c, k * 3 + 1) * 0.32);
      const h = trade.tall[0] + rand(r, c, k * 5) * (trade.tall[1] - trade.tall[0]);
      const jx = (rand(r, c, k * 7) - 0.5) * (lot - w) * 0.8, jz = (rand(r, c, k * 7 + 1) - 0.5) * (lot - d) * 0.8;
      const turned = rand(r, c, k * 11) < 0.5 ? 0 : 1;
      push(cx + jx, cz + jz, w, d, h, Math.min(w, d) * (0.32 + rand(r, c, k * 13) * 0.14), turned, seed, look, ROOF_GABLE, seed < 0.35 ? SHOP : HOUSE);
    }
  }
  return { buildings: new Float32Array(out), count: out.length / BUILDING_FLOATS, gardens };
}

/** Floats a tree carries: x, z, height, seed. */
export const TREE_FLOATS = 4;
/** How far past the city the film's woods are stood as trees (metres from the middle) - farther, the ground's colour. */
export const WOODS_REACH = 4600;

/**
 * THE TREES: the city's own (imperialTree on every one of its tiles - Green Emperor Way's lawns, the Arboretum, the isle),
 * a garden cell's, and the woods on the land past Lake Rumare out to WOODS_REACH, in groves. Float32Array of
 * TREE_FLOATS each.
 */
export function buildIntroTrees(gardens = buildIntroDistricts().gardens, I = IMPERIAL) {
  const out = [], TILE = 6.4;
  const R = I.isle + 20;
  for (let z = -R; z < R; z += TILE) for (let x = -R; x < R; x += TILE) {
    if (x * x + z * z > R * R) continue;
    const cx = x + TILE / 2, cz = z + TILE / 2;
    if (imperialTree(cx, cz, I) < 0) continue;
    const s = rand(cx * 10, cz * 10, 3);
    out.push(cx + (s - 0.5) * 3, cz + (rand(cx, cz, 4) - 0.5) * 3, 9 + s * 9, s);
  }
  for (const [x0, z0] of gardens) for (let k = 0; k < 9; k++) {
    const s = rand(x0, z0, k);
    out.push(x0 + 10 + rand(x0, z0, k + 20) * (BLOCK_M - 20), z0 + 10 + rand(x0, z0, k + 40) * (BLOCK_M - 20), 10 + s * 8, s);
  }
  // the woods: groves on the land past the lake, thinning with distance
  const step = 34;
  for (let z = -WOODS_REACH; z < WOODS_REACH; z += step) for (let x = -WOODS_REACH; x < WOODS_REACH; x += step) {
    const rr = Math.hypot(x, z);
    if (rr < I.lake + 40 || rr > WOODS_REACH) continue;
    const grove = Math.sin(x * 0.0021 + 1.3) * Math.sin(z * 0.0017 - 0.4) + Math.sin((x + z) * 0.0009) * 0.6;
    const keep = grove > 0.15 ? 0.85 : 0.08;
    const s = rand(x, z, 9);
    if (s > keep * (1 - (rr - I.lake) / (WOODS_REACH - I.lake) * 0.5)) continue;
    out.push(x + (rand(x, z, 10) - 0.5) * step, z + (rand(x, z, 11) - 0.5) * step, 12 + s * 14, s);
  }
  return new Float32Array(out);
}

/** The city's ground as a picture: GROUND_TEXELS a side over GROUND_SPAN metres, each texel the city's own tile there
 *  (imperialTile: 0 water, 1 sand, 2 grass, 3 stone; the land past the lake 4). */
export const GROUND_SPAN = 6000;
export const GROUND_TEXELS = 750;
export function buildIntroGround(I = IMPERIAL) {
  const out = new Uint8Array(GROUND_TEXELS * GROUND_TEXELS), m = GROUND_SPAN / GROUND_TEXELS;
  for (let y = 0; y < GROUND_TEXELS; y++) for (let x = 0; x < GROUND_TEXELS; x++) {
    const wx = (x + 0.5) * m - GROUND_SPAN / 2, wz = (y + 0.5) * m - GROUND_SPAN / 2;
    const t = imperialTile(wx, wz, I);
    out[y * GROUND_TEXELS + x] = t > 3 ? 4 : t;
  }
  return out;
}

/** The plan as a picture, a texel a cell: 0 the lake, 1 the land past it, 2 a cell of the city's own, 3 one of
 *  Daggerfall's blocks (the film's houses), 4 a garden. */
export function buildIntroPlan(plan = IMPERIAL_CITY_PLAN) {
  const out = new Uint8Array(IMPERIAL_CELLS * IMPERIAL_CELLS);
  for (let r = 0; r < IMPERIAL_CELLS; r++) for (let c = 0; c < IMPERIAL_CELLS; c++) {
    const cell = plan[r][c];
    out[r * IMPERIAL_CELLS + c] = cell === 'L' ? 0 : cell === 'O' ? 1 : /^I/.test(cell) ? 2 : cell === 'G' ? 4 : 3;
  }
  return out;
}

/** The whole city for the film, every array transferable, with the layout its renderer reads (so the page's own
 *  thread need not load the city's modules to draw what the worker built). */
export function buildIntroCity() {
  const districts = buildIntroDistricts();
  return {
    landmarks: buildIntroLandmarks(),
    buildings: districts.buildings, buildingCount: districts.count,
    trees: buildIntroTrees(districts.gardens),
    ground: buildIntroGround(),
    plan: buildIntroPlan(),
    layout: { buildingFloats: BUILDING_FLOATS, treeFloats: TREE_FLOATS, groundSpan: GROUND_SPAN, cells: IMPERIAL_CELLS, cellM: BLOCK_M, roofs: ROOFS.map((c) => [...c]) },
  };
}

/** Every buffer of a built city - what the worker transfers instead of copying. */
export function introCityTransfers(city) {
  const L = city.landmarks;
  return [L.positions.buffer, L.normals.buffer, L.uvs.buffer, L.material.buffer, L.indices.buffer, city.buildings.buffer, city.trees.buffer, city.ground.buffer, city.plan.buffer];
}

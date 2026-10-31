// @ts-check
// IC-PROPS (2026-10-27, the owner: "Random placements on the wagon/other vendors all over the Imperial city", then "the
// issues I mentioned for the imperial city for stables/doors/etc are a world wide issue. They have no logical placements";
// bible/03-World/Arena-Provinces.md IC-PROPS, bible/03-World/Merchant-Yards.md IC-PROPS) - THE IMPERIAL CITY'S YARDS, AT
// ITS GATES.
//
// Every one of the city's 625 slices is a city of Daggerfall's kind (world/tamrielCapitals.js synthesizeCapitalLocation -
// a TownCity, its own location), and every city stands its Stable, its Wagon Yard and its joinery: so a slice's yards
// stood wherever its own small grid left room - measured on every thirteenth slice, 109 yards on 37 of 49 (some 1,400
// over the city): on the open land of Rumare Shore past the lake, all over City Isle, on the Palace District's lawns, in
// the Arboretum's park, across the avenues and in the lake's shallows. The city is ONE town (WW7-11: its centre slice's,
// scenes/livingWorld/livingIndex.js capitalStreet), and a town's Stable stands at its edge by a road or a gate
// (world/merchantYards/merchantYardSites.js IC-PROPS). So the city names its own yards and no slice of it places any by
// the law: one Stable, one Wagon Yard and one joinery outside each district's gate in the city wall (each grand avenue's,
// IMPERIAL_YARD_GATES - where a district's way leaves the city), on City Isle's own grass beside the way out
// (IMPERIAL_YARD_LANE kept clear of every yard), clear of the wall and its towers (IMPERIAL_YARD_WALL), of the isle's
// trees, its water and every landmark, each wholly in one slice, its front onto the way, the Stable nearest the gate,
// then the Wagon Yard, then the joinery on what is left (YARD_GAP_M apart). Eighteen in all; a slice whose ground holds
// none of them stands none.
//
// THE GROUND IS THE BLOCKS' OWN, asked as they are built (world/imperialBlocks.js imperialOwnLaws through imperialAnchorOf,
// at world/tamrielCapitals.js's tile and automap middles - portBlockJson's): a cell open where its automap byte is, on its
// tile's grass; and each of the isle's trees where the town stands it - Daggerfall's ground scenery at its tile's
// north-west corner (world/rmbFlats.js collectBlockFlats; DFU's RMB nature flat), its cells closed as the yards' ground
// closes a flat's (merchantYardSites.js yardGround, FLAT_CLEAR_M) - so every yard named here stands on the ground the host
// places it on (merchantYardSites.js fixedSite: a site over a closed cell stands none; one did, at the Elven Gardens' gate,
// under a tree the old reading set a tile off).
//
// Pure: the city's own laws (world/imperialCity.js, world/imperialBlocks.js imperialOwnLaws - the laws its blocks are built
// from) and the yards' measures (merchantYardSites.js). Not a DFU member: the port's own (Port-Ledger A, MERCHANT-YARDS).
import {
  IMPERIAL,
  IMPERIAL_SECTORS,
  IMPERIAL_SPAN,
  IMPERIAL_CELLS,
  polar,
  imperialLand,
  imperialDistrictAt,
} from './imperialCity.js';
import { imperialOwnLaws, imperialAnchorOf } from './imperialBlocks.js';
import { tileCentre, autoCentre } from './tamrielCapitals.js';
import { BLOCK_M } from './blockHash.js';
import { NAV_CELL } from './city/cityNavigation.js';
import {
  YARD_TURNS,
  YARD_PAD_M,
  YARD_GAP_M,
  FRONT_ROAD_CELLS,
  FLAT_CLEAR_M,
  yardSpans,
  summed,
} from './merchantYards/merchantYardSites.js';

/** The gates the city's yards stand by - each district's grand avenue's gate in the city wall (bearings). */
export const IMPERIAL_YARD_GATES = Object.freeze(IMPERIAL_SECTORS.map(([, b]) => b + 30));
/** The way out from a gate kept clear of every yard: half the avenue's width and a margin either side of its line, metres. */
export const IMPERIAL_YARD_LANE = IMPERIAL.avenue.w / 2 + 4;
/** How near the city's middle a yard's ground comes: the city wall's outer face, its towers' reach and a margin. */
export const IMPERIAL_YARD_WALL = IMPERIAL.cityWall.r + IMPERIAL.cityWall.thick / 2 + IMPERIAL.cityWall.towerR + 6;
/** How far from its gate a yard's middle stands at the most, metres. */
export const IMPERIAL_YARD_REACH = 120;
/** The order the yards are placed in at a gate. */
const KINDS = Object.freeze(['stable', 'transport', 'carpenter']);

const HALF = IMPERIAL_CELLS / 2,
  B = BLOCK_M,
  SLICE_CELLS = Math.round((8 * B) / NAV_CELL),
  TILE_CELLS = 4;
/** A cell's middle (global cells: X east from the city's west edge, Z north from its south edge) in the city's metres
 *  (x east, z south). */
const cellAt = (X, Z) => [(X + 0.5) * NAV_CELL - HALF * B, HALF * B - (Z + 0.5) * NAV_CELL];

/** The yards each gate stands, worked the first time a slice near it is built (or all asked). @type {Map<number, ReadonlyArray<any>>} */
const _gates = new Map();
/**
 * THE CITY'S YARDS: each `{ kind, gate, s, turn, yaw, gx, gy, nx, nz, x, z, at }` - its gate's bearing, its slice, its turn
 * and its cells on the slice's own grid (x east, z north from the slice's south-west - the walkers' grid,
 * merchantYardSites.js's), its middle in the slice's frame (x, z) and in the city's metres (`at`). Pure.
 */
export const imperialYardSites = () => IMPERIAL_YARD_GATES.flatMap((b) => gateYards(b));
/** A gate's foot outside the wall, the city's metres. @param {number} b */
const gateFoot = (b) => polar(b, IMPERIAL_YARD_WALL);
/** A global cell's block (r its row from the north, c its column) and its place in it (ax, ay: the automap's - ay from the
 *  north). @param {number} X @param {number} Z */
const blockCellOf = (X, Z) => ({
  r: IMPERIAL_CELLS - 1 - Math.floor(Z / 64),
  c: Math.floor(X / 64),
  ax: X & 63,
  ay: 63 - (Z & 63),
});
/** One gate's yards (imperialYardSites' rows), worked once: the ground about its foot read cell by cell as its blocks are
 *  built (the header's THE GROUND: the isle's open grass, the way out, the isle's trees' feet), then each kind nearest the
 *  foot first, every place measured over summed tables (merchantYardSites.js summed). @param {number} b */
function gateYards(b) {
  if (_gates.has(b)) return /** @type {any[]} */ (_gates.get(b));
  const out = [];
  const pad = Math.ceil(YARD_PAD_M / NAV_CELL - 1e-9),
    gap = Math.ceil(YARD_GAP_M / NAV_CELL - 1e-9);
  const reach = Math.ceil(IMPERIAL_YARD_REACH / NAV_CELL),
    span = 12; // a yard's longest side, cells
  const [ux, uz] = polar(b, 1),
    [gx0, gz0] = gateFoot(b);
  const GX = Math.floor((gx0 + HALF * B) / NAV_CELL),
    GZ = Math.floor((HALF * B - gz0) / NAV_CELL);
  // the window: every cell a yard or its ring within reach can stand on
  const R = reach + span + pad + 2,
    W = 2 * R + 1,
    X0 = GX - R,
    Z0 = GZ - R;
  /** A point's place against the gate's way: along it from the gate's foot outward, and across it. */
  const along = (x, z) => (x - gx0) * ux + (z - gz0) * uz,
    across = (x, z) => Math.abs((x - gx0) * -uz + (z - gz0) * ux);
  const innerBad = new Uint8Array(W * W),
    ringBad = new Uint8Array(W * W),
    taken = new Uint8Array(W * W),
    tree = new Uint8Array(W * W);
  /** @type {Map<number, any>} */
  const lawsOf = new Map(),
    tiles = new Map();
  const laws = (r, c) => {
    const k = r * IMPERIAL_CELLS + c;
    let L = lawsOf.get(k);
    if (!L) lawsOf.set(k, (L = imperialOwnLaws(r, c)));
    return L;
  };
  /** A block tile's [record, tree] - its laws at its middle, as portBlockJson asks them. */
  const tileOf = (r, c, tx, ty) => {
    const k = ((r * IMPERIAL_CELLS + c) * 16 + ty) * 16 + tx;
    let t = tiles.get(k);
    if (!t) {
      const L = laws(r, c),
        p = imperialAnchorOf(r, c, ...tileCentre(tx, ty));
      tiles.set(k, (t = [L.tile(...p), L.tree(...p)]));
    }
    return t;
  };
  // the trees' feet: each tile of the window's blocks (and a tile past) whose law stands a tree closes the cells round its
  // north-west corner a flat's reach (yardGround's closeDisc: a cell whose middle is within FLAT_CLEAR_M and half a cell)
  const reach2 = ((FLAT_CLEAR_M + NAV_CELL / 2) / NAV_CELL) ** 2;
  for (let TZ = Math.floor(Z0 / TILE_CELLS) - 1; TZ <= Math.floor((Z0 + W) / TILE_CELLS) + 1; TZ++) {
    for (let TX = Math.floor(X0 / TILE_CELLS) - 1; TX <= Math.floor((X0 + W) / TILE_CELLS) + 1; TX++) {
      const { r, c, ax, ay } = blockCellOf(TX * TILE_CELLS, TZ * TILE_CELLS);
      if (tileOf(r, c, ax >> 2, ay >> 2)[1] < 0) continue;
      const FX = TX * TILE_CELLS,
        FZ = TZ * TILE_CELLS + TILE_CELLS; // the foot: the tile's north-west corner, in cells
      for (let Z = FZ - 2; Z < FZ + 2; Z++)
        for (let X = FX - 2; X < FX + 2; X++) {
          const i = X - X0,
            j = Z - Z0;
          if (i >= 0 && j >= 0 && i < W && j < W && (X + 0.5 - FX) ** 2 + (Z + 0.5 - FZ) ** 2 <= reach2)
            tree[j * W + i] = 1;
        }
    }
  }
  for (let j = 0; j < W; j++) {
    for (let i = 0; i < W; i++) {
      const X = X0 + i,
        Z = Z0 + j,
        x = (X + 0.5) * NAV_CELL - HALF * B,
        z = HALF * B - (Z + 0.5) * NAV_CELL;
      if ((X - GX) ** 2 + (Z - GZ) ** 2 > R * R) {
        innerBad[j * W + i] = ringBad[j * W + i] = 1;
        continue;
      } // past any yard's reach
      // the isle's open grass past the wall: its block's automap open there and its tile grass (imperialOwnLaws, asked as
      // the block is built), on the isle's land
      const { r, c, ax, ay } = blockCellOf(X, Z);
      const ground =
        Math.hypot(x, z) >= IMPERIAL_YARD_WALL &&
        imperialLand(x, z) &&
        imperialDistrictAt(x, z) === 'City Isle' &&
        tileOf(r, c, ax >> 2, ay >> 2)[0] === 2 &&
        !laws(r, c).closed(...imperialAnchorOf(r, c, ...autoCentre(ax, ay)));
      const onWay = along(x, z) > -IMPERIAL_YARD_LANE && across(x, z) < IMPERIAL_YARD_LANE;
      const t = tree[j * W + i] === 1;
      innerBad[j * W + i] = !ground || onWay || t ? 1 : 0;
      ringBad[j * W + i] = (!ground && !onWay) || t ? 1 : 0;
    }
  }
  const sumIn = summed(W, W, (i, j) => innerBad[j * W + i]),
    sumRing = summed(W, W, (i, j) => ringBad[j * W + i]);
  for (const kind of KINDS) {
    const sumTaken = summed(W, W, (i, j) => taken[j * W + i]);
    let best = null;
    for (let turn = 0; turn < 4; turn++) {
      const [nx, nz] = yardSpans(kind, turn);
      // the places nearest the gate first (its middle's distance, half-cells squared - exact; then the lower row and
      // column): the first that fits is this turn's
      for (const [dx, dz, d2] of offsetsOf(nx, nz, reach)) {
        if (best && d2 > best.d2) break;
        const X = GX + dx,
          Z = GZ + dz,
          i = X - X0,
          j = Z - Z0;
        const sx = Math.floor((X - pad) / SLICE_CELLS),
          sz = Math.floor((Z - pad) / SLICE_CELLS);
        if (Math.floor((X + nx + pad - 1) / SLICE_CELLS) !== sx || Math.floor((Z + nz + pad - 1) / SLICE_CELLS) !== sz)
          continue;
        // its front onto the way: the front strip's middle nearer the way's line than its own middle, the yard within the
        // strip's reach of the way's edge
        const f = FRONT_ROAD_CELLS,
          fx = turn === 1 ? X + nx + f / 2 : turn === 3 ? X - f / 2 : X + nx / 2,
          fz = turn === 0 ? Z + nz + f / 2 : turn === 2 ? Z - f / 2 : Z + nz / 2;
        const mxm = (X + nx / 2) * NAV_CELL - HALF * B,
          mzm = HALF * B - (Z + nz / 2) * NAV_CELL;
        const a = across(mxm, mzm),
          af = across(fx * NAV_CELL - HALF * B, HALF * B - fz * NAV_CELL);
        if (!(af < a) || a - (Math.max(nx, nz) * NAV_CELL) / 2 > IMPERIAL_YARD_LANE + (f + 1) * NAV_CELL) continue;
        if (
          sumIn(i, j, i + nx, j + nz) !== 0 ||
          sumRing(i - pad, j - pad, i + nx + pad, j + nz + pad) !== 0 ||
          sumTaken(i - pad, j - pad, i + nx + pad, j + nz + pad) !== 0
        )
          continue;
        if (
          !best ||
          d2 < best.d2 ||
          (d2 === best.d2 && (Z < best.Z || (Z === best.Z && (X < best.X || (X === best.X && turn < best.turn)))))
        )
          best = { X, Z, nx, nz, turn, d2, sx, sz };
        break;
      }
    }
    if (!best) continue;
    for (let Z = best.Z - gap; Z < best.Z + best.nz + gap; Z++)
      for (let X = best.X - gap; X < best.X + best.nx + gap; X++) taken[(Z - Z0) * W + (X - X0)] = 1;
    const sy = IMPERIAL_SPAN - 1 - best.sz,
      s = sy * IMPERIAL_SPAN + best.sx;
    const gxs = best.X - best.sx * SLICE_CELLS,
      gys = best.Z - best.sz * SLICE_CELLS;
    out.push(
      Object.freeze({
        kind,
        gate: b,
        s,
        turn: best.turn,
        yaw: YARD_TURNS[best.turn],
        gx: gxs,
        gy: gys,
        nx: best.nx,
        nz: best.nz,
        x: (gxs + best.nx / 2) * NAV_CELL,
        z: (gys + best.nz / 2) * NAV_CELL,
        at: Object.freeze(cellAt(best.X + best.nx / 2 - 0.5, best.Z + best.nz / 2 - 0.5)),
      }),
    );
  }
  const frozen = Object.freeze(out);
  _gates.set(b, frozen);
  return frozen;
}
const _offsets = new Map();
/** Every place's offset from the gate's cell within `reach`, nearest first - [dx, dz, d2] (d2 its middle's distance in
 *  half-cells, squared), ties to the lower row, then the lower column. Kept a shape. */
function offsetsOf(nx, nz, reach) {
  const key = `${nx},${nz},${reach}`;
  let list = _offsets.get(key);
  if (!list) {
    list = [];
    for (let dz = -reach; dz <= reach; dz++)
      for (let dx = -reach; dx <= reach; dx++) {
        const d2 = (2 * dx + nx - 1) ** 2 + (2 * dz + nz - 1) ** 2;
        if (d2 <= 4 * reach * reach) list.push([dx, dz, d2]);
      }
    list.sort((a, b) => a[2] - b[2] || a[1] - b[1] || a[0] - b[0]);
    _offsets.set(key, list);
  }
  return list;
}
/** THE YARDS A SLICE OF THE CITY STANDS: its share of imperialYardSites - none for most, and no gate's worked but one
 *  whose yards could reach it (its foot within IMPERIAL_YARD_REACH and a yard's size of the slice's square). @param {number} s */
export function imperialSliceYards(s) {
  if (!(s >= 0 && s < IMPERIAL_SPAN * IMPERIAL_SPAN)) return [];
  const S = 8 * B,
    x0 = (s % IMPERIAL_SPAN) * S - HALF * B,
    z0 = Math.floor(s / IMPERIAL_SPAN) * S - HALF * B,
    m = IMPERIAL_YARD_REACH + 20;
  const near = IMPERIAL_YARD_GATES.filter((b) => {
    const [x, z] = gateFoot(b);
    return x > x0 - m && x < x0 + S + m && z > z0 - m && z < z0 + S + m;
  });
  return near.flatMap((b) => gateYards(b)).filter((t) => t.s === s);
}
/** Test seam. */
export function _resetImperialYards() {
  _gates.clear();
}

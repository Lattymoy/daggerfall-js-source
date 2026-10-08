// @ts-check
// GOTHWAY-BOARDS (2026-10-08, the owner: "is it possible to put a bounty board on each site of gothway gardens so newbies
// have a direction!", then: "place them to the north on the border of the town so new player coming from privateers hold
// can see them"): Gothway Garden - the first town a new character walks into out of Privateer's Hold - stands two bounty
// boards at its NORTH ENTRANCE, one on each side of the road in. Both post the town's bounties (scenes/world.js
// boardSplitOf counts them as bounty boards always). Pure: the town's walk grid in, the two spots out - the same on every
// client, so every player sees the same boards.

export const GOTHWAY_RE = /^gothway garden$/i;
export const isGothwayGarden = (name) => GOTHWAY_RE.test(String(name ?? '').trim());

// ── GOTHWAY-NORTH (2026-10-08, the owner: "place them to the north on the border of the town so new player coming from
// privateers hold can see them") ───────────────────────────────────────────────────────────────────────────────────────
// The boards stand at the town's NORTH ENTRANCE - where the road from Privateer's Hold comes in - one on each side of the
// road, a few paces inside the border, facing north at whoever arrives. The road is found, not guessed: the town's own
// walk grid (world/cityNavigation.js - its people walk the same cells; a road cell weighs ROAD_WEIGHT, a building's 0) is
// read along the band of rows at its north edge, and the run of road nearest the town's middle is the way in.
export const ROAD_WEIGHT = 15;
/** How far in from the north border the boards stand, and how far beside the road's edge (metres). */
export const NORTH_IN_M = 5;
export const NORTH_ASIDE_M = 1.5;
/**
 * The two boards at the north entrance: `[{ x, z, yawDeg, side }]` in the LOCATION frame (x east, z north, metres), or
 * null when the edge has no way in. `weightAt(gx, gy)` the grid's weight (0 blocked), `w`/`h` its size, `cell` its size in
 * metres; north is the grid's last rows.
 */
export function gothwayNorthSpots(weightAt, w, h, cell) {
  const band = Math.max(2, Math.round(8 / cell));   // the rows a road crosses the border through
  const runs = (want) => {
    const out = [];
    let start = -1;
    for (let gx = 0; gx <= w; gx++) {
      let ok = false;
      if (gx < w) for (let k = 0; k < band; k++) { const wt = weightAt(gx, h - 1 - k); if (want(wt)) { ok = true; break; } }
      if (ok && start < 0) start = gx;
      if (!ok && start >= 0) { out.push([start, gx - 1]); start = -1; }
    }
    return out;
  };
  let found = runs((wt) => wt >= ROAD_WEIGHT).filter(([a, b]) => b - a + 1 >= 2);
  if (!found.length) found = runs((wt) => wt > 0).filter(([a, b]) => b - a + 1 >= 3);   // no paved road: the widest open way in
  if (!found.length) return null;
  const mid = (w - 1) / 2;
  found.sort((p, q) => Math.abs((p[0] + p[1]) / 2 - mid) - Math.abs((q[0] + q[1]) / 2 - mid));
  const [a, b] = found[0];
  const z = h * cell - NORTH_IN_M;
  const spot = (gx, side) => {
    // a step further out when the cell beside the road is built on (a board never inside a wall)
    let x = gx * cell + cell / 2;
    const gz = Math.min(h - 1, Math.floor(z / cell));
    for (let k = 0; k < 6 && weightAt(Math.floor(x / cell), gz) === 0; k++) x += side === 'west' ? cell : -cell;
    return { x, z, yawDeg: 0, side };
  };
  const aside = Math.max(1, Math.round(NORTH_ASIDE_M / cell));
  return [spot(a - aside, 'west'), spot(b + aside, 'east')];
}

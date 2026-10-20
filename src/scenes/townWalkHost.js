// OW-TOWN-WALK (2026-10-19, the owner: "When in a town, slow down overworld navigation and have it navigate properly on
// town pathways instead of bumping into buildings"; bible/06-Systems/Travel-View.md OW-TOWN-WALK): THE TOWN THE
// TRAVELLER STANDS IN, AND ITS WAY - the streaming host's half of systems/travel/townWalk.js. A town's grid is the one
// its townsfolk walk (scenes/pixelBuild.js builds a CityNavigation for every populated place - DFU's seven location
// types - and keeps it on the pixel's `population`), in the LOCATION frame: from the location's origin (`locOrigin`,
// pixel-local), carried into the scene by the pixel's live translation. Travel Options speaks the world's natives, so
// this turns a native point into a grid cell and a way's cells back into natives, and answers:
//   - townKey(native): the town's pixel key where the point stands inside its grid, else null (a farm's, a temple's,
//     a tavern's, a city's - every place with townsfolk; no dungeon's ruin, no wilderness);
//   - townPace(native): the same, but only where a town's pace is the town's (AUDIT OW-REVISITED L1-4): a walled city's
//     fields - its grid runs past its walls, and every route that passed a city walked its ring there at x5 - are not;
//   - townWay(from, to): the way from `from` to the street nearest `to` (or the town's edge toward it), as natives - or
//     null; `shut` when it ends short behind a gate shut for the night (AUDIT OW-REVISITED L6-3: and only then - a way
//     the gates would not have opened is walked as far as it reaches).
// THE JOURNEY'S GRID is the town's with each OPEN city gate's passage carved through it (systems/travel/townWalk.js
// gatePassage, carveNav): the pixel's own gates (`cityGates`, DaggerfallCityGate's placements the build keeps, each its
// model open or closed as the frame's tick left it - world/city/cityGate.js), at their model's middle on the grid. Kept
// a town and its gates' state (JOURNEY_GRIDS_MAX of them), so a gate swung at dusk makes its town's grid again; one whose
// pixel was built again or let go is dropped.
// The streaming host constructs it (scenes/world.js); the other three hosts stream no pixels and walk no journey
// through a town: scenes/exterior.js (the fixed city - no Travel Options journey crosses it), scenes/worldModes.js (a
// building) and scenes/dungeonContext.js (a dungeon).
import { townWayCells, gatePassage, carveNav, componentsOf, edgePieces, snapCell } from '../systems/travel/townWalk.js';
import { worldCoordToMapPixel } from '../formats/mapsFile.js';
import { CITY_GATE_OPEN_MODEL_ID } from '../world/rmbLayout.js';

/** How many towns' journey grids are kept at once - a walled city's is a copy of its grid, and its search's scratch and
 *  its pieces' labels live as long as it does: about 8 MB at the greatest (AUDIT OW-REVISITED L1-7). */
export const JOURNEY_GRIDS_MAX = 4;

/** @param {{ built: Map<string, any>, state: any }} host */
export function createTownWalk(host) {
  const { built, state } = host;
  const grids = new Map();   // pixel key -> { base, sig, nav, shut }
  /** The town at a native point: its pixel's key, grid, origin and translation, and the point's cell - or null. */
  function townAt(n) {
    const px = worldCoordToMapPixel(n.x, n.z);
    const key = `${px.x},${px.y}`;
    const b = built.get(key);
    const nav = b?.population?.nav, o = b?.locOrigin;
    if (!nav || !o) return null;
    const t = state.pixelTranslation(px.x, px.y);
    const [sx, sz] = state.localFromWorld(n.x, n.z);
    const cell = nav.worldToNav(sx - o[0] - t[0], sz - o[2] - t[2]);
    return { key, b, nav, o, t, cell, inside: nav.inBounds(cell[0], cell[1]) };
  }
  /** The town's journey grid: its own with each open gate's passage carved through (`allOpen`: every gate's, as by day)
   *  - and whether any gate is shut. */
  function journeyGrid(town, allOpen = false) {
    const gates = (town.b.cityGates ?? []).map((g) => ({ open: allOpen || g.gate?.modelId === CITY_GATE_OPEN_MODEL_ID, local: g.local }));
    const sig = gates.map((g) => (g.open ? 1 : 0)).join('');
    const key = `${town.key}|${sig}`;
    const kept = grids.get(key);
    if (kept && kept.base === town.nav) return kept;
    const passages = gates.filter((g) => g.open && g.local).map((g) => gatePassage(town.nav, town.nav.worldToNav(g.local[12] - town.o[0], g.local[14] - town.o[2]))).filter(Boolean);
    const made = { base: town.nav, sig, nav: carveNav(town.nav, passages), shut: gates.some((g) => !g.open) };
    for (const [k, g] of grids) if (built.get(k.split('|')[0])?.population?.nav !== g.base) grids.delete(k);   // a pixel built again or let go
    grids.delete(key);
    grids.set(key, made);
    if (grids.size > JOURNEY_GRIDS_MAX) grids.delete(grids.keys().next().value);
    return made;
  }
  /** A cell of a town's grid as the world's natives (its middle). */
  function nativeOf(town, c) {
    const [lx, lz] = town.nav.navToWorld(c[0], c[1]);
    const w = state.worldCoords([lx + town.o[0] + town.t[0], 0, lz + town.o[2] + town.t[2]]);
    return { x: w.x, z: w.z };
  }
  return {
    /** How many journey grids are kept (JOURNEY_GRIDS_MAX at most) - the cache's own bound, read by its pin. */
    gridsKept: () => grids.size,
    townKey(n) {
      const town = townAt(n);
      return town?.inside ? town.key : null;
    },
    townPace(n) {
      const town = townAt(n);
      if (!town?.inside) return null;
      const pieces = edgePieces(town.nav);
      if (!town.b.cityGates?.length || pieces.edge.size >= pieces.all) return town.key;   // no walls (or none that close): the grid is the town
      const at = snapCell(town.nav, town.cell);   // a doorstep reads as its street
      return at && pieces.edge.has(componentsOf(town.nav)[at[1] * town.nav.width + at[0]]) ? null : town.key;   // the fields' piece (the residents' grid, its gates closed) is no street of the town
    },
    townWay(from, to) {
      const town = townAt(from);
      if (!town?.inside) return null;
      const t = state.localFromWorld(to.x, to.z);
      const toCell = town.nav.worldToNav(t[0] - town.o[0] - town.t[0], t[1] - town.o[2] - town.t[2]);
      const grid = journeyGrid(town);
      const way = townWayCells(grid.nav, town.cell, toCell);
      // short of its point: behind a shut gate - said, if the gates open by day would have let it through; else (a yard
      // the houses close in, its piece no street reaches) walked as far as it reaches, never blamed on the gates
      if (!way?.reached && grid.shut && townWayCells(journeyGrid(town, true).nav, town.cell, toCell)?.reached) return { pts: [], inside: !!way?.inside, shut: true };
      if (!way) return null;
      // AUDIT OW-REVISITED L1-2: the first cell kept - the walk's first run is checked from it (the pursuit takes it up
      // from where the body stands), where the line from the body to the second cell was never checked at all
      return { pts: way.cells.map((c) => nativeOf(town, c)), inside: way.inside, shut: false };
    },
  };
}

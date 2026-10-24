// @ts-check
// ═══════════════════════════════════════════════════════════════════
// TESA14 (bible/03-World/Arena-Provinces.md TESA14) - THE ROADS PAST THE BAY, IN THE WORLD HOST.
//
// When the places past the Bay stand (the trace and the fit landed: world/arenaPlaces.js arenaPixels) and the Bay's own
// network is known (its crossings ride it, TESA5), the regions' build starts on the roads' workers
// (world/tamrielRoadsClient.js), the regions nearest the player first: the build's inputs are the host's own height
// bytes, the trace and the fit, the roll's numbers (world/tamrielRoads.js rollSpec), Arena's places that stand as towns,
// the capitals' gates and pixels, and the crossings' gates. The crossings' joins go to the terrain client first, with the
// layer reset; then each region's layer as it lands (terrainGenClient.js addArenaRoads: both kernels and this thread's
// verge and ink), and the host paints again the built pixels each one reaches (`onLanded`). A move of the places that
// stand, or the Bay's network landing, starts the build again. The host wires it; nothing of it lives in the host.
// TESA15: the build is handed the pixels Arena's places hold too (routed round, and no rolled place on them), and each
// region's places are kept as it lands (world/pastBayPlaces.js) - the map's marks, the very places the roads serve.
// ═══════════════════════════════════════════════════════════════════
import { createTamrielRoadsClient } from '../world/tamrielRoadsClient.js';
import { regionLattice, regionsByNearness, regionHasLand, regionAt, inputsPrint } from '../world/tamrielRoads.js';
import { arenaJoins, joinLayer } from '../world/arenaRoads.js';
import { tamrielFrameInBay, tamrielFit, inBay } from '../world/tamrielFrame.js';
import { tamrielTrace } from '../world/tamrielLand.js';
import { CAPITALS, capitalGates, capitalSpanPixels } from '../world/tamrielCapitals.js';
import { WATER_BYTE } from '../world/roadsProducer.js';
import { LOCATION_TYPES } from '../formats/mapsFile.js';
import { resetPastBayPlaces, addPastBayPlaces } from '../world/pastBayPlaces.js';

/**
 * `woodsBytes` the height bytes the terrain worker was given; `heightAt` the host's ground; `joinLand` a crossing's land
 * (TESA5); `onLanded` the host's sweep (world.js arenaRoadsLanded). `standing`, what stands now: `pixels` (arenaPixels:
 * null until the trace lands - read every frame, its identity the build's), and, read as a build starts, `towns` the
 * Arena places that stand as towns (`{ x, y, type }`), `spec` the roll's numbers (rollSpec) and `capitals` whether the
 * capitals stand, and (TESA15) `held` the pixels Arena's places stand on (`{ x, y }`, each with its template).
 * @param {{ terrainGen: { addArenaRoads: Function, roads: () => any, hasRoads: boolean }, woodsBytes: Uint8Array,
 *   heightAt: (x: number, y: number) => number, joinLand: (x: number, y: number) => boolean,
 *   onLanded: (epoch: number, layer: any, reset: boolean) => void,
 *   standing: { pixels: () => any, towns: () => Array<{ x: number, y: number, type: number }>, spec: () => any, capitals: () => boolean,
 *     held?: () => Array<{ x: number, y: number }> },
 *   client?: ?ReturnType<typeof createTamrielRoadsClient>, log?: { log: Function, warn: Function } }} o
 */
export function createTamrielRoadsHost({ terrainGen, woodsBytes, heightAt, joinLand, onLanded, standing, client = null, log = console }) {
  let roadsClient = client, forPixels = null, forBay = null, lattice = null, at = null, landed = 0, total = 0;
  return {
    /**
     * Each frame, with the player's pixel: a build when what stands moved, the build re-ordered as the player goes.
     * @param {?{ x: number, y: number }} player
     */
    frame(player) {
      const pixels = standing.pixels(), bay = terrainGen.roads();
      if (pixels !== forPixels || bay !== forBay) {
        if (!pixels || (!bay && terrainGen.hasRoads)) return;   // the trace still to land; TESA5: the Bay's network on its way
        forPixels = pixels;
        forBay = bay;
        start(standing.towns(), standing.spec(), standing.capitals(), standing.held?.() ?? [], player);
        return;
      }
      if (lattice && player) {
        const r = regionAt(lattice, player.x, player.y);
        if (!at || r[0] !== at[0] || r[1] !== at[1]) { at = r; roadsClient?.near(player.x, player.y); }
      }
    },
    /** How many regions are still to land. */
    pending: () => roadsClient?.pending() ?? 0,
    dispose() { roadsClient?.dispose(); },
  };

  function start(towns, spec, capitals, held, player) {
    roadsClient ??= createTamrielRoadsClient({ log });
    const joins = forBay ? arenaJoins(forBay, joinLand) : [];
    const gates = [], obstacles = [];
    if (capitals) {
      CAPITALS.forEach((_, k) => {
        obstacles.push(...capitalSpanPixels(k));
        for (const g of capitalGates(k)) if (!inBay(g.x, g.y) && heightAt(g.x, g.y) > WATER_BYTE) gates.push(g);
      });
    }
    const nodes = [...towns, ...gates.map((g) => ({ x: g.x, y: g.y, type: LOCATION_TYPES.TownCity })), ...joins.map((j) => ({ x: j.gate[0], y: j.gate[1], type: LOCATION_TYPES.TownCity }))];
    lattice = regionLattice(tamrielFrameInBay());
    const from = player ?? { x: 500, y: 250 };
    at = regionAt(lattice, from.x, from.y);
    const regions = regionsByNearness(lattice, (r) => regionHasLand(r, heightAt), from);
    const trace = tamrielTrace(), fit = tamrielFit();
    const inputs = { woodsBytes, trace, fit: fit ? { ox: fit.ox, oy: fit.oy, ppu: fit.ppu } : null, spec, nodes, obstacles, gates, held, lattice };
    landed = 0;
    total = regions.length;
    resetPastBayPlaces();   // TESA15: and the map's places
    terrainGen.addArenaRoads(joinLayer(joins), onLanded, { reset: true });   // TESA5: the crossings first, the layer reset
    const t0 = Date.now();
    log.log(`[roads] the roads past the Bay: ${total} regions to lay (${nodes.length} towns and gates, ${joins.length} crossings)`);
    roadsClient.start({
      inputs, print: inputsPrint(inputs), regions,
      onRegion: (region, layer, stats, places) => {
        addPastBayPlaces(places ?? []);   // TESA15: before the roads, so the map's repaint for them has both
        terrainGen.addArenaRoads(layer, onLanded);
        landed++;
        log.log(`[roads] region (${region.i}, ${region.j}): ${layer.roads.size} road and ${layer.tracks.size} track pixels, ${places?.length ?? 0} places ${stats.cached ? 'from the cache' : `in ${stats.ms} ms`}; ${landed} of ${total}${landed === total ? `, all in ${((Date.now() - t0) / 1000).toFixed(1)} s` : ''}`);
      },
    });
  }
}

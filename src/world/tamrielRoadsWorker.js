// @ts-check
// ═══════════════════════════════════════════════════════════════════
// TESA14 (bible/03-World/Arena-Provinces.md TESA14) - THE ROADS PAST THE BAY'S OWN WORKER.
//
// A region's network is seconds of work - its places rolled (the countryside's plateau is a terrain kernel's mean) and
// a thousand-odd A* runs - so it is built here, off the terrain worker whose jobs stream the ground under the player,
// on a ground of its own composed as every host composes it (world/tamrielGround.js groundWoods over the host's own
// height bytes, the trace and the fit). The host's client (world/tamrielRoadsClient.js) keeps several of these busy,
// the nearest regions first.
//
//   init   { woodsBytes, trace, fit, spec, nodes, obstacles, gates, held, lattice }  the build's inputs (world/tamrielRoads.js)
//   build  { id, i, j }  ->  region { id, i, j, layer (packArenaRoads), places (packPastBayPlaces - TESA15), stats, ms }
//                            or { id, i, j, error }
// ═══════════════════════════════════════════════════════════════════
import { WoodsFile } from '../formats/woodsFile.js';
import { groundWoods, dropGroundCache } from './tamrielGround.js';
import { groundClimateIndex } from './tamrielGround.js';
import { setTamrielTrace } from './tamrielLand.js';
import { setTamrielFit } from './tamrielFrame.js';
import { createCountryGround } from './tamrielCountry.js';
import { createTamrielAtlas } from './tamrielAtlas.js';
import { packArenaRoads } from './arenaRoads.js';
import { packPastBayPlaces } from './pastBayPlaces.js';
import { MAP_W, MAP_H } from './roadNetwork.js';
import { regionOf, buildTamrielRegion, rollTypeAt } from './tamrielRoads.js';

/** The worker's state over its messages - a function, so node drives it without a worker. */
export function createRoadsWorkerState() {
  let inputs = null, ground = null, atlas = null;
  return {
    /** One message; `post` answers it. */
    handle(m, post) {
      if (m.t === 'init') {
        const w = new WoodsFile();
        if (!w.load(m.woodsBytes)) throw new Error('WOODS.WLD failed to load in the roads worker');
        setTamrielTrace(m.trace ?? null);
        setTamrielFit(m.fit ?? null);
        dropGroundCache();
        ground = groundWoods(w);
        const heightAt = (x, y) => ground.getHeightMapValue(x, y);
        // past the Bay the climate is the province's (the Bay's own pixels are never asked: they are its network's)
        const typeAt = rollTypeAt(m.spec, { climateAt: groundClimateIndex(() => -1), heightAt, ground: createCountryGround(ground) });
        atlas = createTamrielAtlas((x, y) => { const type = typeAt(x, y); return type === null ? null : { type, name: '' }; }, () => [0]);
        inputs = { ...m, heightAt };
        return;
      }
      if (m.t === 'build') {
        try {
          if (!inputs) throw new Error('no inputs');
          const t0 = Date.now();
          const region = regionOf(inputs.lattice, m.i, m.j);
          const places = atlas.placesIn(region.gx, region.gy, region.gx + MAP_W, region.gy + MAP_H);
          const out = buildTamrielRegion({ region, places, nodes: inputs.nodes, obstacles: inputs.obstacles, gates: inputs.gates, held: inputs.held ?? [], heightAt: inputs.heightAt });
          const layer = packArenaRoads({ ...out, join: new Map() }), placed = packPastBayPlaces(out.places);
          post({ t: 'region', id: m.id, i: m.i, j: m.j, layer, places: placed, stats: out.stats, ms: Date.now() - t0 },
            [layer.keys.buffer, layer.roads.buffer, layer.tracks.buffer, layer.joinKeys.buffer, layer.join.buffer, placed.keys.buffer, placed.types.buffer]);
        } catch (e) {
          post({ t: 'region', id: m.id, i: m.i, j: m.j, error: e?.message ?? String(e) });
        }
      }
    },
    /** The rolled places on a rectangle's pixels, as a build reads them - for the tools and the pins. */
    placesIn: (x0, y0, x1, y1) => atlas?.placesIn(x0, y0, x1, y1) ?? [],
  };
}

// the worker itself - absent in node, where the state is driven directly
if (typeof globalThis.WorkerGlobalScope !== 'undefined' && globalThis instanceof globalThis.WorkerGlobalScope) {
  const state = createRoadsWorkerState();
  const scope = /** @type {any} */ (globalThis);
  scope.onmessage = (ev) => state.handle(ev.data ?? {}, (msg, xfer = []) => scope.postMessage(msg, xfer));
}

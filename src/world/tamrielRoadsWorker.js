// @ts-check
// ═══════════════════════════════════════════════════════════════════
// TESA14 (bible/03-World/Arena-Provinces.md TESA14) - THE ROADS PAST THE BAY'S OWN WORKER.
//
// A region's network is seconds of work - its places rolled (the countryside's plateau is a terrain kernel's mean) and
// a thousand-odd A* runs - so it is built here, off the terrain worker whose jobs stream the ground under the player,
// on a ground of its own composed as every host composes it (world/tamriel/tamrielGround.js groundWoods over the host's own
// height bytes, the trace and the fit). The host's client (world/tamrielRoadsClient.js) keeps several of these busy,
// the nearest regions first.
//
//   init   { woodsBytes, trace, fit, spec, nodes, obstacles, gates, held, lattice, trunks }  the build's inputs
//          (world/tamrielRoads.js; `trunks` VOYAGER-CYRODIIL's spec, its legs planned here - road/cyrodiilRoads.js)
//   build  { id, i, j }  ->  region { id, i, j, layer (packArenaRoads), places (packPastBayPlaces - TESA15), stats, ms }
//                            or { id, i, j, error }
//
// AUDIT TESA II R8: the same state builds on the page's own thread when no worker can (the client's fallback - TESA4's
// recorded intent, "with no worker this thread builds it"): `inThread` on its init takes the trace and the fit this thread
// has installed already - installing them again would move the land's version under every reader here - and `steps`
// answers a build a step at a time, so the client spends a budget of it between frames.
// ═══════════════════════════════════════════════════════════════════
import { WoodsFile } from '../formats/woodsFile.js';
import { groundWoods, dropGroundCache } from './tamriel/tamrielGround.js';
import { groundClimateIndex } from './tamriel/tamrielGround.js';
import { setTamrielTrace } from './tamriel/tamrielLand.js';
import { setTamrielFit } from './tamriel/tamrielFrame.js';
import { createCountryGround } from './tamrielCountry.js';
import { createTamrielAtlas, ATLAS_TILE } from './tamrielAtlas.js';
import { packArenaRoads } from './arenaRoads.js';
import { packPastBayPlaces } from './pastBayPlaces.js';
import { MAP_W, MAP_H, drainSteps } from './road/roadNetwork.js';
import { regionOf, tamrielRegionSteps, rollTypeAt } from './tamrielRoads.js';
import { planTrunkLegs } from './road/cyrodiilRoads.js'; // VOYAGER-CYRODIIL: the named roads' legs
import { inBay } from './tamriel/tamrielFrame.js';
import { WATER_BYTE } from './roadsProducer.js';

/** The worker's state over its messages - a function, so node drives it without a worker. */
export function createRoadsWorkerState() {
  let inputs = null,
    ground = null,
    atlas = null;
  /** AUDIT TESA II R8: one build, a step at a time: its places rolled a strip of atlas tiles a step, its ground and its
   *  routes (world/tamrielRoads.js tamrielRegionSteps), then its answer and the buffers it transfers. */
  function* steps(m) {
    try {
      if (!inputs) throw new Error('no inputs');
      const t0 = Date.now();
      const region = regionOf(inputs.lattice, m.i, m.j);
      const places = [];
      for (let y = region.gy; y < region.gy + MAP_H; y += ATLAS_TILE) {
        places.push(...atlas.placesIn(region.gx, y, region.gx + MAP_W, Math.min(region.gy + MAP_H, y + ATLAS_TILE)));
        yield;
      }
      const out = yield* tamrielRegionSteps({
        region,
        places,
        nodes: inputs.nodes,
        obstacles: inputs.obstacles,
        gates: inputs.gates,
        held: inputs.held ?? [],
        heightAt: inputs.heightAt,
        trunks: inputs.trunkLegs,
      });
      const layer = packArenaRoads({ ...out, join: new Map() }),
        placed = packPastBayPlaces(out.places);
      const land = out.land; // EXACT-PIECES: the core's land's pieces, as runs (world/tamrielLandPieces.js)
      return {
        msg: {
          t: 'region',
          id: m.id,
          i: m.i,
          j: m.j,
          layer,
          places: placed,
          land,
          stats: out.stats,
          ms: Date.now() - t0,
        },
        xfer: [
          layer.keys.buffer,
          layer.roads.buffer,
          layer.tracks.buffer,
          layer.joinKeys.buffer,
          layer.join.buffer,
          placed.keys.buffer,
          placed.types.buffer,
          land.rowStart.buffer,
          land.runLen.buffer,
          land.runLabel.buffer,
          land.ring.buffer,
        ],
      };
    } catch (e) {
      return { msg: { t: 'region', id: m.id, i: m.i, j: m.j, error: e?.message ?? String(e) }, xfer: [] };
    }
  }
  return {
    /** One message; `post` answers it. */
    handle(m, post) {
      if (m.t === 'init') {
        const w = new WoodsFile();
        if (!w.load(m.woodsBytes)) throw new Error('WOODS.WLD failed to load in the roads worker');
        if (!m.inThread) {
          setTamrielTrace(m.trace ?? null);
          setTamrielFit(m.fit ?? null);
          dropGroundCache();
        }
        ground = groundWoods(w);
        const heightAt = (x, y) => ground.getHeightMapValue(x, y);
        // past the Bay the climate is the province's (the Bay's own pixels are never asked: they are its network's)
        const typeAt = rollTypeAt(m.spec, {
          climateAt: groundClimateIndex(() => -1),
          heightAt,
          ground: createCountryGround(ground),
        });
        atlas = createTamrielAtlas(
          (x, y) => {
            const type = typeAt(x, y);
            return type === null ? null : { type, name: '' };
          },
          () => [0],
        );
        // VOYAGER-CYRODIIL: the named roads' legs, planned once on this ground (world/road/cyrodiilRoads.js) - a road stands
        // on land past the Bay and on no capital's pixel
        const held = new Set((m.obstacles ?? []).map((o) => `${o.x},${o.y}`));
        const wet = (x, y) => !inBay(x, y) && heightAt(x, y) <= WATER_BYTE;
        const walkable = (x, y) => !inBay(x, y) && heightAt(x, y) > WATER_BYTE && !held.has(`${x},${y}`);
        inputs = { ...m, heightAt, trunkLegs: planTrunkLegs(m.trunks ?? null, { heightAt, walkable, wet }) };
        return;
      }
      if (m.t === 'build') {
        const { msg, xfer } = drainSteps(steps(m));
        post(msg, xfer);
      }
    },
    /** AUDIT TESA II R8: a build's steps - the generator's answer is `{ msg, xfer }`, what `handle` posts. */
    steps,
    /** The rolled places on a rectangle's pixels, as a build reads them - for the tools and the pins. */
    placesIn: (x0, y0, x1, y1) => atlas?.placesIn(x0, y0, x1, y1) ?? [],
    /** VOYAGER-CYRODIIL: the named roads' legs this init planned - for the tools and the pins. */
    trunkLegs: () => inputs?.trunkLegs ?? [],
  };
}

// the worker itself - absent in node, where the state is driven directly
if (typeof globalThis.WorkerGlobalScope !== 'undefined' && globalThis instanceof globalThis.WorkerGlobalScope) {
  const state = createRoadsWorkerState();
  const scope = /** @type {any} */ (globalThis);
  scope.onmessage = (ev) => state.handle(ev.data ?? {}, (msg, xfer = []) => scope.postMessage(msg, xfer));
}

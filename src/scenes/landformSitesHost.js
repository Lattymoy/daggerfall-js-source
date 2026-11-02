// @ts-check
// ═══════════════════════════════════════════════════════════════════
// BAY-LEFT-GROUND (2026-10-26, bible/03-World/Landforms.md "BAY-LEFT-GROUND"; the audit "no system left behind in the
// Bay", D1 - LANDFORM4, Mac's "a town walled in by its own levelling") - THE LANDFORMS' SITES PAST THE BAY, kept with the
// places they are made of.
//
// LANDFORM4's sites are MAPS.BSA's rows, a 1000 x 500 table made once as the world mounts (world.js, landformSites), so
// no town past the Bay pulled its land toward its level: each stood in its own levelling wall, a median 39 m and at the
// 90th percentile 104 m from its pixel's edge to its level, against the Bay's 7.6 m and 37.7 m. The places past the Bay
// are a second table (world/landforms.js landformSitesBeyond over world/pastBayRows.js pastBaySites), keyed by the
// world's key, made from the places every client with the land stands alike (GROUND-AGREE: TESA12's are the port's own,
// made on the trace from Daggerfall's own files) and handed to both kernels - this thread's and the terrain worker's
// (world/terrain/terrainGenClient.js setLandformBeyond).
//
// MADE AGAIN WHEN THE PLACES MOVE. The places past the Bay stand on the trace and the fit (arenaPixels, the capitals'
// pixels), which land after the world mounts and move with the land; asked on the frame, the table is made again when
// what stands them moves (the registry's live list's own stamp, world/worldWide/worldPlaces.js registerLive, and the
// capitals' version). A site moved (made, gone, its rect another) moves the ground of every pixel within two of it (the
// 5x5 landforms.js sitesAbout reads), so each such pixel standing is built again, behind its view (scenes/swapBehind.js),
// and one in flight as it publishes (the roads' own shape, tamrielSweepsHost.js arenaRoadsStale). `generation` moves
// with the table, for the main thread's own readers of the shaped ground (a record's lift field, the gate's beacon).
//
// THE FOUR HOSTS RULE (bible/Home.md): world.js wires it - the streamed world is the one ground past the Bay.
// scenes/exterior.js (the Bay's fixed scene), scenes/worldModes.js (interiors), scenes/dungeonContext.js (dungeons) - not wired, by design: LANDFORM4's own table or no shaped ground at all
// ═══════════════════════════════════════════════════════════════════
import { landformSitesBeyond, SITE_REACH_PIXELS } from '../world/landforms.js';
import { pastBaySites } from '../world/pastBayRows.js';
import { arenaPixels } from '../world/arenaPlaces.js';
import { arenaTemplateOf } from '../world/arenaLocations.js';
import { capitalsVersion } from '../world/tamrielCapitals.js';
import { tamrielFit } from '../world/tamriel/tamrielFrame.js';
import { tamrielLandVersion } from '../world/tamriel/tamrielLand.js';
import { worldPixelOfKey, worldPixelKey } from '../world/worldWide/worldGrid.js';

/** How far a site moves the ground, in pixels: the 5x5 of sitesAbout (world/landforms.js, its home). */
export { SITE_REACH_PIXELS };

/**
 * The world keys whose site moved from one table to the next - made, gone, or another rect - in key order.
 * @param {?Map<number, number>} was @param {?Map<number, number>} now @returns {number[]}
 */
export function sitesMoved(was, now) {
  const out = new Set();
  for (const [k, v] of now ?? []) if (was?.get(k) !== v) out.add(k);
  for (const k of was?.keys() ?? []) if (!now?.has(k)) out.add(k);
  return [...out].sort((a, b) => a - b);
}

/** The pixels within SITE_REACH_PIXELS of any of `keys` (world keys), as a set of world keys. @param {number[]} keys */
export function pixelsMovedBy(keys) {
  const out = new Set();
  for (const k of keys) {
    const [x, y] = worldPixelOfKey(k);
    for (let dy = -SITE_REACH_PIXELS; dy <= SITE_REACH_PIXELS; dy++)
      for (let dx = -SITE_REACH_PIXELS; dx <= SITE_REACH_PIXELS; dx++) out.add(worldPixelKey(x + dx, y + dy));
  }
  return out;
}

/**
 * The host's handles: `terrainGen` the terrain client, `landform` the Landforms row (off, no site anywhere moves), `arena`
 * the places' templates (world/arenaLocations.js arenaTemplates - null, none stand), `capitals` whether the capitals stand,
 * and live: `built` the standing pixels ("x,y" -> entry), `inFlight` the ones posted, `swap` the rebuild behind a view.
 * @param {{ terrainGen: any, landform: boolean, arena: any, capitals: boolean, readonly built: Map<string, any>, readonly inFlight: Map<string, any>, readonly swap: any }} host
 */
export function createLandformSites(host) {
  const { terrainGen, landform, arena, capitals } = host;
  /** @type {?Map<number, number>} */ let table = null;
  /** @type {?any[]} */ let stamp = null;
  let generation = 0;
  /** Pixels posted under an older table, each built again once it publishes. */
  const stale = new Set();
  const stampNow = () => [arena ? arenaPixels() : null, tamrielFit(), tamrielLandVersion(), capitalsVersion()];
  /** The table as the places stand now. */
  const make = () =>
    landformSitesBeyond(
      pastBaySites({ pixels: arena ? arenaPixels() : null, templateOf: (p) => arenaTemplateOf(arena, p), capitals }),
    );
  /** The standing pixels a moved site reaches built again, behind their views; the ones in flight once they publish. */
  function rebuildAbout(keys) {
    const reach = pixelsMovedBy(keys),
      again = [];
    for (const [k, p] of host.built)
      if (reach.has(worldPixelKey(p.px, p.py)) && !host.swap.owes(k)) again.push({ px: p.px, py: p.py });
    for (const k of host.inFlight.keys()) {
      const [x, y] = k.split(',').map(Number);
      if (reach.has(worldPixelKey(x, y))) stale.add(k);
    }
    if (again.length) host.swap.rebuild(again);
    return again.length;
  }
  /** Asked on the frame (after the places' own sweeps): the table made again when what stands the places moved. Answers
   *  whether the table moved. */
  function refresh() {
    if (stale.size) {
      // a pixel posted under the old table, published since: built again, once
      const again = [];
      for (const k of stale) {
        const p = host.built.get(k);
        if (p) {
          stale.delete(k);
          if (!host.swap.owes(k)) again.push({ px: p.px, py: p.py });
        } else if (!host.inFlight.has(k)) stale.delete(k);
      }
      if (again.length) host.swap.rebuild(again);
    }
    if (!landform) return false;
    const s = stampNow();
    if (stamp && s.every((v, i) => v === stamp?.[i])) return false;
    stamp = s;
    const next = make(),
      moved = sitesMoved(table, next);
    if (table && !moved.length) return false; // the same sites: no ground moves
    const first = table === null;
    table = next;
    generation++;
    terrainGen.setLandformBeyond(next);
    if (first) return true; // as the world mounts: no pixel stands yet (nor its book - the host's stream is made below it)
    const n = moved.length ? rebuildAbout(moved) : 0;
    if (moved.length)
      console.log(`[landforms] ${next.size} sites past the Bay (${moved.length} moved): ${n} pixel(s) built again`);
    return true;
  }
  refresh(); // the first table before the first job is posted
  return { beyond: () => table, generation: () => generation, refresh };
}

// ═══════════════════════════════════════════════════════════════════
// EV7 — THE PIXEL KERNEL, one pure function. buildPixel's CPU-heavy
// prologue ran ~84,000 perlinNoise calls per map pixel (33k in
// generateSamples, up to 50k in generateTileData - the tile
// classifier out-costs the heightmap itself) plus ~166k cubic
// interpolations and 16k atans in layoutNature, all inside ONE task:
// every await in buildPixel is a cache-warm microtask, so the whole
// body landed on the frame the pixel was enqueued - the map-pixel
// crossing hitch. This module is that prologue factored out VERBATIM,
// in the exact inline order, so it can run on a Worker (terrainGenClient
// / terrainGenWorker) or on this thread (the fallback IS the old path,
// not a failure - the RA1 road-bake law).
//
// The inputs are the postMessage-safe half of buildPixel's world:
// `woods` is any object answering the sampler's three-method surface
// (getHeightMapValuesRange1Dim / getLargeHeightMapValuesRange /
// getHeightMapValue - the worker owns its own WoodsFile from a copied
// byte buffer), and the LOCATION half stays with the caller:
// setLocationTiles needs BlocksFile+MapsFile, which are file objects
// that do not cross a postMessage boundary, so the caller runs it
// first and its tilemap + rect ride INTO the job as plain data.
// ═══════════════════════════════════════════════════════════════════

import { generateSamples, ghostSampler, HEIGHTMAP_DIMENSION } from './terrainSampler.js';
import { CAPITAL_SEA_FLAT, capitalSeaGround } from './capitalSea.js';   // RUMARE-WATER: a capital at the sea, its water the sea's
import { reliefFlat, capitalReliefGround } from './capitalRelief.js';   // SOLITUDE-RELIEF: a capital on a relief of its own
import { buildTerrainGrid, convertTilemap } from './terrainSurface.js';
import { assignTiles, blendLocationTerrain, calcAvgMaxHeight, generateTileData, townGroundMask, unstampOffShape, townRoadRing, WATER } from './terrainTiles.js';
import { townGroundMaskBefore } from './townBlendBefore.js';   // FB1028 YARDS Y2: the yards' ground as #1184 drew it
import { layoutNature, layoutLandProps } from './terrainNature.js';
import { jungleLayout, jungleWhole } from './jungleNature.js';   // BANTHA1: the jungle over the pixel's own layout
import { paintJungleTrails } from '../jungle/jungleTrails.js';   // JUNGLE-TRAILS: the jungle's own trails
import { paintRoads, smoothRoadHeights, pathCorners } from '../road/roadPainter.js';
import { dryRoadHeights, roadCrossings } from '../road/roadDry.js';   // ROAD-DRY: the Bay's paving over the sea stands dry
import { townMeetsAbout, applyTownMeets, meetLiftAt } from './townMeet.js';   // ACROSS-EDGE: the ground meets a town across its pixel's edge
import { MAP_W } from '../road/roadNetwork.js';
import { arenaRoadByte, arenaRoadCorners, arenaJoinByte } from '../arenaRoads.js';   // TESA4: Arena's roads past the Bay; TESA5: their joins on it
import { inBay } from '../tamriel/tamrielFrame.js';
import { applyPicks } from '../worldOfDaggerfall/wodLocationLoader.js';   // WOD2: World of Daggerfall's smoothing arms
import { createLandforms } from '../landforms.js';   // LANDFORM1-3: the port's own terrain, inside the kernel
import { waterBedOf, bedHalo, bedNearEdge } from '../water/waterBed.js';   // AUDIT WATER-NEXT P1: the bed under the water, carved with the grid; F2: across its seams
import { streamLevelAt, paintedWaterAt } from '../water/streamLevels.js';   // Each body's own level - the sea, World 2.0, Cyrodiil
import { sheetBuffers } from '../water/waterLevel.js';
import { paintTamrielWaters } from '../tamriel/tamrielWaters.js';   // CYRODIIL-WATERS: the rivers and lakes past the Bay laid in as water
import { paintGen2Waters } from '../gen2/gen2Ground.js';   // A published region's waters laid in as water
import { landsNine } from '../tamriel/tamrielLands.js';   // TESA-LANDS: the zones' own flats past the Bay
import { bridgesOf, unpaveBridges } from '../road/roadBridges.js';   // ROAD-LOOK: a road over a river wider than a ford crosses on a bridge
import { layGateRoads, yardRoads } from '../road/gateRoads.js';   // GATE-ROADS: a walled town's gates on their roads

/**
 * The whole CPU side of one streamed pixel, in buildPixel's own order:
 * samples -> (location: avg + blend, over the PRE-SEEDED tilemap the
 * caller's setLocationTiles wrote) -> tileData/assignTiles -> the
 * grid with its ghost-row edge normals (EV4) and far-ring stride ->
 * the converted tilemap bytes -> the nature layout.
 *
 * @param {object} job
 * @param {object} job.woods - the sampler's three-method surface.
 * @param {number} job.px
 * @param {number} job.py
 * @param {number} [job.stride] - 1 or the EV4 far-ring stride.
 * @param {Uint8Array} job.tilemap - 128x128, location tiles already
 *   set by the caller when the pixel carries one; mutated here.
 * @param {?object} job.locationRect - setLocationTiles' answer.
 * @param {boolean} job.hasLocation
 * @param {number} job.climateType - the pixel's climate, for nature.
 * @param {?{picks:Array<{flatten:boolean, rect:object}>}} [job.wod] -
 *   The World of Daggerfall instances the main thread's
 *   pickLocations placed on this pixel, in order; null with the mod off.
 * @param {?{archive:number, hidden:boolean}} [job.forests] - FOREST1: the Real forests switch (null off, DFU's scatter): the
 *   climate's summer nature archive, and whether the pixel's location is a place the woods hide (a dungeon, a shrine).
 * @param {boolean} [job.landform] - LANDFORM1-3: the Landforms row (off,
 *   DFU's kernel): the relief, and the paths cut into the land with this
 *   kernel's own network - its rivers where they are painted.
 * @param {?Uint8Array} [job.sites] - LANDFORM4: landforms.js landformSites, the game's own locations the shaped ground
 *   is pulled to (the client's, never the job's: it rides beside the woods and the network).
 * @param {?Uint8Array} [job.climates] - LANDFORM6: landforms.js landformClimates, the land each climate wears (the
 *   client's, beside the sites).
 * @param {?Map<number, number>} [job.beyond] - BAY-LEFT-GROUND: landforms.js landformSitesBeyond, the places past the Bay
 *   the shaped ground is pulled to (the client's, beside the sites).
 * @param {?{nine:number[], hidden?:boolean, canopy?:?number[]}} [job.jungle] - BANTHA1: the
 *   jungle's field about this pixel (world/jungle/jungleRegion.js jungleNine)
 *   and whether its location is one the woods hide; null where the jungle
 *   cannot reach or its row is off (world/terrain/jungleNature.js jungleLayout).
 *   `canopy` the canopy field's 3x3 where a canopy closes near it - its graht-oaks stand.
 * @param {?{nature:number[], type:number[]}} [job.ecotone] - ECOTONE1: the
 *   3x3 of pixels' climates about this one (world/terrain/terrainNature.js
 *   layoutNature's `ecotone`), null with the Blended climates row off or
 *   every neighbour this pixel's own climate.
 * @param {?{px?: number, py?: number, sea?: boolean, seaEdges?: { N?: boolean, E?: boolean, S?: boolean, W?: boolean }, relief?: string, own?: boolean, avg?: number}} [job.flattenAt] - TESA11: a capital that spans several pixels (world/tamrielCapitals.js
 *   `span`): the pixel whose average every one of its pixels is flattened to - its centre's - so they meet level. AUDIT TESA II
 *   `sea` a shore capital's, flattened to the sea's floor - its harbour's water the sea's; RUMARE-WATER: its land a freeboard
 *   over it (world/terrain/capitalSea.js CAPITAL_SEA_FLAT), its water let down to it (capitalSeaGround) - the Imperial City's
 *   too, where its canal stands; `seaEdges` its sides shared with its sea slice; `relief` (SOLITUDE-RELIEF) capitalRelief.js's key; `own` (WG2-TOWNS) no blend, the plane `avg`.
 * @param {?{blend?: boolean, archive?: number, hidden?: boolean}} [job.lands] - TESA-LANDS: the lands' row (null off) - a zone's flats past the Bay, `blend` the Blended climates row, `archive` the climate's nature archive, `hidden` a place the woods close round
 * @returns {{samples: Float32Array, tilemap: Uint8Array,
 *   positions: Float32Array, normals: Float32Array,
 *   tilemapBytes: Uint8Array, avg: number, paths: ?Uint8Array,
 *   nature: Array<{record:number,x:number,y:number,z:number}>, beach: ?Float32Array,
 *   roadside: Array<any>, graht: ?Float32Array, landProps: Float32Array}} `roadside` JUNGLE-ROADSIDE's pairs (world/jungle/jungleRoadside.js standPairs);
 *   `graht` GRAHT1's graht-oaks (world/jungle/grahtOaks.js grahtSites, GRAHT_TREE_FLOATS a tree); `landProps` TESA-LANDS' landmarks (landProps.js landSites)
 */
/** TESA11: the averages a city over several pixels is flattened to, by its centre pixel and whether the ground is shaped -
 *  kept while the kernel's inputs are the same (its woods, its network, its sites, its climates). */
const _flatAverages = new Map();
/** TESA11: the average height of a pixel's samples (and of DFU's own, the classic pass, where the ground is shaped) - the
 *  pixel's own samples when this job is the pixel's (`own`), else generated for it once. */
function flattenAverage(inputs, landforms, at, own) {
  const key = `${at.px},${at.py}|${landforms ? 1 : 0}`, had = _flatAverages.get(key);
  if (had && had.woods === inputs.woods && had.roads === inputs.roads && had.sites === inputs.sites && had.beyond === inputs.beyond && had.climates === inputs.climates) return had;   // BAY-LEFT-GROUND: and the sites past the Bay
  let samples = own?.samples ?? null, classic = own?.classic ?? null;
  if (!samples) {
    classic = landforms ? new Float32Array(HEIGHTMAP_DIMENSION * HEIGHTMAP_DIMENSION) : null;
    samples = generateSamples(inputs.woods, at.px, at.py, HEIGHTMAP_DIMENSION, landforms, classic);
  }
  const out = { ...inputs, avg: calcAvgMaxHeight(samples)[0], classic: classic ? calcAvgMaxHeight(classic)[0] : null };
  _flatAverages.set(key, out);
  return out;
}

/** ACROSS-EDGE: the meets a pass of a pixel took (townMeetsAbout's, the shaped ground's with `landforms`) - its ghost rows'. */
export const meetsOf = (meets, landforms) => (meets?.length ? meets.map((m) => ({ px: m.px, py: m.py, meet: landforms ? m.shaped : m.plain })) : null);
/** The ground a built pixel's grid is made again of (restrideGrid, the worker's promotion): its pixel, its samples and
 *  ACROSS-EDGE the meets they took, which its ghost rows take too - one place, so no grid job leaves them behind. */
export const gridGround = (p) => ({ px: p.px, py: p.py, samples: p.samples, meets: p.meets ?? null });

export function generatePixelTerrain({ woods, px, py, stride = 1, tilemap, locationRect = null, hasLocation = false, climateType, roads = null, sites = null, beyond = null, climates = null, wod = null, forests = null, landform = false, ecotone = null, bed = false, flattenAt = null, jungle = null, lands = null, about = null }) {
  // LANDFORM1-3: built from the network THIS kernel holds - the one the painter below paints - so the cut and the paint
  // are the same roads; restrideGrid's ghost rows take the same landforms, so the edge normals read the shaped ground.
  // LANDFORM4: and the sites this kernel holds (landforms.js landformSites, the client's to hand both threads); LANDFORM6:
  // and the world's climates beside them.
  const landforms = landform ? createLandforms({ woods, roads, sites, beyond, climates }) : null;   // BAY-LEFT-GROUND: and the sites past the Bay
  // AUDIT LANDFORMS D3: THE LANDFORMS MOVE THE GROUND, NEVER A TILE. A location's blend pulls its whole pixel toward the
  // pixel's mean, and the landforms move that mean (a road's bed and a river's channel by centimetres, a massif in the
  // pixel by up to 268 m - Chesterbrugh), so a beach sample the classifier read on the shaped blend crossed the beach
  // line where DFU's did not: 359 tiles in 97 of the 314 coastal location pixels on the real data turned between sand
  // and land. The tiles are classified on DFU's own samples through DFU's own blend - written in the same pass - and
  // where they part from the shaped ground they part by at most 2.2 m (the Dunynak Excavation, 313 under 10 cm).
  const classic = landforms && hasLocation ? new Float32Array(HEIGHTMAP_DIMENSION * HEIGHTMAP_DIMENSION) : null;
  const samples = generateSamples(woods, px, py, HEIGHTMAP_DIMENSION, landforms, classic);
  // ACROSS-EDGE: the towns about it move its ground to meet them, before any blend (world/terrain/townMeet.js)
  const meets = about?.length ? townMeetsAbout(about, { woods, landforms, px, py, own: { samples, classic } }) : null;
  // a location stands where it stood: its level, its outline and its reach read before the meets
  const unmet = meets && hasLocation ? { samples: Float32Array.from(samples), classic: classic && Float32Array.from(classic) } : null;
  if (meets) {
    applyTownMeets(samples, px, py, meetsOf(meets, landforms));
    // AUDIT FB1029 D-S2: the tiles are classed on the classic pass, so it takes the drawn ground's meets too - no water left
    // where the shaped meet raised the ground
    if (classic) applyTownMeets(classic, px, py, [...(meetsOf(meets, null) ?? []), ...(landforms ? meetsOf(meets, landforms) ?? [] : [])]);
  }
  let avg = 0;
  /** @type {?Uint8Array} FB1028 YARDS Y2: the town's ground as #1184 drew it (TS2's mask over the outline before its crops) */
  let yardGround = null;
  // A World 2.0 town stands on its region's ground, pads and all - nothing
  // blended, its plane the one its blocks laid its models from
  if (hasLocation && flattenAt?.own) avg = flattenAt.avg;
  else if (hasLocation) {
    // TESA11: a city over several pixels stands on one ground - each of its pixels flattened to its centre's average
    const flat = flattenAt ? (flattenAt.relief ? reliefFlat(flattenAt.relief) : (flattenAt.sea ? CAPITAL_SEA_FLAT : flattenAverage({ woods, roads, sites, beyond, climates }, landforms, flattenAt, px === flattenAt.px && py === flattenAt.py ? unmet ?? { samples, classic } : null))) : null;   // AUDIT TESA II C2: a shore capital at the sea's floor; SOLITUDE-RELIEF: one on a relief of its own at its streets' level
    const own = () => [Float32Array.from(samples), classic ? Float32Array.from(classic) : null];
    const natural = flattenAt?.sea && !flattenAt.relief ? own() : null;   // RUMARE-WATER: the land's own ground, the far shore's and the rim's
    const raised = flattenAt?.relief ? own() : null;   // SOLITUDE-RELIEF: its edge band's
    avg = flat ? flat.avg : calcAvgMaxHeight(unmet?.samples ?? samples)[0];
    // TOWN-SHAPES (bible/03-World/Town-Shapes.md): a town with an outline flattens to it, at its own land's height - the sea
    // past its margin read on DFU's own samples (the classic pass's, where the ground is shaped), as its tiles are
    const ground = locationRect?.shape ? (unmet ? unmet.classic ?? unmet.samples : Float32Array.from(classic ?? samples)) : null;
    avg = blendLocationTerrain(samples, avg, locationRect, HEIGHTMAP_DIMENSION, ground ?? samples, false, unmet?.samples);
    if (classic) blendLocationTerrain(classic, flat?.classic ?? calcAvgMaxHeight(unmet?.classic ?? classic)[0], locationRect, HEIGHTMAP_DIMENSION, ground ?? classic, false, unmet?.classic);
    if (natural) for (const [S, n] of [[samples, natural[0]], [classic, natural[1]]]) if (S && n) capitalSeaGround(S, n, tilemap, locationRect, px, py, flattenAt.seaEdges);   // RUMARE-WATER: its water the sea's, its land over it
    if (raised) for (const [S, n] of [[samples, raised[0]], [classic, raised[1]]]) if (S && n) capitalReliefGround(S, n, flattenAt.relief);   // SOLITUDE-RELIEF: every vertex its relief's
    if (ground) {
      const mask = townGroundMask(locationRect.shape, ground);
      unstampOffShape(tilemap, locationRect.shape, mask);   // its tiles over the sea the sea's
      locationRect = { ...locationRect, mask, ring: townRoadRing(mask) };   // the road's ring round its outline (roadPainter.js)
      yardGround = townGroundMaskBefore(locationRect.shapeWas ?? locationRect.shape, ground, HEIGHTMAP_DIMENSION);   // FB1028 YARDS Y2
    }
  }
  // ROADS 2: the one seam. Ground classified, squares not yet run, so a
  // road tile lands over a known ground type and the marching squares
  // blend around it. `roads` is null in a solo build with no network
  // loaded and the pipeline is then byte-for-byte what it was.
  const tileData = generateTileData(classic ?? samples, px, py);
  // GRASS-PATH1: the painter's own record of which tiles it wrote, so
  // the grass placer can keep off a path it cannot name by record.
  let paths = null;
  let yardPaths = null;   // FB1028 YARDS: #1184's paths, the yards' alone
  let arenaPainted = false;   // TESA4: whether Arena's roads reached this pixel's paint - the host's sweep asks
  let bridges = null;   // ROAD-LOOK: the bridges this pixel owns (world/road/roadBridges.js), past the Bay with the rivers carved
  if (roads) {
    paths = new Uint8Array(tilemap.length);
    // ROAD-BEYOND: the network is the Bay's 1000 x 500 - a pixel past its east or west edge (TAMRIEL2) carries none of
    // it, where `py * MAP_W + px` read the next or last row's own Bay pixel (2712 of them in a 60-pixel strip either
    // side); a row above or below the Bay reads off the arrays' ends, which is none already
    const onGrid = px >= 0 && px < MAP_W;
    const i = py * MAP_W + px;
    const at = (m) => (m && onGrid ? m[i] : 0);
    // TESA4: past the Bay - north and south of it too - Arena's roads (world/arenaRoads.js), each byte and corner its
    // layer's; none on the Bay, whose network is its own
    const arena = !inBay(px, py);
    // TESA5: on the Bay, a crossing's join alone - the Bay's road carried out to its edge (no corner: its runs are straight)
    const join = arena ? 0 : arenaJoinByte(px, py);
    const road = at(roads.roads) | (arena ? arenaRoadByte('roads', px, py) : join), track = at(roads.tracks) | (arena ? arenaRoadByte('tracks', px, py) : 0);
    const arenaCorners = (kind) => (arena ? arenaRoadCorners(kind, px, py) : 0);
    arenaPainted = !!(join || (arena && (road || track || arenaCorners('roads') || arenaCorners('tracks'))));
    // ROADS 23: the mod's corners - a neighbour's diagonal brushes this
    // pixel's corner tile - and its water, off unless the network says.
    const c = (m) => (m ? pathCorners(m, px, py, MAP_W) : 0);
    paintRoads(tileData, tilemap, road, track, hasLocation ? locationRect : null, 129, {
      river: at(roads.rivers), stream: at(roads.streams), water: !!roads.water,
      corners: { road: c(roads.roads) | arenaCorners('roads'), track: c(roads.tracks) | arenaCorners('tracks'), river: c(roads.rivers), stream: c(roads.streams) },
      paths,   // GRASS-PATH1
      curve: arena ? { px, py, byteAt: arenaRoadByte } : null,   // VOYAGER2: past the Bay, the roads drawn as curves (world/road/roadCurves.js)
    });
    // ROAD-LOOK: under a bridge the river runs - its deck's tiles over the channel laid back before the smoothing and the
    // waters' paint, which keeps a ford's (world/road/roadBridges.js); the pixel's own bridges to the host, which stands them
    if (arena && landforms) { unpaveBridges(tilemap, paths, px, py, arenaRoadByte); bridges = bridgesOf(px, py, arenaRoadByte); }
    // ROADS 10: the ground under the road is smoothed - after the paint,
    // before the grid is built from the samples. The network carries the
    // switch (`smooth`, default on, the design's SmoothRoads) so the
    // worker needs no settings access.
    if (roads.smooth !== false) smoothRoadHeights(samples, tilemap, 129, hasLocation ? locationRect : null);   // AUDIT 51: the mod skips the rect
    if (roads.smooth !== false && classic) smoothRoadHeights(classic, tilemap, 129, locationRect);   // AUDIT LANDFORMS II H2: DFU's own samples as its nature reads them
    if (!arena) {   // ROAD-DRY: the Bay's paving over the sea stands dry, its arms across the edges as their neighbours stand them
      // BAY-OWN: Basic Roads' bytes are the Bay's 1000 x 500 network, read where the Bay's own pixels are
      const crossings = roadCrossings(px, py, (x, y) => (x >= 0 && y >= 0 && x < MAP_W ? roads.roads?.[y * MAP_W + x] ?? 0 : 0) | arenaJoinByte(x, y), inBay);
      for (const S of classic ? [samples, classic] : [samples]) dryRoadHeights(S, tilemap, paths, 129, hasLocation ? locationRect : null, crossings);
    }
    // GATE-ROADS (world/road/gateRoads.js): a walled town's gates on their roads - after the painter and its smoothing, so
    // Basic Roads' tiles and the ground's heights are their own
    if (hasLocation && locationRect?.gateRoads) yardPaths = yardRoads(tilemap, paths, tileData, locationRect.gateRoads);   // FB1028 YARDS: #1184's roads
    if (hasLocation && locationRect?.gateRoads) layGateRoads(tilemap, paths, tileData, locationRect.gateRoads, locationRect.mask);   // FB1028: on its ground
    if (yardGround && locationRect?.ring) yardPaths = ringAsWas(yardPaths ?? paths, locationRect.ring, yardGround);   // FB1028 YARDS Y2
  }
  // CYRODIIL-WATERS: past the Bay the rivers' channels and the lakes the landforms carved are water to the squares (never
  // a location's own rect) - their shore laid by assignTiles, their sheet on the level ground (world/tamriel/tamrielWaters.js)
  if (landforms && !inBay(px, py)) paintTamrielWaters(tileData, px, py, hasLocation ? locationRect : null, undefined, paths);   // RIVER-FORDS: a road's tiles kept
  if (landforms && !inBay(px, py)) paintGen2Waters(tileData, px, py, hasLocation && !flattenAt?.own ? locationRect : null, HEIGHTMAP_DIMENSION, paths, WATER);   // A published region's rivers and lakes - a town of its own ground its water too
  // JUNGLE-TRAILS: the jungle's own trails worn into its corners before the squares run - dirt they blend, every tile
  // they touch kept as a track's is (world/jungle/jungleTrails.js); the heights never moved
  if (jungle) paths = paintJungleTrails(tileData, tilemap, paths, { px, py, nine: jungle.nine, whole: jungleWhole(jungle.nine), rect: hasLocation ? locationRect : null });
  assignTiles(tileData, tilemap, true);
  // WOD2: World of Daggerfall's "Smooth the terrain" arms
  // (LocationLoader.cs:174-230). The mod runs on
  // DaggerfallTerrain.OnPromoteTerrainData, which DFU raises AFTER the
  // tiles are assigned (CompleteMapPixelDataUpdate) and the heights are
  // pushed, and BEFORE the streamer lays the nature out - so here: the
  // tiles keep the unflattened slope's pattern, and the grid, the
  // collision floor and the nature below all read the levelled ground.
  // The averages ride back for the objects' height (:238); a pixel with
  // a real location starts from its own mean (MapData.averageHeight is
  // only ever computed there), every other from 0.
  const wodResult = wod && wod.picks.length ? applyPicks(samples, wod.picks, hasLocation ? avg : 0) : null;
  if (classic && wodResult) applyPicks(classic, wod.picks);   // AUDIT LANDFORMS II H2: DFU's nature reads the ground a site levelled (above) - so the beach it asks is DFU's own samples levelled by the same picks
  const tilemapBytes = convertTilemap(tilemap);
  // PERF-EXT26: the one grid law, the restride's too; AUDIT WATER-NEXT P1: and the bed under its water, carved here
  const grid = restrideGrid({ woods, px, py, stride, samples, landforms, bed: bed ? tilemapBytes : null, meets: meetsOf(meets, landforms) });
  // FOREST1's places - the location (hidden or not, as the caller says) and every World of Daggerfall SITE (the loader's
  // rect is only the last), each its whole footprint; never a rock field or a mountain (AUDIT FOREST1 F1: the caller marks
  // them `hide: false` and they are no place). BANTHA1: the jungle's clearings are the same places
  const placesFor = (hidden) => [
    ...(hasLocation && locationRect ? [{ ...locationRect, hide: !!hidden }] : []),
    ...(wod?.picks ?? []).filter((p) => p.hide !== false).map(({ rect: r, bounds: b }) => (b
      ? { xMin: b.xMin, xMax: b.xMax, yMin: b.yMin, yMax: b.yMax, hide: true }
      : { xMin: r.x, xMax: r.x + r.width, yMin: r.y, yMax: r.y + r.height, hide: true })),
  ];
  const natureOpts = {
    mapPixelX: px,
    mapPixelY: py,
    rawWorldHeight: woods.getHeightMapValue(px, py),
    climateType,
    // WOD2: the loader SETS MapData.locationRect to its site (:179/:208),
    // and the nature layout reads that field - so the trees keep their
    // clearance off a camp exactly as they keep it off a town.
    locationRect: wodResult?.locationRect ?? locationRect,
    // FOREST1: the places the woods close round or draw back from (placesFor, above), and the road painter's own track
    // mask, which a forest keeps off (AUDIT FOREST1 F8).
    forests: forests ? { archive: forests.archive, pois: placesFor(forests.hidden), paths } : null,
    ecotone,   // ECOTONE1: the neighbours' climates - a border's tiles laid by the climate the ground's border gives them
    // TESA-LANDS: past the Bay, the 3x3 of zones' lands (a zone's recipe lays its flats; its border blends with the row),
    // its places and the road painter's tracks, as FOREST1's are; on the Bay none
    lands: lands && !inBay(px, py) ? { nine: landsNine(px, py), blend: !!lands.blend, archive: lands.archive, pois: placesFor(lands.hidden), paths } : null,
    // AUDIT LANDFORMS II H2: and its beach line asked of DFU's own blend, as the tiles' is (D3) - on the shaped blend a
    // road's bed or a river's channel moved a coastal town's mean, and the line moved with it at 85 tiles in 43 of the
    // 351 coastal location pixels (a tree there, none here; the scatter's records reshuffled after each). The flats
    // still stand on the shaped ground.
    beach: classic,
  };
  // BANTHA1: the jungle over the pixel's own layout - its tiles laid again by the jungle's law, its clearings FOREST1's
  // places, its trees off the tracks as a forest's are; AUDIT BANTHA1 PERF-6: a pixel the jungle owns whole lays no
  // layout of its own - every flat of it would be dropped
  const { flats: nature, pairs: roadside, graht } = jungleLayout(jungle && jungleWhole(jungle.nine) ? [] : layoutNature(samples, tilemap, natureOpts), samples, tilemap,
    { ...natureOpts, jungle: jungle ? { nine: jungle.nine, pois: placesFor(jungle.hidden), paths, net: roads, canopy: jungle.canopy ?? null } : null });   // JUNGLE-ROADSIDE: and the network, its pairs astride the roads; GRAHT1: and the canopy's field, its graht-oaks
  // TESA-LANDS: past the Bay the zones' landmarks (world/lands/landProps.js) - the pixel's build keeps its flats off the
  // feet of those it stands (scenes/pixelBuild.js: a landmark the gate's clearing or a rock drops leaves its ground's own)
  const landProps = natureOpts.lands ? layoutLandProps(samples, tilemap, natureOpts) : new Float32Array(0);
  return { samples, tilemap, positions: grid.positions, normals: grid.normals, bed: grid.bed, tilemapBytes, avg, nature,
    paths,   // GRASS-PATH1: null when no network was present, as `withRoads` says, and no jungle trail ran (JUNGLE-TRAILS)
    roadside,   // JUNGLE-ROADSIDE: the jungle's roadside pairs (jungleLayout's), beside the flats - [] where none stands
    graht,   // GRAHT1: Valenwood's graht-oaks (jungleLayout's), beside the flats - empty where none stands
    landProps,   // TESA-LANDS: the lands' landmarks (world/lands/landProps.js, LAND_PROP_FLOATS each) - empty where none stands
    // ROADS 25: whether a network was PRESENT when this pixel was painted.
    // The network loads asynchronously and the world starts building at
    // once, so the first pixels can be painted with none - and were then
    // kept, roadless, while the map (rebuilt on arrival) showed the roads.
    withRoads: !!roads,
    arenaRoads: arenaPainted,   // TESA4: Arena's roads reached its paint - painted again when their layer moves
    wodAverages: wodResult ? wodResult.averages : null,   // WOD2: per pick, the normalized average its objects stand on
    beach: classic,   // AUDIT LANDFORMS II H2: DFU's own blend in a location's pixel (null else) - the gathering nodes' beach line
    yardPaths,   // FB1028 YARDS: the paths as #1184 laid them, the yards' alone (gateRoads.js yardRoads; Y2 its ring) - null with none
    yardGround,   // FB1028 YARDS Y2: the town's ground as #1184 drew it, the yards' alone - null with no outline
    townGround: locationRect?.mask ?? null,   // TS6: the town's ground (townGroundMask) - its walkers' (world/townShape.js shutOffGround)
    bridges,   // ROAD-LOOK: the bridges this pixel owns (world/road/roadBridges.js bridgesOf) - null on the Bay, or with the rivers uncarved
    meets: meetsOf(meets, landforms),   // ACROSS-EDGE: the meets its samples took - a restride's ghost rows
  };
}

/**
 * "fps issues in the exterior but
 * fine in the interior", "me too my friend.. don't know why. I got a
 * RX6600"): A PIXEL'S GRID AT A STRIDE, from its samples as the pixel
 * keeps them (post-blend, post-smoothing) and the ghost rows off the woods
 * for its edge normals (EV4). The build above, the world host's ring-class
 * swap (STREAM1's restride) and the terrain worker's `grid` job all run
 * this one law, so a promotion built on the worker is the bytes one built
 * on the main thread is, by construction.
 * The ghost rows are the neighbours' SHAPED ground - `landforms` when the caller holds them (the build
 * above), else made here from `landform` and the network (a promotion: the host's job, the worker's own network).
 * `bed` - the converted TileMap to carve
 * the water's bed by (world/water/waterBed.js), or null for none - and the answer carries it (`bed`: the depths and the carved
 * ground, null where no vertex is under water) beside the grid as it stood. WATER-NEXT 2 carved on the host's thread at
 * every build and restride, 0.3 ms for a pixel with no water at all and a millisecond or two for a coast's; here it rides
 * the worker with the grid it carves, the build's, the promotion's and the restride's alike.
 * @param {{ woods: object, px: number, py: number, stride?: number, samples: Float32Array, landform?: boolean, roads?: ?object, sites?: ?Uint8Array, beyond?: ?Map<number, number>, climates?: ?Uint8Array, landforms?: ?object, bed?: ?Uint8Array }} job
 * @returns {{ positions: Float32Array, normals: Float32Array, bed: ?{depths: Float32Array, sheet: ?object, positions: Float32Array, normals: Float32Array} }}
 */
export function restrideGrid({ woods, px, py, stride = 1, samples, landform = false, roads = null, sites = null, beyond = null, climates = null, landforms = null, bed = null, meets = null }) {   // AUDIT WATER-NEXT P1: `bed` the TileMap to carve by
  const lf = landforms ?? (landform ? createLandforms({ woods, roads, sites, beyond, climates }) : null);   // BAY-LEFT-GROUND: and the sites past the Bay
  const raw = ghostSampler(woods, px, py, HEIGHTMAP_DIMENSION, lf);
  const ghost = meets?.length ? (x, y) => meetLiftAt(px, py, meets, x, y, raw(x, y)) : raw;   // ACROSS-EDGE: the ghost rows the neighbours' met ground
  const grid = buildTerrainGrid(samples, stride, ghost);
  // AUDIT WATER-NEXT F2: a near grid's bed reads its neighbours' tiles across the seams (the ghost is their own kernel),
  // where its water comes near an edge
  const halo = bed && stride === 1 && bedNearEdge(bed) ? bedHalo(ghost, px, py, undefined, paintedWaterAt(px, py)) : null;   // And the waters the neighbours paint
  return { positions: grid.positions, normals: grid.normals, bed: bed ? gridBed(grid, bed, stride, halo, { px, py }) : null };
}

/** A grid's bed as the kernel answers it - the depths, the water's sheet at its level (WATER-LEVEL:
 *  `at` the pixel, whose bodies' own laws give it) and the carved ground, the grid untouched, and the seam's halo it was
 *  carved with (F2: kept by the host for a re-carve); null where no tile is water (world/water/waterBed.js waterBedOf).
 *  The host's re-carve (Deep Waters' TileMap) takes the same shape. */
export function gridBed(grid, bytes, stride = 1, halo = null, at = null) {
  const carved = waterBedOf(grid, bytes, { stride, halo, levelAt: at ? streamLevelAt(at.px, at.py, stride) : null });
  return carved ? { depths: carved.depths, sheet: carved.sheet, positions: carved.ground.positions, normals: carved.ground.normals, halo } : null;
}

/** A bed's buffers, for a worker's transfer list (the build's reply and the restride's alike). */
export const bedBuffers = (bed) => (bed ? [bed.depths.buffer, bed.positions.buffer, bed.normals.buffer, ...sheetBuffers(bed.sheet), ...(bed.halo ? [bed.halo.bits.buffer] : [])] : []);

/** FB1028 YARDS Y2 (the owner: every yard where #1184 stood it): the painted paths with the ring as #1184 painted it on
 *  the yards' ground - a tile today's ring (`ring`, townRoadRing over today's mask) paved there is none, as #1184's ring
 *  ran off that ground (townRoadRing over `yardGround`). Off it, the yards' shut closes every cell. A copy.
 *  @param {Uint8Array} paths @param {Uint8Array} ring @param {Uint8Array} yardGround */
export function ringAsWas(paths, ring, yardGround) {
  const out = Uint8Array.from(paths);
  for (let i = 0; i < out.length; i++) if (ring[i] && yardGround[i]) out[i] = 0;
  return out;
}

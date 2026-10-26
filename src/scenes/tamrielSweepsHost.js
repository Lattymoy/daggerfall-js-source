// HOST-SPLIT: moved verbatim out of src/scenes/world.js's bootWorld (bible/01-Overview/Host-Split.md) by tools/hostMove.mjs.
// The host constructs it where the code stood. What it reads of the host's scope comes through `host`: the
// settled names by value at construction, every live one (a `let` someone writes, a `const` made below) read at its
// use as `host.<name>` - as the code read them where it was.
import { arenaPixels } from '../world/arenaPlaces.js';
import { capitalOnPixel, capitalNear } from '../world/tamrielCapitals.js';
import { isWaterPixel } from '../ui/overworldModel.js';
import { layerTouches } from '../world/arenaRoads.js';
import { nearestFirstFrom } from '../world/streamingWorld.js';
import { inBay as onTheBay, tamrielFit } from '../world/tamriel/tamrielFrame.js';
import { tamrielLandVersion } from '../world/tamriel/tamrielLand.js';
import { WATER_BYTE } from '../world/roadsProducer.js';
import { createCapitalSkyline } from './capitalSkyline.js';   // IC-GRAND x FAR-LANDMARK: the Imperial City on the far ring's horizon
import { createCapitalPrebuild } from './capitalPrebuild.js';   // IC-GRAND's perf pass: the city's own made ahead on its worker

/** @param {any} host */
export function createTamrielSweeps(host) {
  const {
    destroyPixel, maps
  } = host;
  /** TESA2: THE ARENA SWEEP - a pixel beyond the Bay built before Arena's places stood as they stand now (the trace or
   *  the data landing after it, the Arena card's Attach or Remove) is built again, the way the late Hollow's is
   *  (sweepSdLate): each built pixel's Arena slot (its entry's `arenaSlot`) against the place standing on it now. Asked on the frame
   *  when the pixels' set moves (world/arenaPlaces.js arenaPixels: a new set a trace, a fit, a data set). */
  const _swept = { arena: null, capital: null, capitalLand: -1 };   // TESA2/TESA10: the pixel set and the fit and land each sweep last answered
  function sweepArenaPixels() {
    const now = arenaPixels();
    if (now === _swept.arena) return;
    _swept.arena = now;
    const again = [];
    for (const [, p] of host.built) {
      if (onTheBay(p.px, p.py)) continue;
      const place = now?.byPixel.get(`${p.px},${p.py}`) ?? null;
      if ((place ? `${place.provinceIndex}|${place.id}|${!!place.port}` : null) !== (p.arenaSlot ? `${p.arenaSlot.provinceIndex}|${p.arenaSlot.id}|${!!p.arenaSlot.port}` : null)) again.push({ px: p.px, py: p.py });   // TESA6: and its port
    }
    if (!again.length) return;
    const under = `${host.state.current.x},${host.state.current.y}`;
    if (host.walkMode && host.playerSpawned && again.some((k) => `${k.px},${k.py}` === under)) host._seasonHoldKey = under;
    for (const k of again) destroyPixel(k.px, k.py, { collectLoose: false });
    host.queue.push(...again.sort(nearestFirstFrom(host.state.current)));
    console.log(`[arena] ${again.length} pixel(s) beyond the Bay built again for Arena's places`);
  }
  /** TESA10: THE CAPITALS' SWEEP (sweepArenaPixels' shape) - on the frame, when the fit or the land moves (the trace
   *  landing after a pixel built: a capital's pixel is the fit's and its province's land's), every built pixel past the
   *  Bay where a capital stands now and none stood as it built, or the reverse, is built again. AUDIT-TESA A7-1: and,
   *  once the land has moved, every built pixel past the Bay the countryside and the lairs roll (their ground, climate
   *  and province are the land's) - all but Arena's places, sweepArenaPixels' own. */
  function sweepCapitalPixels() {
    capitalPrebuild.sweep();   // IC-GRAND's perf pass: its worker told the slices coming, before they are queued
    sweepCapitalLod();   // IC-GRAND
    capitalSkyline.sweep();   // IC-GRAND x FAR-LANDMARK: its silhouette past the stream, a slice a landmark
    const fit = tamrielFit(), land = tamrielLandVersion();
    if (fit === _swept.capital && land === _swept.capitalLand) return;
    const moved = _swept.capital !== null;   // the first frame's ask is the fit the pixels were built by
    _swept.capital = fit;
    _swept.capitalLand = land;
    const again = [];
    for (const [, p] of host.built) {
      if (onTheBay(p.px, p.py)) continue;
      const had = host.locationIndex.get(`${p.px},${p.py}`), cap = !!capitalOnPixel(p.px, p.py);
      const rolled = moved && !!(host._countryTemplates || host._lairTemplates) && !cap && !had?.capital && !had?.arena;
      if (rolled || cap !== !!had?.capital) again.push({ px: p.px, py: p.py });
    }
    if (!again.length) return;
    const under = `${host.state.current.x},${host.state.current.y}`;
    if (host.walkMode && host.playerSpawned && again.some((k) => `${k.px},${k.py}` === under)) host._seasonHoldKey = under;
    for (const k of again) destroyPixel(k.px, k.py, { collectLoose: false });
    host.queue.push(...again.sort(nearestFirstFrom(host.state.current)));
    console.log(`[capitals] ${again.length} pixel(s) beyond the Bay built again for the capitals`);
  }
  /** IC-GRAND (bible/03-World/Arena-Provinces.md IC-GRAND): THE IMPERIAL CITY NEAR AND FAR - its slices within NEAR_RING of
   *  the player's pixel built near (their blocks, their fabric, their walkers), the rest far (world/tamrielCapitals.js
   *  capitalBuildView: their skylines' masses, no collider, no walker); a near one kept near NEAR_SLACK further, so a walk
   *  along a pixel's edge builds nothing twice. Asked on the frame, but walked only when the player's pixel or the built set
   *  moves - the built pixels alone (the stream's few dozen), never the city's 625 slices: each built pixel whose view is
   *  not the one it is built in now is built again, the ones coming near first (at the queue's head, nearest first - the
   *  far ring and the city's landmarks stand in the hole while it builds, scenes/capitalSkyline.js), the ones going far
   *  last. */
  const _lod = { at: null, size: -1 };
  /** IC-GRAND x FAR-LANDMARK: the city's landmarks on the far ring (`host.farRing`, null on the classic skin). */
  const capitalSkyline = createCapitalSkyline(host);
  /** IC-GRAND's perf pass: the city's worker told what the stream is about to build (scenes/capitalPrebuild.js). */
  const capitalPrebuild = createCapitalPrebuild(host);
  function sweepCapitalLod() {
    const cur = host.state.current, at = cur ? `${cur.x},${cur.y}` : null;
    if (at === _lod.at && host.built.size === _lod.size) return;
    _lod.at = at;
    _lod.size = host.built.size;
    const near = [], far = [];
    for (const [, p] of host.built) {
      if (!p.capitalLod) continue;
      const want = capitalNear(p.px, p.py, cur, p.capitalLod) ? 'near' : 'far';
      if (want !== p.capitalLod) (want === 'near' ? near : far).push({ px: p.px, py: p.py });
    }
    if (!near.length && !far.length) return;
    for (const k of [...near, ...far]) destroyPixel(k.px, k.py, { collectLoose: false });
    host.queue.unshift(...near.sort(nearestFirstFrom(cur)));
    host.queue.push(...far.sort(nearestFirstFrom(cur)));
    _lod.size = host.built.size;
  }
  /** TESA5: land, for a crossing's run - the Bay's own water law on the Bay (the fit's), the ground's beach line past it. */
  const arenaJoinLand = (x, y) => (onTheBay(x, y) ? !isWaterPixel(maps.getClimateIndex(x, y), host.woods.getHeightMapValue(x, y)) : host.woods.getHeightMapValue(x, y) > WATER_BYTE);
  /** TESA4: THE ROADS PAST THE BAY LANDED (world/terrain/terrainGenClient.js addArenaRoads) - TESA14: a region's layer, or the
   *  crossings' joins with the layer reset. Each built pixel posted under an older layer (off the Bay, or on it where a
   *  crossing's join runs - TESA5) that the new layer reaches, or - the layer reset - whose paint the roads reached, is
   *  built again (sweepSdLate's shape); a pixel still in flight is asked as it publishes (arenaRoadsStale). */
  const _arenaRoadsStale = new Set();
  const arenaRoadsStale = (p, epoch, layer, reset = true) => p.arenaRoadsEpoch < epoch && ((reset && p.arenaRoadsPainted) || layerTouches(layer, p.px, p.py));   // TESA5: a Bay pixel too, where a join runs
  function arenaRoadsLanded(epoch, layer, reset = false) {
    for (const [k, p] of host.built) if (arenaRoadsStale(p, epoch, layer, reset)) _arenaRoadsStale.add(k);
    if (_arenaRoadsStale.size) console.log(`[arena] the roads past the Bay landed: ${layer ? layer.roads.size + layer.tracks.size : 0} path pixels, ${_arenaRoadsStale.size} built pixel(s) to paint again`);
  }
  function sweepArenaRoads() {
    const again = [];
    for (const k of _arenaRoadsStale) {
      const p = host.built.get(k);
      if (p) { again.push({ px: p.px, py: p.py }); _arenaRoadsStale.delete(k); }
      else if (!host.inFlight.has(k)) _arenaRoadsStale.delete(k);   // not standing: it builds with the layer as it is now
    }
    if (!again.length) return;
    const under = `${host.state.current.x},${host.state.current.y}`;
    if (host.walkMode && host.playerSpawned && again.some((k) => `${k.px},${k.py}` === under)) host._seasonHoldKey = under;
    for (const k of again) destroyPixel(k.px, k.py, { collectLoose: false });
    host.queue.push(...again.sort(nearestFirstFrom(host.state.current)));
  }
  return { _arenaRoadsStale, arenaJoinLand, arenaRoadsLanded, arenaRoadsStale, sweepArenaPixels, sweepArenaRoads, sweepCapitalPixels, sweepCapitalLod, capitalSkyline, capitalPrebuild };
}

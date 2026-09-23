// ═══════════════════════════════════════════════════════════════════
// WOD2 - WORLD OF DAGGERFALL: THE MOD, AS THE STREAMING HOST RUNS IT.
//
// LocationModLoader.Init (LocationModLoader.cs:9-19) adds ONE
// LocationLoader to the scene at the Start state - the title screen -
// and it lives for the rest of the game: its instance list is built
// once and only ever grows. This module is that object, one per page:
//
//   open()        - LocationLoader.Awake (LocationLoader.cs:28-64): the
//                   prefabs (read through the ported LoadLocationPrefab,
//                   from the author's own files), then region 17's folder.
//   noteRegion(r) - PlayerGPS.OnRegionIndexChanged -> OnRegionChanged
//                   (:67-89): the region's folder appended, in EVENT
//                   order however the fetches land.
//   picksFor()    - AddLocation's decision (wodLocationLoader.js), after
//                   every folder already announced has landed.
//   placements()  - AddLocation's object loop through LoadObject
//                   (wodLocationObjects.js), as data the host stands.
//
// THE ROOM'S LIST (online). DFU has no room, and the list a single
// player builds depends on where that player has travelled: region 17,
// then every region in the order entered. Two players who stand on the
// same pixel with different travels can pick different instances on
// the 177 pixels named from two folders, and on the border pixels of a
// region only one of them has entered - and this mod LEVELS THE GROUND,
// which is exactly what the room has to agree on (onlineLane.js, the
// roads' reason). So on an online page the list is every folder at
// once, in one order: 17 (Awake's), then ascending. Offline it is the
// reference's, path and all.
//
// A region with NO folder (18 of the 62 have none): the C#'s
// Directory.GetFiles throws DirectoryNotFoundException out of the event
// handler, and because PlayerGPS only advances lastRegionIndex AFTER
// raising the event, it throws again every frame the player stays
// there. That storm changes nothing in this mod's own world (there is
// nothing to load) and would starve every later subscriber; the port
// loads nothing and throws nothing.
// ═══════════════════════════════════════════════════════════════════

import { modSetting } from '../systems/modSettings.js';
import { loadLocationPrefab, validateValue } from './wodLocationData.js';
import { decodeRegionPack } from './wodLocationPack.js';
import {
  LocationSession, pickLocations, placeObjects, WOD_AWAKE_REGION, WOD_REFUSED_REGION,
} from './wodLocationLoader.js';
import { classifyObject, objectMatrix, objectNormalMatrix } from './wodLocationObjects.js';

export const WOD_VENDOR = 'world-of-daggerfall';
/** The mod's switch, read where the world mounts (the loader is built
 *  once per world, as DFU builds it once per run). */
export const wodOn = () => !!modSetting(WOD_VENDOR, 'Enabled');

const IN_BROWSER = typeof window !== 'undefined';
// Vite's glob doors (the dynamic-skies pattern): the packs as URLs the
// build emits beside the bundle (INLINE1 keeps anything under vendor/
// out of the JS), the prefabs as text, each its own lazy chunk. Node
// sees empty tables and the tests feed the same files off the disk.
const PACK_URLS = IN_BROWSER
  ? import.meta.glob('../../vendor/world-of-daggerfall/Locations/*.bin', { eager: true, query: '?url', import: 'default' })
  : {};
const PREFAB_TEXT = IN_BROWSER
  ? import.meta.glob('../../vendor/world-of-daggerfall/LocationPrefab/*.txt', { query: '?raw', import: 'default' })
  : {};

const baseName = (p) => p.split('/').pop();

/** The browser's sources: a region's pack bytes (null for a folder the
 *  mod does not ship) and every prefab's text by name. */
export const browserWodSources = Object.freeze({
  regions: () => Object.keys(PACK_URLS).map((p) => Number(baseName(p).replace(/\.bin$/, ''))).sort((a, b) => a - b),
  pack: async (region) => {
    const url = Object.entries(PACK_URLS).find(([p]) => baseName(p) === `${region}.bin`)?.[1];
    if (!url) return null;
    const r = await fetch(url);
    if (!r.ok) throw new Error(`World of Daggerfall: region ${region} pack ${r.status}`);
    return new Uint8Array(await r.arrayBuffer());
  },
  prefabs: async () => {
    const out = new Map();
    await Promise.all(Object.entries(PREFAB_TEXT).map(async ([p, load]) => {
      out.set(baseName(p).replace(/\.txt$/, ''), await load());
    }));
    return out;
  },
});

export class WodWorld {
  /**
   * @param {{regions:() => number[], pack:(r:number) => Promise<?Uint8Array>,
   *   prefabs:() => Promise<Map<string,string>>}} sources
   * @param {{online?:boolean, warn?:(m:string) => void}} [opts]
   */
  constructor(sources, { online = false, warn = (m) => console.warn(m) } = {}) {
    this.sources = sources;
    this.online = online;
    this.warn = warn;
    this.session = new LocationSession();
    /** name -> LocationPrefab, or null for a file that failed to read */
    this.prefabs = new Map();
    this._chain = Promise.resolve();   // folder appends, in announcement order
    this._announced = new Set();
    this._lastRegion = WOD_AWAKE_REGION;   // PlayerGPS.Start's seed: the title screen's region
    this._opened = null;
  }

  /** Awake: the prefabs, then region 17 (online: every folder). */
  open() {
    this._opened ??= (async () => {
      const texts = await this.sources.prefabs();
      for (const [name, text] of texts) {
        try { this.prefabs.set(name, loadLocationPrefab(text)); } catch (e) {
          // LoadLocationPrefab throws on a broken file; AddLocation would
          // throw with it at every pixel naming it. The shipped 65 all read.
          this.warn(`[wod] prefab ${name} failed to read: ${e?.message ?? e}`);
          this.prefabs.set(name, null);
        }
      }
      if (this.online) {
        const order = [WOD_AWAKE_REGION, ...this.sources.regions().filter((r) => r !== WOD_AWAKE_REGION)];
        for (const r of order) this._announce(r);
      } else {
        this._announce(WOD_AWAKE_REGION);
      }
      await this._chain;
    })();
    return this._opened;
  }

  _announce(region) {
    if (this._announced.has(region)) return;
    this._announced.add(region);
    // Fetch now, append in order: a later region's bytes may land first.
    const bytes = this.sources.pack(region).catch((e) => {
      this.warn(`[wod] region ${region} did not load: ${e?.message ?? e}`);
      return null;
    });
    this._chain = this._chain.then(async () => {
      const b = await bytes;
      if (!b) return;
      this.session.appendRegion(region, decodeRegionPack(b));
    });
  }

  /**
   * PlayerGPS.OnRegionIndexChanged -> LocationLoader.OnRegionChanged.
   * The host calls this with the region under the player on every map
   * pixel crossing (the only moment the region can change) and before
   * every build, so the event fires exactly when CurrentRegionIndex
   * differs from the last one.
   */
  noteRegion(region) {
    if (region === this._lastRegion) return;
    this._lastRegion = region;
    if (region === WOD_REFUSED_REGION) return;   // :76-80
    if (this.online) return;                     // the room's list holds every folder already
    this._announce(region);
  }

  /** Every folder announced so far has landed. */
  settle() { return this._chain; }

  /**
   * AddLocation's decision for one pixel (wodLocationLoader.pickLocations).
   * @param {{mapPixelX:number, mapPixelY:number, hasLocation:boolean,
   *   mapRegionIndex:number, worldHeight:number}} tile
   * @param {?(x:number, y:number) => number} pathsPoint
   */
  picksFor(tile, pathsPoint = null) {
    return pickLocations(tile, this.session, (name) => this.prefabs.get(name) ?? null, pathsPoint);
  }

  /**
   * AddLocation's object loop for a pixel's picks, through LoadObject:
   * everything the host stands, tile-local. `stopped` is the C#'s
   * uint.Parse throwing on a negative model name - the handler dies
   * there, and nothing after it on the pixel is stood.
   * @param {Array<object>} picks - picksFor's answer
   * @param {number[]} averages - the kernel's, one per pick
   */
  placements(picks, averages) {
    const out = { models: [], flats: [], lights: [], animals: [], spawners: [], stopped: false };
    picks.forEach((pick, i) => {
      if (out.stopped) return;
      for (const { obj, pos } of placeObjects(pick, averages[i], validateValue)) {
        const c = classifyObject(obj);
        if (c.kind === 'model') {
          if (c.modelId == null) { out.stopped = true; return; }
          out.models.push({
            modelId: c.modelId, matrix: objectMatrix(pos, obj.rot, obj.scale),
            normalMatrix: objectNormalMatrix(obj.rot, obj.scale), objectID: obj.objectID,
          });
          continue;
        }
        const flat = { archive: c.archive, record: c.record, base: pos, scale: obj.scale };
        if (c.visible) out.flats.push(flat);
        if (c.light) out.lights.push(flat);
        if (c.animal) out.animals.push(flat);
        for (const s of c.spawners) {
          out.spawners.push({
            ...s, archive: c.archive, record: c.record, base: pos, scaleY: obj.scale.y, treasure: c.treasure,
            locationID: this.session.locationID[pick.index], objectID: obj.objectID,
          });
        }
      }
    });
    return out;
  }
}

/**
 * The per-light colour array for a composed exterior light set:
 * withPlayerLights prepends the player's own lights, and they wear the
 * SHARED colour they always wore on the shared channel; the selection
 * behind them wears the colours the selection answered (the lanterns
 * the shared colour, the mod's lights their own).
 * @param {number} count - lights in the composed set
 * @param {number} nPlayer - how many of them the player's lights are
 * @param {Float32Array} selColors - nearestLights' colour arm
 * @param {ArrayLike<number>} shared - the host's lantern colour
 * @returns {Float32Array}
 */
export function wodLightColors(count, nPlayer, selColors, shared) {
  const out = new Float32Array(count * 3);
  const lead = Math.min(nPlayer, count);
  for (let i = 0; i < lead; i++) { out[i * 3] = shared[0]; out[i * 3 + 1] = shared[1]; out[i * 3 + 2] = shared[2]; }
  out.set(selColors.subarray(0, (count - lead) * 3), lead * 3);
  return out;
}

let _world = null;
/** The page's one loader (LocationModLoader's GameObject), made on the
 *  first world that mounts with the mod on and kept for the page. */
export function openWodWorld({ online = false, sources = browserWodSources } = {}) {
  if (!_world || _world.online !== online) _world = new WodWorld(sources, { online });
  return _world;
}

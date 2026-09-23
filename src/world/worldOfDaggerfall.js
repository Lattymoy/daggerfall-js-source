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
// the 176 pixels named from two folders, and on the border pixels of a
// region only one of them has entered - and this mod LEVELS THE GROUND,
// which is exactly what the room has to agree on (onlineLane.js, the
// roads' reason). So on an online page the list is every folder at
// once, in one order: 17 (Awake's), then ascending. Offline it is the
// reference's, path and all.
//
// A region with NO folder (18 of the 62 have none; 31 is refused before
// the read, so 17): the C#'s Directory.GetFiles throws DirectoryNotFoundException out of the event
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

/** AUDIT BRANCH (WoD) M2: how long a pack download may go without a byte before it is abandoned, and how many
 *  times it is tried. Every build waits on the folders announced before it (settle), so a fetch that never
 *  answered stalled the whole stream for good; a stall is now bounded, and a region that fails every attempt is
 *  warned and skipped - the camps it would have stood are lost, the world streams on. */
export const WOD_PACK_STALL_MS = 15000;
export const WOD_PACK_ATTEMPTS = 3;

/**
 * One pack's bytes: each attempt aborted after `stallMs` with no byte arriving (a slow line is not a dead one),
 * a failed attempt retried after 1 s, then 2 s.
 * @param {string} url
 * @param {{fetchFn?:typeof fetch, stallMs?:number, attempts?:number, sleep?:(ms:number) => Promise<void>}} [opts]
 * @returns {Promise<Uint8Array>}
 */
export async function fetchPackBytes(url, { fetchFn = globalThis.fetch, stallMs = WOD_PACK_STALL_MS, attempts = WOD_PACK_ATTEMPTS, sleep = (ms) => new Promise((r) => setTimeout(r, ms)) } = {}) {
  let last = null;
  for (let a = 0; a < attempts; a++) {
    if (a) await sleep(1000 * a);
    const ctl = new globalThis.AbortController();
    let timer = null;
    const poke = () => { clearTimeout(timer); timer = setTimeout(() => ctl.abort(new Error(`no byte in ${stallMs} ms`)), stallMs); };
    try {
      poke();
      const r = await fetchFn(url, { signal: ctl.signal });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const reader = r.body?.getReader?.();
      if (!reader) return new Uint8Array(await r.arrayBuffer());
      const parts = [];
      let n = 0;
      for (;;) {
        poke();
        const { done, value } = await reader.read();
        if (done) break;
        parts.push(value);
        n += value.length;
      }
      const out = new Uint8Array(n);
      let o = 0;
      for (const part of parts) { out.set(part, o); o += part.length; }
      return out;
    } catch (e) {
      last = e;
    } finally {
      clearTimeout(timer);
    }
  }
  throw last ?? new Error('no attempt made');
}

/** The browser's sources: a region's pack bytes (null for a folder the
 *  mod does not ship) and every prefab's text by name (null for one
 *  whose chunk did not load - AUDIT BRANCH (WoD) M2). */
export const browserWodSources = Object.freeze({
  regions: () => Object.keys(PACK_URLS).map((p) => Number(baseName(p).replace(/\.bin$/, ''))).sort((a, b) => a - b),
  pack: async (region) => {
    const url = Object.entries(PACK_URLS).find(([p]) => baseName(p) === `${region}.bin`)?.[1];
    if (!url) return null;
    try { return await fetchPackBytes(url); } catch (e) {
      throw new Error(`World of Daggerfall: region ${region} pack: ${e?.message ?? e}`);
    }
  },
  prefabs: async () => {
    const out = new Map();
    await Promise.all(Object.entries(PREFAB_TEXT).map(async ([p, load]) => {
      out.set(baseName(p).replace(/\.txt$/, ''), await load().catch(() => null));
    }));
    return out;
  },
});

/** WOD6: a region whose pack failed every try the chain gave it is tried again in the background - 5 s after, then
 *  doubling to a minute between tries - and given up after this many more. */
export const WOD_RETRY_MAX = 12;
const FAILED = Symbol('failed');   // a fetch that failed, as against `null`: a region the mod ships no folder for

export class WodWorld {
  /**
   * @param {{regions:() => number[], pack:(r:number) => Promise<?Uint8Array>,
   *   prefabs:() => Promise<Map<string,?string>>}} sources
   * @param {{online?:boolean, warn?:(m:string) => void, schedule?:(fn:() => void, ms:number) => void}} [opts]
   */
  constructor(sources, { online = false, warn = (m) => console.warn(m), schedule = (fn, ms) => { setTimeout(fn, ms); } } = {}) {
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
    this._awake = false;   // AUDIT BRANCH (WoD) M2: Awake's folder announced - a region heard before it waits
    this._early = [];
    // WOD6: A REGION THAT FAILED IS NOT LOST. The list's ORDER is the law (the first valid instance naming a pixel
    // takes it), so a region that lands late is not appended where it lands: the list is built again with every
    // region in the order it was announced, and the host is told which pixels the region names, to build them again.
    this._order = [];          // every region announced, in the list's order (the events'; online, 17 then ascending)
    this._bytes = new Map();   // region -> its pack, once read - what a list rebuilt around a late region is made of
    this._schedule = schedule;
    /** @type {?(region:number, pixelKeys:Set<string>) => void} */
    this.onLate = null;
  }

  /** Awake: the prefabs, then region 17 (online: every folder). */
  open() {
    this._opened ??= (async () => {
      const texts = await this.sources.prefabs();
      for (const [name, text] of texts) {
        if (text == null) { this.warn(`[wod] prefab ${name} did not load`); this.prefabs.set(name, null); continue; }   // AUDIT BRANCH (WoD) M2
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
      // AUDIT BRANCH (WoD) M2: a region heard while the prefabs loaded is announced now, after Awake's - the C#'s
      // event cannot fire before its Awake, so region 17 is first whoever asks early
      this._awake = true;
      for (const r of this._early.splice(0)) this._announce(r);
      await this._chain;
    })();
    return this._opened;
  }

  _announce(region) {
    if (this._announced.has(region)) return;
    this._announced.add(region);
    this._order.push(region);   // WOD6
    // Fetch now, append in order: a later region's bytes may land first.
    const bytes = this.sources.pack(region).catch((e) => {
      this.warn(`[wod] region ${region} did not load: ${e?.message ?? e}`);
      return FAILED;
    });
    this._chain = this._chain.then(async () => {
      const b = await bytes;
      if (b === FAILED) { this._retryLater(region, 0); return; }   // WOD6: tried again, off the chain
      if (!b) return;
      // AUDIT BRANCH (WoD) n: one decode a task - an online page's 44 packs landed back to back in one block of up
      // to 88 ms; each is at most ~15 ms alone
      await new Promise((r) => setTimeout(r, 0));
      // AUDIT BRANCH (WoD) M2: a pack that will not decode is that region lost, never the chain - a throw here left
      // `_chain` rejected for good, so every later settle() rejected and every pixel build after it failed
      try { this.session.appendRegion(region, decodeRegionPack(b)); this._bytes.set(region, b); } catch (e) {
        this.warn(`[wod] region ${region} did not read: ${e?.message ?? e}`);
        this._retryLater(region, 0);   // WOD6: a body that would not read may be a proxy's page, not the pack
      }
    });
  }

  /** WOD6: the next background try for a region that failed - the fetch runs OFF the chain, so no build waits on it,
   *  and only the landing joins it, ordered after every append already announced. */
  _retryLater(region, tries) {
    if (tries >= WOD_RETRY_MAX) {
      this.warn(`[wod] region ${region} gave up after ${tries} more tries - its sites stay unstood for this page`);
      return;
    }
    this._schedule(() => {
      this.sources.pack(region).then(
        (b) => { if (b) this._chain = this._chain.then(() => this._landLate(region, b, tries + 1)); },
        () => this._retryLater(region, tries + 1));
    }, Math.min(60000, 5000 * 2 ** tries));
  }

  /** WOD6: a late region lands - the list built again in its order, the host told what the region names. */
  async _landLate(region, b, tries) {
    let pack;
    try { pack = decodeRegionPack(b); } catch (e) {
      this.warn(`[wod] region ${region} did not read: ${e?.message ?? e}`);
      this._retryLater(region, tries);
      return;
    }
    this._bytes.set(region, b);
    const session = new LocationSession();
    for (const r of this._order) {
      const rb = this._bytes.get(r);
      if (!rb) continue;
      await new Promise((res) => setTimeout(res, 0));   // one decode a task, as the first landing
      session.appendRegion(r, r === region ? pack : decodeRegionPack(rb));
    }
    this.session = session;   // swapped whole: a pick reads one list or the other, never half of one
    const keys = new Set();
    for (let i = 0; i < pack.count; i++) keys.add(`${pack.worldX[i]},${pack.worldY[i]}`);
    this.warn(`[wod] region ${region} landed late - the list is in its order again (${keys.size} pixel(s) named)`);
    this.onLate?.(region, keys);
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
    if (!this._awake) { this._early.push(region); return; }   // AUDIT BRANCH (WoD) M2: after Awake's folder
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
    // WOD6: a late landing swaps the list whole, and a build awaits between its pick and its placements - the
    // instance's identity is read here, from the list the pick came from, never through its index into a newer one
    const session = this.session;
    return pickLocations(tile, session, (name) => this.prefabs.get(name) ?? null, pathsPoint)
      .map((pick) => ({ ...pick, locationID: session.locationID[pick.index] }));
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
            locationID: pick.locationID, objectID: obj.objectID,
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

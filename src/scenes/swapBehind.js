// @ts-check
// IC-SWAP-BEHIND (2026-10-26, the owner walking the Imperial City: "Weird pop in issues in the city when moving"; "No band
// aids for any of this"; bible/01-Overview/Host-Split.md, bible/03-World/Arena-Provinces.md IC-GRAND) - A PIXEL BUILT AGAIN
// BEHIND THE ONE THAT STANDS. Every rebuild of a standing pixel tore it down and then queued its build - a season's
// re-skin, the roads or a region landing late, Arena's places and the capitals' slices, a slice of the Imperial City
// going near or far - and for the build's whole length (breathed at a few milliseconds a frame: seconds) the pixel stood
// nothing: its ground gone to the far ring's coarse cell, its buildings to the horizon's silhouette, until the new view
// landed. Here the view that stands STAYS until the one built behind it is published, and the swap is one step:
//
//  - MARK (`mark`): a rebuild of a standing pixel takes the carry its build reads BEFORE it publishes (scenes/world.js
//    destroyPixel's own, `carryOnly` - World of Daggerfall's markers and its Hold, which the build adopts), and owes the
//    pixel a build behind; the rest of its carry (the deep water's rubble, the ground the landforms' pools ride - read
//    after the publish) is taken at the swap's teardown, as ever, and never twice (`carried`). The caller queues it as it
//    always did. The player standing on the view rides the ground's move at the swap as the hold's player did
//    (scenes/world.js rideGround) - no hold: the ground never went.
//  - BUILD (`keyFor`): the build lays every keyed thing of its own under the BEHIND key (`<px>,<py>#b`) - its collider
//    bucket and its gates' (HELD: in no query - player/collider.js hold), its cover (ai/cover.js, held), its place hold,
//    its ledger (BUILD-FAIL1) - and stages its doors on its own ledger (`made.doors`), never in the world's door list; what
//    reads the pixel's identity (`built`, the carries, the stale sets) reads its own key. So neither buffer's collider
//    nor door keys ever meet: the old view's stand and answer, the new view's wait unseen and unfelt.
//  - PUBLISH (`publish`): in one step, no frame between - the old view down (destroyPixel, its carry already taken: its
//    buckets, cover, gates and doors under the pixel's own key), the new view's woken under the pixel's own key (its
//    buckets and their cover and withheld late parts; its gates' keys in its entry; its doors into the world's list), and
//    the new entry published. There is no frame with neither view and none with both.
//  - A build that fails (`failed`) lets its held buckets and staged doors go and leaves the old view standing; a mark that
//    comes while the build behind is under way (`again`) is built once more after the publish, from the state as it is.
//
// THE KILL SWITCH: `?swapbehind=off` (swapBehindOff) - every rebuild as it was: torn down, then built.
//
// Pure but for the host it is handed (scenes/tamrielSweepsHost.js makes it for scenes/world.js - HOST-SPLIT): `built`,
// `destroyPixel`, `collider`, `buildingDoors`, `doorsMoved` (the door list's generation), `queue`, `nearestFirst`,
// `state`, `walkMode`, `playerSpawned`, `seasonHold` (the pixel under the player held while it is down - never needed
// behind: it stands), `off`.

/** The suffix of a build's own key while it builds behind its pixel's standing view. */
export const BEHIND = '#b';
/** A pixel's behind key. @param {string} key */
export const behindKeyOf = (key) => `${key}${BEHIND}`;
/** IC-SWAP-BEHIND's kill switch: `?swapbehind=off` builds every rebuild as it was - torn down, then built.
 *  @param {string | undefined} [search] */
export function swapBehindOff(search = globalThis.location?.search) {
  try { return /[?&]swapbehind=off\b/.test(search ?? ''); }
  catch { return false; }
}

/**
 * @param {{ built: Map<string, any>, destroyPixel: (px: number, py: number, o?: any) => void, collider: any,
 *   buildingDoors: any[], doorsMoved: () => void, queue: any[], nearestFirst: (from: any) => (a: any, b: any) => number,
 *   state: { current: { x: number, y: number } }, walkMode: () => boolean, playerSpawned: () => boolean,
 *   seasonHold: (key: string) => void, off?: () => boolean }} host
 */
export function createSwapBehind(host) {
  /** The pixels owed a build behind their standing view: key -> { started (its build under way), again (marked since) }.
   *  @type {Map<string, { started: boolean, again: boolean }>} */
  const owed = new Map();
  const off = () => !!host.off?.();
  let swaps = 0;
  const api = {
    /** Would a rebuild of `key` build behind a view that stands - the switch on and the pixel built. @param {string} key */
    stands: (key) => !off() && host.built.has(key),
    /**
     * MARK: a rebuild of pixel (px, py). Behind its standing view (true): its rebuild's carry taken now, the pixel owed a
     * build behind. Nothing standing, or the switch off (false): torn down here as it always was. Either way the caller
     * queues it.
     * @param {number} px @param {number} py
     */
    mark(px, py) {
      const key = `${px},${py}`;
      if (!api.stands(key)) { host.destroyPixel(px, py, { collectLoose: false }); return false; }
      const o = owed.get(key);
      if (o) { if (o.started) o.again = true; return true; }   // queued: it builds from the state as it is then
      host.destroyPixel(px, py, { collectLoose: false, carryOnly: true });   // the carry its rebuild reads, the view standing
      owed.set(key, { started: false, again: false });
      return true;
    },
    /** A pixel owed a build behind its view. @param {string} key */
    owes: (key) => owed.has(key),
    /**
     * BUILD: the key a build of (px, py) lays its own under - its pixel's, or (owed a build behind) the behind key, its
     * buckets and cover held from now.
     * @param {number} px @param {number} py
     */
    keyFor(px, py) {
      const key = `${px},${py}`, o = owed.get(key);
      if (!o) return key;
      if (!o.started && !host.built.has(key)) { owed.delete(key); return key; }   // its view let go meanwhile (streamed out): built as ever
      o.started = true;
      const b = behindKeyOf(key);
      host.collider.hold(b);
      return b;
    },
    /**
     * PUBLISH: the new entry stands for pixel (px, py) - built under `rkey` (keyFor's), its doors staged on `made.doors`.
     * Behind: the old view down, the new one's woken under the pixel's own key, then published - one step.
     * @param {number} px @param {number} py @param {string} rkey @param {any} made @param {any} entry
     */
    publish(px, py, rkey, made, entry) {
      const key = `${px},${py}`;
      swaps += 1;
      if (rkey === key) { host.built.set(key, entry); return entry; }
      const o = owed.get(key);
      owed.delete(key);
      host.destroyPixel(px, py, { collectLoose: false, carried: true });   // the old view: its carry was taken at the mark
      host.collider.wake(rkey, key);   // its bucket and its gates' (`<key>:gate:<n>`), their cover and withheld parts
      entry.placeHold?.rekey?.(key);   // its place hold the pixel's: the old view's keep (released just now) settled by it
      for (const g of entry.cityGates ?? []) if (typeof g.bucketKey === 'string' && g.bucketKey.startsWith(`${rkey}:`)) g.bucketKey = key + g.bucketKey.slice(rkey.length);
      const doors = made?.doors ?? [];
      for (const d of doors) d.pixelKey = key;
      if (doors.length) { host.buildingDoors.push(...doors); host.doorsMoved(); }
      host.built.set(key, entry);
      if (o?.again) { api.mark(px, py); host.queue.unshift({ px, py }); }
      return entry;
    },
    /**
     * A build of (px, py) that failed: behind, its held buckets let go (its staged doors were never the world's) and the
     * old view left standing - the key it built under, for the host's own ledger to free; null where it built as ever.
     * @param {number} px @param {number} py
     */
    failed(px, py) {
      const key = `${px},${py}`, o = owed.get(key);
      if (!o?.started) return null;
      owed.delete(key);
      const b = behindKeyOf(key);
      host.collider.unhold(b);   // its bucket and its gates', their cover
      return b;
    },
    /**
     * A SET OF PIXELS BUILT AGAIN (the sweeps' own tail - the roads, the late regions, the breach's clearing, the season,
     * Arena's places, the capitals and their slices): the walking player's own pixel, where it goes down, held BEFORE the
     * ground goes (FIX-C; ROAD-H H3: only if it is one going - behind its view it stands, and nothing is held); each
     * marked (behind its view, or torn down); and queued nearest the player first, the load list's own order
     * (StreamingWorldState._loadList).
     * @param {Array<{ px: number, py: number }>} again @param {{ front?: boolean }} [o] `front`: at the queue's head
     */
    rebuild(again, { front = false } = {}) {
      if (!again.length) return;
      const under = `${host.state.current.x},${host.state.current.y}`;
      if (host.walkMode() && host.playerSpawned() && !api.stands(under) && again.some((k) => `${k.px},${k.py}` === under)) host.seasonHold(under);
      for (const k of again) api.mark(k.px, k.py);
      const sorted = again.sort(host.nearestFirst(host.state.current));
      if (front) host.queue.unshift(...sorted); else host.queue.push(...sorted);
    },
    /** The pixels owed a build behind (probes, pins). */
    get owed() { return owed.size; },
    /** Every publish so far - a view swapped in moves no set's size, so a sweep that walks on the size asks this too. */
    get swaps() { return swaps; },
  };
  return api;
}

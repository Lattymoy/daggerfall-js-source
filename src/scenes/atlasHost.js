// @ts-check
// FOUNDATION F1 (2026-10-30, bible/03-World/Foundation-Arc.md) - THE ATLAS IN THE STREAMING WORLD: the surface the world's
// places are read through whole (world/atlas/atlas.js). A place's bundle is made when first asked, from the location the
// host already stands for it; the places within a reach of a pixel are the registry's `near`, asked each time and never
// kept (residency is derived, not stored). When the world-data door serves edits, every listed place is checked once at
// idle, in slices, and a block a place names that nothing serves is said in the console - before a door to it is opened.
// Wired by scenes/tamrielPlacesHost.js, which holds the registry, the blocks and the place index.
import { createAtlas, fillAtlas, ATLAS_VERSION } from '../world/atlas/atlas.js';
import { servedBlockOf } from '../world/atlas/atlasServed.js';
import { homeListingsUnplaced } from '../net/homeListingLaw.js';   // FOUNDATION F3: the property rows checked against the places

/** Places checked in one idle slice. */
export const ATLAS_SLICE = 500;
/** The most problems the console names (the count is always whole). */
export const ATLAS_SAID = 8;

const idle = (/** @type {() => void} */ fn) => (typeof globalThis.requestIdleCallback === 'function' ? globalThis.requestIdleCallback(() => fn()) : setTimeout(fn, 0));

/**
 * @param {{ places: any, blocks: { checkName: (n: string) => string, getBlockIndex: (n: string) => number, count: number }, standing: (p: any) => any, stand?: (p: any) => any,
 *   schedule?: (fn: () => void) => unknown, listings?: () => readonly any[], additions?: () => ReadonlyArray<readonly [any, any]> }} o - `places` the registry
 *   (world/worldWide/worldPlaces.js); `standing` the location the host already holds for a place (no side effect), `stand`
 *   the one it would stand on asking (a place past the Bay cloned and indexed); `listings` the property rows, each
 *   checked to name a town and a cell; `additions` this client's world-data additions, `[place, location]`
 */
export function createAtlasHost({ places, blocks, standing, stand = standing, schedule = idle, listings = () => [], additions = () => [] }) {
  const resolveBlock = servedBlockOf(blocks);
  let atlas = createAtlas({ resolveBlock });
  let generation = places.generation();
  /** The atlas of the registry as it stands: a new one when a provider moved. */
  const current = () => {
    const g = places.generation();
    if (g !== generation) { generation = g; atlas = createAtlas({ resolveBlock }); }
    return atlas;
  };
  /** @type {null | { checked: number, unlocated: number, problems: import('../world/atlas/atlas.js').Problem[], unplaced: any[] }} */
  let report = null;
  let checking = false;

  /** A place's bundle, by its map id or its registry record; made from the location the host stands for it, or null. */
  function bundle(/** @type {number|any} */ which) {
    const p = typeof which === 'number' ? places.byMapId(which) : which;
    if (!p) return null;
    const a = current();
    const had = a.place(p.mapId);
    if (had) return had;
    const loc = stand(p);
    return loc ? a.add(p, loc) : null;
  }

  /** Every listed place checked against the blocks this client serves, ATLAS_SLICE a slice at idle, on its own atlas
   *  (the check keeps no bundle). Resolves to the report; the console hears of problems once. */
  function check() {
    if (checking) return Promise.resolve(null);
    checking = true;
    const scratch = createAtlas({ resolveBlock });
    const list = [...places.all()];
    let i = 0, unlocated = 0;
    return new Promise((done) => {
      const slice = () => {
        const r = fillAtlas(scratch, list.slice(i, i + ATLAS_SLICE), standing);
        unlocated += r.unlocated.length;
        i += ATLAS_SLICE;
        if (i < list.length) { schedule(slice); return; }
        for (const [p, loc] of additions()) scratch.add(p, loc);   // a mod's places, each client's own
        report = { checked: list.length, unlocated, problems: scratch.problems().filter((q) => q.why === 'unresolved'), unplaced: homeListingsUnplaced(listings(), bundle) };
        checking = false;
        if (report.problems.length) {
          console.warn(`[atlas] ${report.problems.length} block reference(s) serve nothing: ${report.problems.slice(0, ATLAS_SAID).map((q) => `${q.name} (${q.part} of place ${q.place})`).join(', ')}`);
        }
        if (report.unplaced.length) console.warn(`[atlas] ${report.unplaced.length} property row(s) name nothing: ${report.unplaced.slice(0, ATLAS_SAID).map((u) => `${u.row.map} (${u.why})`).join(', ')}`);
        done(report);
      };
      schedule(slice);
    });
  }

  return {
    version: ATLAS_VERSION,
    bundle,
    /** The bundles of the listed places within `r` pixels of a pixel - the registry's `near`, asked now. */
    near: (/** @type {number} */ px, /** @type {number} */ py, /** @type {number} */ r) => places.near(px, py, r).map(bundle).filter(Boolean),
    /** The atlas of what has been asked so far. */
    atlas: () => current(),
    check,
    /** The last check's findings, or null before one finished. */
    report: () => report,
  };
}

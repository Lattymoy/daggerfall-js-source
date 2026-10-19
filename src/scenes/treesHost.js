// @ts-check
// ═══════════════════════════════════════════════════════════════════
// HOST-SPLIT (BANTHA1, bible/03-World/Bantha-Jungle.md): THE NEAR 3D TREES' HOST - out of bootWorld (scenes/world.js),
// a module the world host wires (bible/01-Overview/Host-Split.md: scenes/fishHost.js is the shape). It owns the two
// doors that stand a 3D tree where a flat stands - Low Poly Trees' (LPT1, bible/07-Rendering/Low-Poly-Trees.md) and
// the jungle's (BANTHA1, scenes/jungleHost.js's) - and each frame's near sets of both:
//   - THE DOORS, built once for the session (the world holds them, as it holds the mills' parts);
//   - THE NEAR SETS: a pixel's tree set is made as it comes into the eye's 3x3 and let go past its 5x5 (AUDIT LPT B10),
//     each frame at the pixel's translation, each door's own - Low Poly Trees' with the yards' placed trees (DECOR-LPT),
//     the jungle's apart - gathered, culled to the view and handed to the renderer's slot (frame);
//   - THE HANDLES' OWNERS: a pixel's far pictures' handles given back with it (released) or with a build that failed
//     (releasedBuild - BUILD-FAIL1's ledger) - EVERY ALLOCATION HAS AN OWNER.
// The flats' shares of the wind's lean (WIND3) and Windfall's law (WINDFALL1), by prototype, are the frame's maps
// (lptSway, lptWindfall): the pixel's build writes them as it stands a batch, the frame's near trees read them.
// ═══════════════════════════════════════════════════════════════════
import { createLowPolyTrees } from '../systems/lowPolyTreesAssets.js';
import { buildTreeSet } from '../world/lowPolyTrees.js';
import { FOREST_STAMP } from './treeHost.js';
import { FELLED } from '../ai/cover.js';

/**
 * @param {{ renderer: any, getTexture: (archive: number) => Promise<any>, seasons?: any, seasonsActive: () => boolean,
 *   lowPolyTreesOn: boolean, jungle?: any, breathe: () => Promise<void>, yards: () => any }} deps
 *   `seasons` Seasons of the Iliac Bay's helper (or null) and `seasonsActive()` whether it stands a season now;
 *   `lowPolyTreesOn` the mod's switch (read once, as the world loads); `jungle` the jungle's host (scenes/jungleHost.js)
 *   or null; `yards()` the online homes' yards (their placed trees' sets), or null
 */
export function createTreesHost({ renderer, getTexture, seasons = null, seasonsActive, lowPolyTreesOn, jungle = null, breathe, yards }) {
  // LPT1: the nature flats it has a tree for stand as their 3D trees within LPT_NEAR_M of the eye and as the same
  // tree's far picture beyond it, out to the land view's whole reach at a flat's own cost. Seasons of the Iliac Bay's
  // seasonal pictures, while the mod stands a season, paint the trees' atlases, so they take the season the flats take
  const lowPolyTrees = lowPolyTreesOn ? createLowPolyTrees({
    renderer, getTexture,
    // AUDIT LPT C2/B3: a prototype is painted under the season only when the mod re-skins ITS OWN archive now (its flats
    // turn, so must it), keyed by the install - and under the classic records while an install is refilling the cache
    seasonal: seasons ? {
      key: (a) => (seasonsActive() && !seasons.installing && seasons.lookup(a, 1) ? `s${seasons.installedSeason}.${seasons.generation}` : ''),
      picture: (a, r) => (seasonsActive() ? seasons.lookup(a, r)?.texture ?? null : null),
      generation: () => seasons.generation,
    } : null,
    breathe,   // the stream's own slice clock (PERF7) - a tree's atlases are painted inside the build that first stands it
  }) : null;
  const jungleDoor = jungle?.door ?? null;
  const lptSway = new Map();   // a prototype's share of the wind's lean, as its far pictures' batch takes it
  const lptWindfall = new Map();   // WINDFALL1: ...and its share under Windfall's law
  const lptSets = [], jungleSets = [];   // the frame's near pixels' sets (scratch)
  const opts = { skip: (set, i) => FELLED.has(set.centers[i]), swayOf: (proto) => lptSway.get(proto) ?? 0, windfallOf: (proto) => lptWindfall.get(proto) ?? 0, stamp: 0, planes: null };   // the frame's, made once (a wind that is off is the flats' call's, uFlatWind zero)
  /** a near pixel's set at its translation this frame, made the first frame it is near */
  const ready = (set, t) => {
    if (!set.trees) { const made = buildTreeSet(set.px, set.py, set.groups); set.trees = made.trees; set.centers = made.centers; }
    set.ox = t[0]; set.oy = t[1]; set.oz = t[2];
    return set;
  };
  const drop = (set) => { if (set?.trees) { set.trees = null; set.centers = null; } };
  return {
    lowPolyTrees, lptSway, lptWindfall,
    /**
     * THE FRAME'S NEAR 3D TREES - the eye's pixel's and its neighbours' sets (`pixels` the frame's, nearest first, each
     * with `_dist2` its grid distance from the player's pixel and `_t` its translation), gathered (when the eye or they
     * moved, or a tree was felled), culled to the view (`planes`, the frame's normalised ones - null when culling is
     * off) and handed to the renderer for the flats' call. DECOR-LPT: and the yards' placed trees, Low Poly Trees' own.
     * @param {any[]} pixels @param {ArrayLike<number>} eye @param {Float32Array|null} planes
     */
    frame(pixels, eye, planes) {
      if (!lowPolyTrees && !jungleDoor) return;
      lptSets.length = 0; jungleSets.length = 0;
      for (let i = 0; i < pixels.length; i++) {
        const p = pixels[i], a = p.lowPolyTrees, b = p.jungleTrees;
        if (!a && !b) continue;
        if (p._dist2 > 2) { if (p._dist2 > 8) { drop(a); drop(b); } continue; }   // past the eye's eight neighbours no tree is in reach
        if (!p._t) continue;
        if (a && lowPolyTrees) lptSets.push(ready(a, p._t));
        if (b && jungleDoor) jungleSets.push(ready(b, p._t));
      }
      for (const set of yards()?.treeSets() ?? []) lptSets.push(set);   // DECOR-LPT: the yards' placed trees, where their yards stand now
      opts.stamp = FOREST_STAMP.n;
      opts.planes = planes;
      lowPolyTrees?.frame(lptSets, eye[0], eye[1], eye[2], opts);
      jungleDoor?.frame(jungleSets, eye[0], eye[1], eye[2], opts);   // BANTHA1: the jungle's, on its own slot
    },
    /** A pixel gone (destroyPixel): the far pictures' handles it held, each door's (AUDIT LPT B5). */
    released(p) {
      if (p.lowPolyTrees) for (const h of p.lowPolyTrees.handles) lowPolyTrees?.release(h);
      if (p.jungleTrees) for (const h of p.jungleTrees.handles) jungleDoor?.release(h);
    },
    /** A build that failed (BUILD-FAIL1's ledger, `made`): the handles it had taken. */
    releasedBuild(m) {
      for (const h of m.lptHandles ?? []) lowPolyTrees?.release(h);
      for (const h of m.jungleHandles ?? []) jungleDoor?.release(h);
    },
  };
}

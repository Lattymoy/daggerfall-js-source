// FIELD BUGS 2026-10-04d PLACE-LRU (the Discord: "After long plays there are consistent GPU memory leaks that do not
// lower down even after closing the tab ... Related to play length ... Idling does not increase mem usage"; a player's
// follow-up: "world instances are cached. visiting new cities generates a mesh for them but does never dispose of them
// after leaving that place ... needs to have a limit of chunks being stored with minimum set for chunks visible by
// viewing range"): THE PLACES' HOLD ON THE SHARED GPU CACHES.
//
// What a place builds for itself alone already goes with it - a streamed pixel's terrain, merged statics, flats and
// tilemap (scenes/world.js destroyPixel), a building's and a dungeon's batches and merged statics (the two contexts'
// destroy()). What places SHARE is the data pipeline's (scenes/dataPipeline.js): every model's VAO and buffers
// (`gpuMeshes`, with its CPU copy in `cpuModels`), every picture (`renderer.textures`, `emissionTextures`) and every
// ground archive's tile array (`renderer.tileArrays`) - and nothing ever let any of that go. A town's own buildings, a
// climate's walls and roofs, a dungeon's blocks and its foes' frames stayed on the GPU for the rest of the session,
// so the three grew with every place visited and never came down: the player's claim, for the shared half.
//
// So each place HOLDS what it asks for (`place(kind, key)` - a pixel, a building, a dungeon), a model holds the
// pictures its own build uploaded, and a thing asked for OUTSIDE any place - the UI, the foes outdoors, the arrows, the
// fixed city of ?exterior - is PINNED, kept for good, which is what everything was before. A place that goes is not
// dropped at once: it is KEPT, the most recent per kind, so a walk back across a pixel's edge or a step out of a door
// and back in rebuilds nothing. Past that the oldest is dropped, and what no place holds and nothing pinned is freed.
// The places in view are live and never dropped - the player's "minimum set for chunks visible by viewing range" is
// the view itself; what is kept is the cache past it. A place that comes back holds what it asks for again, and what
// was freed is built again by the same doors that built it the first time.
//
// Pure: no GL here, and no pipeline - the frees are the caller's (`free.mesh/tex/tile`), so a pin drives the law with
// counters.

/** How many places that have gone are kept warm, by kind. The world host sets the pixels' to its own view
 *  (`keep('pixel', ...)`, one whole view: a teleport keeps the place it left until the next one), the default here
 *  being DFU's default TerrainDistance of 3 (a 7x7 grid). A building's and a dungeon's art is the bulk of a visit and
 *  a revisit is the step out and back in. */
export const PLACES_KEPT = Object.freeze({ pixel: 49, interior: 4, dungeon: 2 });

const WHATS = Object.freeze(['mesh', 'tex', 'tile']);

/**
 * @param {{ free: { mesh: (key: any) => boolean, tex: (key: string) => any, tile: (key: any) => any }, kept?: Record<string, number> }} o
 *   `free.mesh` answers whether it freed one - a model still building, or one this data set lacks, is not yet freeable.
 */
export function createPlaceHolds({ free, kept = PLACES_KEPT }) {
  const held = { mesh: new Map(), tex: new Map(), tile: new Map() }; // key -> how many holders (places, and a model for its pictures)
  const pinned = { mesh: new Set(), tex: new Set(), tile: new Set() }; // asked for outside any place: kept for good
  const loose = { mesh: new Set(), tex: new Set(), tile: new Set() }; // let go since the last sweep - the only keys a sweep asks
  const meshTex = new Map(); // model key -> the picture keys its build uploaded, held for as long as the model stands
  const keep = { ...kept };
  const shelves = new Map(); // kind -> Map(place key -> hold), oldest first: the places gone and kept
  let live = 0;

  const add = (what, key) => {
    const m = held[what];
    m.set(key, (m.get(key) ?? 0) + 1);
  };
  const sub = (what, key) => {
    const m = held[what],
      n = (m.get(key) ?? 0) - 1;
    if (n > 0) m.set(key, n);
    else {
      m.delete(key);
      loose[what].add(key);
    }
  };

  /** What was let go and is neither held nor pinned is freed - a model first, so the pictures it held come loose
   *  with it and go in the same sweep. */
  function sweep() {
    for (const key of loose.mesh) {
      if (held.mesh.has(key) || pinned.mesh.has(key) || !free.mesh(key)) continue;
      const pictures = meshTex.get(key);
      meshTex.delete(key);
      for (const t of pictures ?? []) sub('tex', t);
    }
    loose.mesh.clear();
    for (const what of ['tex', 'tile']) {
      for (const key of loose[what]) if (!held[what].has(key) && !pinned[what].has(key)) free[what](key);
      loose[what].clear();
    }
  }

  function drop(h) {
    h.state = 'dropped';
    for (const what of WHATS) {
      for (const key of h.holds[what]) sub(what, key);
      h.holds[what].clear();
    }
  }

  /** The kind's shelf down to its keep, the oldest dropped first. */
  function trim(kind) {
    const shelf = shelves.get(kind);
    if (!shelf) return;
    const limit = keep[kind] ?? 0;
    while (shelf.size > limit) {
      const [k, oldest] = shelf.entries().next().value;
      shelf.delete(k);
      drop(oldest);
    }
  }

  /** A place's hold: what it asks for, held while it stands and while it is kept. */
  function place(kind, key) {
    live++;
    const h = {
      kind,
      key,
      state: 'live',
      holds: { mesh: new Set(), tex: new Set(), tile: new Set() },
      /** One thing this place asks for. A place already dropped (a build's late answer after its pixel went) holds
       *  nothing: what it made is nobody's, and the next sweep asks after it. */
      hold(what, k) {
        if (h.state === 'dropped') {
          if (!held[what].has(k) && !pinned[what].has(k)) loose[what].add(k);
          return;
        }
        if (h.holds[what].has(k)) return;
        h.holds[what].add(k);
        add(what, k);
      },
      /** The place has gone: KEPT on its kind's shelf, newest last - an older keep of the same place gives way to it -
       *  and the shelf trimmed to its keep. Once. */
      release() {
        if (h.state !== 'live') return;
        live--;
        h.state = 'kept';
        let shelf = shelves.get(kind);
        if (!shelf) shelves.set(kind, (shelf = new Map()));
        const older = shelf.get(h.key);
        if (older) {
          shelf.delete(h.key);
          drop(older);
        }
        shelf.set(h.key, h);
        trim(kind);
        sweep();
      },
      /** The place stands again, built: the keep of its last visit is dropped, and what that visit held that this one
       *  did not ask for (last season's walls, a layout since changed) comes loose. Until now that keep kept this
       *  build's cache warm. */
      settle() {
        const shelf = shelves.get(kind);
        const older = shelf?.get(h.key);
        if (!older || older === h) return;
        shelf.delete(h.key);
        drop(older);
        sweep();
      },
      /** IC-SWAP-BEHIND (scenes/swapBehind.js): a live place built under a second key (a pixel's view built behind the one
       *  that stands) is its place's from now - kept, and settled, as that place. @param {any} to */
      rekey(to) {
        if (h.state === 'live') h.key = to;
      },
    };
    return h;
  }

  return {
    place,
    /** Asked for outside any place: never freed. */
    pin(what, key) {
      pinned[what].add(key);
    },
    /** A model's build finished: it holds the pictures it uploaded for as long as it stands. A model no place holds
     *  and nothing pinned (a late build for a place already gone) is loose from birth. */
    meshBuilt(key, pictures) {
      const was = meshTex.get(key);
      meshTex.set(key, pictures);
      for (const t of pictures) add('tex', t);
      for (const t of was ?? []) sub('tex', t);
      if (!held.mesh.has(key) && !pinned.mesh.has(key)) loose.mesh.add(key);
    },
    /** A kind's keep, set by the host that knows its view; the shelf comes down to it at once. */
    keep(kind, n) {
      keep[kind] = Math.max(0, Math.floor(Number(n) || 0));
      trim(kind);
      sweep();
    },
    stats() {
      const keptBy = {};
      for (const [kind, shelf] of shelves) keptBy[kind] = shelf.size;
      return {
        live,
        kept: keptBy,
        held: { mesh: held.mesh.size, tex: held.tex.size, tile: held.tile.size },
        pinned: { mesh: pinned.mesh.size, tex: pinned.tex.size, tile: pinned.tile.size },
      };
    },
  };
}

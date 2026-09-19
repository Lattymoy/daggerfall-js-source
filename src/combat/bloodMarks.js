// @ts-check
// BLOOD1a - THE MARK POOL, AND WHY IT IS ITS OWN BINDING.
//
// This lived inside scenes/hitEffects.js for one commit and HARD1 threw
// it out, correctly. That pool is a HAND-OFF: it gives every splash
// batch away as it is born (`onSpawn: (b) => billboardBatches.push(b)`)
// and the list it gives them to is what frees them, so the context's
// teardown must NOT also end the pool - AUDIT-HARD proved that frees
// each live splash twice. Putting the decal ring in there made it a
// pool that hands one resource off AND owns another, and HARD1's three
// answers - ends it, holds nothing, hands it off - are EXCLUSIVE by
// design. Its failure message says the remedy outright: "if the pool
// really does own something the list does not, it is not a hand-off and
// the declaration is what is wrong."
//
// The declaration was not what was wrong. The CONFLATION was. A splash
// is a one-shot that plays and goes; a mark is a thing that stays and
// costs a vertex buffer for the session. They are two lifetimes, so
// they are two bindings, and the host that owns a context ends this one
// by name.
//
// It still rides `showBloodSplash`'s own call - eight sites across four
// hosts, and the event either way is "blood happened here" - but as a
// collaborator the pool is handed, not a thing it owns.

import {
  createBloodDecalPool, writeDecalQuad, clearDecalQuad, bloodRate, marksBlood, DECAL_FLOATS,
  sprayCount, sprayRadius, sprayOffset, dropSize,   // BLOOD1b: the scatter BLOOD1a left to this slice
} from './bloodDecals.js';

/** How far down a mark looks for something to stain. Blood spawns at
 *  chest height (`bloodCentre` is five eighths up the capsule), so the
 *  floor is a body's height away and a little more on a step; past that
 *  the blood is over open air and leaves nothing. */
export const MARK_DROP = 3;

/** Straight down, once. BLOOD1b casts up to SPRAY_MAX rays for one
 *  blow, and the collider reads this direction and never writes it. */
const DOWN = Object.freeze([0, -1, 0]);

/**
 * @param {{renderer?:any, collider?:(() => any)|null, settings?:any, texture?:(() => any)|null, rng?:(() => number)}} [deps]
 *
 * `collider` IS A GETTER, not a collider. Every host rebuilds its own -
 * a mode change swaps it, the streaming world swaps it again on every
 * pixel load - and this pool outlives all of that, so a captured
 * reference would be marking a world that no longer exists within one
 * doorway.
 */
export function createBloodMarks({ renderer = null, collider = null, settings = null, texture = null, rng = Math.random } = {}) {
  let _pool = null;
  let _batch = null;
  let _texKey = null;
  const _scratch = new Float32Array(DECAL_FLOATS);

  const liveCollider = () => (typeof collider === 'function' ? collider() : null);
  const on = () => !!(settings?.enabled?.() ?? false) && typeof collider === 'function' && !!renderer?.createDecalBatch;
  const markTexture = texture ?? (() => (_texKey ? renderer?.textures?.get?.(_texKey) ?? null : null));

  function ensure() {
    if (_pool && _batch) return;
    const cap = Math.max(1, Math.floor(settings?.capacity?.() ?? 1000));
    // ONE SOURCE OF CHANCE for the whole pool: the ring spins each
    // mark's own turn and the spray below picks where the drops land,
    // and a test that wants either held still should not have to find
    // two seams to hold.
    _pool = createBloodDecalPool({ capacity: cap, rng });
    _batch = renderer.createDecalBatch(cap);
  }

  /** THE MARK'S ART IS THE SPLASH'S LAST FRAME. A splash plays out to
   *  the settled splat and then vanishes; that final frame IS the
   *  stain, so the mark needs no art of its own and the port ships
   *  none. Only the splash pool can see the frame count, so it tells
   *  this one. */
  function useArt(archive, record, frameCount) {
    _texKey = `${archive}_${record}#${Math.max(0, frameCount - 1)}`;
  }

  /**
   * Lay the marks one blood event leaves. THE SURFACE IS FOUND, NOT
   * ASSUMED: blood spawns at chest height, which is nowhere near
   * anything to stain, so every ray goes DOWN. Nothing within reach -
   * a body over a chasm, a foe on a bridge - leaves no mark rather
   * than one hanging in space, and that is judged PER DROP: spatter
   * thrown past the edge of a walkway falls into the dark while the
   * pool under the body still lands.
   *
   * BLOOD1b: THE RATE IS A COUNT AGAIN. BLOOD1a had it size a single
   * mark, because the scatter belonged to this slice and inventing a
   * decals-per-hit law there would have been inventing one to
   * un-invent here. Now the ladder says how many drops reach the
   * floor and how far they carry, and the size band sizes each.
   *
   * Answers the POOL - drop zero, the body's own spot - or null when
   * nothing landed at all.
   */
  function place(bloodIndex, pos, hit = null) {
    if (!on() || !pos) return null;
    // A BLOODLESS FOE MARKS NOTHING. DFU's own bloodIndex says which
    // six, and characters/enemyBasics.js has carried it since long
    // before this arc.
    if (!marksBlood(bloodIndex)) return null;
    const col = liveCollider();
    if (!col?.raycastHit) return null;   // between two worlds: a pixel unloaded, a mode half changed
    const rate = bloodRate(hit?.damage ?? 0, hit?.maxHealth ?? 0, settings?.density?.() ?? 1);
    const n = sprayCount(rate);
    const radius = sprayRadius(rate);
    let pool = null;
    for (let i = 0; i < n; i++) {
      const [dx, dz] = sprayOffset(i, n, radius, rng);
      const fromX = pos[0] + dx, fromZ = pos[2] + dz;
      const h = col.raycastHit([fromX, pos[1], fromZ], DOWN, MARK_DROP);
      if (!h || !Number.isFinite(h.dist) || h.dist > MARK_DROP) continue;
      ensure();
      const d = _pool.place([fromX, pos[1] - h.dist, fromZ], h.normal ?? [0, 1, 0], { size: dropSize(i, rate, rng) });
      if (!d) continue;
      writeDecalQuad(_scratch, 0, d);
      renderer.writeDecalSlot(_batch, d.slot, _scratch);   // ONE slot, at its own offset
      if (i === 0) pool = d;
    }
    return pool;
  }

  /** The ring is in WORLD space, which in the streaming host is the
   *  shifted frame - so a recentre moves every mark by the same delta,
   *  and the VERTEX BUFFER moves with it, because a decal's corners are
   *  baked into it. */
  function shiftOrigin(offset) {
    if (!_pool || !_pool.count || !offset) return 0;
    const n = _pool.shiftOrigin(offset);
    for (const d of _pool.decals()) {
      writeDecalQuad(_scratch, 0, d);
      renderer.writeDecalSlot(_batch, d.slot, _scratch);
    }
    return n;
  }

  function draw() {
    if (!_batch || !_pool || !_pool.count) return false;
    const tex = markTexture();
    if (!tex) return false;
    renderer.drawDecals(_batch, tex);
    return true;
  }

  /** A MODE CHANGE THROWS THE ROOM AWAY. The marks go with it, and the
   *  buffer is blanked slot by slot rather than freed - the ring is the
   *  same ring next time, and rebuilding it would cost an allocation
   *  every time the player opens a door. */
  function clear() {
    if (!_pool) return 0;
    const n = _pool.count;
    for (const d of _pool.decals()) {
      clearDecalQuad(_scratch, 0);
      renderer.writeDecalSlot(_batch, d.slot, _scratch);
    }
    _pool.clear();
    return n;
  }

  return {
    place, draw, shiftOrigin, clear, useArt,
    count: () => (_pool ? _pool.count : 0),
    /** HARD1: this pool ENDS WHAT IT OWNS. The ring is a thousand quads
     *  of vertex data and a VAO, handed to nobody, so the context that
     *  built it frees it here by this binding's own name. */
    dispose() {
      clear();
      if (_batch) renderer?.destroyDecalBatch?.(_batch);
      _batch = null; _pool = null; _texKey = null;
    },
    _pool: () => _pool,
  };
}

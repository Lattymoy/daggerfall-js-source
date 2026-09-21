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
// It still rides `showBloodSplash`'s own call - ELEVEN sites across
// five files, and the event either way is "blood happened here" - but
// as a collaborator the pool is handed, not a thing it owns.
// (BLOOD1b counted them; this header said eight, from a count taken
// before the arc reached the peer and fall seams.)

import {
  createBloodDecalPool, writeDecalQuad, clearDecalQuad, bloodRate, marksBlood, DECAL_FLOATS,
  sprayCount, sprayRadius, sprayOffset, dropSize,   // BLOOD1b: the scatter BLOOD1a left to this slice
  isOverkill, burstCount, burstRate, burstReach,    // BLOOD1b: and the killing blow's own spray
  scaleRate, looksUp, isCeilingNormal, streakFor,   // BLOOD2a: the streak              // BLOOD1b: and the drops that find a ceiling
} from './bloodDecals.js';
import {
  throwGibs, gibStep, gibFly, gibLand, gibSprayOrigin, shiftGibs, dripFrom,
  GIB_SPLASH_RATE, GIB_COUNT, DRIP_SPLASH_RATE,
} from './bloodGibs.js';   // BLOOD1b: what a warhammer leaves of a body, and what a ceiling lets go of

/** How far down a mark looks for something to stain. Blood spawns at
 *  chest height (`bloodCentre` is five eighths up the capsule), so the
 *  floor is a body's height away and a little more on a step; past that
 *  the blood is over open air and leaves nothing. */
export const MARK_DROP = 3;

/** Straight down, once. BLOOD1b casts up to SPRAY_MAX rays for one
 *  blow, and the collider reads this direction and never writes it. */
const DOWN = Object.freeze([0, -1, 0]);
/** ...and the other way, for the one drop in four that looks for a
 *  ceiling instead of a floor. */
const UP = Object.freeze([0, 1, 0]);

/** How far UP a drop looks. A dungeon ceiling is a body's height or
 *  two above where blood spawns; past that the room is too big for a
 *  hit to reach and the blood is somebody else's problem. It is longer
 *  than MARK_DROP because blood spawns at chest height: the floor is
 *  close and the ceiling is not. */
export const CEILING_REACH = 4;

/** BLOOD1b: how many bodies' worth of chunks may be in the air at
 *  once. Each chunk rays its own step every frame, so this is the
 *  per-frame cost of a gibbing and it is decided here rather than by
 *  how fast a player can swing. Four is more than a corridor ever
 *  holds at once. */
export const MAX_BODIES = 4;

/** How many drips may be falling at once. A drip is cheaper than a
 *  chunk - no quad, one mark - but it still rays a step a frame, and
 *  a burst over a low ceiling can hang a lot of them. */
export const MAX_DRIPS = 64;

/** BLOOD1b: how big a flying chunk is drawn. The port's own choice and
 *  said to be - the reference's gib sheet is art this port has no
 *  permission to carry, so a chunk wears a frame of TEXTURE.380, the
 *  same archive the splash and the mark already come from, at a size
 *  that reads as a piece rather than as a splash still playing. */
export const GIB_QUAD = Object.freeze({ w: 0.28, h: 0.28 });
/** ...and it wears the splash's FIRST frame, not its last. The mark
 *  takes the settled stain because that is what a stain looks like; a
 *  chunk in the air is the burst, which is frame zero. */
export const GIB_FRAME = 0;

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
  /** BLOOD1b: chunks in flight. Plain data this pool owns outright,
   *  emptied by `clear()` with the room they were thrown in. */
  let _gibs = [];
  /** The chunks' own batch: one quad each, centres rewritten every
   *  frame. HARD1 - this pool OWNS it, like the ring, and ends it by
   *  name in `dispose()` and whenever the last chunk comes to rest. */
  let _gibBatch = null;
  let _gibArt = null;   // { archive, record } - the splash pool tells us
  /** Blood a ceiling has not finished with. A drip falls exactly as a
   *  chunk does, but wears no quad and leaves one mark rather than
   *  two, so it is its OWN list - the chunks' batch has one quad per
   *  entry and a drip in that list would draw a flying gib. */
  let _drips = [];
  /** BLOOD1 AUDIT: DISPOSE IS TERMINAL. Without this, a `place` or a
   *  `tick` arriving after teardown - a peer's blow landing over the
   *  wire as the room goes, a splash whose art resolved late - would
   *  run `ensure()` and mint a FRESH ring and a FRESH GPU batch on a
   *  pool nobody will ever free again. That is the HARD1 fault this
   *  arc has been careful about everywhere else, arrived at from the
   *  other end: not a thing freed twice, but a thing built after its
   *  owner had gone. */
  let _dead = false;
  /** The chunks' centre list, built ONCE per flight rather than per
   *  frame. Every entry is the chunk's own `pos` ARRAY, and gibStep /
   *  gibFly / gibLand / shiftGibs all write through it in place - so
   *  the references stay live for the whole flight and the move below
   *  allocates nothing. */
  let _gibPos = [];
  const _scratch = new Float32Array(DECAL_FLOATS);

  const liveCollider = () => (typeof collider === 'function' ? collider() : null);
  const on = () => !_dead && !!(settings?.enabled?.() ?? false) && typeof collider === 'function' && !!renderer?.createDecalBatch;
  // BLOOD1b: the killing blow's own row, read LIVE like the rest - a
  // player who turns it off mid-fight gets the next blow plain.
  //
  // THE GIBS RIDE THIS ROW rather than one of their own, and that is a
  // departure from the reference's two settings worth stating: here a
  // body can only come apart on the player's warhammer overkill,
  // which this row already gates, so a second switch would be one
  // that does nothing unless the first is on.
  const overkillOn = () => !!(settings?.overkill?.() ?? false);
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
    // BLOOD1b: and the chunks take the FIRST frame of the same record.
    // Every frame of it is uploaded by the splash that told us this, so
    // a chunk needs no art of its own either and the port still ships
    // none.
    _gibArt = { archive, record };
  }

  /**
   * Lay ONE spray: `n` drops inside `radius` of `pos`, each at the
   * size `rate` asks for. THE SURFACE IS FOUND, NOT ASSUMED: blood
   * spawns at chest height, which is nowhere near anything to stain,
   * so every drop rays for one - DOWN for the floor, and one in four
   * UP for a ceiling (see `looksUp` below). Nothing within reach - a
   * body over a chasm, a foe on a bridge, a hall too high to stain -
   * leaves no mark rather than one hanging in space, and that is
   * judged PER DROP: spatter thrown past the edge of a walkway falls
   * into the dark while the pool under the body still lands.
   *
   * Answers DROP ZERO - the body's own spot - or null when nothing in
   * this spray landed at all.
   */
  function spray(col, pos, n, radius, rate, thrown = null) {
    let pool = null;
    // BLOOD1b: WHICH WAY THE SWING THREW IT. The site worked the two
    // numbers out, because only it knows the state and the basis.
    const tx = thrown?.[0] ?? 0, tz = thrown?.[1] ?? 0;
    for (let i = 0; i < n; i++) {
      const [dx, dz] = sprayOffset(i, n, radius, rng);
      // THE POOL DOES NOT LEAN. Drop zero is blood running off the
      // body, not blood thrown from it, so it stays at the body's own
      // spot whatever the swing did - and that is what keeps "a hit
      // stains where it happened" true.
      const fromX = pos[0] + dx + (i > 0 ? tx : 0), fromZ = pos[2] + dz + (i > 0 ? tz : 0);
      // ONE DROP IN FOUR LOOKS UP. The reference's particles fly in
      // every direction and the ones that go up find the ceiling; this
      // port rays, so the share is a number. Drop zero never does - it
      // is the pool under the body.
      const up = looksUp(i);
      const dir = up ? UP : DOWN, reach = up ? CEILING_REACH : MARK_DROP;
      // BLOOD1 AUDIT 3: BLOOD DOES NOT PASS THROUGH WALLS. The drop's
      // XZ is the body's plus the spray's offset plus the swing's throw
      // - up to four metres and more for a warhammer overkill - and the
      // ray went straight down from THERE, so a foe killed against a
      // partition sprayed the next corridor's floor. The reference flies
      // particles that meet the wall first; this port rays the same
      // segment, from the body to the drop.
      //
      // BLOOD2a: AND WHAT MEETS THE WALL STAINS IT. A drop that would
      // have to pass through something lands ON that something, at the
      // point it met it, facing the way it came - which is what the
      // reference's particles do, and what a corridor fight looks like.
      // A wall mark is round: cast-off runs along its travel on a floor,
      // but a spurt meeting a wall head-on spreads.
      const ox = fromX - pos[0], oz = fromZ - pos[2];
      const run = i > 0 ? Math.hypot(ox, oz) : 0;
      if (run > 1e-6 && col.raycastHit) {
        const wall = col.raycastHit(pos, [ox / run, 0, oz / run], run);
        if (wall && Number.isFinite(wall.dist) && wall.dist <= run) {
          const wx = pos[0] + (ox / run) * wall.dist, wz = pos[2] + (oz / run) * wall.dist;
          ensure();
          const d = _pool.place([wx, pos[1], wz], wall.normal ?? [-ox / run, 0, -oz / run], { size: dropSize(i, rate, rng) });
          if (d) { writeDecalQuad(_scratch, 0, d); renderer.writeDecalSlot(_batch, d.slot, _scratch); }
          continue;
        }
      }
      // MAC-BUG W5 (Mac: "blood doesn't work outside"). THIS RAY WAS
      // THE WHOLE BUG, and it is the fault class this month has been
      // made of: `raycastHit` walks the collider's TRIANGLE BUCKETS,
      // which is the entire world indoors and underground - a floor
      // there is a mesh - and outside it is not. The world host's
      // ground is its terrain sampler and the exterior host's is a
      // flat constant, both handed to the collider as `heightAt` and
      // applied to the CAPSULE alone. So every drop cast straight down
      // outdoors met nothing, and "nothing" is not an error: `continue`
      // is the right answer for spatter thrown off a walkway, so the
      // pool under the body took the same silent arm and no blood has
      // ever marked the ground outside.
      //
      // `surfaceHit` is the same ray plus that floor, nearer wins.
      const h = col.surfaceHit([fromX, pos[1], fromZ], dir, reach);
      if (!h || !Number.isFinite(h.dist) || h.dist > reach) continue;
      const at = [fromX, pos[1] + dir[1] * h.dist, fromZ];
      // A CEILING IS A SURFACE TEST, not a position one: the
      // reference's own `Dot(normal, down) > 0.7`. A drop that went up
      // and met something that is NOT a ceiling - the underside of a
      // stair, a slope it can run off - leaves nothing, because blood
      // does not stick to a wall it hit from below.
      if (up && !isCeilingNormal(h.normal)) continue;
      ensure();
      // BLOOD2a: SPATTER LIES ALONG ITS TRAVEL. The drop flew from the
      // body to here, and it lands stretched that way - the further it
      // flew, the longer - which is what cast-off blood is. The pool
      // under the body flew nowhere and stays round.
      const d = _pool.place(at, h.normal ?? (up ? DOWN : [0, 1, 0]), {
        size: dropSize(i, rate, rng),
        along: run > 1e-6 ? [ox, 0, oz] : null,
        stretch: streakFor(run, radius),
      });
      if (!d) continue;
      writeDecalQuad(_scratch, 0, d);
      renderer.writeDecalSlot(_batch, d.slot, _scratch);   // ONE slot, at its own offset
      // ...and what a ceiling holds, it eventually lets go of.
      if (up && _drips.length < MAX_DRIPS) _drips.push(dripFrom(at));
      if (i === 0) pool = d;
    }
    return pool;
  }

  /**
   * Lay the marks one blood event leaves.
   *
   * BLOOD1b: THE RATE IS A COUNT AGAIN. BLOOD1a had it size a single
   * mark, because the scatter belonged to this slice and inventing a
   * decals-per-hit law there would have been inventing one to
   * un-invent here. Now the ladder says how many drops reach the
   * floor and how far they carry, and the size band sizes each.
   *
   * AND A KILLING BLOW THROWS A SECOND SPRAY OVER THE FIRST. The
   * assembly runs its ordinary `SpawnBlood(pos, rate, 1, 5)` under
   * both overkill branches AND under neither, so the burst is never a
   * replacement - it is an extra spawn, thrown two and a half times
   * as fast and therefore two and a half times as wide. THE BURST
   * GOES DOWN FIRST so the ordinary spray's pool lands on top of it,
   * which is the order the assembly has and the order that reads
   * right: the wide thin spatter, then the pool under the body.
   *
   * Answers the POOL - the ordinary spray's drop zero - or null when
   * nothing landed at all.
   */
  function place(bloodIndex, pos, hit = null) {
    if (!on() || !pos) return null;
    // A BLOODLESS FOE MARKS NOTHING. DFU's own bloodIndex says which
    // six, and characters/enemyBasics.js has carried it since long
    // before this arc.
    if (!marksBlood(bloodIndex)) return null;
    const col = liveCollider();
    if (!col?.surfaceHit) return null;   // between two worlds: a pixel unloaded, a mode half changed   // MAC-BUG W5: surfaceHit, not raycastHit - the ground outside is `heightAt`, not a mesh
    const damage = hit?.damage ?? 0, maxHealth = hit?.maxHealth ?? 0;
    const density = settings?.density?.() ?? 1;
    if (overkillOn() && isOverkill(damage, maxHealth)) {
      // ONLY A PLAYER'S WARHAMMER TAKES THE HEAVY BRANCH. The
      // assembly asks both questions and a foe's blow can answer
      // neither, so everything else is the other branch - which is
      // the one nearly every overkill takes anyway.
      const heavy = !!hit?.fromPlayer && !!hit?.heavy;
      spray(col, pos, burstCount(heavy, density), burstReach(heavy, density), burstRate(heavy, density), hit?.throw);
      // ...AND THE BODY COMES APART. Only the heavy branch: the
      // assembly gibs the death it marked with `lastKilled`, and the
      // player's warhammer is what marks one.
      //
      // IT NEEDS NO DEATH SEAM. The reference defers to
      // `EnemyDeath.OnEnemyDeath` because Unity's death is a separate
      // event and it wants its sound on that frame; a blow for 175%
      // of a body's whole health is ALWAYS lethal, so here the hit IS
      // the death and four hosts are spared a wire they would each
      // have had to remember.
      if (heavy && _gibs.length < GIB_COUNT * MAX_BODIES) { _gibs = _gibs.concat(throwGibs(pos, rng)); reseatGibs(); }
    }
    const rate = bloodRate(damage, maxHealth, density);
    return spray(col, pos, sprayCount(rate), sprayRadius(rate), rate, hit?.throw);
  }

  /** The chunks' batch is built to the live count and rebuilt when
   *  that changes, which is once a gibbing and once when the last one
   *  comes to rest. A billboard quad has no per-vertex size, so there
   *  is no way to blank a spare one the way an empty decal slot is
   *  blanked - the batch is exactly as long as the flight. */
  function reseatGibs() {
    if (_gibBatch) { renderer?.destroyBillboardBatch?.(_gibBatch); _gibBatch = null; }
    _gibPos = _gibs.map((g) => g.pos);   // the chunks' OWN arrays, written through in place
    if (!_gibs.length || !renderer?.createBillboardBatch || !_gibArt) return;
    _gibBatch = renderer.createBillboardBatch(
      _gibArt.archive, _gibArt.record, GIB_QUAD, _gibPos, { dynamic: true },
    );
    if (_gibBatch) _gibBatch.frame = GIB_FRAME;
  }

  /** One faller, one frame. A chunk and a drip fall the same way, so
   *  they walk the same code and differ only in what they carry. */
  function fall(list, dt, col, rate) {
    let moved = 0;
    for (const g of list) {
      const step = gibStep(g, dt);
      if (!step) continue;
      moved++;
      // Between two worlds - a pixel unloaded, a mode half changed -
      // it flies on rather than landing on nothing.
      // MAC-BUG W5: the same ray, and the same reason - a chunk or a
      // drip that met no mesh outdoors fell for ever, which `gibFly`
      // reads as "still in the air" exactly as it should for a thing
      // thrown off a ledge.
      const h = col?.surfaceHit ? col.surfaceHit(step.from, step.dir, step.dist) : null;
      if (!h || !Number.isFinite(h.dist) || h.dist > step.dist) { gibFly(g, step); continue; }
      gibLand(g, [
        step.from[0] + step.dir[0] * h.dist,
        step.from[1] + step.dir[1] * h.dist,
        step.from[2] + step.dir[2] * h.dist,
      ]);
      if (on() && col) spray(col, gibSprayOrigin(g), sprayCount(rate), sprayRadius(rate), rate);
    }
    return moved;
  }

  function tick(dt) {
    if ((!_gibs.length && !_drips.length) || !(dt > 0)) return 0;
    // BLOOD1 AUDIT 3: the switch drops what is in the air - the row the
    // gibs ride (see `overkillOn`) is off, so they stop, and their quads go.
    if (!on()) { _gibs = []; _drips = []; reseatGibs(); return 0; }
    // BLOOD1 AUDIT: THE ART CAN ARRIVE AFTER THE THROW. `_gibArt` is
    // set when a splash's texture resolves, and on the FIRST blood of
    // a session that resolution lands after `place` has already
    // thrown - so the batch was built with no art, and nothing ever
    // built it again. A player whose first blood was a warhammer
    // overkill watched ten invisible chunks fly.
    if (_gibs.length && !_gibBatch && _gibArt) reseatGibs();
    const col = liveCollider();
    const density = settings?.density?.() ?? 1;
    const rate = scaleRate(GIB_SPLASH_RATE, density);
    let moved = fall(_gibs, dt, col, rate);
    // A DRIP CARRIES A DROP, not a body's worth: one mark where it
    // lands, against a chunk's twenty particles' worth.
    moved += fall(_drips, dt, col, scaleRate(DRIP_SPLASH_RATE, density));
    if (_drips.length && _drips.every((g) => g.still)) _drips = [];
    // THE QUADS FOLLOW THE CHUNKS, written rather than rebuilt: ten of
    // them at sixty frames is 2,400 batch rebuilds for one death, each
    // a VAO and two buffers, where this is one bufferSubData.
    if (_gibBatch) renderer?.moveBillboardBatch?.(_gibBatch, _gibPos);
    // a chunk whose four seconds are up is done with, and the list is
    // not a place to keep them - nor the GL.
    //
    // THE LENGTH IS CHECKED FIRST because `[].every()` is TRUE: with
    // no chunks and a drip still falling, the bare `every` ran a
    // reseat on every frame of the fall. It no-opped, which is how it
    // went unseen, and it is the same guard the drips' line above
    // already had.
    if (_gibs.length && _gibs.every((g) => g.still)) { _gibs = []; reseatGibs(); }
    return moved;
  }

  /** The ring is in WORLD space, which in the streaming host is the
   *  shifted frame - so a recentre moves every mark by the same delta,
   *  and the VERTEX BUFFER moves with it, because a decal's corners are
   *  baked into it. */
  function shiftOrigin(offset) {
    shiftGibs(_gibs, offset);    // BLOOD1b: a chunk mid-flight is in world space too
    shiftGibs(_drips, offset);   // ...and so is a drip still falling
    // BLOOD1 AUDIT 3: and their QUADS move now, not next tick. The host
    // shifts, then draws, then ticks - so for the one frame between, the
    // chunks drew from the buffer of the old frame, 819.2 units behind.
    if (_gibBatch) renderer?.moveBillboardBatch?.(_gibBatch, _gibPos);
    if (!_pool || !_pool.count || !offset) return 0;
    const n = _pool.shiftOrigin(offset);
    for (const d of _pool.decals()) {
      writeDecalQuad(_scratch, 0, d);
      renderer.writeDecalSlot(_batch, d.slot, _scratch);
    }
    return n;
  }

  /**
   * The marks, then the chunks over them.
   *
   * THE CAMERA BASIS IS HANDED IN because a billboard needs one and
   * this pool has no camera. Every host already holds both at the line
   * it calls this from - the very next statement is its own
   * `drawBillboards` - so nothing is fetched for it.
   */
  function draw(camRight = null, camUp = null) {
    // BLOOD1 AUDIT 3: THE SWITCH GATES THE DRAW. `on()` was read by place
    // alone, so a player who turned blood off mid-fight kept every mark
    // on the floor and watched the chunks finish their flight.
    if (!on()) return false;
    let drew = false;
    const tex = markTexture();
    if (_batch && _pool && _pool.count && tex) { renderer.drawDecals(_batch, tex, _pool.ranges?.() ?? null); drew = true; }   // BLOOD1 AUDIT 3: the touched slots alone, oldest first
    // BLOOD1b: the chunks are BILLBOARDS and go through the pass every
    // other sprite does - over the marks, because a chunk in the air is
    // above the blood it will become.
    if (_gibBatch && camRight && camUp && renderer?.drawBillboards) {
      renderer.drawBillboards([_gibBatch], camRight, camUp);
      drew = true;
    }
    return drew;
  }

  /** A MODE CHANGE THROWS THE ROOM AWAY. The marks go with it, and the
   *  buffer is blanked slot by slot rather than freed - the ring is the
   *  same ring next time, and rebuilding it would cost an allocation
   *  every time the player opens a door. */
  function clear() {
    _gibs = []; reseatGibs();   // BLOOD1b: a room thrown away takes the chunks still in the air with it, and their quads
    _drips = [];                // ...and the blood its ceilings had not finished with
    if (!_pool) return 0;
    const n = _pool.count;
    for (const d of _pool.decals()) {
      clearDecalQuad(_scratch, 0);
      renderer.writeDecalSlot(_batch, d.slot, _scratch);
    }
    _pool.clear();
    return n;
  }

  // BLOOD1 AUDIT 3: BUILT AT BOOT, as bloodSwitch.js has always said
  // ("allocated once at boot: the ring is built to this size and never
  // grows"). It was built at the first drop that LANDED, so the
  // capacity read was whatever the store held then - and three pools
  // that had bled kept one size while the next dungeon took another.
  // A host that wires no renderer (a stub) still gets a pool with no
  // ring, and `on()` refuses it exactly as before.
  if (renderer?.createDecalBatch) ensure();

  return {
    place, draw, tick, shiftOrigin, clear, useArt,
    gibs: () => _gibs.slice(),
    drips: () => _drips.slice(),
    count: () => (_pool ? _pool.count : 0),
    /** HARD1: this pool ENDS WHAT IT OWNS. The ring is a thousand quads
     *  of vertex data and a VAO, handed to nobody, so the context that
     *  built it frees it here by this binding's own name. */
    dispose() {
      clear();   // BLOOD1b: which drops the chunks and, through reseatGibs, their batch
      if (_batch) renderer?.destroyDecalBatch?.(_batch);
      _batch = null; _pool = null; _texKey = null; _gibArt = null;
      _dead = true;   // BLOOD1 AUDIT: and nothing this pool owns is ever built again
    },
    _pool: () => _pool,
  };
}

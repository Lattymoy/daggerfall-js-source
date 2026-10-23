// @ts-check
// OWNER-CLOCK (2026-10-21, the field's enemy desync - net/ownerClock.js has the wire's half): MY FOES KEEP MY WORLD'S
// PACE WHILE ANYONE ELSE IS IN MY ROOM.
//
// A foe is its owner's to step, so a slow owner's foes are slow for everyone. Below 20 fps they are slower than the
// owner's own world: the host clamps its frame at 0.1 s (world.js "const dt = Math.min(0.1") and the player takes that
// whole frame, but FOE-CATCHUP (characters/enemy/enemyMotor.js FOE_MAX_FRAME_DT, 2026-09-26, Mac: "Yes, add the cap")
// hands a foe's body three FIXED_DT steps of it at most, 0.05 s - so below 10 fps an owner's foes walked at half its
// player's pace, and its every reader watched them do it. That cap is the cure for a snowball: a step is the port's
// dearest work, and a hitch that asked for more of them made the next frame dearer.
//
// THE PARITY. Online, while anyone else is in my room, a pool of my foes is stepped again within the frame, in
// FOE-CATCHUP's own size of step (each call the shape of a 20 fps frame, a shape every pool already runs), until it has
// taken THE HOST'S OWN FRAME - the clamped `dt` the host hands it, the time its player took - and never more: the foes
// keep the owner's pace one to one at every rate the clamp allows, and never outrun it (below 10 fps that is 0.1 s a
// frame in two calls where FOE-CATCHUP gave 0.05 s). Only the extra calls OWNER_CATCHUP_SHARE of the frame's own time
// buys at the cost a call last measured are made - none on a clock too coarse to measure one (a reading of nothing is no
// price), none on a frame past FRAME_MS_MAX (the page was away - a load, a hidden tab - not slow) - and the loop stops
// once the extras have spent that share: where the foes ARE what makes the frame slow, the cap's law stands as it was.
// Offline, alone in the room, at 20 fps and up, or with the foes held (a zero frame), a pool takes the host's one step
// exactly as before. The tactics brain's clock (ai/tacticsClock.js, the foes' own time) is carried with the extra steps,
// so a wind-up lands where its body is - for the frame's first pool; one stepped after it in the same frame finds the
// brain already at the furthest step (one FOE-CATCHUP step past its first call's bodies at most): the clock is one for
// the page and only runs forward, and turning it back for a later pool would make the tokens a first pool's foes took
// read as taken in the future.
//
// HOST-CLOCK (2026-10-21, OWNER-CLOCK's Left): ONE PLAN A FRAME, FOR EVERY POOL OF MINE. OWNER-CLOCK caught up the
// street's encounter pool alone; a building's and a dungeon's foes kept FOE-CATCHUP's half of a slow host's frame, and the
// town watch's bodies kept it while its brains - one tactics clock for the page - ran on with the street's. Every pool
// FOE-CATCHUP caps now goes through the page's one catch-up (`ownerFoes`): the street's encounter pool and its watch
// (wired by world.js), a building's encounter pool and the watch called into it (worldModes.js, at the mount), and a
// dungeon's foes (dungeonContext.js drawFoes, whose foe loop is the step it hands over). The fixed city's street
// (exterior.js) streams nothing and is not wired; its buildings and dungeons go through it alone (offline: one call).
// A frame's plan is made once, at its first step, priced at what every pool of the frame before cost a call, and every
// pool of the frame takes it, so the brain's clock is carried once, as far as every body went. The extras of all of a
// frame's pools together spend OWNER_CATCHUP_SHARE, past it by one call at most - the frame's first extra, made on the
// forecast; a later one is made only while the extras' measured time is under the share. A pool that did not step in
// the frame before (a door taken, a building's pools new) takes the host's one call: nothing measured buys nothing; nor
// does one whose host says none of the foes it steps are mine (AUDIT HOST-CLOCK 1: a dungeon joiner's are all the
// host's puppets, led by its stream, not stepped by my clock - an extra call of theirs is time spent for nothing).
//
// "Anyone else in my room" is the world host's `shared()`: world.js's `online.othersHere > 0`, the foes stream's own
// nobody-to-hear test. On the street that room is the CELL (WORLD_CELL, 16 map pixels a side), wider than the RANGE_PIXELS
// (3) the relay fans my foes frames across - so it is not "anyone who can see these foes"; with parity it need not be:
// what it turns on is my foes at my own world's pace. In a building or a dungeon it is the world room.
//
// THE CLOCK. Each step of the page's foes is marked on the owner clock (net/ownerClock.js) - every pool's at its call,
// and a building's and a dungeon's at the end of the mode machine's frame that ran them - so a foes frame sent before the
// next step says when its foes stood where it says.
import { FOE_MAX_FRAME_DT, foeFrameDt } from '../characters/enemy/enemyMotor.js';
import { tickTactics } from '../ai/tacticsClock.js';
import { ownerClock } from '../net/ownerClock.js';

/** The longest host frame the catch-up sub-steps whole (s) - world.js hands 0.1 s at most, so one extra call; a longer
 *  frame is stepped OWNER_CATCHUP_STEPS_MAX times and no more. */
export const OWNER_CATCHUP_MAX_S = 0.3;
/** The most of a frame's own time the extra steps may spend - a frame grows by a ninth at most, so no snowball. */
export const OWNER_CATCHUP_SHARE = 0.1;
/** The most calls a frame makes of a pool: OWNER_CATCHUP_MAX_S in FOE_MAX_FRAME_DT's steps. */
export const OWNER_CATCHUP_STEPS_MAX = Math.round(OWNER_CATCHUP_MAX_S / FOE_MAX_FRAME_DT);

/** The longest gap the budget reads as a frame's own time (ms): a 0.5 fps frame. Past it the page was away (a load, a
 *  hidden tab), not slow, and the frame buys no extra call. */
export const FRAME_MS_MAX = 2000;

/** How a frame's foes are stepped: `n` calls of `dt` each. The host handed `foeDt` (its clamp's, or 0 held), and
 *  `extraMax` is the extra calls the frame can afford. At 20 fps and up, held, or with no extra call to spend, the
 *  host's one step exactly; under it the host's own frame in calls no longer than FOE_MAX_FRAME_DT (so the motor takes
 *  every second of it) - never more game time than the host's frame, and whatever is afforded, more than the host's
 *  one step gave a foe's body. */
export function catchUpPlan(foeDt, extraMax = OWNER_CATCHUP_STEPS_MAX) {
  if (!(foeDt > FOE_MAX_FRAME_DT)) return { n: 1, dt: foeDt };
  const n = Math.min(OWNER_CATCHUP_STEPS_MAX, Math.ceil(foeDt / FOE_MAX_FRAME_DT - 1e-9), 1 + Math.max(0, Math.floor(extraMax) || 0));
  return n < 2 ? { n: 1, dt: foeDt } : { n, dt: Math.min(FOE_MAX_FRAME_DT, foeDt / n) };
}

/** The extra calls a frame `rawMs` long affords at `perCall` ms a call: OWNER_CATCHUP_SHARE of it - none for a frame
 *  past FRAME_MS_MAX (the page was away), none for the first (0 ms), and none at a price unread: nothing measured yet
 *  (Infinity buys nothing) or a clock too coarse to see a call (a reading of 0, or NaN, is no price - never a free one). */
export const extrasAfforded = (rawMs, perCall) => (rawMs <= FRAME_MS_MAX && perCall > 0 ? (rawMs * OWNER_CATCHUP_SHARE) / perCall : 0);

/**
 * THE CATCH-UP (HOST-CLOCK: one plan a frame for every pool it steps). `step(key, dt, call, mine)` steps one pool's foes
 * through a host frame `dt`: `call(dt)` once, or the plan's calls of FOE-CATCHUP's size - and answers what the last
 * call answered. `key` is the pool (the same object every frame: what a call of it costs is kept against it); `mine`
 * false - none of the foes it steps is mine to step (a dungeon joiner's puppets) - takes the host's one call.
 * `pools(...list)` puts each pool's `update(dt, ...rest)` through it, its signature, its callers and its answer kept.
 * `frame()` - the host's frame begins (the mode machine's, wired by wireOwnerClock); without it a frame begins when a
 * pool it already stepped steps again. `shared()` - anyone else in my room (the host's own nobody-to-hear test);
 * `clock()` ms (the page's performance.now()); `tick` the tactics brain's clock; `mark` the owner clock's.
 * @param {{ shared?: () => boolean, clock?: () => number, tick?: (dt: number) => void, mark?: (ms: number) => void }} [o]
 */
export function createOwnerCatchUp({ shared = () => false, clock = () => performance.now(), tick = tickTactics, mark = (ms) => ownerClock.mark(ms) } = {}) {
  const price = new WeakMap();   // a pool -> the dearest of its calls in the last frame it stepped (ms)
  let stepped = new Set(), before = new Set();   // the pools this frame has stepped, and the frame before's
  let open = false, frameAt = null, caught = false, extraMax = 0, ticked = 0, shareMs = 0, spent = 0;
  /** The frame's plan, at its first step: the time since the last frame's first step, priced at every pool of that frame. */
  const opens = (at, dt) => {
    const rawMs = frameAt == null ? 0 : at - frameAt;
    frameAt = at;
    before = stepped; stepped = new Set();
    let cost = 0;   // none stepped before: a price of nothing, which buys nothing
    for (const k of before) cost += price.get(k);
    caught = shared();
    extraMax = extrasAfforded(rawMs, cost);
    ticked = foeFrameDt(dt);   // the host ticked the brain the frame's capped step before any pool moved
    shareMs = rawMs * OWNER_CATCHUP_SHARE; spent = 0; open = true;
  };
  const catchUp = {
    frame() { open = false; },
    step(key, dt, call, mine = true) {
      const at = clock();
      if (!open || stepped.has(key)) opens(at, dt);
      stepped.add(key);
      mark(at);
      const plan = caught && mine && before.has(key) ? catchUpPlan(dt, extraMax) : { n: 1, dt };
      let out, cost = 0, extrasFrom = null;
      for (let i = 1; i <= plan.n; i++) {
        if (i === 2) { if (spent >= shareMs) break; extrasFrom = clock(); }   // AUDIT HOST-CLOCK 3: a later pool's extras only while the frame's share holds
        else if (i > 2 && spent + clock() - extrasFrom >= shareMs) break;   // the frame's extras have spent its share: the forecast was wrong
        const want = i * plan.dt;
        if (i > 1 && want > ticked) { tick(want - ticked); ticked = want; }   // each later call carries the brain to its end
        const t0 = clock();
        out = call(plan.dt);
        cost = Math.max(cost, clock() - t0);
      }
      if (extrasFrom !== null) spent += clock() - extrasFrom;
      price.set(key, cost);   // the dearest of the frame's calls prices the next frame's
      return out;
    },
    /** @param {...{ update: (dt: number, ...rest: any[]) => any }} list */
    pools(...list) {
      for (const p of list) {
        const update = p.update;
        p.update = (dt, ...rest) => catchUp.step(p, dt, (d) => update.call(p, d, ...rest));   // AUDIT HOST-CLOCK 5: a method's own `this`
      }
    },
  };
  return catchUp;
}

/** One pool, through a catch-up of its own (OWNER-CLOCK's door, kept): `pool.update(dt, ...rest)` keeps its signature,
 *  its callers and its answer. */
export function catchUpOwnerFoes(pool, o = {}) {
  createOwnerCatchUp(o).pools(pool);
  return pool;
}

let _pageShared = () => false;
/** THE PAGE'S OWN (HOST-CLOCK) - one catch-up for every pool of foes the page steps, as it keeps one owner clock and
 *  one tactics clock: the street's two (world.js), a building's two (worldModes.js), a dungeon's foe loop
 *  (dungeonContext.js). Who is here is the world host's word (wireOwnerClock); a page that never says - the fixed city,
 *  the standalone dungeon, offline - catches nothing up. */
export const ownerFoes = createOwnerCatchUp({ shared: () => _pageShared() });

/** A building's and a dungeon's foes are stepped inside the mode machine's frame: one that ran marks the clock. Every
 *  frame of the host's (the street's too: world.js asks the mode machine first) begins a frame of the catch-up's. */
export function markModalSteps(modes, { mark = (ms) => ownerClock.mark(ms), frame = () => {} } = {}) {
  const inner = modes.frame;
  modes.frame = (dt, now) => {
    frame();
    const ran = inner(dt, now);
    if (ran) mark(now);
    return ran;
  };
  return modes;
}

/** The world host's one wiring: the page's catch-up told who is here (`shared`), the street's pools (the encounter pool
 *  and the watch) put through it, its mode machine's frames marked and made the catch-up's frames. A building's pools
 *  and a dungeon's foes go through the same catch-up from their own hosts. */
export function wireOwnerClock(pools, modes, shared) {
  _pageShared = shared;
  ownerFoes.pools(...pools);
  markModalSteps(modes, { frame: () => ownerFoes.frame() });
}

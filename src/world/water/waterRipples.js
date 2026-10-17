// @ts-check
// ═══════════════════════════════════════════════════════════════════
// WATER-NEXT 4 - THE RIPPLES (2026-10-07, Mac: "proper waves and shoreline interactivity"): THE WATER ANSWERS WHAT
// MOVES IN IT. A wading or swimming player leaves rings and a wake, a hull under way a bow wave - none of which the
// swell's trains or the wind's ripples can say, because they are the world's and these are a body's. (AUDIT WATER-NEXT
// m10: the player and the boats are what stir it; a creature's splash is not wired.)
//
// A RIPPLE FIELD round the camera: a damped wave equation on a RIPPLE_CELLS-square grid RIPPLE_SPAN units across,
// stepped at a fixed RIPPLE_HZ (the frame rate never changes how far a ring runs), stirred by `disturb` at a body's
// feet. The grid FOLLOWS the eye a whole cell at a time - its contents slide with it, so a wake stays where it was left
// in the world - and its edge is still water, held so (a ring that runs out of the field meets it damped, and what little
// comes back dies with the rest; AUDIT WATER-NEXT M1: a slide never carries a height onto it). Read by the
// water shader as a height map (`bytes`, 128 the still water), its slope a few more units of normal: drawn only - the
// game's water line never moves.
// ═══════════════════════════════════════════════════════════════════

/** The field's side, in cells. */
export const RIPPLE_CELLS = 96;
/** The field's side, in world units (a cell is half a unit). */
export const RIPPLE_SPAN = 48;
/** The simulation's fixed rate, steps a second. */
export const RIPPLE_HZ = 30;
/** How much of a ring survives a step (the water's drag). */
export const RIPPLE_DAMPING = 0.975;
/** The height (units) a byte's step stands for: 127 steps either way of still water. */
export const RIPPLE_SCALE = 0.012;

/**
 * @returns {{ origin: number[], packed: number[], bytes: Uint8Array, recenter: (x: number, z: number) => boolean,
 *   disturb: (x: number, z: number, strength: number, radius?: number) => void, step: (dt: number) => number,
 *   heightAt: (x: number, z: number) => number, version: () => number, asleep: () => boolean }}
 */
export function createRipples({ cells = RIPPLE_CELLS, span = RIPPLE_SPAN, hz = RIPPLE_HZ, damping = RIPPLE_DAMPING } = {}) {
  const n = cells * cells, cell = span / cells;
  let cur = new Float32Array(n), prev = new Float32Array(n), next = new Float32Array(n);
  const origin = [0, 0];   // the world x, z of cell (0, 0)'s corner - a whole number of cells
  const bytes = new Uint8Array(n).fill(128);
  const packed = [0, 0];   // AUDIT WATER-NEXT G13: the corner the bytes were packed at - the field slides between steps
  let acc = 0, version = 0, live = false;
  const idx = (cx, cz) => cz * cells + cx;

  /** Slide the field to centre on (x, z), a whole cell at a time; true when it moved. */
  function recenter(x, z) {
    const ox = Math.floor(x / cell - cells / 2) * cell, oz = Math.floor(z / cell - cells / 2) * cell;
    const dx = Math.round((ox - origin[0]) / cell), dz = Math.round((oz - origin[1]) / cell);
    if (!dx && !dz) return false;
    origin[0] = ox; origin[1] = oz;
    // AUDIT WATER-NEXT P2: asleep, the field is still water everywhere - there is nothing to slide. Every outdoor frame
    // the eye crossed a cell in had slid two arrays of zeros (0.13 ms a frame walking anywhere, water or none)
    if (!live) return true;
    if (Math.abs(dx) >= cells || Math.abs(dz) >= cells) { cur.fill(0); prev.fill(0); return true; }
    slide(cur, dx, dz); slide(prev, dx, dz);
    return true;
  }
  /** One of the field's arrays moved by whole cells, through the scratch array. AUDIT WATER-NEXT M1: into the INSIDE
   *  only - the edge stays still water. A slide had carried a ring's heights onto the edge rows, which `step` never
   *  writes: they stood there for the rest of the session, the field's energy never fell to its sleep, and the texture
   *  went up thirty times a second from the first wading on. The scratch array is left still water at its edge too, for
   *  the step that writes its inside next. */
  function slide(a, dx, dz) {
    next.fill(0);
    for (let z = 1; z < cells - 1; z++) {
      const sz = z + dz;
      if (sz < 0 || sz >= cells) continue;
      for (let x = 1; x < cells - 1; x++) {
        const sx = x + dx;
        if (sx >= 0 && sx < cells) next[idx(x, z)] = a[idx(sx, sz)];
      }
    }
    a.set(next);
  }

  /** Push the water down at (x, z) - a cosine dimple `radius` units wide, `strength` units deep. */
  function disturb(x, z, strength, radius = 0.8) {
    const r = Math.max(cell, radius), rc = Math.ceil(r / cell);
    const cx = Math.floor((x - origin[0]) / cell), cz = Math.floor((z - origin[1]) / cell);
    for (let j = -rc; j <= rc; j++) {
      for (let i = -rc; i <= rc; i++) {
        const gx = cx + i, gz = cz + j;
        if (gx < 1 || gz < 1 || gx >= cells - 1 || gz >= cells - 1) continue;
        const d = Math.hypot(i * cell, j * cell) / r;
        if (d >= 1) continue;
        cur[idx(gx, gz)] -= strength * 0.5 * (1 + Math.cos(Math.PI * d));
        live = true;
      }
    }
  }

  /** Advance by `dt` seconds at the fixed rate; the steps taken. The edge stays still. */
  function step(dt) {
    acc = Math.min(acc + Math.max(0, dt), 4 / hz);   // a stalled frame runs four steps at most
    let k = 0;
    while (acc >= 1 / hz) {
      acc -= 1 / hz;
      if (!live) continue;
      let energy = 0;
      for (let z = 1; z < cells - 1; z++) {
        for (let x = 1; x < cells - 1; x++) {
          const i = idx(x, z);
          const v = ((cur[i - 1] + cur[i + 1] + cur[i - cells] + cur[i + cells]) * 0.5 - prev[i]) * damping;
          next[i] = v;
          energy += v * v;
        }
      }
      const t = prev; prev = cur; cur = next; next = t;
      k++;
      if (energy < 1e-10) { live = false; cur.fill(0); prev.fill(0); }
    }
    if (k) {
      for (let i = 0; i < n; i++) bytes[i] = Math.max(1, Math.min(255, Math.round(128 + cur[i] / RIPPLE_SCALE)));
      packed[0] = origin[0]; packed[1] = origin[1];
      version++;
    }
    return k;
  }

  /** The field's height (units) at a world point, 0 outside it. */
  function heightAt(x, z) {
    const cx = Math.floor((x - origin[0]) / cell), cz = Math.floor((z - origin[1]) / cell);
    return cx < 0 || cz < 0 || cx >= cells || cz >= cells ? 0 : cur[idx(cx, cz)];
  }

  return { origin, packed, bytes, recenter, disturb, step, heightAt, version: () => version, asleep: () => !live };
}

/** How hard a body stirs the water at a speed (units a second): a still swimmer's bob, a wader's wake. */
export const stirOf = (speed, swimming) => (swimming ? 0.035 : 0.02) + Math.min(speed, 8) * 0.012;
/** How often a body stirs the field, seconds: ten dimples a second make a wake of rings, not a trough. */
export const STIR_PERIOD = 0.1;
/** A hull's stir against a swimmer's: its bow wave is the wider body's. */
export const BOAT_STIR = 2.5;

/**
 * AUDIT WATER-NEXT m12 (THE FOUR HOSTS RULE, THE ONE CONSTRUCTION SEAM): THE HOSTS' ONE STIR. WATER-NEXT 4 wired the field
 * into the streaming world alone - the fixed town (scenes/exterior.js) drew its moats with no ring round a wading player -
 * and its stir was the world host's closure. Both exterior hosts now run this: a frame `begin`s (the field recentred on
 * the eye, whether this frame emits), each body in the water is `stir`red (its speed since it was last seen, one record a
 * body rewritten in place; a dimple on an emitting frame if it moves at `minSpeed` or more), and the frame `end`s (the
 * field stepped). The interiors (scenes/worldModes.js) and the dungeons (scenes/dungeonContext.js) draw no enhanced water:
 * their pools are the classic plane (render/renderer.js drawWater), which reads no field.
 * @param {ReturnType<typeof createRipples>} field
 */
export function createRippleStir(field) {
  const last = new WeakMap();
  let acc = 0, emit = false;
  return {
    field,
    /** @param {number} dt @param {number} x @param {number} z the eye */
    begin(dt, x, z) { field.recenter(x, z); acc += dt; emit = acc >= STIR_PERIOD; if (emit) acc = 0; },
    /** @param {object} key @param {ArrayLike<number>} pos @param {boolean} swimming @param {number} nowMs */
    stir(key, pos, swimming, nowMs, force = 1, minSpeed = 0) {
      let l = last.get(key);
      if (!l) last.set(key, l = { x: pos[0], z: pos[2], t: nowMs });
      const speed = Math.hypot(pos[0] - l.x, pos[2] - l.z) / Math.max(1e-3, (nowMs - l.t) / 1000);
      l.x = pos[0]; l.z = pos[2]; l.t = nowMs;
      if (emit && speed >= minSpeed) field.disturb(pos[0], pos[2], stirOf(speed, swimming) * force, swimming ? 1.0 : 0.7);
    },
    /** @param {number} dt */
    end(dt) { return field.step(dt); },
  };
}

/** AUDIT WATER-NEXT P3: the speed (units a second) under which a hull pushes no bow wave. A boat at its mooring had
 *  stirred the field ten times a second for as long as it lay in sight, so a harbour's field never slept - 30 steps
 *  and 30 uploads a second - and every moored hull ringed like a swimmer treading water. */
export const BOAT_WAKE_SPEED = 0.25;

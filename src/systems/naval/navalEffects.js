// @ts-check
// NAV-B (2026-09-28) - THE SMOKE AND THE SPRAY: what a sea fight looks like between the shot and the splinter. The
// port's own; pure - particles as numbers, drawn by render/navalRender.js.
//
// FIVE KINDS, each a law of its own:
//   smoke  - gun smoke: a puff out of the muzzle along the shot, slowing in the air, SWELLING as it thins and
//            drifting with the wind (Black Flag's broadside hangs a wall of it down the ship's side); grey, blended
//   flash  - the muzzle's fire: a bright, short, additive bloom at the muzzle and a tongue along the shot
//   spray  - a splash's water thrown up and falling back (gravity), white, blended; and FOAM - a ring laid flat on
//            the sea that spreads and fades (drawn flat, `flat: true`)
//   debris - splinters of a hull struck: dark wood chips thrown out along the shot and down, spinning, under gravity
//   ember  - a burning ship's sparks, rising; its FIRE is Daggerfall's own fire flat stood on her deck
//            (scenes/naval/navalFlames.js - TEXTURE.210, the camp's), its smoke this module's
//   glint  - AUDIT NAV1 (the guns): a battery running out - a warm point at each port, flickering and brightening as the
//            guns come out, the tell before her broadside (added); and SHREDS - canvas torn by a ball passing through
//            her rig: pale scraps fluttering down (blended)
//   timber - AUDIT NAV1 (the presentation, #15): planks off a holed hull, laid long on the sea (`aspect`), drifting
//            slow and gone after TIMBER_LIFE or so; and a battered hull's SMOLDER - grey smoke along her deck, more as
//            she is hurt
// Every particle ages to its `life` and is gone; the whole field is held under PARTICLE_BUDGET, so a long broadside
// never costs the frame more than its budget - past it, what a fight's picture misses least goes first (EVICT_RANK).

/** The most particles alive at once. */
export const PARTICLE_BUDGET = 900;
/** AUDIT NAV1 (the frame's cost, #13): WHAT GOES FIRST PAST THE BUDGET - by kind, the least of a fight's picture
 *  first: a splash's spray and foam and a port's glints (a second's flicker each), then the splinters, the canvas
 *  scraps and the embers, then the flashes (a shot's tell) and the planks afloat, and the smoke last - the broadside's
 *  wall, Black Flag's picture of a fight, which went first when the oldest did (two ships trading broadsides reached
 *  the budget in 3 s, and their smoke thinned from the first puff on). Within a kind, the one nearest its end. */
export const EVICT_RANK = Object.freeze({ spray: 0, foam: 0, glint: 0, debris: 1, shred: 1, ember: 1, flash: 2, timber: 2, smoke: 3 });
/** AUDIT NAV1 (the presentation, #15): a plank's life afloat (s, and up to half again), and a battered hull's smoke at
 *  its worst (puffs a second). */
export const TIMBER_LIFE = 18;
export const SMOLDER_RATE = 3;
/** Gravity on spray and debris (m/s^2). */
const G = 9.81;

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

/**
 * @param {{ random?: () => number, wind?: () => number[] }} deps - the wind the smoke drifts on (where it blows to)
 */
export function createNavalEffects({ random = Math.random, wind = () => [0, 0, 0] } = {}) {
  /** @type {any[]} */ let parts = [];
  const r = random;
  const jitter = (s) => (r() - 0.5) * 2 * s;
  const push = (p) => { parts.push(p); };

  /** A puff of gun smoke - `dir` the shot's (unit), `scale` the gun's size. */
  function smoke(pos, dir, scale = 1, n = 6) {
    for (let i = 0; i < n; i++) {
      const out = 1.5 + r() * 5.5;
      push({
        kind: 'smoke', pos: [pos[0] + jitter(0.4), pos[1] + jitter(0.3), pos[2] + jitter(0.4)],
        vel: [dir[0] * out * scale + jitter(0.6), dir[1] * out * 0.4 + 0.25 + r() * 0.4, dir[2] * out * scale + jitter(0.6)],
        age: 0, life: 4 + r() * 4.5, size0: 1.1 * scale, size1: (5 + r() * 3) * scale, drag: 1.4, lift: 0.18,
        color: [0.78 + jitter(0.05), 0.77 + jitter(0.05), 0.74 + jitter(0.05)], alpha: 0.62, rot: r() * 6.28, spin: jitter(0.25), blend: 'alpha',
      });
    }
  }
  /** A muzzle's flash. */
  function flash(pos, dir, scale = 1) {
    push({ kind: 'flash', pos: [...pos], vel: [0, 0, 0], age: 0, life: 0.11, size0: 2.2 * scale, size1: 3.1 * scale, drag: 0, lift: 0, color: [1, 0.78, 0.42], alpha: 1, rot: r() * 6.28, spin: 0, blend: 'add' });
    push({ kind: 'flash', pos: [pos[0] + dir[0] * 1.3 * scale, pos[1] + dir[1] * 1.3 * scale, pos[2] + dir[2] * 1.3 * scale], vel: [dir[0] * 6, dir[1] * 6, dir[2] * 6], age: 0, life: 0.08, size0: 1.6 * scale, size1: 2.4 * scale, drag: 0, lift: 0, color: [1, 0.6, 0.25], alpha: 0.9, rot: r() * 6.28, spin: 0, blend: 'add' });
  }
  /** A muzzle: its flash, and its smoke down the shot. */
  function muzzle(pos, dir, scale = 1) {
    const l = Math.hypot(dir[0], dir[1], dir[2]) || 1;
    const d = [dir[0] / l, dir[1] / l, dir[2] / l];
    flash(pos, d, scale);
    smoke(pos, d, scale, Math.round(5 + 3 * scale));
  }
  /** A ball into the sea: a column of spray and a ring of foam. `big` a heavy ball's or a hull's fall. */
  function splash(pos, big = false) {
    const n = big ? 22 : 12;
    const up = big ? 9 : 6.5;
    for (let i = 0; i < n; i++) {
      const a = r() * 6.28, s = r() * (big ? 2.2 : 1.4);
      push({ kind: 'spray', pos: [pos[0] + jitter(0.3), pos[1] + 0.05, pos[2] + jitter(0.3)], vel: [Math.sin(a) * s, up * (0.55 + r() * 0.6), Math.cos(a) * s], age: 0, life: 0.9 + r() * 0.8, size0: big ? 0.9 : 0.6, size1: big ? 1.8 : 1.2, drag: 0.4, gravity: G, color: [0.9, 0.95, 1], alpha: 0.8, rot: r() * 6.28, spin: jitter(1), blend: 'alpha' });
    }
    push({ kind: 'foam', flat: true, pos: [pos[0], pos[1] + 0.04, pos[2]], vel: [0, 0, 0], age: 0, life: big ? 3.2 : 2.4, size0: big ? 1.6 : 1, size1: big ? 9 : 5.5, drag: 0, lift: 0, color: [0.92, 0.96, 1], alpha: 0.7, rot: r() * 6.28, spin: 0, blend: 'alpha' });
  }
  /** A ball into a hull: splinters thrown along the shot, a puff of dust and smoke, a small flash. `scale` (AUDIT NAV1,
   *  the presentation) grows the burst for an eye far off - the host's HIT_BURST_M: the splinters, flash and puff by it,
   *  thrown faster, a few more of them, the flash a touch longer. */
  function hit(pos, dir, heavy = false, scale = 1) {
    const k = Math.max(1, Number(scale) || 1);
    const l = Math.hypot(dir[0], dir[2]) || 1;
    const d = [dir[0] / l, 0, dir[2] / l];
    const n = Math.round((heavy ? 16 : 10) * (0.5 + 0.5 * k));
    for (let i = 0; i < n; i++) {
      const s = (3 + r() * 7) * Math.sqrt(k);
      push({ kind: 'debris', pos: [...pos], vel: [d[0] * s + jitter(3), (2 + r() * 5) * Math.sqrt(k), d[2] * s + jitter(3)], age: 0, life: 1.2 + r() * 1.2, size0: (0.18 + r() * 0.22) * k, size1: 0.18 * k, drag: 0.2, gravity: G, color: [0.36 + jitter(0.06), 0.25 + jitter(0.04), 0.15], alpha: 1, rot: r() * 6.28, spin: jitter(12), blend: 'alpha', solid: true });
    }
    smoke(pos, [d[0] * 0.3, 0.5, d[2] * 0.3], (heavy ? 0.8 : 0.55) * k, heavy ? 5 : 3);
    push({ kind: 'flash', pos: [...pos], vel: [0, 0, 0], age: 0, life: 0.08 * (0.5 + 0.5 * k), size0: 1.2 * k, size1: 1.8 * k, drag: 0, lift: 0, color: [1, 0.7, 0.35], alpha: 0.8, rot: r() * 6.28, spin: 0, blend: 'add' });
  }
  /** A fire barrel's burst, or a magazine's: a fireball, a column of smoke, splinters, a big splash. */
  function blast(pos) {
    for (let i = 0; i < 10; i++) push({ kind: 'flash', pos: [pos[0] + jitter(1.5), pos[1] + r() * 2, pos[2] + jitter(1.5)], vel: [jitter(3), 2 + r() * 4, jitter(3)], age: 0, life: 0.35 + r() * 0.35, size0: 3 + r() * 2, size1: 6 + r() * 3, drag: 1.5, lift: 0, color: [1, 0.55 + r() * 0.2, 0.2], alpha: 1, rot: r() * 6.28, spin: jitter(1), blend: 'add' });
    smoke(pos, [0, 1, 0], 1.6, 12);
    hit(pos, [jitter(1), 0, jitter(1)], true);
    splash(pos, true);
  }
  /** A burning ship's breath, each frame at each fire: embers up, and now and then a gout of smoke. */
  function burn(pos, dt) {
    const k = clamp(dt, 0, 0.1);
    if (r() < 14 * k) push({ kind: 'ember', pos: [pos[0] + jitter(0.8), pos[1] + r() * 0.5, pos[2] + jitter(0.8)], vel: [jitter(0.6), 2 + r() * 2.5, jitter(0.6)], age: 0, life: 1 + r() * 1.2, size0: 0.22, size1: 0.05, drag: 0.5, lift: 0.4, color: [1, 0.55, 0.18], alpha: 1, rot: 0, spin: 0, blend: 'add' });
    if (r() < 5 * k) push({ kind: 'smoke', pos: [pos[0] + jitter(0.5), pos[1] + 1, pos[2] + jitter(0.5)], vel: [jitter(0.3), 1.6 + r(), jitter(0.3)], age: 0, life: 5 + r() * 3, size0: 1.6, size1: 7, drag: 0.6, lift: 0.3, color: [0.2, 0.19, 0.18], alpha: 0.55, rot: r() * 6.28, spin: jitter(0.2), blend: 'alpha' });
  }
  /** A port of a battery running out, each step while it runs out: `k` how far out (0..1) - the glint brightens. */
  function glint(pos, k, dt) {
    const n = r() < clamp(dt, 0, 0.1) * 30 ? 1 : 0;   // a flicker, about thirty a second
    for (let i = 0; i < n; i++) {
      push({ kind: 'glint', pos: [pos[0] + jitter(0.15), pos[1] + jitter(0.1), pos[2] + jitter(0.15)], vel: [0, 0, 0], age: 0, life: 0.1 + r() * 0.08, size0: 1.1 + 0.6 * k, size1: 1.5 + 0.8 * k, drag: 0, lift: 0, color: [1, 0.6 + 0.15 * r(), 0.26], alpha: 0.35 + 0.6 * clamp(k, 0, 1), rot: r() * 6.28, spin: 0, blend: 'add' });
    }
  }
  /** A ball through her canvas: pale scraps thrown along the shot, fluttering down. */
  function tear(pos, dir) {
    const l = Math.hypot(dir[0], dir[1], dir[2]) || 1;
    const d = [dir[0] / l, dir[1] / l, dir[2] / l];
    for (let i = 0; i < 9; i++) {
      const sp = 1.5 + r() * 3;
      push({ kind: 'shred', pos: [...pos], vel: [d[0] * sp + jitter(1.2), d[1] * sp + jitter(0.8), d[2] * sp + jitter(1.2)], age: 0, life: 2 + r() * 1.5, size0: 0.3 + r() * 0.35, size1: 0.25, drag: 1.6, gravity: 1.6, color: [0.86 + jitter(0.04), 0.82 + jitter(0.04), 0.7], alpha: 0.95, rot: r() * 6.28, spin: jitter(6), blend: 'alpha', solid: true });
    }
  }
  /** AUDIT NAV1 (the presentation, #15): planks off a holed hull - `n` afloat about where she was struck (`pos` on the
   *  sea), laid long, drifting slow. */
  function timber(pos, n = 2) {
    for (let i = 0; i < n; i++) {
      const a = r() * 6.28, sp = 0.3 + r() * 0.5, size = 0.8 + r() * 0.6;
      push({ kind: 'timber', flat: true, solid: true, aspect: 3 + r() * 2, pos: [pos[0] + jitter(2), pos[1] + 0.06, pos[2] + jitter(2)], vel: [Math.sin(a) * sp, 0, Math.cos(a) * sp],
        age: 0, life: TIMBER_LIFE * (1 + r() * 0.5), size0: size, size1: size, drag: 0.25, lift: 0, color: [0.3 + jitter(0.04), 0.2 + jitter(0.03), 0.12], alpha: 1, rot: r() * 6.28, spin: jitter(0.1), blend: 'alpha' });
    }
  }
  /** AUDIT NAV1 (the presentation, #15): a battered hull's breath along her deck, `a` to `b` - `k` her hurt (0..1):
   *  grey smoke, SMOLDER_RATE puffs a second at the worst, each somewhere along it, rising and drifting on the wind. */
  function smolder(a, b, dt, k) {
    if (r() >= SMOLDER_RATE * clamp(k, 0, 1) * clamp(dt, 0, 0.1)) return;
    const u = r();
    push({ kind: 'smoke', pos: [a[0] + (b[0] - a[0]) * u + jitter(1.2), a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u + jitter(1.2)], vel: [jitter(0.3), 1.1 + r() * 0.8, jitter(0.3)],
      age: 0, life: 4 + r() * 3, size0: 1.2, size1: 5.5, drag: 0.6, lift: 0.25, color: [0.36, 0.35, 0.34], alpha: 0.45, rot: r() * 6.28, spin: jitter(0.2), blend: 'alpha' });
  }
  /** A sinking hull's last breath: foam and bubbles where she goes under. */
  function founder(pos, dt, spread = 6) {
    if (r() < 10 * clamp(dt, 0, 0.1)) push({ kind: 'foam', flat: true, pos: [pos[0] + jitter(spread), pos[1] + 0.04, pos[2] + jitter(spread)], vel: [0, 0, 0], age: 0, life: 2.4, size0: 1.2, size1: 4, drag: 0, lift: 0, color: [0.9, 0.95, 1], alpha: 0.6, rot: r() * 6.28, spin: 0, blend: 'alpha' });
  }

  /** One step: every particle moves, drags, falls or rises, drifts on the wind, and ages out. */
  function step(dt) {
    const t = Math.max(0, dt);
    if (t === 0) return;
    const w = wind();
    const keep = [];
    for (const p of parts) {
      p.age += t;
      if (p.age >= p.life) continue;
      const drag = Math.exp(-(p.drag ?? 0) * t);
      p.vel[0] *= drag; p.vel[2] *= drag;
      p.vel[1] = p.vel[1] * drag - (p.gravity ?? 0) * t + (p.lift ?? 0) * t;
      if (p.kind === 'smoke') { p.vel[0] += (w[0] ?? 0) * 0.35 * t; p.vel[2] += (w[2] ?? 0) * 0.35 * t; }
      p.pos[0] += p.vel[0] * t; p.pos[1] += p.vel[1] * t; p.pos[2] += p.vel[2] * t;
      p.rot += p.spin * t;
      keep.push(p);
    }
    parts = keep.length > PARTICLE_BUDGET ? evict(keep, keep.length - PARTICLE_BUDGET) : keep;
  }
  /** `list` less `n` of it by EVICT_RANK - the lowest rank's first, within a rank the nearest its end - the rest kept
   *  in their order. Whole ranks go uncounted; the one the cut falls in is sorted alone. */
  function evict(list, n) {
    const byRank = [[], [], [], []];
    for (let i = 0; i < list.length; i++) byRank[EVICT_RANK[list[i].kind] ?? 0].push(i);
    const drop = new Uint8Array(list.length);
    for (const idx of byRank) {
      if (n <= 0) break;
      if (idx.length > n) idx.sort((a, b) => list[b].age / list[b].life - list[a].age / list[a].life);
      for (let k = 0; k < idx.length && n > 0; k++, n--) drop[idx[k]] = 1;
    }
    return list.filter((_, i) => !drop[i]);
  }

  /** What to draw: `{ pos, size, color: [r, g, b, a], rot, blend, flat, solid }` - the size and alpha by age. */
  function drawList() {
    return parts.map((p) => {
      const k = p.age / p.life;
      const size = p.size0 + (p.size1 - p.size0) * (p.kind === 'smoke' ? Math.sqrt(k) : k);
      const fade = p.kind === 'flash' || p.kind === 'glint' ? 1 - k : p.kind === 'smoke' ? Math.min(1, k * 6) * (1 - k) : p.kind === 'debris' || p.kind === 'shred' ? 1 - Math.max(0, k - 0.7) / 0.3
        : p.kind === 'timber' ? 1 - Math.max(0, k - 0.8) / 0.2 : 1 - k * k;
      return { pos: p.pos, size, color: [p.color[0], p.color[1], p.color[2], p.alpha * fade], rot: p.rot, blend: p.blend, flat: !!p.flat, solid: !!p.solid, kind: p.kind, aspect: p.aspect ?? 1 };
    });
  }

  function offsetAll(o) { for (const p of parts) { p.pos[0] += o[0]; p.pos[1] += o[1]; p.pos[2] += o[2]; } }

  return {
    muzzle, flash, smoke, splash, hit, blast, burn, glint, tear, founder, timber, smolder, step, drawList, offsetAll,
    clear() { parts = []; },
    get count() { return parts.length; },
  };
}

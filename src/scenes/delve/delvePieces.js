// @ts-check
// DELVE II (bible/03-World/Delve-II.md sections 5 and 6): THE PIECES SEEN - each site's marks on its floor through the
// gate's telegraph pass (render/gate/gateTelegraph.js), in its lit grammar: a bright line with a dark keyline, its inside
// filled where the mark is live (never burning ground's, which darkens the floor and reads as a stain in a dark hall),
// under the frame's fog. And the vault: Daggerfall's own chest (model 41811, the Crown Hall's - systems/crownHall.js) in
// the world's mesh list and the collider. The marks are pure (siteShapes, tested) and filled in place; the pass is built
// off the frame (compiledPass, COMPILE-QUEUE). Not a DFU member (Ledger A: DELVE II).
import {
  TELEGRAPH_KIND,
  TELEGRAPH_POOL,
  TELEGRAPH_STYLE,
  GateTelegraphRenderer,
  telegraphPrograms,
} from '../../render/gate/gateTelegraph.js';
import { compiledPass } from '../../render/glProgram.js';
import {
  DP,
  DELVE_WARD_PAD_M,
  LITANY_RING_M,
  LITANY_STAND_M,
  SEAL_RING_M,
  FLAME,
  VIGIL_LIGHT,
  holdGates,
  litanyPlates,
  springSpots,
  springCount,
  brazierSpots,
  weighPlates,
  sealSpots,
} from '../../net/delve/delveLaw.js';
import { PLATE_LOOK } from './delveLitany.js';
import { trs } from '../../world/mat4.js';
import { worldAabb } from '../../player/activate.js';

/** The vault: Daggerfall's chest. */
export const DELVE_CHEST_MODEL = 41811;
/** The marks are drawn for a site within this of the eye (m). */
export const DELVE_DRAW_M = 48;
/** A chest's collider bucket (player/collider.js), one a site. */
export const delveChestBucket = (i) => `delve:chest:${i}`;
/** The colours: the ward's amber, its waking red, a plate's stone, its shown and lit gold, a wrong plate's red, the seal's
 *  violet, a won site's green. */
export const DELVE_COLORS = Object.freeze({
  ward: Object.freeze([0.95, 0.62, 0.25]),
  wake: Object.freeze([1, 0.35, 0.18]),
  stone: Object.freeze([0.62, 0.62, 0.7]),
  shown: Object.freeze([1, 0.92, 0.6]),
  lit: Object.freeze([1, 0.76, 0.28]),
  wrong: Object.freeze([1, 0.22, 0.18]),
  seal: Object.freeze([0.62, 0.42, 1]),
  won: Object.freeze([0.45, 0.95, 0.55]),
});
const GATE_R = 0.6,
  PLATE_R = 0.9,
  SEAL_R = 0.8,
  RING_W = 0.14;
/** A mark's own clock never reaches its wind-up's end (a blow's "now"): its line throbs, nothing lands. */
const MARK_SPAN_S = 1_000;

/** Slot `n` of `out`, made once, its every field set: `kind`, its centre (`x`, `z`, the site's frame), its size (`r`, or
 *  the band `r0`..`r1`), `color` (its line's too), `alpha` and `t` (0 a line alone, 1 filled). */
function put(out, n, kind, x, z, r, r0, color, alpha, t, s) {
  const sh = (out[n] ??= {
    kind,
    origin: [0, 0],
    yaw: 0,
    r: 0,
    halfArc: 0,
    body: 0,
    end: [0, 0],
    halfW: 0,
    r0: 0,
    r1: 0,
    points: [],
    n: 0,
    t: 0,
    flash: 0,
    alpha: 0,
    color,
    edge: color,
    court: 0,
    style: TELEGRAPH_STYLE.weight,
    since: 1,
    span: MARK_SPAN_S,
    after: -1,
    runS: 0,
    pool: TELEGRAPH_POOL.blow,
  });
  sh.kind = kind;
  sh.origin[0] = x;
  sh.origin[1] = z;
  sh.r = r;
  sh.r0 = r0;
  sh.r1 = r;
  sh.color = color;
  sh.edge = color;
  sh.alpha = alpha;
  sh.t = t;
  sh.since = 1 + (s % 60); // 60 s: whole beats of the throb
  return n + 1;
}

/**
 * A site's marks on its floor, in its own frame (its heart the origin), filled into `out` (kept by the caller): `led` its
 * ledger or the room's word of it (null: none started), `looks` the plates' looks (the Litany's, delveLitany.js
 * plateLooks; the Weighing's held), `won` and `sealed` the site's and its vault's, `s` the encounter clock (s), `seed` the
 * dungeon's (a Wellsprings' count). Answers `out`. Pure but for `out`.
 * @param {import('../../net/delve/delveLaw.js').DelveSite} site @param {any} led @param {number[]} looks
 */
export function siteShapes(site, led, looks, { won = false, sealed = true, s = 0, seed = 0 } = {}, out = []) {
  const pulse = 0.5 + 0.5 * Math.sin(s * 4);
  let n = 0;
  if (site.kind === 'hold') {
    const running = !!led && led.p !== DP.idle && led.p !== DP.won;
    n = put(
      out,
      n,
      TELEGRAPH_KIND.ring,
      0,
      0,
      site.r,
      site.r - RING_W,
      won ? DELVE_COLORS.won : running ? DELVE_COLORS.wake : DELVE_COLORS.ward,
      won ? 0.5 : running ? 0.75 + 0.25 * pulse : 0.7,
      1,
      s,
    );
    if (!won) {
      for (const g of holdGates(site))
        n = put(
          out,
          n,
          TELEGRAPH_KIND.disc,
          g[0] - site.x,
          g[2] - site.z,
          GATE_R,
          0,
          running ? DELVE_COLORS.wake : DELVE_COLORS.ward,
          running ? 0.9 : 0.6,
          running && led.p === DP.wave ? 1 : 0,
          s,
        );
    }
  } else if (site.kind === 'litany') {
    n = put(
      out,
      n,
      TELEGRAPH_KIND.ring,
      0,
      0,
      LITANY_RING_M + LITANY_STAND_M + 0.3,
      LITANY_RING_M + LITANY_STAND_M + 0.3 - RING_W,
      won ? DELVE_COLORS.won : DELVE_COLORS.ward,
      won ? 0.5 : 0.7,
      1,
      s,
    );
    const plates = litanyPlates(site);
    for (let j = 0; j < plates.length; j++) {
      const x = plates[j][0] - site.x,
        z = plates[j][2] - site.z,
        look = looks[j] ?? PLATE_LOOK.dark;
      if (look === PLATE_LOOK.shown)
        n = put(out, n, TELEGRAPH_KIND.disc, x, z, PLATE_R, 0, DELVE_COLORS.shown, 1, 1, s);
      else if (look === PLATE_LOOK.lit)
        n = put(out, n, TELEGRAPH_KIND.disc, x, z, PLATE_R, 0, won ? DELVE_COLORS.won : DELVE_COLORS.lit, 0.9, 1, s);
      else if (look === PLATE_LOOK.wrong)
        n = put(out, n, TELEGRAPH_KIND.disc, x, z, PLATE_R, 0, DELVE_COLORS.wrong, 1, 1, s);
      else n = put(out, n, TELEGRAPH_KIND.disc, x, z, PLATE_R, 0, DELVE_COLORS.stone, 0.6, 0, s);
    }
  } else n = kindShapes(site, led, looks, { won, s, seed, pulse }, out, n);
  if (sealed && site.vault)
    n = put(
      out,
      n,
      TELEGRAPH_KIND.disc,
      site.vault[0] - site.x,
      site.vault[2] - site.z,
      SEAL_R,
      0,
      DELVE_COLORS.seal,
      0.6 + 0.4 * pulse,
      0,
      s,
    );
  out.length = n;
  return out;
}

/** DLV4's kinds' marks, from slot `n`: the ward's ring (the seals' about their own ring), and each piece's disc by its
 *  state - a source pouring, the relic's light, the flame at the heart and each brazier lit, a plate held, a seal
 *  standing. Answers the next slot. Pure but for `out`. */
function kindShapes(site, led, looks, { won, s, seed, pulse }, out, n) {
  const running = !!led && led.p !== DP.idle && led.p !== DP.won;
  const disc = (p, r, col, a, fill) => {
    n = put(out, n, TELEGRAPH_KIND.disc, p[0] - site.x, p[2] - site.z, r, 0, col, a, fill, s);
  };
  const ringR = site.kind === 'seals' ? SEAL_RING_M + LITANY_STAND_M : site.r;
  n = put(
    out,
    n,
    TELEGRAPH_KIND.ring,
    0,
    0,
    ringR,
    ringR - RING_W,
    won ? DELVE_COLORS.won : running ? DELVE_COLORS.wake : DELVE_COLORS.ward,
    won ? 0.5 : running ? 0.75 + 0.25 * pulse : 0.7,
    1,
    s,
  );
  if (won) return n;
  if (site.kind === 'wellsprings') {
    const pouring = running && (led.p === DP.spring || led.p === DP.captain);
    springSpots(site, led?.k || springCount(seed, site.i)).forEach((p, j) => {
      if (!pouring || (led.hp?.[j] ?? 0) > 0)
        disc(p, GATE_R, running ? DELVE_COLORS.wake : DELVE_COLORS.ward, running ? 0.9 : 0.6, pouring ? 1 : 0);
    });
  } else if (site.kind === 'vigil') {
    holdGates(site).forEach((g) =>
      disc(
        g,
        GATE_R,
        running ? DELVE_COLORS.wake : DELVE_COLORS.ward,
        running ? 0.9 : 0.6,
        running && led.p === DP.wave ? 1 : 0,
      ),
    );
    const low = running && (led.lt ?? VIGIL_LIGHT) <= VIGIL_LIGHT / 4;
    disc(
      [site.x, site.y, site.z],
      PLATE_R,
      low ? DELVE_COLORS.wrong : DELVE_COLORS.lit,
      low ? 0.6 + 0.4 * pulse : 0.9,
      running ? 1 : 0,
    );
  } else if (site.kind === 'brazier') {
    if (!running || led.p !== DP.work || led.fl === FLAME.heart)
      disc([site.x, site.y, site.z], PLATE_R, DELVE_COLORS.shown, 0.9, running ? 1 : 0);
    brazierSpots(site, led?.k || 3).forEach((b, j) =>
      disc(
        b,
        PLATE_R,
        (led?.lb ?? 0) & (1 << j) ? DELVE_COLORS.lit : DELVE_COLORS.stone,
        0.8,
        (led?.lb ?? 0) & (1 << j) ? 1 : 0,
      ),
    );
  } else if (site.kind === 'weighing') {
    weighPlates(site).forEach((p, j) =>
      disc(p, PLATE_R, looks[j] ? DELVE_COLORS.lit : DELVE_COLORS.stone, looks[j] ? 0.9 : 0.6, looks[j] ? 1 : 0),
    );
  } else if (site.kind === 'seals' && running && led.p === DP.work) {
    sealSpots(site, led.k).forEach((p, j) => {
      if (led.hp?.[j] > 0) disc(p, SEAL_R, DELVE_COLORS.seal, 0.9, 1);
    });
  }
  return n;
}

/** The floor a site's marks are laid over: its ward's circle (the telegraph's one court, at the heart). Pure. */
export const siteFloor = (site) =>
  Object.freeze({ r: site.r + DELVE_WARD_PAD_M, courts: Object.freeze([Object.freeze([0, 0])]), ks: null });

/**
 * The pass and the chests. `renderer` the world's (none: nothing drawn - the tests; its GL state handed back after the
 * pass, as nodeGlow.js does, and its fog read each frame), `meshes` the host's model readers ({ getGpuMesh, cpuModels }),
 * `draws` the world's mesh list (the host's dynamicDraws), `collider` the dungeon's (a chest is solid, as a block's is).
 */
export function createDelvePieces({ renderer = null, meshes = null, draws = null, collider = null } = {}) {
  const gl = renderer?.gl ?? null;
  const door = gl
    ? compiledPass(
        gl,
        telegraphPrograms(false),
        () => new GateTelegraphRenderer(gl),
        (e) => console.warn('[delve] the floor marks would not build', e?.message ?? e),
      )
    : null;
  const chests = new Map(),
    frames = new Map();
  const fog = { mode: 0, density: 0, range: null, color: null, camPos: null };
  let dead = false,
    built = /** @type {any} */ (null);
  /** A site's centre and floor, made once. */
  const frameOf = (site) => {
    let f = frames.get(site.i);
    if (!f) frames.set(site.i, (f = { centre: [site.x, site.y, site.z], floor: siteFloor(site) }));
    return f;
  };
  return {
    /** The marks of each site near the eye. `list` [{ site, shapes }]. Answers whether any drew. The pass is asked for
     *  the first time a site is near enough to draw (its programs compiled off the frame meanwhile). */
    draw(list, proj, view, eye, s) {
      if (dead || !list.length) return false;
      const pass = door?.();
      if (!pass) return false;
      built = pass;
      fog.mode = renderer._fogMode;
      fog.density = renderer._fogDensity;
      fog.range = renderer._fogRange;
      fog.color = renderer._fogColor;
      fog.camPos = renderer._camPos;
      let drew = false;
      for (const { site, shapes } of list) {
        const { centre, floor } = frameOf(site);
        for (const sh of shapes) {
          pass.draw(sh, proj, view, eye, s, fog, centre, null, floor);
          drew = drew || pass.drawn > 0;
        }
      }
      if (drew) renderer?.markForeignPass?.();
      return drew;
    },
    /** Stand a site's chest, once (the model read off the frame): `at` its spot, `yaw` its facing (degrees) - in the mesh
     *  list and the collider. */
    standChest(i, at, yaw) {
      if (dead || !meshes || !draws || chests.has(i)) return;
      chests.set(i, null);
      void Promise.resolve(meshes.getGpuMesh?.(DELVE_CHEST_MODEL))
        .then((gpu) => {
          const cpu = meshes.cpuModels?.get?.(DELVE_CHEST_MODEL);
          if (dead || !gpu || !cpu) {
            chests.set(i, false);
            return;
          } // no model, no chest - never asked again
          const m = chestMatrix(at, yaw, cpu.positions),
            entry = { gpu, object: { matrix: m } };
          draws.push(entry);
          try {
            collider?.addMesh(delveChestBucket(i), cpu.positions, cpu.indices, m);
          } catch (e) {
            console.warn("[delve] the chest's collider", e?.message ?? e);
          }
          chests.set(i, { entry, aabb: worldAabb(cpu.positions, m) });
        })
        .catch(() => chests.set(i, false));
    },
    /** A site's chest's box while it stands, else null. */
    chest: (i) => chests.get(i)?.aabb ?? null,
    destroy() {
      dead = true;
      for (const [i, c] of chests) {
        if (!c) continue;
        const k = draws?.indexOf(c.entry) ?? -1;
        if (k >= 0) draws.splice(k, 1);
        collider?.removeBucket?.(delveChestBucket(i));
      }
      chests.clear();
      built?.destroy?.(); // the pass this host built - never one asked for at the teardown
      built = null;
    },
  };
}

/** The chest's matrix: at its spot, turned `yaw` degrees about up, its lowest point on the floor (a model's origin is
 *  where its block placed it, not its foot). Pure but for reading `positions` (flat x, y, z). */
export function chestMatrix(at, yaw, positions = null) {
  let lo = 0;
  if (positions?.length) {
    lo = Infinity;
    for (let k = 1; k < positions.length; k += 3) if (positions[k] < lo) lo = positions[k];
  }
  return trs(at[0], at[1] - lo, at[2], 0, yaw, 0);
}

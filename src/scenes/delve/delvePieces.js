// @ts-check
// DELVE II (bible/03-World/Delve-II.md sections 5 and 6): THE PIECES SEEN - each site's marks on its floor through the
// gate's telegraph pass (render/gate/gateTelegraph.js, as the Examination's runes and the Hour's blows are drawn: a ground
// disc or ring, lit or dark), and the vault: Daggerfall's own chest (model 41811, the Crown Hall's - systems/crownHall.js)
// in the world's mesh list. The marks are pure (siteShapes, tested); the pass is built off the frame (compiledPass,
// COMPILE-QUEUE). Not a DFU member (Ledger A: DELVE II).
import { TELEGRAPH_KIND, TELEGRAPH_POOL, TELEGRAPH_STYLE, TELEGRAPH_EDGE_SAFE, GateTelegraphRenderer, telegraphPrograms } from '../../render/gate/gateTelegraph.js';
import { compiledPass } from '../../render/glProgram.js';
import { DP, DELVE_WARD_PAD_M, LITANY_RING_M, LITANY_STAND_M, holdGates, litanyPlates } from '../../net/delve/delveLaw.js';
import { PLATE_LOOK } from './delveLitany.js';
import { trs } from '../../world/mat4.js';
import { worldAabb } from '../../player/activate.js';

/** The vault: Daggerfall's chest. */
export const DELVE_CHEST_MODEL = 41811;
/** The marks are drawn for a site within this of the eye (m). */
export const DELVE_DRAW_M = 48;
/** The colours: the ward's amber, its waking red, a plate's stone, its shown and lit gold, a wrong plate's red, the seal's
 *  violet, a won site's green. */
export const DELVE_COLORS = Object.freeze({
  ward: Object.freeze([0.95, 0.62, 0.25]), wake: Object.freeze([1, 0.35, 0.18]),
  stone: Object.freeze([0.55, 0.55, 0.62]), shown: Object.freeze([1, 0.92, 0.6]), lit: Object.freeze([1, 0.76, 0.28]),
  wrong: Object.freeze([1, 0.22, 0.18]), seal: Object.freeze([0.62, 0.42, 1]), won: Object.freeze([0.45, 0.95, 0.55]),
});
const GATE_R = 0.6, PLATE_R = 0.9, SEAL_R = 0.8, RING_W = 0.14;

const shape = (kind, o) => ({
  kind, origin: [0, 0], yaw: 0, r: 0, halfArc: 0, body: 0, end: [0, 0], halfW: 0, r0: 0, r1: 0, points: [], n: 0,
  t: 1, flash: 0, alpha: 1, color: DELVE_COLORS.ward, edge: TELEGRAPH_EDGE_SAFE, court: 0, style: TELEGRAPH_STYLE.weight,
  since: 0, span: 1, after: -1, runS: 0, pool: TELEGRAPH_POOL.ground, ...o,
});
const disc = (x, z, r, color, alpha, flash = 0) => shape(TELEGRAPH_KIND.disc, { origin: [x, z], r, color, alpha, flash });
const ring = (r, color, alpha) => shape(TELEGRAPH_KIND.ring, { r0: r - RING_W, r1: r, color, alpha });

/**
 * A site's marks on its floor, in its own frame (its heart the origin): `led` its ledger (null: none started), `looks` the
 * Litany's plates' looks (delveLitany.js plateLooks), `won` and `sealed` the site's and its vault's, `s` any clock (s).
 * Pure. @param {import('../../net/delve/delveLaw.js').DelveSite} site @param {any} led @param {number[]} looks
 */
export function siteShapes(site, led, looks, { won = false, sealed = true, s = 0 } = {}) {
  const out = [], rel = (p) => [p[0] - site.x, p[2] - site.z];
  const pulse = 0.5 + 0.5 * Math.sin(s * 4);
  if (site.kind === 'hold') {
    const running = !!led && led.p !== DP.idle && led.p !== DP.won;
    out.push(ring(site.r, won ? DELVE_COLORS.won : running ? DELVE_COLORS.wake : DELVE_COLORS.ward, won ? 0.3 : running ? 0.6 + 0.3 * pulse : 0.45));
    if (!won) for (const g of holdGates(site)) { const [x, z] = rel(g); out.push(disc(x, z, GATE_R, running ? DELVE_COLORS.wake : DELVE_COLORS.ward, running && led.p === DP.wave ? 0.75 : 0.3)); }
  } else {
    out.push(ring(LITANY_RING_M + LITANY_STAND_M + 0.3, won ? DELVE_COLORS.won : DELVE_COLORS.ward, won ? 0.3 : 0.4));
    litanyPlates(site).forEach((p, j) => {
      const [x, z] = rel(p), look = looks[j] ?? PLATE_LOOK.dark;
      if (look === PLATE_LOOK.shown) out.push(disc(x, z, PLATE_R, DELVE_COLORS.shown, 1, 0.6));
      else if (look === PLATE_LOOK.lit) out.push(disc(x, z, PLATE_R, won ? DELVE_COLORS.won : DELVE_COLORS.lit, 0.85));
      else if (look === PLATE_LOOK.wrong) out.push(disc(x, z, PLATE_R, DELVE_COLORS.wrong, 1, 0.8));
      else out.push(disc(x, z, PLATE_R, DELVE_COLORS.stone, 0.35));
    });
  }
  if (sealed && site.vault) { const [x, z] = rel(site.vault); out.push(disc(x, z, SEAL_R, DELVE_COLORS.seal, 0.35 + 0.25 * pulse)); }
  return out;
}

/** The floor a site's marks are laid over: its ward's circle (the telegraph's one court, at the heart). */
export const siteFloor = (site) => Object.freeze({ r: site.r + DELVE_WARD_PAD_M, courts: Object.freeze([Object.freeze([0, 0])]), ks: null });

/**
 * The pass and the chests. `renderer` the world's (none: nothing drawn - the tests; its GL state handed back after the
 * pass, as nodeGlow.js does), `meshes` the host's model readers ({ getGpuMesh, cpuModels }), `draws` the world's mesh
 * list (the host's dynamicDraws).
 */
export function createDelvePieces({ renderer = null, meshes = null, draws = null } = {}) {
  const gl = renderer?.gl ?? null;
  const door = gl ? compiledPass(gl, telegraphPrograms(false), () => new GateTelegraphRenderer(gl), (e) => console.warn('[delve] the floor marks would not build', e?.message ?? e)) : null;
  const chests = new Map();
  let dead = false;
  return {
    /** Warm the pass (its programs compiled off the frame), as a site first comes near. */
    warm() { door?.(); },
    /** The marks of each site near the eye. `list` [{ site, shapes }]. Answers whether any drew. */
    draw(list, proj, view, eye, s) {
      const pass = door?.();
      if (!pass || !list.length) return false;
      let drew = false;
      for (const { site, shapes } of list) {
        const centre = [site.x, site.y, site.z], floor = siteFloor(site);
        for (const sh of shapes) { pass.draw(sh, proj, view, eye, s, null, centre, null, floor); drew = drew || pass.drawn > 0; }
      }
      if (drew) renderer?.markForeignPass?.();
      return drew;
    },
    /** Stand a site's chest (once; the model read off the frame). `at` its spot, `yaw` its facing (degrees). Answers its
     *  box when it stands, else null - asked again until it does. */
    chest(i, at, yaw) {
      const have = chests.get(i);
      if (have) return have.aabb;
      if (!meshes || !draws || chests.has(i)) return null;
      chests.set(i, null);
      void Promise.resolve(meshes.getGpuMesh?.(DELVE_CHEST_MODEL)).then((gpu) => {
        const cpu = meshes.cpuModels?.get?.(DELVE_CHEST_MODEL);
        if (dead || !gpu || !cpu) { chests.set(i, false); return; }   // no model, no chest - never asked again
        const m = chestMatrix(at, yaw, cpu.positions), entry = { gpu, object: { matrix: m } };
        draws.push(entry);
        chests.set(i, { entry, aabb: worldAabb(cpu.positions, m) });
      }).catch(() => chests.set(i, false));
      return null;
    },
    destroy() {
      dead = true;
      for (const c of chests.values()) { if (!c) continue; const k = draws?.indexOf(c.entry) ?? -1; if (k >= 0) draws.splice(k, 1); }
      chests.clear();
      door?.()?.destroy?.();
    },
  };
}

/** The chest's matrix: at its spot, turned `yaw` degrees about up, its lowest point on the floor (a model's origin is
 *  where its block placed it, not its foot). Pure but for reading `positions` (flat x, y, z). */
export function chestMatrix(at, yaw, positions = null) {
  let lo = 0;
  if (positions?.length) { lo = Infinity; for (let k = 1; k < positions.length; k += 3) if (positions[k] < lo) lo = positions[k]; }
  return trs(at[0], at[1] - lo, at[2], 0, yaw, 0);
}

// @ts-check
// DELVE II (bible/03-World/Delve-II.md section 5, DLV4): THE NEW KINDS' PIECES SEEN. The pieces a blow breaks - the
// Wellsprings' sources, the seals - and the Vigil's relic are the Court's crystals (render/courtCrystals.js) at a room's
// size, tinted by kind; everything else is Daggerfall's own, rebuilt from the player's files: a pedestal (74237) under
// each brazier, a boulder (60512) for each weight, the camp fire's flame (TEXTURE.210 record 1) on the braziers, at the
// heart and in a carrier's hands. The crystals' list is pure (pieceCrystals, tested); the pass is built off the frame.
// Not a DFU member (Ledger A: DELVE II).
import {
  CourtCrystalRenderer,
  CRYSTAL_PROGRAMS,
  CRYSTAL_GROW_MS,
  CRYSTAL_SHATTER_MS,
} from '../../render/courtCrystals.js';
import { compiledPass } from '../../render/glProgram.js';
import { armFlatAnim } from '../../render/flatAnimation.js';
import { billboardSize } from '../../world/rmbFlats.js';
import { DUNGEON_FIRE_FLAT } from '../../world/dungeon/dungeonFires.js';
import { DUNGEON_TYPES } from '../../formats/mapsFile.js';
import { trs } from '../../world/mat4.js';
import {
  DP,
  FLAME,
  WEIGHT,
  VIGIL_LIGHT,
  springSpots,
  sealSpots,
  brazierSpots,
  weightSpots,
  weighPlates,
  springCount,
} from '../../net/delve/delveLaw.js';

/** A brazier's stand and a weight: Daggerfall's pedestal (PED) and boulder (ST1). */
export const DELVE_PEDESTAL_MODEL = 74237;
export const DELVE_WEIGHT_MODEL = 60512;
/** The flame on a brazier, at the heart and in a carrier's hands: the camp fire's own (world/dungeon/dungeonFires.js). */
export const DELVE_FLAME_FLAT = DUNGEON_FIRE_FLAT;
/** The pedestal's top over the floor (m), a lit brazier's flame on it: record 74237's flat top face 36 units over its
 *  lowest point (y -40 against -4), at world/meshReader.js GLOBAL_SCALE - and `model` stands a model on its lowest point. */
export const DELVE_PEDESTAL_TOP = 0.9;
/** A crystal's size against the Court's (render/courtCrystals.js CRYSTAL_H, 4.4 m): a source and a seal under 2 m. */
export const DELVE_CRYSTAL_SCALE = Object.freeze({ source: 0.42, seal: 0.4, relic: 0.32 });
/** The crystals' tints: a tomb's bone-violet, a pool's cold green, an altar's ember red, a seal's violet, the relic's gold. */
export const DELVE_CRYSTAL_COLORS = Object.freeze({
  tomb: Object.freeze([0.78, 0.7, 1]),
  pool: Object.freeze([0.35, 0.95, 0.8]),
  altar: Object.freeze([1, 0.38, 0.22]),
  seal: Object.freeze([0.62, 0.42, 1]),
  relic: Object.freeze([1, 0.82, 0.38]),
});
const TOMBS = new Set([
  DUNGEON_TYPES.Crypt,
  DUNGEON_TYPES.VampireHaunt,
  DUNGEON_TYPES.Cemetery,
  DUNGEON_TYPES.DesecratedTemple,
]);
const POOLS = new Set([
  DUNGEON_TYPES.Mine,
  DUNGEON_TYPES.NaturalCave,
  DUNGEON_TYPES.HarpyNest,
  DUNGEON_TYPES.SpiderNest,
  DUNGEON_TYPES.DragonsDen,
  DUNGEON_TYPES.VolcanicCaves,
  DUNGEON_TYPES.ScorpionNest,
]);
/** THE SOURCES' LOOK by the dungeon's type: a cracked tomb where the dead lie, a pool in a cave, else a broken altar. Pure. */
export const sourceLook = (dungeonType) =>
  TOMBS.has(dungeonType) ? 'tomb' : POOLS.has(dungeonType) ? 'pool' : 'altar';

/** One crystal of the list, slot `n` of `out` made once and every field set (the pass's own shape). */
function crystal(out, n, at, seed, grow, broke, hp, color, scale) {
  const q = (out[n] ??= {
    at: [0, 0, 0],
    yaw: 0,
    seed: 0,
    grow: 1,
    broke: -1,
    hp: 1,
    flash: 0,
    color,
    scale: 1,
    beam: null,
  });
  q.at[0] = at[0];
  q.at[1] = at[1];
  q.at[2] = at[2];
  q.yaw = seed * 1.7;
  q.seed = seed;
  q.grow = grow;
  q.broke = broke;
  q.hp = hp;
  q.color = color;
  q.scale = scale;
  return n + 1;
}
/**
 * A site's crystals, filled into `out` (kept by the caller): `view` its ledger or the room's word of it (null: none
 * started), `look` the sources' (sourceLook), `seed` the dungeon's, `s` the clock (s), `broke` each piece's moment of
 * breaking (s, by index), `rose` when the seals last rose (s). A Wellsprings' sources stand from the first (their count
 * the seed's), whole until they pour; the relic stands with its light; the seals only while they stand. Pure but for `out`.
 * @param {import('../../net/delve/delveLaw.js').DelveSite} site @param {any} view
 */
export function pieceCrystals(
  site,
  view,
  { look = 'altar', seed = 0, s = 0, broke = /** @type {number[]} */ ([]), rose = 0, won = false } = {},
  out = [],
) {
  let n = 0;
  const gone = (j) => (Number.isFinite(broke[j]) ? s - broke[j] : -1);
  if (site.kind === 'wellsprings' && !won) {
    const k = view?.k || springCount(seed, site.i),
      pouring = view && (view.p === DP.spring || view.p === DP.captain);
    springSpots(site, k).forEach((p, j) => {
      const hp = pouring ? (view.hx > 0 ? Math.max(0, view.hp?.[j] ?? 0) / view.hx : 0) : 1;
      if (pouring && hp <= 0 && !(gone(j) >= 0 && gone(j) < CRYSTAL_SHATTER_MS / 1000)) return;
      n = crystal(
        out,
        n,
        p,
        site.i * 7 + j,
        1,
        pouring && hp <= 0 ? gone(j) : -1,
        Math.max(hp, 0.05),
        DELVE_CRYSTAL_COLORS[look] ?? DELVE_CRYSTAL_COLORS.altar,
        DELVE_CRYSTAL_SCALE.source,
      );
    });
  } else if (site.kind === 'vigil' && !won) {
    const lt = view && view.p !== DP.idle ? (view.lt ?? VIGIL_LIGHT) / VIGIL_LIGHT : 1;
    n = crystal(
      out,
      n,
      [site.x, site.y, site.z],
      site.i * 7,
      1,
      -1,
      Math.max(0.05, lt),
      DELVE_CRYSTAL_COLORS.relic,
      DELVE_CRYSTAL_SCALE.relic,
    );
  } else if (site.kind === 'seals' && view && (view.p === DP.work || view.p === DP.sunk)) {
    const grow = Math.min(1, Math.max(0, ((s - rose) * 1000) / CRYSTAL_GROW_MS));
    sealSpots(site, view.k).forEach((p, j) => {
      const hp = view.p === DP.work && view.hx > 0 ? Math.max(0, view.hp?.[j] ?? 0) / view.hx : 0;
      if (hp <= 0 && !(gone(j) >= 0 && gone(j) < CRYSTAL_SHATTER_MS / 1000)) return;
      n = crystal(
        out,
        n,
        p,
        site.i * 7 + j,
        grow,
        hp <= 0 ? gone(j) : -1,
        Math.max(hp, 0.05),
        DELVE_CRYSTAL_COLORS.seal,
        DELVE_CRYSTAL_SCALE.seal,
      );
    });
  }
  out.length = n;
  return out;
}

/** Where each of a site's flames stands now (`[x, y, z]` its foot), by its key: the heart's while the flame is there, each
 *  lit brazier's on its pedestal, one lying where it fell. A carried flame is its carrier's (the host's). Pure. */
export function siteFlames(site, view, won = false) {
  const out = [];
  if (site.kind !== 'brazier') return out;
  const k = view?.k || 3,
    lit = view?.lb ?? 0;
  brazierSpots(site, k).forEach((b, j) => {
    if (won || lit & (1 << j)) out.push([`b${j}`, [b[0], b[1] + DELVE_PEDESTAL_TOP, b[2]]]);
  });
  if (won) return out;
  if (!view || view.p === DP.idle || view.fl === FLAME.heart || view.p !== DP.work)
    out.push(['heart', [site.x, site.y, site.z]]);
  else if (view.fl === FLAME.lying && Array.isArray(view.fx) && view.fx.length === 3) out.push(['lying', [...view.fx]]);
  return out;
}
/** Where each weight lies now (`[x, y, z]`, by its index), or null while carried - its carrier's to show. Pure. */
export function weightPlaces(site, view) {
  const plates = weighPlates(site),
    homes = weightSpots(site);
  return homes.map((h, j) => {
    const t = view?.wt?.[j];
    if (t?.s === WEIGHT.carried) return null;
    if (t?.s === WEIGHT.plate && plates[t.p]) return plates[t.p];
    if (t?.s === WEIGHT.floor) return [t.x, t.y, t.z];
    return h;
  });
}

/**
 * The pass and the props. `renderer` the world's (none: nothing drawn - the tests), `meshes` the host's model readers
 * ({ getGpuMesh, cpuModels }), `draws` the world's mesh list, `collider` the dungeon's (a pedestal is solid), `flats` the
 * context's flat doors ({ getTexture, uploadRecord, uploadRecordFrame, batches, anims } - the treasure piles' own).
 */
export function createDelveProps({ renderer = null, meshes = null, draws = null, collider = null, flats = null } = {}) {
  const gl = renderer?.gl ?? null;
  const door = gl
    ? compiledPass(
        gl,
        CRYSTAL_PROGRAMS,
        () => new CourtCrystalRenderer(gl),
        (e) => console.warn('[delve] the crystals would not build', e?.message ?? e),
      )
    : null;
  const fog = { mode: 0, density: 0, range: null, color: null, camPos: null };
  const models = new Map(),
    flames = new Map();
  let dead = false,
    built = /** @type {any} */ (null),
    flameSize = /** @type {any} */ (null),
    flameTex = /** @type {any} */ (null);
  void Promise.resolve(flats?.getTexture?.(DELVE_FLAME_FLAT.archive))
    .then((t) => {
      if (dead || !t || DELVE_FLAME_FLAT.record >= t.recordCount) return;
      flats.uploadRecord?.(DELVE_FLAME_FLAT.archive, DELVE_FLAME_FLAT.record);
      flameTex = t;
      flameSize = billboardSize(t, DELVE_FLAME_FLAT.record);
    })
    .catch(() => {});
  const dropEntry = (entry) => {
    const k = draws?.indexOf(entry) ?? -1;
    if (k >= 0) draws.splice(k, 1);
  };
  return {
    /** The crystals near the eye (`list` the sites' pieceCrystals, joined). Answers whether any drew. */
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
      pass.draw(list, proj, view, eye, s, fog);
      if (pass.drawn > 0) renderer?.markForeignPass?.();
      return pass.drawn > 0;
    },
    /** A model of Daggerfall's stood (or moved) under `key`: `id`, at `at` (its lowest point on the floor), `yaw`
     *  degrees; `solid` puts it in the collider. Read off the frame, once a key. */
    model(key, id, at, yaw = 0, solid = false) {
      if (dead || !meshes || !draws) return;
      const m = models.get(key);
      if (m) {
        if (m.at[0] === at[0] && m.at[1] === at[1] && m.at[2] === at[2] && m.yaw === yaw) return; // standing still: nothing made
        if (m.entry) m.entry.object.matrix = trs(at[0], at[1] - m.lo, at[2], 0, yaw, 0);
        m.at = [at[0], at[1], at[2]];
        m.yaw = yaw;
        return;
      }
      const rec = { entry: /** @type {any} */ (null), lo: 0, at: [at[0], at[1], at[2]], yaw, solid };
      models.set(key, rec);
      void Promise.resolve(meshes.getGpuMesh?.(id))
        .then((gpu) => {
          const cpu = meshes.cpuModels?.get?.(id);
          if (dead || !gpu || !cpu || models.get(key) !== rec) return;
          let lo = Infinity;
          for (let k = 1; k < cpu.positions.length; k += 3) if (cpu.positions[k] < lo) lo = cpu.positions[k];
          rec.lo = Number.isFinite(lo) ? lo : 0;
          rec.entry = { gpu, object: { matrix: trs(rec.at[0], rec.at[1] - rec.lo, rec.at[2], 0, rec.yaw, 0) } };
          draws.push(rec.entry);
          if (solid) {
            try {
              collider?.addMesh(`delve:prop:${key}`, cpu.positions, cpu.indices, rec.entry.object.matrix);
            } catch (e) {
              console.warn("[delve] a prop's collider", e?.message ?? e);
            }
          }
        })
        .catch(() => {});
    },
    /** The model under `key` taken away. */
    unmodel(key) {
      const m = models.get(key);
      if (!m) return;
      models.delete(key);
      if (m.entry) dropEntry(m.entry);
      if (m.solid) collider?.removeBucket?.(`delve:prop:${key}`);
    },
    /** A flame stood (or moved) under `key`, its foot at `at`. Nothing until the flat's record is up. */
    flame(key, at) {
      if (dead || !flameSize || !renderer?.createBillboardBatch || !flats?.batches) return;
      let f = flames.get(key);
      if (!f) {
        const batch = renderer.createBillboardBatch(
          DELVE_FLAME_FLAT.archive,
          DELVE_FLAME_FLAT.record,
          flameSize,
          [[0, 0, 0]],
          { dynamic: true },
        );
        armFlatAnim(
          batch,
          flameTex,
          DELVE_FLAME_FLAT.archive,
          DELVE_FLAME_FLAT.record,
          flats.anims,
          flats.uploadRecordFrame,
        );
        flats.batches.push(batch);
        flames.set(key, (f = { batch }));
      }
      f.batch.origin = [at[0], at[1], at[2]];
    },
    /** The flame under `key` put out. */
    unflame(key) {
      const f = flames.get(key);
      if (!f) return;
      flames.delete(key);
      flats?.anims?.remove?.(f.batch);
      const k = flats?.batches?.indexOf(f.batch) ?? -1;
      if (k >= 0) flats.batches.splice(k, 1);
      renderer?.destroyBillboardBatch?.(f.batch);
    },
    /** The flames standing now, by key (the host puts out those it no longer names). */
    flameKeys: () => [...flames.keys()],
    destroy() {
      dead = true;
      for (const key of [...models.keys()]) this.unmodel(key);
      for (const key of [...flames.keys()]) this.unflame(key);
      built?.destroy?.(); // the pass this host built - never one asked for at the teardown
      built = null;
    },
  };
}

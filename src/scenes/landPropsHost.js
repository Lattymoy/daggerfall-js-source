// @ts-check
// TESA-LANDS (bible/03-World/Tamriel-Lands.md, "Their host"): THE LANDMARKS' HOST, a module the trees' host builds and
// frames (HOST-SPLIT; scenes/grahtHost.js is its shape). The GPU is made at the first landmark framed, a mesh or a picture
// a breath, in Low Poly Trees' own buffers; the frame culls each built pixel's set to the view, the fog and its kind's
// `far`, at its LOD, on the renderer's fourth tree slot, the nearest bodied ones the sun's casters. Off the lands' row
// (systems/landsSwitch.js) it is never made. THE FOUR HOSTS: scenes/world.js WIRED through the trees' host and the
// pixel's build; scenes/exterior.js, worldModes.js and dungeonContext.js:
// FLAGGED: none stands the wilderness past the Bay the landmarks stand in.
import { LowPolyTreesGpu } from '../render/lowPolyTreesRender.js';
import { LAND_KINDS, LAND_VARIANTS, LAND_LODS, LAND_SUBS, landPropMesh } from '../world/lands/landPropMesh.js';
import { LAND_PROP_FLOATS, LAND_KIND_LAW, LAND_LOOKS, LAND_LOOK_NAMES, landLodOf } from '../world/lands/landProps.js';
import { LAND_ART, LAND_KIND_ART, landPicture, pictureMean } from '../render/landPropArt.js';
import { mipChain } from '../render/grahtOakArt.js';
import { LPT_INSTANCE_FLOATS } from '../world/lowPolyTrees.js';
import { packGrahtMeshes, fogReach } from './grahtHost.js';
import { pageHas } from '../systems/pageQuery.js';

/** The renderer's tree slot the landmarks are handed to (0 Low Poly Trees', 1 the jungle's, 2 the graht-oaks'). */
export const LAND_PROPS_SLOT = 3;
/** The draw's numbers: where a landmark reads its sun (a share of its height), how far from the eye one casts into the
 *  sun's maps (m) and how many cast, and how many landmarks of a kind a set's run holds at most (runsOf - a frame's test
 *  a run). */
export const LAND_DRAW = Object.freeze({ sunLift: 0.6, castReach: 240, casters: 16, chunk: 256 });
/** The most variants a kind has (LAND_VARIANTS') - a bucket's stride. */
const MAXV = Math.max(...Object.values(LAND_VARIANTS));
const KINDS = LAND_KINDS.length;

/** A mesh's index among every kind's variants at every LOD - `[kind][variant][lod]` in LAND_KINDS' order. */
export function landMeshIndex(k, v, lod) {
  let at = 0;
  for (let i = 0; i < k; i++) at += /** @type {any} */ (LAND_VARIANTS)[LAND_KINDS[i]] * LAND_LODS;
  return at + v * LAND_LODS + lod;
}

/** A hex colour's bytes over 255. */
const rgb01 = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};
/**
 * A SUBMESH'S COLOUR for a look: its colour over its picture's mean (a grey picture's - the material's grain then stands
 * at the look's own colour on the whole), white for a picture in its own colours or a sub the look gives none.
 * @param {string|null} hex @param {string} picture LAND_ART's name @param {number[]} mean its pictureMean
 */
export function lookTint(hex, picture, mean) {
  if (!hex || !(/** @type {any} */ (LAND_ART)[picture].grey)) return [1, 1, 1];
  const c = rgb01(hex);
  return c.map((v, i) => v / Math.max(0.05, mean[i]));
}

/**
 * @param {{ renderer: any, breathe?: () => Promise<void> }} deps `breathe` the stream's slice clock (the build's breather),
 *   between the meshes and the pictures made
 */
export function createLandPropsHost({ renderer, breathe = async () => {} }) {
  let gpu = null,
    failed = false,
    preparing = null,
    destroyed = false;
  /** the pictures, as the renderer holds them, by name */
  let texes = null;
  /** a caster mesh a kind's variant (renderer.createMesh: its LOD 1's body and crown), [k * MAXV + v] */
  let casters = null;
  /** a kind's variant's measures at scale 1 - [top, reach, stalk] at [(k * MAXV + v) * 3] */
  const measures = new Float32Array(KINDS * MAXV * 3);
  const B = LAND_LOOK_NAMES.length * MAXV * LAND_LODS;
  /** the run a bucket draws ((look * MAXV + variant) * LAND_LODS + lod), or -1 */
  const runOf = new Int32Array(B).fill(-1);
  const counts = new Int32Array(B),
    starts = new Int32Array(B),
    fill = new Int32Array(B);
  let data = new Float32Array(0),
    scratch = new Float32Array(0),
    keys = new Int32Array(0),
    shown = 0;
  const frameOut = {
    eye: [0, 0, 0],
    radius: 1e9,
    band: 1,
    gpu: null,
    runs: [],
    cut: new Set(),
    sunLift: LAND_DRAW.sunLift,
  };
  /** a run a look's variant and LOD, made with the GPU: `bucket` its bucket */
  const runs = [];
  const castM = Array.from({ length: LAND_DRAW.casters }, () => new Float32Array(16));
  const CAST = 7,
    castBuf = new Float64Array(LAND_DRAW.casters * CAST);
  let castN = 0;
  const castIn = (d, mi, x, y, z, yaw, s) => {
    const K = LAND_DRAW.casters;
    if (castN === K && d >= castBuf[(K - 1) * CAST]) return;
    let at = castN < K ? castN++ : K - 1;
    while (at > 0 && castBuf[(at - 1) * CAST] > d) {
      castBuf.copyWithin(at * CAST, (at - 1) * CAST, at * CAST);
      at--;
    }
    const o = at * CAST;
    castBuf[o] = d;
    castBuf[o + 1] = mi;
    castBuf[o + 2] = x;
    castBuf[o + 3] = y;
    castBuf[o + 4] = z;
    castBuf[o + 5] = yaw;
    castBuf[o + 6] = s;
  };
  const stat = { props: 0, drawn: 0, lod: [0, 0, 0], casters: 0, sets: 0, skipped: 0 };
  const farOf = LAND_KINDS.map((k) => /** @type {any} */ (LAND_KIND_LAW)[k].far);
  /** the last frame's pixels (the probes' read) */
  let lastPixels = [];
  /** THE PROBES' READ (tools/landsProbe.mjs), behind the shot gate (AUDIT ANTICHEAT A2): the last frame's count, and the
   *  nearest landmark to (x, z) of a kind (any, null) - `{ at: [x, y, z], kind, look, top, reach }` at its scale, or null */
  const probe = {
    stats: () => stat,
    near(kind = null, x = 0, z = 0) {
      let best = null,
        bd = Infinity;
      for (const p of lastPixels) {
        const set = p.landProps,
          t = p._t;
        if (!set || !t) continue;
        for (let i = 0; i < set.props.length; i += LAND_PROP_FLOATS) {
          const pr = set.props,
            k = LAND_KINDS[pr[i + 5]];
          if (kind && k !== kind) continue;
          const d = Math.hypot(pr[i] + t[0] - x, pr[i + 2] + t[2] - z);
          if (d >= bd) continue;
          const o = (pr[i + 5] * MAXV + pr[i + 6]) * 3;
          bd = d;
          best = {
            at: [pr[i] + t[0], pr[i + 1] + t[1], pr[i + 2] + t[2]],
            kind: k,
            look: LAND_LOOK_NAMES[pr[i + 7]],
            top: measures[o] * pr[i + 4],
            reach: measures[o + 1] * pr[i + 4],
          };
        }
      }
      return best;
    },
  };
  if (pageHas('shot')) globalThis.__landProps = probe;
  const bodyOf = LAND_KINDS.map((k) => !!(/** @type {any} */ (LAND_KIND_LAW)[k].body));

  /** a picture and its chain into the renderer's atlas door - each level's rows bottom-up (a mesh's v 0 its bottom) */
  const upload = (pic) => {
    const chain = mipChain(pic);
    const tex = renderer.createAtlasTexture(pic.width, pic.height, chain.length);
    for (let i = 0; i < chain.length; i++) {
      const { width: w, height: h, data: d } = chain[i],
        row = w * 4,
        up = new Uint8Array(w * h * 4);
      for (let y = 0; y < h; y++) up.set(d.subarray(y * row, (y + 1) * row), (h - 1 - y) * row);
      renderer.uploadAtlasRows(tex, i, 0, w, up);
    }
    return tex;
  };
  /** THE GPU, made once on the slice clock - or never, after a throw (the landmarks stand unseen, their bodies still
   *  turning the player). Asked by the frame; it draws once it is made. */
  function prepare() {
    if (gpu || failed || preparing || destroyed) return preparing;
    preparing = (async () => {
      try {
        const made = [];
        for (const kind of LAND_KINDS) {
          for (let v = 0; v < /** @type {any} */ (LAND_VARIANTS)[kind]; v++) {
            for (let l = 0; l < LAND_LODS; l++) {
              made.push(landPropMesh(kind, v, l));
              await breathe();
            }
          }
        }
        const packed = packGrahtMeshes(made);
        await breathe();
        const pics = new Map();
        for (const name of Object.keys(LAND_ART)) {
          pics.set(name, landPicture(name));
          await breathe();
        }
        if (destroyed) return;
        build(packed, pics);
      } catch (e) {
        console.warn('[lands] the landmarks could not be built', e);
        destroy();
        failed = true;
      } finally {
        preparing = null;
      }
    })();
    return preparing;
  }
  /** the GPU from the meshes and pictures made - the CPU's copies let go once they are uploaded */
  function build(packed, pics) {
    const made = packed.made;
    gpu = new LowPolyTreesGpu(renderer.gl, packed.index, packed.bin);
    texes = new Map();
    const means = new Map();
    for (const [name, pic] of pics) {
      texes.set(name, upload(pic));
      means.set(name, pictureMean(pic));
    }
    casters = new Array(KINDS * MAXV).fill(null);
    LAND_KINDS.forEach((kind, k) => {
      for (let v = 0; v < /** @type {any} */ (LAND_VARIANTS)[kind]; v++) {
        const m0 = made[landMeshIndex(k, v, 0)],
          o = (k * MAXV + v) * 3;
        measures[o] = m0.top;
        measures[o + 1] = m0.reach;
        measures[o + 2] = m0.stalk;
        if (!bodyOf[k]) continue;
        const m = made[landMeshIndex(k, v, 1)],
          n = m.subs[0][1] + m.subs[1][1]; // its body and crown - a card casts no square
        if (!n) continue;
        casters[k * MAXV + v] = renderer.createMesh({
          positions: m.positions.subarray(0, n * 3),
          normals: m.normals.subarray(0, n * 3),
          uvs: m.uvs.subarray(0, n * 2),
          indices: Uint32Array.from({ length: n }, (_, i) => i),
          subMeshes: [{ startIndex: 0, primitiveCount: n / 3 }],
        });
      }
    });
    runs.length = 0;
    runOf.fill(-1);
    LAND_LOOK_NAMES.forEach((name, li) => {
      const look = /** @type {any} */ (LAND_LOOKS)[name],
        k = LAND_KINDS.indexOf(look.kind),
        law = /** @type {any} */ (LAND_KIND_LAW)[look.kind];
      const art = /** @type {any} */ (LAND_KIND_ART)[look.kind],
        colours = [look.body, look.crown, look.detail];
      for (const v of new Set(look.variants)) {
        for (let l = 0; l < LAND_LODS; l++) {
          const mi = landMeshIndex(k, v, l),
            subs = [];
          made[mi].subs.forEach(([, count], i) => {
            if (!count) return;
            const [offset] = gpu.subs[mi][i],
              card = LAND_SUBS[i] === 'detail' && look.kind !== 'parasol';
            subs.push({
              offset,
              count,
              tex: texes.get(art[i]),
              alpha: card ? 1 : 0,
              color: lookTint(colours[i], art[i], means.get(art[i])),
              cull: card ? 0 : 2,
            });
          });
          const o = (k * MAXV + v) * 3,
            b = (li * MAXV + v) * LAND_LODS + l;
          runOf[b] = runs.length;
          runs.push({
            bucket: b,
            run: { handle: null },
            scale: [1, 1, 1],
            size: [measures[o + 1] * 2, measures[o]],
            sway: law.sway,
            windfall: 0,
            subs,
            drawStart: 0,
            drawCount: 0,
          });
        }
      }
    });
  }
  function destroy() {
    destroyed = true;
    if (globalThis.__landProps === probe) delete globalThis.__landProps;
    lastPixels = [];
    renderer.setLowPolyTrees?.(null, LAND_PROPS_SLOT);
    gpu?.destroy();
    gpu = null;
    for (const t of texes?.values() ?? []) renderer.releaseAtlasTexture(t);
    texes = null;
    for (const m of casters ?? []) if (m) renderer.destroyMesh(m);
    casters = null;
    runs.length = 0;
  }
  /** a set's RUNS - its landmarks a kind at a time as the kernel lays them (world/lands/landProps.js landSites: a kind's
   *  sites together, its cells row by row), cut every LAND_DRAW.chunk of them, each `{ k, from, to, box }` (floats; its
   *  feet's box, pixel-local, out by their reach) - made once a set, so a frame passes over a run whole where its box is
   *  past its kind's farthest: a Fens pixel's 5,000 reed clumps cost a test a band of rows, past their 260 m */
  const runsOf = (set) => {
    if (set.runs) return set.runs;
    const p = set.props,
      out = [];
    let r = null;
    for (let i = 0; i < p.length; i += LAND_PROP_FLOATS) {
      const k = p[i + 5],
        R = measures[(k * MAXV + p[i + 6]) * 3 + 1] * p[i + 4];
      if (!r || r.k !== k || r.to - r.from >= LAND_DRAW.chunk * LAND_PROP_FLOATS) {
        r = { k, from: i, to: i, box: [Infinity, Infinity, -Infinity, -Infinity] };
        out.push(r);
      }
      r.to = i + LAND_PROP_FLOATS;
      r.box[0] = Math.min(r.box[0], p[i] - R);
      r.box[1] = Math.min(r.box[1], p[i + 2] - R);
      r.box[2] = Math.max(r.box[2], p[i] + R);
      r.box[3] = Math.max(r.box[3], p[i + 2] + R);
    }
    set.runs = out;
    return out;
  };
  /** whether a run's box comes within its kind's farthest (or the fog - and, for a kind that casts, the casters' reach)
   *  of the eye at (ex, ez), its pixel at `t` */
  const runNear = (run, t, ex, ez, reach) => {
    const bx = Math.max(run.box[0] + t[0] - ex, 0, ex - run.box[2] - t[0]),
      bz = Math.max(run.box[1] + t[2] - ez, 0, ez - run.box[3] - t[2]);
    const cut = Math.min(farOf[run.k], reach);
    return Math.hypot(bx, bz) <= (bodyOf[run.k] ? Math.max(cut, LAND_DRAW.castReach) : cut);
  };
  return {
    /**
     * THE FRAME: every built pixel's landmarks (`pixels` the frame's, each with its translation `_t` and its set
     * `landProps`), culled to `planes` (the view's, normalised; null: none culled), the fog's reach and each kind's `far`,
     * each at its LOD, handed to the renderer's slot; the nearest bodied ones within LAND_DRAW.castReach recorded for the
     * sun's maps.
     * @param {any[]} pixels @param {ArrayLike<number>} eye @param {Float32Array|null} planes
     */
    frame(pixels, eye, planes) {
      lastPixels = pixels;
      let total = 0,
        any = false;
      for (const p of pixels)
        if (p.landProps && p._t) {
          any = true;
          break;
        }
      if (any && !gpu) prepare();
      if (!any || !gpu) {
        if (shown || frameOut.runs.length) {
          renderer.setLowPolyTrees(null, LAND_PROPS_SLOT);
          shown = 0;
          frameOut.runs.length = 0;
        }
        stat.props = 0;
        stat.drawn = 0;
        stat.lod.fill(0);
        stat.casters = 0;
        stat.sets = 0;
        stat.skipped = 0;
        return;
      }
      const reach = fogReach(renderer);
      const ex = eye[0],
        ey = eye[1],
        ez = eye[2];
      // TESA-LANDS' second audit (lane D): the scratch sized by the runs in reach - every landmark of every built pixel had
      // sized it (a radius-5 grid of the Fens' reed beds: 6.4 million floats, for clumps drawn 260 m out)
      for (const p of pixels)
        if (p.landProps && p._t)
          for (const run of runsOf(p.landProps))
            if (runNear(run, p._t, ex, ez, reach)) total += (run.to - run.from) / LAND_PROP_FLOATS;
      if (data.length < total * LPT_INSTANCE_FLOATS) {
        data = new Float32Array(total * LPT_INSTANCE_FLOATS * 2);
        keys = new Int32Array(total * 2);
      }
      counts.fill(0);
      castN = 0;
      let n = 0,
        sets = 0,
        skipped = 0;
      for (const p of pixels) {
        const set = p.landProps,
          t = p._t;
        if (!set || !t) continue;
        sets++;
        const pr = set.props,
          lift = set.lift ?? null;
        for (const run of runsOf(set)) {
          if (!runNear(run, t, ex, ez, reach)) {
            skipped++;
            continue;
          } // a kind's run past its farthest whole, passed over
          for (let i = run.from; i < run.to; i += LAND_PROP_FLOATS) {
            const k = pr[i + 5],
              v = pr[i + 6],
              li = pr[i + 7],
              s = pr[i + 4],
              o = (k * MAXV + v) * 3;
            const x = pr[i] + t[0],
              y = pr[i + 1] + t[1] + (lift ? lift[i / LAND_PROP_FLOATS] : 0),
              z = pr[i + 2] + t[2]; // FLORA-GROUND: on the ground its pixel draws (scenes/floraSeat.js seatFlora)
            const R = measures[o + 1] * s,
              H = measures[o] * s;
            const dx = x - ex,
              dz = z - ez,
              dh = Math.hypot(dx, dz);
            if (bodyOf[k] && casters?.[k * MAXV + v] && dh < LAND_DRAW.castReach + R)
              castIn(dh, k * MAXV + v, x, y, z, pr[i + 3], s);
            if (dh - R > Math.min(reach, farOf[k])) continue; // past the fog or its kind's farthest, wholly
            if (planes) {
              const cy = y + H * 0.5,
                rad = Math.hypot(R, H * 0.5);
              let inside = true;
              for (let q = 0; q < 24; q += 4)
                if (planes[q] * x + planes[q + 1] * cy + planes[q + 2] * z + planes[q + 3] < -rad) {
                  inside = false;
                  break;
                }
              if (!inside) continue;
            }
            const b = (li * MAXV + v) * LAND_LODS + landLodOf(LAND_KINDS[k], Math.hypot(dh, y - ey) / s);
            if (runOf[b] < 0) continue; // a look's variant it never draws (a set from another build of the law)
            counts[b]++;
            const q = n * LPT_INSTANCE_FLOATS;
            data[q] = x;
            data[q + 1] = y;
            data[q + 2] = z;
            data[q + 3] = pr[i + 3];
            data[q + 4] = s;
            keys[n] = b;
            n++;
          }
        }
      }
      // into their buckets: a run a bucket, its instances one after another (a counting sort - nothing made)
      let at = 0;
      for (let b = 0; b < B; b++) {
        starts[b] = at;
        fill[b] = at;
        at += counts[b];
      }
      if (scratch.length < n * LPT_INSTANCE_FLOATS)
        scratch = new Float32Array(Math.max(n * LPT_INSTANCE_FLOATS * 2, 1024));
      for (let i = 0; i < n; i++) {
        const dst = fill[keys[i]]++ * LPT_INSTANCE_FLOATS,
          src = i * LPT_INSTANCE_FLOATS;
        for (let c = 0; c < LPT_INSTANCE_FLOATS; c++) scratch[dst + c] = data[src + c];
      }
      if (n || shown) gpu.setInstances(scratch, n);
      shown = n;
      frameOut.runs.length = 0;
      stat.lod.fill(0);
      for (const r of runs) {
        const b = r.bucket;
        r.drawStart = starts[b];
        r.drawCount = counts[b];
        stat.lod[b % LAND_LODS] += counts[b];
        if (counts[b] && r.subs.length) frameOut.runs.push(r);
      }
      frameOut.eye[0] = ex;
      frameOut.eye[1] = ey;
      frameOut.eye[2] = ez;
      frameOut.gpu = gpu;
      renderer.setLowPolyTrees(frameOut.runs.length ? frameOut : null, LAND_PROPS_SLOT);
      // THE SUN'S CASTERS: the nearest few, each its variant's caster at its root, turn and scale (the mesh mode's frame:
      // x' = c x + s z, z' = -s x + c z)
      let cast = 0;
      if (renderer._casting && casters) {
        for (; cast < castN; cast++) {
          const o = cast * CAST,
            mi = castBuf[o + 1],
            yaw = castBuf[o + 5],
            s = castBuf[o + 6];
          const M = castM[cast],
            c = Math.cos(yaw) * s,
            sn = Math.sin(yaw) * s;
          M[0] = c;
          M[1] = 0;
          M[2] = -sn;
          M[3] = 0;
          M[4] = 0;
          M[5] = s;
          M[6] = 0;
          M[7] = 0;
          M[8] = sn;
          M[9] = 0;
          M[10] = c;
          M[11] = 0;
          M[12] = castBuf[o + 2];
          M[13] = castBuf[o + 3];
          M[14] = castBuf[o + 4];
          M[15] = 1;
          renderer.recordShadowMesh(casters[mi], M);
        }
      }
      stat.props = total;
      stat.drawn = n;
      stat.casters = cast;
      stat.sets = sets;
      stat.skipped = skipped;
    },
    /** The last frame's count - its pixels' landmarks, how many were drawn, by LOD, how many cast, the sets framed and
     *  the kinds' runs passed over whole (a probe's). */
    get stats() {
      return stat;
    },
    destroy,
    /** The GPU's making, for the tests and the probes: a promise while it is made, null else. */
    prepare,
    /** For the tests. */
    get _gpu() {
      return gpu;
    },
    get _runs() {
      return runs;
    },
  };
}

// @ts-check
// ═══════════════════════════════════════════════════════════════════
// GRAHT1 (bible/03-World/Graht-Oaks.md; the owner, 2026-10-25: "Vardenfell needs proper super tall low poly tree sprites
// with branchs/leaves that expand to cover the sky. The current simple skybox method is very low quality and band
// aided"): THE GRAHT-OAKS' HOST - Valenwood's giant trees in the streamed world, a module the jungle's host builds and
// the trees' host frames (HOST-SPLIT, bible/01-Overview/Host-Split.md: scenes/fishHost.js is the shape; no line of
// bootWorld's). It owns:
//   - THE STAND (stand): a pixel's trees as the terrain worker laid them (world/jungle/grahtOaks.js grahtSites), kept
//     whole or not at all off the gate's clearing and the rocks, as every flat - its set (pixel-local, held on the built
//     pixel) and its trunks' and buttresses' bodies for the player's clamp (grahtBodies, world/propBodies.js's shape);
//   - THE GPU, made when the first tree stands (a session that never walks in Valenwood allocates nothing) and made on
//     the stream's own slice clock - a mesh a breath, then the pictures (`breathe`, the build's breather: the first
//     pixel's build pays for it in slices, never a frame in one piece) - every variant at every LOD in one vertex and one
//     index buffer and the frame's instances (render/lowPolyTreesRender.js LowPolyTreesGpu - Low Poly Trees' own
//     buffers), the three pictures (render/grahtOakArt.js, through the renderer's atlas door) and a caster mesh a variant
//     (its LOD 1's bark and leaves) for the sun's shadow maps;
//   - THE FRAME (frame): every built pixel's trees, culled to the view (a crown's sphere), to the fog's reach and to the
//     jungle's haze (the jungle host's `hides`, its own bound), each at its LOD (grahtLodOf), packed a run a variant and
//     LOD and handed to the renderer's third tree slot (render/renderer.js setLowPolyTrees, GRAHT_SLOT) - so a graht-oak
//     is drawn by the billboard program's mesh mode and lit, fogged, hazed and lantern-lit as every 3D tree is, under
//     either lane; and the nearest few recorded as the sun's casters (renderer.recordShadowMesh), so their crowns throw
//     their shade, and their gaps their light, on the ground, the buildings and the jungle under them (the enhanced lane);
//     under the travel view every tree is drawn, and the trees' fragment half sees through a crown over the traveller
//     (render/lowPolyTreesGlsl.js CANOPY-SEE; GRAHT1's well never fired, its eye the focus - AUDIT CANOPY-SEE C1);
//   - THE TEARDOWN (destroy): the buffers, the pictures and the casters - EVERY ALLOCATION HAS AN OWNER. The world holds
//     the host for the session, as it holds the trees' doors (leaving it reloads the page); destroy is the test host's.
// `?graht=off` is the kill door, offline (grahtOaksOn): online the graht-oaks stand for everyone, since every storey of
// the jungle under them keeps off their feet and Logging's trees stand where the room sees them.
// ═══════════════════════════════════════════════════════════════════
import { LowPolyTreesGpu } from '../render/lowPolyTreesRender.js';
import { grahtOakMesh, GRAHT_VARIANTS, GRAHT_LODS, GRAHT_SUBS } from '../world/jungle/grahtOakMesh.js';
import { GRAHT_MEASURES, GRAHT_TREE_FLOATS, grahtBodies, grahtLodOf } from '../world/jungle/grahtOaks.js';
import { barkPicture, leavesPicture, cardsPicture, mipChain } from '../render/grahtOakArt.js';
import { LPT_INSTANCE_FLOATS } from '../world/lowPolyTrees.js';
import { pageParam } from '../systems/pageQuery.js';
import { isOnlinePage } from '../systems/online/onlineLane.js';

/** The renderer's tree slot the graht-oaks are handed to (0 Low Poly Trees', 1 the jungle's). */
export const GRAHT_SLOT = 2;
/** The draw's numbers: the share of the wind's lean (BB_VS's, up the tree's height - a crown a few tenths of a metre in a
 *  breeze), where a tree reads its sun (a share of its height - its crown's top, over its neighbours' shade), how far
 *  from the eye a tree casts into the sun's maps (m, past the far cascade's 240 and a crown's reach), and how many cast. */
export const GRAHT_DRAW = Object.freeze({ sway: 0.12, sunLift: 0.96, castReach: 360, casters: 24 });
/** Each variant's leaves and cards, tinted a little apart (the material's colour, over its picture). */
export const GRAHT_TINTS = Object.freeze([
  Object.freeze([1, 1, 1]),
  Object.freeze([0.93, 1.02, 0.9]),
  Object.freeze([1.05, 1.0, 0.86]),
]);

/** `?graht=off` - the kill door, offline (realForestsOn's shape: online the room's ground is one). */
export function grahtOaksOn(search) {
  return !(pageParam('graht', search) === 'off' && !isOnlinePage(search));
}

/** The fog's reach this frame (m): where the world fog leaves 1/256 of a tree's light - none past it is drawn. */
export function fogReach(r) {
  const mode = r?._fogMode ?? 0,
    d = r?._fogDensity ?? 0;
  if (mode === 1) return r._fogRange?.[1] > 0 ? r._fogRange[1] : Infinity;
  if (mode === 2 && d > 0) return Math.log(256) / d;
  if (mode === 3 && d > 0) return Math.sqrt(Math.log(256)) / d;
  return Infinity;
}

/** Every variant at every LOD (`made`, grahtOakMesh's, `[variant * GRAHT_LODS + lod]` - made here when none is handed)
 *  packed as Low Poly Trees' index and bin (LowPolyTreesGpu's input): f32 x 8 a vertex (position, normal, uv), then u16
 *  indices a mesh (its own vertices from 0). */
export function packGrahtMeshes(made = null) {
  if (!made) {
    made = [];
    for (let v = 0; v < GRAHT_VARIANTS; v++) for (let l = 0; l < GRAHT_LODS; l++) made.push(grahtOakMesh(v, l));
  }
  let verts = 0;
  for (const m of made) verts += m.positions.length / 3;
  const vf = new Float32Array(verts * 8),
    idx = new Uint16Array(verts);
  const meshes = [];
  let at = 0;
  for (const m of made) {
    const n = m.positions.length / 3;
    if (n > 65535) throw new Error(`a graht-oak mesh of ${n} vertices`);
    for (let i = 0; i < n; i++) {
      const o = (at + i) * 8;
      vf[o] = m.positions[i * 3];
      vf[o + 1] = m.positions[i * 3 + 1];
      vf[o + 2] = m.positions[i * 3 + 2];
      vf[o + 3] = m.normals[i * 3];
      vf[o + 4] = m.normals[i * 3 + 1];
      vf[o + 5] = m.normals[i * 3 + 2];
      vf[o + 6] = m.uvs[i * 2];
      vf[o + 7] = m.uvs[i * 2 + 1];
      idx[at + i] = i;
    }
    meshes.push({ vertex: at, vertices: n, index: at, subs: m.subs.map(([first, count]) => [first, count]) });
    at += n;
  }
  const bin = new Uint8Array(vf.byteLength + idx.byteLength);
  bin.set(new Uint8Array(vf.buffer), 0);
  bin.set(new Uint8Array(idx.buffer), vf.byteLength);
  return { index: { vertexBytes: vf.byteLength, meshes }, bin, made };
}

/**
 * @param {{ renderer: any, hides?: ((box: number[], t: ArrayLike<number>) => boolean)|null, breathe?: () => Promise<void> }} deps
 *   `hides(box, t)` - whether the jungle's haze hides a pixel-local box at its translation this frame (scenes/jungleHost.js);
 *   `breathe` the stream's slice clock (the build's breather), between the meshes made
 */
export function createGrahtHost({ renderer, hides = null, breathe = async () => {} }) {
  let gpu = null,
    made = null,
    failed = false,
    preparing = null;
  /** the three pictures, as the renderer holds them (bark, leaves, cards) */
  let texes = null;
  /** a caster mesh a variant (renderer.createMesh: its LOD 1's bark and leaves) */
  let casters = null;
  const B = GRAHT_VARIANTS * GRAHT_LODS;
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
    sunLift: GRAHT_DRAW.sunLift,
  };
  const runs = []; // a run a variant and LOD, made with the GPU
  const _box = [0, 0, 0, 0, 0, 0],
    _t = [0, 0, 0];
  const castM = Array.from({ length: GRAHT_DRAW.casters }, () => new Float32Array(16));
  /** the frame's nearest casters, nearest first - [distance, variant, x, y, z, yaw, scale] each (CAST floats) */
  const CAST = 7,
    castBuf = new Float64Array(GRAHT_DRAW.casters * CAST);
  let castN = 0;
  /** a tree in among the nearest GRAHT_DRAW.casters, by its distance (an insertion - nothing made a frame) */
  const castIn = (d, v, x, y, z, yaw, s) => {
    const K = GRAHT_DRAW.casters;
    if (castN === K && d >= castBuf[(K - 1) * CAST]) return;
    let at = castN < K ? castN++ : K - 1;
    while (at > 0 && castBuf[(at - 1) * CAST] > d) {
      castBuf.copyWithin(at * CAST, (at - 1) * CAST, at * CAST);
      at--;
    }
    const o = at * CAST;
    castBuf[o] = d;
    castBuf[o + 1] = v;
    castBuf[o + 2] = x;
    castBuf[o + 3] = y;
    castBuf[o + 4] = z;
    castBuf[o + 5] = yaw;
    castBuf[o + 6] = s;
  };
  const stat = { trees: 0, drawn: 0, lod: [0, 0, 0], casters: 0, sets: 0 };

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
  /** THE GPU, made once on the slice clock - or never, after a throw (the trees stand unseen, their bodies still turning
   *  the player). Asked by every stand; the frame draws once it is made. */
  function prepare() {
    if (gpu || failed || preparing) return preparing;
    preparing = (async () => {
      try {
        const meshes = [];
        for (let v = 0; v < GRAHT_VARIANTS; v++) {
          for (let l = 0; l < GRAHT_LODS; l++) {
            meshes.push(grahtOakMesh(v, l));
            await breathe();
          }
        }
        const packed = packGrahtMeshes(meshes);
        await breathe();
        const pics = [barkPicture(), leavesPicture(), cardsPicture()];
        await breathe();
        if (destroyed) return;
        build(packed, pics);
      } catch (e) {
        console.warn('[graht] the graht-oaks could not be built', e);
        destroy();
        failed = true;
      } finally {
        preparing = null;
      }
    })();
    return preparing;
  }
  let destroyed = false;
  /** the GPU from the meshes and pictures made - the CPU's copies let go once they are uploaded */
  function build(packed, pics) {
    made = packed.made;
    gpu = new LowPolyTreesGpu(renderer.gl, packed.index, packed.bin);
    texes = pics.map(upload);
    casters = [];
    for (let v = 0; v < GRAHT_VARIANTS; v++) {
      const m = made[v * GRAHT_LODS + 1],
        n = m.subs[0][1] + m.subs[1][1]; // its bark and leaves - a card casts no square
      casters.push(
        renderer.createMesh({
          positions: m.positions.subarray(0, n * 3),
          normals: m.normals.subarray(0, n * 3),
          uvs: m.uvs.subarray(0, n * 2),
          indices: Uint32Array.from({ length: n }, (_, i) => i),
          subMeshes: [{ startIndex: 0, primitiveCount: n / 3 }],
        }),
      );
    }
    runs.length = 0;
    for (let v = 0; v < GRAHT_VARIANTS; v++) {
      for (let l = 0; l < GRAHT_LODS; l++) {
        const k = v * GRAHT_LODS + l,
          ms = GRAHT_MEASURES[v];
        const subs = [];
        made[k].subs.forEach(([, count], i) => {
          if (!count) return;
          const [offset] = gpu.subs[k][i];
          subs.push({
            offset,
            count,
            tex: texes[i],
            alpha: GRAHT_SUBS[i] === 'cards' ? 1 : 0,
            color: i ? GRAHT_TINTS[v] : [1, 1, 1],
            cull: GRAHT_SUBS[i] === 'cards' ? 0 : 2,
          });
        });
        runs.push({
          run: { handle: null },
          scale: [1, 1, 1],
          size: [ms.crownR * 2, ms.height],
          sway: GRAHT_DRAW.sway,
          windfall: 0,
          subs,
          drawStart: 0,
          drawCount: 0,
        });
      }
    }
    made = null;
  }
  function destroy() {
    destroyed = true;
    renderer.setLowPolyTrees?.(null, GRAHT_SLOT);
    gpu?.destroy();
    gpu = null;
    for (const t of texes ?? []) renderer.releaseAtlasTexture(t);
    texes = null;
    for (const m of casters ?? []) renderer.destroyMesh(m);
    casters = null;
    runs.length = 0;
  }
  return {
    /**
     * A PIXEL'S GRAHT-OAKS STOOD - `raw` the worker's (GRAHT_TREE_FLOATS a tree, pixel-local), each tree kept whole or
     * not at all where `keep(x, z)` keeps its root (the gate's clearing, the rocks) - `{ set, bodies }`, or null for none.
     * The set rides the built pixel (`grahtOaks`), the bodies its cover (they leave with it).
     * @param {number} px @param {number} py @param {ArrayLike<number>|null|undefined} raw @param {(x: number, z: number) => boolean} [keep]
     */
    stand(px, py, raw, keep = () => true) {
      if (!raw?.length) return null;
      prepare(); // the GPU's making begins with the first tree (its own breaths)
      const kept = [];
      for (let i = 0; i < raw.length; i += GRAHT_TREE_FLOATS)
        if (keep(raw[i], raw[i + 2])) for (let k = 0; k < GRAHT_TREE_FLOATS; k++) kept.push(raw[i + k]);
      if (!kept.length) return null;
      const trees = Float32Array.from(kept),
        bodies = [];
      for (let i = 0; i < trees.length; i += GRAHT_TREE_FLOATS) bodies.push(...grahtBodies(trees, i));
      return { set: { px, py, trees }, bodies };
    },
    /**
     * THE FRAME: every built pixel's trees (`pixels` the frame's, each with its translation `_t` and its set
     * `grahtOaks`), culled to `planes` (the view's, normalised; null: none culled), the fog's reach and the haze, each at
     * its LOD, handed to the renderer's slot; the nearest within GRAHT_DRAW.castReach recorded for the sun's maps.
     * @param {any[]} pixels @param {ArrayLike<number>} eye @param {Float32Array|null} planes
     */
    frame(pixels, eye, planes) {
      let total = 0,
        any = false;
      for (const p of pixels)
        if (p.grahtOaks && p._t) {
          total += p.grahtOaks.trees.length / GRAHT_TREE_FLOATS;
          any = true;
        }
      if (any && !gpu) prepare(); // a set that came by no stand (a test's) asks it too
      if (!any || !gpu) {
        if (shown || frameOut.runs.length) {
          renderer.setLowPolyTrees(null, GRAHT_SLOT);
          shown = 0;
          frameOut.runs.length = 0;
        }
        stat.trees = 0;
        stat.drawn = 0;
        stat.lod.fill(0);
        stat.casters = 0;
        stat.sets = 0;
        return;
      }
      if (data.length < total * LPT_INSTANCE_FLOATS) {
        data = new Float32Array(total * LPT_INSTANCE_FLOATS * 2);
        keys = new Int32Array(total * 2);
      }
      const reach = fogReach(renderer);
      counts.fill(0);
      castN = 0;
      let n = 0,
        sets = 0;
      const ex = eye[0],
        ey = eye[1],
        ez = eye[2];
      const focus = renderer._focus?.[3] > 0.5 ? renderer._focus : null; // the travel view's traveller, or none
      // the visible trees, each its bucket (variant x LOD), packed once in the order met
      const tmp = data; // written at [n] first, moved into the buckets below
      for (const p of pixels) {
        const set = p.grahtOaks,
          t = p._t;
        if (!set || !t) continue;
        sets++;
        const tr = set.trees,
          lift = set.lift; // FLORA-GROUND, THE RINGS: each tree's rise to the ground its pixel draws (scenes/floraSeat.js seatFlora)
        for (let i = 0; i < tr.length; i += GRAHT_TREE_FLOATS) {
          const v = tr[i + 5] | 0,
            s = tr[i + 4],
            m = GRAHT_MEASURES[v];
          const y0 = lift ? tr[i + 1] + lift[i / GRAHT_TREE_FLOATS] : tr[i + 1]; // its root as drawn - its place (its bodies, its cover) the walk ground's
          const x = tr[i] + t[0],
            y = y0 + t[1],
            z = tr[i + 2] + t[2];
          const R = m.crownR * s,
            H = m.height * s;
          const dx = x - ex,
            dz = z - ez,
            dh = Math.hypot(dx, dz);
          // a caster whether or not it is drawn - behind the eye it still shades what is before it - by its distance from
          // where the sun's cascades stand (the travel view's traveller, else the eye: render/shadowPass.js)
          const cd = focus ? Math.hypot(x - focus[0], z - focus[2]) : dh;
          if (cd < GRAHT_DRAW.castReach + R) castIn(cd, v, x, y, z, tr[i + 3], s);
          if (dh - R > reach) continue; // past the fog, wholly
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
          if (hides) {
            _box[0] = tr[i] - R;
            _box[1] = y0;
            _box[2] = tr[i + 2] - R;
            _box[3] = tr[i] + R;
            _box[4] = y0 + H;
            _box[5] = tr[i + 2] + R;
            _t[0] = t[0];
            _t[1] = t[1];
            _t[2] = t[2];
            if (hides(_box, _t)) continue; // the jungle's haze hides it whole (its own bound - jungleHaze.js hazeHides)
          }
          const lod = grahtLodOf(Math.hypot(dh, y - ey) / s),
            b = v * GRAHT_LODS + lod;
          counts[b]++;
          const o = n * LPT_INSTANCE_FLOATS;
          tmp[o] = x;
          tmp[o + 1] = y;
          tmp[o + 2] = z;
          tmp[o + 3] = tr[i + 3];
          tmp[o + 4] = s;
          keys[n] = b;
          n++;
        }
      }
      // into their buckets: a run a bucket, its instances one after another (the sort a counting sort - nothing made)
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
        for (let c = 0; c < LPT_INSTANCE_FLOATS; c++) scratch[dst + c] = tmp[src + c];
      }
      if (n || shown) gpu.setInstances(scratch, n);
      shown = n;
      frameOut.runs.length = 0;
      stat.lod.fill(0);
      for (let b = 0; b < B; b++) {
        const r = runs[b];
        r.drawStart = starts[b];
        r.drawCount = counts[b];
        stat.lod[b % GRAHT_LODS] += counts[b];
        if (counts[b] && r.subs.length) frameOut.runs.push(r);
      }
      frameOut.eye[0] = ex;
      frameOut.eye[1] = ey;
      frameOut.eye[2] = ez;
      frameOut.gpu = gpu;
      renderer.setLowPolyTrees(frameOut.runs.length ? frameOut : null, GRAHT_SLOT);
      // THE SUN'S CASTERS: the nearest few, each its variant's caster at its root, turn and scale (the mesh mode's frame:
      // x' = c x + s z, z' = -s x + c z)
      let cast = 0;
      if (renderer._casting && casters) {
        for (; cast < castN; cast++) {
          const o = cast * CAST,
            v = castBuf[o + 1],
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
          renderer.recordShadowMesh(casters[v], M);
        }
      }
      stat.trees = total;
      stat.drawn = n;
      stat.casters = cast;
      stat.sets = sets;
    },
    /** The last frame's count - its pixels' trees, how many were drawn, by LOD, and how many cast (a probe's). */
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

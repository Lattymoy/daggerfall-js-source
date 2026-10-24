// @ts-check
// ═══════════════════════════════════════════════════════════════════
// POI-2 (2026-10-14) - THE APPROVED POIS, STANDING IN THE STREAMED WORLD.
//
// Mac: "POI Tool (General Map Editor) - Realtime editor ... even placement onto our actual map"; "I need to be able to
// approve changes" (bible/06-Systems/POI-Editor-Arc.md). The exterior host's pool on the runtime pools' shape
// (scenes/lefayMonumentHost.js, scenes/merchantYardsHost.js): every POI the feed (poi/poiFeed.js) stands on a pixel the
// streamer has BUILT is loaded (its meshes and pictures by their hashes), stood on its ground, collided, lit, drawn - the
// opaque with the world, the translucent after it, back to front - and taken down when its pixel goes, its revision
// moves, or an approver retires it. Nothing is baked into a pixel's batch: a POI comes and goes while its pixel stands
// (an approval reaches a playing game within a minute), so it is its own draw, as a yard's piece is.
//
// THE FRAME: a POI's matrices are its PIXEL's (poi/poiRuntime.js) - metres east and north of the pixel's south-west
// corner - and the collider rides the pixel's own translation (`riding`, collider.js onFloatingFrame), so a
// floating-origin recentre restands nothing; the drawn matrix adds the pixel's translation when it moves.
//
// THE GROUND: a 'snap' POI stands its `y` above the drawn ground under its spot (`groundAt` - world.js surfaceAt), read
// when the pixel's translation moves and every POI_GROUND_EVERY frames (a pixel built finer moves it), never every
// frame; until the ground answers (a pixel not yet built at that ring), the POI waits unseen and uncollided.
//
// A BODY IS NEVER WALLED IN: a part's collider is held back while the player's feet are inside its box (a POI approved
// round a player standing there - lefayMonumentHost.js bodyTrapped's law) and stood once they are out. AUDIT POI R1: and
// never dropped from under one either - a collider standing round the body when its part must move is CARRIED (filed
// again at once where the part now stands), and a revision that moves nothing (the feed read again after an approval
// elsewhere, the same document a new object) moves nothing: its colliders stay where they stand.
//
// THE STAND WORK IS A TIME SLICE A FRAME (AUDIT POI R8): a POI's loading - its meshes decoded, its pictures decoded,
// baked and uploaded, its models built and made, its colliders first filed - runs as steps (`spawn`: generators that
// yield a promise to wait on or nothing at a step's end), POI_STAND_BUDGET_MS of them a frame and at least one, never
// in one task: a big POI near a door cost hundreds of milliseconds every time the street came back. Leaving the street
// (`standDown`: an interior, a dungeon) takes the colliders down and keeps the models and pictures, so coming back out
// places the POIs again instead of loading them again.
//
// A PART'S OWN SCALE IS BAKED INTO ITS MODEL (AUDIT POI R5, R6: poi/poiRuntime.js poiPartModels), so the mesh shader's
// normal is true; the part is drawn through its turn and the place's size (`drawn`), and a part whose scale moves is
// modelled again as stand work - drawn meanwhile through what makes up the difference, and not at all while that would
// mirror it (its faces wound for the other hand).
//
// THE FOUR HOSTS (bible/Home.md): scenes/world.js - WIRED (made beside the LeFay monument; framed, drawn in the world
// pass, the translucent after the water and the world's depth-writing flats (AUDIT POI R4), its lights in the scene's
// selection, its marks on the travel map, taken down at a re-anchor, a load and a change of mode).
// scenes/worldModes.js - its interiors stand no street; a POI is outdoors, and nothing here reaches them.
// scenes/exterior.js - FLAGGED: the fixed-city bench (`?exterior`, `?region&loc`) has no feed; a POI stands in the streamed world.
// scenes/dungeonContext.js - stands no street: nothing here reaches it.
//
// Not a DFU member. Ledger A (POI).
// ═══════════════════════════════════════════════════════════════════

import { decodePoiMeshSteps } from '../poi/poiMesh.js';
import {
  POI_TEXTURE_ARCHIVE, materialLook, samplerOf, emits, createTextureBook, bakeAlbedoSteps, bakeEmissionSteps, poiPartModelSteps,
  placeMatrix, partMatrix, boxThrough, lightsOf,
} from '../poi/poiRuntime.js';
import { samplerKey } from '../render/meshAlpha.js';
import { drawSeen, DECOR_DRAW } from './decor/decorRoom.js';
import { invert4 } from '../player/tapRay.js';

/** The ground under a standing POI is read again every this many frames. */
export const POI_GROUND_EVERY = 30;
/** A POI whose assets would not load is tried again after this long. */
export const POI_RETRY_MS = 60_000;
/** AUDIT POI R8: the stand work's share of a frame, milliseconds (render/retroPass.js RETRO_LUT_BUDGET_MS's slice). */
export const POI_STAND_BUDGET_MS = 4;
/** AUDIT POI R1: a height moved by less (metres) is the same height - a recentre reads the ground at (t + x) - t, an ulp
 *  off x, and that moved no POI. */
export const POI_Y_EPS = 1e-4;
/** AUDIT POI R11: decoded pictures kept between the looks that share them, by their bytes (eight of them, unbounded,
 *  could pin 512 MiB of 4096-texel rasters). */
export const POI_DECODED_KEEP_BYTES = 32 * 1024 * 1024;
/** A light's flicker: steps a second, and how far it dips. */
const FLICKER_HZ = 12, FLICKER_DEPTH = 0.25;

const ID = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
/** AUDIT POI R12: the draws' options, made once - no object a draw a frame. */
const NO_SHADOW = Object.freeze({ noShadow: true }), TRANSLUCENT = Object.freeze({ translucent: 1 });
/** A scale's hand: true where it mirrors (an odd number of its axes negative). */
const mirrors = (s) => s[0] * s[1] * s[2] < 0;

/** Does a ray (o + t d) meet a box [minX, minY, minZ, maxX, maxY, maxZ] before `max`? The slab test. */
export function rayBox(o, d, b, max) {
  let lo = 0, hi = max;
  for (let a = 0; a < 3; a++) {
    if (Math.abs(d[a]) < 1e-12) { if (o[a] < b[a] || o[a] > b[a + 3]) return false; continue; }
    let t0 = (b[a] - o[a]) / d[a], t1 = (b[a + 3] - o[a]) / d[a];
    if (t0 > t1) { const k = t0; t0 = t1; t1 = k; }
    lo = Math.max(lo, t0); hi = Math.min(hi, t1);
    if (lo > hi) return false;
  }
  return true;
}
/** The nearest of a mesh's triangles a ray meets (both faces) before `max` - its distance along `d`, or null.
 *  Moller-Trumbore. Pure. */
export function rayTriangles(o, d, pos, idx, max) {
  let best = null;
  for (let i = 0; i + 2 < idx.length; i += 3) {
    const a = idx[i] * 3, b = idx[i + 1] * 3, c = idx[i + 2] * 3;
    const e1x = pos[b] - pos[a], e1y = pos[b + 1] - pos[a + 1], e1z = pos[b + 2] - pos[a + 2];
    const e2x = pos[c] - pos[a], e2y = pos[c + 1] - pos[a + 1], e2z = pos[c + 2] - pos[a + 2];
    const px = d[1] * e2z - d[2] * e2y, py = d[2] * e2x - d[0] * e2z, pz = d[0] * e2y - d[1] * e2x;
    const det = e1x * px + e1y * py + e1z * pz;
    if (Math.abs(det) < 1e-12) continue;
    const inv = 1 / det;
    const tx = o[0] - pos[a], ty = o[1] - pos[a + 1], tz = o[2] - pos[a + 2];
    const u = (tx * px + ty * py + tz * pz) * inv;
    if (u < 0 || u > 1) continue;
    const qx = ty * e1z - tz * e1y, qy = tz * e1x - tx * e1z, qz = tx * e1y - ty * e1x;
    const v = (d[0] * qx + d[1] * qy + d[2] * qz) * inv;
    if (v < 0 || u + v > 1) continue;
    const t = (e2x * qx + e2y * qy + e2z * qz) * inv;
    if (t > 1e-6 && t < (best ?? max)) best = t;
  }
  return best;
}
const xformPoint = (m, p) => [m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13], m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]];
const xformDir = (m, p) => [m[0] * p[0] + m[4] * p[1] + m[8] * p[2], m[1] * p[0] + m[5] * p[1] + m[9] * p[2], m[2] * p[0] + m[6] * p[1] + m[10] * p[2]];
const _inv = new Float32Array(16);

/** Do two documents stand the same build - the same parts' meshes, materials, colliders and shadows, in the same order -
 *  so that one is the other moved (its place, its parts' transforms, its lights, its name and marker)? Pure. */
export function sameBuild(a, b) {
  const build = (d) => JSON.stringify(d.parts.map((p) => [p.key, p.mesh, p.materials, p.collide, p.shadow]));
  return a.parts.length === b.parts.length && build(a) === build(b);
}
/** AUDIT POI R1: do two documents of one build stand it in the same place - the place, every part's transform and the
 *  lights alike (a name or a marker may differ)? Then the second only replaces the first: nothing is placed again and
 *  no collider is touched. Pure. */
export function sameStand(a, b) {
  const at = (d) => JSON.stringify([d.place, d.parts.map((p) => [p.t, p.r, p.s]), d.lights ?? []]);
  return at(a) === at(b);
}

/**
 * @param {{
 *   renderer: any, feed: any,
 *   decodeImage: (bytes: Uint8Array) => any,
 *   pixels: () => Iterable<{ px: number, py: number }>,
 *   translation: (px: number, py: number, out?: number[]) => number[],
 *   groundAt: (x: number, z: number) => number,
 *   collider?: () => any, riding?: (px: number, py: number) => any,
 *   feet?: () => (number[] | null), auth?: () => (string | null), collideDrafts?: () => boolean,
 *   now?: () => number, clock?: () => number, keepDecodedBytes?: number, log?: any,
 * }} deps `decodeImage` a picture's bytes to its raster (`{ width, height, data }`, top row first) - a promise of it, or
 *   its decoder's steps (poi/poiImageDecode.js decodePoiImageSteps), run under the frame's budget with the host's own;
 *   `pixels` the streamer's built pixels; `translation` its pixelTranslation; `riding` a pixel's floating
 *   translation provider for the collider; `auth` a builder's bearer (the editor's drafts' assets); `collideDrafts`
 *   false while the editor drags (a draft moved every frame would file its collider every frame - it is stood once the
 *   drag ends); `now` the wall clock (a retry's wait, a flicker's step), `clock` the frame budget's; `keepDecodedBytes`
 *   the decoded pictures' keep (POI_DECODED_KEEP_BYTES)
 */
export function createPoiHost({
  renderer, feed, decodeImage, pixels, translation, groundAt, collider = () => null, riding = () => null, collideDrafts = () => true,
  feet = () => null, auth = () => null, now = () => Date.now(), clock = () => performance.now(), keepDecodedBytes = POI_DECODED_KEEP_BYTES, log = console,
}) {
  /** id -> the POI standing (or loading) */
  const standing = new Map();
  /** AUDIT POI R12: the same POIs in an array, walked by index - no iterator, no copy a frame */
  const stood = [];
  /** AUDIT POI R12: the frame's wanted POIs, by id - one map, cleared each frame */
  const want = new Map();
  const book = createTextureBook();
  const recordOf = (m) => book.recordOf(materialLook(m));
  /** look -> { record, refs, ready, job } */
  const looks = new Map();
  /** sha -> { ready: Promise<decoded>, bytes } - AUDIT POI R11: kept to POI_DECODED_KEEP_BYTES, the oldest let go */
  const decoded = new Map();
  let decodedBytes = 0;
  let frameN = 0;

  // ── THE STAND WORK (AUDIT POI R8) ───────────────────────────────────
  /** The jobs that can step, in the order they came (the first stepped until it waits or ends). */
  const work = [];
  /** This frame's budget: when it runs out, and how much work has run in it. */
  let until = 0, units = 0;
  /** May one more piece of stand work run this frame? The first always does (the work moves every frame); the rest
   *  while the budget lasts. */
  function turn() {
    if (units > 0 && clock() >= until) return false;
    units++;
    return true;
  }
  /** A job: a generator of the work's steps - it yields a promise to wait for (it steps on with its value, or its
   *  error thrown in) or nothing at a step's end. Answers `{ promise }`, settled with its end. */
  function spawn(it) {
    const job = { it, value: undefined, threw: false, over: false, resolve: null, reject: null, promise: null };
    job.promise = new Promise((res, rej) => { job.resolve = res; job.reject = rej; });
    job.promise.catch(() => {});   // a job's failure is its waiters' to hear; one nobody waits on is no unhandled rejection
    work.push(job);
    return job;
  }
  /** A job given up (its POI taken down, its look let go): never stepped again, and its `finally` blocks run, so what
   *  it made and had not handed over is freed. */
  function cancel(job) {
    if (!job || job.over) return;
    job.over = true;
    const i = work.indexOf(job);
    if (i >= 0) work.splice(i, 1);
    try { job.it.return(undefined); } catch (e) { if (log) console.warn('[poi] a job would not stop', e?.message ?? e); }
  }
  function wake(job, threw) {
    return (v) => { if (job.over) return; job.value = v; job.threw = threw; work.push(job); };
  }
  /** The frame's slice: the jobs stepped while the budget lasts. */
  function stepWork() {
    while (work.length && turn()) {
      const job = work[0];
      let r;
      try { r = job.threw ? job.it.throw(job.value) : job.it.next(job.value); } catch (e) {
        if (job.over) continue;
        job.over = true; work.shift(); job.reject(e); continue;
      }
      if (job.over) continue;   // given up from inside its own step
      job.value = undefined; job.threw = false;
      if (r.done) { job.over = true; work.shift(); job.resolve(r.value); continue; }
      const v = r.value;
      if (v && typeof v.then === 'function') { work.shift(); v.then(wake(job, false), wake(job, true)); }   // parked until it settles
    }
  }

  /** A picture's raster, decoded once while kept (a job of its own: looks that share it wait on one decode). */
  function decode(sha) {
    const kept = decoded.get(sha);
    if (kept) return kept.ready;
    const entry = { ready: spawn(decodeSteps(sha)).promise, bytes: 0 };
    decoded.set(sha, entry);
    entry.ready.then((img) => {
      if (decoded.get(sha) !== entry) return;
      entry.bytes = img?.data?.byteLength ?? 0;
      decodedBytes += entry.bytes;
      // AUDIT POI R11: kept to a budget of bytes, the oldest let go first (its waiters already hold it)
      for (const [k, e] of decoded) {
        if (decodedBytes <= keepDecodedBytes) break;
        decoded.delete(k);
        decodedBytes -= e.bytes;
      }
    }, () => { if (decoded.get(sha) === entry) decoded.delete(sha); });   // a decode that failed is asked again
    return entry.ready;
  }
  function* decodeSteps(sha) {
    const bytes = yield feed.asset(sha, { auth: auth() });
    const r = decodeImage(bytes);
    if (r && typeof r.next === 'function') return yield* r;   // the decoder's own steps, under this budget
    return r && typeof r.then === 'function' ? yield r : r;
  }

  /** A look's textures uploaded once, kept while any standing part wears it. */
  function holdLook(m) {
    const look = materialLook(m);
    let l = looks.get(look);
    if (l) { l.refs++; return l; }
    const record = book.recordOf(look);
    l = { look, record, sampler: samplerOf(m), refs: 1, emits: emits(m), ready: null, job: null };
    l.job = spawn(lookSteps(l, m));
    l.ready = l.job.promise;
    looks.set(look, l);
    return l;
  }
  function* lookSteps(l, m) {
    try {
      const image = m.texture ? yield decode(m.texture) : null;
      const albedo = yield* bakeAlbedoSteps(image, m);
      const glowImage = l.emits && m.emissive ? yield decode(m.emissive) : null;
      const glow = l.emits ? yield* bakeEmissionSteps(glowImage, m, albedo) : null;
      yield null;   // the upload a step of its own
      renderer.uploadTexture?.(POI_TEXTURE_ARCHIVE, l.record, albedo, { sampler: l.sampler, cutout: m.alpha === 'cutout' });
      if (glow) renderer.uploadEmissionTexture?.(POI_TEXTURE_ARCHIVE, l.record, glow, { white: true, sampler: l.sampler });
    } catch (e) {
      // AUDIT POI R3: a look that would not load is let go of at once - the next to wear it asks again, and is never
      // handed this failure while another POI still holds it
      if (looks.get(l.look) === l) looks.delete(l.look);
      throw e;
    }
  }
  function dropLook(l) {
    if (--l.refs > 0) return;
    cancel(l.job);
    if (looks.get(l.look) !== l) return;   // AUDIT POI R3: a failed look, let go - its record is its successor's now
    looks.delete(l.look);
    renderer.releaseTexture?.(POI_TEXTURE_ARCHIVE, l.record);
    if (l.emits) renderer.evictEmissionTexture?.(`${POI_TEXTURE_ARCHIVE}_${l.record}${samplerKey(l.sampler)}`);
  }

  /** A part's GPU models, its own scale baked in (AUDIT POI R5) - `{ opaque, translucent }`, made in one step. */
  function* modelSteps(mesh, materials, scale) {
    const models = yield* poiPartModelSteps(mesh, materials, recordOf, { scale });
    yield null;   // the uploads a step of their own
    return {
      opaque: models.opaque ? renderer.createMesh(models.opaque) : null,
      translucent: models.translucent ? renderer.createMesh(models.translucent) : null,
    };
  }

  /** Load a POI: every part's mesh, its looks, its GPU models - as stand work. */
  function* loadSteps(s) {
    const parts = [];
    let made = false;
    try {
      for (let i = 0; i < s.doc.parts.length; i++) {
        const part = s.doc.parts[i];
        // AUDIT POI R8 (the lead's): read in steps too - a model at the law's bounds was one task of tens of milliseconds
        const d = yield* decodePoiMeshSteps(yield feed.asset(part.mesh, { auth: auth() }));
        if ('error' in d) throw new Error(`part ${part.key}: ${d.error}`);
        const held = part.materials.map((m) => holdLook(m));
        s.held.push(...held);
        yield Promise.all(held.map((l) => l.ready));
        const remap = new Map();
        for (const m of part.materials) {
          const rec = recordOf(m);
          remap.set(`${POI_TEXTURE_ARCHIVE}_${rec}`, `${POI_TEXTURE_ARCHIVE}_${rec}${samplerKey(samplerOf(m))}`);
        }
        const p = {
          index: i, key: part.key, part, remap, mesh: d.mesh, opaque: null, translucent: null,
          baked: [1, 1, 1], wound: true, remodel: null,   // AUDIT POI R5: the scale its models carry, and whether its hand is the part's
          positions: d.mesh.positions, indices: d.mesh.indices, min: d.mesh.boundsMin, max: d.mesh.boundsMax,
          collide: part.collide === 'mesh', shadow: part.shadow, local: null, localBox: null, scene: new Float32Array(16), drawn: new Float32Array(16), box: null,
          bucket: `poi:${s.id}:${i}`, stood: false, carry: false,
        };
        parts.push(p);
        const scale = part.s.slice();
        const models = yield* modelSteps(d.mesh, part.materials, scale);
        p.opaque = models.opaque; p.translucent = models.translucent; p.baked = scale;
      }
      s.parts = parts;
      s.status = 'ready';
      made = true;
    } catch (e) {
      s.status = 'failed';
      s.failedAt = now();
      if (log) console.warn(`[poi] ${s.id} r${s.rev} would not stand`, e?.message ?? e);
    } finally {
      // AUDIT POI R2: every way out that does not stand it - a part that would not load, a POI taken down mid-load -
      // frees the GPU models its parts had made (a failing POI retried each minute leaked them each time)
      if (!made) for (const p of parts) freePart(p);
      s.job = null;
    }
  }

  /** AUDIT POI R5: a part whose scale moved, modelled again for its new scale - its old models drawn until the new are
   *  made, then swapped. */
  function* remodelSteps(p) {
    const scale = p.part.s.slice();
    let made = null;
    try {
      made = yield* modelSteps(p.mesh, p.part.materials, scale);
      freePart(p);
      p.opaque = made.opaque; p.translucent = made.translucent; p.baked = scale;
      made = null;
      drawnOf(p);   // drawn this frame through the scale it now carries, never the last model's
    } finally {
      if (made) freePart(made);   // given up between its making and its swap
      p.remodel = null;
    }
  }

  function freePart(p) {
    if (p.opaque) renderer.destroyMesh?.(p.opaque);
    if (p.translucent) renderer.destroyMesh?.(p.translucent);
    p.opaque = p.translucent = null;
  }
  /** Every part's collider taken down (stood again by the next placing) - one round the body carried (AUDIT POI R1). */
  function unstand(s) {
    const col = collider(), f = feet();
    for (const p of s.parts) if (p.stood) { p.carry = inside(p.localBox, f, s.t); col?.removeBucket?.(p.bucket); p.stood = false; }
  }
  function takeDown(s) {
    s.gone = true;
    cancel(s.job);
    const col = collider();
    for (const p of s.parts) { cancel(p.remodel); if (p.stood) col?.removeBucket?.(p.bucket); freePart(p); }
    for (const l of s.held) dropLook(l);
    s.parts = []; s.held = [];
    standing.delete(s.id);
    const i = stood.indexOf(s);
    if (i >= 0) stood.splice(i, 1);
  }

  function stand(e) {
    const s = { id: e.id, rev: e.rev, doc: e.doc, draft: !!e.draft, px: e.doc.place.px, py: e.doc.place.py, status: 'loading', failedAt: 0, gone: false,
      parts: [], held: [], y: NaN, groundRead: [NaN, NaN, -Infinity, NaN], t: [0, 0, 0], place: null, lights: [], rows: [], job: null, visible: false };
    standing.set(e.id, s);
    stood.push(s);
    s.job = spawn(loadSteps(s));
    return s;
  }

  /** The place's height in its pixel's frame this frame - or NaN while the ground under a 'snap' POI is unknown. */
  function heightOf(s, t) {
    const pl = s.doc.place;
    if (pl.ground === 'absolute') return pl.y;
    const x = t[0] + pl.x, z = t[2] + pl.z;
    const g = s.groundRead;
    if (x !== g[0] || z !== g[1] || t[1] !== g[3] || !Number.isFinite(s.ground) || frameN - g[2] >= POI_GROUND_EVERY) {
      s.ground = groundAt(x, z);
      g[0] = x; g[1] = z; g[2] = frameN; g[3] = t[1];
    }
    return Number.isFinite(s.ground) ? s.ground - t[1] + pl.y : NaN;
  }

  /** AUDIT POI R5: a part's drawn matrix - its scene matrix through the scale its models do not carry (none, once they
   *  carry the part's own) - and R6: whether its faces are wound for the hand it is drawn in. */
  function drawnOf(p) {
    const d = p.drawn, sk = p.baked;
    d.set(p.scene);
    for (let c = 0; c < 3; c++) { const k = 1 / sk[c]; d[c * 4] *= k; d[c * 4 + 1] *= k; d[c * 4 + 2] *= k; }
    p.wound = mirrors(p.part.s) === mirrors(sk);   // never drawn through a mirror its faces are not wound for
  }

  /** Inside a part's box (`b` in its pixel's frame, `t` the pixel's translation), the capsule's half a pace about it? */
  const inside = (b, f, t) => !!f && !!b && f[0] > b[0] + t[0] - 0.5 && f[0] < b[3] + t[0] + 0.5 && f[2] > b[2] + t[2] - 0.5 && f[2] < b[5] + t[2] + 0.5 && f[1] + 1.8 > b[1] + t[1] && f[1] < b[4] + t[1];

  /** One standing, ready POI this frame: its height, matrices, boxes, collider and lights. */
  function place(s) {
    const t = translation(s.px, s.py, s.t);
    const y = heightOf(s, t);
    if (!Number.isFinite(y)) { s.visible = false; return; }
    const col = collider();
    const f = feet();
    // AUDIT POI R1: placed again only when the height truly moved - a recentre's read of the ground an ulp off is none
    if (!s.place || !(Math.abs(y - s.y) <= POI_Y_EPS)) {
      s.y = y;
      s.place = placeMatrix(s.doc.place, y);
      s.lights = lightsOf(s.doc, s.place);
      s.rows = s.lights.map((l) => ({ x: 0, y: 0, z: 0, range: 0, color: new Float32Array(l.color) }));   // AUDIT POI R12: a light's row, refilled each frame
      for (const p of s.parts) {
        // the part moves: a collider standing round the body is carried (AUDIT POI R1 - filed again at once, below);
        // one standing clear of it is stood again when its turn comes
        if (p.stood) { p.carry = inside(p.localBox, f, t); col?.removeBucket?.(p.bucket); p.stood = false; }
        p.local = partMatrix(s.place, p.part);
        const b = boxThrough(p.local, p.min, p.max);
        const lb = p.localBox ??= [0, 0, 0, 0, 0, 0];
        lb[0] = b.min[0]; lb[1] = b.min[1]; lb[2] = b.min[2]; lb[3] = b.max[0]; lb[4] = b.max[1]; lb[5] = b.max[2];
      }
    }
    s.visible = true;
    const parts = s.parts;
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      p.scene.set(p.local);
      p.scene[12] += t[0]; p.scene[13] += t[1]; p.scene[14] += t[2];
      drawnOf(p);
      const sk = p.baked;
      const lb = p.localBox, bx = p.box ??= [0, 0, 0, 0, 0, 0];   // AUDIT POI R12: refilled, never made again a frame
      bx[0] = lb[0] + t[0]; bx[1] = lb[1] + t[1]; bx[2] = lb[2] + t[2]; bx[3] = lb[3] + t[0]; bx[4] = lb[4] + t[1]; bx[5] = lb[5] + t[2];
      if (p.collide && !p.stood && col?.addMesh && (p.carry || !inside(p.localBox, f, t)) && (!s.draft || collideDrafts())) {
        // AUDIT POI R8: a first filing waits its turn in the frame's budget; one carried round the body never waits
        if (p.carry || turn()) {
          col.addMesh(p.bucket, p.positions, p.indices, p.local, riding(s.px, s.py));
          p.stood = true; p.carry = false;
        }
      }
      // AUDIT POI R5: a scale its models do not carry is modelled again (as stand work; a dragged draft once the drag ends)
      if (!p.remodel && (p.part.s[0] !== sk[0] || p.part.s[1] !== sk[1] || p.part.s[2] !== sk[2]) && (collideDrafts() || !s.draft)) p.remodel = spawn(remodelSteps(p));
    }
  }

  /** A wanted POI this frame: stood (loading) when it is new, tried again past its wait when it failed, placed when ready. */
  function standWanted(e, id) {
    let s = standing.get(id);
    if (!s) s = stand(e);
    if (s.status === 'failed' && now() - s.failedAt >= POI_RETRY_MS) { takeDown(s); s = stand(e); }
    if (s.status === 'ready') place(s);
  }

  /** The translucent parts this frame, the farthest first (AUDIT POI R12: entries kept between frames). */
  const _far = [];

  return {
    /** The feed asked when its time has come; every POI on a built pixel stood (loading), placed, and the rest taken down;
     *  then the stand work's slice (AUDIT POI R8). */
    frame() {
      frameN++;
      until = clock() + POI_STAND_BUDGET_MS; units = 0;
      feed.tick?.();
      want.clear();
      for (const px of pixels()) {
        const at = feed.atPixel(px.px, px.py);
        for (let i = 0; i < at.length; i++) want.set(at[i].id, at[i]);
      }
      for (let k = stood.length - 1; k >= 0; k--) {   // from the end: a POI taken down leaves the array behind the walk
        const s = stood[k];
        const e = want.get(s.id);
        if (!e || !!e.draft !== s.draft) { takeDown(s); continue; }   // a draft and its live revision are two stands
        if (e.doc === s.doc) continue;
        // ANOTHER REVISION, OR A DRAFT MOVED: the same meshes and materials (`sameBuild`) only move - its matrices made
        // again, nothing loaded (the editor's realtime drag, an approval that only moved it); anything else is stood afresh
        if (s.status === 'ready' && sameBuild(s.doc, e.doc)) {
          // AUDIT POI R1: the same place too (any approval re-reads every document: a new object, the same POI) - the
          // document replaced and nothing else; the colliders where they stand
          if (!sameStand(s.doc, e.doc)) s.place = null;
          s.doc = e.doc; s.rev = e.rev;
          for (let i = 0; i < s.parts.length; i++) s.parts[i].part = e.doc.parts[i];
          if (e.doc.place.px !== s.px || e.doc.place.py !== s.py) { unstand(s); s.px = e.doc.place.px; s.py = e.doc.place.py; s.ground = NaN; s.place = null; }
        } else takeDown(s);
      }
      want.forEach(standWanted);
      stepWork();
    },
    /** The opaque parts, with the world - each by the host's view test (drawn, cast into the shadow maps alone, or neither). */
    draw(r, cull = null) {
      for (let k = 0; k < stood.length; k++) {
        const s = stood[k];
        if (s.status !== 'ready' || !s.visible) continue;
        for (let i = 0; i < s.parts.length; i++) {
          const p = s.parts[i];
          if (p.opaque && p.wound) drawSeen(r, cull, p.box, p.opaque, p.drawn, p.remap, p.shadow ? undefined : NO_SHADOW);
        }
      }
    },
    /** The translucent parts, after the opaque world and the water - the farthest from `eye` (the view's own: AUDIT POI
     *  R14, the travel view's camera is not the traveller's head) first, each blended over what is behind; one the view
     *  test sees off screen (a shadow alone, which a pane casts none of) not drawn. */
    drawTranslucent(r, eye = null, cull = null) {
      let n = 0;
      for (let k = 0; k < stood.length; k++) {
        const s = stood[k];
        if (s.status !== 'ready' || !s.visible) continue;
        for (let i = 0; i < s.parts.length; i++) {
          const p = s.parts[i];
          if (!p.translucent || !p.wound || (cull && cull(p.box) !== DECOR_DRAW)) continue;
          const b = p.box, e = _far[n] ?? (_far[n] = { p: null, d: 0 });
          n++;
          e.p = p;
          e.d = eye ? ((b[0] + b[3]) / 2 - eye[0]) ** 2 + ((b[1] + b[4]) / 2 - eye[1]) ** 2 + ((b[2] + b[5]) / 2 - eye[2]) ** 2 : 0;
        }
      }
      // the farthest first: an insertion sort over the few (no array, no closure a frame), steady for equal distances
      for (let i = 1; i < n; i++) {
        const e = _far[i];
        let j = i - 1;
        while (j >= 0 && _far[j].d < e.d) { _far[j + 1] = _far[j]; j--; }
        _far[j + 1] = e;
      }
      for (let i = 0; i < n; i++) { const p = _far[i].p; _far[i].p = null; r.drawMesh(p.translucent, p.drawn, p.remap, TRANSLUCENT); }
    },
    /** The standing POIs' lights as scene-light rows (`{ x, y, z, range, color }`) - a flickering one's range stepped; the
     *  rows the POI's own, refilled each frame (AUDIT POI R12; the frame's selection reads them that frame). */
    lights(out = []) {
      const tick = Math.floor(now() / (1000 / FLICKER_HZ));
      for (let k = 0; k < stood.length; k++) {
        const s = stood[k];
        if (s.status !== 'ready' || !s.visible) continue;
        for (let i = 0; i < s.lights.length; i++) {
          const l = s.lights[i], row = s.rows[i];
          // a step a twelfth of a second, the same for every game: a hash of the light and the step, not a random draw
          const f = l.flicker ? 1 - FLICKER_DEPTH * (((Math.imul(tick + i * 7919, 2654435761) >>> 0) % 1000) / 1000) : 1;
          row.x = l.at[0] + s.t[0]; row.y = l.at[1] + s.t[1]; row.z = l.at[2] + s.t[2]; row.range = l.range * f;
          out.push(row);
        }
      }
      return out;
    },
    /** Every standing POI's mark for the maps (`{ px, py, label, id }`) - built pixel or not: the map shows the realm. */
    marks() {
      const out = [];
      for (const e of feed.all?.() ?? []) {
        const m = e.doc.marker;
        if (m?.show) out.push({ px: e.doc.place.px, py: e.doc.place.py, label: m.label || e.doc.name, id: e.id, draft: !!e.draft });
      }
      return out;
    },
    /** What stands, for the editor's outliner and a test: `[{ id, rev, status, visible, parts }]`. */
    standing() { return [...standing.values()].map((s) => ({ id: s.id, rev: s.rev, status: s.status, visible: !!s.visible, draft: s.draft, parts: s.parts.length })); },
    /**
     * POI-3: THE PART UNDER A RAY - the nearest standing part whose triangles the ray (scene frame: `o` the eye, `d` a
     * direction) meets within `max` metres, its box asked first: `{ id, key, dist, draft }`, or null. Exact, over the
     * part's own triangles through the inverse of its drawn matrix (a model with no collider is picked as one with).
     */
    pick(o, d, max = 6000) {
      let best = null;
      for (const s of standing.values()) {
        if (s.status !== 'ready' || !s.visible) continue;
        for (const p of s.parts) {
          if (!p.box || !rayBox(o, d, p.box, best ? best.dist : max)) continue;
          const inv = invert4(p.scene, _inv);
          if (!inv) continue;
          const lo = xformPoint(inv, o), ld = xformDir(inv, d);
          const t = rayTriangles(lo, ld, p.positions, p.indices, best ? best.dist : max);
          if (t !== null) best = { id: s.id, key: p.key, dist: t, draft: s.draft };   // nearer than any before: its reach was theirs
        }
      }
      return best;
    },
    /** A part's drawn matrix and box (the editor's gizmo and pick). */
    partOf(id, key) { const s = standing.get(id); const p = s?.parts.find((x) => x.key === key); return p ? { scene: p.scene, box: p.box, local: p.local } : null; },
    /** Everything down - a re-anchor, a load; the next frame stands what is still wanted. */
    destroyAll() { for (const s of [...standing.values()]) takeDown(s); },
    /**
     * AUDIT POI R8: THE STREET LEFT (an interior, a dungeon - world.js's change of mode): every collider down and nothing
     * drawn, the models and pictures kept - coming back out the POIs are placed again (their colliders filed in the
     * budget's turns), never loaded again; a pixel the streamer let go meanwhile takes its POIs down at the next frame.
     */
    standDown() {
      const col = collider();
      for (const s of stood) {
        s.visible = false;
        for (const p of s.parts) if (p.stood) { col?.removeBucket?.(p.bucket); p.stood = false; p.carry = false; }
      }
    },
    _identity: ID,
  };
}

// @ts-check
// LPT1 (bible/07-Rendering/Low-Poly-Trees.md): LOW POLY TREES IN THE GAME - the host's one door.
//
// - THE DATA is fetched once, the first time a pixel asks for a tree (vendor/low-poly-trees/Trees/, ~3.3 MB, a page that
//   never stands a nature flat never fetches it).
// - A HANDLE is a prototype painted under a SOURCE: the classic records (''), or Seasons of the Iliac Bay's season and
//   install (`s<season>.<generation>`) - and only for a prototype whose OWN archive the mod has re-skinned this season
//   (AUDIT LPT C2: a desert tree's atlas is mostly woodland sprites, and its flats never turn). Its atlases are painted
//   from the player's own pictures (world/lowPolyTrees.js paintAtlas) - a record of an archive the season re-skins in
//   the season's picture - a step between the build's breaths, their mips alpha-weighted, uploaded a band of rows at a
//   time (renderer createAtlasTexture); its FAR PICTURE (renderImpostor) uploaded as a flat of its archive,
//   `${record}#lpt${source}`.
// - OWNERSHIP (AUDIT LPT B5): a pixel that stands a handle's far pictures HOLDS it (acquire) and lets it go when it goes
//   (release). A handle no pixel has held for LPT_IDLE_S gives its far picture back, and an atlas no live handle reads
//   gives its texture back; an atlas's CPU picture (4 MB) is kept only while new prototypes are still drawn from it.
// - THE NEAR SET: the trees within LPT_NEAR_M + LPT_BAND_M of the eye (gatherNear, again only when the eye has moved a few
//   metres, a pixel moved or a tree was felled), each run its handle's - so a pixel not yet re-skinned keeps drawing
//   its trees as its far pictures stand (AUDIT LPT C3) - culled to the view each frame (cullNear) and handed on.
import { readLowPolyTrees, lptProto, paintAtlas, atlasMipSteps, impostorSteps, gatherNear, cullNear, LPT_NEAR_M, LPT_BAND_M, LPT_SCALE_MAX } from '../world/lowPolyTrees.js';
import { toColor32 } from '../formats/color32Order.js';
import { classicRecordRgba } from '../formats/derivedTexture.js';
import { LowPolyTreesGpu } from '../render/lowPolyTreesRender.js';

export const LPT_TREES_JSON_URL = new URL('../../vendor/low-poly-trees/Trees/trees.json', import.meta.url).href;
export const LPT_TREES_BIN_URL = new URL('../../vendor/low-poly-trees/Trees/trees.bin', import.meta.url).href;
export const LPT_ATLASES_BIN_URL = new URL('../../vendor/low-poly-trees/Trees/atlases.bin', import.meta.url).href;

/** The eye moves this far (m) before the near set is gathered again. */
export const LPT_REGATHER_M = 3;
/** Seconds a handle no pixel holds (and an atlas no live handle reads) is kept before it is given back - a pixel built
 *  again, a season's re-skin, a step back over a border all find it still standing. */
export const LPT_IDLE_S = 30;
/** Seconds an atlas's CPU picture is kept after a far picture was last drawn from it (it is painted again on demand). */
export const LPT_PIC_IDLE_S = 10;
/** Rows of an atlas's level uploaded between breaths. */
export const LPT_ATLAS_BAND = 128;

const defaultFetch = async (url) => {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  return new Uint8Array(await r.arrayBuffer());
};

/** A top-down RGBA picture resampled (nearest) to w x h - a season's picture brought to the classic record's texels. */
export function nearestRgba(pic, w, h) {
  if (pic.width === w && pic.height === h) return pic;
  const data = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    const sy = Math.min(pic.height - 1, Math.floor(((y + 0.5) * pic.height) / h));
    for (let x = 0; x < w; x++) {
      const sx = Math.min(pic.width - 1, Math.floor(((x + 0.5) * pic.width) / w));
      data.set(pic.data.subarray((sy * pic.width + sx) * 4, (sy * pic.width + sx) * 4 + 4), (y * w + x) * 4);
    }
  }
  return { width: w, height: h, data };
}

/** A port-order (bottom-up) colour picture back top-down, its alpha cut to 0 or 255 as a flat's is. */
export function topDownOf(color32) {
  const { width: w, height: h } = color32;
  const src = color32.colors ?? color32.data;
  const data = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const s = ((h - 1 - y) * w + x) * 4, d = (y * w + x) * 4;
      data[d] = src[s]; data[d + 1] = src[s + 1]; data[d + 2] = src[s + 2]; data[d + 3] = src[s + 3] >= 128 ? 255 : 0;
    }
  }
  return { width: w, height: h, data };
}

/** A submesh's alpha multiplier (BB_VS uMeshAlpha): 0 an opaque card, else what brings its cut to the flats' 0.5. */
export const lptAlphaOf = (sub) => (sub.opaque ? 0 : 0.5 / Math.max(1e-3, sub.cutoff ?? 0.5));

/**
 * @param {{ renderer: any, getTexture: (archive:number) => Promise<any>,
 *   seasonal?: { key: (archive:number) => string, picture: (archive:number, record:number) => any, generation?: () => number } | null,
 *   fetchBytes?: (url:string) => Promise<Uint8Array>, breathe?: () => Promise<void>, warn?: (m:string) => void, now?: () => number }} deps
 *   `seasonal.key(archive)` - the source a prototype of that archive is painted under ('' the classic records);
 *   `seasonal.picture(archive, record)` - the season's texture for a record it re-skins now (`image` in the port's
 *   order), or null; `seasonal.generation()` - the install, so a paint a new install overtook is never kept
 */
export function createLowPolyTrees({ renderer, getTexture, seasonal = null, fetchBytes = defaultFetch, breathe = async () => {}, warn = (m) => console.warn(m), now = () => performance.now() }) {
  /** @type {ReturnType<typeof readLowPolyTrees>|null} */
  let lpt = null;
  /** @type {Promise<any>|null} */
  let loading = null;
  let failed = false;
  /** @type {LowPolyTreesGpu|null} */
  let gpu = null;
  /** `${atlas}|${source}` -> { key, name, source, ready: Promise, tex, pic, picAt, lastLive, missing, painting } */
  const atlases = new Map();
  /** `${proto.key}|${source}` -> { promise, handle } */
  const handles = new Map();
  let readyGen = 0, lastSweep = -Infinity;
  /** @type {Float32Array} */
  let data = new Float32Array(0);
  /** @type {Float32Array} */
  let vis = new Float32Array(0);
  let gathered = null, lastEye = null, lastStamp = NaN;
  /** the sets the last gather read, each with the translation it read it at - [set, ox, oy, oz] */
  const lastSets = [];
  const sameSets = (sets) => {
    if (sets.length !== lastSets.length) return false;
    for (let i = 0; i < sets.length; i++) {
      const s = sets[i], l = lastSets[i];
      if (l[0] !== s || l[1] !== s.ox || l[2] !== s.oy || l[3] !== s.oz || l[4] !== s.trees) return false;
    }
    return true;
  };
  /** THE FRAME'S HAND-OFF, one object for the session: the runs made for `from` (a gather) at `readyGen` */
  const out = { from: null, readyGen: -1, runs: [], cut: new Set(), frame: { eye: [0, 0, 0], radius: LPT_NEAR_M, band: LPT_BAND_M, gpu: null, runs: [], cut: new Set() } };
  let bandScratch = new Uint8Array(0);

  const sourceOf = (proto) => seasonal?.key?.(proto.archive) ?? '';
  const generation = () => seasonal?.generation?.() ?? 0;

  /** A record top-down at its classic size - under a seasonal source the season's picture where it re-skins the record. */
  const recordRgba = (textures, source) => (archive, record, frame) => {
    const t = textures.get(archive);
    if (!t || record >= t.recordCount) return null;
    const bm = t.getDFBitmap(record, frame);
    if (!bm?.width) return null;
    const sib = source && frame === 0 ? seasonal?.picture?.(archive, record) : null;
    const img = sib?.image ?? sib;
    if (img?.width) return nearestRgba(topDownOf(img), bm.width, bm.height);
    return classicRecordRgba(bm, t.palette);
  };

  /** A step generator run between the build's breaths - its answer. */
  async function stepped(steps) {
    let r = steps.next();
    while (!r.done) { await breathe(); r = steps.next(); }   // the breather yields only once the build's slice is spent
    await breathe();
    return r.value;
  }

  /** The atlas's CPU picture, painted (again, if it was let go). */
  async function paintPic(entry) {
    if (entry.pic) return entry.pic;
    entry.painting ??= (async () => {
      const spec = lpt.atlases[entry.name];
      const archives = new Set([...spec.blits.map((b) => b[0]), ...(spec.fills ?? []).map((f) => f[1])]);
      const textures = new Map();
      for (const a of archives) textures.set(a, await getTexture(a));
      const pic = await stepped(paintAtlas(spec, recordRgba(textures, entry.source), lpt.atlasesBin));
      entry.missing = pic.missing;
      entry.pic = pic; entry.picAt = now();
      entry.painting = null;
      return pic;
    })();
    return entry.painting;
  }

  /** An atlas under a source: painted, its mip chain uploaded a band at a time. */
  function atlas(name, source) {
    const key = `${name}|${source}`;
    let entry = atlases.get(key);
    if (!entry) {
      entry = { key, name, source, ready: null, tex: null, pic: null, picAt: 0, lastLive: now(), missing: 0, painting: null };
      atlases.set(key, entry);
      const e = entry;
      e.ready = (async () => {
        const pic = await paintPic(e);
        if (e.missing) return e;   // a record the player lacks: no tree stands from it (farPicture answers null)
        const mips = await stepped(atlasMipSteps(pic));
        if (atlases.get(key) !== e) return e;   // given back while it painted: nothing uploaded
        e.tex = await uploadAtlas(mips);
        if (atlases.get(key) !== e) { renderer.releaseAtlasTexture(e.tex); e.tex = null; return e; }
        readyGen++;
        return e;
      })();
    }
    return entry;
  }

  /** The mip chain into the renderer's atlas texture, each level bottom-up (a mesh's uv v=0 is its picture's bottom),
   *  LPT_ATLAS_BAND rows a breath (a 1024 level is 4 MB - one call of it is a hitch). */
  async function uploadAtlas(mips) {
    const tex = renderer.createAtlasTexture(mips[0].width, mips[0].height, mips.length);
    for (let i = 0; i < mips.length; i++) {
      const { width: w, height: h, data: d } = mips[i], row = w * 4;
      for (let y0 = 0; y0 < h; y0 += LPT_ATLAS_BAND) {
        const y1 = Math.min(h, y0 + LPT_ATLAS_BAND), n = (y1 - y0) * row;
        if (bandScratch.length < n) bandScratch = new Uint8Array(n);
        const band = bandScratch.subarray(0, n);
        for (let y = y0; y < y1; y++) band.set(d.subarray(y * row, (y + 1) * row), (y1 - 1 - y) * row);
        renderer.uploadAtlasRows(tex, i, h - y1, w, band);
        if (h > LPT_ATLAS_BAND) await breathe();
      }
    }
    return tex;
  }

  /** EVERY ALLOCATION HAS AN OWNER: a handle's far picture, given back. */
  function freeHandle(key, entry) {
    handles.delete(key);
    const h = entry.handle;
    if (h) renderer.releaseTexture(h.archive, h.record);
  }
  /** ...and an atlas's texture and pictures. */
  function freeAtlas(entry) {
    atlases.delete(entry.key);
    if (entry.tex) renderer.releaseAtlasTexture(entry.tex);
    entry.tex = null; entry.pic = null;
    readyGen++;
  }

  /** THE SWEEP, once a second: handles no pixel held for LPT_IDLE_S, atlases no live handle reads for as long, and the
   *  CPU pictures of atlases nothing new has been drawn from for LPT_PIC_IDLE_S. */
  function sweep(t) {
    lastSweep = t;
    const live = new Set();
    for (const [key, entry] of handles) {
      const h = entry.handle;
      if (h && h.refs <= 0 && t - h.idleAt > LPT_IDLE_S * 1000) { freeHandle(key, entry); continue; }
      if (!h && !entry.settled) for (const s of entry.protoAtlases) live.add(s);   // still painting
      if (h) for (const s of h.atlasKeys) live.add(s);
    }
    for (const entry of [...atlases.values()]) {
      if (live.has(entry.key)) {
        entry.lastLive = t;
        if (entry.pic && !entry.painting && t - entry.picAt > LPT_PIC_IDLE_S * 1000) entry.pic = null;
        continue;
      }
      if (t - entry.lastLive > LPT_IDLE_S * 1000 && !entry.painting) freeAtlas(entry);
    }
  }

  return {
    /** Fetched and read once; null when the data cannot be had (the trees stay flats). */
    load() {
      if (lpt || failed) return Promise.resolve(lpt);
      loading ??= (async () => {
        try {
          const [j, tb, ab] = await Promise.all([fetchBytes(LPT_TREES_JSON_URL), fetchBytes(LPT_TREES_BIN_URL), fetchBytes(LPT_ATLASES_BIN_URL)]);
          lpt = readLowPolyTrees(JSON.parse(new TextDecoder().decode(j)), tb, ab);
          gpu = new LowPolyTreesGpu(renderer.gl, lpt.json, tb);
        } catch (e) {
          failed = true;
          warn(`[trees] Low Poly Trees could not load: ${e?.message ?? e}`);
        }
        return lpt;
      })();
      return loading;
    },
    get loaded() { return !!lpt; },
    /** The prototype standing for (archive, record), or null. */
    proto: (archive, record) => lptProto(lpt, archive, record),
    /** The source a prototype is painted under now. */
    sourceOf,
    /**
     * A PROTOTYPE'S HANDLE under its source now: its atlases painted and its far picture uploaded as the archive's flat -
     * `{ proto, source, archive, record, size, refs }` (`record`/`size` for createBillboardBatch: sized for the tallest
     * tree, LPT_SCALE_MAX, and the far picture's trimmed share; each tree's own share rides its corner) - or null: a
     * record the player's data lacks (AUDIT LPT B9), a paint a new season's install overtook. A null leaves the classic
     * flat. The caller holds it (acquire) while a batch of it stands.
     */
    farPicture(proto) {
      const source = sourceOf(proto), gen = generation();
      const key = `${proto.key}|${source}`;
      let entry = handles.get(key);
      if (!entry) {
        const protoAtlases = [...new Set(proto.subs.filter((s) => s.atlas).map((s) => `${s.atlas}|${source}`))];
        entry = { promise: null, handle: null, settled: false, protoAtlases };
        handles.set(key, entry);
        const e = entry;
        e.promise = (async () => {
          const pics = new Map();
          for (const s of proto.subs) {
            if (!s.atlas || pics.has(s.atlas)) continue;
            const a = atlas(s.atlas, source);
            await a.ready;
            if (a.missing || !a.tex) return null;
            a.lastLive = now();
            pics.set(s.atlas, await paintPic(a));
            a.picAt = now();
          }
          await breathe();
          const pic = await stepped(impostorSteps(lpt, proto, (n) => pics.get(n) ?? null));
          if (source && generation() !== gen) return null;   // a new install overtook the paint (AUDIT LPT B3): never kept
          if (handles.get(key) !== e) return null;
          const record = `${proto.record}#lpt${source}`;
          renderer.uploadTexture(proto.archive, record, toColor32(pic));
          e.handle = {
            proto, source, key, archive: proto.archive, record, atlasKeys: protoAtlases, refs: 0, idleAt: now(),
            size: { w: proto.size.w * pic.shareW * LPT_SCALE_MAX, h: proto.size.h * pic.shareH * LPT_SCALE_MAX },
          };
          return e.handle;
        })().catch((err) => { warn(`[trees] ${proto.key}: ${err?.message ?? err}`); return null; })
          .then((h) => { e.settled = true; if (!h && handles.get(key) === e) handles.delete(key); return h; });
      }
      return entry.promise;
    },
    /** A pixel stands a batch of the handle's far pictures. */
    acquire(handle) { if (handle) handle.refs++; },
    /** ...and lets it go (its teardown, a rebuild). */
    release(handle) { if (handle && --handle.refs <= 0) { handle.refs = 0; handle.idleAt = now(); } },
    /**
     * THE FRAME: the near set gathered (again only when the eye moved LPT_REGATHER_M, a set or where it stands changed, or
     * `stamp` moved - a tree felled), culled to `planes` (the view's, normalised; null - every tree), and handed to the
     * renderer, or nothing when there is none. `sets` - gatherNear's, and `skip` its; `swayOf(proto)` its share of the
     * wind's lean (systems/windDrive.js floraSwayOf, as its flats take it); WINDFALL1: `windfallOf(proto)` its share
     * under Windfall's law (systems/windfall.js windfallResponse, its far pictures' mask).
     * @param {any[]} sets @param {number} ex @param {number} ey @param {number} ez
     * @param {{ skip?: (set:any, i:number) => boolean, swayOf?: (proto:any) => number, windfallOf?: (proto:any) => number, stamp?: number, planes?: Float32Array|null }} [opts]
     */
    frame(sets, ex, ey, ez, { skip = null, swayOf = null, windfallOf = null, stamp = 0, planes = null } = {}) {
      const t = now();
      if (t - lastSweep > 1000) sweep(t);
      if (!gpu || !lpt) { renderer.setLowPolyTrees(null); return; }
      const moved = !lastEye || Math.hypot(ex - lastEye[0], ez - lastEye[2]) > LPT_REGATHER_M;
      if (moved || stamp !== lastStamp || !sameSets(sets) || !gathered) {
        gathered = gatherNear(sets, ex, ez, LPT_NEAR_M, LPT_BAND_M + LPT_REGATHER_M, data, skip);   // the band and the way the eye may go before the next gather: a tree it walks into the band toward is there
        data = gathered.data;
        lastEye = [ex, ey, ez]; lastStamp = stamp;
        lastSets.length = 0;
        for (const s of sets) lastSets.push([s, s.ox, s.oy, s.oz, s.trees]);
      }
      // the runs, made again only when the gather or the painted atlases changed - a frame between hands the renderer
      // the same object, its eye moved and its trees culled (nothing allocated a frame)
      if (out.from !== gathered || out.readyGen !== readyGen) {
        out.from = gathered; out.readyGen = readyGen;
        out.runs = []; out.cut = new Set();
        for (const r of gathered.runs) {
          const h = r.handle, p = h.proto;
          const subs = [];
          let ok = true;
          lpt.meshes[p.mesh].subs.forEach((_, i) => {
            const s = p.subs[i];
            const at = gpu.subs[p.mesh][i];
            const tex = s.atlas ? atlases.get(`${s.atlas}|${h.source}`)?.tex ?? null : null;
            if (s.atlas && !tex) ok = false;
            subs.push({ offset: at[0], count: at[1], tex, alpha: lptAlphaOf(s), color: s.color, cull: s.cull });
          });
          if (!ok) continue;
          out.cut.add(h);
          out.runs.push({ run: r, scale: p.scale, size: [p.size.w, p.size.h], sway: swayOf ? swayOf(p) : 0, windfall: windfallOf ? windfallOf(p) : 0, subs, drawStart: 0, drawCount: 0 });
        }
      }
      const visible = cullNear(gathered, planes, vis);
      vis = visible.data;
      gpu.setInstances(vis, visible.count);
      for (const r of out.runs) { r.drawStart = r.run.drawStart; r.drawCount = r.run.drawCount; }
      out.frame.eye[0] = ex; out.frame.eye[1] = ey; out.frame.eye[2] = ez;
      out.frame.gpu = gpu; out.frame.runs = out.runs; out.frame.cut = out.cut;
      renderer.setLowPolyTrees(out.runs.length ? out.frame : null);
    },
    /** EVERY ALLOCATION HAS AN OWNER: the buffers, every atlas and every far picture. The world holds the door for the
     *  session (as it holds the mills' parts - leaving it reloads the page); destroy is the test host's. */
    destroy() {
      renderer.setLowPolyTrees(null);
      gpu?.destroy(); gpu = null;
      for (const [key, entry] of [...handles]) { freeHandle(key, entry); }
      for (const entry of [...atlases.values()]) freeAtlas(entry);
    },
    /** For the tests and the probes. */
    get _lpt() { return lpt; },
    get _atlases() { return atlases; },
    get _handles() { return handles; },
  };
}

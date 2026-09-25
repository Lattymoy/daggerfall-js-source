// ═══════════════════════════════════════════════════════════════════
// DW-E2 (2026-09-25): ILIAC PUDDLE NO MORE'S DECORATIONS IN THE STREAMED
// WORLD - UnderwaterDecorations.cs's work (the queue, the pending batches,
// the markers, the suppression event) and UnderwaterDecorationBatchFactory
// .cs's Spawn, over the port's pixels. The placement itself is
// world/underwaterDecorations.js; the draw is render/deepWatersRender.js.
//
// A pixel's decorations are a group per texture, stood the three ways the
// factory stands them:
//
//   THE ARCHIVE BATCH (no replacement texture): DFU's billboard batch -
//     the record's own scaled size, its base on the placement point, a
//     random start frame, archive 106 animated at 5 frames a second;
//   THE MATERIAL BATCH (a replacement, or an animated record whose
//     replacement is one picture): the replacement's billboard size
//     (the classic size x its XML scale) x a random 0.7 .. 1.2, its base
//     on the point, still;
//   THE ANIMATED REPLACEMENT (an animated record whose replacement has
//     frames): a DaggerfallBillboard each - the same random scale, its
//     frames from the first at 5 a second, turned as a DaggerfallBillboard
//     turns (the camera's horizontal facing), and, the billboard's pivot
//     being its centre and the mod setting its position straight, its
//     CENTRE on the point.
//
// Every texture is edge-cleaned (GetEdgeCleanedTexture) but an animated
// replacement's, whose billboard sets its raw frames itself. The warm-up the
// mod makes under Asset Injection - one archive's atlas a frame
// (PumpArchiveWarmup) - is here every texture's load: a pending batch
// waits while any of its pictures is loading, every missing one started
// at once - the port reads files asynchronously where DFU reads them in
// the frame.
// ═══════════════════════════════════════════════════════════════════

import {
  placeTileDecorations, decorationCap, populateRadius, usesArchiveAnimation, framesPerSecondOf, authoredVisualHeight, clearEdgeBlackPixels,
  DECORATION_SCALE_MIN, DECORATION_SCALE_MAX, TEXTURE_106_FPS,
} from '../world/underwaterDecorations.js';

/** DeepWaterPromoteTiming's bar: no decoration work in a frame the promote work spent more than a millisecond in. */
export const PROMOTE_BUDGET_MS = 1;

/**
 * @param {object} deps
 * @param {(x: number, y: number) => ?object} deps.terrainAt - StreamingWorld.GetTerrainFromPixel: the built pixel there
 * @param {() => {x: number, y: number}} deps.currentPixel - PlayerGPS.CurrentMapPixel
 * @param {() => {spawn: boolean, radius: number, frequency: number, maxPerTile: number}} deps.settings
 * @param {() => boolean} deps.canRunLight - DeepWaterRuntime.CanRunLightRuntimeWork
 * @param {() => boolean} deps.canRunHeavy - DeepWaterRuntime.CanRunHeavyRuntimeWork
 * @param {() => number} deps.promoteMs - this frame's promote work (DeepWaterPromoteTiming.CurrentTotalMs)
 * @param {(entry: object) => ?{floor: object, version: number, climateIndex: number}} deps.floorOf - the pixel's built floor
 * @param {object} deps.textures - the decoration texture source (see createDecorTextureSource)
 * @param {{create: (entry: object, groups: object[]) => any, destroy: (h: any) => void}} deps.gpu
 * @param {(entry: object, local: number[]) => number[]} deps.worldPoint - a pixel-local point in the world
 * @param {() => number} deps.now - seconds (a batch's animation begins when it stands)
 * @param {() => number} [deps.roll] - the unseeded UnityEngine.Random (Port-Ledger A, the engine-PRNG rule)
 */
export function createUnderwaterDecorations({ terrainAt, currentPixel, settings, canRunLight, canRunHeavy, promoteMs, floorOf, textures, gpu, worldPoint, now, roll = Math.random }) {
  const workQueue = [];
  const queued = new Set();
  const pending = [];
  /** entry -> {px, py, version} (DecorationMarker) */
  const markers = new Map();
  /** entry -> the GPU handle (the DeepWaters_DecorationBatch child) */
  const batches = new Map();
  const suppressors = [];
  let suppressionFailureLogged = false;

  const canPopulate = () => settings().spawn === true;
  const radius = () => populateRadius(settings().radius);

  function enqueue(entry) {
    if (entry && !queued.has(entry)) { queued.add(entry); workQueue.push(entry); }
  }
  function withinRadius(entry) {
    const c = currentPixel();
    if (!c || !entry) return true;
    const r = radius();
    return Math.abs(entry.px - c.x) <= r && Math.abs(entry.py - c.y) <= r;
  }
  function removeDecoration(entry) {
    const h = batches.get(entry);
    if (h) { gpu.destroy(h); batches.delete(entry); }
  }
  const clearMarker = (entry) => markers.delete(entry);
  function markCurrent(entry) {
    const f = floorOf(entry);
    markers.set(entry, { px: entry.px, py: entry.py, version: f ? f.version : 0 });
  }
  function hasReadyFloor(entry) {
    const f = floorOf(entry);
    return !!f && f.version > 0;
  }
  const currentFloorVersion = (entry) => floorOf(entry)?.version ?? 0;
  function isCurrentDecoration(entry) {
    const m = markers.get(entry);
    return !!m && m.px === entry.px && m.py === entry.py && m.version === currentFloorVersion(entry);
  }
  /** ShouldPreservePlayerTileDecorations: the player's own pixel keeps the batch it has. */
  function preservePlayerTile(entry) {
    const c = currentPixel();
    if (!entry || !c || entry.px !== c.x || entry.py !== c.y) return false;
    return batches.has(entry);
  }

  /** EnqueueAroundMapPixel: ring by ring out to the radius. */
  function enqueueAround(pixel) {
    const r = radius();
    for (let i = 0; i <= r; i++) {
      for (let j = -i; j <= i; j++) {
        for (let k = -i; k <= i; k++) {
          if (Math.max(Math.abs(j), Math.abs(k)) !== i) continue;
          const e = terrainAt(pixel.x + j, pixel.y + k);
          if (e) enqueue(e);
        }
      }
    }
  }

  /** PopulateTile: the placement, and a pending batch when anything stood. */
  function populateTile(entry) {
    const s = settings();
    const f = floorOf(entry);
    const positions = placeTileDecorations({
      mapPixelX: entry.px, mapPixelY: entry.py, mapData: { samples: entry.samples }, floor: f.floor, climateIndex: f.climateIndex,
      frequency: s.frequency, cap: decorationCap(s.maxPerTile), visualHeight: (rec) => textures.visualHeight(rec),
    });
    if (positions === null) { markCurrent(entry); return; }
    if (positions.length) pending.push({ entry, px: entry.px, py: entry.py, version: f.version, positions, warm: 0 });
  }

  function isPendingCurrent(b) {
    if (!b || !b.entry || !b.positions?.length) return false;
    if (b.entry.px !== b.px || b.entry.py !== b.py || currentFloorVersion(b.entry) !== b.version) return false;
    return hasReadyFloor(b.entry);
  }

  /** FilterPlacements: every ShouldSuppressDecoration subscriber asked of every point; any true drops it (a throw is one warning). */
  function filterPlacements(entry, positions) {
    if (!suppressors.length || !positions.length) return positions;
    const subs = [...suppressors];
    for (let i = positions.length - 1; i >= 0; i--) {
      const at = worldPoint(entry, positions[i].local);
      let drop = false;
      for (const fn of subs) {
        try { drop = (fn(entry, at) === true) || drop; } catch (e) {
          if (!suppressionFailureLogged) { suppressionFailureLogged = true; console.warn(`[DeepWaters.Decorations] ShouldSuppressDecoration subscriber threw: ${e?.message ?? e}`); }
        }
      }
      if (drop) positions.splice(i, 1);
    }
    return positions;
  }

  /** UnderwaterDecorationBatchFactory.Spawn: the groups, stood on the pixel. */
  function spawn(entry, positions) {
    positions = filterPlacements(entry, positions);
    if (!positions.length) return null;
    const born = now();
    const groups = new Map();
    const group = (key, texture, fps, facing = 0) => {
      let g = groups.get(key);
      if (!g) { g = { texture, fps, born, facing, billboards: [] }; groups.set(key, g); }
      return g;
    };
    for (const p of positions) {
      const rec = { archive: p.archive, record: p.record };
      const rep = textures.replacement(rec);
      if (rep && usesArchiveAnimation(rec) && rep.animated) {
        // SpawnAnimatedReplacementBillboards: a DaggerfallBillboard each, centred on the point, turned as one turns (facing 1)
        const scale = DECORATION_SCALE_MIN + roll() * (DECORATION_SCALE_MAX - DECORATION_SCALE_MIN);
        const w = rep.size.w * scale, h = rep.size.h * scale;
        group(`${rec.archive}_${rec.record}#ra`, textures.texture(rec, 'animated'), Math.max(1, Math.round(TEXTURE_106_FPS)), 1)
          .billboards.push({ centre: [p.local[0], p.local[1], p.local[2]], width: w, height: h, start: 0 });
      } else if (rep) {
        // SpawnReplacementBatch / BuildMaterialBillboardBatchMesh: its base on the point, a random scale, still
        const scale = DECORATION_SCALE_MIN + roll() * (DECORATION_SCALE_MAX - DECORATION_SCALE_MIN);
        const w = rep.size.w * scale, h = rep.size.h * scale;
        group(`${rec.archive}_${rec.record}#r`, textures.texture(rec, 'replacement'), 0)
          .billboards.push({ centre: [p.local[0], p.local[1] + h * 0.5, p.local[2]], width: w, height: h, start: 0 });
      } else {
        // SpawnArchiveBillboards: DaggerfallBillboardBatch.AddItem - the record's size, its base on the point, RandomStartFrame
        const size = textures.scaledSize(rec);
        const tex = textures.texture(rec, 'archive');
        if (!size || !tex) continue;
        const w = size.w, h = size.h;
        const frames = tex.frames;
        group(`${rec.archive}_${rec.record}`, tex, framesPerSecondOf(rec.archive))
          .billboards.push({ centre: [p.local[0], p.local[1] + h * 0.5, p.local[2]], width: w, height: h, start: Math.floor(roll() * frames) });
      }
    }
    const list = [...groups.values()].filter((g) => g.texture && g.billboards.length);
    return list.length ? gpu.create(entry, list) : null;
  }

  /** ProcessPendingBatch: one batch stood a frame (true: the frame's decoration work is spent). */
  function processPendingBatch() {
    while (pending.length) {
      const b = pending[0];
      if (!isPendingCurrent(b)) { pending.shift(); continue; }
      if (!canPopulate()) { pending.shift(); removeDecoration(b.entry); clearMarker(b.entry); continue; }
      if (preservePlayerTile(b.entry)) { pending.shift(); continue; }
      if (textures.warm(b)) return true;   // PumpArchiveWarmup: the batch waits on its pictures' loads
      pending.shift();
      removeDecoration(b.entry);
      const h = spawn(b.entry, b.positions);
      if (h) batches.set(b.entry, h);
      markCurrent(b.entry);
      return true;
    }
    return false;
  }

  return {
    /** ShouldSuppressDecoration: `+= fn(entry, worldPoint) -> bool`; returns the `-=`. */
    onShouldSuppressDecoration(fn) {
      suppressors.push(fn);
      return () => { const i = suppressors.indexOf(fn); if (i >= 0) suppressors.splice(i, 1); };
    },

    /** ProcessWorkQueue: once a frame. */
    process() {
      if (!canRunHeavy() || promoteMs() > PROMOTE_BUDGET_MS || processPendingBatch()) return;
      if (!textures.ready()) { textures.load(); return; }   // the placement reads the records' sizes: the archives first
      let placed = 0;
      while (workQueue.length > 0 && placed < 1) {
        const e = workQueue.shift();
        queued.delete(e);
        if (!e || !e.samples || e._dead) continue;
        if (!canPopulate()) { removeDecoration(e); clearMarker(e); }
        else if (hasReadyFloor(e) && !preservePlayerTile(e) && !isCurrentDecoration(e)) { populateTile(e); placed++; }
      }
    },

    /** RefreshPlayerArea: the player's pixel and its rings. */
    refreshPlayerArea() { if (canRunLight()) { const c = currentPixel(); if (c) enqueueAround(c); } },

    /** RefreshLoadedTile: this pixel's decorations gone and asked again. */
    refreshLoadedTile(entry) { if (!entry) return; removeDecoration(entry); clearMarker(entry); enqueue(entry); },

    /** HandlePromote: a stale marker cleared; within the radius, queued. */
    onPromote(entry) {
      if (!entry || !canRunLight()) return;
      const m = markers.get(entry);
      if (m && (m.px !== entry.px || m.py !== entry.py)) { removeDecoration(entry); clearMarker(entry); }
      if (withinRadius(entry)) enqueue(entry);
    },

    /** HandleFloorRefreshed. */
    onFloorRefreshed(entry) { if (entry && canRunLight() && withinRadius(entry)) enqueue(entry); },

    /** HandleMapPixelChanged. */
    onMapPixelChanged(pixel) { if (canRunLight() && pixel) enqueueAround(pixel); },

    /** The pixel left the world: its batch goes with it (the terrain's child). */
    destroyed(entry) {
      removeDecoration(entry);
      markers.delete(entry);
      if (queued.delete(entry)) { const i = workQueue.indexOf(entry); if (i >= 0) workQueue.splice(i, 1); }
      for (let i = pending.length - 1; i >= 0; i--) if (pending[i].entry === entry) pending.splice(i, 1);
    },

    /** ResetRuntimeState (OnTransientReset): the queues emptied, every batch and marker gone. */
    reset() {
      workQueue.length = 0;
      queued.clear();
      pending.length = 0;
      for (const e of [...batches.keys()]) removeDecoration(e);
      markers.clear();
    },

    /** The drawn batch of a pixel, or null. */
    batchOf(entry) { return batches.get(entry) ?? null; },
    get pendingWorkCount() { return workQueue.length + pending.length; },
    /** Probes: the pictures' archives in, the pending batches. */
    get texturesReady() { return textures.ready(); },
    get pendingBatchCount() { return pending.length; },
    get debug() { return { tex: textures.debug, warm: pending[0]?.warm ?? null, n: pending[0]?.positions.length ?? null }; },
    get queuedTerrainCount() { return queued.size; },
    /** Tests: the marker of a pixel. */
    markerOf(entry) { return markers.get(entry) ?? null; },
  };
}

/** Every archive the six pools draw from. */
export const DECORATION_ARCHIVES = Object.freeze([105, 106, 206, 211, 213, 253, 305, 306, 380, 501, 502]);

/**
 * The decorations' pictures and sizes, off the port's texture pipeline:
 * the classic record (its frames, its scaled size) or, with Asset
 * Injection on and a replacement registered, the replacement
 * (UnderwaterDecorationReplacementCache: its billboard size - the classic
 * size x its XML scale - and whether it brings frames of its own). The
 * pictures edge-cleaned (an animated replacement's frames excepted - see
 * framesOf), then an array texture on the GPU.
 *
 * @param {object} deps
 * @param {(archive: number) => Promise<object>} deps.getTexture - the TEXTURE.nnn file (kept once it is in)
 * @param {(t: object, record: number) => {w: number, h: number}} deps.scaledSize - rmbFlats.classicBillboardSize (MeshReader.GetScaledBillboardSize)
 * @param {(t: object, record: number) => {w: number, h: number}} deps.replacementSize - rmbFlats.billboardSize (the XML scale over it)
 * @param {() => boolean} deps.replacementsOn - DaggerfallUnity.Settings.AssetInjection
 * @param {(archive: number, record: number, frame: number) => boolean} deps.hasReplacement
 * @param {(archive: number, record: number, frame: number) => Promise<?{colors: Uint8ClampedArray, width: number, height: number}>} deps.loadReplacement
 * @param {(frames: Array<{width: number, height: number, data: Uint8Array | Uint8ClampedArray}>) => ?{tex: any, frames: number}} deps.createTexture
 */
export function createDecorTextureSource({ getTexture, scaledSize, replacementSize, replacementsOn, hasReplacement, loadReplacement, createTexture }) {
  const files = new Map();       // archive -> its TEXTURE file, once in
  const failed = new Set();      // an archive that will not load (its records are never placed: a height of 0)
  const textureFile = (archive) => files.get(archive) ?? null;
  const fileOf = (archive) => Promise.resolve(getTexture(archive)).then((t) => { if (t) files.set(archive, t); return t; });
  const heights = new Map();
  const replacements = new Map();
  const textures = new Map();   // key -> {tex, frames} | null (ready) ; absent: not asked
  const building = new Map();   // key -> Promise
  let loading = null;
  const key = (rec) => `${rec.archive}_${rec.record}`;

  function replacementOf(rec) {
    if (!replacementsOn()) return null;
    const k = key(rec);
    if (replacements.has(k)) return replacements.get(k);
    const t = textureFile(rec.archive);
    let info = null;
    if (t && hasReplacement(rec.archive, rec.record, 0)) {
      let frames = 1;
      while (hasReplacement(rec.archive, rec.record, frames)) frames++;
      info = { size: replacementSize(t, rec.record), frames, animated: frames > 1 };
    }
    replacements.set(k, info);
    return info;
  }
  /**
   * The frames of `kind` for a record: the classic record's, or the
   * replacement's - edge-cleaned, all but an animated replacement's. That
   * one's material is cleaned once (CopyTextureAndTransform) and then its
   * DaggerfallBillboard's own coroutine (AnimateBillboard) sets every frame
   * on it, the first included, straight from the imported textures.
   */
  async function framesOf(rec, kind) {
    const t = await fileOf(rec.archive);
    const out = [];
    if (kind === 'archive') {
      const n = Math.max(1, t.getFrameCount(rec.record));
      for (let f = 0; f < n; f++) {
        const c = t.getColor32(t.getDFBitmap(rec.record, f), 0);
        out.push({ width: c.width, height: c.height, data: c.colors });
      }
    } else {
      const n = kind === 'animated' ? (replacementOf(rec)?.frames ?? 1) : 1;
      for (let f = 0; f < n; f++) {
        const c = await loadReplacement(rec.archive, rec.record, f);
        if (!c) break;
        out.push({ width: c.width, height: c.height, data: new Uint8Array(c.colors) });
      }
    }
    if (kind !== 'animated') for (const img of out) clearEdgeBlackPixels(img);   // GetEdgeCleanedTexture
    return out;
  }
  const kindOf = (rec) => {
    const rep = replacementOf(rec);
    if (!rep) return 'archive';
    return usesArchiveAnimation(rec) && rep.animated ? 'animated' : 'replacement';
  };

  return {
    /** Every pool archive's file is in (the placement reads the records' sizes) - or settled without one. */
    ready() { return DECORATION_ARCHIVES.every((a) => files.has(a) || failed.has(a)); },
    /** Their loads, once (an archive that will not load leaves its records unplaced - a height of 0). */
    load() {
      loading ??= Promise.all(DECORATION_ARCHIVES.map((a) => fileOf(a).catch(() => { failed.add(a); return null; })));
      return loading;
    },
    /** The classic record's scaled size in metres, or null. */
    scaledSize(rec) {
      const t = textureFile(rec.archive);
      if (!t || rec.record >= (t.recordCount ?? Infinity)) return null;
      const s = t.getSize(rec.record);
      return s.width > 0 && s.height > 0 ? scaledSize(t, rec.record) : null;
    },
    replacement: replacementOf,
    /** TryGetAuthoredDecorationVisualHeight, cached per record (authoredVisualHeightCache). */
    visualHeight(rec) {
      const k = key(rec);
      if (heights.has(k)) return heights.get(k);
      const h = authoredVisualHeight(rec, { scaledSize: (r) => this.scaledSize(r), replacementSize: (r) => replacementOf(r)?.size ?? null });
      heights.set(k, h);
      return h;
    },
    /** Probes: the pictures built, and those in flight. */
    get debug() { return { built: textures.size, building: [...building.keys()], nulls: [...textures].filter(([, v]) => !v).map(([k]) => k) }; },
    /** The record's GPU picture of `kind`, when built. */
    texture(rec, kind) { return textures.get(`${key(rec)}:${kind}`) ?? null; },
    /**
     * PumpArchiveWarmup: while any of the batch's pictures is not on the GPU
     * yet the batch waits (true) - every missing one started at once, so it
     * waits on the slowest load and no more. DFU builds its atlases inside
     * the frame; the port reads files asynchronously.
     */
    warm(batch) {
      let busy = false;
      for (let i = batch.warm; i < batch.positions.length; i++) {
        const p = batch.positions[i];
        const rec = { archive: p.archive, record: p.record };
        const kind = kindOf(rec);
        const k = `${key(rec)}:${kind}`;
        if (textures.has(k)) continue;
        busy = true;
        if (!building.has(k)) {
          building.set(k, framesOf(rec, kind)
            .then((frames) => { textures.set(k, frames.length ? createTexture(frames) : null); })
            .catch(() => { textures.set(k, null); })
            .finally(() => building.delete(k)));
        }
      }
      if (!busy) batch.warm = batch.positions.length;
      return busy;
    },
  };
}

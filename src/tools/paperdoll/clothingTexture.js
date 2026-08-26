// Classic Daggerfall clothing art -> generated 8-direction garment wraps.
//
// Daggerfall's paperdoll art gives us one authored front-facing image. The 3D
// clothing rig, however, is visible from every angle. This module turns that
// single legal runtime source into an explicit eight-view wrap set (0..315 in
// 45-degree steps), then projects the view that actually faces each owned quad
// into the exact body atlas. The generated side/back views deliberately strip
// front-centre detail instead of mirroring the front around the character.
//
// Nothing derived from ARENA2 is committed: TEXTURE.NNN and ART_PAL.COL are
// read from the player's existing dataSource store and all wraps live in memory.

import { TextureFile } from '../../formats/textureFile.js';
import { DFPalette } from '../../formats/dfPalette.js';
import { getBytes } from '../../scenes/dataSource.js';
import { applyDyeToIndex, DYE_COLORS, DYE_TARGETS } from '../../characters/dyes.js';
import { morphologyOfRace, resolvePaperdollRecord } from '../../characters/paperdollArt.js';

export const CLOTHING_WRAP_DEGREES = Object.freeze([0, 45, 90, 135, 180, 225, 270, 315]);
const WRAP_RADIANS = CLOTHING_WRAP_DEGREES.map((d) => d * Math.PI / 180);
const archiveCache = new Map();
let palettePromise = null;

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const clampByte = (v) => Math.max(0, Math.min(255, Math.round(v)));

async function classicPalette() {
  if (!palettePromise) {
    palettePromise = (async () => {
      const pal = new DFPalette();
      pal.load(await getBytes('ART_PAL.COL'), 'ART_PAL.COL');
      return pal;
    })();
  }
  return palettePromise;
}

async function classicArchive(archive) {
  if (archiveCache.has(archive)) return archiveCache.get(archive);
  const p = (async () => {
    const pal = await classicPalette();
    const name = TextureFile.indexToFileName(archive);
    const tex = new TextureFile();
    if (!tex.load(await getBytes(name), name, pal)) throw new Error(`could not load ${name}`);
    return { tex, pal, name };
  })();
  archiveCache.set(archive, p);
  try { return await p; }
  catch (e) { archiveCache.delete(archive); throw e; }
}

function sourceBounds(bitmap) {
  let x0 = bitmap.width, y0 = bitmap.height, x1 = -1, y1 = -1;
  for (let y = 0; y < bitmap.height; y++) for (let x = 0; x < bitmap.width; x++) {
    const i = bitmap.data[y * bitmap.width + x];
    if (i === 0 || i === 0xff) continue;
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  }
  return x1 >= x0 && y1 >= y0 ? { x0, y0, x1, y1 } : null;
}

async function loadIndexedArt({ item, race = 'Breton', variant = 0, dye = DYE_COLORS.Blue }) {
  if (!item) return null;
  const morph = morphologyOfRace(race);
  const archive = (item.playerTextureArchive || 0) + morph;
  if (!archive) return null;
  const maxVariant = Math.max(0, (item.variants || 1) - 1);
  const useVariant = Math.max(0, Math.min(maxVariant, variant | 0));
  const record = resolvePaperdollRecord(item, useVariant);
  const { tex, pal, name } = await classicArchive(archive);
  const bitmap = tex.getDFBitmap(record, 0);
  if (!bitmap || !bitmap.width || !bitmap.height || !bitmap.data?.length) return null;
  const src = sourceBounds(bitmap);
  if (!src) return null;
  return {
    bitmap, pal, src, dye,
    meta: Object.freeze({ archive, record, variant: useVariant, source: name }),
  };
}

function decodedCrop(art) {
  const { bitmap, pal, src, dye } = art;
  const width = src.x1 - src.x0 + 1, height = src.y1 - src.y0 + 1;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const original = bitmap.data[(src.y0 + y) * bitmap.width + src.x0 + x];
    const o = (y * width + x) * 4;
    if (original === 0 || original === 0xff) continue;
    const index = applyDyeToIndex(original, dye, DYE_TARGETS.Clothing);
    const c = pal.get(index);
    data[o] = c.r; data[o + 1] = c.g; data[o + 2] = c.b; data[o + 3] = 255;
  }
  return { width, height, data };
}

function pixel(img, x, y) {
  x = Math.max(0, Math.min(img.width - 1, Math.round(x)));
  y = Math.max(0, Math.min(img.height - 1, Math.round(y)));
  const o = (y * img.width + x) * 4;
  return [img.data[o], img.data[o + 1], img.data[o + 2], img.data[o + 3]];
}

function rowSpan(img, y) {
  let x0 = img.width, x1 = -1;
  for (let x = 0; x < img.width; x++) {
    if (img.data[(y * img.width + x) * 4 + 3]) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); }
  }
  return x1 >= x0 ? [x0, x1] : null;
}

function nearestOpaqueInRow(img, y, x, x0, x1) {
  const c = pixel(img, x, y);
  if (c[3]) return c;
  const max = Math.max(x - x0, x1 - x);
  for (let d = 1; d <= max; d++) {
    if (x - d >= x0) { const a = pixel(img, x - d, y); if (a[3]) return a; }
    if (x + d <= x1) { const b = pixel(img, x + d, y); if (b[3]) return b; }
  }
  return [0, 0, 0, 0];
}

function makeSideView(front, side) {
  const out = { width: front.width, height: front.height, data: new Uint8ClampedArray(front.data.length) };
  for (let y = 0; y < front.height; y++) {
    const span = rowSpan(front, y);
    if (!span) continue;
    const [x0, x1] = span, w = Math.max(1, x1 - x0);
    for (let x = x0; x <= x1; x++) {
      const u = (x - x0) / w;
      // A side view owns the corresponding outer band of the authored front.
      // This keeps seams/hem/sleeve colour while excluding centre-front emblems.
      const su = side > 0 ? 0.62 + 0.38 * u : 0.38 * u;
      const sx = Math.round(x0 + su * w);
      const c = nearestOpaqueInRow(front, y, sx, x0, x1);
      if (!c[3]) continue;
      const o = (y * front.width + x) * 4;
      out.data[o] = clampByte(c[0] * 0.90);
      out.data[o + 1] = clampByte(c[1] * 0.90);
      out.data[o + 2] = clampByte(c[2] * 0.90);
      out.data[o + 3] = 255;
    }
  }
  return out;
}

function makeBackView(front) {
  const out = { width: front.width, height: front.height, data: new Uint8ClampedArray(front.data.length) };
  for (let y = 0; y < front.height; y++) {
    const span = rowSpan(front, y);
    if (!span) continue;
    const [x0, x1] = span, w = Math.max(1, x1 - x0);
    for (let x = x0; x <= x1; x++) {
      const u = (x - x0) / w;
      // Build the rear from BOTH authored side bands. Centre-front heraldry,
      // buttons and openings are therefore not stamped unchanged onto the back.
      const lx = x0 + (0.06 + 0.28 * u) * w;
      const rx = x0 + (0.94 - 0.28 * u) * w;
      const a = nearestOpaqueInRow(front, y, Math.round(lx), x0, x1);
      const b = nearestOpaqueInRow(front, y, Math.round(rx), x0, x1);
      if (!a[3] && !b[3]) continue;
      const wa = a[3] ? 1 : 0, wb = b[3] ? 1 : 0, n = wa + wb || 1;
      const o = (y * front.width + x) * 4;
      out.data[o] = clampByte(((a[0] * wa + b[0] * wb) / n) * 0.84);
      out.data[o + 1] = clampByte(((a[1] * wa + b[1] * wb) / n) * 0.84);
      out.data[o + 2] = clampByte(((a[2] * wa + b[2] * wb) / n) * 0.84);
      out.data[o + 3] = 255;
    }
  }
  return out;
}

function mixViews(a, b, t) {
  const out = { width: a.width, height: a.height, data: new Uint8ClampedArray(a.data.length) };
  for (let o = 0; o < out.data.length; o += 4) {
    const aa = a.data[o + 3] / 255, ba = b.data[o + 3] / 255;
    const wa = aa * (1 - t), wb = ba * t, n = wa + wb;
    if (n <= 1e-6) continue;
    out.data[o] = clampByte((a.data[o] * wa + b.data[o] * wb) / n);
    out.data[o + 1] = clampByte((a.data[o + 1] * wa + b.data[o + 1] * wb) / n);
    out.data[o + 2] = clampByte((a.data[o + 2] * wa + b.data[o + 2] * wb) / n);
    out.data[o + 3] = 255;
  }
  return out;
}

function generateDirectionalViews(front) {
  const right = makeSideView(front, +1);
  const back = makeBackView(front);
  const left = makeSideView(front, -1);
  return [
    front,
    mixViews(front, right, 0.5),
    right,
    mixViews(right, back, 0.5),
    back,
    mixViews(back, left, 0.5),
    left,
    mixViews(left, front, 0.5),
  ];
}

function viewToCanvas(img) {
  const canvas = document.createElement('canvas');
  canvas.width = img.width; canvas.height = img.height;
  const ctx = canvas.getContext('2d');
  const out = ctx.createImageData(img.width, img.height);
  out.data.set(img.data);
  ctx.putImageData(out, 0, 0);
  return canvas;
}

function viewsToAtlasCanvas(views, columns = 4) {
  if (!views?.length) return null;
  const w = views[0].width, h = views[0].height;
  const rows = Math.ceil(views.length / columns);
  const canvas = document.createElement('canvas');
  canvas.width = w * columns; canvas.height = h * rows;
  const ctx = canvas.getContext('2d');
  for (let i = 0; i < views.length; i++) {
    const cell = ctx.createImageData(w, h);
    cell.data.set(views[i].data);
    ctx.putImageData(cell, (i % columns) * w, Math.floor(i / columns) * h);
  }
  return canvas;
}

function projectionX(x, z, radians) {
  // Camera at (sin(yaw), 0, cos(yaw)): this is its screen-right axis.
  return x * Math.cos(radians) - z * Math.sin(radians);
}

function projectionBounds(D, faces, radians) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const f of faces) {
    const b = f * 12;
    for (let v = 0; v < 4; v++) {
      const x = (D.P[b + v * 3] || 0) / 1000;
      const y = (D.P[b + v * 3 + 1] || 0) / 1000;
      const z = (D.P[b + v * 3 + 2] || 0) / 1000;
      const sx = projectionX(x, z, radians);
      x0 = Math.min(x0, sx); x1 = Math.max(x1, sx);
      y0 = Math.min(y0, y); y1 = Math.max(y1, y);
    }
  }
  if (!Number.isFinite(x0) || x1 <= x0 || y1 <= y0) return null;
  return { x0, y0, x1, y1 };
}

// Same [0,1,2] / [0,2,3] diagonal the renderer and skin atlas use.
function quadPoint(D, f, s, t) {
  const b = f * 12;
  const V = (i) => [
    (D.P[b + i * 3] || 0) / 1000,
    (D.P[b + i * 3 + 1] || 0) / 1000,
    (D.P[b + i * 3 + 2] || 0) / 1000,
  ];
  const v0 = V(0), v1 = V(1), v2 = V(2), v3 = V(3);
  let w0, w1, w2, a, bb, c;
  if (t <= s) {
    w0 = 1 - s; w1 = s - t; w2 = t;
    a = v0; bb = v1; c = v2;
  } else {
    w0 = 1 - t; w1 = s; w2 = t - s;
    a = v0; bb = v2; c = v3;
  }
  return [
    a[0] * w0 + bb[0] * w1 + c[0] * w2,
    a[1] * w0 + bb[1] * w1 + c[1] * w2,
    a[2] * w0 + bb[2] * w1 + c[2] * w2,
  ];
}

function faceWrapIndex(D, f) {
  const n = f * 3;
  let nx = (D.N?.[n] || 0) / 127, nz = (D.N?.[n + 2] || 0) / 127;
  if (Math.hypot(nx, nz) < 0.20) {
    // Horizontal caps do not have a useful yaw normal. Use the quad centroid so
    // a shoulder/hem cap inherits the side of the body it actually occupies.
    const b = f * 12;
    nx = nz = 0;
    for (let v = 0; v < 4; v++) { nx += (D.P[b + v * 3] || 0); nz += (D.P[b + v * 3 + 2] || 0); }
  }
  const angle = Math.atan2(nx, nz); // 0=front(+z), +90=right(+x)
  return ((Math.round(angle / (Math.PI / 4)) % 8) + 8) % 8;
}

function sampleView(img, u, v) {
  const x = clamp01(u) * Math.max(0, img.width - 1);
  const y = clamp01(v) * Math.max(0, img.height - 1);
  return pixel(img, x, y);
}

/**
 * Body-fitted clothing: each exact body quad chooses the generated wrap facing
 * its own rest normal, then samples that view in the same projection used to
 * inspect it. This is actual 8-way ownership, not one front bitmap smeared around
 * a cylinder. The skin atlas still owns final tile placement and gutters.
 */
export async function buildClassicBodyClothingSampler({
  item, D, race = 'Breton', variant = 0, dye = DYE_COLORS.Blue,
}) {
  if (!item || item.kind !== 'body' || !Array.isArray(item.idx) || !item.idx.length) return null;
  const art = await loadIndexedArt({ item, race, variant, dye });
  if (!art) return null;
  const views = generateDirectionalViews(decodedCrop(art));
  const bounds = WRAP_RADIANS.map((r) => projectionBounds(D, item.idx, r));
  if (bounds.some((b) => !b)) return null;

  const owned = new Set(item.idx);
  const faceDir = new Int8Array(D.n || 0); faceDir.fill(-1);
  for (const f of item.idx) faceDir[f] = faceWrapIndex(D, f);

  const sampler = (f, s, t) => {
    if (!owned.has(f)) return null;
    const di = faceDir[f];
    const b = bounds[di];
    const p = quadPoint(D, f, clamp01(s), clamp01(t));
    const sx = projectionX(p[0], p[2], WRAP_RADIANS[di]);
    const u = (sx - b.x0) / Math.max(1e-6, b.x1 - b.x0);
    const v = 1 - (p[1] - b.y0) / Math.max(1e-6, b.y1 - b.y0);
    return sampleView(views[di], u, v);
  };
  sampler.ownsFace = (f) => owned.has(f);
  sampler.wrapIndexForFace = (f) => owned.has(f) ? faceDir[f] : -1;
  sampler.meta = Object.freeze({
    ...art.meta,
    wrapMode: 'generated-8-way',
    directions: CLOTHING_WRAP_DEGREES,
  });
  return sampler;
}

/**
 * Draped garments use the same eight generated views, packed into a 4x2 runtime
 * atlas. paperdollViewer gives every render triangle independent UVs, so a robe
 * seam can cross from 315 back to 000 without interpolating through the other
 * six views. The physics mesh remains untouched; only the render copy is split.
 */
export async function buildClassicDrapeTextureCanvas({
  item, race = 'Breton', variant = 0, dye = DYE_COLORS.Blue,
}) {
  if (!item || item.kind !== 'drape') return null;
  const art = await loadIndexedArt({ item, race, variant, dye });
  if (!art) return null;
  const views = generateDirectionalViews(decodedCrop(art));
  const layout = Object.freeze({
    columns: 4,
    rows: 2,
    viewWidth: views[0].width,
    viewHeight: views[0].height,
  });
  return {
    canvas: viewsToAtlasCanvas(views, layout.columns),
    views,
    layout,
    meta: Object.freeze({
      ...art.meta,
      wrapMode: 'generated-8-way',
      directions: CLOTHING_WRAP_DEGREES,
    }),
  };
}

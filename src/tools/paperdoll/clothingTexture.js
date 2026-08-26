// Classic Daggerfall clothing art -> 3D garment texture helpers.
//
// The 3D garment owns the mesh. The original paperdoll bitmap owns the colour.
// This module joins those two truths without shipping ARENA2: TEXTURE.NNN and
// ART_PAL.COL are read from the player's existing dataSource store at runtime.
//
// Daggerfall gives us one front-facing paperdoll image, not an eight-view skin.
// Body-fitted garments therefore sample that bitmap into each exact body-face
// atlas tile. Draped garments keep a continuous 2D cloth surface and receive the
// same source image as a planar texture. Front/back share the authored 2D pattern
// for now; neither path guesses UVs from a proxy cylinder or commits game art.

import { TextureFile } from '../../formats/textureFile.js';
import { DFPalette } from '../../formats/dfPalette.js';
import { getBytes } from '../../scenes/dataSource.js';
import { applyDyeToIndex, DYE_COLORS, DYE_TARGETS } from '../../characters/dyes.js';
import { morphologyOfRace, resolvePaperdollRecord } from '../../characters/paperdollArt.js';

const archiveCache = new Map();
let palettePromise = null;

const clamp01 = (v) => Math.max(0, Math.min(1, v));

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

function rigBounds(D, faces) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const f of faces) {
    const b = f * 12;
    for (let v = 0; v < 4; v++) {
      const x = (D.P[b + v * 3] || 0) / 1000;
      const y = (D.P[b + v * 3 + 1] || 0) / 1000;
      x0 = Math.min(x0, x); x1 = Math.max(x1, x);
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

/**
 * Build a sampler understood by skin.js.
 * sampler(faceIndex, s, t) -> [r,g,b,a] or null.
 */
export async function buildClassicBodyClothingSampler({
  item, D, race = 'Breton', variant = 0, dye = DYE_COLORS.Blue,
}) {
  if (!item || item.kind !== 'body' || !Array.isArray(item.idx) || !item.idx.length) return null;
  const art = await loadIndexedArt({ item, race, variant, dye });
  if (!art) return null;
  const { bitmap, pal, src, meta } = art;
  const rig = rigBounds(D, item.idx);
  if (!rig) return null;

  const owned = new Set(item.idx);
  const sw = Math.max(1, src.x1 - src.x0);
  const sh = Math.max(1, src.y1 - src.y0);
  const rw = Math.max(1e-6, rig.x1 - rig.x0);
  const rh = Math.max(1e-6, rig.y1 - rig.y0);

  const sampler = (f, s, t) => {
    if (!owned.has(f)) return null;
    const p = quadPoint(D, f, clamp01(s), clamp01(t));
    const u = clamp01((p[0] - rig.x0) / rw);
    const v = 1 - clamp01((p[1] - rig.y0) / rh);
    const x = Math.max(src.x0, Math.min(src.x1, Math.round(src.x0 + u * sw)));
    const y = Math.max(src.y0, Math.min(src.y1, Math.round(src.y0 + v * sh)));
    const original = bitmap.data[y * bitmap.width + x];
    if (original === 0 || original === 0xff) return [0, 0, 0, 0];
    const index = applyDyeToIndex(original, dye, DYE_TARGETS.Clothing);
    const c = pal.get(index);
    return [c.r, c.g, c.b, 255];
  };
  sampler.ownsFace = (f) => owned.has(f);
  sampler.meta = meta;
  return sampler;
}

/**
 * Decode the same classic source image into a cropped RGBA canvas for a draped
 * mesh. The canvas is runtime-only and therefore never turns ARENA2 art into a
 * repository asset. Source transparency and the classic clothing dye band are
 * preserved exactly.
 */
export async function buildClassicDrapeTextureCanvas({
  item, race = 'Breton', variant = 0, dye = DYE_COLORS.Blue,
}) {
  if (!item || item.kind !== 'drape') return null;
  const art = await loadIndexedArt({ item, race, variant, dye });
  if (!art) return null;
  const { bitmap, pal, src, meta } = art;
  const w = src.x1 - src.x0 + 1, h = src.y1 - src.y0 + 1;
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, w); canvas.height = Math.max(1, h);
  const ctx = canvas.getContext('2d');
  const out = ctx.createImageData(canvas.width, canvas.height);
  for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) {
    const original = bitmap.data[(src.y0 + y) * bitmap.width + src.x0 + x];
    const o = (y * canvas.width + x) * 4;
    if (original === 0 || original === 0xff) {
      out.data[o + 3] = 0;
      continue;
    }
    const index = applyDyeToIndex(original, dye, DYE_TARGETS.Clothing);
    const c = pal.get(index);
    out.data[o] = c.r; out.data[o + 1] = c.g; out.data[o + 2] = c.b; out.data[o + 3] = 255;
  }
  ctx.putImageData(out, 0, 0);
  return { canvas, meta };
}

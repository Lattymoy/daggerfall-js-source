// Classic Daggerfall armour paperdoll art -> canonical 3D armour surfaces.
//
// The source remains user-owned ARENA2 data. Nothing derived from TEXTURE.NNN
// is committed: records are decoded, de-skewed and wrapped only at runtime.
// Body-fitted pieces sample into the exact body-face atlas; standoff pieces
// (helm + individual pauldrons) receive an eight-direction CanvasTexture atlas.

import { TextureFile } from '../../formats/textureFile.js';
import { DFPalette } from '../../formats/dfPalette.js';
import { getBytes } from '../../scenes/dataSource.js';
import { applyDyeToIndex, DYE_COLORS, DYE_TARGETS } from '../../characters/dyes.js';
import {
  armorArchive,
  armorVariant,
  MATERIAL_FAMILY,
  paperdollRecordOffset,
} from '../../characters/paperdollArt.js';
import { PAPERDOLL_W, PAPERDOLL_ORIGIN } from '../../ui/paperDoll.js';
import {
  canonicalizePaperdollTexture,
  generateDirectionalViews,
  CLOTHING_WRAP_DEGREES,
} from './clothingTexture.js';

const WRAP_RADIANS = CLOTHING_WRAP_DEGREES.map((d) => d * Math.PI / 180);
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
    x0 = Math.min(x0, x); x1 = Math.max(x1, x);
    y0 = Math.min(y0, y); y1 = Math.max(y1, y);
  }
  return x1 >= x0 && y1 >= y0 ? { x0, y0, x1, y1 } : null;
}

function dyeForFamily(family) {
  // Leather + chain use the classic identity metal table. The viewer's Plate
  // family is surfaced as Steel, matching its existing steel procedural ramp.
  return family === MATERIAL_FAMILY.Plate ? DYE_COLORS.Steel : DYE_COLORS.Unchanged;
}

function profileForArmor(item) {
  switch (item?.slot) {
    case 'cuirass': return 'torso';
    case 'greaves': return 'legs';
    case 'boots': return 'foot';
    default: return 'sparse';
  }
}

async function loadIndexedArmorArt({ item, race = 'Breton', gender = 'male', family = MATERIAL_FAMILY.Plate, variant = 0 }) {
  if (!item) return null;
  const archive = armorArchive(gender, race);
  const useVariant = item.variants > 0 ? armorVariant(item.index, family, variant | 0) : 0;
  const record = (item.playerTextureRecord || 0) + useVariant;
  const { tex, pal, name } = await classicArchive(archive);
  const bitmap = tex.getDFBitmap(record, 0);
  if (!bitmap?.width || !bitmap?.height || !bitmap.data?.length) return null;
  const src = sourceBounds(bitmap);
  if (!src) return null;
  const offset = paperdollRecordOffset(tex, archive, record);
  const dye = dyeForFamily(family);
  return {
    bitmap, pal, src, offset, dye,
    meta: Object.freeze({ archive, record, variant: useVariant, family, dye, source: name, offset: { ...offset } }),
  };
}

function decodedCrop(art) {
  const { bitmap, pal, src, dye } = art;
  const width = src.x1 - src.x0 + 1, height = src.y1 - src.y0 + 1;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const original = bitmap.data[(src.y0 + y) * bitmap.width + src.x0 + x];
    if (original === 0 || original === 0xff) continue;
    const index = applyDyeToIndex(original, dye, DYE_TARGETS.WeaponsAndArmor);
    const c = pal.get(index), o = (y * width + x) * 4;
    data[o] = c.r; data[o + 1] = c.g; data[o + 2] = c.b; data[o + 3] = 255;
  }
  const paperdollCentreX = (PAPERDOLL_W - 1) * 0.5;
  const layerX = (art.offset?.x ?? PAPERDOLL_ORIGIN[0]) - PAPERDOLL_ORIGIN[0] + src.x0;
  return {
    width, height, data,
    paperdollMeta: Object.freeze({
      axisX: paperdollCentreX - layerX,
      layerX,
      offsetX: art.offset?.x ?? PAPERDOLL_ORIGIN[0],
      offsetY: art.offset?.y ?? PAPERDOLL_ORIGIN[1],
    }),
  };
}

function imageToCanvas(img) {
  const canvas = document.createElement('canvas');
  canvas.width = img.width; canvas.height = img.height;
  const ctx = canvas.getContext('2d');
  const data = ctx.createImageData(img.width, img.height);
  data.data.set(img.data);
  ctx.putImageData(data, 0, 0);
  return canvas;
}

function viewsToAtlasCanvas(views, columns = 4) {
  const w = views[0].width, h = views[0].height, rows = Math.ceil(views.length / columns);
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

async function buildArmorWrapSet(args) {
  const art = await loadIndexedArmorArt(args);
  if (!art) return null;
  const source = decodedCrop(art);
  const canonical = canonicalizePaperdollTexture(source, profileForArmor(args.item));
  const views = generateDirectionalViews(canonical);
  const atlas = viewsToAtlasCanvas(views, 4);
  return {
    art, source, canonical, views, atlas,
    debug: Object.freeze({ source: imageToCanvas(source), canonical: imageToCanvas(canonical), atlas }),
  };
}

function pixel(img, x, y) {
  x = Math.max(0, Math.min(img.width - 1, Math.round(x)));
  y = Math.max(0, Math.min(img.height - 1, Math.round(y)));
  const o = (y * img.width + x) * 4;
  return [img.data[o], img.data[o + 1], img.data[o + 2], img.data[o + 3]];
}

const projectionX = (x, z, radians) => x * Math.cos(radians) - z * Math.sin(radians);

function bodyProjectionBounds(D, faces, radians) {
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
  return Number.isFinite(x0) && x1 > x0 && y1 > y0 ? { x0, y0, x1, y1 } : null;
}

function quadPoint(D, f, s, t) {
  const b = f * 12;
  const V = (i) => [
    (D.P[b + i * 3] || 0) / 1000,
    (D.P[b + i * 3 + 1] || 0) / 1000,
    (D.P[b + i * 3 + 2] || 0) / 1000,
  ];
  const v0 = V(0), v1 = V(1), v2 = V(2), v3 = V(3);
  let a, bb, c, w0, w1, w2;
  if (t <= s) { a = v0; bb = v1; c = v2; w0 = 1-s; w1 = s-t; w2 = t; }
  else { a = v0; bb = v2; c = v3; w0 = 1-t; w1 = s; w2 = t-s; }
  return [a[0]*w0 + bb[0]*w1 + c[0]*w2, a[1]*w0 + bb[1]*w1 + c[1]*w2, a[2]*w0 + bb[2]*w1 + c[2]*w2];
}

function bodyFaceDirection(D, f) {
  const n = f * 3;
  let nx = (D.N?.[n] || 0) / 127, nz = (D.N?.[n + 2] || 0) / 127;
  if (Math.hypot(nx, nz) < 0.20) {
    const b = f * 12; nx = nz = 0;
    for (let v = 0; v < 4; v++) { nx += D.P[b + v*3] || 0; nz += D.P[b + v*3 + 2] || 0; }
  }
  const angle = Math.atan2(nx, nz);
  return ((Math.round(angle / (Math.PI / 4)) % 8) + 8) % 8;
}

export async function buildClassicBodyArmorSampler({ item, delta, D, race = 'Breton', gender = 'male', family = MATERIAL_FAMILY.Plate, variant = 0 }) {
  if (!item || item.kind !== 'body' || !delta?.idx?.length) return null;
  const wrap = await buildArmorWrapSet({ item, race, gender, family, variant });
  if (!wrap) return null;
  const faces = delta.idx;
  const bounds = WRAP_RADIANS.map((r) => bodyProjectionBounds(D, faces, r));
  if (bounds.some((b) => !b)) return null;
  const owned = new Set(faces);
  const faceDir = new Int8Array(D.n || 0); faceDir.fill(-1);
  for (const f of faces) faceDir[f] = bodyFaceDirection(D, f);
  const sampler = (f, s, t) => {
    if (!owned.has(f)) return null;
    const di = faceDir[f], b = bounds[di];
    const p = quadPoint(D, f, clamp01(s), clamp01(t));
    const sx = projectionX(p[0], p[2], WRAP_RADIANS[di]);
    const u = (sx - b.x0) / Math.max(1e-6, b.x1 - b.x0);
    const v = 1 - (p[1] - b.y0) / Math.max(1e-6, b.y1 - b.y0);
    return pixel(wrap.views[di], clamp01(u) * (wrap.views[di].width - 1), clamp01(v) * (wrap.views[di].height - 1));
  };
  sampler.ownsFace = (f) => owned.has(f);
  sampler.debug = wrap.debug;
  sampler.meta = Object.freeze({
    ...wrap.art.meta,
    wrapMode: 'generated-8-way',
    sourceMode: 'classic-armor-paperdoll-surface',
    canonical: wrap.canonical.canonicalMeta,
    directions: CLOTHING_WRAP_DEGREES,
  });
  return sampler;
}

function packProjectionBounds(pack, radians) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = 0; i < pack.P.length; i += 3) {
    const x = pack.P[i] / 1000, y = pack.P[i + 1] / 1000, z = pack.P[i + 2] / 1000;
    const sx = projectionX(x, z, radians);
    x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
  }
  return { x0, y0, x1, y1 };
}

function packFaceDirection(pack, f) {
  const n = f * 3;
  let nx = (pack.N?.[n] || 0) / 127, nz = (pack.N?.[n + 2] || 0) / 127;
  if (Math.hypot(nx, nz) < 0.20) {
    const b = f * 12; nx = nz = 0;
    for (let v = 0; v < 4; v++) { nx += pack.P[b + v*3] || 0; nz += pack.P[b + v*3 + 2] || 0; }
  }
  const angle = Math.atan2(nx, nz);
  return ((Math.round(angle / (Math.PI / 4)) % 8) + 8) % 8;
}

function packEightWayUV(pack, layout) {
  const TRI = [0,1,2,0,2,3];
  const faces = Math.floor(pack.P.length / 12);
  const uv = new Float32Array(faces * 6 * 2);
  const bounds = WRAP_RADIANS.map((r) => packProjectionBounds(pack, r));
  const eu = 0.5 / Math.max(1, layout.viewWidth), ev = 0.5 / Math.max(1, layout.viewHeight);
  let q = 0;
  for (let f = 0; f < faces; f++) {
    const d = packFaceDirection(pack, f), r = WRAP_RADIANS[d], b = bounds[d];
    const col = d % layout.columns, row = Math.floor(d / layout.columns);
    for (const vi of TRI) {
      const p = f * 12 + vi * 3;
      const x = pack.P[p] / 1000, y = pack.P[p + 1] / 1000, z = pack.P[p + 2] / 1000;
      let u = (projectionX(x, z, r) - b.x0) / Math.max(1e-6, b.x1 - b.x0);
      let v = 1 - (y - b.y0) / Math.max(1e-6, b.y1 - b.y0);
      u = eu + clamp01(u) * (1 - 2*eu);
      v = ev + clamp01(v) * (1 - 2*ev);
      uv[q++] = (col + u) / layout.columns;
      uv[q++] = ((layout.rows - 1 - row) + v) / layout.rows;
    }
  }
  return uv;
}

export async function buildClassicArmorPieceTexture({ item, pack, race = 'Breton', gender = 'male', family = MATERIAL_FAMILY.Plate, variant = 0 }) {
  if (!item || item.kind !== 'piece' || !pack?.P?.length) return null;
  const wrap = await buildArmorWrapSet({ item, race, gender, family, variant });
  if (!wrap) return null;
  const layout = Object.freeze({ columns: 4, rows: 2, viewWidth: wrap.views[0].width, viewHeight: wrap.views[0].height });
  return {
    canvas: wrap.atlas,
    layout,
    uv: packEightWayUV(pack, layout),
    debug: wrap.debug,
    meta: Object.freeze({
      ...wrap.art.meta,
      wrapMode: 'generated-8-way-piece',
      sourceMode: 'classic-armor-paperdoll-surface',
      canonical: wrap.canonical.canonicalMeta,
      directions: CLOTHING_WRAP_DEGREES,
    }),
  };
}

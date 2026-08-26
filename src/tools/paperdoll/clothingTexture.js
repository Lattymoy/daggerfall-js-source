// Classic Daggerfall paperdoll art -> canonical 3D garment surface -> 8 wraps.
//
// IMPORTANT: the source bitmap is NOT a front-view UV texture. It is presentation
// art drawn for Daggerfall's skewed 2D paperdoll, and its transparent pixels also
// encode holes where the OLD paperdoll body was meant to show through. Neither
// fact belongs on a closed 3D polygon surface.
//
// The runtime pipeline therefore has two explicit ownership stages:
//   paperdoll pixels -> canonical material field
//     * unwrap every occupied source row into centred 0..1 garment space;
//       this removes the paperdoll shear/perspective instead of treating it as a
//       camera-orthographic front view.
//     * reconstruct transparent gaps from neighbouring cloth pixels. Geometry,
//       not source alpha, owns neck/arm/leg openings and the outer silhouette.
//   canonical material field -> eight generated views -> exact polygon owner.
//
// Nothing derived from ARENA2 is committed: TEXTURE.NNN and ART_PAL.COL are read
// from the player's existing dataSource store and every repaired/generated pixel
// exists only in memory.

import { TextureFile } from '../../formats/textureFile.js';
import { DFPalette } from '../../formats/dfPalette.js';
import { getBytes } from '../../scenes/dataSource.js';
import { applyDyeToIndex, DYE_COLORS, DYE_TARGETS } from '../../characters/dyes.js';
import { morphologyOfRace, resolvePaperdollRecord, paperdollRecordOffset } from '../../characters/paperdollArt.js';
import { PAPERDOLL_W, PAPERDOLL_ORIGIN } from '../../ui/paperDoll.js';

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
  const offset = paperdollRecordOffset(tex, archive, record);
  return {
    bitmap, pal, src, dye, offset,
    meta: Object.freeze({ archive, record, variant: useVariant, source: name, offset: { ...offset } }),
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
  // Do NOT throw away the classic placement when trimming transparent margins.
  // Every clothing record was authored against the same 110px paperdoll frame;
  // its baked offset tells us where the character's anatomical centreline lies
  // inside this particular crop. That is the missing front/back anchor.
  const paperdollCentreX = (PAPERDOLL_W - 1) * 0.5;
  const layerX = (art.offset?.x ?? PAPERDOLL_ORIGIN[0]) - PAPERDOLL_ORIGIN[0] + src.x0;
  const axisX = paperdollCentreX - layerX;
  return {
    width, height, data,
    paperdollMeta: Object.freeze({
      axisX, layerX,
      offsetX: art.offset?.x ?? PAPERDOLL_ORIGIN[0],
      offsetY: art.offset?.y ?? PAPERDOLL_ORIGIN[1],
    }),
  };
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

// PAPERDOLL ART IS A PRESENTATION LAYER, NOT A SURFACE MAP.
//
// V1 removed the skew by stretching every occupied row to the full canonical
// width. That fixed diagonal drift but also changed the artwork's horizontal
// proportions row-by-row: narrow straps became broad bands and local details
// expanded whenever the classic silhouette narrowed.
//
// V2 removes ONLY the paperdoll registration error. We measure the centre of
// every occupied row, translate that row onto one common centreline, preserve
// its original pixel scale, then edge-pad the material field. Interior alpha is
// repaired from nearby authored cloth. The result is still opaque because the
// 3D geometry owns openings/silhouette, but authored widths and motifs survive.
const SOURCE_PROFILE_PATTERNS = Object.freeze([
  [/cloak/i, 'cloak'],
  [/(robe|dress|skirt|toga|surcoat|kimono|mummy|wrap|sash)/i, 'drape'],
  [/(strap|armband|brassiere|loincloth|sandal)/i, 'sparse'],
  [/(boot|shoe)/i, 'foot'],
  [/pants/i, 'legs'],
  [/(open tunic|vest)/i, 'open-torso'],
]);

export function clothingSourceProfile(item) {
  const name = item?.name || '';
  for (const [re, profile] of SOURCE_PROFILE_PATTERNS) if (re.test(name)) return profile;
  return 'torso';
}

export function canonicalizePaperdollTexture(src, profile = 'generic') {
  if (!src?.width || !src?.height || !src.data?.length) return src;
  const spans = new Array(src.height);
  const occupied = [];
  const centres = [];
  for (let y = 0; y < src.height; y++) {
    spans[y] = rowSpan(src, y);
    if (!spans[y]) continue;
    occupied.push(y);
    centres.push((spans[y][0] + spans[y][1]) * 0.5);
  }
  if (!occupied.length) return src;

  const quantile = (values, q) => {
    if (!values.length) return 0;
    const a = values.slice().sort((x, y) => x - y);
    return a[Math.max(0, Math.min(a.length - 1, Math.round((a.length - 1) * q)))];
  };
  const sorted = centres.slice().sort((a, b) => a - b);
  const sourceCentre = sorted[Math.floor(sorted.length * 0.5)];
  const canonicalCentre = (src.width - 1) * 0.5;
  const shearPx = Math.max(...centres) - Math.min(...centres);

  const nearestOccupiedRow = (y) => {
    if (spans[y]) return y;
    for (let d = 1; d < src.height; d++) {
      if (y - d >= 0 && spans[y - d]) return y - d;
      if (y + d < src.height && spans[y + d]) return y + d;
    }
    return occupied[0];
  };

  const out = {
    width: src.width,
    height: src.height,
    data: new Uint8ClampedArray(src.data.length),
  };
  let repairedPixels = 0;
  let borrowedRows = 0;
  let edgePaddedPixels = 0;

  const torsoFront = profile === 'torso' || profile === 'open-torso';
  if (!torsoFront) {
    // V2 remains the right rule for drapes, legs, boots and sparse accessories:
    // remove row shear by translation only; never invent bilateral torso data.
    for (let y = 0; y < out.height; y++) {
      const sy = nearestOccupiedRow(y);
      if (sy !== y) borrowedRows++;
      const [x0, x1] = spans[sy];
      const rowCentre = (x0 + x1) * 0.5;
      const rowOffset = rowCentre - canonicalCentre;
      for (let x = 0; x < out.width; x++) {
        const sxUnclamped = x + rowOffset;
        const sx = Math.max(x0, Math.min(x1, sxUnclamped));
        if (sx !== sxUnclamped) edgePaddedPixels++;
        const raw = pixel(src, sx, sy);
        const c = raw[3] ? raw : nearestOpaqueInRow(src, sy, Math.round(sx), x0, x1);
        const o = (y * out.width + x) * 4;
        if (!raw[3]) repairedPixels++;
        out.data[o] = c[3] ? c[0] : 0;
        out.data[o + 1] = c[3] ? c[1] : 0;
        out.data[o + 2] = c[3] ? c[2] : 0;
        out.data[o + 3] = 255;
      }
    }
    out.canonicalMeta = Object.freeze({
      mode: 'paperdoll-surface-v2',
      registration: 'row-centre-translate',
      widthPreserved: true,
      sourceCentre,
      canonicalCentre,
      shearPx,
      profile,
      alphaOwner: 'geometry',
      repairedPixels,
      borrowedRows,
      edgePaddedPixels,
    });
    return out;
  }

  // V3 TORSO FRONT RECONSTRUCTION.
  //
  // A shirt record is not a camera-facing photograph: it is a layer positioned
  // over Daggerfall's angled paperdoll. The record OFFSET tells us where the
  // doll's real body centreline falls inside the cropped sprite. Use that fixed
  // anatomical anchor to distinguish near/far halves. Row-centre drift is still
  // removed, but we no longer mistake the visible near side for "the front".
  const requestedAxis = src.paperdollMeta?.axisX;
  const axisFromPaperdoll = Number.isFinite(requestedAxis) &&
    requestedAxis >= -src.width * 0.25 && requestedAxis <= src.width * 1.25;
  let anatomicalAxis = axisFromPaperdoll ? requestedAxis : sourceCentre;

  // If the baked axis misses almost the entire authored silhouette (pathological
  // record/offset), fail soft to V2's robust silhouette centre rather than mirror
  // nonsense. Normal shirt/tunic records cross the axis on many rows.
  let crossing = 0;
  for (const y of occupied) {
    const [x0, x1] = spans[y];
    if (anatomicalAxis >= x0 - 1 && anatomicalAxis <= x1 + 1) crossing++;
  }
  if (crossing < Math.max(2, Math.floor(occupied.length * 0.20))) anatomicalAxis = sourceCentre;

  // V4: estimate perspective from the CHEST, not the whole sprite. The top
  // shoulder/neck cutout and the lower hem are presentation-heavy and were
  // polluting the side-bias decision. Use the central vertical band to decide
  // which authored half is trustworthy, while still applying the correction to
  // every row so belts/trim keep their original Y placement.
  const bandLoIndex = Math.floor((occupied.length - 1) * 0.18);
  const bandHiIndex = Math.ceil((occupied.length - 1) * 0.82);
  const analysisRows = occupied.slice(bandLoIndex, bandHiIndex + 1);
  const analysisCentres = analysisRows.map((y) => (spans[y][0] + spans[y][1]) * 0.5).sort((a, b) => a - b);
  const analysisSourceCentre = analysisCentres[Math.floor(analysisCentres.length * 0.5)] ?? sourceCentre;
  const axisShift = anatomicalAxis - analysisSourceCentre;
  const leftExtents = [], rightExtents = [];
  let leftOpaque = 0, rightOpaque = 0;
  for (const y of analysisRows) {
    const [x0, x1] = spans[y];
    const rowCentre = (x0 + x1) * 0.5;
    const rowAxis = Math.max(x0, Math.min(x1, rowCentre + axisShift));
    if (rowAxis - x0 > 0.5) leftExtents.push(rowAxis - x0);
    if (x1 - rowAxis > 0.5) rightExtents.push(x1 - rowAxis);
    for (let x = x0; x <= x1; x++) {
      if (!src.data[(y * src.width + x) * 4 + 3]) continue;
      if (x < rowAxis) leftOpaque++;
      else if (x > rowAxis) rightOpaque++;
    }
  }
  const leftExtent = Math.max(1, quantile(leftExtents, 0.70));
  const rightExtent = Math.max(1, quantile(rightExtents, 0.70));
  const weak = Math.max(1, Math.min(leftOpaque, rightOpaque));
  const sideBias = Math.max(leftOpaque, rightOpaque) / weak;
  const dominantSide = rightOpaque >= leftOpaque ? 'right' : 'left';

  // V5: perspective correction is continuous, not a binary threshold. Many
  // shirts contain enough far-side pixels to miss V4's 1.65 cutoff but still
  // visibly read as the oblique paperdoll layer. Closed torso garments begin
  // recovering early; open tunics/vests preserve more intentional asymmetry.
  const openTorso = profile === 'open-torso';
  const recoveryLo = openTorso ? 1.28 : 1.08;
  const recoveryHi = openTorso ? 1.95 : 1.55;
  const frontRecovery = clamp01((sideBias - recoveryLo) / Math.max(1e-6, recoveryHi - recoveryLo));
  const mirrorDominantHalf = frontRecovery >= 0.985;
  const halfL = Math.max(1, canonicalCentre);
  const halfR = Math.max(1, (out.width - 1) - canonicalCentre);

  for (let y = 0; y < out.height; y++) {
    const sy = nearestOccupiedRow(y);
    if (sy !== y) borrowedRows++;
    const [x0, x1] = spans[sy];
    const rowCentre = (x0 + x1) * 0.5;
    const rowAxis = Math.max(x0, Math.min(x1, rowCentre + axisShift));
    for (let x = 0; x < out.width; x++) {
      const d = Math.abs(x - canonicalCentre) / (x <= canonicalCentre ? halfL : halfR);
      const dominantSample = dominantSide === 'right'
        ? rowAxis + d * rightExtent
        : rowAxis - d * leftExtent;
      const splitSample = x <= canonicalCentre
        ? rowAxis - d * leftExtent
        : rowAxis + d * rightExtent;
      // Mildly oblique records get a mild correction; strongly one-sided records
      // converge on the proven dominant-half reconstruction used by V3/V4.
      const sxUnclamped = splitSample * (1 - frontRecovery) + dominantSample * frontRecovery;
      const sx = Math.max(x0, Math.min(x1, sxUnclamped));
      if (sx !== sxUnclamped) edgePaddedPixels++;
      const raw = pixel(src, sx, sy);
      const c = raw[3] ? raw : nearestOpaqueInRow(src, sy, Math.round(sx), x0, x1);
      const o = (y * out.width + x) * 4;
      if (!raw[3]) repairedPixels++;
      out.data[o] = c[3] ? c[0] : 0;
      out.data[o + 1] = c[3] ? c[1] : 0;
      out.data[o + 2] = c[3] ? c[2] : 0;
      out.data[o + 3] = 255;
    }
  }
  out.canonicalMeta = Object.freeze({
    mode: 'paperdoll-surface-v5',
    registration: 'paperdoll-axis-adaptive-front-reconstruct',
    frontReconstruction: mirrorDominantHalf
      ? 'dominant-half-mirror'
      : frontRecovery > 0.015 ? 'adaptive-perspective-blend' : 'split-perspective-rectify',
    frontRecovery,
    recoveryRange: [recoveryLo, recoveryHi],
    sourceAxis: axisFromPaperdoll ? 'paperdoll-offset' : 'silhouette-median',
    anatomicalAxis,
    analysisSourceCentre,
    analysisBand: [analysisRows[0], analysisRows[analysisRows.length - 1]],
    analysisRowCount: analysisRows.length,
    axisShift,
    leftExtent,
    rightExtent,
    sideBias,
    dominantSide,
    shearPx,
    profile,
    alphaOwner: 'geometry',
    repairedPixels,
    borrowedRows,
    edgePaddedPixels,
  });
  return out;
}

function buildCanonicalWrapSet(art, item) {
  const source = decodedCrop(art);
  const profile = clothingSourceProfile(item);
  const canonical = canonicalizePaperdollTexture(source, profile);
  const views = generateDirectionalViews(canonical);
  const debug = {
    source: viewToCanvas(source),
    canonical: viewToCanvas(canonical),
    atlas: viewsToAtlasCanvas(views, 4),
    meta: canonical.canonicalMeta,
  };
  return { source, canonical, views, debug };
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

export function generateDirectionalViews(front) {
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
  const { canonical, views, debug } = buildCanonicalWrapSet(art, item);
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
  sampler.debug = debug;
  sampler.meta = Object.freeze({
    ...art.meta,
    wrapMode: 'generated-8-way',
    sourceMode: 'canonical-paperdoll-surface',
    canonical: canonical.canonicalMeta,
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
  const { canonical, views, debug } = buildCanonicalWrapSet(art, item);
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
    debug,
    meta: Object.freeze({
      ...art.meta,
      wrapMode: 'generated-8-way',
      sourceMode: 'canonical-paperdoll-surface',
      canonical: canonical.canonicalMeta,
      directions: CLOTHING_WRAP_DEGREES,
    }),
  };
}

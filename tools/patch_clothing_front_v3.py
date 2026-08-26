from pathlib import Path

# ---------------------------------------------------------------------------
# paperdollArt.js: centralize the one classic bad-offset law so both the real
# 2D paperdoll and the 3D clothing reconstruction use the identical placement.
# ---------------------------------------------------------------------------
p = Path('src/characters/paperdollArt.js')
s = p.read_text()
anchor = "export function resolvePaperdollRecord(template, variant = 0) {\n  if (template.variants > 0) {\n    let start = template.playerTextureRecord;\n    if (isCloak(template)) start += 1;\n    return start + variant;\n  }\n  return template.playerTextureRecord;\n}\n"
assert s.count(anchor) == 1
helper = anchor + "\n/** PaperDollRenderer's baked record offset, including DFU's known TEXTURE.237 fix. */\nexport function paperdollRecordOffset(textureFile, archive, record) {\n  if (archive === 237 && (record === 52 || record === 54)) return { x: 237, y: 43 };\n  return textureFile.getOffset(record);\n}\n"
s = s.replace(anchor, helper, 1)
p.write_text(s)

# ---------------------------------------------------------------------------
# paperDoll.js: consume that single offset law instead of carrying its own copy.
# ---------------------------------------------------------------------------
p = Path('src/ui/paperDoll.js')
s = p.read_text()
import_anchor = "import { raceArt, FACES_PER_RACE, raceByKey } from '../systems/races.js';   // S3c/U9: all eight races\n"
assert s.count(import_anchor) == 1
s = s.replace(import_anchor, import_anchor + "import { paperdollRecordOffset } from '../characters/paperdollArt.js';\n", 1)
offset_old = "    const off = (archive === 237 && (record === 52 || record === 54)) ? { x: 237, y: 43 } : tex.getOffset(record);\n"
assert s.count(offset_old) == 1
s = s.replace(offset_old, "    const off = paperdollRecordOffset(tex, archive, record);\n", 1)
p.write_text(s)

# ---------------------------------------------------------------------------
# clothingTexture.js: preserve the original paperdoll placement anchor and use
# it to reconstruct torso art as a true front-facing material field.
# ---------------------------------------------------------------------------
p = Path('src/tools/paperdoll/clothingTexture.js')
s = p.read_text()
old_import = "import { morphologyOfRace, resolvePaperdollRecord } from '../../characters/paperdollArt.js';\n"
assert s.count(old_import) == 1
s = s.replace(old_import,
              "import { morphologyOfRace, resolvePaperdollRecord, paperdollRecordOffset } from '../../characters/paperdollArt.js';\n"
              "import { PAPERDOLL_W, PAPERDOLL_ORIGIN } from '../../ui/paperDoll.js';\n", 1)

old_load = """  const { tex, pal, name } = await classicArchive(archive);\n  const bitmap = tex.getDFBitmap(record, 0);\n  if (!bitmap || !bitmap.width || !bitmap.height || !bitmap.data?.length) return null;\n  const src = sourceBounds(bitmap);\n  if (!src) return null;\n  return {\n    bitmap, pal, src, dye,\n    meta: Object.freeze({ archive, record, variant: useVariant, source: name }),\n  };\n"""
assert s.count(old_load) == 1
new_load = """  const { tex, pal, name } = await classicArchive(archive);\n  const bitmap = tex.getDFBitmap(record, 0);\n  if (!bitmap || !bitmap.width || !bitmap.height || !bitmap.data?.length) return null;\n  const src = sourceBounds(bitmap);\n  if (!src) return null;\n  const offset = paperdollRecordOffset(tex, archive, record);\n  return {\n    bitmap, pal, src, dye, offset,\n    meta: Object.freeze({ archive, record, variant: useVariant, source: name, offset: { ...offset } }),\n  };\n"""
s = s.replace(old_load, new_load, 1)

old_crop_return = "  return { width, height, data };\n}\n\nfunction pixel(img, x, y) {\n"
assert s.count(old_crop_return) == 1
new_crop_return = """  // Do NOT throw away the classic placement when trimming transparent margins.\n  // Every clothing record was authored against the same 110px paperdoll frame;\n  // its baked offset tells us where the character's anatomical centreline lies\n  // inside this particular crop. That is the missing front/back anchor.\n  const paperdollCentreX = (PAPERDOLL_W - 1) * 0.5;\n  const layerX = (art.offset?.x ?? PAPERDOLL_ORIGIN[0]) - PAPERDOLL_ORIGIN[0] + src.x0;\n  const axisX = paperdollCentreX - layerX;\n  return {\n    width, height, data,\n    paperdollMeta: Object.freeze({\n      axisX, layerX,\n      offsetX: art.offset?.x ?? PAPERDOLL_ORIGIN[0],\n      offsetY: art.offset?.y ?? PAPERDOLL_ORIGIN[1],\n    }),\n  };\n}\n\nfunction pixel(img, x, y) {\n"""
s = s.replace(old_crop_return, new_crop_return, 1)

start = s.index('export function canonicalizePaperdollTexture(src, profile = \'generic\') {')
end = s.index('\nfunction buildCanonicalWrapSet(art, item) {', start)
new_canonical = r'''export function canonicalizePaperdollTexture(src, profile = 'generic') {
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

  // Preserve each row's local lean correction, but hold the anatomical axis at
  // one constant displacement from the silhouette centre. This separates
  // "paperdoll pose shear" from "which half of the torso is actually front".
  const axisShift = anatomicalAxis - sourceCentre;
  const leftExtents = [], rightExtents = [];
  let leftOpaque = 0, rightOpaque = 0;
  for (const y of occupied) {
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
  const mirrorDominantHalf = sideBias >= 1.65;
  const halfL = Math.max(1, canonicalCentre);
  const halfR = Math.max(1, (out.width - 1) - canonicalCentre);

  for (let y = 0; y < out.height; y++) {
    const sy = nearestOccupiedRow(y);
    if (sy !== y) borrowedRows++;
    const [x0, x1] = spans[sy];
    const rowCentre = (x0 + x1) * 0.5;
    const rowAxis = Math.max(x0, Math.min(x1, rowCentre + axisShift));
    for (let x = 0; x < out.width; x++) {
      let sxUnclamped;
      if (mirrorDominantHalf) {
        // A strongly one-sided paperdoll presentation has too little far-side
        // information to call both halves "front". Use the authored near half
        // as material evidence for BOTH front halves. Geometry restores the
        // silhouette; this reconstruction restores orientation.
        const d = Math.abs(x - canonicalCentre) / (x <= canonicalCentre ? halfL : halfR);
        sxUnclamped = dominantSide === 'right'
          ? rowAxis + d * rightExtent
          : rowAxis - d * leftExtent;
      } else if (x <= canonicalCentre) {
        const d = (canonicalCentre - x) / halfL;
        sxUnclamped = rowAxis - d * leftExtent;
      } else {
        const d = (x - canonicalCentre) / halfR;
        sxUnclamped = rowAxis + d * rightExtent;
      }
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
    mode: 'paperdoll-surface-v3',
    registration: 'paperdoll-axis-front-reconstruct',
    frontReconstruction: mirrorDominantHalf ? 'dominant-half-mirror' : 'split-perspective-rectify',
    sourceAxis: axisFromPaperdoll ? 'paperdoll-offset' : 'silhouette-median',
    anatomicalAxis,
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
'''
s = s[:start] + new_canonical + s[end:]

# Carry the reconstruction diagnostics to the existing runtime-only QA panel.
debug_old = """  const debug = {\n    source: viewToCanvas(source),\n    canonical: viewToCanvas(canonical),\n    atlas: viewsToAtlasCanvas(views, 4),\n  };\n"""
assert s.count(debug_old) == 1
debug_new = """  const debug = {\n    source: viewToCanvas(source),\n    canonical: viewToCanvas(canonical),\n    atlas: viewsToAtlasCanvas(views, 4),\n    meta: canonical.canonicalMeta,\n  };\n"""
s = s.replace(debug_old, debug_new, 1)
p.write_text(s)

# ---------------------------------------------------------------------------
# Synthetic probe: retain V2 guarantees and add a side-biased torso whose
# correct front is recoverable only when the paperdoll offset axis is respected.
# ---------------------------------------------------------------------------
p = Path('tools/clothingCanonicalProbe.mjs')
s = p.read_text()
append_anchor = "console.log('clothing canonical probe: PASS');\n"
assert s.count(append_anchor) == 1
extra = r'''
// A shirt whose crop is heavily right-biased around the REAL paperdoll body
// axis. This is the case row-centering alone cannot solve: it removes shear but
// still presents the near side as if it were a frontal texture.
const tw = 24, th = 10, td = new Uint8ClampedArray(tw * th * 4);
for (let y = 0; y < th; y++) {
  for (let x = 6; x <= 20; x++) {
    const o = (y * tw + x) * 4;
    if (y === 6) { td[o] = 220; td[o+1] = 45; td[o+2] = 35; } // belt band
    else {
      const d = Math.abs(x - 8);
      td[o] = 35 + d * 5; td[o+1] = 80 + d * 4; td[o+2] = 170 - d * 3;
    }
    td[o+3] = 255;
  }
}
const torso = canonicalizePaperdollTexture({
  width: tw, height: th, data: td,
  paperdollMeta: { axisX: 8 },
}, 'torso');
assert.equal(torso.canonicalMeta.mode, 'paperdoll-surface-v3');
assert.equal(torso.canonicalMeta.sourceAxis, 'paperdoll-offset');
assert.equal(torso.canonicalMeta.frontReconstruction, 'dominant-half-mirror');
assert.equal(torso.canonicalMeta.dominantSide, 'right');
assert.ok(torso.canonicalMeta.sideBias > 1.65);
// Equal distances from the reconstructed front centre must now see the same
// material progression instead of one side of the classic paperdoll sprite.
assert.deepEqual(rgb(torso, 3, 3), rgb(torso, tw - 1 - 3, 3));
// Horizontal belt evidence stays on its authored Y row and becomes a frontal
// band rather than a clue that the whole shirt is wrapped around one side.
for (let x = 0; x < tw; x++) {
  const [r,g,b] = rgb(torso, x, 6);
  assert.ok(r > 180 && g < 80 && b < 80, 'belt row must remain a frontal horizontal band');
}

'''
s = s.replace(append_anchor, extra + append_anchor, 1)
p.write_text(s)

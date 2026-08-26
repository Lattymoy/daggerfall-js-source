from pathlib import Path

p = Path('src/tools/paperdoll/clothingTexture.js')
s = p.read_text()

old = '''// Classic Daggerfall clothing art -> generated 8-direction garment wraps.
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
'''
new = '''// Classic Daggerfall paperdoll art -> canonical 3D garment surface -> 8 wraps.
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
'''
assert s.count(old) == 1, 'header anchor drifted'
s = s.replace(old, new, 1)

anchor = '''function nearestOpaqueInRow(img, y, x, x0, x1) {
  const c = pixel(img, x, y);
  if (c[3]) return c;
  const max = Math.max(x - x0, x1 - x);
  for (let d = 1; d <= max; d++) {
    if (x - d >= x0) { const a = pixel(img, x - d, y); if (a[3]) return a; }
    if (x + d <= x1) { const b = pixel(img, x + d, y); if (b[3]) return b; }
  }
  return [0, 0, 0, 0];
}
'''
insert = anchor + '''
// PAPERDOLL ART IS A PRESENTATION LAYER, NOT A SURFACE MAP.
//
// One source row can be shifted several pixels relative to the next because the
// classic doll is drawn on a slant. More importantly, transparent runs inside a
// shirt/robe often mean "show the 2D body sprite here", not "cut a hole in the
// cloth". The 3D garment already has exact face ownership, so carrying either
// artifact forward creates diagonal texture drift and literal paperdoll-shaped
// holes in the polygon mesh.
//
// Canonical space intentionally ignores the source silhouette. Every non-empty
// source row is stretched from its own [firstOpaque,lastOpaque] span into 0..1.
// This simultaneously removes row shear and foreshortening. Transparent samples
// inside that span are repaired from the nearest authored cloth pixel. Empty rows
// borrow the nearest non-empty row. The result is an OPAQUE material field; the
// mesh is the only authority for silhouette/openings from this point onward.
export function canonicalizePaperdollTexture(src) {
  if (!src?.width || !src?.height || !src.data?.length) return src;
  const spans = new Array(src.height);
  const occupied = [];
  for (let y = 0; y < src.height; y++) {
    spans[y] = rowSpan(src, y);
    if (spans[y]) occupied.push(y);
  }
  if (!occupied.length) return src;

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
  for (let y = 0; y < out.height; y++) {
    const sy = nearestOccupiedRow(y);
    if (sy !== y) borrowedRows++;
    const [x0, x1] = spans[sy];
    const sw = Math.max(1, x1 - x0);
    for (let x = 0; x < out.width; x++) {
      const u = out.width <= 1 ? 0.5 : x / (out.width - 1);
      const sx = x0 + u * sw;
      const raw = pixel(src, sx, sy);
      const c = raw[3] ? raw : nearestOpaqueInRow(src, sy, Math.round(sx), x0, x1);
      const o = (y * out.width + x) * 4;
      if (!raw[3]) repairedPixels++;
      // A pathological source row should not punch a runtime hole. If its local
      // repair still found nothing, use black cloth; geometry still owns alpha.
      out.data[o] = c[3] ? c[0] : 0;
      out.data[o + 1] = c[3] ? c[1] : 0;
      out.data[o + 2] = c[3] ? c[2] : 0;
      out.data[o + 3] = 255;
    }
  }
  out.canonicalMeta = Object.freeze({
    mode: 'paperdoll-surface-v1',
    rowUnwrap: true,
    alphaOwner: 'geometry',
    repairedPixels,
    borrowedRows,
  });
  return out;
}

function buildCanonicalWrapSet(art) {
  const canonical = canonicalizePaperdollTexture(decodedCrop(art));
  return { canonical, views: generateDirectionalViews(canonical) };
}
'''
assert s.count(anchor) == 1, 'nearestOpaqueInRow anchor drifted'
s = s.replace(anchor, insert, 1)

old = 'function generateDirectionalViews(front) {'
new = 'export function generateDirectionalViews(front) {'
assert s.count(old) == 1, 'generateDirectionalViews anchor drifted'
s = s.replace(old, new, 1)

old = '''  const art = await loadIndexedArt({ item, race, variant, dye });
  if (!art) return null;
  const views = generateDirectionalViews(decodedCrop(art));
  const bounds = WRAP_RADIANS.map((r) => projectionBounds(D, item.idx, r));
'''
new = '''  const art = await loadIndexedArt({ item, race, variant, dye });
  if (!art) return null;
  const { canonical, views } = buildCanonicalWrapSet(art);
  const bounds = WRAP_RADIANS.map((r) => projectionBounds(D, item.idx, r));
'''
assert s.count(old) == 1, 'body wrap anchor drifted'
s = s.replace(old, new, 1)

old = '''  sampler.meta = Object.freeze({
    ...art.meta,
    wrapMode: 'generated-8-way',
    directions: CLOTHING_WRAP_DEGREES,
  });
'''
new = '''  sampler.meta = Object.freeze({
    ...art.meta,
    wrapMode: 'generated-8-way',
    sourceMode: 'canonical-paperdoll-surface',
    canonical: canonical.canonicalMeta,
    directions: CLOTHING_WRAP_DEGREES,
  });
'''
assert s.count(old) == 1, 'body meta anchor drifted'
s = s.replace(old, new, 1)

old = '''  const art = await loadIndexedArt({ item, race, variant, dye });
  if (!art) return null;
  const views = generateDirectionalViews(decodedCrop(art));
  const layout = Object.freeze({
'''
new = '''  const art = await loadIndexedArt({ item, race, variant, dye });
  if (!art) return null;
  const { canonical, views } = buildCanonicalWrapSet(art);
  const layout = Object.freeze({
'''
assert s.count(old) == 1, 'drape wrap anchor drifted'
s = s.replace(old, new, 1)

old = '''    meta: Object.freeze({
      ...art.meta,
      wrapMode: 'generated-8-way',
      directions: CLOTHING_WRAP_DEGREES,
    }),
'''
new = '''    meta: Object.freeze({
      ...art.meta,
      wrapMode: 'generated-8-way',
      sourceMode: 'canonical-paperdoll-surface',
      canonical: canonical.canonicalMeta,
      directions: CLOTHING_WRAP_DEGREES,
    }),
'''
assert s.count(old) == 1, 'drape meta anchor drifted'
s = s.replace(old, new, 1)

p.write_text(s)

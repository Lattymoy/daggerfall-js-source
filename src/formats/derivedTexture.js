// WD2 (2026-09-25): A MOD'S SPRITE THAT IS A CLASSIC RECORD, OR ONE WITH
// THE AUTHOR'S EDITS ON IT - REBUILT FROM THE PLAYER'S OWN ART.
//
// Detailed Ships (Cliffworms) ships thirteen pictures under two archives
// of its own, 1210 and 1230. Measured against every record of every
// TEXTURE file (tools/detailedShipsAssets.mjs), five of them are classic
// records exported whole - a map, a loaf, a scroll - moved to the new
// archive so an xml can size them; four more are classic records with
// the author's paint on them (fruit in an empty basket, a potion's
// colour, a cork). A render of game data IS game data (Port-Doctrine),
// so none of those nine are carried: the spec below names the classic
// record, where it stands on the picture, and the pixels the author
// changed, and the picture is rebuilt from the player's own ARENA2 when
// the archive loads (systems/textureReplacement.js `build`). The author's
// own drawings - which no classic record is - ship as the files they are.
//
// A spec:
//   { from: [archive, record, frame?],    the classic record, frame 0 by default
//     size: [width, height],              the picture (default: the record's)
//     at: [x, y],                         where the record's top-left lands (default 0, 0)
//     also: [{ from, at }, ...],          BET1: more classic records on the same picture, each laid over what is
//                                         below it at its own spot (its clear pixels leave it) - Betony Restored's
//                                         shelves are a classic bottle and a goblet stood on the author's plank
//     edits: [[x, y, 'rrggbbaa'], ...] }  the author's pixels, top-down, laid over it
// A pixel the records do not cover and no edit names is clear.

const hex = (s, i) => Number.parseInt(s.slice(i, i + 2), 16);

/**
 * Build the picture. `classicRgba(archive, record, frame)` resolves to a
 * top-down RGBA picture of the player's record (index 0 clear), the one
 * shape a decoded PNG has too.
 * @returns {Promise<{width:number, height:number, data:Uint8Array}>}
 */
export async function buildDerivedPicture(spec, classicRgba) {
  const read = async ([archive, record, frame = 0]) => {
    const src = await classicRgba(archive, record, frame);
    if (!src?.width) throw new Error(`derived texture: ${archive}_${record}-${frame} is not in the player's data`);
    return src;
  };
  const src = await read(spec.from);
  const also = [];
  for (const layer of spec.also ?? []) also.push(await read(layer.from));   // BET1
  return composeDerivedPicture(spec, src, also);
}

/** BET1: one more classic record over the picture at (ax, ay) - its opaque pixels only. */
function layOver(data, w, h, src, [ax, ay]) {
  for (let y = 0; y < src.height; y++) {
    const ty = y + ay;
    if (ty < 0 || ty >= h) continue;
    for (let x = 0; x < src.width; x++) {
      const tx = x + ax;
      const s = (y * src.width + x) * 4;
      if (tx < 0 || tx >= w || src.data[s + 3] === 0) continue;
      const d = (ty * w + tx) * 4;
      data[d] = src.data[s]; data[d + 1] = src.data[s + 1]; data[d + 2] = src.data[s + 2]; data[d + 3] = src.data[s + 3];
    }
  }
}

/** The synchronous half, over the records already read (`also` - BET1 - the spec's further layers, in its order). */
export function composeDerivedPicture(spec, src, also = []) {
  const [w, h] = spec.size ?? [src.width, src.height];
  const [ax, ay] = spec.at ?? [0, 0];
  const data = new Uint8Array(w * h * 4);
  for (let y = 0; y < src.height; y++) {
    const ty = y + ay;
    if (ty < 0 || ty >= h) continue;
    for (let x = 0; x < src.width; x++) {
      const tx = x + ax;
      if (tx < 0 || tx >= w) continue;
      const s = (y * src.width + x) * 4, d = (ty * w + tx) * 4;
      data[d] = src.data[s]; data[d + 1] = src.data[s + 1]; data[d + 2] = src.data[s + 2]; data[d + 3] = src.data[s + 3];
    }
  }
  const layers = spec.also ?? [];
  if (layers.length !== also.length) throw new Error(`derived texture: ${layers.length} further records named and ${also.length} read`);
  layers.forEach((layer, k) => layOver(data, w, h, also[k], layer.at ?? [0, 0]));   // BET1
  for (const [x, y, c] of spec.edits ?? []) {
    if (x < 0 || y < 0 || x >= w || y >= h) throw new Error(`derived texture: an edit at ${x},${y} is off a ${w}x${h} picture`);
    const d = (y * w + x) * 4;
    data[d] = hex(c, 0); data[d + 1] = hex(c, 2); data[d + 2] = hex(c, 4); data[d + 3] = hex(c, 6);
  }
  return { width: w, height: h, data };
}

/** A classic record as a top-down RGBA picture: its palette's colours, index 0 clear (the billboard cutout, TextureReader's alphaIndex 0). */
export function classicRecordRgba(bitmap, palette) {
  const { width, height } = bitmap;
  const data = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const idx = bitmap.data[i];
    data[i * 4] = palette.getRed(idx); data[i * 4 + 1] = palette.getGreen(idx); data[i * 4 + 2] = palette.getBlue(idx);
    data[i * 4 + 3] = idx === 0 ? 0 : 255;
  }
  return { width, height, data };
}

/**
 * The spec that rebuilds `picture` from `src` placed at `at` - every
 * pixel that differs is an edit (the tool's half; a picture that IS the
 * record comes back with none).
 */
export function deriveSpec(from, picture, src, at = [0, 0], also = []) {
  const layers = also.map(({ from: f, at: a }) => ({ from: f, at: a }));   // BET1: [{ from, at, src }] - the further records
  const base = composeDerivedPicture({ from, size: [picture.width, picture.height], at, also: layers }, src, also.map((l) => l.src));
  const edits = [];
  for (let y = 0; y < picture.height; y++) {
    for (let x = 0; x < picture.width; x++) {
      const i = (y * picture.width + x) * 4;
      // A pixel clear in both is equal: the colour Unity's importer bled under
      // a clear pixel (Alpha Is Transparency) never draws - the cutout drops
      // it - and the port keeps index 0's black there, as under every
      // classic sprite.
      if (picture.data[i + 3] === 0 && base.data[i + 3] === 0) continue;
      if (picture.data[i] === base.data[i] && picture.data[i + 1] === base.data[i + 1] && picture.data[i + 2] === base.data[i + 2] && picture.data[i + 3] === base.data[i + 3]) continue;
      const c = [0, 1, 2, 3].map((k) => picture.data[i + k].toString(16).padStart(2, '0')).join('');
      edits.push([x, y, c]);
    }
  }
  const spec = { from };
  if (picture.width !== src.width || picture.height !== src.height) spec.size = [picture.width, picture.height];
  if (at[0] || at[1]) spec.at = at;
  if (layers.length) spec.also = layers;
  if (edits.length) spec.edits = edits;
  return spec;
}

/**
 * CSA-A (2026-09-27): A PICTURE THAT IS A CLASSIC RECORD TILED UNDER THE
 * AUTHOR'S PAINT. Come Sail Away's thirty-two wave frames (archive 112395,
 * record 2, 640x640) are the author's wave shapes and dark troughs laid over
 * Daggerfall's own snow, TEXTURE.303 record 1, repeated across the frame:
 * every crest pixel is the record's, exactly. And the frames are two
 * pictures, each scrolled down the same sixteen steps. The edit list above
 * would be a quarter of a million pixels a frame, so this kind carries the
 * author's pixels as pictures of their own - the PAINT - in which one
 * colour, the spec's `key`, means "the record's pixel here":
 *   { from: [archive, record, frame?], size: [width, height],
 *     paint: '<file>',      the author's picture this frame is cut from
 *     scroll: n,            the frame's row y is the paint's row (y + n) mod height
 *     tile: [px, py],       the record's pixel under the FRAME's (x, y) is ((x + px) mod w, (y + py) mod h)
 *     key: 'rrggbbaa' }     the paint colour that is not the author's
 * A key pixel comes back opaque with the record's colour; every other paint
 * pixel is the author's as it stands.
 */
export function composeTiledPicture(spec, src, paint) {
  const [w, h] = spec.size;
  if (paint.width !== w || paint.height !== h) throw new Error(`derived texture: a ${paint.width}x${paint.height} paint for a ${w}x${h} picture`);
  const [px, py] = spec.tile ?? [0, 0];
  const scroll = spec.scroll ?? 0;
  const k = [hex(spec.key, 0), hex(spec.key, 2), hex(spec.key, 4), hex(spec.key, 6)];
  const data = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    const sy = ((y + py) % src.height + src.height) % src.height;
    const row = ((y + scroll) % h + h) % h;
    data.set(paint.data.subarray(row * w * 4, (row + 1) * w * 4), y * w * 4);
    for (let x = 0; x < w; x++) {
      const d = (y * w + x) * 4;
      if (data[d] !== k[0] || data[d + 1] !== k[1] || data[d + 2] !== k[2] || data[d + 3] !== k[3]) continue;
      const s = (sy * src.width + (((x + px) % src.width) + src.width) % src.width) * 4;
      data[d] = src.data[s]; data[d + 1] = src.data[s + 1]; data[d + 2] = src.data[s + 2]; data[d + 3] = 255;
    }
  }
  return { width: w, height: h, data };
}

/**
 * The tool's half of composeTiledPicture: the paint that rebuilds `picture`
 * over `src` tiled at `tile`. An opaque pixel that is the record's becomes
 * the key; a clear pixel becomes clear black (a cut-out never draws the
 * colour under it); every other pixel is the author's. Refuses a picture
 * that already holds the key colour of its own.
 * @returns {{ paint: {width:number,height:number,data:Uint8Array}, fromRecord: number, own: number, clear: number }}
 */
export function deriveTiledPaint(picture, src, tile, key) {
  const { width: w, height: h } = picture;
  const k = [hex(key, 0), hex(key, 2), hex(key, 4), hex(key, 6)];
  const [px, py] = tile;
  const data = new Uint8Array(w * h * 4);
  let fromRecord = 0, own = 0, clear = 0;
  for (let y = 0; y < h; y++) {
    const sy = ((y + py) % src.height + src.height) % src.height;
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const p = picture.data;
      if (p[i + 3] === 0) { clear++; continue; }
      if (p[i] === k[0] && p[i + 1] === k[1] && p[i + 2] === k[2] && p[i + 3] === k[3]) throw new Error(`derived texture: the picture holds the key colour ${key} itself at ${x},${y}`);
      const s = (sy * src.width + (((x + px) % src.width) + src.width) % src.width) * 4;
      if (p[i + 3] === 255 && p[i] === src.data[s] && p[i + 1] === src.data[s + 1] && p[i + 2] === src.data[s + 2]) {
        data.set(k, i); fromRecord++;
      } else {
        data[i] = p[i]; data[i + 1] = p[i + 1]; data[i + 2] = p[i + 2]; data[i + 3] = p[i + 3]; own++;
      }
    }
  }
  return { paint: { width: w, height: h, data }, fromRecord, own, clear };
}


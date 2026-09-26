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
//     edits: [[x, y, 'rrggbbaa'], ...] }  the author's pixels, top-down, laid over it
// A pixel the record does not cover and no edit names is clear.

const hex = (s, i) => Number.parseInt(s.slice(i, i + 2), 16);

/**
 * Build the picture. `classicRgba(archive, record, frame)` resolves to a
 * top-down RGBA picture of the player's record (index 0 clear), the one
 * shape a decoded PNG has too.
 * @returns {Promise<{width:number, height:number, data:Uint8Array}>}
 */
export async function buildDerivedPicture(spec, classicRgba) {
  const [archive, record, frame = 0] = spec.from;
  const src = await classicRgba(archive, record, frame);
  if (!src?.width) throw new Error(`derived texture: ${archive}_${record}-${frame} is not in the player's data`);
  return composeDerivedPicture(spec, src);
}

/** The synchronous half, over a record already read. */
export function composeDerivedPicture(spec, src) {
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
export function deriveSpec(from, picture, src, at = [0, 0]) {
  const base = composeDerivedPicture({ from, size: [picture.width, picture.height], at }, src);
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
  if (edits.length) spec.edits = edits;
  return spec;
}

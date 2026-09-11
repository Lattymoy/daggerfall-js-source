// THE PORT'S TEXEL CONVENTION, in one place.
//
// Every texture that reaches the GL here is in getColor32 order: row 0
// of the buffer is the picture's BOTTOM row. `BaseImageFile.getColor32`
// writes `dstRow = (dstHeight - 1 - border - y) * dstWidth`
// (baseImageFile.js:123, BaseImageFile.cs:250), `renderer.uploadTexture`
// uploads that buffer as-is with UNPACK_FLIP_Y_WEBGL off
// (renderer.js:1832), and BB_VS samples the quad's TOP at v=1, i.e. the
// LAST row (renderer.js:299-304). In Daggerfall Unity there is nothing
// to convert: `GetColor32` feeds `Texture2D.SetPixels32`
// (TextureReader.cs:266) and a Unity Texture2D is bottom-up, so every
// texture the game draws - classic, modded or replaced - is stored the
// same way up.
//
// A picture that entered through a PNG-shaped door is NOT: a canvas
// `getImageData`, a browser decode and `unityBundle.decodeTexture2D`
// all hand back the raster TOP row first. Such a door converts HERE,
// once, on the way in - the lesson of AUDIT 62 F26, where the seasonal
// flats drew vertically mirrored beside the classic flats in the same
// batch loop because the conversion was missing, and of ROAD-H H4,
// where the user texture pack's swap had the same gap (and threw
// besides, for wearing the wrong field name).
//
// TWO DOORS IMPORT THIS, AND NEITHER OWNS IT: systems/
// seasonsIliacBayAssets.js (the mod's textures) and systems/
// textureReplacement.js (M-TEX, the loose-file override). Two copies of
// a flip is how one of them ends up flipped twice.

/**
 * Rows reversed: a top-down RGBA raster (what a PNG decodes to) in the
 * port's color32 order, row 0 the picture's bottom row.
 * @param {{width:number,height:number,data:Uint8Array}} image
 * @returns {{width:number,height:number,data:Uint8Array}}
 */
export function toColor32Order(image) {
  const { width, height, data } = image;
  const row = width * 4;
  if (data.length !== row * height) throw new Error(`${width}x${height} carries ${data.length} bytes`);
  const out = new Uint8Array(data.length);
  for (let y = 0; y < height; y++) out.set(data.subarray(y * row, (y + 1) * row), (height - 1 - y) * row);
  return { width, height, data: out };
}

/**
 * The same conversion, handed back in the shape the upload path reads:
 * `{ colors, width, height }`, which is what `getColor32` returns and
 * what `uploadTexture`/`uploadEmissionTexture` take `asBytes` of
 * (renderer.js:1842, :2329). A decoded PNG's `{ width, height, data }`
 * is NOT that shape - `color32.colors` would be `undefined` and
 * `asBytes` would throw on the first swapped record.
 * @param {{width:number,height:number,data:Uint8Array}} image
 * @returns {{width:number,height:number,colors:Uint8ClampedArray}}
 */
export function toColor32(image) {
  const { width, height, data } = toColor32Order(image);
  return { width, height, colors: new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength) };
}

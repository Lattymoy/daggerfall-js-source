// THE PORT'S TEXEL CONVENTION, in one place.
//
// Every texture that reaches the GL here is in getColor32 order: row 0
// of the buffer is the picture's BOTTOM row. `BaseImageFile.getColor32`
// writes `dstRow = (dstHeight - 1 - border - y) * dstWidth`
// (baseImageFile.js:143, BaseImageFile.cs:250), `renderer.uploadTexture`
// uploads that buffer as-is with UNPACK_FLIP_Y_WEBGL off
// (renderer.js:3593), and BB_VS samples the quad's TOP at v=1, i.e. the
// LAST row (renderer.js:368-392). In Daggerfall Unity there is nothing
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
 * (renderer.js:3603, :4387). A decoded PNG's `{ width, height, data }`
 * is NOT that shape - `color32.colors` would be `undefined` and
 * `asBytes` would throw on the first swapped record.
 * @param {{width:number,height:number,data:Uint8Array}} image
 * @returns {{width:number,height:number,colors:Uint8ClampedArray}}
 */
export function toColor32(image) {
  const { width, height, data } = toColor32Order(image);
  return { width, height, colors: new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength) };
}

/**
 * HT3 (2026-09-15, Mac: "the player held torch mod shows the sprite
 * upside down when held") - THE SHAPE, WITH THE ROWS LEFT ALONE.
 *
 * `toColor32` above is a FLIP, and a flip is right for a Unity texture
 * because Unity stores its rows bottom-up: flipped, row 0 becomes the
 * picture's top. It is wrong for a decoded PNG, whose row 0 already IS
 * the picture's top - flipping that hands the upload an upside-down
 * picture.
 *
 * WHICH IS RIGHT DEPENDS ON WHERE IT IS DRAWN, and the two answers are
 * opposite:
 *   - a WORLD BILLBOARD samples v with 0 at the bottom, so it wants the
 *     port's bottom-up color32 order - `toColor32` of a decoded PNG;
 *   - a SCREEN QUAD does not. `drawScreenQuad` places its rect in
 *     top-left pixels and hands p.y = 0 (the rect's TOP) the u/v pair
 *     `v0`, and nothing flips at upload (UNPACK_FLIP_Y_WEBGL is false),
 *     so row 0 of `colors` is what lands at the top of the sprite. A
 *     screen sprite from a PNG wants its rows exactly as they came.
 *
 * So: the same shape `toColor32` answers, without the flip. The held
 * torch and the weapon widget's loose-PNG arm take this; their world
 * neighbours keep `toColor32`.
 *
 * @param {{width:number,height:number,data:Uint8Array}} image
 * @returns {{width:number,height:number,colors:Uint8ClampedArray}}
 */
export function toScreenOrder(image) {
  const { width, height, data } = image;
  const row = width * 4;
  if (data.length !== row * height) throw new Error(`${width}x${height} carries ${data.length} bytes`);
  return { width, height, colors: new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength) };
}

/**
 * BOOT2 (2026-09-20): THE THIRD DOOR, AND WHY IT IS HERE. A classic
 * indexed bitmap (an IMG/CIF record + ART_PAL.COL) becomes color32 through
 * this - `{ width, height, colors }`, GetColor32's own shape and its own
 * `alphaIndex` parameter: classic IMG UI art keys index 0 transparent (the
 * box corners), the default every caller rode before it was a parameter,
 * while a save screenshot (SAV3, IMAGE.RAW) is opaque edge to edge and
 * passes -1.
 *
 * It lived in ui/hud.js, and eleven modules imported it from there - among
 * them ui/cursor.js, which the ENTRY imports to install the document
 * cursor. That one edge, `cursor.js -> hud.js` for one pure function, put
 * the HUD, the enhanced HUD, the world tick and everything the tick
 * touches - 216 files, 4.1 MB of source - on the boot path before the
 * menu drew. A conversion from a palette is a formats concern; the HUD was
 * only ever where it happened to be written. One home, both ends: hud.js
 * imports it from here like everyone else, and re-exports nothing.
 */
export function bitmapToColor32(bmp, palette, alphaIndex = 0) {
  // alphaIndex is GetColor32's own parameter: classic IMG UI art keys
  // index 0 transparent (the box corners) - the default every caller
  // rode before it was a parameter - while a save screenshot
  // (SAV3, IMAGE.RAW) is opaque edge to edge and passes -1.
  const colors = new Uint32Array(bmp.width * bmp.height);
  const u8 = new Uint8Array(colors.buffer);
  for (let i = 0; i < bmp.data.length; i++) {
    const idx = bmp.data[i];
    const o = i * 4;
    if (idx === alphaIndex) continue;
    const c = palette.get(idx);
    u8[o] = c.r; u8[o + 1] = c.g; u8[o + 2] = c.b; u8[o + 3] = 255;
  }
  return { width: bmp.width, height: bmp.height, colors };
}

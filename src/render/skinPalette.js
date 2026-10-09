// @ts-check
// MWNPC1 (2026-10-09): THE GPU SKIN'S PALETTE, ITS SHAPE IN ONE HOME. The palette is an RGBA32F texture the
// character vertex shader reads with texelFetch (renderer.js CHAR_SKIN_VS), written by formats/mwGpuSkin.js
// writeSkinPalette and uploaded by renderer.js updateSkinPalette - three modules that must agree on where entry `e`
// lives, so the numbers are here and each of them imports them.

/** Palette entries in one row: three texels an entry (the affine's three rows, [a0 a1 a2 t0] [a3 a4 a5 t1]
 *  [a6 a7 a8 t2]), 341 of them in a 1023-texel row - under the 1024 every WebGL2 context takes as a width. So
 *  entry `e` sits at texel (3 x (e mod 341), floor(e / 341)), and at float e x 12 of a palette laid out row after
 *  row at that width. */
export const SKIN_PAL_ROW = 341;

/** The texture unit the palette is read on. Every unit to 20 is somebody's (the snow's 16-20, the cloud shadow's
 *  15, the lane's shadows 8 and 13-14, the clusters' 9-10, the air's 11-12, the billboard surface 6, the water's
 *  1, 6 and 7), and WebGL2 guarantees 32 combined units. It always holds a complete RGBA32F texture - a body's
 *  palette for its draw, an identity entry otherwise - because a sampler is used whether or not its branch runs
 *  (renderer.js drawCharacter, MW-D11's measured lesson). */
export const SKIN_PALETTE_UNIT = 21;

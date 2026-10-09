// @ts-check
// RW1 (2026-10-09, Mac: "The implementation of the real window overhaul, allowing players to see inside/outside of
// house windows"): THE ROOMS BEHIND THE GLASS, PAINTED FROM NUMBERS. Every house window seen from the street shows a
// room behind it (render/realWindows.js lays the room out and lights it - interior mapping on the glass's own
// texels); this file is what the rooms are MADE of: the port's own palettes and patterns, no ARENA2 picture and no
// raster - the shader paints them texel by texel at ROOM_TEXELS_PER_M, square and low like Daggerfall's own walls.
//
//   a STYLE   - one room's walls, wainscot, floor, ceiling and beams (eight colours) and how each is laid
//               (ROOM_PATTERNS: plaster, striped paper, stone blocks or boards; planks, flagstones or tiles)
//   a PIECE   - the one thing against its back wall: a bed, a table, a shelf, a hearth, a painting, a wardrobe, or
//               nothing (ROOM_PIECES)
//   a FABRIC  - its curtains' and its rug's and its bed's cloth (ROOM_FABRICS)
//
// Which a window gets is its SEED's (realWindows.js: the glass's tile, its wall's plane, in the model's own frame) -
// so a street's houses differ, a house keeps its rooms as the camera moves, and every client paints the same street.
// The laws below (`roomStyleOf`, `roomPieceOf`, `roomFabricOf`, `roomLitAt`, `roomCurtained`) are the shader's own,
// written once here in numbers the GLSL is built from and pinned by execution (test/windows1_rooms.test.js).
//
// Not a DFU member: the port's own presentation over DFU's own window table (climateSwaps.isExteriorWindow).

/** The room's pixel grid: texels per metre on every face, so a wall a metre wide is twelve of them. */
export const ROOM_TEXELS_PER_M = 12;

/** A style's eight colours, sRGB bytes, in this order. */
export const ROOM_COLOR_SLOTS = Object.freeze(['wall', 'wall2', 'wainscot', 'floor', 'floor2', 'ceiling', 'beam', 'furniture']);

/** How a style lays its faces: [wall pattern, floor pattern, wainscot 0/1, beams 0/1]. Wall: 0 plaster, 1 striped
 *  paper, 2 stone blocks, 3 upright boards. Floor: 0 planks, 1 flagstones, 2 chequered tiles. */
export const ROOM_PATTERNS = Object.freeze({ wall: Object.freeze(['plaster', 'stripes', 'stone', 'boards']), floor: Object.freeze(['planks', 'flags', 'tiles']) });

/** The rooms. Eight, so a street of eight houses can wear eight - and the hash spreads them evenly (the pin). */
export const ROOM_STYLES = Object.freeze([
  Object.freeze({ name: 'plaster and oak', colors: [[182, 160, 124], [168, 146, 112], [96, 64, 40], [118, 82, 50], [104, 72, 44], [150, 128, 98], [78, 52, 32], [70, 46, 28]], pattern: [0, 0, 1, 1] }),
  Object.freeze({ name: 'whitewash and flags', colors: [[196, 190, 172], [184, 178, 160], [120, 112, 98], [112, 108, 100], [92, 88, 82], [176, 170, 154], [96, 72, 48], [84, 58, 36]], pattern: [0, 1, 0, 1] }),
  Object.freeze({ name: "merchant's green", colors: [[92, 112, 78], [104, 124, 88], [70, 52, 36], [126, 92, 58], [110, 80, 50], [160, 142, 110], [84, 60, 40], [64, 40, 26]], pattern: [1, 0, 1, 0] }),
  Object.freeze({ name: 'red ochre', colors: [[150, 78, 54], [138, 70, 48], [84, 52, 34], [104, 70, 44], [90, 60, 38], [140, 112, 84], [70, 46, 30], [58, 36, 22]], pattern: [0, 2, 1, 1] }),
  Object.freeze({ name: 'blue paper', colors: [[80, 96, 132], [104, 120, 158], [64, 48, 34], [132, 98, 64], [116, 84, 54], [172, 160, 136], [88, 64, 44], [72, 48, 30]], pattern: [1, 0, 1, 0] }),
  Object.freeze({ name: 'stone hall', colors: [[128, 124, 116], [112, 108, 100], [90, 84, 76], [96, 92, 86], [80, 76, 70], [110, 98, 84], [70, 50, 34], [80, 56, 34]], pattern: [2, 1, 0, 1] }),
  Object.freeze({ name: 'bare timber', colors: [[138, 104, 70], [124, 92, 60], [100, 72, 46], [110, 78, 48], [96, 68, 42], [120, 90, 60], [74, 52, 32], [66, 44, 26]], pattern: [3, 0, 0, 1] }),
  Object.freeze({ name: 'yellow lime', colors: [[200, 176, 112], [186, 162, 100], [108, 78, 50], [140, 120, 96], [70, 60, 50], [184, 170, 140], [92, 66, 42], [76, 52, 32]], pattern: [0, 2, 1, 0] }),
]);

/** What stands against a room's back wall, by index (0 is a bare wall). */
export const ROOM_PIECES = Object.freeze(['none', 'bed', 'table', 'shelf', 'hearth', 'painting', 'wardrobe']);

/** The cloth: curtains, rugs, blankets, a painting's canvas. */
export const ROOM_FABRICS = Object.freeze([[140, 40, 36], [52, 82, 120], [168, 128, 52], [74, 104, 62], [118, 60, 110], [196, 170, 110]]);

/** Of the rooms behind a lit night's windows, the share with a lamp burning - the rest stand dark, as a town's do. */
export const ROOM_LIT_SHARE = 0.62;
/** The share of windows hung with curtains. */
export const ROOM_CURTAIN_SHARE = 0.5;
/** The hearth's glow at night, sRGB - a banked fire's, under the lamp's amber. */
export const ROOM_HEARTH_GLOW = Object.freeze([255, 120, 40]);

/** A seed in [0, 1) to one of `n` - the shader's `int(floor(seed * n))`, clamped the way a seed of exactly 1 would
 *  need (the GLSL hash never answers 1; this keeps the twin total). */
const pick = (seed, n) => Math.min(n - 1, Math.max(0, Math.floor(seed * n)));
export const roomStyleOf = (seed) => pick(seed, ROOM_STYLES.length);
export const roomPieceOf = (seed) => pick(seed, ROOM_PIECES.length);
export const roomFabricOf = (seed) => pick(seed, ROOM_FABRICS.length);
/** A night room's lamp burns when its seed falls under the lit share. */
export const roomLitAt = (seed) => seed < ROOM_LIT_SHARE;
export const roomCurtained = (seed) => seed < ROOM_CURTAIN_SHARE;

/** The styles' colours as one flat sRGB list (style-major, ROOM_COLOR_SLOTS within) - what the shader's table is. */
export function roomColorTable() {
  const out = [];
  for (const s of ROOM_STYLES) for (const c of s.colors) out.push(c);
  return out;
}

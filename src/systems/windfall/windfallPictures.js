// @ts-check
// OWN-WORK4 (2026-10-31, the owner: "A proper 1 to 1 recreation for everything"): WINDFALL'S PICTURES, PAINTED HERE. The
// three pictures Windfall 1.0.0's particles wear keep its names and sizes: two 64 x 64 sheets of 8 x 8 leaves (spring and
// summer green, fall's reds and golds) and a 16 x 16 snowflake. Each is painted from a seed by the rules below; no pixel
// of the mod's is read. A leaf keeps its shape on both sheets and only its colour turns. A pixel is whole or empty, as
// the particles cut them out at a half (render/windfallParticles.js). Pure: top row first, RGBA.
import { mulberry32 } from '../soundscape/bedDsp.js';

/** Each picture's side, in pixels, by its name (render/windfallParticles.js WINDFALL_PICTURES). */
export const WINDFALL_PICTURE_SIZE = Object.freeze({ spring_summer_leaves: 64, fall_leaves: 64, snowflake: 16 });
/** A sheet's tiles a side, and a tile's pixels a side. */
export const WINDFALL_SHEET = Object.freeze({ tiles: 8, tile: 8 });
/** The leaves' colours: a leaf picks its row by its seed, the same on both sheets. */
export const WINDFALL_LEAF_COLOURS = Object.freeze({
  spring_summer_leaves: Object.freeze([
    [92, 140, 48],
    [70, 120, 40],
    [118, 158, 58],
    [58, 104, 44],
    [136, 168, 70],
    [84, 130, 56],
  ]),
  fall_leaves: Object.freeze([
    [204, 92, 30],
    [178, 52, 32],
    [214, 164, 46],
    [148, 92, 46],
    [192, 124, 40],
    [158, 40, 36],
  ]),
});
const LEAF_SEED = 0x1eaf0000;
const SNOW_EMPTY = [235, 242, 255];

const clampByte = (value) => (value < 0 ? 0 : value > 255 ? 255 : Math.round(value));

function put(data, side, column, row, colour, shade, alpha) {
  const at = (row * side + column) * 4;
  data[at] = clampByte(colour[0] * shade);
  data[at + 1] = clampByte(colour[1] * shade);
  data[at + 2] = clampByte(colour[2] * shade);
  data[at + 3] = alpha;
}

/** One leaf in its tile: an oval narrowing to its tip, a stem past its base, a darker midrib, a lit and a shaded half. */
function paintLeaf(data, side, tile, colours) {
  const { tiles, tile: span } = WINDFALL_SHEET;
  const random = mulberry32(LEAF_SEED + tile);
  const turn = random() * Math.PI,
    halfLength = 3 + 0.7 * random(),
    halfWidth = 1.3 + 0.9 * random();
  const centreX = span / 2 + (random() - 0.5) * 0.6,
    centreY = span / 2 + (random() - 0.5) * 0.6;
  const colour = colours[Math.floor(random() * colours.length)];
  const tint = 0.92 + 0.16 * random();
  const cos = Math.cos(turn),
    sin = Math.sin(turn);
  const left = (tile % tiles) * span,
    top = Math.floor(tile / tiles) * span;
  for (let row = 0; row < span; row++) {
    for (let column = 0; column < span; column++) {
      const dx = column + 0.5 - centreX,
        dy = row + 0.5 - centreY;
      const along = (dx * cos + dy * sin) / halfLength;
      const across = (dy * cos - dx * sin) / halfWidth;
      const width = Math.sqrt(Math.max(0, 1 - along * along)) * (along > 0 ? 1 - 0.45 * along : 1);
      const blade = Math.abs(across) <= width;
      const stem = along >= -1.45 && along < -0.85 && Math.abs(across * halfWidth) < 0.45;
      const grain = 0.95 + 0.1 * random();
      if (!blade && !stem) {
        put(data, side, left + column, top + row, colour, 1, 0);
        continue;
      }
      const rib = Math.abs(across * halfWidth) < 0.5 && along > -0.9 && along < 0.75;
      const shade = stem
        ? 0.62
        : (across > 0 ? 1.12 : 0.9) * (rib ? 0.82 : 1) * (Math.abs(across) > 0.75 * width ? 0.9 : 1);
      put(data, side, left + column, top + row, colour, shade * tint * grain, 255);
    }
  }
}

/** A flake: a round core and six arms, each with a pair of short branches. */
function paintSnowflake(data, side) {
  const centre = side / 2;
  for (let row = 0; row < side; row++) {
    for (let column = 0; column < side; column++) {
      const dx = column + 0.5 - centre,
        dy = row + 0.5 - centre;
      const reach = Math.hypot(dx, dy);
      const angle = Math.atan2(dy, dx);
      const arm = Math.round(angle / (Math.PI / 3)) * (Math.PI / 3);
      const offArm = reach * Math.abs(Math.sin(angle - arm));
      const alongArm = reach * Math.cos(angle - arm);
      const core = reach <= 2.2;
      const onArm = offArm <= 0.65 && reach <= 6.8;
      const branch = alongArm > 3.4 && alongArm < 5.2 && Math.abs(offArm - (alongArm - 3.4) * 0.9) < 0.55;
      if (!core && !onArm && !branch) put(data, side, column, row, SNOW_EMPTY, 1, 0);
      else put(data, side, column, row, core ? [252, 253, 255] : [226, 236, 252], 1, 255);
    }
  }
}

/** A picture by its name: { width, height, data } (top row first, RGBA), or null for a name the mod has none of. */
export function paintWindfallPicture(name) {
  const side = WINDFALL_PICTURE_SIZE[name];
  if (!side) return null;
  const data = new Uint8Array(side * side * 4);
  if (name === 'snowflake') paintSnowflake(data, side);
  else {
    const { tiles } = WINDFALL_SHEET;
    for (let tile = 0; tile < tiles * tiles; tile++) paintLeaf(data, side, tile, WINDFALL_LEAF_COLOURS[name]);
  }
  return { width: side, height: side, data };
}

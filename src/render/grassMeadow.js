// @ts-check
// ═══════════════════════════════════════════════════════════════════
// MEADOW1 (2026-10-06, Mac: "These are 4 textures I want to blend into our
// grass system, all with varying sizes so its not monotonous everywhere";
// then "This texture will fold in alongside these but specifically is a
// bush, so it should be of different sizes. And instead of billboarding,
// these should have a sort of low poly look to them, like the trees").
//
// THE MEADOW IS THE OWNER'S ART, STOOD UP AS THE TREES ARE. Five sprites he
// drew - a tall green tuft, the same tuft cut short, a tuft of flowers, a
// dry tuft and a bush (src/assets/grass/source/, baked into
// render/meadowArt.js by tools/bakeMeadow.mjs) - become the grass style
// `meadow`, the row's default. It keeps the whole of the lab's field, as
// the pixel style does (render/grassPixelArt.js): the placer, the packed
// lanes, the cells, the host-paid fade, the wind, the ground's light. What
// changes is what a blade IS:
//
//   - IT IS A SPRITE OF THE OWNER'S, in his own colours. The pixel style
//     paints a tone sheet in the ground's palette; the meadow samples his
//     texels and moves them by the ground they stand on (the tile's mean
//     over the ground that puts his green at the lane's middle tone,
//     MEADOW_GREEN): his green becomes the tile's, a shade lighter, in every
//     climate and season, while his petals and dry stalks keep their hue and
//     take only its light; the far field still gives way to the tile's mean
//     as the pixel style's does.
//
//   - IT IS CROSSED CARDS, NOT A BILLBOARD. Low Poly Trees (bible/07-
//     Rendering/Low-Poly-Trees.md) stands its bushes as a star of vertical
//     cards through the centre, every one showing the same side view
//     (`504_27`: four, 45 degrees apart). A meadow tuft is MEADOW_CARDS such
//     cards (MEADOW_CARDS_FAR past MEADOW_NEAR_AT of the range) at a yaw of
//     its own, fixed in the world - walk round it and it turns its edges to
//     you, which is the low-poly look - and each card is shaded by the
//     trees' own face law (MEADOW_FACE), so a low sun picks one face out.
//
//   - THE FIVE ARE BLENDED BY THE GROUND'S PATCH, AND EVERY ONE VARIES IN
//     SIZE. Which sprite a blade wears is drawn from the width byte - a
//     uniform random the sprite styles never draw a width with (their quad
//     is the sprite's) - weighted by the patch GRASS6 already bakes into the
//     tint: flowers and taller grass gather where the patch is lush, dry
//     tufts and short grass where it is poor, a bush now and then. Its size
//     is the lab's own height law (a factor of 2.9 from shortest to
//     tallest) times its sprite's scale and the patch's (MEADOW_PATCH_SCALE),
//     so no two neighbours stand the same and whole patches run taller.
//
// Everything here is pure and deterministic; the shader's half of the law
// is written from these same numbers (render/labGrass.js
// GRASSMEADOW_VS_EDITS), and test/grassmeadow.test.js holds the two
// together.
import { MEADOW_SPRITES, MEADOW_ALPHABET } from './meadowArt.js';
import { smoothstep } from '../systems/mathf.js';

/** the atlas's cells side by side - a power of two so every mip level halves exactly; the five sprites take the
 *  first five and the last three are air the shader never picks */
export const MEADOW_SLOTS = 8;
/** one cell's texels a side: the bush's own 64, and a 32 x 32 tuft laid at two texels a pixel - so the first mip
 *  level is the tuft's own picture again, texel for texel */
export const MEADOW_CELL = 64;
/** the cards a tuft is stood on, evenly turned about its root (Low Poly Trees' bushes: four at 45 degrees). Three
 *  at 60 near: from any side two of them are open to the eye - two cards read flat when one stands edge-on - at three
 *  quarters the vertices of the trees' four. */
export const MEADOW_CARDS = 3;
/** ...and two past MEADOW_NEAR_AT of the range, where a tuft is a few pixels tall and its third card is not a thing
 *  any eye can find - two thirds of the vertices on 94 of the 114 cells a walker's eye draws at the shipped range,
 *  three quarters of its tufts (tools/meadowProbe.mjs). AUDIT MEADOW1: the near set's
 *  FIRST TWO (60 degrees apart), not two of their own at 90 - every far tuft turned a card a sixth of a turn at the
 *  handover, a whole cell at once */
export const MEADOW_CARDS_FAR = 2;
/** where the far cards take over, as a share of the draw range: 75 m at the shipped 300, where a half-metre tuft
 *  stands under ten pixels at 1080p */
export const MEADOW_NEAR_AT = 0.25;
/** AUDIT MEADOW1: ...over a band this share of the range wide, TUFT BY TUFT - each drops its third card at its own
 *  distance in the band (a hash of its seed), so no cell thins at once; a cell draws the far set only past the band */
export const MEADOW_NEAR_BAND = 0.05;
/** a meadow sprite stands for THIS many of the lab's blades - the host submits one in this many of each cell's
 *  (the placer's order is random, so a prefix is a uniform share), as the pixel style submits one in
 *  PX_BLADES_PER_TUFT. A sprite is a whole tuft of a dozen blades, not three to five. */
export const MEADOW_BLADES_PER_TUFT = 3;

/**
 * The five, in atlas order (tools/bakeMeadow.mjs SOURCES). `scale` is the card's side over the lab's blade height:
 * a tuft's drawn height is about three quarters of its cell, so 4/3 stands the tall tuft as tall as the lab's blade;
 * the bush stands at 2.25 - half a metre to a metre and a half of bush over the lab's height law. `stiff` is the
 * share of its own standing lean a card takes: a bush is woody, and stands a third as crooked as grass. `sway` is its
 * share of the WIND's lean (AUDIT MEADOW1, Mac: "have the wind sway effect the new foilage, like it does the trees"):
 * the trees' own shares (systems/windDrive.js floraSwayOf) - the grass sways whole, as a tall flora record does, and
 * the bush six tenths, as the world's bushes and shrubs do.
 */
export const MEADOW_VARIANTS = Object.freeze([
  Object.freeze({ name: 'tall', scale: 4 / 3, stiff: 1, sway: 1 }),
  Object.freeze({ name: 'short', scale: 4 / 3, stiff: 1, sway: 1 }),
  Object.freeze({ name: 'flowers', scale: 4 / 3, stiff: 1, sway: 1 }),
  Object.freeze({ name: 'dry', scale: 4 / 3, stiff: 1, sway: 1 }),
  Object.freeze({ name: 'bush', scale: 2.25, stiff: 0.3, sway: 0.6 }),
]);
export const MEADOW_BUSH = 4;
export const MEADOW_FLOWERS = 2;
export const MEADOW_DRY = 3;
export const MEADOW_SHORT = 1;
export const MEADOW_TALL = 0;
/** the patch: the baked tint (GRASS6 - 0.55 of it the clump noise) read through smoothstep(lo, hi) - 0 a poor patch,
 *  1 a lush one */
export const MEADOW_LUSH = Object.freeze([0.3, 0.7]);
/** each share at the poor end and the lush end of the patch. Bush, flowers and dry are taken off the width byte in
 *  that order; of what is left, `short` is the short tuft's share and the rest the tall's. */
export const MEADOW_SHARES = Object.freeze({
  bush: Object.freeze([0.008, 0.02]),
  flowers: Object.freeze([0.01, 0.14]),
  dry: Object.freeze([0.24, 0.02]),
  short: Object.freeze([0.62, 0.3]),
});
/** a whole patch runs this much shorter (poor) to taller (lush), over every sprite's own size */
export const MEADOW_PATCH_SCALE = Object.freeze([0.8, 1.25]);
/** THE CARD'S FACE, by the low-poly trees' own law (render/renderer.js BB_VS, AUDIT LPT A2): a face's light is
 *  multiplied by clamp(base + span * dot(its normal, the light), floor, 1) - a card turned to a low sun takes it whole,
 *  one turned away keeps half, and at noon the two sit close. The meadow takes it on the sun's light and the moon's;
 *  the blade's own lambert about the ground (GRASS-LIT2) stays under it, so a meadow at noon is lit as its ground is. */
export const MEADOW_FACE = Object.freeze({ base: 0.72, span: 0.28, floor: 0.5 });
/** a sprite's mean colour (0..1), over its drawn texels */
export function meadowSpriteMean(sprite) {
  const rgb = sprite.palette.map((hex) => [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16)));
  const sum = [0, 0, 0];
  let n = 0;
  for (const row of sprite.rows) {
    for (const ch of row) {
      if (ch === '.') continue;
      const c = rgb[MEADOW_ALPHABET.indexOf(ch)];
      sum[0] += c[0]; sum[1] += c[1]; sum[2] += c[2]; n++;
    }
  }
  return sum.map((v) => v / n / 255);
}
/** THE GREEN THE ART IS ANCHORED BY: the tall tuft's mean. GRASS-LIT's lesson is that a field painted in a colour the
 *  ground is not never blends, and the owner's green is lighter and bluer than every grass tile (75, 106, 69 against
 *  the temperate base's 49, 73, 39 under Vanilla Enhanced, 52, 76, 42 classic) - a mint field on an olive ground. So
 *  the art is moved by its ground: each texel times the ratio of the tile's mean to the ground that would make this
 *  green stand at the lane's middle tone over it (meadowArtGround) - his green becomes the tile's own, a shade
 *  lighter, as the pixel tuft's middle is, and every texel keeps its place against it. */
export const MEADOW_GREEN = Object.freeze(meadowSpriteMean(MEADOW_SPRITES[0]));
/** the ground the art is drawn FOR, given the tone (render/labGrass.js GRASS_TONES[1], or the classic lane's) its
 *  green should stand at over that ground */
export const meadowArtGround = (tone) => MEADOW_GREEN.map((v, i) => v / tone[i]);
/** and the ratio is held to this span, so a tile far off grass's mean (a shore, a mod's odd record) tints the art
 *  and never repaints it */
export const MEADOW_SHIFT = Object.freeze([0.5, 1.6]);
/** A TEXEL TAKES THE GROUND'S HUE AS FAR AS IT IS GREEN: its green over its larger other channel (0..1 units), times
 *  this, is how much of the per-channel ratio it takes, and what it does not take is the ratio's brightness alone.
 *  Measured on the sprites: 96% of the green tufts' texels clear a twelfth and take the hue whole; the flower tuft's
 *  stalks take it and its petals (48% of it) none; the dry tuft keeps its own (under a twentieth of the hue, on average);
 *  the bush, greyer, takes three quarters. */
export const MEADOW_GREEN_EDGE = 12;
/** the JS twin of the fragment's colour (before the light): a texel `art` (0..1) over a ground of mean `ground`, the
 *  art drawn for `artGround` */
export function meadowTexel(art, ground, artGround) {
  const s = ground.map((g, i) => Math.min(MEADOW_SHIFT[1], Math.max(MEADOW_SHIFT[0], g / artGround[i])));
  const lum = s[0] * 0.299 + s[1] * 0.587 + s[2] * 0.114;
  const k = Math.min(1, Math.max(0, (art[1] - Math.max(art[0], art[2])) * MEADOW_GREEN_EDGE));
  return art.map((a, i) => a * (lum + (s[i] - lum) * k));
}

/** the style the row's word names. Neither of the two older words is the row's default, the meadow - the same
 *  fallback the settings pane draws for a value that is no tier */
export const meadowGrass = (style) => style !== 'smooth' && style !== 'pixel';

/**
 * THE LAW, AS THE SHADER RUNS IT (GRASSMEADOW_VS_EDITS writes these numbers): which sprite a blade wears, from its
 * width byte `r` (0..1) and its baked tint, and the factor its card's side takes over the lab's height.
 * @param {number} r the width lane, 0..1
 * @param {number} tint the tint lane, 0..1
 * @returns {{ variant: number, scale: number, lush: number }}
 */
export function meadowPick(r, tint) {
  const lush = smoothstep(MEADOW_LUSH[0], MEADOW_LUSH[1], tint);
  const at = (pair) => pair[0] * (1 - lush) + pair[1] * lush;   // GLSL's own mix, term for term, so the two agree at every byte
  const b = at(MEADOW_SHARES.bush), f = at(MEADOW_SHARES.flowers), d = at(MEADOW_SHARES.dry);
  let variant;
  if (r < b) variant = MEADOW_BUSH;
  else if (r < b + f) variant = MEADOW_FLOWERS;
  else if (r < b + f + d) variant = MEADOW_DRY;
  else variant = (r - b - f - d) / (1 - b - f - d) < at(MEADOW_SHARES.short) ? MEADOW_SHORT : MEADOW_TALL;
  return { variant, scale: MEADOW_VARIANTS[variant].scale * at(MEADOW_PATCH_SCALE), lush };
}

/**
 * AUDIT MEADOW1: A SPRITE'S DRAWN BOX - the least rectangle of its own square that holds every texel it draws, as
 * shares of the square: u0..u1 across, v0..v1 up from its foot. A card is cut to it (the vertex stage maps its corners
 * into it), so no fragment is shaded where the sprite has no texel: a whole card was 52 to 85 per cent air. The cut
 * loses nothing - the uv stays the corner's own place on the card, so every texel lands where it did - and a mirrored
 * card is the card turned about its root, not its texture flipped, so an off-centre box holds both ways.
 * @param {{ width: number, height: number, rows: readonly string[] }} sprite
 */
export function meadowSpriteBox(sprite) {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  sprite.rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      if (row[x] === '.') continue;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
  });
  if (x1 < x0) return { u0: 0.5, u1: 0.5, v0: 0, v1: 0 };   // a sprite of air: a card of no area, which draws nothing
  return { u0: x0 / sprite.width, u1: (x1 + 1) / sprite.width, v0: (sprite.height - 1 - y1) / sprite.height, v1: (sprite.height - y0) / sprite.height };
}
/** the five's boxes, in atlas order */
export const MEADOW_BOXES = Object.freeze(MEADOW_SPRITES.map((s) => Object.freeze(meadowSpriteBox(s))));

/** AUDIT MEADOW1: THE TUFT'S OWN SEED - the hash of its place in its CELL (the packed position lane, 0..1 of the cell's
 *  frame) times this. The world position re-rolled every tuft's turn and mirror at each shift of the floating origin
 *  (PERF-EXT21 moves a slot's frame and never its lanes), every map pixel crossed; the lane is the one place a shift
 *  never touches. 64 keeps the hash's float32 fract honest (64 x 456.21 is under 2^15). */
export const MEADOW_SEED = 64;

/** AUDIT MEADOW1: the least a slope's normal stands up when a card is sheared to it (the lane holds a normal to
 *  GRASS_SLOPE_SPAN, so this is a guard and never binds on a normal the pack wrote) */
export const MEADOW_SLOPE_FLOOR = 0.3;

/** the lab's own wind law (LAB_GRASS_VS): the lean a metre a second of wind gives a blade's top, over its height, and
 *  the most of it a gust adds (push = |wind| x (0.55 + gust x 0.75), gust 0..1) */
export const LAB_LEAN_PER_PUSH = 0.055;
export const LAB_GUST_MAX = 0.55 + 0.75;
/** the lab's own standing lean, per axis (the lean lane holds +-LEAN_SPAN / 2 = 0.25): the most it carries a card's
 *  top sideways, over its side */
const LEAN_MAX = Math.hypot(0.25, 0.25);

/** THE BOX A CELL IS CULLED BY must hold its cards, which stand taller and reach wider than any blade - over the
 *  blade's height, the most a card's top stands (its scale, the lush patch's, the share of its side its sprite fills) */
export const MEADOW_TOP = Math.max(...MEADOW_VARIANTS.map((v, i) => v.scale * MEADOW_PATCH_SCALE[1] * MEADOW_BOXES[i].v1));
/** ...the most a card reaches sideways from its root, standing: the wider half of its box plus its own lean at its top */
export const MEADOW_REACH = Math.max(...MEADOW_VARIANTS.map((v, i) => {
  const b = MEADOW_BOXES[i];
  return v.scale * MEADOW_PATCH_SCALE[1] * (Math.max(0.5 - b.u0, b.u1 - 0.5) + LEAN_MAX * v.stiff * b.v1 * b.v1);
}));
/** ...and how much further a metre a second of wind carries it, at a full gust - the frame's wind is the host's, so
 *  the reach is too (LabGrassRenderer._drawVisibleSlots): a gale leans the field further than any standing lean */
export const MEADOW_WIND_REACH = Math.max(...MEADOW_VARIANTS.map((v, i) => v.scale * MEADOW_PATCH_SCALE[1] * LAB_LEAN_PER_PUSH * LAB_GUST_MAX * v.sway * MEADOW_BOXES[i].v1 ** 2));

/** AUDIT MEADOW1: the slots a card's corners take in its array - four, and two no index names. The cards are drawn
 *  INDEXED, so a corner two triangles share is shaded once; and both of a card's triangles end on slot 2, the corner
 *  they share, so it is the provoking vertex of both (GL's last-vertex convention) and the only one of the card's whose
 *  `gl_VertexID % 3 == 2` - the one vertex a card that reads the root's sun and lanterns (GRASS-LIT's law). Six vertex
 *  invocations a card were four, and its two map reads one. */
export const MEADOW_CARD_SLOTS = 6;
/**
 * The card corners: `cards` vertical quads, MEADOW_CARD_SLOTS slots each, three floats a slot - the corner's x and y
 * (0..1), and its card's TURN as a share of a half-turn (k / of), plus one on every other card, which the vertex
 * stage draws mirrored. So the stage needs no count: the near array's three cards and the far array's two are turned
 * and mirrored by what they carry. Slots 4 and 5 are never indexed.
 */
export function meadowCardCorners(cards = MEADOW_CARDS, of = cards) {
  const out = new Float32Array(cards * MEADOW_CARD_SLOTS * 3);
  for (let k = 0; k < cards; k++) {
    const t = k / of + (k % 2);   // AUDIT MEADOW1: `of` the set it is the first `cards` of - the far set is the near's first two
    [[0, 0], [1, 0], [1, 1], [0, 1], [0, 0], [0, 0]].forEach(([x, y], s) => out.set([x, y, t], (k * MEADOW_CARD_SLOTS + s) * 3));
  }
  return out;
}
/** ...and their triangles, labBladeCorners' winding: (0, 1, 2) and (3, 0, 2), both ending on the shared corner */
export function meadowCardIndices(cards = MEADOW_CARDS) {
  const out = new Uint16Array(cards * 6);
  for (let k = 0; k < cards; k++) out.set([0, 1, 2, 3, 0, 2].map((s) => k * MEADOW_CARD_SLOTS + s), k * 6);
  return out;
}

/**
 * THE ATLAS: MEADOW_SLOTS cells of MEADOW_CELL square, row 0 the BASE (the sprites are stored top row first, so each
 * is turned the right way up here - the pixel sheet's convention, which vUV.y = 0 at a card's foot reads), every
 * sprite laid at `cell / its size` texels a pixel, nearest - never filtered. RGB is the sprite's colour and alpha 0
 * or 255, never between.
 */
export function buildMeadowAtlas({ sprites = MEADOW_SPRITES, cell = MEADOW_CELL, slots = MEADOW_SLOTS } = {}) {
  if (sprites.length > slots) throw new Error(`${sprites.length} sprites in an atlas of ${slots}`);
  const width = slots * cell, height = cell;
  const data = new Uint8Array(width * height * 4);
  sprites.forEach((s, v) => {
    if (s.width !== s.height || cell % s.width) throw new Error(`${s.name}: a ${s.width}x${s.height} sprite does not tile a ${cell} cell`);
    const k = cell / s.width;
    const rgb = s.palette.map((hex) => [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16)));
    for (let y = 0; y < cell; y++) {
      const row = s.rows[s.height - 1 - Math.floor(y / k)];   // row 0 of the cell is the sprite's bottom row
      for (let x = 0; x < cell; x++) {
        const ch = row[Math.floor(x / k)];
        if (ch === '.') continue;
        const c = rgb[MEADOW_ALPHABET.indexOf(ch)];
        const o = (y * width + v * cell + x) * 4;
        data[o] = c[0]; data[o + 1] = c[1]; data[o + 2] = c[2]; data[o + 3] = 255;
      }
    }
  });
  return { width, height, data, variants: sprites.length, slots, cell };
}

/** each slot's covered share of its own cell, at a level */
export function slotCoverage(level, slots = MEADOW_SLOTS) {
  const { width, height, data } = level;
  const cw = width / slots;
  const out = new Array(slots).fill(0);
  if (cw < 1) return out;
  for (let v = 0; v < slots; v++) {
    let n = 0;
    for (let y = 0; y < height; y++) for (let x = v * cw; x < (v + 1) * cw; x++) if (data[(y * width + x) * 4 + 3]) n++;
    out[v] = n / (cw * height);
  }
  return out;
}

/**
 * One mip level down, PRESERVING EACH SPRITE'S COVERAGE - the pixel sheet's law (grassPixelArt.js downsampleCoverage,
 * GRASS AUDIT 1: an average throws an alpha-tested sprite away a few cells out, a max fills it to a block), taken per
 * sprite: a sprite keeps the share of its cell it covered at the base level, so a far flower tuft is as sparse as a
 * near one and the bush as full. The kept blocks are the ones with the most covered texels (then the higher, then
 * the leftmost); a kept block's colour is the MEAN of its covered texels - air never darkens a leaf's edge, as the
 * trees' own alpha-weighted chain has it. Every sprite keeps a texel while it is still a texel wide, and once a
 * texel spans more than one cell every covered block is kept: a mark that is there beats one that flickers.
 */
export function downsampleMeadow(level, { targets, slots = MEADOW_SLOTS }) {
  const { width, height, data } = level;
  const w2 = Math.max(1, width >> 1), h2 = Math.max(1, height >> 1);
  const out = new Uint8Array(w2 * h2 * 4);
  const blocks = [];
  for (let y = 0; y < h2; y++) {
    for (let x = 0; x < w2; x++) {
      let n = 0, r = 0, g = 0, b = 0;
      for (let dy = 0; dy < 2; dy++) {
        for (let dx = 0; dx < 2; dx++) {
          const sx = Math.min(width - 1, x * 2 + dx), sy = Math.min(height - 1, y * 2 + dy);
          const i = (sy * width + sx) * 4;
          if (!data[i + 3]) continue;
          n++; r += data[i]; g += data[i + 1]; b += data[i + 2];
        }
      }
      const o = (y * w2 + x) * 4;
      if (n) { out[o] = Math.round(r / n); out[o + 1] = Math.round(g / n); out[o + 2] = Math.round(b / n); }
      blocks.push({ x, y, n, o });
    }
  }
  const cw = w2 / slots;   // this level's texels a cell, across
  if (cw < 1) {
    for (const bl of blocks) if (bl.n) out[bl.o + 3] = 255;
    return { width: w2, height: h2, data: out };
  }
  for (let v = 0; v < slots; v++) {
    const mine = blocks.filter((bl) => bl.n > 0 && bl.x >= v * cw && bl.x < (v + 1) * cw);
    if (!mine.length) continue;
    mine.sort((a, c) => c.n - a.n || c.y - a.y || a.x - c.x);
    const keep = Math.min(mine.length, Math.max(1, Math.round(targets[v] * cw * h2)));
    for (let k = 0; k < keep; k++) out[mine[k].o + 3] = 255;
  }
  return { width: w2, height: h2, data: out };
}

/** the full chain, level 0 first, down to 1x1 - a chain that stops short is an incomplete texture, which samples black */
export function buildMeadowMips(atlas = buildMeadowAtlas()) {
  /** @type {{ width: number, height: number, data: Uint8Array }[]} */
  const levels = [atlas];
  const slots = atlas.slots ?? MEADOW_SLOTS;
  const targets = slotCoverage(atlas, slots);
  while (levels[levels.length - 1].width > 1 || levels[levels.length - 1].height > 1) {
    levels.push(downsampleMeadow(levels[levels.length - 1], { targets, slots }));
  }
  return levels;
}

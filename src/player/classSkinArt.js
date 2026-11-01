// @ts-check
// OWN-WORK4 (2026-10-31; the owner: "Our goal is no latching onto other mod authors or needing permissions"): THE CLASS
// SKINS' PICTURES, OURS. A frame is the player's own classic sheet frame (player/classSkins.js `from`), dyed and marked
// by its class's scheme below: the cloth, drape and metal ramps of ART_PAL remapped to our colours, then a trim, a
// pattern, a sash, a belt, an insignia or a shield drawn on the frame's own regions. Nothing of a retired pack is read.
// Built on first ask, one frame at a time (eotbSprite.js's build queue). The palette's tables and each scheme's colours
// are kept; a built frame is kept by whoever drew it (the body, the peers' one store, the Skin card).
import { RAMP, hex, createPainter, ellipse, minus } from '../art/ownPainter.js';
import { classicArt } from '../systems/classicArt.js';
import { DFPalette } from '../formats/dfPalette.js';
import { classSkinKeyOf, classRecordScale } from './classSkins.js';

/** What a pixel is painted in, by the ART_PAL ramp its index is in. */
export const CLEAR = 0, NONE = 1, CLOTH = 2, DRAPE = 3, METAL = 4, SKIN = 5;
/** ART_PAL's sixteen-colour ramps, by what a class sheet paints in them (read off TEXTURE.475-490): the cloth (teal 0x80
 *  and the blue 0x60 that lights it), the drape (olive 0xC0, pale green 0xA0), the metal (grey 0x70, lavender 0x50)
 *  and the skin (0x20, 0x40 - its leather too, so never dyed). The rest - the shadows, the wood, the spells - stay. */
export const SLOT_OF_RAMP = Object.freeze({ 2: SKIN, 4: SKIN, 5: METAL, 6: CLOTH, 7: METAL, 8: CLOTH, 10: DRAPE, 12: DRAPE });
/** A standing figure's height in a class sheet's pixels (the idle group's 110); a record drawn smaller scales it. */
export const CLASS_FIGURE = 110;

const ownRamp = (...colours) => Object.freeze(colours.map((colour) => Object.freeze(hex(colour))));
const SAFFRON = ownRamp('#3a1d05', '#6a370a', '#9a5512', '#c4781c', '#e09c34', '#f3c25e');
const PURPLE = ownRamp('#1b0e29', '#311947', '#4a2968', '#653f89', '#835ea8', '#a583c4');
const LINEN = ownRamp('#4a4234', '#6e6450', '#958a71', '#b9ae93', '#d7cdb3', '#ece5d0');
const DARK = Object.freeze([18, 12, 9]);

/** Our insignia, 7x7: '#' the mark's colour, 'o' dark (an eye, a tooth's gap); a dark ring outside it, so it reads on
 *  any cloth. */
const glyph = (...rows) => Object.freeze(rows);
export const SIGNS = Object.freeze({
  sun: glyph('#..#..#', '.#####.', '.#####.', '#######', '.#####.', '.#####.', '#..#..#'),
  moon: glyph('..###..', '.##....', '##.....', '##.....', '##.....', '.##....', '..###..'),
  skull: glyph('.#####.', '#######', '#oo#oo#', '#######', '.##o##.', '.#####.', '.#o#o#.'),
  hand: glyph('.#.#.#.', '.#.#.#.', '.#####.', '##o####', '.######', '.#####.', '..###..'),
  eye: glyph('.......', '.#####.', '##ooo##', '#oo#oo#', '##ooo##', '.#####.', '.......'),
});

/** Which of a sheet's two cloth ramps holds its outer garment - the hood, the cloak, the robe, or the one garment of
 *  an armoured sheet - read off the sheets: 489's hood is its teal, 490's its olive. The other ramp is the inner. */
export const OUTER_SLOT = Object.freeze({ 477: CLOTH, 479: DRAPE, 480: DRAPE, 482: DRAPE, 483: DRAPE, 484: DRAPE, 485: CLOTH, 486: CLOTH, 488: DRAPE, 489: CLOTH, 490: DRAPE });

/**
 * THE SCHEMES, one a class (both sexes share theirs; bible/06-Systems/Eye-Of-The-Beholder.md OWN-WORK4 gives each one's
 * reason). `outer` and `inner` dye the two cloths and `metal` the metal; `trim` edges a cloth's hems and cuffs;
 * `pattern` lays motley, stripes or patches on cloths; `sash` crosses the chest (`studs` along it); `belt` rings the
 * waist; `sign` is an insignia on the breast and the back; `shield` a round shield on the left arm.
 */
const look = (scheme) => Object.freeze(scheme);
export const CLASS_LOOKS = Object.freeze({
  Acrobat: look({ outer: RAMP.red, inner: RAMP.yellow, metal: RAMP.bronze, pattern: { kind: 'motley', on: ['outer', 'inner'], ramps: [RAMP.red, RAMP.yellow] }, sash: RAMP.yellow }),
  Assassin: look({ outer: RAMP.red, inner: RAMP.black, metal: RAMP.iron, belt: RAMP.black }),
  Burglar: look({ outer: RAMP.grey, inner: RAMP.brown, metal: RAMP.iron, pattern: { kind: 'patches', on: ['inner'], ramps: [RAMP.olive] } }),
  'Bounty Hunter': look({ outer: RAMP.leather, inner: RAMP.black, metal: RAMP.iron, sash: RAMP.leather, studs: hex('#d8c27a') }),
  'Dark Acolyte': look({ outer: RAMP.black, inner: RAMP.olive, metal: RAMP.black, trim: { on: 'outer', ramp: RAMP.bone }, sign: { glyph: 'skull', colour: hex('#e8e1cd') } }),
  'Dark Brotherhood': look({ outer: RAMP.black, inner: RAMP.black, metal: RAMP.black, sash: RAMP.red, sign: { glyph: 'hand', colour: hex('#c0281c') } }),
  'Daggerfall Adventurer': look({ outer: RAMP.green, inner: RAMP.leather, metal: RAMP.steel }),
  Healer: look({ outer: RAMP.white, inner: RAMP.gold, metal: RAMP.gold, trim: { on: 'outer', ramp: RAMP.gold }, sign: { glyph: 'sun', colour: hex('#dcb43c') } }),
  'Healer with Shield': look({
    outer: RAMP.white, inner: RAMP.gold, metal: RAMP.gold, trim: { on: 'outer', ramp: RAMP.gold }, sign: { glyph: 'sun', colour: hex('#dcb43c') },
    shield: { face: RAMP.white, rim: RAMP.gold, back: RAMP.wood, glyph: 'sun', colour: hex('#b98a22') },
  }),
  Monk: look({ outer: SAFFRON, inner: RAMP.brown, metal: RAMP.bronze, belt: RAMP.rope }),
  Nightblade: look({ outer: RAMP.blue, inner: RAMP.black, metal: RAMP.steel, trim: { on: 'outer', ramp: RAMP.white }, sign: { glyph: 'moon', colour: hex('#e4e4e8') } }),
  Pirate: look({ outer: LINEN, inner: RAMP.blue, metal: RAMP.bronze, pattern: { kind: 'stripes', on: ['outer'], ramps: [LINEN, RAMP.red] }, belt: RAMP.red }),
  Sorcerer: look({ outer: PURPLE, inner: PURPLE, metal: RAMP.gold, trim: { on: 'outer', ramp: RAMP.gold }, sign: { glyph: 'eye', colour: hex('#f0cc44') } }),
});

/** A ramp's colour at light `tone` (0 its darkest, 1 its lightest), blended between its stops. */
export function rampAt(ramp, tone) {
  const pos = Math.max(0, Math.min(1, tone)) * (ramp.length - 1), lo = Math.floor(pos), hi = Math.min(ramp.length - 1, lo + 1), mix = pos - lo;
  return [0, 1, 2].map((channel) => Math.round(ramp[lo][channel] + (ramp[hi][channel] - ramp[lo][channel]) * mix));
}

const rgbKey = (red, green, blue) => (red << 16) | (green << 8) | blue;
/** A cloth ramp's last steps (13-15 of 16) are near-black and alike in every ramp, so a sheet shades one garment in
 *  another's: TEXTURE.486 darkens its teal robe's hem with the olive's. Such a pixel joins the garment nearest it. */
export const CLOTH_TAIL_STEP = 13;
/** How much nearer (px) the other garment must be before a near-black pixel joins it. */
export const SHADE_MARGIN = 2;
/** A palette's tables: each colour's index, each index's slot, its light within its slot (0..1), its light, each slot's
 *  span of light, and whether it is a cloth ramp's near-black tail. */
export function paletteTables(palette) {
  const index = new Map(), slot = new Uint8Array(256).fill(NONE), tone = new Float32Array(256);
  const light = new Float32Array(256), tail = new Uint8Array(256), span = {};
  for (let i = 0; i < 256; i++) light[i] = (0.299 * palette.getRed(i) + 0.587 * palette.getGreen(i) + 0.114 * palette.getBlue(i)) / 255;
  for (let i = 1; i < 255; i++) {
    const key = rgbKey(palette.getRed(i), palette.getGreen(i), palette.getBlue(i));
    if (!index.has(key)) index.set(key, i);
    slot[i] = SLOT_OF_RAMP[i >> 4] ?? NONE;
    tail[i] = (slot[i] === CLOTH || slot[i] === DRAPE) && (i & 15) >= CLOTH_TAIL_STEP ? 1 : 0;
    const [lo, hi] = span[slot[i]] ?? [1, 0];
    span[slot[i]] = [Math.min(lo, light[i]), Math.max(hi, light[i])];
  }
  for (let i = 1; i < 255; i++) tone[i] = toneIn(span[slot[i]], light[i]);
  return { index, slot, tone, light, tail, span };
}
const toneIn = ([lo, hi], light) => (hi > lo ? Math.max(0, Math.min(1, (light - lo) / (hi - lo))) : 0.5);

/** The near-black cloth pixels (`tail`) joined to the garment nearest them, walking through cloth and shadow: one keeps
 *  its own ramp unless the other's lit cloth is SHADE_MARGIN nearer. In place on `mat` and `tone`. */
function shadeByNearest(mat, tone, pal, tables, width, rows) {
  const count = width * rows;
  let any = false;
  for (let i = 0; i < count && !any; i++) any = tables.tail[pal[i]] === 1;
  if (!any) return;
  const queue = new Int32Array(count);
  const walk = (slot) => {
    const dist = new Int32Array(count).fill(-1);
    let tail = 0;
    for (let i = 0; i < count; i++) if (mat[i] === slot && !tables.tail[pal[i]]) { dist[i] = 0; queue[tail++] = i; }
    for (let head = 0; head < tail; head++) {
      const i = queue[head], x = i % width, y = (i - x) / width;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy, j = ny * width + nx;
        if (nx < 0 || ny < 0 || nx >= width || ny >= rows || dist[j] >= 0) continue;
        if (mat[j] !== CLOTH && mat[j] !== DRAPE && mat[j] !== NONE) continue;
        dist[j] = dist[i] + 1;
        queue[tail++] = j;
      }
    }
    return dist;
  };
  const near = { [CLOTH]: walk(CLOTH), [DRAPE]: walk(DRAPE) };
  for (let i = 0; i < count; i++) {
    if (!tables.tail[pal[i]]) continue;
    const other = mat[i] === CLOTH ? DRAPE : CLOTH, mine = near[mat[i]][i], theirs = near[other][i];
    if (theirs < 0 || (mine >= 0 && theirs + SHADE_MARGIN >= mine)) continue;
    mat[i] = other;
    tone[i] = toneIn(tables.span[other], tables.light[pal[i]]);
  }
}

/** The frame's own regions: each pixel's slot and light, where the figure stands (`bottom`, its feet's row) and the
 *  middle of its trunk (`centreX`), and its height in pixels. */
function regionsOf(picture, tables, height) {
  const { width, data } = picture, rows = picture.height, mat = new Uint8Array(width * rows), tone = new Float32Array(width * rows);
  const pal = new Uint8Array(width * rows);
  for (let i = 0; i < width * rows; i++) {
    if (!data[i * 4 + 3]) continue;
    const idx = (pal[i] = tables.index.get(rgbKey(data[i * 4], data[i * 4 + 1], data[i * 4 + 2])) ?? 0);
    mat[i] = idx ? tables.slot[idx] : NONE;
    tone[i] = idx ? tables.tone[idx] : 0;
  }
  shadeByNearest(mat, tone, pal, tables, width, rows);
  const body = (i) => mat[i] >= CLOTH;
  let bottom = rows - 1;
  for (let y = rows - 1; y >= 0; y--) {
    let n = 0;
    for (let x = 0; x < width; x++) n += body(y * width + x) ? 1 : 0;
    if (n >= 4) { bottom = y; break; }
  }
  const trunk = [];
  for (let y = Math.max(0, Math.round(bottom - 0.78 * height)); y <= Math.min(rows - 1, bottom - 0.45 * height); y++)
    for (let x = 0; x < width; x++) if (body(y * width + x)) trunk.push(x);
  trunk.sort((a, b) => a - b);
  return { mat, tone, body, bottom, centreX: trunk.length ? trunk[trunk.length >> 1] : width / 2, height };
}

/**
 * Our class frame, top row first: `picture` (a classic frame, top row first, index 0 clear) dyed and marked by `scheme`,
 * its slots read through `tables` (paletteTables). `outer` the slot of the sheet's outer garment (OUTER_SLOT), `view`
 * the orientation in its group (0 front, 2 the side facing left, 4 the back), `height` the standing figure's pixels.
 * Pure: the pins drive it on pictures and palettes of their own.
 */
export function paintClassFrame(picture, tables, scheme, { outer = DRAPE, view = 0, height = CLASS_FIGURE } = {}) {
  const { width } = picture, rows = picture.height, out = new Uint8Array(picture.data);
  const reg = regionsOf(picture, tables, height), { mat, tone, bottom, centreX } = reg;
  const slotOf = { outer, inner: outer === CLOTH ? DRAPE : CLOTH };
  const garment = (i) => mat[i] === CLOTH || mat[i] === DRAPE || mat[i] === NONE;
  const put = (i, colour) => { out[i * 4] = colour[0]; out[i * 4 + 1] = colour[1]; out[i * 4 + 2] = colour[2]; };
  const dye = { [slotOf.outer]: scheme.outer, [slotOf.inner]: scheme.inner, [METAL]: scheme.metal };
  for (let i = 0; i < mat.length; i++) if (dye[mat[i]]) put(i, rampAt(dye[mat[i]], tone[i]));
  if (scheme.pattern) paintPattern(scheme.pattern, scheme.pattern.on.map((role) => slotOf[role]), reg, width, rows, put);
  if (scheme.trim) paintTrim(slotOf[scheme.trim.on], scheme.trim.ramp, reg, width, rows, put);
  const band = (inside, ramp, on = (i) => mat[i] !== CLEAR) => {
    for (let y = 0; y < rows; y++) for (let x = 0; x < width; x++) if (on(y * width + x) && inside(x, y)) put(y * width + x, rampAt(ramp, 0.2 + 0.65 * tone[y * width + x]));
  };
  if (scheme.belt) {
    // a belt is worn on the clothes, never across a bare arm
    const waist = bottom - 0.53 * height, half = Math.max(1.5, 0.025 * height);
    band((x, y) => Math.abs(y - waist) <= half && Math.abs(x - centreX) <= 0.17 * height, scheme.belt, garment);
  }
  if (scheme.sash) {
    // over the right shoulder to the left hip: from the image's left in a front view, from its right behind
    const dir = view <= 1 ? 1 : -1, top = bottom - 0.8 * height, foot = bottom - 0.47 * height;
    const x0 = centreX - dir * 0.11 * height, x1 = centreX + dir * 0.11 * height, len = Math.hypot(x1 - x0, foot - top);
    const off = (x, y) => ((x - x0) * (foot - top) - (y - top) * (x1 - x0)) / len;
    const half = Math.max(1.5, 0.026 * height);
    band((x, y) => y >= top && y <= foot && Math.abs(off(x, y)) <= half, scheme.sash);
    if (scheme.studs) band((x, y) => y >= top && y <= foot && Math.abs(off(x, y)) < 0.5 && y % 5 === 0, [scheme.studs, scheme.studs]);
  }
  if (scheme.sign && view !== 2) {
    const shift = { 1: -0.03, 3: 0.03 }[view] ?? 0;
    paintSign(SIGNS[scheme.sign.glyph], scheme.sign.colour, Math.round(centreX + shift * height) - 3, Math.round(bottom - 0.69 * height) - 3, mat, width, rows, put);
  }
  if (scheme.shield) paintShield(scheme.shield, reg, view, width, rows, out);
  return { width, height: rows, data: out };
}

/** Motley diamonds, sailor's stripes or sewn patches, laid on the `slots` from the figure's own feet and trunk. */
function paintPattern({ kind, ramps }, slots, { mat, tone, bottom, centreX, height }, width, rows, put) {
  const cell = Math.max(4, Math.round(0.055 * height));
  const patches = [[-0.07, 0.62], [0.05, 0.4], [-0.04, 0.24]].map(([dx, up]) => [Math.round(centreX + dx * height), Math.round(bottom - up * height)]);
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (!slots.includes(mat[i])) continue;
      const across = x - centreX, up = bottom - y;
      let pick = -1;
      if (kind === 'motley') pick = (Math.floor((across + up) / cell) + Math.floor((up - across) / cell)) & 1;
      else if (kind === 'stripes') pick = Math.floor(up / 3) & 1;
      else if (kind === 'patches') pick = patches.some(([px, py]) => Math.abs(x - px) <= 2 && Math.abs(y - py) <= 2) ? 0 : -1;
      if (pick >= 0 && ramps[pick]) put(i, rampAt(ramps[pick], kind === 'patches' ? 0.15 + 0.8 * tone[i] : tone[i]));
    }
  }
}

/** A cloth's hems and cuffs: its pixels over clear or skin a pixel or two below, or beside skin - never the
 *  silhouette's sides, never a shadow or another cloth inside the garment. */
function paintTrim(on, ramp, { mat, tone }, width, rows, put) {
  const below = (x, y) => y >= rows || mat[y * width + x] === CLEAR || mat[y * width + x] === SKIN;
  const beside = (x, y) => x >= 0 && x < width && mat[y * width + x] === SKIN;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (mat[i] !== on) continue;
      if (below(x, y + 1) || below(x, y + 2) || beside(x - 1, y) || beside(x + 1, y)) put(i, rampAt(ramp, 0.35 + 0.65 * tone[i]));
    }
  }
}

/** An insignia at (left, top), on the figure alone: '#' its colour, 'o' dark, and a dark ring outside its box. */
function paintSign(mark, colour, left, top, mat, width, rows, put) {
  const inked = (col, row) => row >= 0 && row < 7 && col >= 0 && col < 7 && mark[row][col] === '#';
  for (let row = -1; row <= 7; row++) {
    for (let col = -1; col <= 7; col++) {
      const x = left + col, y = top + row, i = y * width + x;
      if (x < 0 || y < 0 || x >= width || y >= rows || mat[i] === CLEAR) continue;
      const inBox = row >= 0 && row < 7 && col >= 0 && col < 7;
      if (inked(col, row)) put(i, colour);
      else if (inBox ? mark[row][col] === 'o' : [[-1, 0], [1, 0], [0, -1], [0, 1]].some(([dx, dy]) => inked(col + dx, row + dy))) put(i, DARK);
    }
  }
}

/** A round shield on the left arm: its face toward a front or side view, its back toward the back views. */
function paintShield(shield, { bottom, centreX, height }, view, width, rows, out) {
  const across = [0.16, 0.12, 0.02, -0.1, -0.16][view] ?? 0, front = view <= 2;
  const middleX = centreX + across * height, middleY = bottom - 0.58 * height, wide = 0.085 * height, tall = 0.11 * height;
  const painter = createPainter(width, rows), whole = ellipse(middleX, middleY, wide, tall), inner = ellipse(middleX, middleY, wide - 2, tall - 2);
  painter.fill(whole, front ? shield.face : shield.back, { gain: 0.8 });
  painter.fill(minus(whole, inner), shield.rim, { gain: 1.2 });
  if (front && shield.glyph) {
    const mark = SIGNS[shield.glyph];
    for (let row = 0; row < 7; row++) for (let col = 0; col < 7; col++) if (mark[row][col] === '#') painter.set(Math.round(middleX) - 3 + col, Math.round(middleY) - 3 + row, shield.colour);
  }
  painter.outline({ keep: 0.45 });
  for (let i = 0; i < width * rows; i++) if (painter.data[i * 4 + 3]) out.set(painter.data.subarray(i * 4, i * 4 + 4), i * 4);
}

// ── the player's files ──────────────────────────────────────────────────────────────────────────────────────────────
const artPalette = async () => {
  const bytes = await (await import('../scenes/dataSource.js')).getBytes('ART_PAL.COL');
  const palette = new DFPalette();
  palette.load(new Uint8Array(bytes), 'ART_PAL.COL');
  return palette;
};
const _tables = new Map();
/** The tables of the palette `load` reads, once; a failed read is forgotten so the next ask reads again. */
function tablesOf(load) {
  if (!_tables.has(load)) {
    const pending = Promise.resolve().then(load).then(paletteTables);
    _tables.set(load, pending);
    pending.catch(() => { if (_tables.get(load) === pending) _tables.delete(load); });
  }
  return _tables.get(load);
}

/**
 * A class skin's frame (a sprite key, or classSkinKeyOf's answer), top row first: the player's classic frame
 * (`picture`, systems/classicArt.js) in ART_PAL (`palette`), painted by its class's scheme. Rejects where the
 * player's data lacks it, as a picture's failed fetch does. The pins hand their own `picture` and `palette`.
 */
export async function classSkinPicture(own, { picture = (archive, record, frame) => classicArt().picture(archive, record, frame), palette = artPalette } = {}) {
  const at = typeof own === 'string' ? classSkinKeyOf(own) : own;
  if (!at) throw new Error(`${own}: no class skin`);
  const { skin, record, frame } = at;
  const [classic, tables] = await Promise.all([picture(skin.from, record, frame), tablesOf(palette)]);
  if (!classic) throw new Error(`TEXTURE.${skin.from} record ${record} frame ${frame}: not in the player's data`);
  const height = CLASS_FIGURE * classRecordScale(skin.archive, record);
  return paintClassFrame(classic, tables, CLASS_LOOKS[skin.name], { outer: OUTER_SLOT[skin.from], view: record % 5, height });
}

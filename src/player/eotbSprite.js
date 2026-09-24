// EOTB5: THE SPRITE ON SCREEN - the loading and the sizing that turn
// EOTB3's table into a body the world can draw.
//
// The logic lives in `eotbBillboard.js` (which table, which record,
// which way round, how long a frame lasts). This file is the part that
// touches the art: the mod's own sprites, uploaded once each and drawn
// as one billboard at the player's feet, plus `UpdateBillboard`'s
// sizing and offset arithmetic (EOTB-IL, off the IL).
//
// ═══ WHY THE URLs ARE EAGER AND THE PIXELS ARE NOT ════════════════
//
// The bundle ships 3035 sprites. A non-eager glob would make each one
// its own module, which is 3035 chunks in the build; an eager glob of
// the IMAGES would decode all of them at boot. Neither is a thing to
// do to a browser.
//
// `{ eager: true, query: '?url' }` is the middle: Vite resolves every
// path to a URL STRING at build time - one object, no chunks - and
// emits the PNGs as plain assets that are fetched only when the body
// asks for one. The mod loads every texture of its 21 tables up front
// (`InitializeTextures`), and the body does the same in the background
// the moment it attaches - see `eotbBody.preload`.
//
// IN NODE the glob is not taken at all (the same door `dynamicSkies
// Assets.js` uses): `import.meta.glob` is a Vite macro, and the pins
// drive this module through its seams rather than through the bundle.

import { ORIENTATIONS, stateFor, tableArchive, spriteKey } from './eotbBillboard.js';
import { toColor32 } from '../formats/color32Order.js';   // EOTB-FLIP: the ONE row-order door a PNG crosses on its way to a world billboard
import spriteInfo from '../../vendor/eye-of-the-beholder/spriteInfo.json' with { type: 'json' };

const IN_BROWSER = typeof window !== 'undefined';
const URLS = IN_BROWSER
  ? import.meta.glob('../../vendor/eye-of-the-beholder/Textures/*/*.png', { eager: true, query: '?url', import: 'default' })
  : {};

/** `<archive>_<record>-<frame>` -> the built asset's URL. */
const BY_KEY = Object.fromEntries(
  Object.entries(URLS).map(([p, u]) => [p.split('/').pop().replace(/\.png$/, ''), u]),
);
// NAMED `eotbSpriteUrl`, not `spriteUrl`: `systems/handheldTorches.js`
// already exports a `spriteUrl` and it answers a different question
// (which torch sprite, out of the mod's own sheet). audit24's
// duplicate-declaration ratchet caught the collision - ONE DFU
// MEMBER, ONE EXPORT - and these two are genuinely different things,
// so the answer is a distinct name rather than a shared home.
export const eotbSpriteUrl = (key) => BY_KEY[key] ?? null;
/** How many sprites the build actually carries - for the probes, and
 *  so "the art is wired" is a number rather than a hope. AUDIT 68
 *  S15-eotb-spritecount-hot: counted once - the table never changes, and
 *  `eotbBody.ready()` asks about eleven times a frame. */
const SPRITE_COUNT = Object.keys(BY_KEY).length;
export const spriteCount = () => SPRITE_COUNT;

/**
 * `get_sizeMod`: METRES PER TEXTURE PIXEL. The mod keeps two, and the
 * larger one covers both the saddle and the werewolf - a rider is a
 * taller thing than a man and the transformed forms are drawn at the
 * same reach, which is why one constant serves both.
 */
export const SIZE_ON_FOOT = 0.019;
export const SIZE_RIDING_OR_TRANSFORMED = 0.029;
export const sizeMod = ({ riding = false, transformed = false, scale = 1 } = {}) =>
  (riding || transformed ? SIZE_RIDING_OR_TRANSFORMED : SIZE_ON_FOOT) * scale;

/**
 * [IL] `PlayerBillboardState.InitializeTextures`'s XML (IL_5ae7-IL_5b81):
 * the per-sprite `scale`, `X` and `Y` beside a record's FIRST frame,
 * folded to `spriteInfo.json` at EOTB0 (1035 files, six distinct
 * triples). The rect is `(X / scale, Y / scale, width / scale, height
 * / scale)`; a record with no XML is `(0, 0, width, height)`. So the
 * offset is in METRES, in the billboard's parent frame - X along the
 * view's right, Y up - and `UpdateBillboard` NEGATES X for a mirrored
 * state (IL_4ba7-IL_4bd1). `GlobalOffsetScale` never touches it:
 * `get_scaleOffset` has no caller in the assembly.
 */
export function spriteOffset(archive, record) {
  const o = spriteInfo.offsets[`${archive}_${record}-0`];
  const d = spriteInfo.default;
  return o ? { scale: o.scale ?? 1, x: o.x ?? 0, y: o.y ?? 0 } : { scale: d.scale ?? 1, x: d.x ?? 0, y: d.y ?? 0 };
}

/** [IL] The billboard's world size (IL_49dd-IL_4a15): the XML rect's
 *  size - the pixels over the XML scale - times `sizeMod`. */
export function spriteSize(w, h, state, xmlScale = 1) {
  const m = sizeMod(state);
  return { w: (w / xmlScale) * m, h: (h / xmlScale) * m };
}

/**
 * The sprite one state wants this frame: the archive, the record, the
 * frame index, and whether it is drawn flipped.
 *
 * `mirror` is answered rather than applied because a flipped sprite is
 * a DIFFERENT upload - the renderer's billboard batch has no flip - so
 * the caller uploads the mirrored pixels under their own key. Making
 * that explicit here is what stops a later reader assuming the draw
 * handles it. `flip` is `UpdateBillboard`'s own second flip - the
 * Mirror string's (IL_49b5) and the first-person rider's (IL_4b56) -
 * laid OVER the wheel's: two flips cancel, and the cache key follows
 * the pixels, not the state.
 */
export function spriteFor(table, orientation, frame, look = {}, { flip = false } = {}) {
  const st = stateFor(table, orientation);
  if (!st) return null;
  const archive = tableArchive(table, look);
  const mirror = st.mirror !== !!flip;
  return {
    archive,
    record: st.record,
    frame,
    mirror,
    key: spriteKey(archive, st.record, frame),
    /** what the renderer caches it under - the mirrored copy is its
     *  own record, because it is its own pixels */
    rec: `${st.record}-${frame}${mirror ? 'm' : ''}`,
  };
}

/** Every sprite key one table needs at a given frame - what the
 *  preload fetches, and what the probes count. */
export function tableKeys(table, frame, look = {}) {
  const out = [];
  for (let o = 0; o < ORIENTATIONS; o++) out.push(spriteFor(table, o, frame, look).key);
  return [...new Set(out)];
}

/**
 * EOTB-FLIP (2026-09-16, Mac: "The character is upside down (classic
 * sprite)"): THE ROWS, THE RIGHT WAY UP.
 *
 * A decoded PNG hands back its raster TOP row first; the port's
 * billboard batch samples a texture in getColor32 order, row 0 the
 * picture's BOTTOM (formats/color32Order.js, the whole law in one
 * place). The body decoded the mod's art through a canvas and uploaded
 * the raster as it came, so every sprite stood on its head - the exact
 * class color32Order.js records three times over (AUDIT 62 F26's
 * seasonal flats, ROAD-H H4's texture pack, HT3's held torch) and this
 * arc walked into a fourth time, because its decode was its own door
 * rather than the one the dropped torch already takes
 * (`toColor32(decodePng(bytes))`).
 *
 * This is that door, in the pixel shape the mirror below reads: a
 * Uint32 a pixel over the bytes toColor32 answered. ONE converter; a
 * second flip anywhere on this path is how a picture ends up flipped
 * twice.
 *
 * @param {{width:number,height:number,data:Uint8Array}} image a decoded PNG, top row first
 * @returns {{width:number,height:number,colors:Uint32Array}} the world billboard's order, bottom row first
 */
export function worldOrderColors(image) {
  const { width, height, colors } = toColor32(image);
  return { width, height, colors: new Uint32Array(colors.buffer, colors.byteOffset, colors.byteLength / 4) };
}

/**
 * Mirror one sprite's pixels row by row, for a state that draws
 * flipped. Order-agnostic: a row is a row whichever way up the picture
 * is stored. Browser-free - the pins drive it directly.
 */
export function flipRows(colors, w, h) {
  const out = new Uint32Array(colors.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) out[y * w + (w - 1 - x)] = colors[y * w + x];
  }
  return out;
}

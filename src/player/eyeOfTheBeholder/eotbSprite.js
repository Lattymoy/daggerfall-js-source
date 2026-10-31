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

import { ORIENTATIONS, stateFor, tableArchive, spriteKey, STATE_TABLES, frameCount } from './eotbBillboard.js';
import { layeredSprite, isLayeredKey, decodeLayered } from './layeredArmor.js';   // WORN-ARMOUR: the on-foot body in the armour it wears
import { classSkinOf, classRecord, classFrame, classRecordScale } from '../classSkins.js';   // SKIN2: Daggerfall's classes, past the mod's sixteen
import { toColor32, toColor32OrderInPlace } from '../../formats/color32Order.js';   // EOTB-FLIP: the ONE row-order door a PNG crosses on its way to a world billboard
import { horseLookCode, horseLookOfCode, lookSuffix, recolorHorse } from '../../systems/horse/horseCoats.js';   // COATS1: the mount's look
import { decodePng } from '../../systems/textureReplacement.js';   // EOTB-FLIP: the one PNG decoder the world's other PNG billboards take
import { decodeServedPng } from '../../systems/vanillaEnhanced/vanillaEnhancedPack.js';   // FIRST-VISIT: and its decode workers
import spriteInfo from '../../../vendor/eye-of-the-beholder/spriteInfo.json' with { type: 'json' };

const IN_BROWSER = typeof window !== 'undefined';
const URLS = IN_BROWSER
  ? {
    ...import.meta.glob('../../../vendor/eye-of-the-beholder/Textures/*/*.png', { eager: true, query: '?url', import: 'default' }),
    // SKIN2: the class skins, keyed the same way (`<archive>_<record>-<frame>`) - their archives (1504-1541) are not the mod's (112364-112386)
    ...import.meta.glob('../../../vendor/class-skins/Textures/*/*.png', { eager: true, query: '?url', import: 'default' }),
  }
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
export const eotbSpriteUrl = (key) => (isLayeredKey(key) ? key : BY_KEY[key] ?? null);   // WORN-ARMOUR: a worn-armour key is its own "URL" - the decoders compose it (layeredArmor.js decodeLayered)
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
  const xml = o ? { scale: o.scale ?? 1, x: o.x ?? 0, y: o.y ?? 0 } : { scale: d.scale ?? 1, x: d.x ?? 0, y: d.y ?? 0 };
  const s = spriteArtScale(archive, record);
  return s === 1 ? xml : { ...xml, scale: xml.scale * s };
}

/** A RECORD'S ART SCALE: its pixels a set's pixel - 1 for the sets. What spriteOffset scales a record by, and the rows a
 *  picture's marks are read at (render/armoryPose.js spriteMarks' `art`). Pure. */
export function spriteArtScale(/** @type {number} */ archive, /** @type {number} */ record) {
  // ACRO-SHORT: a class sheet's record drawn at another scale carries its own (player/classSkins.js classRecordScale)
  const k = classRecordScale(archive, record);
  const s = k * eotbRecordScale(archive, record);   // RPT1026-MISC SPELL-SHORT: and a set of the mod's own drawn so
  return s;
}

/**
 * RPT1026-MISC SPELL-SHORT (a private report: the Fighter Mage (female) skin shrank in third person while casting, and no
 * other skin tried did). THE MOD'S OWN ART, DRAWN SMALL. Set 10's spell sheets
 * (archive 112374, records 45-59: the readied spell, its walk and its cast) draw the woman 80 pixels from hood to boot,
 * where every other sheet of hers draws her 107-112 (the idle 110) - and the mod's XML gives those records scale 1.0, so
 * she shrank by a quarter as the spell came up, in Daggerfall Unity with the mod as here. Every other set's spell sheets
 * stand as tall as its idle or taller (the raised arm). The records are given the scale they were drawn at (80/110, the
 * spell sheets' figure over the idle's), ACRO-SHORT's door for a class sheet: the XML scale `spriteOffset` hands every
 * caller that sizes a sprite - the body, its placement, the peers. A DEPARTURE from the mod's XML (Ledger A).
 */
export const EOTB_RECORD_SCALE = Object.freeze({ 112374: Object.freeze({ from: 45, to: 59, scale: 80 / 110 }) });
/** The scale a record of the mod's own sets was drawn at against its set (SPELL-SHORT); 1 for every other. */
export function eotbRecordScale(archive, record) {
  const r = EOTB_RECORD_SCALE[archive];
  return r && record >= r.from && record <= r.to ? r.scale : 1;
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
  const mirror = st.mirror !== !!flip;
  // SKIN2: an on-foot table of a CLASS skin reads the class sheet's own record and frame (player/classSkins.js); the
  // mounted and the beast tables are the mod's whatever is worn on foot
  // WORN-ARMOUR (player/eyeOfTheBeholder/layeredArmor.js): with the option on, an on-foot table draws the armour the
  // body wears - its helmet, chest and legs pieces in their families and metals - over whatever skin is chosen; an
  // outfit with no art falls through to that skin
  if (look.wornArmour && !table.endsWith('Horse') && !table.endsWith('Lycan')) {
    const worn = layeredSprite(table, st.record - STATE_TABLES[table].base, frame, frameCount(table), look, mirror);
    if (worn) return { ...worn, view: st.record - STATE_TABLES[table].base };
  }
  const skin = !table.endsWith('Horse') && !table.endsWith('Lycan') ? classSkinOf(look.onFoot) : null;
  if (skin) {
    const record = classRecord(skin, table, st.record - STATE_TABLES[table].base);
    const f = classFrame(skin, record, frame, frameCount(table));
    return { archive: skin.archive, record, frame: f, mirror, key: spriteKey(skin.archive, record, f), rec: `${record}-${f}${mirror ? 'm' : ''}`, view: st.record - STATE_TABLES[table].base };
  }
  const archive = tableArchive(table, look);
  // COATS1: a mounted table's horse wears the rider's horse's look (`look.horse`, its code - systems/horse/horseCoats.js) -
  // the same picture dyed (lookedPixels), under its own record; the bay as drawn keeps the record it always had
  const horse = table.endsWith('Horse') ? horseLookCode(horseLookOfCode(look.horse ?? 0)) : 0;
  return {
    archive,
    record: st.record,
    frame,
    mirror,
    key: spriteKey(archive, st.record, frame),
    /** what the renderer caches it under - the mirrored copy is its
     *  own record, because it is its own pixels */
    rec: `${st.record}-${frame}${mirror ? 'm' : ''}${lookSuffix(horse)}`,
    horse,
    /** ARMORY: which of the five views it is (eotbBillboard.js RECORD_OFFSETS: 0 the front, 2 the side, 4 the back) */
    view: st.record - STATE_TABLES[table].base,
  };
}

/** COATS1: a sprite's pixels as its state draws them - its horse's look dyed in (systems/horse/horseCoats.js recolorHorse;
 *  none but a mounted table's ever has one), on the world's rows (bottom first, worldOrderColors) - before the mirror,
 *  so a mirrored view is the other flank. */
export const lookedPixels = (s, image) => (s?.horse ? recolorHorse(image, s.horse) : image);

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
export function worldOrderColors(image, { owned = false } = {}) {
  // PERF-PEERS5: a raster the caller owns (a PNG it has just decoded) is turned in its own bytes - the same answer
  if (owned) { const { width, height, data } = toColor32OrderInPlace(image); return { width, height, colors: new Uint32Array(data.buffer, data.byteOffset, data.byteLength / 4) }; }
  const { width, height, colors } = toColor32(image);
  return { width, height, colors: new Uint32Array(colors.buffer, colors.byteOffset, colors.byteLength / 4) };
}

/** LAYERED-GLOW: a composed worn-armour picture in the world's row order, with its weapon's own px (`held`, top row
 *  first - eotbGlow.js heldGlowPx). */
export function worldOrderLayered(image) {
  const held = image.held ?? null;
  return { ...worldOrderColors(image, { owned: true }), held, ...(image.provisional ? { provisional: true } : {}) };   // AUDIT: drawn before its weapon's picture came
}

/**
 * THE BROWSER DECODE, lifted out so it can be replaced (eotbBody.js takes it as its `decode`; PROFILE-SLOTS: the
 * profile's stage too, without the body's own module). EOTB-FLIP: the dropped torch's door - `decodePng`, then the one
 * row-order converter - never a canvas of its own. A decode that fails answers a rejection. FIRST-VISIT: decodeServedPng
 * fetches and decodes.
 */
export async function decodeSprite(url) {
  if (isLayeredKey(url)) return worldOrderLayered(await decodeLayered(url, decodePng, { picture: decodeServedPng }));   // WORN-ARMOUR: composed from its strip
  return worldOrderColors(await decodeServedPng(url), { owned: true });   // PERF-PEERS5: the decode is this door's alone - turned in its own bytes
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

// EOTB5: THE SPRITE ON SCREEN - the loading and the sizing that turn
// EOTB3's table into a body the world can draw.
//
// The logic lives in `eotbBillboard.js` (which table, which record,
// which way round, how long a frame lasts). This file is the part that
// touches the art: the sets' sprites, built once each and drawn
// as one billboard at the player's feet, plus `UpdateBillboard`'s
// sizing and offset arithmetic (EOTB-IL, off the IL of Eye Of The
// Beholder 2.1's assembly).
//
// OWN-WORK4 (2026-10-31): no sprite is carried. 2869 of the mod's 3035
// are Daggerfall's own records, built from the player's ARENA2
// (eotbDerived.json, NO-BETHESDA2); the death the author drew is ours
// (eotbDeath.js), and the class skins are built too (classSkinArt.js).
// A sprite's "URL" is a marker its build answers.
//
// IN NODE no marker is handed out (`eotbSpriteUrl`), and the pins drive
// this module through its seams rather than through the bundle.

import { ORIENTATIONS, stateFor, tableArchive, spriteKey, STATE_TABLES, frameCount, ARCHIVE_LYCAN } from './eotbBillboard.js';
import { layeredSprite, isLayeredKey, decodeLayered } from './layeredArmor.js';   // WORN-ARMOUR: the on-foot body in the armour it wears
import { classSkinOf, classRecord, classFrame, classRecordScale, classSkinKeyOf, CLASS_SPRITE_COUNT } from '../classSkins.js';   // SKIN2: Daggerfall's classes, past the mod's sixteen
import { toColor32, toColor32OrderInPlace } from '../../formats/color32Order.js';   // EOTB-FLIP: the ONE row-order door a PNG crosses on its way to a world billboard
import { horseLookCode, horseLookOfCode, lookSuffix, recolorHorse } from '../../systems/horse/horseCoats.js';   // COATS1: the mount's look
import { decodePng } from '../../systems/textureReplacement.js';   // EOTB-FLIP: the one PNG decoder the world's other PNG billboards take
import { decodeServedPng } from '../../systems/vanillaEnhanced/vanillaEnhancedPack.js';   // FIRST-VISIT: and its decode workers
import EOTB_ANCHORS from './eotbAnchors.json' with { type: 'json' };   // OWN-AUDIT: where each sprite stands, measured by our law
import { anchorShift, anchorScale } from './eotbAnchor.js';   // OWN-AUDIT: and the law's reader
import EOTB_DERIVED from './eotbDerived.json' with { type: 'json' };   // NO-BETHESDA2: the pictures that are Daggerfall's own
import { classicArt } from '../../systems/classicArt.js';   // NO-BETHESDA2: and the one reader that builds them from the player's files
import { deathSpec, ownDeathKeys, layDown } from './eotbDeath.js';   // OWN-WORK4: the death, ours

const IN_BROWSER = typeof window !== 'undefined';
/** OWN-WORK4: the death sprites that are ours (eotbDeath.js), by key. */
const OWN_DEATH = Object.freeze(ownDeathKeys(EOTB_DERIVED));

// NAMED `eotbSpriteUrl`, not `spriteUrl`: `systems/handheldTorches.js`
// already exports a `spriteUrl` and it answers a different question
// (which torch sprite, out of the mod's own sheet). audit24's
// duplicate-declaration ratchet caught the collision - ONE DFU
// MEMBER, ONE EXPORT - and these two are genuinely different things,
// so the answer is a distinct name rather than a shared home.
export const eotbSpriteUrl = (key) => (isLayeredKey(key) ? key : IN_BROWSER ? derivedSpriteUrl(key) ?? classSpriteUrl(key) : null);   // WORN-ARMOUR: a worn-armour key is its own "URL" - the decoders compose it (layeredArmor.js decodeLayered)
/** How many sprites the build can draw - for the probes, and
 *  so "the art is wired" is a number rather than a hope. AUDIT 68
 *  S15-eotb-spritecount-hot: counted once - the table never changes, and
 *  `eotbBody.ready()` asks about eleven times a frame. NO-BETHESDA2: the specs; OWN-WORK4: our death and class frames. */
const SPRITE_COUNT = IN_BROWSER ? Object.keys(EOTB_DERIVED).length + OWN_DEATH.length + CLASS_SPRITE_COUNT : 0;
export const spriteCount = () => SPRITE_COUNT;

// ── NO-BETHESDA2 (2026-10-31, the owner): A SPRITE THAT IS DAGGERFALL'S OWN ────────────────────────────────────────
// 2869 of the bundle's 3035 are TEXTURE records exactly. They are not carried: eotbDerived.json names each one's record
// and palette, and the picture is built from the player's own ARENA2 (systems/classicArt.js). OWN-WORK4: the other 166,
// the author's death, are ours - the class's struck record and that record laid down (eotbDeath.js deathSpec).
// A derived sprite's "URL" is a marker the decoders build, as a worn-armour key is composed. In node, as the glob, none.
const DERIVED_MARK = 'DF:';
export const isDerivedSprite = (url) => typeof url === 'string' && url.startsWith(DERIVED_MARK);
/** The spec for a bare key: eotbDerived.json's, or our death's. */
const specOf = (key) => EOTB_DERIVED[key] ?? deathSpec(key, EOTB_DERIVED);
/** The marker for `key`, or null where no spec is named for it. Pure, browser or not. */
export const derivedSpriteUrl = (key) => (specOf(key) ? `${DERIVED_MARK}${key}` : null);
/** The spec a marker (or a bare key) names - `{ from, pal }` (formats/derivedTexture.js), with `laid` for a body laid
 *  down - or null. */
export const derivedSpriteSpec = (url) => specOf(isDerivedSprite(url) ? url.slice(DERIVED_MARK.length) : url) ?? null;
/** OWN-WORK4 (2026-10-31): a class skin's frame is ours, painted on the player's own class sheet (player/classSkinArt.js,
 *  loaded on the first one) - the same marker, the same paced builds. Pure, browser or not. */
export const classSpriteUrl = (key) => (classSkinKeyOf(key) ? `${DERIVED_MARK}${key}` : null);
const buildClassFrame = (own) => import('../classSkinArt.js').then((art) => art.classSkinPicture(own));
/** The builds, a few milliseconds of them a task: once a TEXTURE file lands, a set's 145 built in one task took ~85 ms. */
const BUILD_BUDGET_MS = 6;
const _builds = [];
let _building = false;
async function drainBuilds() {
  _building = true;
  while (_builds.length) {
    const start = performance.now();
    while (_builds.length && performance.now() - start < BUILD_BUDGET_MS) await _builds.shift()();
    if (_builds.length) await new Promise((res) => setTimeout(res, 0));
  }
  _building = false;
}
/** OWN-WORK4: a spec built - a body laid down is its struck record built, then turned onto the ground by our code. */
const buildSpec = async (spec, build) => (spec.laid == null ? build(spec) : layDown(await build({ from: spec.from, pal: spec.pal }), spec.laid));
/** A derived sprite's picture, top row first, built from the player's own record (`build` the pins' door). Rejects
 *  where the player's file is missing, as a PNG's failed fetch does. */
export function buildDerivedSprite(url, build = (spec) => classicArt().build(spec)) {
  const own = classSkinKeyOf(isDerivedSprite(url) ? url.slice(DERIVED_MARK.length) : url);   // OWN-WORK4: a class frame, ours
  const spec = own ? null : derivedSpriteSpec(url);
  if (!own && !spec) return Promise.reject(new Error(`${url}: no spec in eotbDerived.json`));
  return new Promise((resolve, reject) => {
    _builds.push(() => Promise.resolve().then(() => (own ? buildClassFrame(own) : buildSpec(spec, build))).then(resolve, reject));
    if (!_building) drainBuilds();
  });
}

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
 * A SPRITE'S PLACE, `{ scale, x, y }`, in the shape `UpdateBillboard` read the mod's XML (IL_4a1a-IL_4bd1): metres in
 * the billboard's frame, X along the view's right (negated for a mirrored state), Y up, each divided by `scale`.
 * OWN-AUDIT (2026-11-01): the author's per-record table is gone. The shift is our law's (eotbAnchor.js, eotbAnchors.json):
 * the body's centre line on the player's spot and the lowest foot on the ground, per canvas, so `frame` matters only
 * where a record's frames are drawn on two. The scale is the record's art scale. A sprite the law has not measured (a
 * class sheet, a worn look) stands as drawn.
 */
export function spriteOffset(/** @type {number} */ archive, /** @type {number} */ record, frame = 0) {
  const scale = spriteArtScale(archive, record);
  const own = anchorShift(EOTB_ANCHORS, archive, record, frame);
  if (!own) return { scale, x: 0, y: 0 };
  const perPixel = archive >= ARCHIVE_LYCAN ? SIZE_RIDING_OR_TRANSFORMED : SIZE_ON_FOOT;   // the beasts and the horses are drawn at the larger size
  return { scale, x: own.right * perPixel, y: own.up * perPixel };
}

/** A RECORD'S ART SCALE: its pixels a set's pixel - 1 for the sets. What spriteOffset scales a record by, and the rows a
 *  picture's marks are read at (render/armoryPose.js spriteMarks' `art`). Pure. */
export function spriteArtScale(/** @type {number} */ archive, /** @type {number} */ record) {
  // ACRO-SHORT: a class sheet's record drawn at another scale carries its own (player/classSkins.js classRecordScale)
  const k = classRecordScale(archive, record);
  const s = k * eotbRecordScale(archive, record);   // RPT1026-MISC SPELL-SHORT: and a set's sheet drawn small (our law measures it)
  return s;
}

/**
 * RPT1026-MISC SPELL-SHORT (a private report: the Fighter Mage (female) skin shrank in third person while casting).
 * Set 10's spell sheets (archive 112374, records 45-59) draw the woman 80 pixels from hood to boot against her idle's
 * 110. OWN-AUDIT (2026-11-01): the scale is measured, not typed: our law scales a sheet drawn short of its view's
 * standing figure (eotbAnchor.js SHORT_SHEET), and over every set it finds these fifteen records alone, at 80/110.
 */
export function eotbRecordScale(/** @type {number} */ archive, /** @type {number} */ record) {
  return anchorScale(EOTB_ANCHORS, archive, record);
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
 *  so a mirrored view is the other flank. AUDIT-STOREFRONT: its rider spared (`riders`, ridersReady's answer), its view said. */
export const lookedPixels = (s, image, riders = null) => (s?.horse ? recolorHorse(image, s.horse, { spare: riderSpareOf(riders, s.key, image.width, image.height), view: s.view }) : image);

/** AUDIT-STOREFRONT: THE MOUNTED PICTURES' RIDERS (eotbRiderMasks.js, baked by tools/bakeEotbRiders.mjs from the five
 *  sets), loaded once, on the first dye of a mounted picture - never at boot. `load` the import (a test hands its own). */
let _riders = /** @type {Promise<Readonly<Record<string, string>>|null>|null} */ (null);
const loadRiders = () => import('./eotbRiderMasks.js');
// AUDIT-STOREFRONT II (lane C 3): a load that fails answers none - that picture dyed with no rider spared, as before the
// masks - and is forgotten, so the next mounted picture asks again. Kept, it failed every mounted sprite for the session.
export const ridersReady = (load = loadRiders) => (_riders ??= load().then((m) => m.RIDER_MASKS, () => { _riders = null; return null; }));
/** A picture's rider as the dye's `spare`, on the world's rows (bottom first): 1 a pixel of his. None for a picture the
 *  masks do not hold, or hold at another size (art replaced since the bake). */
export function riderSpareOf(riders, key, width, height) {
  const m = riders?.[key];
  if (!m) return null;
  const at = m.indexOf(':'), [w, h] = m.slice(0, at).split('x').map(Number);
  if (w !== width || h !== height) return null;
  const bin = globalThis.atob(m.slice(at + 1)), out = new Uint8Array(w * h);
  let i = 0, his = 0;
  for (let b = 0; b < bin.length;) {
    let run = 0, shift = 0, c;
    do { c = bin.charCodeAt(b++); run += (c & 127) * 2 ** shift; shift += 7; } while (c & 128);
    if (his) for (let k = i; k < i + run; k++) { const x = k % w; out[(h - 1 - (k - x) / w) * w + x] = 1; }   // the bake's rows top first
    i += run; his ^= 1;
  }
  return out;
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
  return { ...worldOrderColors(image, { owned: true }), held, ...(image.shield ? { shield: image.shield } : {}), ...(image.provisional ? { provisional: true } : {}) };   // AUDIT: drawn before its weapon's picture came; LAYERED-SHIELD: its shield's px
}

/**
 * THE BROWSER DECODE, lifted out so it can be replaced (eotbBody.js takes it as its `decode`; PROFILE-SLOTS: the
 * profile's stage too, without the body's own module). EOTB-FLIP: the dropped torch's door - `decodePng`, then the one
 * row-order converter - never a canvas of its own. A decode that fails answers a rejection. FIRST-VISIT: decodeServedPng
 * fetches and decodes. NO-BETHESDA2: a derived sprite is built (`build` the pins' door) and takes the same turn.
 */
export async function decodeSprite(url, { build = undefined } = {}) {
  if (isLayeredKey(url)) return worldOrderLayered(await decodeLayered(url, decodePng, { picture: decodeServedPng }));   // WORN-ARMOUR: composed from its strip
  if (isDerivedSprite(url)) return decodeDerivedSprite(url, build);
  return worldOrderColors(await decodeServedPng(url), { owned: true });   // PERF-PEERS5: the decode is this door's alone - turned in its own bytes
}
/** NO-BETHESDA2: a derived sprite on the world's rows - its build is a fresh raster, so it is turned in its own bytes. */
export const decodeDerivedSprite = async (url, build = undefined) => worldOrderColors(await buildDerivedSprite(url, build), { owned: true });

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

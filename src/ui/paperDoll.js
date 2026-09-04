// U8f/U8g: the PAPERDOLL - the avatar with its equipped items (DFU
// PaperDoll + PaperDollRenderer + ItemHelper.GetItemImage, MIT
// Daggerfall Workshop). DFU renders the doll into ONE texture; we
// composite the same way CPU-side over INDEXED bitmaps (which also
// gives GetEquipIndex's click resolution for free). Verbatim laws:
// - panel 110x184 at (49,13); background = subrect (8,7,110,184) of
//   the context SCBG (town SCBG04I0; dungeon/graveyard/region
//   branches pend their contexts);
// - layer order (Refresh): cloak interiors -> nude body -> the
//   NoPlayerNudity censor welds (clothed sheet in waistHeight-40
//   bands, gated on chest/legs slots) -> head -> items ascending
//   drawOrder (BlitItems; jewellery only when EquipSlot > 11);
// - every layer places by its OWN baked offset minus paperDollOrigin
//   (200,8); TEXTURE.237 records 52/54 carry DFU's known-bad-offset
//   fix (237,43);
// - item images (GetItemImage forPaperDoll + GetInventoryTexture*):
//   clothing = template.playerTextureArchive + bodyMorphology
//   (SetRace), the morphology resolved from the LIVE race since S3c/U9
//   - `raceByKey(race)?.morphologyIndex` over systems/races.js's
//   MORPHOLOGY_OF -> BODY_MORPHOLOGY, all eight races, Human's +2 now
//   only the fallback; record = playerTextureRecord
//   (+1 for cloaks' interior-first record) + variant;
//   armor = firstMale/FemaleArchive (249/245) + morphology, variant
//   CLAMPED by material family (SetVariant: cuirass leather 0 /
//   chain 4 / plate 1..3, greaves 0..1/6/2..5, pauldrons 0/4/1..3,
//   gauntlets 0/1, boots 0/1..2);
//   weapons = the template archive; an Either-hand weapon worn
//   RIGHT draws record + 1;
//   masks removed (ChangeMask: index 0xFF -> transparent);
// - dyes (ChangeDye through the C5b tables): clothing dye on the
//   0x60 band (item.dye; Blue = identity); weapons/armor on the
//   0x70 band by material (GetWeapon/GetArmorDyeColor - leather and
//   chain fall to the identity None table);
// - the click mask (GetEquipIndex): iterate the blitted item layers
//   BACKWARDS, the first non-transparent pixel wins its equip slot.
// Breton/male/face 0 is only the PRE-CHARGEN default (chargen fronts
// identity and this file reloads on identity change - AUDIT 23).

import { ImgFile } from '../formats/imgFile.js';
import { racialPaperDollBackground, racialOverrideHeadArt, racialSuppressPaperDollBodyAndItems } from '../systems/vampirism.js';   // V5: the curse art laws, both curses' one switch
import { CifRciFile } from '../formats/cifRciFile.js';
import { getBool } from '../systems/settings.js';   // UI3: EnableGeographicBackgrounds; ChildGuard/PlayerNudity gates the welds
import { EQUIP_SLOTS, equipTableOf, getItemHands, ITEM_HANDS } from '../systems/equip.js';
import { getTemplate, paperdollOrder } from '../characters/paperdoll.js';
import { applyDyeToIndex, DYE_TARGETS, DYE_COLORS, CLOTHING_DYES } from '../characters/dyes.js';
import { clampArmorVariant, armorArchive, HUMAN_MORPHOLOGY, ARMOR_MATERIAL } from '../systems/armorMaterials.js';
import { raceArt, FACES_PER_RACE, raceByKey } from '../systems/races.js';   // S3c/U9: all eight races

export const PAPERDOLL_W = 110;
export const PAPERDOLL_H = 184;
export const PAPERDOLL_ORIGIN = Object.freeze([200, 8]);   // paperDollOrigin
export const BG_SUBRECT = Object.freeze([8, 7, 110, 184]); // backgroundSubRect
export const WAIST_HEIGHT = 40;
// PaperDoll.armourLabelPos verbatim - the 7 armor value labels in
// BodyParts order (Head, RightArm, LeftArm, Chest, Hands, Legs,
// Feet), panel-relative
export const ARMOR_LABEL_POS = Object.freeze([[70, 12], [20, 38], [86, 38], [12, 58], [6, 90], [18, 120], [22, 168]]);
// GetWeaponDyeColor / GetArmorDyeColor (plate m = material - 0x0200)
export const MATERIAL_DYES = Object.freeze([
  DYE_COLORS.Iron, DYE_COLORS.Steel, DYE_COLORS.Silver, DYE_COLORS.Elven, DYE_COLORS.Dwarven,
  DYE_COLORS.Mithril, DYE_COLORS.Adamantium, DYE_COLORS.Ebony, DYE_COLORS.Orcish, DYE_COLORS.Daedric,
]);
const CLOAK_TEMPLATES = new Set([154, 155, 191, 192]);
export { CLOTHING_DYES };

// S3c/U9: all EIGHT races now come from systems/races.js (DFU
// RaceTemplate verbatim) - this file used to carry a Breton-only
// table, which the U8f/U8g records named as standing in for the other
// seven. raceArt/FACES_PER_RACE/raceByKey are imported above and every
// morphology read goes through them.
const CONTEXT_BG = Object.freeze({ town: 'SCBG04I0.IMG', dungeon: 'SCBG07I0.IMG', graveyard: 'SCBG08I0.IMG' });

// UI3 - GEOGRAPHIC BACKGROUNDS: PaperDoll.GetPaperDollBackground
// (:207-230). `EnableGeographicBackgrounds` ships FALSE, so DFU's
// DEFAULT paperdoll backdrop is the RACE's - and the port has been
// passing `context = 'town'` since U8f, which is the geographic
// answer. Every player has been looking at the town backdrop.
//
// With the setting on: town, then dungeon, then graveyard, then the
// REGION's own char - and a region index outside the table or the
// reader's count falls back to the race's, which is why the guard is
// not just a bounds check but the same answer as `off`.

/** `regionBackgroundIdxChars` (:203-205), all 64. */
export const REGION_BACKGROUND_CHARS = Object.freeze([
  '3', '1', '2', '2', '2', '0', '5', '1', '5', '2', '1', '1', '2', '2', '2', '0',
  '2', '0', '2', '2', '3', '0', '5', '6', '2', '2', '2', '2', '0', '0', '0', '0',
  '0', '6', '6', '6', '0', '6', '6', '0', '6', '0', '0', '3', '3', '3', '3', '3',
  '3', '5', '5', '5', '5', '1', '3', '3', '3', '2', '0', '0', '2', '3',
]);

/**
 * GetPaperDollBackground, verbatim.
 * @param {string} raceBackground - RaceTemplate.PaperDollBackground
 * @param {{enabled?:boolean, region?:number, regionCount?:number,
 *          inTown?:boolean, inDungeon?:boolean, inGraveyard?:boolean}} where
 *   `region` is GetPoliticIndex - 128, as DFU computes it.
 */
export function paperDollBackground(raceBackground, {
  enabled = getBool('GUI', 'EnableGeographicBackgrounds'),
  region = -1, regionCount = REGION_BACKGROUND_CHARS.length,
  inTown = false, inDungeon = false, inGraveyard = false,
} = {}) {
  if (!enabled) return raceBackground;
  if (region < 0 || region >= regionCount || region >= REGION_BACKGROUND_CHARS.length) return raceBackground;
  if (inTown) return CONTEXT_BG.town;
  if (inDungeon) return CONTEXT_BG.dungeon;
  if (inGraveyard) return CONTEXT_BG.graveyard;
  return `SCBG0${REGION_BACKGROUND_CHARS[region]}I0.IMG`;
}

// AUDIT 17e F32/F33: clampArmorVariant + the armor archive rule
// moved to systems/armorMaterials.js (they were duplicated here with
// a fabricated Chain2 constant). Re-exported for existing pins.
export { clampArmorVariant };

/** GetItemImage(forPaperDoll) resolution: {archive, record, dye,
 *  target} or null for groups with no paperdoll layer. */
export function paperdollItemImage(item, { gender = 'male', race = 'Breton' } = {}) {
  const morph = raceByKey(race)?.morphologyIndex ?? HUMAN_MORPHOLOGY;
  const t = getTemplate(item.templateIndex);
  if (!t) return null;
  const variants = t.variants ?? 0;
  if (item.group === 'MensClothing' || item.group === 'WomensClothing') {
    let record = t.playerTextureRecord;
    if (variants > 0) record += (CLOAK_TEMPLATES.has(item.templateIndex) ? 1 : 0) + Math.min(item.variant ?? 0, variants - 1);
    return { archive: t.playerTextureArchive + morph, record, dye: item.dye ?? DYE_COLORS.Blue, target: DYE_TARGETS.Clothing };
  }
  if (item.group === 'Armor') {
    const archive = armorArchive(gender, morph);
    const m = item.material ?? 0;
    let record = t.playerTextureRecord;
    if (variants > 0) record += clampArmorVariant(item.templateIndex, m, item.variant ?? 0);
    const dye = m >= ARMOR_MATERIAL.Iron ? MATERIAL_DYES[m - ARMOR_MATERIAL.Iron] ?? DYE_COLORS.Unchanged : DYE_COLORS.Unchanged;
    return { archive, record, dye, target: DYE_TARGETS.WeaponsAndArmor };
  }
  if (item.group === 'Weapons') {
    let record = t.playerTextureRecord;
    // an Either-hand weapon worn RIGHT uses the +1 record
    if (item.equipSlot === EQUIP_SLOTS.RightHand && getItemHands(item) === ITEM_HANDS.Either) record += 1;
    return { archive: t.playerTextureArchive, record, dye: MATERIAL_DYES[item.material ?? 0] ?? DYE_COLORS.Unchanged, target: DYE_TARGETS.WeaponsAndArmor };
  }
  if (item.group === 'Jewellery' && (item.equipSlot ?? -1) > 11) {   // IsEquippedToBody
    return { archive: t.playerTextureArchive, record: t.playerTextureRecord, dye: null, target: null };
  }
  return null;
}

let _art = null;      // indexed bitmaps + palette
let _live = null;     // { tex } - the current composite
let _pixels = null;   // U59: the same composite as RGBA, for the DOM
let _layout = [];     // blitted item layers, draw order (backwards hit test)
let _deps = null;
let _version = 0;
let _refreshing = false;
let _pending = null;   // AUDIT 17e F16: the coalesced follow-up

/** S3c/U9: the art set is keyed by the ENTITY'S identity. Reloads
 *  when the identity changes (chargen picks a race/gender/face after
 *  boot, and the doll must follow) - `_identity` is the guard that
 *  used to be a bare `if (_art) return`. */
let _identity = null;
export async function preloadPaperDollArt(deps, { race = 'Breton', gender = 'male', faceIndex = 0, context = 'town', where = null } = {}) {
  const key = `${race}|${gender}|${faceIndex}|${context}|${where?.region ?? -1}`;
  if (_art && _identity === key) return;
  try {
    const { fetchBytes, palette } = deps;
    const art = raceArt(race, gender);
    const [unclothed, clothed] = art.body;
    const loadImgBmp = async (name) => {
      const img = new ImgFile();
      img.load(await fetchBytes(name), name, palette);
      return { bmp: img.getDFBitmap(), off: img.imageOffset };
    };
    const face = new CifRciFile();
    face.load(await fetchBytes(art.heads), art.heads, palette);
    const fi = Math.max(0, Math.min(FACES_PER_RACE - 1, faceIndex | 0));
    _art = {
      palette,
      // UI3: the SETTING decides, not the caller's context word. Off -
      // which is how it ships - every race gets its own backdrop.
      bg: await loadImgBmp(paperDollBackground(art.background, {
        inTown: context === 'town', inDungeon: context === 'dungeon', inGraveyard: context === 'graveyard',
        region: where?.region ?? -1, regionCount: where?.regionCount ?? REGION_BACKGROUND_CHARS.length,
      })),
      nude: await loadImgBmp(unclothed),
      clothed: await loadImgBmp(clothed),
      head: { bmp: face.getDFBitmap(fi, 0), off: face.getOffset(fi) },
    };
    _identity = key;
    // AUDIT 17f: _deps carries the identity paperdollItemImage keys
    // off, so it may only advance once the new art is actually in
    // hand - a failed load used to leave a Khajiit _deps addressing
    // Breton bitmaps.
    _deps = { ...deps, gender, race };
    // AUDIT 17f / EVERY ALLOCATION HAS AN OWNER: dropping _live here
    // orphaned the previous composite's GL texture - refreshPaperDoll
    // frees `prevKey` from _live, and _live was already null. Chargen
    // reaches this path on every identity change.
    if (_live) { deps.renderer?.releaseTexture?.('img', _live.key); }
    _live = null;   // the composite is stale: recompose on the next draw
    _pixels = null;   // U59: and the DOM's copy of it, or a Khajiit draws the Breton doll
    _layout = [];   // and its click mask with it
  } catch { console.warn('[paperdoll] BODY/FACE/SCBG art unavailable; the panel stays bare'); }
}

/** Load the art for whatever identity the entity currently carries
 *  (chargen writes race/gender/faceIndex onto it). */
export const preloadPaperDollForEntity = (deps, entity, context = 'town') =>
  preloadPaperDollArt(deps, {
    race: entity?.race ?? 'Breton', gender: entity?.gender ?? 'male',
    faceIndex: entity?.faceIndex ?? 0, context,
  });
export const paperDollArtLoaded = () => !!_art;

/** Blit an indexed bitmap into the 110x184 RGBA composite at its
 *  baked offset minus paperDollOrigin. rows = [y0,y1) source band
 *  (the censor welds); remap = the dye. Index 0 stays transparent;
 *  0xFF is the classic mask (removed - ChangeMask). */
/* PX29, REVERTED (PX29b). A mask of "which pixels are the figure"
   was written here so the enhanced pack could drop DFU's panel. It
   blanked the doll ENTIRELY in play, and the reason is worth keeping:
   `_pixels` publishes at the END of refreshPaperDoll - "the composite
   swaps in whole when done" - and the mask published at the START.
   Any pass that returned early left a VALID composite paired with an
   all-zero mask, so every pixel read as background and the figure
   vanished. Two buffers describing one image must swap in together;
   whoever tries this again should build the mask locally and publish
   it beside `_pixels`, in the same statement, or not at all. */

function blit(out, img, { rows = null, remap = null, atOffset = null } = {}) {
  const [orgX, orgY] = PAPERDOLL_ORIGIN;
  const off = atOffset ?? img.off;
  const px = off.x - orgX, py = off.y - orgY;
  const { width, height, data } = img.bmp;
  const [y0, y1] = rows ?? [0, height];
  for (let y = y0; y < y1; y++) {
    const dy = py + y;
    if (dy < 0 || dy >= PAPERDOLL_H) continue;
    for (let x = 0; x < width; x++) {
      const dx = px + x;
      if (dx < 0 || dx >= PAPERDOLL_W) continue;
      let idx = data[y * width + x];
      if (idx === 0 || idx === 0xff) continue;
      if (remap) idx = remap(idx);
      const c = _art.palette.get(idx);
      const o = (dy * PAPERDOLL_W + dx) * 4;
      out[o] = c.r; out[o + 1] = c.g; out[o + 2] = c.b; out[o + 3] = 255;
    }
  }
}

/** Recompose the doll from the entity's live equip table. Item
 *  records stream through the host getTexture pipeline (async);
 *  the composite swaps in whole when done. */
// ── V5: THE CURSE ART (GetCustomPaperDollBackgroundTexture /
// GetCustomHeadImageData / SuppressPaperDollBodyAndItems) ──────────
// The override art is not identity-keyed like _art - a morph flips it
// mid-session - so it rides its own small cache. A failed load falls
// back to the racial art, the never-traps rule.
const _overrideArt = new Map();   // 'FILE#record' -> { bmp, off } | null
async function loadOverrideArt(file, record = 0) {
  const key = `${file}#${record}`;
  if (_overrideArt.has(key)) return _overrideArt.get(key);
  let art = null;
  try {
    if (file.endsWith('.CIF')) {
      const cif = new CifRciFile();
      cif.load(await _deps.fetchBytes(file), file, _art.palette);
      art = { bmp: cif.getDFBitmap(record, 0), off: cif.getOffset(record) };
    } else {
      const img = new ImgFile();
      img.load(await _deps.fetchBytes(file), file, _art.palette);
      art = { bmp: img.getDFBitmap(), off: img.imageOffset };
    }
    if (!art.bmp?.width) art = null;
  } catch { console.warn('[paperdoll] override art unavailable:', key); art = null; }
  _overrideArt.set(key, art);
  return art;
}

export async function refreshPaperDoll(entity) {
  if (!_art || !_deps) return;
  // AUDIT 17e F16 / ASYNC NEVER DROPS: this guard used to DISCARD a
  // refresh requested while one was in flight, so an equip landing
  // during the first compose left the doll - and its GetEquipIndex
  // click mask - permanently stale. Coalesce instead: remember the
  // latest request and re-run once the current pass finishes.
  if (_refreshing) { _pending = entity; return; }
  _refreshing = true;
  try {
    const out = new Uint8Array(PAPERDOLL_W * PAPERDOLL_H * 4);
    const layout = [];
    // V5: the racial override's three art laws - the beast/crypt
    // background, the whole-body suppression (PaperDollRenderer:165 -
    // the transformed panel is the background ALONE, empty click mask
    // included), and the vampire's head.
    const bgOverrideName = racialPaperDollBackground(entity);
    const suppress = racialSuppressPaperDollBodyAndItems(entity);
    const bgOverride = bgOverrideName ? await loadOverrideArt(bgOverrideName) : null;
    // background subrect fills the panel
    const bg = (bgOverride ?? _art.bg).bmp;
    for (let y = 0; y < PAPERDOLL_H; y++) {
      for (let x = 0; x < PAPERDOLL_W; x++) {
        const idx = bg.data[(y + BG_SUBRECT[1]) * bg.width + (x + BG_SUBRECT[0])];
        const c = _art.palette.get(idx);
        const o = (y * PAPERDOLL_W + x) * 4;
        out[o] = c.r; out[o + 1] = c.g; out[o + 2] = c.b; out[o + 3] = 255;
      }
    }
    const table = equipTableOf(entity);
    const worn = table.filter(Boolean).map((it) => ({ it, t: getTemplate(it.templateIndex) })).filter((w) => w.t);
    // cloak interiors first (BlitCloakInterior: cloak2 then cloak1,
    // the template's own record = the interior image)
    for (const slot of suppress ? [] : [EQUIP_SLOTS.Cloak2, EQUIP_SLOTS.Cloak1]) {
      const it = table[slot];
      if (!it || !CLOAK_TEMPLATES.has(it.templateIndex)) continue;
      const t = getTemplate(it.templateIndex);
      const img = await loadRecord(t.playerTextureArchive + (raceByKey(_deps.race)?.morphologyIndex ?? HUMAN_MORPHOLOGY), t.playerTextureRecord);
      if (img) {
        blit(out, img, { remap: (i) => applyDyeToIndex(i, it.dye ?? DYE_COLORS.Blue, DYE_TARGETS.Clothing) });
        // AUDIT 18: BlitCloakInterior passes the cloak to DrawTexture
        // (PaperDollRenderer.cs:384-400), whose tail (:284-292) pushes
        // an ItemElement into itemLayout - so the interior IS in the
        // GetEquipIndex click mask, and because Refresh blits it FIRST
        // (:169) it is the LAST thing that backwards walk checks. The
        // port drew it and entered nothing, so a click on the lining
        // beside the body did nothing where DFU unequips the cloak.
        layout.push({ slot: it.equipSlot ?? slot, img });
      }
      break;   // DFU stops at the first drawn cloak interior
    }
    // body + welds + head (BlitBody) - all skipped while suppressed
    if (!suppress) {
      blit(out, _art.nude);
      const split = WAIST_HEIGHT;
      // BlitBody (PaperDollRenderer.cs:346-353): the WELDS as a whole
      // hang off the setting - the nude body above is drawn either
      // way, and the two slot tests only decide whether a weld would
      // show around real clothes. The setting ships False, which is
      // why the port drawing the welds unconditionally looked right.
      if (!getBool('ChildGuard', 'PlayerNudity')) {
        if (!table[EQUIP_SLOTS.ChestClothes] && !table[EQUIP_SLOTS.ChestArmor]) blit(out, _art.clothed, { rows: [0, split] });
        if (!table[EQUIP_SLOTS.LegsClothes]) blit(out, _art.clothed, { rows: [split, _art.clothed.bmp.height] });
      }
      // V5: the vampire's clanless head replaces the racial one
      const headOv = racialOverrideHeadArt(entity);
      const headArt = headOv ? await loadOverrideArt(headOv.file, headOv.record) : null;
      blit(out, headArt ?? _art.head);
    }
    // items ascending drawOrder (BlitItems)
    const ordered = suppress ? [] : paperdollOrder(worn.map((w) => ({ ...w.it, drawOrder: w.t.drawOrderOrEffect })));
    for (const it of ordered) {
      const res = paperdollItemImage(it, { gender: _deps.gender, race: _deps.race });
      if (!res) continue;
      const img = await loadRecord(res.archive, res.record);
      if (!img) continue;
      const remap = res.target == null ? null : (i) => applyDyeToIndex(i, res.dye, res.target);
      blit(out, img, { remap });
      layout.push({ slot: it.equipSlot, img });
    }
    const key = `paperdoll_v${++_version}`;
    const prevKey = _live?.key ?? null;
    // U59: the composite is KEPT, not just uploaded. `out` is already
    // the finished doll in RGBA - the GL upload below is one consumer
    // of it, and a DOM screen is the other. Holding the 81 KB buffer
    // that was about to be discarded is what let the enhanced pack
    // draw the same avatar the classic window draws, without a second
    // compositor reading the same laws again.
    _pixels = { width: PAPERDOLL_W, height: PAPERDOLL_H, rgba: out, version: _version };
    _live = { key, tex: _deps.renderer.uploadTexture('img', key, { width: PAPERDOLL_W, height: PAPERDOLL_H, colors: new Uint32Array(out.buffer) }) };
    // AUDIT 17e F27 / EVERY ALLOCATION HAS AN OWNER: each refresh mints
    // a NEW versioned key, so the previous composite leaked (~81 KB per
    // equip click, unbounded across a session).
    if (prevKey) _deps.renderer.releaseTexture?.('img', prevKey);
    _layout = layout;
  } finally {
    _refreshing = false;
    if (_pending) { const next = _pending; _pending = null; await refreshPaperDoll(next); }
  }
}

/** One TEXTURE.### record as an indexed bitmap + its baked offset
 *  (with DFU's 237/52+54 bad-offset fix). */
async function loadRecord(archive, record) {
  try {
    const tex = await _deps.getTexture(archive);
    if (!tex || record >= tex.recordCount) return null;
    const off = (archive === 237 && (record === 52 || record === 54)) ? { x: 237, y: 43 } : tex.getOffset(record);
    return { bmp: tex.getDFBitmap(record, 0), off };
  } catch { return null; }
}

/** Draw the doll with the panel's top-left at virtual (x,y). */
export function drawPaperDoll(renderer, m, entity, x, y) {
  if (!_art) return false;
  if (!_live) refreshPaperDoll(entity);   // first draw composes async
  if (_live) renderer.drawScreenQuad(_live.tex, { x: m.ox + x * m.s, y: m.oy + y * m.s, w: PAPERDOLL_W * m.s, h: PAPERDOLL_H * m.s });
  return true;
}

/** GetEquipIndex: panel-relative point -> the equip slot of the
 *  topmost non-transparent item pixel (layers walked BACKWARDS). */
export function slotAtPaperDoll(px, py) {
  const [orgX, orgY] = PAPERDOLL_ORIGIN;
  for (let i = _layout.length - 1; i >= 0; i--) {
    const { slot, img } = _layout[i];
    const x = px - (img.off.x - orgX), y = py - (img.off.y - orgY);
    if (x < 0 || y < 0 || x >= img.bmp.width || y >= img.bmp.height) continue;
    const idx = img.bmp.data[y * img.bmp.width + x];
    if (idx !== 0 && idx !== 0xff) return slot;
  }
  return null;
}

/**
 * U59: THE COMPOSITE, FOR A SCREEN THAT IS NOT A CANVAS.
 *
 * The enhanced pack draws the avatar as an `<img>`, and the doll is
 * already built CPU-side - `refreshPaperDoll` composites into an RGBA
 * buffer and then uploads it. This hands out that buffer rather than
 * letting a DOM screen re-read PaperDollRenderer's layer order, dye
 * bands and offsets for itself, which is how a port ends up with two
 * dolls that disagree.
 *
 * `version` bumps on every recompose, so a view can cache by it and
 * repaint only when the avatar actually changed.
 *
 * Null until a host has preloaded the art AND a compose has finished:
 * with no ARENA2 there is no doll, and the caller shows whatever it
 * shows without one.
 */
export const paperDollPixels = () => _pixels;


/** Test seam. */
export const _debugPaperDoll = () => ({ live: !!_live, layers: _layout.map((l) => l.slot), version: _version });

/** Test seam: a composite with no ARENA2 behind it. The DOM path -
 *  buffer to data URL to `<img>` - is provable without game data, and
 *  this is what tools/enhancedDollProbe.mjs stands one up with. It
 *  does NOT fake the compositor: the layer laws above are pinned
 *  against real records in paperdoll.test.js under ARENA2_PATH. */
export function _setPaperDollPixelsForTests(rgba, w = PAPERDOLL_W, h = PAPERDOLL_H) {
  _pixels = rgba ? { width: w, height: h, rgba, version: ++_version } : null;
}

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
//   masks removed (ChangeMask: index 0xFF -> transparent; on an
//   ITEM layer the mask exposes the background - HM1);
// - dyes (ChangeDye through the C5b tables): clothing dye on the
//   0x60 band (item.dye; Blue = identity); weapons/armor on the
//   0x70 band by material (GetWeapon/GetArmorDyeColor - leather and
//   chain fall to the identity None table);
// - the click mask (GetEquipIndex): iterate the blitted item layers
//   BACKWARDS, the first non-transparent pixel wins its equip slot.
// Breton/male/face 0 is only the PRE-CHARGEN default (chargen fronts
// identity and this file reloads on identity change - AUDIT 23).

import { ImgFile } from '../formats/imgFile.js';
import { packImgTexture } from './packArt.js';   // OVH2: a worn UI pack's backdrop
import { racialPaperDollBackground, racialOverrideHeadArt, racialSuppressPaperDollBodyAndItems } from '../systems/vampirism.js';   // V5: the curse art laws, both curses' one switch
import { CifRciFile } from '../formats/cifRciFile.js';
import { getBool } from '../systems/settings.js';   // UI3: EnableGeographicBackgrounds; ChildGuard/PlayerNudity gates the welds
import { EQUIP_SLOTS, equipTableOf, getItemHands, ITEM_HANDS } from '../systems/equip.js';
import { getTemplate, paperdollOrder } from '../characters/paperdoll.js';
import { applyDyeToIndex, DYE_TARGETS, DYE_COLORS, CLOTHING_DYES } from '../characters/dyes.js';
import { decodedTextureTopDown, preloadTextureRecord, textureReplacementRect } from '../systems/textureReplacement.js';
import { dfmodImgImage, dfmodCifRciImage, dfmodGeneration, resampleRgba, dfmodCarriesDollArt } from '../systems/dfmodTextures.js';   // DFMOD1: an attached mod's backdrop, body, head and hi-res items   // DW3: GetItemImage's import arm, by the item's dye; AUDIT-DW F1: decoded when the doll asks
import { itemDyeColor } from '../systems/itemDye.js';   // DW3: DaggerfallUnityItem.dyeColor, as the port's items carry it
import { customItemClass } from '../systems/rriItems.js';   // RRI1: a custom class's own archive and record on the doll
import { clampArmorVariant, armorArchive, HUMAN_MORPHOLOGY, ARMOR_MATERIAL } from '../systems/armorMaterials.js';
import { raceArt, FACES_PER_RACE, raceByKey } from '../systems/races.js';   // S3c/U9: all eight races

export const PAPERDOLL_W = 110;
export const PAPERDOLL_H = 184;
export const PAPERDOLL_ORIGIN = Object.freeze([200, 8]);   // paperDollOrigin
/** A layer's top-left in the doll's own space. A classic record's
 *  offset is in the 320x200 screen (paperDollOrigin subtracted, as
 *  PaperDollRenderer does); RRI1: an imported sprite's <rect> is
 *  already in the doll's space (TextureReplacement
 *  .OverridePaperdollItemRect replaces the screen rect whole), and the
 *  stand-in's offset says so with `paperdoll`. */
export const dollXY = (off) => (off?.paperdoll ? [off.x, off.y] : [(off?.x ?? 0) - PAPERDOLL_ORIGIN[0], (off?.y ?? 0) - PAPERDOLL_ORIGIN[1]]);
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
  // RRI1: GetItemImage(forPaperDoll) reads the same two virtuals the
  // inventory does (ItemHelper.cs:405-406), then bumps an Either-hand
  // weapon worn right by one (:412-414) - the Archer's Axe's second
  // record. The remap is the material's, as for any armor or weapon;
  // an imported texture takes none (it never reaches `blit`).
  const cls = customItemClass(item.templateIndex);
  if (cls) {
    const bodyArchive = armorArchive(gender, morph);
    const archive = cls.inventoryTextureArchive ?? bodyArchive;
    let record = cls.inventoryTextureRecord ? cls.inventoryTextureRecord(item, { playerTextureArchive: bodyArchive }) : t.playerTextureRecord;
    if (item.group === 'Weapons' && item.equipSlot === EQUIP_SLOTS.RightHand && getItemHands(item) === ITEM_HANDS.Either) record += 1;
    const m = item.material ?? 0;
    const dye = item.group === 'Weapons' ? (MATERIAL_DYES[m] ?? DYE_COLORS.Unchanged) : (m >= ARMOR_MATERIAL.Iron ? MATERIAL_DYES[m - ARMOR_MATERIAL.Iron] ?? DYE_COLORS.Unchanged : DYE_COLORS.Unchanged);
    return { archive, record, dye, target: DYE_TARGETS.WeaponsAndArmor };
  }
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
/** DFMOD1-E (Enhanced Plus: "the paperdoll doesn't get the texture update") - WHICH ATTACHED-MOD SET THE COMPOSITE
 *  WAS MADE FROM. The art set (backdrop, body, head) was loaded once at the host's boot, which runs BEFORE the
 *  mods' registration lands, and nothing asked again unless the identity drifted: the doll kept the classic art for
 *  the session. The enhanced avatar also never recomposes on a draw. So the composite remembers the generation it
 *  was built from, and a stale one is rebuilt - art first - by the next refresh or draw. */
let _composedGen = -1;
/** True when a composite exists and the attached mods changed since it was made. */
let _staleTried = -1;   // DFMOD3-F: the generation a stale recompose was last started for
/** True when a composite could be rebuilt for a changed mod set and has not been tried for it yet.
 *  DFMOD3-F (a player: "game freezes when opening inventory"): this used to stay true WHILE the rebuild ran, and the
 *  Enhanced Plus pack asks on every render and renders when the ask resolves - an ask during a compose resolves at
 *  once (it is coalesced), so render -> ask -> render spun forever. Now it answers true ONCE per generation, never
 *  during a compose, and never without the art and deps a compose needs. */
export const paperDollStale = () => {
  const gen = dfmodGeneration();
  if (!_art || !_deps || _refreshing || _composedGen === gen || _staleTried === gen) return false;
  _staleTried = gen;
  return true;
};
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
/** The IDENT the loaded set was built from, not just its key - the
 *  context and the region live here, so the drift check below can ask
 *  for the entity's identity WHERE the doll already is. */
let _ident = null;
/** The art set's key: who the doll is, and where. */
export const paperDollIdentityKey = ({ race = 'Breton', gender = 'male', faceIndex = 0, context = 'town', where = null } = {}) =>
  `${race}|${gender}|${faceIndex}|${context}|${where?.region ?? -1}`;

/** THE ART FOLLOWS THE ENTITY (Mac, 2026-09-16: "Characters face and
 *  gender completely changed after a few hours of playtime").
 *
 *  DFU has no art set to keep in step: DaggerfallPaperDoll.Refresh
 *  hands the LIVE PlayerEntity to PaperDollRenderer.Refresh, and
 *  BlitBody (PaperDollRenderer.cs:346-353) and PaperDoll.cs
 *  RefreshBackground read Race and Gender off THAT entity on every
 *  single refresh. The port caches the decoded set instead - three
 *  IMGs and a CIF record per identity - and a cache that nobody
 *  invalidates is a cache that lies: `preloadPaperDollArt` was called
 *  only from the four hosts' boots (with the PRE-CHARGEN Breton/male/0
 *  stand-in) and from the three chargen completions, so a character
 *  who arrived by RESTORE - `systems/save.js` restorePlayer, which is
 *  every `?load` boot, and main.js:206 makes Continue, Load Game AND
 *  Online all `?load` - wore the stand-in's body, face and morphology
 *  for the rest of the session.
 *
 *  So the invalidation is DERIVED rather than remembered: the compose
 *  itself asks whether the set it is about to draw is this entity's,
 *  and no host has to know. Returns the ident the set would have to be
 *  loaded with, or null when what is loaded already fits. Pure.
 *  Context and region are the loaded set's own - a load does not move
 *  the player, so only the identity can have drifted. */
export function paperDollIdentityDrift(entity, ident = _ident) {
  if (!ident) return null;
  const want = {
    ...ident,
    race: entity?.race ?? 'Breton',
    gender: entity?.gender ?? 'male',
    faceIndex: entity?.faceIndex ?? 0,
  };
  return paperDollIdentityKey(want) === paperDollIdentityKey(ident) ? null : want;
}

/** ONLINE1 (AUDIT ONLINE C1-C4, C8, C9): the art set - BODY, FACE, SCBG -
 *  loaded fresh for whoever asks, PURE: nothing of the singleton's is
 *  read or written, and a failure THROWS (the caller decides). The
 *  local player's set below and a peer's (composePaperDollPixels)
 *  both ride it. */
async function loadArtSet(deps, { race = 'Breton', gender = 'male', faceIndex = 0, context = 'town', where = null } = {}) {
  const { fetchBytes, palette } = deps;
  const art = raceArt(race, gender);
  const [unclothed, clothed] = art.body;
  const loadImgBmp = async (name) => {
    const img = new ImgFile();
    img.load(await fetchBytes(name), name, palette);
    const bmp = img.getDFBitmap();
    return { bmp, off: img.imageOffset, name, alt: await dfmodAlt(dfmodImgImage(name), bmp) };   // OVH2: the NAME rides it - a worn UI pack answers the backdrop by name; DFMOD1: an attached mod's picture of it
  };
  const face = new CifRciFile();
  face.load(await fetchBytes(art.heads), art.heads, palette);
  const fi = Math.max(0, Math.min(FACES_PER_RACE - 1, faceIndex | 0));
  const headBmp = face.getDFBitmap(fi, 0);
  return {
    palette,
    // UI3: the SETTING decides, not the caller's context word. Off -
    // which is how it ships - every race gets its own backdrop.
    bg: await loadImgBmp(paperDollBackground(art.background, {
      inTown: context === 'town', inDungeon: context === 'dungeon', inGraveyard: context === 'graveyard',
      region: where?.region ?? -1, regionCount: where?.regionCount ?? REGION_BACKGROUND_CHARS.length,
    })),
    nude: await loadImgBmp(unclothed),
    clothed: await loadImgBmp(clothed),
    head: { bmp: headBmp, off: face.getOffset(fi), alt: await dfmodAlt(dfmodCifRciImage(art.heads, fi, 0), headBmp) },
  };
}

/** DFMOD1: an attached mod's picture of a classic IMG/CIF - the mod's own top-down RGBA `{ width, height, data }`,
 *  or null. DFMOD4: kept at the mod's resolution; `altAt` fits it to the classic size times the compose scale, so
 *  every offset, subrect and click mask stays the classic one while the pixels are the mod's. */
async function dfmodAlt(pending, bmp) {
  try {
    const img = await pending;
    return img && bmp?.width ? img : null;
  } catch { return null; }
}
/** DFMOD4: a holder's (`{ bmp, alt }`) mod picture at `S` texels per doll pixel, box-filtered once per scale. */
function altAt(holder, S) {
  holder._altFit ??= new Map();
  if (!holder._altFit.has(S)) holder._altFit.set(S, resampleRgba(holder.alt, holder.bmp.width * S, holder.bmp.height * S).data);
  return holder._altFit.get(S);
}

/** DFMOD4 (a player's screenshots: DFU's DREAM doll beside the port's) - THE COMPOSE SCALE. The doll composed at
 *  Daggerfall's 110x184 and every screen scaled that up, so DREAM's paperdoll - drawn at 8x - arrived as 110x184 worth
 *  of pixels, blurred. With a texture mod attached the doll composes at 4x (440x736): the classic layers are
 *  nearest-scaled into it exactly as before, and the mod's layers keep four times the detail. Every rect, offset and
 *  click mask stays in the classic 110x184 space; only the pixels are denser. */
export const PAPERDOLL_HD_SCALE = 4;
const composeScale = () => (dfmodCarriesDollArt() ? PAPERDOLL_HD_SCALE : 1);   // AUDIT VE R13: a mod switched on carries doll art - not the lighting mod, a mod off, Vanilla Enhanced or a copy of it

export async function preloadPaperDollArt(deps, ident = {}) {
  const { race = 'Breton', gender = 'male' } = ident;
  const key = `${paperDollIdentityKey(ident)}#${dfmodGeneration()}`;   // DFMOD1: attaching or removing a mod rebuilds the art
  if (_art && _identity === key) return;
  try {
    _art = await loadArtSet(deps, ident);
    _identity = key;
    _ident = { ...ident };   // what the drift check above compares an entity against
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
 *  0xFF is the classic mask (removed - ChangeMask; HM1 below). */
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

/* HM1 - THE MASK IS A HOLE TO THE BACKGROUND. DaggerfallPaperDoll.shader's
   second pass (PaperDollRenderer.cs:274-277, every ITEM layer): "Mask
   texture should use alpha 0 for non-masked areas and alpha 1 for
   masked areas ... everything else is cleared to expose background".
   The character layer is a panel OVER the SCBG background panel
   (PaperDoll.cs RefreshBackground), so a masked pixel shows the
   background - the hair under a helm is erased, not drawn through.
   `under` is the background the compose started from; without it the
   mask is skipped, which is what the body and head layers get (no
   item, no shader). A doll composed with no background (another's,
   ONLINE1) copies `under`'s alpha too, so its mask is a see-through. */
function blit(out, img, palette, { rows = null, remap = null, atOffset = null, under = null, S = 1 } = {}) {
  if (img.alt) {   // DFMOD1: a mod's truecolor body/head, at the classic size and offset; DFMOD4: S times as dense
    const [y0, y1] = rows ?? [0, img.bmp.height];
    blitRgba(out, { bmp: { width: img.bmp.width * S, height: img.bmp.height * S, rgba: altAt(img, S), scale: S }, off: img.off }, { atOffset, rows: [y0 * S, y1 * S], S });
    return;
  }
  const [orgX, orgY] = PAPERDOLL_ORIGIN;
  const off = atOffset ?? img.off;
  const px = off.x - orgX, py = off.y - orgY;
  const { width, height, data } = img.bmp;
  const [y0, y1] = rows ?? [0, height];
  const OW = PAPERDOLL_W * S;
  for (let y = y0; y < y1; y++) {
    const dy = py + y;
    if (dy < 0 || dy >= PAPERDOLL_H) continue;
    for (let x = 0; x < width; x++) {
      const dx = px + x;
      if (dx < 0 || dx >= PAPERDOLL_W) continue;
      let idx = data[y * width + x];
      if (idx === 0) continue;
      let r, g, b, a = 255, fromUnder = false;
      if (idx === 0xff) {
        if (!under) continue;
        fromUnder = true;
      } else {
        if (remap) idx = remap(idx);
        const c = palette.get(idx);
        r = c.r; g = c.g; b = c.b;
      }
      // DFMOD4: one classic texel is an S x S block of the composite (S = 1: the classic compose, texel for texel)
      for (let j = 0; j < S; j++) {
        for (let i = 0; i < S; i++) {
          const o = ((dy * S + j) * OW + dx * S + i) * 4;
          if (fromUnder) { out[o] = under[o]; out[o + 1] = under[o + 1]; out[o + 2] = under[o + 2]; out[o + 3] = under[o + 3]; continue; }
          out[o] = r; out[o + 1] = g; out[o + 2] = b; out[o + 3] = a;
        }
      }
    }
  }
}

/** FIELD-GUN4: THE OTHER KIND OF LAYER. `blit` above is DFU's own -
 *  palette INDICES through the doll's palette, with 0 transparent and
 *  0xff the cloak's cut-out. The port's own art (systems/thunderlock.js)
 *  is truecolor and has no index to give, so it composites straight
 *  in on its alpha. No dye and no remap: a dye is a palette-range
 *  rotation and there is no palette here to rotate.
 *
 *  Everything else is `blit`'s, deliberately - the same origin, the
 *  same clip, the same offset arithmetic - so a layer that draws here
 *  lands exactly where the indexed one would have. */
function blitRgba(out, img, { atOffset = null, under = null, rows = null, S = 1 } = {}) {
  const off = atOffset ?? img.off;
  const [dpx, dpy] = dollXY(off);
  const { width, height, rgba } = img.bmp;
  if (!rgba) return;
  // DFMOD4: the picture carries `scale` texels per doll pixel (1 for classic-sized art, S for a mod picture fitted
  // to this compose); `f` composite pixels per texel - a 1x vendor sprite is nearest-scaled up, as the classic layers
  const f = S / (img.bmp.scale ?? 1);
  const OW = PAPERDOLL_W * S, OH = PAPERDOLL_H * S;
  const px = Math.round(dpx * S), py = Math.round(dpy * S);
  const dw = Math.round(width * f), dh = Math.round(height * f);
  // RRI1: the mask first - where it is set, the background comes back
  // (the hair under a helmet), and the sprite draws over that
  if (under && img.mask?.rgba) {
    const { width: mw, height: mh, rgba: m } = img.mask;
    const mf = dw / mw;
    for (let Y = 0; Y < Math.round(mh * mf); Y++) {
      const dy = py + Y;
      if (dy < 0 || dy >= OH) continue;
      const y = Math.min(mh - 1, Math.floor(Y / mf));
      for (let X = 0; X < Math.round(mw * mf); X++) {
        const dx = px + X;
        const x = Math.min(mw - 1, Math.floor(X / mf));
        if (dx < 0 || dx >= OW || m[(y * mw + x) * 4 + 3] === 0) continue;
        const o = (dy * OW + dx) * 4;
        out[o] = under[o]; out[o + 1] = under[o + 1]; out[o + 2] = under[o + 2]; out[o + 3] = under[o + 3];
      }
    }
  }
  const [r0, r1] = rows ?? [0, height];   // DFMOD1: the censor welds' bands, as `blit` takes them (in the picture's rows)
  for (let Y = Math.round(r0 * f); Y < Math.min(dh, Math.round(r1 * f)); Y++) {
    const dy = py + Y;
    if (dy < 0 || dy >= OH) continue;
    const y = Math.min(height - 1, Math.floor(Y / f));
    for (let X = 0; X < dw; X++) {
      const dx = px + X;
      if (dx < 0 || dx >= OW) continue;
      const x = Math.min(width - 1, Math.floor(X / f));
      const si = (y * width + x) * 4;
      const a = rgba[si + 3];
      if (a === 0) continue;
      const o = (dy * OW + dx) * 4;
      if (a === 255) { out[o] = rgba[si]; out[o + 1] = rgba[si + 1]; out[o + 2] = rgba[si + 2]; out[o + 3] = 255; continue; }
      const k = a / 255;   // the sprite's own edge, over whatever is under it
      out[o] = rgba[si] * k + out[o] * (1 - k);
      out[o + 1] = rgba[si + 1] * k + out[o + 1] * (1 - k);
      out[o + 2] = rgba[si + 2] * k + out[o + 2] * (1 - k);
      out[o + 3] = 255;
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
async function loadOverrideArt(file, record, deps, palette) {
  const key = `${file}#${record}#${dfmodGeneration()}`;   // DFMOD1: a mod attached mid-session re-reads it
  if (_overrideArt.has(key)) return _overrideArt.get(key);
  let art = null;
  try {
    if (file.endsWith('.CIF')) {
      const cif = new CifRciFile();
      cif.load(await deps.fetchBytes(file), file, palette);
      art = { bmp: cif.getDFBitmap(record, 0), off: cif.getOffset(record) };
      art.alt = await dfmodAlt(dfmodCifRciImage(file, record, 0), art.bmp);   // DFMOD1
    } else {
      const img = new ImgFile();
      img.load(await deps.fetchBytes(file), file, palette);
      art = { bmp: img.getDFBitmap(), off: img.imageOffset };
      art.alt = await dfmodAlt(dfmodImgImage(file), art.bmp);   // DFMOD1
    }
    if (!art.bmp?.width) art = null;
  } catch { console.warn('[paperdoll] override art unavailable:', key); art = null; }
  _overrideArt.set(key, art);
  return art;
}

/**
 * ONLINE1 (AUDIT ONLINE C1-C4): THE COMPOSE, PURE. PaperDollRenderer's
 * layer order, dye bands and offsets over `art` (an art set) and
 * `deps` ({ gender, race, fetchBytes, getTexture }), for `entity`'s
 * equip table, into a fresh RGBA buffer: { out, layout }. Reads and
 * writes NOTHING of the singleton below, so a peer's doll composes
 * while the inventory shows the player's own, untouched.
 * `background` false leaves the panel clear (a peer's billboard).
 */
async function composeDoll(art, deps, entity, { background = true, scale: S = 1 } = {}) {
  const OW = PAPERDOLL_W * S, OH = PAPERDOLL_H * S;   // DFMOD4: the composite, S texels per doll pixel
  const out = new Uint8Array(OW * OH * 4);
  const layout = [];
  // V5: the racial override's three art laws - the beast/crypt
  // background, the whole-body suppression (PaperDollRenderer:165 -
  // the transformed panel is the background ALONE, empty click mask
  // included), and the vampire's head.
  const bgOverrideName = racialPaperDollBackground(entity);
  const suppress = racialSuppressPaperDollBodyAndItems(entity);
  const bgOverride = bgOverrideName ? await loadOverrideArt(bgOverrideName, 0, deps, art.palette) : null;
  // background subrect fills the panel
  const bg = (bgOverride ?? art.bg).bmp;
  const bgHolder = bgOverride ?? art.bg;
  const bgAlt = bgHolder.alt ? altAt(bgHolder, S) : null;   // DFMOD1: an attached mod's backdrop; DFMOD4: at S x the classic size
  const BW = bg.width * S;
  for (let y = 0; background && y < OH; y++) {
    for (let x = 0; x < OW; x++) {
      const o = (y * OW + x) * 4;
      if (bgAlt) {
        const si = ((y + BG_SUBRECT[1] * S) * BW + (x + BG_SUBRECT[0] * S)) * 4;
        out[o] = bgAlt[si]; out[o + 1] = bgAlt[si + 1]; out[o + 2] = bgAlt[si + 2]; out[o + 3] = 255;
        continue;
      }
      const idx = bg.data[(Math.floor(y / S) + BG_SUBRECT[1]) * bg.width + (Math.floor(x / S) + BG_SUBRECT[0])];
      const c = art.palette.get(idx);
      out[o] = c.r; out[o + 1] = c.g; out[o + 2] = c.b; out[o + 3] = 255;
    }
  }
  const under = out.slice();   // HM1: the background alone (or nothing), for the item masks
  const table = equipTableOf(entity);
  const worn = table.filter(Boolean).map((it) => ({ it, t: getTemplate(it.templateIndex) })).filter((w) => w.t);
  // cloak interiors first (BlitCloakInterior: cloak2 then cloak1,
  // the template's own record = the interior image)
  for (const slot of suppress ? [] : [EQUIP_SLOTS.Cloak2, EQUIP_SLOTS.Cloak1]) {
    const it = table[slot];
    if (!it || !CLOAK_TEMPLATES.has(it.templateIndex)) continue;
    const t = getTemplate(it.templateIndex);
    const img = await loadRecord(t.playerTextureArchive + (raceByKey(deps.race)?.morphologyIndex ?? HUMAN_MORPHOLOGY), t.playerTextureRecord, deps.getTexture, itemDyeColor(it), S);
    if (img) {
      if (img.bmp?.rgba) blitRgba(out, img, { under, S });   // DFMOD4: a mod's cloak lining is truecolor
      else blit(out, img, art.palette, { remap: (i) => applyDyeToIndex(i, it.dye ?? DYE_COLORS.Blue, DYE_TARGETS.Clothing), under, S });
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
    blit(out, art.nude, art.palette, { S });
    const split = WAIST_HEIGHT;
    // BlitBody (PaperDollRenderer.cs:346-353): the WELDS as a whole
    // hang off the setting - the nude body above is drawn either
    // way, and the two slot tests only decide whether a weld would
    // show around real clothes. The setting ships False, which is
    // why the port drawing the welds unconditionally looked right.
    if (!getBool('ChildGuard', 'PlayerNudity')) {
      if (!table[EQUIP_SLOTS.ChestClothes] && !table[EQUIP_SLOTS.ChestArmor]) blit(out, art.clothed, art.palette, { rows: [0, split], S });
      if (!table[EQUIP_SLOTS.LegsClothes]) blit(out, art.clothed, art.palette, { rows: [split, art.clothed.bmp.height], S });
    }
    // V5: the vampire's clanless head replaces the racial one
    const headOv = racialOverrideHeadArt(entity);
    const headArt = headOv ? await loadOverrideArt(headOv.file, headOv.record, deps, art.palette) : null;
    blit(out, headArt ?? art.head, art.palette, { S });
  }
  // items ascending drawOrder (BlitItems)
  const ordered = suppress ? [] : paperdollOrder(worn.map((w) => ({ ...w.it, drawOrder: w.t.drawOrderOrEffect })));
  for (const it of ordered) {
    const res = paperdollItemImage(it, { gender: deps.gender, race: deps.race });
    if (!res) continue;
    const img = await loadRecord(res.archive, res.record, deps.getTexture, itemDyeColor(it), S);   // DW3: the import ask is by item.dyeColor (an artifact's is Unchanged); the remap below stays res.dye
    if (!img) continue;
    // FIELD-GUN4: a vendor-only archive has no indexed bitmap to blit
    // through the palette - it hands back RGBA instead, and it is the
    // port's own art rather than DFU's, so it takes neither the dye
    // nor the helm mask.
    if (img.bmp?.rgba) { blitRgba(out, img, { under, S }); layout.push({ slot: it.equipSlot, img }); continue; }   // RRI1: the imported helmet's mask erases the hair under it
    const remap = res.target == null ? null : (i) => applyDyeToIndex(i, res.dye, res.target);
    blit(out, img, art.palette, { remap, under, S });   // HM1: the helm's mask erases the hair
    layout.push({ slot: it.equipSlot, img });
  }
  return { out, layout, bgSize: [bg.width, bg.height], width: OW, height: OH };
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
    // THE ART FOLLOWS THE ENTITY - the drift check above, taken here
    // because this is the one door every doll in the game composes
    // through (the classic inventory, the char sheet, the enhanced
    // pack's avatar), so a character who arrived by restore cannot
    // reach a draw wearing the boot's stand-in body. The latch is
    // already up, so the await opens no re-entry (AUDIT-MACL F2), and
    // a reload that fails leaves the old set standing - loud, never a
    // trap - to be tried again on the next refresh.
    const drift = paperDollIdentityDrift(entity);
    if (drift) await preloadPaperDollArt(_deps, drift);
    else if (_ident && !_identity?.endsWith(`#${dfmodGeneration()}`)) await preloadPaperDollArt(_deps, _ident);   // DFMOD1-E: the mods changed - the backdrop, body and head are reloaded with theirs
    const gen = dfmodGeneration();
    // OVH2: A WORN UI PACK'S BACKDROP. The doll composes WITHOUT its SCBG and the pack's picture of that SCBG is
    // drawn under it (drawPaperDoll) - its hi-res pixels would be lost in the 110x184 composite. The HM1 masks
    // still hole through to "the background": composed on nothing, a masked pixel is clear, and the pack's
    // backdrop shows through it exactly as DFU's SCBG panel shows through the mask shader.
    const overrideName = racialPaperDollBackground(entity);
    const bgName = overrideName && await loadOverrideArt(overrideName, 0, _deps, _art.palette) ? overrideName : _art.bg.name;   // composeDoll's own choice (an override that did not load falls to the racial art)
    const packBg = bgName ? await packImgTexture(_deps.renderer, bgName) : null;
    const { out, layout, bgSize, width: OW, height: OH } = await composeDoll(_art, _deps, entity, { background: !packBg, scale: composeScale() });   // DFMOD4: 4x with a texture mod
    const key = `paperdoll_v${++_version}`;
    const prevKey = _live?.key ?? null;
    // U59: the composite is KEPT, not just uploaded. `out` is already
    // the finished doll in RGBA - the GL upload below is one consumer
    // of it, and a DOM screen is the other. Holding the 81 KB buffer
    // that was about to be discarded is what let the enhanced pack
    // draw the same avatar the classic window draws, without a second
    // compositor reading the same laws again.
    _pixels = { width: OW, height: OH, rgba: out, version: _version, density: OW / PAPERDOLL_W };   // DFMOD4: texels per doll pixel
    _composedGen = gen;   // DFMOD1-E
    _live = { key, tex: _deps.renderer.uploadTexture('img', key, { width: OW, height: OH, colors: new Uint32Array(out.buffer) }), packBg: packBg ? { tex: packBg, w: bgSize[0], h: bgSize[1] } : null };
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
async function loadRecord(archive, record, getTexture, dye = null, S = 1) {
  try {
    const tex = await getTexture(archive);
    if (!tex || record >= tex.recordCount) return null;
    const off = (archive === 237 && (record === 52 || record === 54)) ? { x: 237, y: 43 } : tex.getOffset(record);
    // DW3: GetItemImage's import arm FIRST (ItemHelper.cs:458-462) - a
    // replacement by the item's dye is assigned as the texture, drawn
    // as it is: no ChangeDye (:466-476 is the else branch), and the
    // classic record's offset. It comes back in the RGBA shape the
    // vendor arm already blits (FIELD-GUN4), because it has no index.
    await preloadTextureRecord(archive, record, 0, 'Albedo', dye);   // AUDIT-DW F1: this record's, on demand
    const swap = decodedTextureTopDown(archive, record, 0, 'Albedo', dye);
    if (swap) {
      // RRI1: the MASK beside an imported texture (ItemHelper.cs:452-453,
      // TryImportTexture(..., TextureMap.Mask)): "alpha 0 is unmasked
      // areas of image and alpha 1 are masked areas" - the helmet's
      // hair cutout. Asked by the same name with `_Mask`; absent for
      // everything that has none.
      let mask = (await preloadTextureRecord(archive, record, 0, 'Mask', dye)) ? decodedTextureTopDown(archive, record, 0, 'Mask', dye) : null;
      // DFMOD1: A HI-RES SPRITE TAKES ITS CLASSIC PLACE. The doll composes at 110x184, and a mod's paperdoll art is
      // several times that (DREAM's is 8x): drawn raw it covered the panel. DFU draws an imported item into the
      // classic record's rect, or the `<rect>` its xml gives (TextureReplacement.OverridePaperdollItemRect) - the
      // same here, box-filtered to that size. Same-size art (every vendored set) passes through untouched.
      let pic = { width: swap.width, height: swap.height, data: swap.rgba };
      let place = off;
      const rect = textureReplacementRect(archive, record, 0, 'Albedo', dye);
      const classic = tex.vendor ? null : tex.getSize(record);
      // DFMOD4: fitted at S texels per doll pixel - the composite's own density - and marked so
      let scale = 1;
      if (rect) { pic = resampleRgba(pic, rect.width * S, rect.height * S); place = { x: rect.x, y: rect.y, paperdoll: true }; scale = S; }
      else if (classic?.width && (pic.width > classic.width || pic.height > classic.height)) { pic = resampleRgba(pic, classic.width * S, classic.height * S); scale = S; }   // a hi-res sprite with no <rect>: the classic record's box
      if (mask && (mask.width !== pic.width || mask.height !== pic.height)) { const m = resampleRgba({ width: mask.width, height: mask.height, data: mask.rgba }, pic.width, pic.height); mask = { width: m.width, height: m.height, rgba: m.data }; }
      return { bmp: { width: pic.width, height: pic.height, data: null, rgba: pic.data, scale }, off: place, mask };
    }
    return { bmp: tex.getDFBitmap(record, 0), off };
  } catch { return null; }
}

/** Draw the doll with the panel's top-left at virtual (x,y). */
export function drawPaperDoll(renderer, m, entity, x, y) {
  if (!_art) return false;
  if (!_live || paperDollStale()) refreshPaperDoll(entity);   // DFMOD3-F: a stale ask answers true once per generation   // first draw composes async; DFMOD1-E: and a composite from before the mods changed
  if (!_live) return true;
  const dst = { x: m.ox + x * m.s, y: m.oy + y * m.s, w: PAPERDOLL_W * m.s, h: PAPERDOLL_H * m.s };
  if (_live.packBg) {   // OVH2: the pack's backdrop under the doll - the same subrect of the same SCBG, in the pack's pixels
    const { tex, w, h } = _live.packBg, [sx, sy] = BG_SUBRECT;
    renderer.drawScreenQuad(tex, dst, { u0: sx / w, v0: sy / h, u1: (sx + PAPERDOLL_W) / w, v1: (sy + PAPERDOLL_H) / h });
  }
  renderer.drawScreenQuad(_live.tex, dst);
  return true;
}

/** GetEquipIndex: panel-relative point -> the equip slot of the
 *  topmost non-transparent item pixel (layers walked BACKWARDS). */
export function slotAtPaperDoll(px, py) {
  const [orgX, orgY] = PAPERDOLL_ORIGIN;
  for (let i = _layout.length - 1; i >= 0; i--) {
    const { slot, img } = _layout[i];
    const [ox, oy] = dollXY(img.off);
    const x = px - ox, y = py - oy;
    if (x < 0 || y < 0 || x >= img.bmp.width || y >= img.bmp.height) continue;
    // FIELD-GUN4: an RGBA layer's "is there a pixel here" is its
    // ALPHA. Reading `data` for one answers undefined, which is
    // neither 0 nor 0xff and so returned the slot for every point
    // inside the sprite's BOX - the transparent corners included, and
    // that box is what sits over the doll's own body.
    if (img.bmp.rgba) {   // DFMOD4: a picture `scale` texels per doll pixel is sampled at its own density
      const sc = img.bmp.scale ?? 1;
      const sx = Math.floor(x * sc), sy = Math.floor(y * sc);
      if (sx < img.bmp.width && sy < img.bmp.height && img.bmp.rgba[(sy * img.bmp.width + sx) * 4 + 3] !== 0) return slot;
      continue;
    }
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


/**
 * ONLINE1 (AUDIT ONLINE C1-C4, C8, C9): A DOLL FOR SOMEONE ELSE. The
 * art set for the entity's own identity (a small cache, the peers'
 * identities) and the compose above, PURE of the singleton: the
 * inventory's doll, its click mask and its identity are untouched,
 * whoever composes and whenever. Answers { width, height, rgba }, or
 * null when the art is unavailable - never a doll on the wrong body.
 */
const _artSets = new Map();   // identity key -> art set, insertion-ordered (the oldest goes first)
export const PEER_ART_SETS_MAX = 8;
export async function composePaperDollPixels(deps, entity, { context = 'town', background = true } = {}) {
  const ident = { race: entity?.race ?? 'Breton', gender: entity?.gender ?? 'male', faceIndex: entity?.faceIndex ?? 0, context };
  const key = paperDollIdentityKey(ident);
  try {
    let art = _artSets.get(key);
    if (!art) {
      art = await loadArtSet(deps, ident);
      if (_artSets.size >= PEER_ART_SETS_MAX) _artSets.delete(_artSets.keys().next().value);
      _artSets.set(key, art);
    }
    const { out } = await composeDoll(art, { ...deps, gender: ident.gender, race: ident.race }, entity, { background });
    return { width: PAPERDOLL_W, height: PAPERDOLL_H, rgba: out };
  } catch { return null; }
}

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

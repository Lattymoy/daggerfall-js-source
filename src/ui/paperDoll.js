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
//   clothing = template.playerTextureArchive + bodyMorphology (SetRace;
//   Human +2 - Breton INTERIM), record = playerTextureRecord
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
// INTERIM loud: Breton male face 0 until chargen fronts identity.

import { ImgFile } from '../formats/imgFile.js';
import { CifRciFile } from '../formats/cifRciFile.js';
import { EQUIP_SLOTS, equipTableOf, getItemHands, ITEM_HANDS } from '../systems/equip.js';
import { getTemplate, paperdollOrder } from '../characters/paperdoll.js';
import { applyDyeToIndex, DYE_TARGETS, DYE_COLORS, CLOTHING_DYES } from '../characters/dyes.js';
import { clampArmorVariant, armorArchive, HUMAN_MORPHOLOGY, ARMOR_MATERIAL } from '../systems/armorMaterials.js';

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

// Breton (RaceTemplate verbatim); the other 7 races join with chargen
const RACE_ART = Object.freeze({
  Breton: {
    background: 'SCBG00I0.IMG',
    bodyMale: ['BODY00I0.IMG', 'BODY00I1.IMG'],      // unclothed, clothed
    bodyFemale: ['BODY10I0.IMG', 'BODY10I1.IMG'],
    headsMale: 'FACE00I0.CIF', headsFemale: 'FACE10I0.CIF',
  },
});
const CONTEXT_BG = Object.freeze({ town: 'SCBG04I0.IMG', dungeon: 'SCBG07I0.IMG', graveyard: 'SCBG08I0.IMG' });

// AUDIT 17e F32/F33: clampArmorVariant + the armor archive rule
// moved to systems/armorMaterials.js (they were duplicated here with
// a fabricated Chain2 constant). Re-exported for existing pins.
export { clampArmorVariant };

/** GetItemImage(forPaperDoll) resolution: {archive, record, dye,
 *  target} or null for groups with no paperdoll layer. */
export function paperdollItemImage(item, { gender = 'male' } = {}) {
  const t = getTemplate(item.templateIndex);
  if (!t) return null;
  const variants = t.variants ?? 0;
  if (item.group === 'MensClothing' || item.group === 'WomensClothing') {
    let record = t.playerTextureRecord;
    if (variants > 0) record += (CLOAK_TEMPLATES.has(item.templateIndex) ? 1 : 0) + Math.min(item.variant ?? 0, variants - 1);
    return { archive: t.playerTextureArchive + HUMAN_MORPHOLOGY, record, dye: item.dye ?? DYE_COLORS.Blue, target: DYE_TARGETS.Clothing };
  }
  if (item.group === 'Armor') {
    const archive = armorArchive(gender);
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
let _layout = [];     // blitted item layers, draw order (backwards hit test)
let _deps = null;
let _version = 0;
let _refreshing = false;
let _pending = null;   // AUDIT 17e F16: the coalesced follow-up

export async function preloadPaperDollArt(deps, { race = 'Breton', gender = 'male', faceIndex = 0, context = 'town' } = {}) {
  if (_art) return;
  try {
    const { fetchBytes, palette } = deps;
    _deps = { ...deps, gender };
    const ra = RACE_ART[race];
    const [unclothed, clothed] = gender === 'male' ? ra.bodyMale : ra.bodyFemale;
    const loadImgBmp = async (name) => {
      const img = new ImgFile();
      img.load(await fetchBytes(name), name, palette);
      return { bmp: img.getDFBitmap(), off: img.imageOffset };
    };
    const faceName = gender === 'male' ? ra.headsMale : ra.headsFemale;
    const face = new CifRciFile();
    face.load(await fetchBytes(faceName), faceName, palette);
    _art = {
      palette,
      bg: await loadImgBmp(CONTEXT_BG[context] ?? ra.background),
      nude: await loadImgBmp(unclothed),
      clothed: await loadImgBmp(clothed),
      head: { bmp: face.getDFBitmap(faceIndex, 0), off: face.getOffset(faceIndex) },
    };
  } catch { console.warn('[paperdoll] BODY/FACE/SCBG art unavailable; the panel stays bare'); }
}
export const paperDollArtLoaded = () => !!_art;

/** Blit an indexed bitmap into the 110x184 RGBA composite at its
 *  baked offset minus paperDollOrigin. rows = [y0,y1) source band
 *  (the censor welds); remap = the dye. Index 0 stays transparent;
 *  0xFF is the classic mask (removed - ChangeMask). */
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
    // background subrect fills the panel
    const bg = _art.bg.bmp;
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
    for (const slot of [EQUIP_SLOTS.Cloak2, EQUIP_SLOTS.Cloak1]) {
      const it = table[slot];
      if (!it || !CLOAK_TEMPLATES.has(it.templateIndex)) continue;
      const t = getTemplate(it.templateIndex);
      const img = await loadRecord(t.playerTextureArchive + HUMAN_MORPHOLOGY, t.playerTextureRecord);
      if (img) blit(out, img, { remap: (i) => applyDyeToIndex(i, it.dye ?? DYE_COLORS.Blue, DYE_TARGETS.Clothing) });
      break;   // DFU stops at the first drawn cloak interior
    }
    // body + welds + head (BlitBody)
    blit(out, _art.nude);
    const split = WAIST_HEIGHT;
    if (!table[EQUIP_SLOTS.ChestClothes] && !table[EQUIP_SLOTS.ChestArmor]) blit(out, _art.clothed, { rows: [0, split] });
    if (!table[EQUIP_SLOTS.LegsClothes]) blit(out, _art.clothed, { rows: [split, _art.clothed.bmp.height] });
    blit(out, _art.head);
    // items ascending drawOrder (BlitItems)
    const ordered = paperdollOrder(worn.map((w) => ({ ...w.it, drawOrder: w.t.drawOrderOrEffect })));
    for (const it of ordered) {
      const res = paperdollItemImage(it, { gender: _deps.gender });
      if (!res) continue;
      const img = await loadRecord(res.archive, res.record);
      if (!img) continue;
      const remap = res.target == null ? null : (i) => applyDyeToIndex(i, res.dye, res.target);
      blit(out, img, { remap });
      layout.push({ slot: it.equipSlot, img });
    }
    const key = `paperdoll_v${++_version}`;
    const prevKey = _live?.key ?? null;
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

/** Test seam. */
export const _debugPaperDoll = () => ({ live: !!_live, layers: _layout.map((l) => l.slot), version: _version });

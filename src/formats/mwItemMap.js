// ═══════════════════════════════════════════════════════════════════
// THE ITEM MAP — every Daggerfall equippable against Morrowind's
// records, in ONE table with three guarantees (Mac's brief,
// 2026-08-30):
//
//   1. ONE HOME. Every consumer - the hand attach that exists, the
//      worn body when its slice lands, ground drops later - resolves
//      a DF item through here and nowhere else. The weapon half
//      already lives in mwFirstPerson (DF_TO_MW_WEAPON /
//      DF_TO_MW_MATERIAL / pickWeaponRecord, MW-D9's declared
//      divergence); this module is the door in front of both halves
//      and the armor half's home.
//
//   2. TOTAL, AND HONEST. itemMapCoverage() enumerates every weapon
//      template x weapon material and every armor template x armor
//      material and answers a ROW for each - and a row is allowed to
//      say "keep the classic sprite", but it must SAY it (the
//      anti-lie law), never fall through silently. The pin walks the
//      whole space.
//
//   3. NEVER TRAPS. Resolution is against the PLAYER'S records at
//      runtime by search token, exactly as pickWeaponRecord does -
//      this repo cannot know what ids a modded Morrowind carries. A
//      row that resolves to nothing costs that item its MW model and
//      it draws the classic sprite, with the miss NAMED in the
//      report (mwItemReport, on the mw-inspect page).
//
// ── THE ROWS THAT ARE JUDGEMENT, not translation ─────────────────
// DF's armor materials are not MW's, and the misses are recorded
// here rather than smoothed:
//   - SILVER. Morrowind has no silver armor at all. Steel is the
//     nearest metal that exists; nothing here is right.
//   - LEATHER -> netch leather, MW's own light-leather line. Its
//     hands are BRACERS, not gauntlets, so the gauntlet row tries
//     both tokens in order.
//   - CHAIN -> imperial chain, which exists ONLY as cuirass and
//     greaves on retail. Every other chain piece will report a miss
//     and keep its sprite - that is the DATA being thin, and the
//     report says so instead of a wrong metal standing in.
//   - MITHRIL/ELVEN -> glass, ADAMANTIUM -> ebony, DWARVEN ->
//     'dwemer' (the armor ids' own spelling; the WEAPON ids spell it
//     'dwarven', which is exactly why armor gets its own material
//     table instead of reusing the weapon one).
// ═══════════════════════════════════════════════════════════════════

import { WEAPONS, WEAPON_MATERIALS } from '../characters/weapons.js';
import { ARMOR_MATERIAL } from '../systems/armorMaterials.js';
import { ARMOR_ENUM } from '../combat/enemyEquipment.js';
import templates from '../characters/itemTemplates.json' with { type: 'json' };

/** ARMOR_ENUM.Helm, held as its own name because the composer's
 *  helmet-hides-hair rule (AUDIT 30 F1) keys on it. */
const HELM_TEMPLATE = ARMOR_ENUM.Helm;

/** MW's CLOT types (loadclot.hpp). Gloves and jewellery exist in the
 *  enum and have no Daggerfall garment, so no row maps to them. */
export const MW_CLOTHING_TYPE = Object.freeze({
  Pants: 0, Shoes: 1, Shirt: 2, Belt: 3, Robe: 4,
  RGlove: 5, LGlove: 6, Skirt: 7, Ring: 8, Amulet: 9,
});

/** Template index -> garment NAME for the wearable range (equipRules'
 *  MensClothing/WomensClothing, 141-216). The DB names garments and
 *  the rows below key on those names - two sexes, one law. */
export const CLOTHING_NAME = Object.freeze(Object.fromEntries(
  templates.filter((t) => t.index >= 141 && t.index <= 216).map((t) => [t.index, t.name])));

/** DF garment name -> the MW CLOT type it resolves against, plus the
 *  reference slot behaviour it triggers. JUDGEMENT ROWS, recorded:
 *  - CLOAKS wear MW ROBES. Morrowind has no cloak; a robe is the one
 *    garment that drapes, and a cloak kept as a sprite would leave
 *    the most visible garment in the game undressed.
 *  - GOWNS, DRESSES, SURCOATS, TOGA, KIMONO wear robes for the same
 *    reason - MW's wardrobe has no separates that drape.
 *  - KHAJIIT SUIT wears a shirt: one garment cannot become two CLOT
 *    records, and the top half is the visible one under pants.
 *  - SASH wears a belt, and retail belts carry no worn part
 *    references - the composer will say so and the sprite stands,
 *    which is the honest outcome for a garment MW does not draw.
 *  `reserve` marks the reference's slot law: robes reserve eleven
 *  part slots, skirts three (npcanimation.cpp:635-650). */
export const DF_CLOTHING_ROWS = Object.freeze({
  'Straps': { type: MW_CLOTHING_TYPE.Shirt }, 'Challenger Straps': { type: MW_CLOTHING_TYPE.Shirt },
  'Champion Straps': { type: MW_CLOTHING_TYPE.Shirt }, 'Armbands': { type: MW_CLOTHING_TYPE.Shirt },
  'Fancy Armbands': { type: MW_CLOTHING_TYPE.Shirt }, 'Eodoric': { type: MW_CLOTHING_TYPE.Shirt },
  'Formal Eodoric': { type: MW_CLOTHING_TYPE.Shirt }, 'Short Tunic': { type: MW_CLOTHING_TYPE.Shirt },
  'Formal Tunic': { type: MW_CLOTHING_TYPE.Shirt }, 'Reversible Tunic': { type: MW_CLOTHING_TYPE.Shirt },
  'Open Tunic': { type: MW_CLOTHING_TYPE.Shirt }, 'Short Shirt': { type: MW_CLOTHING_TYPE.Shirt },
  'Long Shirt': { type: MW_CLOTHING_TYPE.Shirt }, 'Vest': { type: MW_CLOTHING_TYPE.Shirt },
  'Brassiere': { type: MW_CLOTHING_TYPE.Shirt }, 'Formal Brassiere': { type: MW_CLOTHING_TYPE.Shirt },
  'Peasant Blouse': { type: MW_CLOTHING_TYPE.Shirt }, 'Khajiit Suit': { type: MW_CLOTHING_TYPE.Shirt },
  'Casual Pants': { type: MW_CLOTHING_TYPE.Pants }, 'Breeches': { type: MW_CLOTHING_TYPE.Pants },
  'Loincloth': { type: MW_CLOTHING_TYPE.Pants }, 'Tights': { type: MW_CLOTHING_TYPE.Pants },
  'Shoes': { type: MW_CLOTHING_TYPE.Shoes }, 'Sandals': { type: MW_CLOTHING_TYPE.Shoes },
  'Boots': { type: MW_CLOTHING_TYPE.Shoes }, 'Tall Boots': { type: MW_CLOTHING_TYPE.Shoes },
  'Short Skirt': { type: MW_CLOTHING_TYPE.Skirt, reserve: 'skirt' },
  'Long Skirt': { type: MW_CLOTHING_TYPE.Skirt, reserve: 'skirt' },
  'Wrap': { type: MW_CLOTHING_TYPE.Skirt, reserve: 'skirt' },
  'Sash': { type: MW_CLOTHING_TYPE.Belt },
  'Kimono': { type: MW_CLOTHING_TYPE.Robe, reserve: 'robe' },
  'Toga': { type: MW_CLOTHING_TYPE.Robe, reserve: 'robe' },
  'Plain Robes': { type: MW_CLOTHING_TYPE.Robe, reserve: 'robe' },
  'Priest Robes': { type: MW_CLOTHING_TYPE.Robe, reserve: 'robe' },
  'Priestess Robes': { type: MW_CLOTHING_TYPE.Robe, reserve: 'robe' },
  'Casual Cloak': { type: MW_CLOTHING_TYPE.Robe, reserve: 'robe' },
  'Formal Cloak': { type: MW_CLOTHING_TYPE.Robe, reserve: 'robe' },
  'Dwynnen Surcoat': { type: MW_CLOTHING_TYPE.Robe, reserve: 'robe' },
  'Anticlere Surcoat': { type: MW_CLOTHING_TYPE.Robe, reserve: 'robe' },
  'Casual Dress': { type: MW_CLOTHING_TYPE.Robe, reserve: 'robe' },
  'Strapless Dress': { type: MW_CLOTHING_TYPE.Robe, reserve: 'robe' },
  'Evening Gown': { type: MW_CLOTHING_TYPE.Robe, reserve: 'robe' },
  'Day Gown': { type: MW_CLOTHING_TYPE.Robe, reserve: 'robe' },
});

/** The reference's reserve lists (npcanimation.cpp:635-650), by PRT
 *  index: a robe occupies eleven slots, a skirt three - hiding the
 *  skin AND any lower-priority garment there, refs or no refs. */
export const RESERVES = Object.freeze({
  robe: [4, 5, 21, 22, 13, 14, 19, 20, 11, 12, 3],
  skirt: [4, 21, 22],
});
import { DF_TO_MW_WEAPON } from './mwFirstPerson.js';

/** DF armor material -> the token MW armor record ids carry. */
export const DF_TO_MW_ARMOR_MATERIAL = Object.freeze({
  Leather: 'netch', Chain: 'chain', Chain2: 'chain',
  Iron: 'iron', Steel: 'steel', Silver: 'steel', Elven: 'glass',
  Dwarven: 'dwemer', Mithril: 'glass', Adamantium: 'ebony',
  Ebony: 'ebony', Orcish: 'orcish', Daedric: 'daedric',
});

/** DF armor template -> how to find its MW records.
 *  `tokens` are tried IN ORDER (netch's hands are bracers);
 *  `not` excludes (a shield must not match a towershield);
 *  `sides` asks for one record per side (MW splits pairs). */
export const DF_ARMOR_ROWS = Object.freeze({
  [ARMOR_ENUM.Cuirass]: { tokens: ['cuirass'] },
  [ARMOR_ENUM.Greaves]: { tokens: ['greaves'] },
  [ARMOR_ENUM.Helm]: { tokens: ['helmet', 'helm'] },
  [ARMOR_ENUM.Boots]: { tokens: ['boots'] },
  [ARMOR_ENUM.Gauntlets]: { tokens: ['gauntlet', 'bracer'], sides: ['left', 'right'] },
  [ARMOR_ENUM.Left_Pauldron]: { tokens: ['pauldron'], sides: ['left'] },
  [ARMOR_ENUM.Right_Pauldron]: { tokens: ['pauldron'], sides: ['right'] },
  // Morrowind has ONE shield size plus the towershield. DF's buckler,
  // round and kite all land on the plain shield - a size DF draws and
  // MW does not hold - and the tower takes MW's own tower.
  [ARMOR_ENUM.Buckler]: { tokens: ['shield'], not: ['towershield'] },
  [ARMOR_ENUM.Round_Shield]: { tokens: ['shield'], not: ['towershield'] },
  [ARMOR_ENUM.Kite_Shield]: { tokens: ['shield'], not: ['towershield'] },
  [ARMOR_ENUM.Tower_Shield]: { tokens: ['towershield'] },
});

/** The weapon rows this map DECLARES as sprite-keepers rather than
 *  mapping - each with its reason, because a silent None is a lie. */
export const DECLARED_SPRITE_WEAPONS = Object.freeze({
  Arrow: 'ammunition - drawn by the bow\u2019s own attachArrow, never in the hand',
});

const matName = (table, v) => Object.entries(table).find(([, x]) => x === v)?.[0] ?? null;

/** Resolve one DF garment against the CLOT records: BY TYPE, id-sorted,
 *  enchanted excluded - and on retail the id sort puts common_ ahead of
 *  expensive_ and its betters, so the street clothes win, which is the
 *  right wardrobe for a derived outfit. Null-honest. */
export function mwClothingRecord(clothes, name) {
  const row = DF_CLOTHING_ROWS[name];
  if (!row) return { record: null, row: null, note: `"${name}" is not a garment row` };
  const pool = (clothes ?? []).filter((c) => c.type === row.type && !c.enchanted)
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  if (!pool.length) return { record: null, row, note: `no MW clothing of type ${row.type} in these archives - the classic sprite stands` };
  return { record: pool[0], row, note: 'resolved' };
}

/**
 * Resolve one DF armor piece against the player's parsed ARMO records.
 * Returns { records, row, material, note } - `records` empty means KEEP
 * THE SPRITE, and `note` says why in words the report can print.
 */
export function mwArmorRecords(armorRecords, templateIndex, material) {
  const row = DF_ARMOR_ROWS[templateIndex];
  if (!row) return { records: [], row: null, note: `template ${templateIndex} is not an armor row` };
  const mName = matName(ARMOR_MATERIAL, material);
  const token = DF_TO_MW_ARMOR_MATERIAL[mName] ?? null;
  if (!token) return { records: [], row, note: `no MW material for ${mName ?? material}` };
  const all = (armorRecords ?? []).filter((r) => {
    const id = String(r.id || '').toLowerCase();
    if (!id.includes(token)) return false;
    if ((row.not ?? []).some((n) => id.includes(n))) return false;
    return true;
  });
  const byToken = (list) => {
    for (const t of row.tokens) {
      const hit = list.filter((r) => String(r.id || '').toLowerCase().includes(t));
      if (hit.length) return hit;
    }
    return [];
  };
  const pool = byToken(all).sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  if (!pool.length) {
    return { records: [], row, material: token, note: `no ${token} ${row.tokens[0]} in these archives - the classic sprite stands` };
  }
  if (!row.sides) return { records: [pool[0]], row, material: token, note: 'resolved' };
  const records = [];
  const missing = [];
  for (const side of row.sides) {
    const hit = pool.find((r) => String(r.id || '').toLowerCase().includes(side));
    if (hit) records.push(hit); else missing.push(side);
  }
  if (!records.length) {
    return { records: [], row, material: token, note: `no sided ${row.tokens[0]} (${row.sides.join('/')}) - the classic sprite stands` };
  }
  return {
    records, row, material: token,
    note: missing.length ? `resolved, but the ${missing.join(' and ')} side is missing` : 'resolved',
  };
}

/**
 * THE TOTALITY ANSWER: one entry for every weapon template x weapon
 * material and every armor template x armor material. Each entry is
 * either { kind:'mapped', ... } or { kind:'sprite', reason } - and the
 * pin fails the build if any combination answers neither.
 */
export function itemMapCoverage() {
  const out = [];
  for (const [wName] of Object.entries(WEAPONS)) {
    for (const [mName, m] of Object.entries(WEAPON_MATERIALS)) {
      if (m === WEAPON_MATERIALS.None) continue;
      if (wName in DECLARED_SPRITE_WEAPONS) {
        out.push({ kind: 'sprite', item: wName, material: mName, reason: DECLARED_SPRITE_WEAPONS[wName] });
      } else if (wName in DF_TO_MW_WEAPON) {
        out.push({ kind: 'mapped', item: wName, material: mName, via: 'weapon' });
      } else {
        out.push({ kind: 'UNMAPPED', item: wName, material: mName });
      }
    }
  }
  for (const [aName, tmpl] of Object.entries(ARMOR_ENUM)) {
    for (const [mName, m] of Object.entries(ARMOR_MATERIAL)) {
      if (m === ARMOR_MATERIAL.None) continue;
      const hasRow = tmpl in DF_ARMOR_ROWS;
      const hasMat = mName in DF_TO_MW_ARMOR_MATERIAL;
      if (hasRow && hasMat) out.push({ kind: 'mapped', item: aName, material: mName, via: 'armor' });
      else out.push({ kind: 'UNMAPPED', item: aName, material: mName });
    }
  }
  // MW-D30: every WEARABLE GARMENT index answers - the DB names it and
  // a row maps the name, or the space itself says which garment fell
  // through. Dyes are one declared judgement, not seventy rows: MW's
  // wardrobe has no dye channel, so every colour of a Short Shirt
  // wears the one shirt the type resolves to.
  for (const [idx, name] of Object.entries(CLOTHING_NAME)) {
    if (name in DF_CLOTHING_ROWS) out.push({ kind: 'mapped', item: `${name} (${idx})`, material: 'any dye', via: 'clothing' });
    else out.push({ kind: 'UNMAPPED', item: `${name} (${idx})`, material: 'any dye' });
  }
  return out;
}

/**
 * THE REPORT, for the mw-inspect page: every armor row x material
 * against the archives actually attached, so a player (or Mac) sees
 * which items will wear Morrowind and which keep their sprite - with
 * the reason - before ever equipping one. Weapons ride the existing
 * pickWeaponRecord; this covers the half that is new.
 */
export function mwItemReport(armorRecords) {
  const rows = [];
  for (const [aName, tmpl] of Object.entries(ARMOR_ENUM)) {
    for (const mName of Object.keys(DF_TO_MW_ARMOR_MATERIAL)) {
      if (mName === 'Chain2') continue;   // one report line for chain
      const res = mwArmorRecords(armorRecords, tmpl, ARMOR_MATERIAL[mName]);
      rows.push({
        item: `${mName} ${aName.replaceAll('_', ' ')}`,
        found: res.records.map((r) => r.id),
        note: res.note,
      });
    }
  }
  return rows;
}

// ═══ MW-D29: WORN ARMOR - the consumer ══════════════════════════════

/** The ARMO/CLOT INDX enum - 27 SIDED entries (loadarmo.hpp's
 *  PartReferenceType), and NOT the 15-entry unsided BYDT enum the
 *  BODY records use. Confusing the two is this slice's byte-eight
 *  trap, so the table is written out whole: base slot, side, and the
 *  skeleton bone the reference hangs on (npcanimation's part list;
 *  PART_BONES already carries these exact spellings for the unsided
 *  pairs). `shadows` names the SKIN slot the piece hides - a pauldron
 *  and a skirt shadow nothing; they layer over clavicle and groin
 *  skin the way the reference layers them. Weapon (25) is not a row:
 *  the weapon door (MW-D9/D19) owns that bone.
 */
export const ARMO_PART = Object.freeze([
  { name: 'head', bones: ['head'], shadows: 'head' },
  { name: 'hair', bones: ['head'], shadows: 'hair' },
  { name: 'neck', bones: ['neck'], shadows: 'neck' },
  { name: 'cuirass', bones: ['chest'], shadows: 'chest' },
  { name: 'groin', bones: ['groin'], shadows: 'groin' },
  { name: 'skirt', bones: ['groin'], shadows: null },
  { name: 'right hand', bones: ['right hand'], shadows: 'hand:right' },
  { name: 'left hand', bones: ['left hand'], shadows: 'hand:left' },
  { name: 'right wrist', bones: ['right wrist'], shadows: 'wrist:right' },
  { name: 'left wrist', bones: ['left wrist'], shadows: 'wrist:left' },
  { name: 'shield', bones: ['shield bone'], shadows: null },
  { name: 'right forearm', bones: ['right forearm'], shadows: 'forearm:right' },
  { name: 'left forearm', bones: ['left forearm'], shadows: 'forearm:left' },
  { name: 'right upper arm', bones: ['right upper arm'], shadows: 'upperarm:right' },
  { name: 'left upper arm', bones: ['left upper arm'], shadows: 'upperarm:left' },
  { name: 'right foot', bones: ['right foot'], shadows: 'foot:right' },
  { name: 'left foot', bones: ['left foot'], shadows: 'foot:left' },
  { name: 'right ankle', bones: ['right ankle'], shadows: 'ankle:right' },
  { name: 'left ankle', bones: ['left ankle'], shadows: 'ankle:left' },
  { name: 'right knee', bones: ['right knee'], shadows: 'knee:right' },
  { name: 'left knee', bones: ['left knee'], shadows: 'knee:left' },
  { name: 'right upper leg', bones: ['right upper leg'], shadows: 'upperleg:right' },
  { name: 'left upper leg', bones: ['left upper leg'], shadows: 'upperleg:left' },
  { name: 'right pauldron', bones: ['right clavicle'], shadows: null },
  { name: 'left pauldron', bones: ['left clavicle'], shadows: null },
  { name: 'weapon', bones: [], shadows: null },
  { name: 'tail', bones: ['tail'], shadows: 'tail' },
]);

/** DF's whole worn readout: armor from its seven slots plus shields
 *  from the hands (a weapon there is the weapon door's business), and
 *  GARMENTS from the clothing slots - chest, legs, feet, and the two
 *  cloak slots the robes-and-cloaks judgement dresses as robes. */
export function dfWornEquipment(slots, EQUIP_SLOTS, ARMOR_ENUM_) {
  const worn = dfWornArmor(slots, EQUIP_SLOTS, ARMOR_ENUM_).map((p) => ({ ...p, kind: 'armor' }));
  const S = EQUIP_SLOTS;
  for (const k of ['ChestClothes', 'LegsClothes', 'Feet', 'Cloak1', 'Cloak2']) {
    const it = slots[S[k]];
    if (it && typeof it.templateIndex === 'number' && it.templateIndex in CLOTHING_NAME) {
      worn.push({ kind: 'clothing', templateIndex: it.templateIndex, name: CLOTHING_NAME[it.templateIndex] });
    }
  }
  return worn;
}

/** DF's own worn-armor readout: which equip slots carry pieces this
 *  door can dress. Hands are checked for SHIELDS only - a weapon in a
 *  hand is the weapon door's business. */
export function dfWornArmor(slots, EQUIP_SLOTS, ARMOR_ENUM) {
  const worn = [];
  const take = (item) => {
    if (item && typeof item.templateIndex === 'number' && item.templateIndex in DF_ARMOR_ROWS) {
      worn.push({ templateIndex: item.templateIndex, material: item.material ?? 0 });
    }
  };
  const S = EQUIP_SLOTS;
  for (const k of ['Head', 'RightArm', 'LeftArm', 'ChestArmor', 'Gloves', 'LegsArmor', 'Feet']) take(slots[S[k]]);
  for (const k of ['RightHand', 'LeftHand']) {
    const it = slots[S[k]];
    if (it && it.templateIndex >= ARMOR_ENUM.Buckler && it.templateIndex <= ARMOR_ENUM.Tower_Shield) take(it);
  }
  return worn;
}

/**
 * COMPOSE the worn armor onto the body's part rows. Pure: takes the
 * player's pieces, the parsed ARMO records, the BODY pool, and the
 * sex; answers what to ADD (part meshes on their sided bones), what
 * to SHADOW (skin slots or single sides the armor hides), and NOTES
 * for everything that keeps its sprite instead. Never throws: a
 * missing record, an unknown INDX, a ref with no id for this sex -
 * each is a note, the skin stands, the law is never-traps.
 */
export function composeWornArmor({ pieces, armors, clothes, bodyPool, female = false }) {
  const notes = [];
  const bodyById = new Map((bodyPool ?? []).map((b) => [String(b.id || '').toLowerCase(), b]));
  // ── THE PRIORITY LAW (Audit 30's recording, now consumed) ────────
  // Every PRT slot is an arbitration: the skin holds it at priority 1,
  // a garment claims it at ((base+1)<<1) + (armor ? 1 : 0) - so armor
  // beats clothing at the same base, a robe's base of 11 beats a
  // cuirass's 0, and a skirt's 3 beats pants. The gate is STRICTLY
  // GREATER (addOrReplaceIndividualPart, npcanimation.cpp:771;
  // reserveIndividualPart, :746) - a tie keeps the FIRST claimant,
  // which is why the robe's own refs survive the robe's reserve of
  // the same slots at the same priority, and why the pieces walk in
  // the reference's slotlist order (:590-604, robe first). A robe or
  // a skirt RESERVES its slot list at its priority - occupation
  // without a mesh - hiding the skin and any lesser garment there,
  // refs or no refs.
  const slots = Array.from({ length: ARMO_PART.length }, () => ({ prio: 1, add: null, shadow: false }));
  const claim = (part, prio, add) => {
    const slot = slots[part];
    if (!slot || prio <= slot.prio) return;
    slot.prio = prio; slot.add = add; slot.shadow = true;
  };
  const ordered = [...(pieces ?? [])].sort((a, b) => wornOrder(a) - wornOrder(b));
  let hairHidden = 0;
  for (const piece of ordered) {
    if (piece.kind === 'clothing') {
      const name = piece.name ?? CLOTHING_NAME[piece.templateIndex];
      const res = mwClothingRecord(clothes, name);
      if (!res.record) { notes.push(`${name ?? piece.templateIndex}: ${res.note}`); continue; }
      const base = res.row.reserve === 'robe' ? 11 : res.row.reserve === 'skirt' ? 3 : 0;
      const prio = ((base + 1) << 1) + 0;
      composeRefs(res.record, prio, female, bodyById, claim, notes);
      for (const part of RESERVES[res.row.reserve] ?? []) claim(part, prio, null);
      continue;
    }
    const res = mwArmorRecords(armors, piece.templateIndex, piece.material);
    if (!res.records.length) { notes.push(`armor ${piece.templateIndex}: ${res.note}`); continue; }
    const prio = ((0 + 1) << 1) + 1;
    // AUDIT 30 F1: A HELMET HIDES THE HAIR - an engine rule, not a
    // part reference (npcanimation.cpp:615), prior to the refs.
    if (piece.templateIndex === HELM_TEMPLATE) hairHidden = Math.max(hairHidden, prio);
    for (const armo of res.records) {
      if (!armo.parts?.length) { notes.push(`${armo.id}: no worn part references - the ground mesh is not a body`); continue; }
      composeRefs(armo, prio, female, bodyById, claim, notes);
    }
  }
  if (hairHidden) claim(1, hairHidden, null);
  const adds = [];
  const shadows = new Set();
  for (let i2 = 0; i2 < slots.length; i2++) {
    if (!slots[i2].shadow) continue;
    if (slots[i2].add) adds.push(slots[i2].add);
    const key = ARMO_PART[i2].shadows;
    if (key) shadows.add(key);
  }
  return { adds, shadows: [...shadows], notes };
}

/** One record's part references, claimed at one priority. */
function composeRefs(rec, prio, female, bodyById, claim, notes) {
  for (const ref of rec.parts ?? []) {
    const row = ARMO_PART[ref.part];
    if (!row) { notes.push(`${rec.id}: INDX ${ref.part} is outside the enum`); continue; }
    if (row.name === 'weapon') continue;
    const id = (female && ref.female) || ref.male || ref.female;
    if (!id) { notes.push(`${rec.id}: ${row.name} names no body part`); continue; }
    const body = bodyById.get(id);
    if (!body) { notes.push(`${rec.id}: ${row.name} wants "${id}" and no BODY record carries it`); continue; }
    claim(ref.part, prio, { slot: `${row.name} (${rec.id})`, bones: row.bones, model: body.model, recordId: id });
  }
}

/** The reference's slotlist order (npcanimation.cpp:590-604), as a
 *  rank: robe, skirt, helm, cuirass, greaves, pauldrons, boots,
 *  gauntlets, shirt, pants, carried. Ties in priority go to the LATER
 *  rank, which this sort makes true by walking earlier ranks first. */
function wornOrder(piece) {
  if (piece.kind === 'clothing') {
    const row = DF_CLOTHING_ROWS[piece.name ?? CLOTHING_NAME[piece.templateIndex]];
    if (row?.reserve === 'robe') return 0;
    if (row?.reserve === 'skirt') return 1;
    if (row?.type === MW_CLOTHING_TYPE.Shirt) return 10;
    return 11;                                   // pants, shoes, belts
  }
  const t = piece.templateIndex;
  if (t === ARMOR_ENUM.Helm) return 2;
  if (t === ARMOR_ENUM.Cuirass) return 3;
  if (t === ARMOR_ENUM.Greaves) return 4;
  if (t === ARMOR_ENUM.Left_Pauldron) return 5;
  if (t === ARMOR_ENUM.Right_Pauldron) return 6;
  if (t === ARMOR_ENUM.Boots) return 7;
  if (t === ARMOR_ENUM.Gauntlets) return 8;
  return 12;                                     // shields, the carried pair
}

/** MW-D31: WHAT THE FIRST PERSON WEARS. The reference shows the fp
 *  camera your gauntlets, your sleeves, and your shield - the body
 *  itself it hides with the neck-scale trick, so a helmet or a
 *  cuirass never floats in your face. The port has no body in fp at
 *  all, so the same picture falls out of a FILTER: worn adds pass
 *  into the fp build only on the arm-family bones and the shield
 *  bone. Everything else is the third person's business. */
const FP_WORN_BONES = new Set([
  'left hand', 'right hand', 'left wrist', 'right wrist',
  'left forearm', 'right forearm', 'left upper arm', 'right upper arm',
  'shield bone',
]);
export function fpWornAdds(adds) {
  return (adds ?? []).filter((a) => (a.bones ?? []).some((b) => FP_WORN_BONES.has(b)));
}

/** Apply the shadows to the skin rows' bone lists: 'chest' hides the
 *  whole slot; 'hand:right' trims one side's bone and keeps the
 *  other. Returns the surviving rows - the input is not mutated. */
export function shadowSkinRows(rows, shadows) {
  const whole = new Set();
  const sided = new Map();
  for (const s of shadows ?? []) {
    const [slot, side] = String(s).split(':');
    if (side) { if (!sided.has(slot)) sided.set(slot, new Set()); sided.get(slot).add(side); }
    else whole.add(slot);
  }
  const out = [];
  for (const row of rows ?? []) {
    if (whole.has(row.slot)) continue;
    const sides = sided.get(row.slot);
    if (!sides) { out.push(row); continue; }
    const bones = (row.bones ?? []).filter((b) => ![...sides].some((sd) => b.startsWith(`${sd} `)));
    if (bones.length) out.push({ ...row, bones });
  }
  return out;
}

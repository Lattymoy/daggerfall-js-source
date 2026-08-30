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
export function composeWornArmor({ pieces, armors, bodyPool, female = false }) {
  const adds = [];
  const shadows = new Set();
  const notes = [];
  const bodyById = new Map((bodyPool ?? []).map((b) => [String(b.id || '').toLowerCase(), b]));
  for (const piece of pieces ?? []) {
    const res = mwArmorRecords(armors, piece.templateIndex, piece.material);
    if (!res.records.length) { notes.push(`armor ${piece.templateIndex}: ${res.note}`); continue; }
    for (const armo of res.records) {
      if (!armo.parts?.length) { notes.push(`${armo.id}: no worn part references - the ground mesh is not a body`); continue; }
      for (const ref of armo.parts) {
        const row = ARMO_PART[ref.part];
        if (!row) { notes.push(`${armo.id}: INDX ${ref.part} is outside the enum`); continue; }
        if (row.name === 'weapon') continue;
        const id = (female && ref.female) || ref.male || ref.female;
        if (!id) { notes.push(`${armo.id}: ${row.name} names no body part`); continue; }
        const body = bodyById.get(id);
        if (!body) { notes.push(`${armo.id}: ${row.name} wants "${id}" and no BODY record carries it`); continue; }
        adds.push({ slot: `${row.name} (${armo.id})`, bones: row.bones, model: body.model, recordId: id });
        if (row.shadows) shadows.add(row.shadows);
      }
    }
  }
  return { adds, shadows: [...shadows], notes };
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

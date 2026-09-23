// RR2 - THE NPC SPRITE VARIANTS. RoleplayRealism.cs :775-1077 (Hazelnut,
// MIT): OnTransitionToInterior_VariantShopTavernNPCsprites (a shop's or
// tavern's `182_0/1/2` keeper re-materialised to the mod's own
// `197_N` sprites by the building's quality) and
// OnTransitionToInterior_VariantResidenceNPCsprites (four of five
// residents re-drawn as the townsfolk walkers of the climate's race, with
// a face to match). DFU rewrites the interior's Billboards after the
// transition; the port's interior context stands its people once, so
// the same decision is asked as each person is listed - `rrVariantPerson`
// - and the answer is what the billboard draws. The seven `197_N-0`
// textures are the mod's own art, shipped under public/art/roleplay-
// realism/ and registered on the replacement door for archive 197 (a
// classic archive, kludgeTown) with the XML scale beside each.
//
// The Villager Variety arm (:948-978 - that mod's own image for the
// resident, asked over the mod message bus) has no counterpart: the port
// does not carry that mod, so `materialSet` is false and the billboard
// takes the walker's archive, exactly the C#'s else.
import { PERSON_TEXTURES, PERSON_FACE_RECORDS, PERSON_IDLE_RECORD, NUM_PERSON_FACE_VARIANTS } from '../characters/mobilePerson.js';
import { getWorldClimateSettings, FACTION_RACES } from '../formats/mapsFile.js';
import { BUILDING_TYPES, isResidence } from '../world/buildingNames.js';
import { isShop } from './shopStock.js';
import { addVendorTextures } from './textureReplacement.js';
import { registerBillboardXml } from '../world/billboardXml.js';
import { registerButtonArt } from '../ui/messageBox.js';
import { setFlatFaceOverride } from '../characters/staticNpc.js';
import { APP_ROOT } from './appRoot.js';
import { rrModule, rrRefinedTrainingOn } from './rrRealism.js';

export const RR_ART_DIR = 'art/roleplay-realism';
/** The shipped sprite's URL - `<root>/art/roleplay-realism/<name>.png`. */
export const rrArtUrl = (name, root = APP_ROOT ?? globalThis.document?.baseURI ?? 'http://localhost/') =>
  new URL(`${RR_ART_DIR}/${encodeURIComponent(name)}.png`, root).href;

/** The mod's Textures/197_N-0.xml, verbatim: `<scaleX>` / `<scaleY>` per
 *  record (TextureReplacement's billboard scale). */
export const RR_NPC_XML_SCALE = Object.freeze({
  0: [1.205, 0.987], 1: [1.516, 0.950], 2: [1.205, 0.938], 3: [1.237, 1.333],
  4: [1, 0.98], 5: [1.2, 1.03], 6: [3, 0.8],
});
export const RR_NPC_ARCHIVE = 197;
export const RR_NPC_RECORDS = Object.freeze([0, 1, 2, 3, 4, 5, 6]);
/** The mod's Textures/Buttons: BUTTONS.RCI records 21..37 (indexButtons.txt
 *  names them - 21 is "5 Days", the training window's week button). */
export const RR_BUTTON_RECORDS = Object.freeze([21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37]);

// ---- the shop / tavern keeper (:775-849) ---------------------------------
/** GetRecord_182_0 (:826-849): the 197 record for a shop's 182_0 keeper by
 *  the building's quality - 0 for 6-9, 1 for 10-13, 2 for 14-17, 3 for
 *  18-20; anything else (a quality under 6) is -1, no swap. */
export function rrRecord182_0(quality) {
  if (quality >= 6 && quality <= 9) return 0;
  if (quality >= 10 && quality <= 13) return 1;
  if (quality >= 14 && quality <= 17) return 2;
  if (quality >= 18 && quality <= 20) return 3;
  return -1;
}
/** The three arms of the shop/tavern swap (:790-820): 182_0 by
 *  GetRecord_182_0; 182_1 (the tavern keeper) to 4 under quality 12 and 5
 *  past 14 (12-14 keeps the classic); 182_2 to 6 past 12. Answers the 197
 *  record, or -1. Only in a tavern or a shop. */
export function rrShopTavernRecord(archive, record, buildingType, quality) {
  if (archive !== 182) return -1;
  if (!(buildingType === BUILDING_TYPES.Tavern || isShop(buildingType))) return -1;
  if (record === 0) return rrRecord182_0(quality);
  if (record === 1) return quality < 12 ? 4 : quality > 14 ? 5 : -1;
  if (record === 2) return quality > 12 ? 6 : -1;
  return -1;
}

// ---- the residents (:851-1077) ---------------------------------------------
/** GetGender182 / GetGender184 (:1037-1077): the records that are a woman
 *  or a man; anything else is -1 (not a person to replace). */
const GENDER_182 = Object.freeze({ female: new Set([10, 12, 28, 41, 45]), male: new Set([15, 17, 19, 20, 35, 39, 46]) });
const GENDER_184 = Object.freeze({ female: new Set([1, 7, 9, 10, 19, 22, 23, 26, 28, 29, 30, 33]), male: new Set([0, 4, 16, 17, 20, 21, 24, 25]) });
export function rrResidentGender(archive, record) {
  const t = archive === 182 ? GENDER_182 : archive === 184 ? GENDER_184 : null;
  if (!t) return -1;
  return t.female.has(record) ? 1 : t.male.has(record) ? 0 : -1;
}
/** GetClimateRace (:985-996): PlayerGPS.ClimateSettings.People - Redguard
 *  and Nord as they are, everything else (Breton, and the C#'s default
 *  arm) Breton. `worldClimate` is the location's climate. */
export function rrClimateRace(worldClimate) {
  const people = getWorldClimateSettings(worldClimate)?.people;
  if (people === FACTION_RACES.Redguard) return 'Redguard';
  if (people === FACTION_RACES.Nord) return 'Nord';
  return 'Breton';
}
/** The resident swap (:862-932): a faction-0 person of a known gender,
 *  `faceVariant = nameSeed % 29` under 24 (four in five), `outfitVariant =
 *  nameSeed % 4`; the walker archive of the race and gender at that
 *  outfit, record 5 (the idle frame), FramesPerSecond 1; the face
 *  record + faceVariant written into FLATS.CFG's dictionary for the
 *  ORIGINAL flat (the talk portrait). Answers { textureArchive,
 *  textureRecord, faceIndex } or null. */
export function rrResidentVariant({ archive, record, factionID = 0, nameSeed = 0 }, race = 'Breton') {
  const gender = rrResidentGender(archive, record);
  if (gender === -1 || factionID !== 0) return null;
  const faceVariant = nameSeed % 29;
  if (faceVariant >= NUM_PERSON_FACE_VARIANTS) return null;
  const outfitVariant = nameSeed % 4;
  const sex = gender === 0 ? 'male' : 'female';
  const textures = PERSON_TEXTURES[race] ?? PERSON_TEXTURES.Breton;
  const faces = PERSON_FACE_RECORDS[race] ?? PERSON_FACE_RECORDS.Breton;
  return { textureArchive: textures[sex][outfitVariant], textureRecord: PERSON_IDLE_RECORD, faceIndex: faces[sex][outfitVariant] + faceVariant, gender };
}

/** The one decision per person as the interior lists it: the keeper's
 *  swap under variantNpcs in a tavern or a shop, the resident's under
 *  variantResidents in a house. `pn` is the interior person (archive,
 *  record, factionID); `nameSeed` is StaticNPC's (the host computes it
 *  by its law); `worldClimate` the location's. Writes the face override
 *  for a resident (the C#'s flatsDict write) and answers the new archive
 *  and record, or null for the classic. */
export function rrVariantPerson(pn, { buildingType = -1, quality = 0, nameSeed = 0, worldClimate = null } = {}) {
  if (!pn) return null;
  if (rrModule('variantNpcs')) {
    const record = rrShopTavernRecord(pn.textureArchive, pn.textureRecord, buildingType, quality);
    if (record > -1) return { textureArchive: RR_NPC_ARCHIVE, textureRecord: record };
  }
  if (rrModule('variantResidents') && isResidence(buildingType)) {
    const v = rrResidentVariant({ archive: pn.textureArchive, record: pn.textureRecord, factionID: pn.factionID ?? 0, nameSeed }, rrClimateRace(worldClimate));
    if (v) {
      setFlatFaceOverride(pn.textureArchive, pn.textureRecord, v.faceIndex);   // flatsDict[flatId] = { faceIndex } (:1017-1023), keyed by the flat the person was born as
      return { textureArchive: v.textureArchive, textureRecord: v.textureRecord };
    }
  }
  return null;
}

// ---- the art on its doors ----------------------------------------------------
let _installed = false;
/** Once: the seven 197 sprites on the replacement door (lazy, gated on
 *  variantNpcs - a classic archive, so ordinary replacement entries, not
 *  stand-ins), the XML scale beside them, and the seventeen button
 *  records on the message box (gated on refinedTraining). `fetchBytes
 *  (name)` is the test seam. Returns the sprite count registered. */
export function installRoleplayRealismArt({ fetchBytes = null } = {}) {
  if (_installed) return 0;
  _installed = true;
  const load = fetchBytes ?? (async (name) => { const r = await fetch(rrArtUrl(name)); if (!r.ok) throw new Error(`${name}: ${r.status}`); return new Uint8Array(await r.arrayBuffer()); });
  const gate = () => rrModule('variantNpcs');
  registerBillboardXml('roleplay-realism', { [RR_NPC_ARCHIVE]: Object.fromEntries(Object.entries(RR_NPC_XML_SCALE)) }, gate);
  for (const record of RR_BUTTON_RECORDS) registerButtonArt(record, () => load(`BUTTONS.RCI_${record}-0`), () => rrRefinedTrainingOn());
  return addVendorTextures(RR_NPC_RECORDS.map((record) => ({
    archive: RR_NPC_ARCHIVE, record, frame: 0, dye: null, map: 'Albedo', fileName: `${RR_NPC_ARCHIVE}_${record}-0`,
    lazy: true, load, gate,
  })));
}
/** Test seam. */
export function _resetRoleplayRealismArt() { _installed = false; }

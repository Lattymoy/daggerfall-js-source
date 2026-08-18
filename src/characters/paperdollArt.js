// Paperdoll art addressing (Characters C6a).
// Verbatim DaggerfallUnityItem.GetInventoryTextureRecord's variant
// resolution: record = playerTextureRecord + variant, with cloaks
// skipping their special interior image first (+1). Filenames follow
// TextureFile.IndexToFileName - plain TEXTURE.NNN archives, so the
// existing reader serves the classic paperdoll art directly; dyes
// apply as C5b band swaps on the indexed bitmap before the palette.

import { armorArchive as armorArchiveByMorphology, BODY_MORPHOLOGY } from '../systems/armorMaterials.js';
import { raceByKey } from '../systems/races.js';

// MensClothing Casual/Formal cloak + WomensClothing Casual/Formal cloak.
const CLOAK_TEMPLATES = new Set([154, 155, 191, 192]);

export const isCloak = (template) => CLOAK_TEMPLATES.has(template.index);

export function resolvePaperdollRecord(template, variant = 0) {
  if (template.variants > 0) {
    let start = template.playerTextureRecord;
    if (isCloak(template)) start += 1;
    return start + variant;
  }
  return template.playerTextureRecord;
}

// --- Armor material addressing (ItemBuilder verbatim) ----------------
// AUDIT 17f / ONE DFU MEMBER, ONE EXPORT: the constants, the
// GetBodyMorphology table and the SetVariant clamps below were a
// THIRD copy of what systems/armorMaterials.js already owns (17e F32
// collapsed equip.js and paperDoll.js and stopped one file short).
// They are re-exported from the single home so the C6a callers that
// speak MATERIAL FAMILIES keep working, and `armorArchive` keeps its
// C6a signature - (gender, RACE) - as a thin wrapper over the
// morphology-keyed law rather than a rival definition of the name.
export {
  FIRST_FEMALE_ARCHIVE as ARCHIVE_FEMALE_BASE,
  FIRST_MALE_ARCHIVE as ARCHIVE_MALE_BASE,
  BODY_MORPHOLOGY, MATERIAL_FAMILY, armorVariant,
} from '../systems/armorMaterials.js';

/** GetBodyMorphology (ItemBuilder.cs:910-925). The race table
 *  (systems/races.js) is the one place a race names its morphology;
 *  this resolves through it, with the classic transform pseudo-races
 *  falling back to Human. */
export function morphologyOfRace(race) {
  const r = raceByKey(race);
  if (r) return r.morphologyIndex;
  return BODY_MORPHOLOGY.Human;   // Vampire/Werewolf/Wereboar + anything unknown
}

/** ApplyArmorSettings' archive, keyed by RACE (the C6a signature). */
export function armorArchive(gender, race) {
  return armorArchiveByMorphology(gender, morphologyOfRace(race));
}

/** SetRace (ItemBuilder.cs:850-854) + ApplyArmorSettings
 *  (:466-485): the PLAYER-texture archive an item's art actually
 *  lives in for one wearer. Clothing offsets its TEMPLATE archive by
 *  the body morphology; armor replaces it with the per-gender base
 *  plus the same offset; everything else keeps the template's.
 *
 *  DFU bakes this into the item at creation (item.PlayerTextureArchive
 *  is an instance field) and BOTH the paperdoll and the inventory
 *  list read it back - GetInventoryTextureArchive returns that same
 *  field (DaggerfallUnityItem.cs:1728-1735). The port resolves it at
 *  draw time from the wearer's identity instead, so a saved item
 *  needs no new field; FLAGGED: a remote list (shop stock, a corpse)
 *  therefore draws its clothing on the PLAYER's morphology, where
 *  classic would show the vendor's - invisible until shop stock
 *  carries its own owner identity. */
export function playerArchiveFor(item, template, { gender = 'male', race = 'Breton' } = {}) {
  const morph = morphologyOfRace(race);
  const base = template?.playerTextureArchive ?? 0;
  if (item.group === 'MensClothing' || item.group === 'WomensClothing') {
    // archive 0 is the "inventory texture not set" sentinel GetItemImage
    // falls back on - offsetting it would forge a real archive number
    return base === 0 ? 0 : base + morph;
  }
  if (item.group === 'Armor') return armorArchiveByMorphology(gender, morph);
  return base;
}

// Paperdoll art addressing (Characters C6a).
// Verbatim DaggerfallUnityItem.GetInventoryTextureRecord's variant
// resolution: record = playerTextureRecord + variant, with cloaks
// skipping their special interior image first (+1). Filenames follow
// TextureFile.IndexToFileName - plain TEXTURE.NNN archives, so the
// existing reader serves the classic paperdoll art directly; dyes
// apply as C5b band swaps on the indexed bitmap before the palette.

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
// Gender picks the archive family base; race adds the body-morphology
// offset; the MATERIAL FAMILY selects which variant row the art lives
// on (leather rows are brown-band and take no metal dye; plate rows
// author in 0x70-0x7F and the metal table tints them; chain has its
// own row). Clamp tables per piece, extraction-checked against the
// SetVariant switch.
export const ARCHIVE_FEMALE_BASE = 245;
export const ARCHIVE_MALE_BASE = 249;
export const BODY_MORPHOLOGY = Object.freeze({ Argonian: 0, Elf: 1, Human: 2, Khajiit: 3 });
export const MATERIAL_FAMILY = Object.freeze({ Leather: 0, Chain: 1, Plate: 2 });

export function morphologyOfRace(race) {
  // Verbatim GetBodyMorphology: Argonian; Dark/High/Wood Elf -> Elf;
  // Breton/Nord/Redguard (and vampire kin) -> Human; Khajiit.
  const ELF = new Set(['DarkElf', 'HighElf', 'WoodElf']);
  const HUMAN = new Set(['Breton', 'Nord', 'Redguard', 'Vampire']);
  if (race === 'Argonian') return BODY_MORPHOLOGY.Argonian;
  if (ELF.has(race)) return BODY_MORPHOLOGY.Elf;
  if (race === 'Khajiit') return BODY_MORPHOLOGY.Khajiit;
  if (HUMAN.has(race)) return BODY_MORPHOLOGY.Human;
  return BODY_MORPHOLOGY.Human;
}

export function armorArchive(gender, race) {
  return (gender === 'female' ? ARCHIVE_FEMALE_BASE : ARCHIVE_MALE_BASE)
    + morphologyOfRace(race);
}

// Verbatim SetVariant clamps, keyed by Armor template index.
export function armorVariant(templateIndex, family, requested = 0) {
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  switch (templateIndex) {
    case 102: // Cuirass
      return family === MATERIAL_FAMILY.Leather ? 0
        : family === MATERIAL_FAMILY.Chain ? 4 : clamp(requested, 1, 3);
    case 104: // Greaves
      return family === MATERIAL_FAMILY.Leather ? clamp(requested, 0, 1)
        : family === MATERIAL_FAMILY.Chain ? 6 : clamp(requested, 2, 5);
    case 105: // Left Pauldron
    case 106: // Right Pauldron
      return family === MATERIAL_FAMILY.Leather ? 0
        : family === MATERIAL_FAMILY.Chain ? 4 : clamp(requested, 1, 3);
    case 103: // Gauntlets
      return family === MATERIAL_FAMILY.Leather ? 0 : 1;
    case 108: // Boots
      return family === MATERIAL_FAMILY.Leather ? 0 : clamp(requested, 1, 2);
    default:
      return requested;
  }
}

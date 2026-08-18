// S3c/U9: the RACE TABLE - DFU RaceTemplate (MIT Daggerfall
// Workshop, Assets/Scripts/Game/Entities/RaceTemplate.cs:172-345)
// verbatim for all eight playable races.
//
// Every race's paperdoll art follows one regular scheme, which the
// port had only ever instantiated for Breton (the loud INTERIM the
// U8f/U8g records carried):
//   background  SCBG0<n>I0.IMG
//   male body   BODY0<n>I0.IMG (unclothed) / BODY0<n>I1.IMG (clothed)
//   female body BODY1<n>I0.IMG / BODY1<n>I1.IMG
//   male heads  FACE0<n>I0.CIF   female heads FACE1<n>I0.CIF
// with n = the race's zero-based art index (Breton 0 .. Argonian 7);
// the Races ENUM is 1-based (Breton = 1), so the two differ by one -
// exactly the off-by-one that makes hand-written tables drift, which
// is why this is generated from the scheme and pinned against the
// DFU literals rather than typed out.
//
// Each FACE CIF carries 10 head records (verified against the
// shipping ARENA2 data), so faceIndex is 0..9.
//
// Body MORPHOLOGY (ItemBuilder.GetBodyMorphology) is a SEPARATE
// 4-value axis that armor art keys on - it lives with the armor
// material tables, and this module names each race's morphology so
// the two never drift apart.

// AUDIT 17f: from the single armor-material home, not through
// paperdollArt - paperdollArt now resolves morphology THROUGH this
// table, and the old import made that a cycle.
import { BODY_MORPHOLOGY } from './armorMaterials.js';

/** EntityEnums.Races (1-based; Vampire/Werewolf/Wereboar are the
 *  transformed pseudo-races and are not selectable at chargen). */
export const RACES = Object.freeze({
  Breton: 1, Redguard: 2, Nord: 3, DarkElf: 4,
  HighElf: 5, WoodElf: 6, Khajiit: 7, Argonian: 8,
});

/** GetBodyMorphology (ItemBuilder.cs:910-925): Argonian 0, the three
 *  elves 1, the three humans 2, Khajiit 3. */
const MORPHOLOGY_OF = Object.freeze({
  Breton: 'Human', Redguard: 'Human', Nord: 'Human',
  DarkElf: 'Elf', HighElf: 'Elf', WoodElf: 'Elf',
  Khajiit: 'Khajiit', Argonian: 'Argonian',
});

export const FACES_PER_RACE = 10;   // records in each FACE*.CIF

const two = (n) => String(n).padStart(2, '0');
const build = (key, artIndex) => Object.freeze({
  key,
  name: key.replace(/([a-z])([A-Z])/g, '$1 $2'),   // DarkElf -> "Dark Elf"
  id: RACES[key],
  artIndex,
  morphology: MORPHOLOGY_OF[key],
  morphologyIndex: BODY_MORPHOLOGY[MORPHOLOGY_OF[key]],
  background: `SCBG${two(artIndex)}I0.IMG`,
  bodyMale: Object.freeze([`BODY${two(artIndex)}I0.IMG`, `BODY${two(artIndex)}I1.IMG`]),
  bodyFemale: Object.freeze([`BODY1${artIndex}I0.IMG`, `BODY1${artIndex}I1.IMG`]),
  headsMale: `FACE${two(artIndex)}I0.CIF`,
  headsFemale: `FACE1${artIndex}I0.CIF`,
});

export const RACE_TEMPLATES = Object.freeze(
  Object.keys(RACES).map((key, i) => build(key, i)));

export const RACE_KEYS = Object.freeze(RACE_TEMPLATES.map((r) => r.key));
export const raceByKey = (key) => RACE_TEMPLATES.find((r) => r.key === key) ?? null;
export const raceById = (id) => RACE_TEMPLATES.find((r) => r.id === id) ?? null;

/** The paperdoll's art set for one identity. */
export function raceArt(raceKey, gender = 'male') {
  const r = raceByKey(raceKey) ?? RACE_TEMPLATES[0];
  const male = gender !== 'female';
  return {
    race: r,
    background: r.background,
    body: male ? r.bodyMale : r.bodyFemale,
    heads: male ? r.headsMale : r.headsFemale,
  };
}

// @ts-check
// MWNPC7 (2026-10-09, the MW-NPC arc's seventh slice - bible/04-Characters/Morrowind-NPCs.md section 12): A
// TOWNSPERSON, READ FOR THEIR BODY. The street's walkers (systems/town/townPopulation.js - characters/mobile/mobilePerson.js) carry
// what Daggerfall rolled for them at each spawn: the climate's race, a gender, one of four outfit variants (the sprite
// archive, PERSON_TEXTURES), a face record, a name - or the guard's arm (texture 399, a male in the watch's colours).
// This reads that roll for a Morrowind body: the race and gender as rolled, a face off the face record, and a wardrobe
// per outfit variant. MWNPC17 (section 25): the variant is the walker's ROLE and CUT - the commoner, the tradesman,
// the traveller and the robed scholar, a woman's skirt or breeches or robe, as their sprite shows them - and the rest
// is rolled off their own spawn by the wardrobe (characters/wardrobe.js dressPerson): the garments, the dyes, the cloak,
// the rung of Morrowind's ladder, and through the look's `npc` hint the records, the head and the hair - so no two on a
// street are one person twice. A walker re-rolled at a respawn is a new person: a new id (a body built for them, never
// the last one re-dressed) and a new look.
import { GENDERS } from './nameHelper.js';
import { PERSON_TEXTURES, GUARD_TEXTURE } from './mobile/mobilePerson.js';
import { EQUIP_SLOTS } from '../systems/equip.js';
import { ARMOR_ENUM } from '../combat/enemyEquipment.js';
import { ARMOR_MATERIAL } from '../systems/armorMaterials.js';   // MWNPC12: steel is ARMOR_MATERIAL.Steel - a look's armour is resolved by it (mwItemMap.js mwArmorRecords)
import { dressPerson, npcHint, WARDROBE_BEAST_RACES } from './wardrobe.js';   // MWNPC17
import { townsfolkOutfitOf } from './ownModels/ownClothingModels.js';   // MW-FOLK1: the outfits the walkers' pictures wear, made for the body

/** MWNPC17: what each outfit variant is, by gender, in PERSON_TEXTURES' variant order - the wardrobe's role and the cut
 *  their sprite shows (characters/wardrobe.js WARDROBE_ROLES, SILHOUETTES). */
export const FOLK_DRESS = Object.freeze({
  male: Object.freeze([
    Object.freeze({ role: 'commoner', cut: 'pants' }),    // a short shirt and casual pants - the commoner
    Object.freeze({ role: 'tradesman', cut: 'pants' }),   // a tunic and breeches - the tradesman
    Object.freeze({ role: 'traveller', cut: 'pants' }),   // a long shirt and tall boots - the traveller
    Object.freeze({ role: 'scholar', cut: 'robe' }),      // plain robes - the scholar
  ]),
  female: Object.freeze([
    Object.freeze({ role: 'commoner', cut: 'skirt' }),    // a peasant blouse and a long skirt
    Object.freeze({ role: 'tradesman', cut: 'pants' }),   // a long shirt and casual pants
    Object.freeze({ role: 'scholar', cut: 'robe' }),      // plain robes
    Object.freeze({ role: 'commoner', cut: 'skirt' }),    // a short shirt and a long skirt
  ]),
});

function mix(h) {
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}
const strHash = (s) => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193); return h >>> 0; };

/** The outfit variant a walker's sprite archive is (PERSON_TEXTURES' index), or 0. */
export function folkVariant(archive, race) {
  const t = PERSON_TEXTURES[race] ?? PERSON_TEXTURES.Breton;
  const i = t.male.indexOf(archive);
  if (i >= 0) return i;
  const j = t.female.indexOf(archive);
  return j >= 0 ? j : 0;
}

let _shells = 0;
/**
 * The walker's spawn, read: a new roll (another archive, face or name than the walker's last) is a new person - a new
 * id and a new look. Kept on the walker until the next roll.
 * @param {any} person @param {string} race
 */
function spawnOf(person, race) {
  const key = `${person.archive}|${person.personFaceRecordId ?? 0}|${person.nameNPC ?? ''}|${person.gender ?? 0}`;
  if (person._mwFolk && person._mwFolk.key === key) return person._mwFolk;
  const shell = person._mwShell ??= ++_shells;
  const n = (person._mwFolk?.n ?? 0) + 1;
  const seed = mix(strHash(key) ^ mix(shell));
  return (person._mwFolk = { key, n, id: `${shell}.${n}`, seed, look: folkLookOf(person, race, seed) });
}

/** The look for a walker's roll: their race and gender, a face, the outfit's clothes in their dyes - or the guard's
 *  plate (texture 399's watchman). MWNPC10c: and a living world's resident's, on their own id's seed (rosterBodies.js
 *  residentLook) - one look for them wherever they are drawn. */
export function folkLookOf(person, race, seed) {
  const female = person.gender === GENDERS.Female;
  const gender = female ? 'female' : 'male';
  const items = [];
  if (person.guard || person.archive === GUARD_TEXTURE) {
    // the street's guard: the watch's iron and steel, his longsword drawn at need - and none of it rolled
    for (const [slot, piece] of [['ChestArmor', ARMOR_ENUM.Cuirass], ['LegsArmor', ARMOR_ENUM.Greaves], ['Head', ARMOR_ENUM.Helm], ['Feet', ARMOR_ENUM.Boots],
      ['LeftArm', ARMOR_ENUM.Left_Pauldron], ['RightArm', ARMOR_ENUM.Right_Pauldron], ['Gloves', ARMOR_ENUM.Gauntlets]]) {
      items.push({ templateIndex: piece, group: 'Armor', equipSlot: EQUIP_SLOTS[slot], material: ARMOR_MATERIAL.Steel });   // steel - MWNPC12: 1 named no material, so none of it was ever worn
    }
    items.push({ templateIndex: 165, group: 'MensClothing', equipSlot: EQUIP_SLOTS.ChestClothes, dye: 1 });
    items.push({ templateIndex: 151, group: 'MensClothing', equipSlot: EQUIP_SLOTS.LegsClothes, dye: 1 });
    // MWNPC17: the uniform is the watch's; the man in it his own - his head, his hair and the shirt under the plate
    return { race, gender: 'male', faceIndex: mix(seed ^ 0xfa) % 10, items, npc: npcHint(seed, 0) };
  }
  const faceIndex = ((person.personFaceRecordId ?? 0) + mix(seed ^ 0xfa)) % 10;
  // MW-FOLK1: A PICTURE WITH ITS OWN OUTFIT WEARS IT - the clothes it draws, made for the body (ownClothingModels.js
  // TOWNSFOLK_OUTFITS), in its colours; the person in them their own (the hint's walk: their head, their hair, their
  // body's key). A picture of the other sex than the walker (never rolled - PERSON_TEXTURES keeps them apart) is not
  // theirs to wear, nor is one a beast race stands in (a resident's) - its boots on no Khajiit's or Argonian's feet,
  // as Morrowind dresses none (wardrobe.js beastWorn): the wardrobe dresses them, barefoot.
  const own = townsfolkOutfitOf(person.archive);
  if (own && spriteSex(person.archive) === gender && !WARDROBE_BEAST_RACES.includes(race)) return { race, gender, faceIndex, items: [], npc: npcHint(seed, 0), outfit: own.id };
  const { role, cut } = FOLK_DRESS[gender][folkVariant(person.archive, race)];
  const d = dressPerson({ role, gender, seed, cut });   // MWNPC17: the role and cut their sprite shows, the rest their own
  return { race, gender, faceIndex, items: d.items, npc: d.npc };
}

/** MW-FOLK1: the sex a walker's picture is (PERSON_TEXTURES' lists), or null for an archive no list holds. */
export function spriteSex(archive) {
  for (const t of Object.values(PERSON_TEXTURES)) {
    if (t.male.includes(archive)) return 'male';
    if (t.female.includes(archive)) return 'female';
  }
  return null;
}

/** The look a walker stands in (their spawn's). @param {any} person @param {string} race */
export const folkLook = (person, race) => spawnOf(person, race).look;

/**
 * The actor the lane stands for a walker (characters/npcBodies.js `stand`): their spawn's id and look, their feet as
 * the host places their billboard, their facing (the walker's wheel - forward is (sin, cos), the foes' convention),
 * walking while they move; never running, never armed, never hit, never dead - the street's walkers do none of it.
 * One object a walker, rewritten each frame.
 * @param {any} person @param {number[]} feet @param {string} race
 */
export function folkActor(person, feet, race) {
  const s = spawnOf(person, race);
  const a = person._mwActor ??= { id: '', look: null, feet: null, yaw: 0, moving: false, running: false, drawn: false, swings: 0, strike: 0, casts: 0, castRange: 0, hits: 0, dead: 0 };
  a.id = s.id; a.look = s.look; a.feet = feet;
  a.yaw = Number.isFinite(person.yaw) ? person.yaw : (person.facingYaw ?? 0);
  a.moving = person.state === 'move';
  return a;
}

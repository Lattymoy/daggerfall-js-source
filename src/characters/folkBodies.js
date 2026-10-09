// @ts-check
// MWNPC7 (2026-10-09, the MW-NPC arc's seventh slice - bible/04-Characters/Morrowind-NPCs.md section 12): A
// TOWNSPERSON, READ FOR THEIR BODY. The street's walkers (systems/townPopulation.js - characters/mobilePerson.js) carry
// what Daggerfall rolled for them at each spawn: the climate's race, a gender, one of four outfit variants (the sprite
// archive, PERSON_TEXTURES), a face record, a name - or the guard's arm (texture 399, a male in the watch's colours).
// This reads that roll for a Morrowind body: the race and gender as rolled, a face off the face record, and a wardrobe
// per outfit variant (a commoner's shirt and pants, a tunic and breeches, a long shirt and tall boots, a robe - and the
// women's four), dyed off the walker's own spawn so a street is not one colour. A walker re-rolled at a respawn is a
// new person: a new id (a body built for them, never the last one re-dressed) and a new look.
import { GENDERS } from './nameHelper.js';
import { PERSON_TEXTURES, GUARD_TEXTURE } from './mobilePerson.js';
import { EQUIP_SLOTS } from '../systems/equip.js';
import { ARMOR_ENUM } from '../combat/enemyEquipment.js';

/** What each outfit variant wears (its Daggerfall clothing templates - mwItemMap.js dresses each in a Morrowind CLOT),
 *  by gender, in PERSON_TEXTURES' variant order. [shirt-or-robe, legs or null, feet]. */
export const FOLK_OUTFITS = Object.freeze({
  male: Object.freeze([
    Object.freeze([165, 151, 147]),    // a short shirt, casual pants, shoes - the commoner
    Object.freeze([158, 152, 149]),    // a short tunic, breeches, boots - the tradesman
    Object.freeze([167, 151, 148]),    // a long shirt, casual pants, tall boots - the traveller
    Object.freeze([163, null, 147]),   // plain robes and shoes - the scholar
  ]),
  female: Object.freeze([
    Object.freeze([184, 212, 186]),    // a peasant blouse, a long skirt, shoes
    Object.freeze([204, 190, 188]),    // a long shirt, casual pants, boots
    Object.freeze([200, null, 186]),   // plain robes and shoes
    Object.freeze([202, 212, 187]),    // a short shirt, a long skirt, tall boots
  ]),
});
/** The street's dyes - the common garment's colours (characters/dyes.js DYE_COLORS). */
export const FOLK_DYES = Object.freeze([1, 3, 5, 0, 2, 9, 4, 6, 7, 8]);

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
 *  plate (texture 399's watchman). */
function folkLookOf(person, race, seed) {
  const female = person.gender === GENDERS.Female;
  const gender = female ? 'female' : 'male';
  const items = [];
  if (person.guard || person.archive === GUARD_TEXTURE) {
    // the street's guard: the watch's iron and steel, his longsword drawn at need - and none of it rolled
    for (const [slot, piece] of [['ChestArmor', ARMOR_ENUM.Cuirass], ['LegsArmor', ARMOR_ENUM.Greaves], ['Head', ARMOR_ENUM.Helm], ['Feet', ARMOR_ENUM.Boots],
      ['LeftArm', ARMOR_ENUM.Left_Pauldron], ['RightArm', ARMOR_ENUM.Right_Pauldron], ['Gloves', ARMOR_ENUM.Gauntlets]]) {
      items.push({ templateIndex: piece, group: 'Armor', equipSlot: EQUIP_SLOTS[slot], material: 1 });   // steel
    }
    items.push({ templateIndex: 165, group: 'MensClothing', equipSlot: EQUIP_SLOTS.ChestClothes, dye: 1 });
    items.push({ templateIndex: 151, group: 'MensClothing', equipSlot: EQUIP_SLOTS.LegsClothes, dye: 1 });
    return { race, gender: 'male', faceIndex: mix(seed ^ 0xfa) % 10, items };
  }
  const outfit = FOLK_OUTFITS[gender][folkVariant(person.archive, race)];
  const group = female ? 'WomensClothing' : 'MensClothing';
  const dye = (k) => FOLK_DYES[mix(seed ^ k) % FOLK_DYES.length];
  items.push({ templateIndex: outfit[0], group, equipSlot: EQUIP_SLOTS.ChestClothes, dye: dye(0xd1) });
  if (outfit[1] != null) items.push({ templateIndex: outfit[1], group, equipSlot: EQUIP_SLOTS.LegsClothes, dye: dye(0xd2) });
  items.push({ templateIndex: outfit[2], group, equipSlot: EQUIP_SLOTS.Feet, dye: dye(0xd3) });
  return { race, gender, faceIndex: ((person.personFaceRecordId ?? 0) + mix(seed ^ 0xfa)) % 10, items };
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
